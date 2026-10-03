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
  const jobsLib = await import('./src/lib/jobs.js');
  const libraryLib = await import('./src/lib/library.js');
  const populationLib = await import('./src/lib/population.js');
  const newsLib = await import('./src/lib/news.js');

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

  attachStore(app, {
    appKey: 'vdp',
    createDefault: createVdpStore,
    filePath: path.join(__dirname, 'data', 'store.json'),
    onReady: (loaded) => {
      store = loaded;
      if (!store.npcWorld) store.npcWorld = npcs.createNpcWorld();
      if (!store.news) store.news = newsLib.createNewsLog();
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
      const shift = await jobsLib.clockOutAndPay(store.jobs, { workerId, transferFn: transferVCoin });
      const player = ensurePlayer(workerId);
      skillsLib.gainFromShift(player.skills, shift.skill);
      const job = jobsLib.getJob(shift.jobId);
      newsLib.recordEvent(store.news, {
        kind: 'job',
        text: `${workerId} finished a shift as ${job ? job.title : shift.jobId} and earned ${shift.pay} VCoin`,
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
    broadcast({ type: 'npcs', npcs: store.npcWorld.npcs, tick: store.npcWorld.tick });
  }, NPC_TICK_INTERVAL_MS).unref();

  server.listen(PORT, () => {
    console.log(`VDP listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
})();
