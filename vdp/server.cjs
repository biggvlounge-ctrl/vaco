// VDP — its first real backend.
//
// Everything in `src/lib/` used to be a real, in-memory engine with
// nowhere real to live: one browser tab, reset on reload, invisible
// to any second player. This is the server half: a persisted store
// (same `lib/persistence.cjs` + `lib/storeBackend.cjs` boilerplate
// every other real app in this repo already uses — copied in, not
// shared by reference, matching the per-app duplication convention
// `lib/shieldAuth.cjs`'s own header documents) and a WebSocket layer
// for a genuinely shared world, modeled directly on
// `cvnvo/lib/messageSocket.js`.
//
// The game LOGIC stays where it already was and already worked:
// `src/lib/npcs.js`, `skills.js`, `relationships.js`, `property.js`,
// `beliefs.js`, `jobs.js`, `library.js` are real ESM modules, loaded
// here with a dynamic `import()` (Node's documented way to load ESM
// from CommonJS) rather than duplicated into a second module system.
//
// Run:
//   npm install
//   node server.cjs
//
// Test:
//   curl http://localhost:8827/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv/config');

// No manual commit calls below: `attachStore` mounts the generic
// durable hook app-wide (the same "one missed route is a silent hole"
// argument `vaco-notify`'s own `lib/persistence.cjs` header makes),
// and every route here answers an ordinary 2xx on success — unlike
// `vaco-notify`'s `/api/notify`, nothing here needs to bypass it.
const { attachStore } = require('./lib/storeBackend.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { requireActor, requireParamActor, actorOrService } = require('./lib/shieldAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');
const { createMessageSocketServer } = require('./lib/messageSocket.cjs');

const PORT = process.env.PORT || 8827;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';
const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';
const VACAY_API_URL = process.env.VACAY_API_URL || 'http://localhost:8803';
// The shared ecosystem-wide convention every other real app's
// server.js already uses (checked directly: voken/server.js,
// voidmagic/server.js) -- one env var pair, not a per-app-named one.
// `start-ecosystem.sh` generates a single `VACO_SERVICE_TOKEN` and
// exports it for every child process; each app supplies its OWN name
// by defaulting to its own literal name when the env var is unset,
// same as this line.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vdp';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';

const app = express();
const server = http.createServer(app);
const livePositions = {}; // userId -> {x, y}, broadcast to every connected client

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(traceMiddleware());

const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

app.use(express.static(path.join(__dirname, 'public')));

function createVdpStore() {
  return {
    players: {},
    jobs: { assignments: {}, shifts: [], nextShiftId: 1 },
    property: { properties: [], nextPropertyId: 1 },
    resources: null, // set in onReady, from resourcesLib's own starting-stock constant
    households: { households: [], nextHouseholdId: 1 },
    organizations: { organizations: [], nextOrganizationId: 1 },
    vavlt: { presence: {} },
    voidHubs: { registered: false, stations: [] },
    vacayHotels: { listingIds: [] },
    relationships: {},
    npcWorld: null,
    news: { events: [], nextId: 1 },
  };
}

// VDP's own server-to-server VCoin transfer, authenticated the same
// way `serviceAuth.cjs`'s own header says most of V3's real transfer
// volume already is: `X-Service-Name`/`X-Service-Token`, no end-user
// session to present, because a job's payroll account and a home
// purchase are initiated by VDP's server, not by a browser holding a
// Shield bearer token.
async function transferVCoin({ fromUserId, toUserId, amount, reason }) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Name': VACO_SERVICE_NAME,
      'X-Service-Token': VACO_SERVICE_TOKEN,
    },
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `transferVCoin failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

// VDP's own server-to-server VOID Hub Station registration -- same
// auth posture as transferVCoin above (X-Service-Name/X-Service-Token,
// no end-user session), because registering Meridian's own real
// logistics infrastructure is VDP's server declaring its own
// presence on VOID's network, not something any one player does.
// VOID's own `registerStation` (void/lib/stations.js) rejects a bare
// "hub" with no port capability outright, so every station VDP
// registers is real `hub-and-port`, matching the real-world VOID Hub
// Station model this is meant to mirror, per direct instruction ("the
// void hub should be similar to how the void hub is used in real
// life").
async function registerVoidHub({ regionId, bayCount, temperatureControlled, lat, lng }) {
  const res = await fetch(`${VOID_API_URL}/api/station`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Name': VACO_SERVICE_NAME,
      'X-Service-Token': VACO_SERVICE_TOKEN,
    },
    body: JSON.stringify({
      regionId, stationType: 'hub-and-port', bayCount, supportsRelay: true, temperatureControlled, lat, lng,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `registerVoidHub failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

let store = createVdpStore();

(async () => {
  // Dynamic import: these are real ESM modules (`"type": "module"` in
  // package.json, same files Vite serves to the browser), loaded once
  // at boot rather than duplicated into a CommonJS copy.
  const npcs = await import('./src/lib/npcs.js');
  const skillsLib = await import('./src/lib/skills.js');
  const beliefsLib = await import('./src/lib/beliefs.js');
  const relationshipsLib = await import('./src/lib/relationships.js');
  const propertyLib = await import('./src/lib/property.js');
  const resourcesLib = await import('./src/lib/resources.js');
  const householdsLib = await import('./src/lib/households.js');
  const organizationsLib = await import('./src/lib/organizations.js');
  const vavltLib = await import('./src/lib/vavlt.js');
  const jobsLib = await import('./src/lib/jobs.js');
  const libraryLib = await import('./src/lib/library.js');
  const populationLib = await import('./src/lib/population.js');
  const newsLib = await import('./src/lib/news.js');
  const cityTiersLib = await import('./src/lib/cityTiers.js');
  const foodDistrictLib = await import('./src/lib/foodDistrict.js');
  const chopzLib = await import('./src/lib/chopz.js');

  function ensurePlayer(userId) {
    if (!store.players[userId]) {
      store.players[userId] = {
        state: npcs.createPlayerState(),
        skills: skillsLib.createSkills(),
        beliefs: beliefsLib.createBeliefs(),
        library: libraryLib.createLibrary(),
      };
    }
    return store.players[userId];
  }

  // Register Meridian's own real VOID Hub Stations once, idempotently
  // -- guarded by the persisted `registered` flag so a server restart
  // never re-registers duplicates. Two real stations, matching the
  // user's own split ("locations for package distribution food
  // distribution"): a general hub-and-port for package throughput, and
  // VOID's own real temperature-controlled variant
  // (VOID_FOOD_CAPABLE_STATIONS.md's "hot and cold section" hybrid)
  // for food distribution. Coordinates are a flagged placeholder --
  // Meridian is fictional, so this uses a real St. Charles, MO point
  // (the first real-world reference this world's design pulled from)
  // rather than an arbitrary lat/lng. Fails soft: VOID may not be
  // running in every dev environment, and a missing hub must not take
  // VDP's own server down.
  //
  // Runs from inside `onReady`, not right after `attachStore()`
  // returns -- `attachStore` loads the persisted store asynchronously
  // and calls `onReady` once it's actually ready; code placed after
  // the `attachStore(...)` call itself runs immediately, against the
  // stale pre-load `store` binding, before the real one is in place.
  async function registerMeridianVoidHubsOnce() {
    if (store.voidHubs.registered) return;
    const MERIDIAN_REGION_ID = 'meridian';
    const MERIDIAN_LAT = 38.7881;
    const MERIDIAN_LNG = -90.4974;
    try {
      const packageHub = await registerVoidHub({
        regionId: MERIDIAN_REGION_ID, bayCount: 2, temperatureControlled: false,
        lat: MERIDIAN_LAT, lng: MERIDIAN_LNG,
      });
      const foodHub = await registerVoidHub({
        regionId: MERIDIAN_REGION_ID, bayCount: 2, temperatureControlled: true,
        lat: MERIDIAN_LAT, lng: MERIDIAN_LNG,
      });
      store.voidHubs = { registered: true, stations: [packageHub, foodHub] };
      console.log(`VDP: registered ${store.voidHubs.stations.length} real VOID Hub Stations for Meridian.`);
    } catch (err) {
      console.warn(`VDP: could not register Meridian's VOID Hub Stations (VOID may not be running): ${err.message}`);
    }
  }

  attachStore(app, {
    appKey: 'vdp',
    createDefault: createVdpStore,
    filePath: path.join(__dirname, 'data', 'store.json'),
    onReady: (loaded) => {
      store = loaded;
      if (!store.npcWorld) store.npcWorld = npcs.createNpcWorld();
      if (!store.news) store.news = newsLib.createNewsLog();
      if (!store.households) store.households = householdsLib.createHouseholdsStore();
      if (!store.organizations) store.organizations = organizationsLib.createOrganizationsStore();
      if (!store.vavlt) store.vavlt = vavltLib.createVavltStore();
      if (!store.voidHubs) store.voidHubs = { registered: false, stations: [] };
      if (!store.vacayHotels) store.vacayHotels = { listingIds: [] };
      if (!store.resources) store.resources = resourcesLib.createResourcesStore();
      registerMeridianVoidHubsOnce();
    },
  });

  // --- World / health -----------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'vdp',
      players: Object.keys(store.players).length,
      npcs: store.npcWorld ? store.npcWorld.npcs.length : 0,
    });
  });

  // A real headcount, not a simulated one -- see population.js's own
  // header for why this is deliberately not worldExpansion.js's
  // backdrop-city population signal.
  app.get('/api/population', (_req, res) => {
    const playerCount = Object.keys(store.players).length;
    const npcCount = store.npcWorld ? store.npcWorld.npcs.length : 0;
    res.json(populationLib.describePopulation(playerCount, npcCount));
  });

  // Meridian's own real VOID Hub Station registration -- a cached
  // readout of what VOID itself returned (not re-derived here), so
  // the client sees real registration status even if VOID is briefly
  // unreachable at request time.
  app.get('/api/void-hubs', (_req, res) => {
    res.json(store.voidHubs);
  });

  // Meridian's own real VACAY hotels -- per direct instruction
  // ("every village will have hotels in them... tier one might just
  // have one hotel, up to tier five might have three"). A VACAY
  // "hotel" is a real Stay listing with `hostType: 'professional'`
  // (VACAY's own Booking.com-style inventory split), created by a
  // real logged-in player through VACAY's own real, actor-gated
  // `POST /api/bookings/listings` (`requireActor('hostId')` demands a
  // genuine Shield session matching the host -- there is no
  // service-credential path for it the way VOID's station route has,
  // so VDP's server cannot register these itself the way it does Void
  // Hubs). This endpoint is VDP's own bookkeeping layer on top of that
  // real listing: VACAY's `Listing` record has no location field at
  // all, so there is no way to ask VACAY "which listings are
  // Meridian's" -- VDP tracks that itself, and enforces the real
  // per-tier cap from `cityTiers.js`.
  app.get('/api/vacay-hotels', (_req, res) => {
    const tier = cityTiersLib.classifyMeridian();
    res.json({
      listingIds: store.vacayHotels.listingIds,
      maxHotels: tier ? tier.maxHotels : 0,
      tierName: tier ? tier.name : null,
    });
  });

  // Registers an already-created VACAY Stay listing as one of
  // Meridian's hotels. Two real checks, not just a client-trusted
  // claim: (1) the tier cap from cityTiers.js is not exceeded, (2) the
  // listing genuinely exists on VACAY's own server and its real
  // `hostId` matches the session registering it -- a player cannot
  // claim someone else's listing as "theirs."
  app.post('/api/vacay-hotels/register', requireActor('registeredBy'), async (req, res) => {
    const { listingId, registeredBy } = req.body || {};
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'register requires an integer listingId' });
    }
    if (store.vacayHotels.listingIds.includes(listingId)) {
      return res.status(409).json({ error: `listing ${listingId} is already registered as a Meridian hotel` });
    }
    const tier = cityTiersLib.classifyMeridian();
    const cap = tier ? tier.maxHotels : 0;
    if (store.vacayHotels.listingIds.length >= cap) {
      return res.status(409).json({
        error: `Meridian (${tier ? tier.name : 'unclassified'}) already has its real cap of ${cap} hotel(s)`,
      });
    }
    let listing;
    try {
      const vacayRes = await fetch(`${VACAY_API_URL}/api/bookings/listings/${listingId}`);
      if (!vacayRes.ok) throw new Error(`VACAY answered ${vacayRes.status}`);
      listing = await vacayRes.json();
    } catch (err) {
      return res.status(502).json({ error: `could not verify listing ${listingId} with VACAY: ${err.message}` });
    }
    if (listing.hostId !== registeredBy) {
      return res.status(403).json({ error: 'register: the registering session does not own this VACAY listing' });
    }
    store.vacayHotels.listingIds.push(listingId);
    res.status(201).json({ listingIds: store.vacayHotels.listingIds, maxHotels: cap });
  });

  // Live World News — a read-only feed of things that already
  // happened elsewhere (job payouts, property purchases, book
  // effects, notable NPC decisions, chat). ?limit caps how many of
  // the most recent events come back; newsLib clamps it.
  app.get('/api/news', (req, res) => {
    const limit = Number(req.query.limit) || 30;
    res.json({ events: newsLib.listNews(store.news, limit) });
  });

  // --- Player needs/goals (reuses npcs.js's own engine) --------------
  app.get('/api/players/:id/state', (req, res) => {
    const player = ensurePlayer(req.params.id);
    res.json({ state: player.state, skills: player.skills, beliefs: player.beliefs });
  });

  // A player "doing" a need-satisfying action (visiting a district,
  // resting at home) marks the same `lastActionTick`/habit-reinforce
  // path an NPC's own `applyAction` already uses, via the functions
  // `npcs.js` now exports for exactly this reuse.
  app.post('/api/players/:id/actions', requireParamActor('id'), (req, res) => {
    const player = ensurePlayer(req.params.id);
    const { action } = req.body || {};
    if (!npcs.HABIT_NAMES.includes(action)) {
      return res.status(400).json({ error: `actions: "${action}" is not a recognized action` });
    }
    player.state.lastActionTick[action] = store.npcWorld.tick;
    npcs.reinforceHabit(player.state, action);
    res.json({ state: player.state });
  });

  // --- Jobs ------------------------------------------------------------
  app.get('/api/jobs', (_req, res) => res.json({ jobs: jobsLib.listJobs() }));

  app.post('/api/jobs/:jobId/clock-in', requireActor('workerId'), (req, res) => {
    try {
      const assignment = jobsLib.clockIn(store.jobs, { workerId: req.body.workerId, jobId: req.params.jobId });
      res.status(201).json(assignment);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/jobs/clock-out', requireActor('workerId'), async (req, res) => {
    const { workerId } = req.body;
    try {
      const shift = await jobsLib.clockOutAndPay(store.jobs, {
        workerId, transferFn: transferVCoin,
        resourcesStore: store.resources, grantMaterialsFn: resourcesLib.grantMaterials,
      });
      const player = ensurePlayer(workerId);
      skillsLib.gainFromShift(player.skills, shift.skill);
      const job = jobsLib.getJob(shift.jobId);
      const yieldText = shift.yielded ? `, and gathered ${shift.yielded.amount} ${shift.yielded.type}` : '';
      newsLib.recordEvent(store.news, {
        kind: 'job',
        text: `${workerId} finished a shift as ${job ? job.title : shift.jobId} and earned ${shift.pay} VCoin${yieldText}`,
      });
      res.status(200).json(shift);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // A player's own real job history -- current assignment plus every
  // real, paid shift, for the My Assets dashboard. Nothing new is
  // computed here; jobsLib already tracks both.
  app.get('/api/players/:id/jobs', (req, res) => {
    res.json({
      assignment: jobsLib.currentAssignment(store.jobs, req.params.id),
      shifts: jobsLib.shiftsFor(store.jobs, req.params.id),
    });
  });

  // Food District's own real production payout. `foodDistrict.js`'s
  // `cookBatch` pays a platform-funded leg (the brand's own payroll ->
  // the cook) -- per this project's own standing rule (see
  // `transferVCoin` above), that must come from a backend holding a
  // service credential, never a browser calling V3 directly as if it
  // were `food-district-payroll`. This route is that backend: the
  // client's own `foodDistrict.js` store (client-side, like CHOPZ's)
  // stays the source of truth for inventory; this route only performs
  // the one leg a browser must not instruct itself, and the client
  // applies the real inventory bump once this confirms the payout.
  app.post('/api/food-district/cook-payout', requireActor('cookId'), async (req, res) => {
    const { cookId, brandSlug } = req.body || {};
    try {
      if (!foodDistrictLib.getBrand(brandSlug)) {
        throw new Error(`no brand with slug "${brandSlug}"`);
      }
      // The real crop ingredient, spent here rather than in
      // foodDistrict.js's own cookBatch -- that function takes the
      // FULL inventory store, which is client-side here (see header
      // above); resources.js's materials are real and server-side
      // regardless, so the ingredient leg belongs on this side of the
      // split, same as the VCoin leg already is.
      const spendResult = resourcesLib.spendMaterials(
        store.resources, cookId, { crop: foodDistrictLib.COOK_CROP_PER_BATCH },
      );
      let result;
      try {
        result = await transferVCoin({
          fromUserId: foodDistrictLib.PAYROLL_ACCOUNT_ID,
          toUserId: cookId,
          amount: foodDistrictLib.COOK_PAY_PER_BATCH,
          reason: `vdp_food_district_cook:${brandSlug}`,
        });
      } catch (err) {
        resourcesLib.undoSpend(store.resources, cookId, spendResult);
        throw err;
      }
      res.status(201).json({
        ok: true, amount: foodDistrictLib.COOK_PAY_PER_BATCH, batchSize: foodDistrictLib.COOK_BATCH_SIZE,
        transfer: result, ingredientsUsed: spendResult.spent,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // CHOPZ District's own real shift payout. `chopz.js`'s `runShift` pays a
  // platform-funded leg (the platform account -> the unit's owner) -- same
  // rule as Food District's cook-payout above, so this route holds the real
  // service credential and performs that one leg; the client's own
  // entirely-client-side CHOPZ store stays the source of truth for stock
  // and cooldowns, applying the real stock decrement once this confirms
  // the payout. `SHIFT_PAYOUT` is a flat, server-known constant (not a
  // client-supplied amount), so it is safe to trust here.
  app.post('/api/chopz/shift-payout', requireActor('ownerId'), async (req, res) => {
    const { ownerId, unitId } = req.body || {};
    try {
      const result = await transferVCoin({
        fromUserId: chopzLib.PLATFORM_USER_ID,
        toUserId: ownerId,
        amount: chopzLib.SHIFT_PAYOUT,
        reason: `venvs_chopz_shift:${unitId}`,
      });
      res.status(201).json({ ok: true, amount: chopzLib.SHIFT_PAYOUT, transfer: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Property / housing ----------------------------------------------
  app.get('/api/property/:ownerId', (req, res) => {
    res.json({ home: propertyLib.homeOwnedBy(store.property, req.params.ownerId) });
  });

  app.post('/api/property/purchase', requireActor('ownerId'), async (req, res) => {
    try {
      const home = await propertyLib.purchaseHome(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
      });
      householdsLib.ensureHousehold(store.households, { propertyId: home.id, ownerId: req.body.ownerId });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `${req.body.ownerId} bought a ${home.levelName}`,
      });
      res.status(201).json(home);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/property/upgrade', requireActor('ownerId'), async (req, res) => {
    try {
      const home = await propertyLib.upgradeHome(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
        resourcesStore: store.resources,
        spendMaterialsFn: resourcesLib.spendMaterials,
        undoSpendFn: resourcesLib.undoSpend,
      });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `${req.body.ownerId} upgraded their home to ${home.levelName}`,
      });
      res.status(200).json(home);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/property/rent', requireActor('ownerId'), async (req, res) => {
    try {
      const home = await propertyLib.rentHome(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
      });
      householdsLib.ensureHousehold(store.households, { propertyId: home.id, ownerId: req.body.ownerId });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `${req.body.ownerId} rented a ${home.levelName}`,
      });
      res.status(201).json(home);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/property/buy-rented', requireActor('ownerId'), async (req, res) => {
    try {
      const home = await propertyLib.buyRentedHome(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
      });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `${req.body.ownerId} bought the home they were renting`,
      });
      res.status(200).json(home);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Resources: local materials and the old-world import stock -------
  app.get('/api/resources/:id', (req, res) => {
    res.json({
      materials: resourcesLib.materialsFor(store.resources, req.params.id),
      canDig: resourcesLib.canDig(store.resources, req.params.id),
      oldWorldStock: store.resources.oldWorldStock,
    });
  });

  app.post('/api/resources/:id/dig', requireParamActor('id'), (req, res) => {
    try {
      const result = resourcesLib.digForResources(store.resources, { entityId: req.params.id });
      newsLib.recordEvent(store.news, {
        kind: 'resources',
        text: `${req.params.id} dug up ${result.amount} ${result.type}`,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Households: who actually lives together -------------------------
  app.get('/api/households/:propertyId', (req, res) => {
    res.json({ household: householdsLib.householdFor(store.households, Number(req.params.propertyId)) });
  });

  // Only a current resident can invite someone else onto their own
  // property -- `requireActor('inviterId')` proves the caller really
  // is `inviterId`; this checks that `inviterId` is actually one of
  // the household's own members before letting them add a roommate.
  app.post('/api/households/invite', requireActor('inviterId'), (req, res) => {
    const { propertyId, inviterId, memberId } = req.body || {};
    const household = householdsLib.householdFor(store.households, Number(propertyId));
    if (!household || !household.memberIds.includes(inviterId)) {
      return res.status(403).json({ error: `invite: "${inviterId}" does not live at property ${propertyId}` });
    }
    try {
      const updated = householdsLib.addMember(store.households, { propertyId: Number(propertyId), memberId });
      relationshipsLib.recordConversation(store.relationships, inviterId, memberId, { positive: true });
      newsLib.recordEvent(store.news, {
        kind: 'household',
        text: `${memberId} moved in with ${inviterId}`,
      });
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // A roommate who does not own the property has no `/api/property/:id`
  // row of their own to look their household up through -- `householdOf`
  // (households.js) already exists for exactly this and had no route.
  // Without it, an invited member could never see their own household
  // from their own session, only the owner could.
  app.get('/api/households/member/:memberId', (req, res) => {
    res.json({ household: householdsLib.householdOf(store.households, req.params.memberId) });
  });

  app.post('/api/households/leave', requireActor('memberId'), (req, res) => {
    const { propertyId, memberId } = req.body || {};
    try {
      const updated = householdsLib.removeMember(store.households, { propertyId: Number(propertyId), memberId });
      newsLib.recordEvent(store.news, { kind: 'household', text: `${memberId} moved out` });
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Organizations: family, tribe, cult (NPC + player mix) ------------
  app.get('/api/organizations/:id', (req, res) => {
    res.json({ organization: organizationsLib.getOrganization(store.organizations, Number(req.params.id)) });
  });

  app.get('/api/players/:id/organization', (req, res) => {
    res.json({ organization: organizationsLib.organizationOf(store.organizations, req.params.id) });
  });

  app.post('/api/organizations', requireActor('founderId'), (req, res) => {
    const { name, type, founderId } = req.body || {};
    try {
      const org = organizationsLib.foundOrganization(store.organizations, { name, type, founderId });
      newsLib.recordEvent(store.news, {
        kind: 'organization',
        text: `${founderId} founded the ${org.type} "${org.name}"`,
      });
      res.status(201).json(org);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Only a current member can invite someone (player or `npc-<id>`)
  // onto their own organization -- same checked-not-claimed shape
  // `/api/households/invite` already uses.
  app.post('/api/organizations/:id/invite', requireActor('inviterId'), (req, res) => {
    const organizationId = Number(req.params.id);
    const { inviterId, memberId } = req.body || {};
    const org = organizationsLib.getOrganization(store.organizations, organizationId);
    if (!org || !org.memberIds.includes(inviterId)) {
      return res.status(403).json({ error: `invite: "${inviterId}" does not belong to organization ${organizationId}` });
    }
    try {
      const updated = organizationsLib.addMember(store.organizations, { organizationId, memberId });
      if (!memberId.startsWith('npc-')) {
        relationshipsLib.recordConversation(store.relationships, inviterId, memberId, { positive: true });
      }
      newsLib.recordEvent(store.news, {
        kind: 'organization',
        text: `${memberId} joined ${org.name}`,
      });
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/organizations/:id/leave', requireActor('memberId'), (req, res) => {
    const organizationId = Number(req.params.id);
    const { memberId } = req.body || {};
    try {
      const updated = organizationsLib.removeMember(store.organizations, { organizationId, memberId });
      newsLib.recordEvent(store.news, { kind: 'organization', text: `${memberId} left ${updated.name}` });
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- The Vavlt: VDP's nightclub district --------------------------------
  app.get('/api/vavlt/present', (_req, res) => {
    res.json({ venue: vavltLib.VENUE_NAME, present: vavltLib.listPresent(store.vavlt) });
  });

  app.post('/api/vavlt/checkin', requireActor('ownerId'), async (req, res) => {
    try {
      const result = await vavltLib.checkIn(store.vavlt, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: vavltLib.VENUE_ACCOUNT_ID }),
      });
      newsLib.recordEvent(store.news, {
        kind: 'vavlt',
        text: `${req.body.ownerId} paid cover and walked into ${result.venue}`,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/vavlt/checkout', requireActor('ownerId'), (req, res) => {
    try {
      vavltLib.checkOut(store.vavlt, { ownerId: req.body.ownerId });
      res.status(200).json({ present: vavltLib.listPresent(store.vavlt) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Relationships -----------------------------------------------------
  app.get('/api/relationships/:id', (req, res) => {
    res.json({ relationships: relationshipsLib.listRelationshipsFor(store.relationships, req.params.id) });
  });

  app.post('/api/relationships/conversation', requireActor('aId'), (req, res) => {
    const { aId, bId, positive } = req.body || {};
    if (!bId) return res.status(400).json({ error: 'conversation requires bId' });
    const result = relationshipsLib.recordConversation(store.relationships, aId, bId, { positive });
    res.json(result);
  });

  // --- Conversational NPCs ------------------------------------------------
  //
  // The browser already called `v4AgentClient.talkToNpc` directly
  // (same real Claude-via-v4-proxy call `analyzeOutfitPhoto` already
  // makes) and has a real `{reply, topic}` back. This route is where
  // that topic actually DOES something: a small, bounded nudge, never
  // on free text the model could inflate -- `topic` is one of a fixed
  // list `v4AgentClient.js` asks the model to pick from, and only a
  // recognized one moves anything.
  const TOPIC_SKILL = {
    business: 'Business', crafting: 'Crafting', construction: 'Construction',
    communication: 'Communication', management: 'Management',
    athletics: 'Athletics', art: 'Art',
  };
  const CONVERSATION_BELIEF_DELTA = 2; // smaller than a textbook's TEXTBOOK_BELIEF_SHIFT (8) -- a chat nudges, a book teaches

  app.post('/api/players/:id/talk', requireParamActor('id'), (req, res) => {
    const playerId = req.params.id;
    const { npcId, topic } = req.body || {};
    const npc = npcs.getNpc(store.npcWorld, Number(npcId));
    if (!npc) return res.status(404).json({ error: `talk: no npc with id ${npcId}` });

    const player = ensurePlayer(playerId);
    let effect = null;
    if (TOPIC_SKILL[topic]) {
      const level = skillsLib.gainFromConversation(player.skills, TOPIC_SKILL[topic]);
      effect = { kind: 'skill', skill: TOPIC_SKILL[topic], level };
    } else if (beliefsLib.BELIEF_TYPES.includes(topic)) {
      const strength = beliefsLib.shiftBelief(player.beliefs, 'conversation', topic, CONVERSATION_BELIEF_DELTA);
      effect = { kind: 'belief', topic: 'conversation', beliefType: topic, strength };
    }

    const relationship = relationshipsLib.recordConversation(store.relationships, playerId, `npc-${npc.id}`);

    const org = organizationsLib.organizationOf(store.organizations, playerId);
    if (org && org.memberIds.includes(`npc-${npc.id}`)) {
      organizationsLib.recordActivity(store.organizations, org.id);
    }

    res.json({ effect, relationship });
  });

  // --- Library / books (VENVS stays the payer; this is the one real
  //     effect a purchase has) -------------------------------------------
  //
  // **Not a service credential.** VENVS has no backend of its own —
  // `purchaseBook` runs in the buyer's own browser, the same place
  // that already calls V3's real `transferVCoin` with the buyer's own
  // Shield session. So this accepts that same real session (the buyer
  // acting as themselves — `requireActor('buyerId')` refuses any
  // other body), composed with a service credential via
  // `actorOrService` for the day something server-side calls it
  // instead. Neither path lets a caller claim an effect for someone
  // else's purchase.
  app.post('/api/library/record', actorOrService(requireActor('buyerId')), (req, res) => {
    const { orderId, buyerId, title, skillSubject, beliefTopic, beliefType } = req.body || {};
    if (!buyerId) return res.status(400).json({ error: 'library/record requires buyerId' });
    const player = ensurePlayer(buyerId);
    try {
      const result = libraryLib.applyBookEffect(player.library, player, {
        orderId, title, skillSubject, beliefTopic, beliefType,
      });
      if (result.applied) {
        const effectText = result.effect.kind === 'skill'
          ? `improved their ${result.effect.skill} skill`
          : `shifted their ${result.effect.beliefType} belief`;
        newsLib.recordEvent(store.news, {
          kind: 'library',
          text: `${buyerId} read "${title}" and ${effectText}`,
        });
      }
      res.status(result.applied ? 201 : 200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/players/:id/library', (req, res) => {
    const player = ensurePlayer(req.params.id);
    res.json({ books: libraryLib.listLibrary(player.library) });
  });

  // --- Real-time: shared world over WebSocket -----------------------------
  const { broadcast } = createMessageSocketServer(server, {
    path: '/ws/world',
    onSnapshotRequest: () => ({
      type: 'snapshot',
      npcs: store.npcWorld.npcs,
      tick: store.npcWorld.tick,
      positions: livePositions,
    }),
    onMessage: (ws, msg) => {
      if (msg.type === 'move' && msg.userId) {
        livePositions[msg.userId] = { x: msg.x, y: msg.y };
        broadcast({ type: 'positions', positions: livePositions });
      }
      // Player-to-player chat: broadcast to every connected client
      // (the same one-shared-channel shape positions/npcs already
      // use) and apply the identical affinity nudge an NPC
      // conversation gets -- a real exchange between two real people
      // is at least as real as one with an NPC.
      if (msg.type === 'chat' && msg.fromUserId && msg.toUserId && typeof msg.text === 'string' && msg.text.trim()) {
        const text = msg.text.trim();
        broadcast({ type: 'chat', fromUserId: msg.fromUserId, toUserId: msg.toUserId, text, at: Date.now() });
        relationshipsLib.recordConversation(store.relationships, msg.fromUserId, msg.toUserId);
        newsLib.recordEvent(store.news, {
          kind: 'chat',
          text: `${msg.fromUserId} to ${msg.toUserId}: "${text.length > 80 ? `${text.slice(0, 80)}…` : text}"`,
        });
        // Cohesion is earned, not held: two people who actually talk,
        // and happen to share an organization, nudge it -- the same
        // "real activity, not a standing score" discipline
        // organizations.js's own header commits to.
        const orgA = organizationsLib.organizationOf(store.organizations, msg.fromUserId);
        const orgB = organizationsLib.organizationOf(store.organizations, msg.toUserId);
        if (orgA && orgB && orgA.id === orgB.id) {
          organizationsLib.recordActivity(store.organizations, orgA.id);
        }
      }
    },
  });

  // Only the rare flavor actions (see npcs.js's own `pickAction`
  // comment) are news-worthy -- logging every routine need-driven
  // decision for 14+ NPCs every 2s would drown the feed in noise.
  const NOTABLE_NPC_ACTIONS = {
    fight: (npc) => `${npc.name} got into a fight`,
    pettySwipe: (npc) => `${npc.name} swiped something that wasn't theirs`,
  };

  const NPC_TICK_INTERVAL_MS = 2000;
  setInterval(() => {
    const decidedIds = npcs.advanceWorldTick(store.npcWorld);
    for (const npcId of decidedIds) {
      const npc = npcs.getNpc(store.npcWorld, npcId);
      const describe = npc && NOTABLE_NPC_ACTIONS[npc.currentAction];
      if (describe) newsLib.recordEvent(store.news, { kind: 'npc', text: describe(npc) });
    }
    for (const player of Object.values(store.players)) {
      npcs.stepNeeds(player.state, store.npcWorld.tick);
      npcs.fadeHabits(player.state);
      npcs.updateGoal(player.state);
    }
    for (const player of Object.values(store.players)) {
      skillsLib.fadeSkills(player.skills);
    }
    organizationsLib.fadeCohesion(store.organizations);
    broadcast({ type: 'npcs', npcs: store.npcWorld.npcs, tick: store.npcWorld.tick });
  }, NPC_TICK_INTERVAL_MS).unref();

  server.listen(PORT, () => {
    console.log(`VDP listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
})();
