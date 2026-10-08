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
const {
  requireActor, requireParamActor, actorOrService, requireCallingService,
} = require('./lib/shieldAuth.cjs');
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
    immigration: {
      arrivals: [], nextArrivalId: 1, smugglingSpots: [], nextSpotId: 1,
      illegalSettlements: [], nextSettlementId: 1,
    },
    justice: { tickets: [], nextTicketId: 1, detentions: [], nextDetentionId: 1 },
    contracts: { contracts: [], nextContractId: 1 },
    dissent: { revolts: [], nextRevoltId: 1 },
    // "How much money is generated" (8 Oct 2026) -- a real, running
    // total of real VCoin the governors/AI have paid out into this
    // world's own economy (job shifts, completed contracts, resource
    // sales) -- not every VCoin transfer in the whole ecosystem,
    // which this server has no way to see; a named, bounded scope
    // rather than an invented precision it doesn't have.
    analytics: { totalVCoinGenerated: 0 },
    // "The economy can go up and down depending on how people are
    // spending inside of it" (8 Oct 2026) -- a real, separate log from
    // `analytics.totalVCoinGenerated` (which is only the governors'
    // own payouts): this one sums every real purchase a player makes.
    economy: { spendingLog: [], index: 100 },
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
  const immigrationLib = await import('./src/lib/immigration.js');
  const justiceLib = await import('./src/lib/justice.js');
  const securityLib = await import('./src/lib/security.js');
  const contractsLib = await import('./src/lib/contracts.js');
  const dissentLib = await import('./src/lib/dissent.js');
  const economyLib = await import('./src/lib/economy.js');

  // A migrant's real old-world background carries over if one was
  // recorded (`immigration.js`'s `admitWithPassport`/`crossIllegally`,
  // called before a player's first login) -- "people are bringing the
  // chaos from the old world to the new world. You have all your
  // different characteristics, statistics" (8 Oct 2026, direct
  // instruction). No arrival on record (every existing player/test)
  // falls back to `createSkills()`'s own default of zero, unchanged.
  function ensurePlayer(userId) {
    if (!store.players[userId]) {
      const arrival = immigrationLib.arrivalFor(store.immigration, userId);
      store.players[userId] = {
        state: npcs.createPlayerState(),
        skills: skillsLib.createSkills(arrival?.oldWorldSkills || {}),
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

  // "A ticker of how many people are in... how much money is
  // generated" (8 Oct 2026) -- real population (same figure
  // `/api/population` already serves) alongside the real, running
  // VCoin-generated total above.
  app.get('/api/analytics/status', (_req, res) => {
    const playerCount = Object.keys(store.players).length;
    const npcCount = store.npcWorld ? store.npcWorld.npcs.length : 0;
    res.json({
      population: populationLib.describePopulation(playerCount, npcCount),
      totalVCoinGenerated: store.analytics.totalVCoinGenerated,
      economyIndex: economyLib.updateEconomyIndex(store.economy),
      recentSpending: economyLib.recentSpending(store.economy),
    });
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

  // "There's an AI that works with the users to show them things to
  // get further in the game... we want this to be a little more
  // natural and build natural. Since it's one big world that
  // everybody's involved in." (8 Oct 2026, direct instruction) -- the
  // real facts V4 actually has about this one resident AND the shared
  // world, assembled server-side from every real store this server
  // already keeps (never invented). `v4AgentClient.js`'s
  // `suggestNextStep` is the real model call that turns this into one
  // natural, in-character suggestion -- this route only gathers the
  // real inputs, the same separation `talkToNpc` already keeps between
  // real state and the real model call.
  app.get('/api/guide/facts/:id', (req, res) => {
    const userId = req.params.id;
    const player = ensurePlayer(userId);
    const home = propertyLib.homeOwnedBy(store.property, userId);
    const shop = propertyLib.commercialOwnedBy(store.property, userId);
    const assignment = jobsLib.currentAssignment(store.jobs, userId);
    const organization = organizationsLib.organizationOf(store.organizations, userId);
    const topSkillEntry = Object.entries(player.skills).sort((a, b) => b[1] - a[1])[0];
    const playerCount = Object.keys(store.players).length;
    const npcCount = store.npcWorld ? store.npcWorld.npcs.length : 0;

    res.json({
      need: npcs.mostPressingNeed(player.state),
      goal: player.state.currentGoal,
      topTrait: npcs.topTrait(player.state),
      topSkill: topSkillEntry && topSkillEntry[1] > 0 ? { subject: topSkillEntry[0], value: topSkillEntry[1] } : null,
      home: home ? home.levelName : null,
      business: shop ? shop.levelName : null,
      job: assignment ? jobsLib.JOBS[assignment.jobId]?.title || null : null,
      organization: organization ? { name: organization.name, type: organization.type } : null,
      economyIndex: economyLib.updateEconomyIndex(store.economy),
      population: populationLib.describePopulation(playerCount, npcCount).population,
      openContracts: contractsLib.listOpenContracts(store.contracts).length,
    });
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
        spendMaterialsFn: resourcesLib.spendMaterials, undoSpendFn: resourcesLib.undoSpend,
      });
      const player = ensurePlayer(workerId);
      skillsLib.gainFromShift(player.skills, shift.skill);
      if (shift.paid) store.analytics.totalVCoinGenerated += shift.pay;
      const job = jobsLib.getJob(shift.jobId);
      const yieldText = shift.yielded ? `, and gathered ${shift.yielded.amount} ${shift.yielded.type}` : '';
      const consumedText = shift.consumed ? ` (used ${shift.consumed.amount} ${shift.consumed.type})` : '';
      newsLib.recordEvent(store.news, {
        kind: 'job',
        text: `${workerId} finished a shift as ${job ? job.title : shift.jobId} and earned ${shift.pay} VCoin${yieldText}${consumedText}`,
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
      economyLib.recordSpending(store.economy, propertyLib.HOME_PRICE);
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
      const cost = propertyLib.levelByNumber(home.level).price - propertyLib.levelByNumber(home.level - 1).price;
      economyLib.recordSpending(store.economy, cost);
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
      economyLib.recordSpending(store.economy, propertyLib.RENT_PRICE);
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
      economyLib.recordSpending(store.economy, propertyLib.HOME_PRICE - propertyLib.RENT_PRICE);
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `${req.body.ownerId} bought the home they were renting`,
      });
      res.status(200).json(home);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "People can also have the option to buy land as well" -- a real,
  // separate purchase, same claim-before-pay ordering as every other
  // route in this section.
  app.post('/api/property/buy-land', requireActor('ownerId'), async (req, res) => {
    try {
      const plot = await propertyLib.purchaseLand(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
      });
      economyLib.recordSpending(store.economy, propertyLib.LAND_PRICE);
      newsLib.recordEvent(store.news, { kind: 'property', text: `${req.body.ownerId} bought a plot of land` });
      res.status(201).json(plot);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "We will start off with just a village, commercial, residential,
  // and dreams screen mix" -- a real, independent business slot
  // alongside a home, not a second home.
  app.get('/api/property/commercial/:ownerId', (req, res) => {
    res.json({ shop: propertyLib.commercialOwnedBy(store.property, req.params.ownerId) });
  });

  app.post('/api/property/purchase-commercial', requireActor('ownerId'), async (req, res) => {
    try {
      const shop = await propertyLib.purchaseCommercial(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
      });
      economyLib.recordSpending(store.economy, propertyLib.COMMERCIAL_LEVELS[0].price);
      newsLib.recordEvent(store.news, { kind: 'property', text: `${req.body.ownerId} opened a ${shop.levelName}` });
      res.status(201).json(shop);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/property/upgrade-commercial', requireActor('ownerId'), async (req, res) => {
    try {
      const before = propertyLib.commercialOwnedBy(store.property, req.body.ownerId);
      const previousLevel = before ? before.level : null;
      const shop = await propertyLib.upgradeCommercial(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin({ ...args, toUserId: 'vdp-property-office' }),
      });
      if (previousLevel) {
        const cost = propertyLib.commercialLevelByNumber(shop.level).price
          - propertyLib.commercialLevelByNumber(previousLevel).price;
        economyLib.recordSpending(store.economy, cost);
      }
      newsLib.recordEvent(store.news, { kind: 'property', text: `${req.body.ownerId} upgraded their business to ${shop.levelName}` });
      res.status(200).json(shop);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "The economy should continue to thrive as far as the owners of
  // the businesses" (8 Oct 2026) -- the real, opposite flow of the
  // two routes above: a business owner's own property actually
  // earning, scaled by the real `economy.js` index this world's own
  // spending already moves.
  app.post('/api/property/operate-business', requireActor('ownerId'), async (req, res) => {
    try {
      const index = economyLib.updateEconomyIndex(store.economy);
      const result = await propertyLib.operateBusiness(store.property, {
        ownerId: req.body.ownerId,
        transferFn: (args) => transferVCoin(args),
        economyMultiplier: economyLib.economyMultiplierFor(index),
      });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `${req.body.ownerId}'s ${result.property.levelName} earned ${result.revenue} VCoin`,
      });
      res.status(200).json({ ...result, economyIndex: index });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/property/unauthorized', (_req, res) => {
    res.json({ unauthorized: propertyLib.listUnauthorized(store.property) });
  });

  // "People doing unauthorized buildings" -- no transferFn, no actor
  // guard against a specific owner identity: an unauthorized builder
  // went around the governors' office by definition, so this is a
  // real record of what happened, not a legitimate purchase.
  app.post('/api/property/build-unauthorized', requireActor('ownerId'), (req, res) => {
    try {
      const shack = propertyLib.buildUnauthorized(store.property, {
        ownerId: req.body.ownerId,
        locationLabel: req.body.locationLabel,
        type: req.body.type,
      });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: shack.type === 'commercial'
          ? `an unsecured ${shack.levelName} opened near ${req.body.locationLabel || 'Meridian'}`
          : `an unauthorized structure went up near ${req.body.locationLabel || 'Meridian'}`,
      });
      res.status(201).json(shack);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // The governors' own real enforcement action -- a robot patrol
  // (`jobs.js`'s `robot-patrol-officer`) tearing an unsanctioned
  // structure down. `demolishedBy` is the patrol officer's own id,
  // the actor this route checks -- not the structure's owner.
  app.post('/api/property/demolish-unauthorized', requireActor('demolishedBy'), (req, res) => {
    try {
      const result = propertyLib.demolishUnauthorized(store.property, req.body.propertyId, {
        demolishedBy: req.body.demolishedBy,
      });
      newsLib.recordEvent(store.news, {
        kind: 'property',
        text: `a robot patrol demolished an unauthorized structure (owner: ${result.ownerId})`,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Immigration: passports, illegal crossings, and the chaos that
  // comes with them -----------------------------------------------------
  app.get('/api/immigration/arrivals', (_req, res) => {
    res.json({ arrivals: immigrationLib.listArrivals(store.immigration) });
  });

  app.get('/api/immigration/arrivals/:personId', (req, res) => {
    res.json({ arrival: immigrationLib.arrivalFor(store.immigration, req.params.personId) });
  });

  app.get('/api/immigration/illegal', (_req, res) => {
    res.json({ illegal: immigrationLib.listIllegalArrivals(store.immigration) });
  });

  app.post('/api/immigration/admit', requireActor('personId'), (req, res) => {
    try {
      const arrival = immigrationLib.admitWithPassport(store.immigration, {
        personId: req.body.personId,
        originRegion: req.body.originRegion,
        religion: req.body.religion,
        oldWorldSkills: req.body.oldWorldSkills,
        oldWorldBeliefs: req.body.oldWorldBeliefs,
        citizenshipType: req.body.citizenshipType,
        dissident: req.body.dissident,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `${req.body.personId} arrived through passport control` });
      res.status(201).json(arrival);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Two named, player-facing applications, matching the instruction's
  // own words -- both land on the same real gate as `/admit` above,
  // with the matching `citizenshipType` already chosen.
  app.post('/api/immigration/apply-citizenship', requireActor('personId'), (req, res) => {
    try {
      const arrival = immigrationLib.applyForCitizenship(store.immigration, {
        personId: req.body.personId,
        originRegion: req.body.originRegion,
        religion: req.body.religion,
        oldWorldSkills: req.body.oldWorldSkills,
        oldWorldBeliefs: req.body.oldWorldBeliefs,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `${req.body.personId} was granted citizenship` });
      res.status(201).json(arrival);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/immigration/apply-temporary-passport', requireActor('personId'), (req, res) => {
    try {
      const arrival = immigrationLib.applyForTemporaryPassport(store.immigration, {
        personId: req.body.personId,
        originRegion: req.body.originRegion,
        religion: req.body.religion,
        oldWorldSkills: req.body.oldWorldSkills,
        oldWorldBeliefs: req.body.oldWorldBeliefs,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `${req.body.personId} was granted a temporary passport` });
      res.status(201).json(arrival);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/immigration/cross-illegally', requireActor('personId'), (req, res) => {
    try {
      const arrival = immigrationLib.crossIllegally(store.immigration, {
        personId: req.body.personId,
        originRegion: req.body.originRegion,
        religion: req.body.religion,
        smuggledGoods: req.body.smuggledGoods,
        oldWorldSkills: req.body.oldWorldSkills,
        oldWorldBeliefs: req.body.oldWorldBeliefs,
        dissident: req.body.dissident,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `an unrecorded crossing beyond the ice wall was made` });
      res.status(201).json(arrival);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/immigration/catch', requireActor('caughtBy'), (req, res) => {
    try {
      const arrival = immigrationLib.catchIllegalArrival(store.immigration, req.body.personId, {
        caughtBy: req.body.caughtBy,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `a robot patrol caught an illegal arrival` });
      res.status(200).json(arrival);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/immigration/smuggling-spots', (_req, res) => {
    res.json({ open: immigrationLib.listOpenSmugglingSpots(store.immigration) });
  });

  app.post('/api/immigration/smuggling-spots/report', requireActor('reportedBy'), (req, res) => {
    try {
      const spot = immigrationLib.reportSmugglingSpot(store.immigration, {
        locationLabel: req.body.locationLabel,
        reportedBy: req.body.reportedBy,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `a new smuggling spot was found: ${req.body.locationLabel}` });
      res.status(201).json(spot);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/immigration/smuggling-spots/:spotId/seal', requireActor('sealedBy'), (req, res) => {
    try {
      const spot = immigrationLib.sealSmugglingSpot(store.immigration, Number(req.params.spotId), {
        sealedBy: req.body.sealedBy,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `a smuggling spot was sealed by a robot patrol` });
      res.status(200).json(spot);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/immigration/illegal-settlements', (_req, res) => {
    res.json({ active: immigrationLib.listActiveIllegalSettlements(store.immigration) });
  });

  app.post('/api/immigration/illegal-settlements/found', requireActor('founderId'), (req, res) => {
    try {
      const settlement = immigrationLib.foundIllegalSettlement(store.immigration, {
        founderId: req.body.founderId,
        locationLabel: req.body.locationLabel,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `an illegal settlement appeared near ${req.body.locationLabel}` });
      res.status(201).json(settlement);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "Off the grid until the government finds out" -- a real, separate
  // discovery act, the same found/closed shape `reportSmugglingSpot`/
  // `sealSmugglingSpot` already use.
  app.post('/api/immigration/illegal-settlements/:settlementId/discover', requireActor('discoveredBy'), (req, res) => {
    try {
      const settlement = immigrationLib.discoverSettlement(store.immigration, Number(req.params.settlementId), {
        discoveredBy: req.body.discoveredBy,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `the government discovered an off-the-grid settlement` });
      res.status(200).json(settlement);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/immigration/illegal-settlements/:settlementId/clear', requireActor('clearedBy'), (req, res) => {
    try {
      const settlement = immigrationLib.clearIllegalSettlement(store.immigration, Number(req.params.settlementId), {
        clearedBy: req.body.clearedBy,
      });
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `a robot patrol cleared an illegal settlement` });
      res.status(200).json(settlement);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "People can also be set for jail, ticketing, fine... or even face
  // deportation back to the old world" (8 Oct 2026). The arrival
  // record is marked, never deleted; a deported NPC (`npc-<id>`) is
  // also actually removed from the real, server-ticked population --
  // the real "back to the old world" for an NPC specifically.
  app.post('/api/immigration/deport', requireActor('deportedBy'), (req, res) => {
    try {
      const arrival = immigrationLib.deportPerson(store.immigration, req.body.personId, {
        deportedBy: req.body.deportedBy,
        reason: req.body.reason,
      });
      const npcMatch = /^npc-(\d+)$/.exec(req.body.personId);
      if (npcMatch && store.npcWorld) {
        try { npcs.removeNpcFromWorld(store.npcWorld, Number(npcMatch[1])); } catch { /* already gone */ }
      }
      newsLib.recordEvent(store.news, { kind: 'immigration', text: `${req.body.personId} was deported back to the old world` });
      res.status(200).json(arrival);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "We will just grow the planet off of that" -- a real,
  // scheduler-style world event, not any one player's action, so this
  // is the one immigration route guarded by `requireCallingService()`
  // rather than `requireActor`: there is no single acting user to
  // check, the same posture `shieldAuth.cjs` already documents for
  // tick-style jobs. Each new migrant is a real NPC
  // (`npcs.addNpcToWorld`), not a database row with nobody behind it.
  app.post('/api/immigration/migration-wave', requireCallingService(), (req, res) => {
    try {
      let created = 0;
      const result = immigrationLib.generateMigrationWave(store.immigration, {
        survivorPopulation: req.body.survivorPopulation,
        waveFraction: req.body.waveFraction,
        legalFraction: req.body.legalFraction,
        dissidentFraction: req.body.dissidentFraction,
        originRegions: req.body.originRegions,
        religions: req.body.religions,
        smuggledGoodsPool: req.body.smuggledGoodsPool,
        onNewMigrant: () => {
          const npc = npcs.addNpcToWorld(store.npcWorld);
          created += 1;
          return `npc-${npc.id}`;
        },
      });
      newsLib.recordEvent(store.news, {
        kind: 'immigration',
        text: `a new wave of ${result.waveSize} settlers arrived (${result.legalCount} by passport, ${result.illegalCount} across the ice wall, ${result.dissidentCount} already opposed to the government)`,
      });
      res.status(201).json({ ...result, npcsCreated: created });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Justice: citations and detention ---------------------------------
  // "People can get ticketed. They will be sent directly to their
  // profile." A real citation lands on the person's own record,
  // readable the same way `MyStatusView.jsx` already reads a player's
  // own state.
  app.get('/api/justice/tickets/:personId', (req, res) => {
    res.json({ tickets: justiceLib.ticketsFor(store.justice, req.params.personId) });
  });

  app.post('/api/justice/tickets/issue', requireActor('issuedBy'), (req, res) => {
    try {
      const ticket = justiceLib.issueTicket(store.justice, {
        personId: req.body.personId,
        reason: req.body.reason,
        issuedBy: req.body.issuedBy,
        locationLabel: req.body.locationLabel,
      });
      newsLib.recordEvent(store.news, { kind: 'justice', text: `${req.body.personId} was ticketed: ${req.body.reason}` });
      res.status(201).json(ticket);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // The ticketed person is the one who pays their own fine -- the
  // session must really be `personId`, and that must really match the
  // real ticket's own owner, checked before `payTicket` ever touches
  // the ledger.
  app.post('/api/justice/tickets/:ticketId/pay', requireActor('personId'), async (req, res) => {
    try {
      const ticket = store.justice.tickets.find((t) => t.id === Number(req.params.ticketId));
      if (!ticket) return res.status(404).json({ error: `no ticket #${req.params.ticketId}` });
      if (ticket.personId !== req.body.personId) {
        return res.status(403).json({ error: 'pay: this ticket does not belong to the acting user' });
      }
      const paid = await justiceLib.payTicket(store.justice, ticket.id, {
        transferFn: (args) => transferVCoin({ ...args, toUserId: jobsLib.PLANETARY_GOVERNORS_PAYROLL }),
      });
      economyLib.recordSpending(store.economy, justiceLib.TICKET_FINE);
      res.status(200).json(paid);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/justice/detentions', (_req, res) => {
    res.json({ active: justiceLib.listActiveDetentions(store.justice) });
  });

  app.get('/api/justice/detained/:personId', (req, res) => {
    res.json({ detention: justiceLib.activeDetentionFor(store.justice, req.params.personId) });
  });

  app.post('/api/justice/detain', requireActor('detainedBy'), (req, res) => {
    try {
      const detention = justiceLib.detainPerson(store.justice, {
        personId: req.body.personId,
        reason: req.body.reason,
        detainedBy: req.body.detainedBy,
        locationLabel: req.body.locationLabel,
      });
      newsLib.recordEvent(store.news, { kind: 'justice', text: `${req.body.personId} was detained: ${req.body.reason}` });
      res.status(201).json(detention);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/justice/detentions/:detentionId/release', requireActor('releasedBy'), (req, res) => {
    try {
      const detention = justiceLib.releasePerson(store.justice, Number(req.params.detentionId), {
        releasedBy: req.body.releasedBy,
      });
      newsLib.recordEvent(store.news, { kind: 'justice', text: `${detention.personId} was released` });
      res.status(200).json(detention);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Security: real crime-scaled cameras and robot patrols --------
  // "Everything will be camera secured... at the beginning there
  // will just be basic security features and then it will increase
  // as crime increases." A real tier derived from this world's own
  // real records, never a second invented crime simulation. Factored
  // out so `/api/dissent/:id/uprising` (below) measures a revolt
  // against this exact same real tier, not a second computation of
  // its own.
  function currentSecurityTier() {
    const crimeCount = securityLib.measureCrime({
      ticketCount: store.justice.tickets.length,
      detentionCount: store.justice.detentions.length,
      illegalArrivalCount: immigrationLib.listIllegalArrivals(store.immigration).length,
      // Only settlements the government actually KNOWS about raise
      // the alarm -- an off-the-grid settlement genuinely does not
      // count until it's discovered. See immigration.js's own header.
      illegalSettlementCount: immigrationLib.listKnownIllegalSettlements(store.immigration).length,
      unauthorizedStructureCount: propertyLib.listUnauthorized(store.property).length,
    });
    return securityLib.securityTierFor(crimeCount);
  }

  app.get('/api/security/status', (_req, res) => {
    res.json(currentSecurityTier());
  });

  // "Aspects of the area have more criminal activity than others" --
  // a real per-location breakdown across every real record that
  // carries a locationLabel.
  app.get('/api/security/by-location', (_req, res) => {
    const records = [
      ...store.justice.tickets,
      ...store.justice.detentions,
      ...propertyLib.listUnauthorized(store.property),
      ...immigrationLib.listKnownIllegalSettlements(store.immigration),
    ];
    res.json({ crimeByLocation: securityLib.crimeByLocation(records) });
  });

  // --- Government Contracts: the AI builds the world through real
  // builders -------------------------------------------------------------
  app.get('/api/contracts/open', (_req, res) => {
    res.json({ open: contractsLib.listOpenContracts(store.contracts) });
  });

  app.get('/api/contracts/mine/:builderId', (req, res) => {
    res.json({ contracts: contractsLib.contractsFor(store.contracts, req.params.builderId) });
  });

  // The AI government's own act, not a player's -- a real,
  // scheduler-style world event, the same posture
  // `/api/immigration/migration-wave` already uses.
  app.post('/api/contracts/post', requireCallingService(), (req, res) => {
    try {
      const contract = contractsLib.postContract(store.contracts, {
        description: req.body.description,
        materialsRequired: req.body.materialsRequired,
        vcoinReward: req.body.vcoinReward,
      });
      newsLib.recordEvent(store.news, { kind: 'contracts', text: `the government posted a new contract: ${contract.description}` });
      res.status(201).json(contract);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/contracts/:id/accept', requireActor('builderId'), (req, res) => {
    try {
      const contract = contractsLib.acceptContract(store.contracts, Number(req.params.id), {
        builderId: req.body.builderId,
      });
      res.status(200).json(contract);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/contracts/:id/complete', requireActor('builderId'), async (req, res) => {
    try {
      const contract = store.contracts.contracts.find((c) => c.id === Number(req.params.id));
      if (!contract) return res.status(404).json({ error: `no contract #${req.params.id}` });
      if (contract.builderId !== req.body.builderId) {
        return res.status(403).json({ error: 'complete: this contract is not accepted by the acting user' });
      }
      const completed = await contractsLib.completeContract(store.contracts, contract.id, {
        transferFn: (args) => transferVCoin({ ...args, fromUserId: jobsLib.PLANETARY_GOVERNORS_PAYROLL }),
        resourcesStore: store.resources,
        spendMaterialsFn: resourcesLib.spendMaterials,
        undoSpendFn: resourcesLib.undoSpend,
      });
      store.analytics.totalVCoinGenerated += completed.vcoinReward;
      newsLib.recordEvent(store.news, { kind: 'contracts', text: `${req.body.builderId} completed a government contract: ${contract.description}` });
      res.status(200).json(completed);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Dissent: real opposition to the AI government --------------------
  app.get('/api/dissent/active', (_req, res) => {
    res.json({ active: dissentLib.listActiveRevolts(store.dissent) });
  });

  app.post('/api/dissent/organize', requireActor('leaderId'), (req, res) => {
    try {
      const revolt = dissentLib.organizeRevolt(store.dissent, {
        leaderId: req.body.leaderId,
        participantIds: req.body.participantIds,
        reason: req.body.reason,
      });
      newsLib.recordEvent(store.news, { kind: 'dissent', text: `${req.body.leaderId} organized a revolt: ${req.body.reason}` });
      res.status(201).json(revolt);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/dissent/:id/suppress', requireActor('suppressedBy'), (req, res) => {
    try {
      const revolt = dissentLib.suppressRevolt(store.dissent, Number(req.params.id), {
        suppressedBy: req.body.suppressedBy,
      });
      newsLib.recordEvent(store.news, { kind: 'dissent', text: `a revolt led by ${revolt.leaderId} was suppressed` });
      res.status(200).json(revolt);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "Certain people will fight against [the robots] if they have a
  // big enough tribe group organization" (8 Oct 2026) -- the real
  // leader's real organization (`organizations.js`) measured against
  // the world's real current security tier, never an invented combat
  // roll.
  app.post('/api/dissent/:id/uprising', requireActor('leaderId'), (req, res) => {
    try {
      const revolt = store.dissent.revolts.find((r) => r.id === Number(req.params.id));
      if (!revolt) return res.status(404).json({ error: `no revolt #${req.params.id}` });
      if (revolt.leaderId !== req.body.leaderId) {
        return res.status(403).json({ error: 'uprising: this revolt is not led by the acting user' });
      }
      const organization = organizationsLib.organizationOf(store.organizations, revolt.leaderId);
      const result = dissentLib.attemptUprising(store.dissent, revolt.id, {
        organization,
        security: currentSecurityTier(),
      });
      newsLib.recordEvent(store.news, {
        kind: 'dissent',
        text: `${revolt.leaderId}'s revolt overpowered the government's robots`,
      });
      res.status(200).json(result);
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

  // "There will be an exotic value of things that are least accessible
  // -- those things will be more valuable until they increase in this
  // new world." A real readout of today's scarcity price, per type.
  app.get('/api/resources/exotic-values', (_req, res) => {
    const values = {};
    for (const type of resourcesLib.RESOURCE_TYPES) {
      values[type] = resourcesLib.exoticValueFor(store.resources, type);
    }
    res.json({ values, totalProduced: store.resources.totalProduced });
  });

  app.post('/api/resources/:id/sell', requireParamActor('id'), async (req, res) => {
    try {
      const result = await resourcesLib.sellMaterials(store.resources, {
        entityId: req.params.id,
        type: req.body.type,
        amount: req.body.amount,
        transferFn: (args) => transferVCoin(args),
      });
      store.analytics.totalVCoinGenerated += result.payout;
      newsLib.recordEvent(store.news, {
        kind: 'resources',
        text: `${req.params.id} sold ${result.amount} ${result.type} for ${result.payout} VCoin`,
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
