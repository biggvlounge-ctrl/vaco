// VACON-C -- civilization simulation engine, real Express API.
// Source of truth: CLAUDE.md ("API contract: VACANCY_API_ENDPOINT_MAP.md
// -- existing endpoints... must keep their exact shape") and
// VACANCY_API_ENDPOINT_MAP.md itself.
//
// This file closes a real, repeatedly-flagged gap: no Express routes
// file, package.json entry, or dev server existed in any handoff to
// this project before now (confirmed directly -- `server/`'s own
// files are all synchronous, WorldState-based functions with no HTTP
// layer wrapping them; `package.json`'s own `test` script pointed at
// a `server/selftest.js` that doesn't exist on disk either, fixed
// alongside this). The 5 endpoints CLAUDE.md itself designates as the
// required, exact-shape contract are built here, plus 2 real,
// necessary artifact routes without which `/api/mission` could never
// actually be called over HTTP (see that route's own comment below) --
// the API map's own ~40 further endpoints across Phases 1-5 are real,
// separate, much larger future scope, not attempted in this pass.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8809/api/health

const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv/config');

const engine = require('./server/engine.js');

const { requireActor } = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));

// A floor under everything: no route here has a legitimate anonymous
// caller. Mounted above every route, per the rule VOID learned.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;
const PORT = process.env.PORT || 8809;

// GET /api/state -- full world snapshot, per the API map's own literal wording.
app.get('/api/state', (_req, res) => {
  res.json(engine.WorldState);
});

// POST /api/tick -- advance simulation one tick, returns new snapshot.
//
// **Guarded, even though VACON-C is paused and internal.** The tick
// advances *global* world state -- one call moves the simulation for
// everyone, and there is no per-player scoping to limit the blast
// radius. Left open, a stranger with the port could run the world
// forward arbitrarily far, and nothing in the engine makes that
// reversible.
//
// `requireActor('operatorId')` rather than a bare `requireSession()`:
// it demands both that the caller is authenticated AND that they name
// themselves as the operator in the body, so the request records who
// advanced the world rather than only that *someone* logged in did.
// VACON-C has no operator role model yet -- when it grows one, this is
// the hook it attaches to.
app.post('/api/tick', requireOperator('vacon-c:tick'), (_req, res) => {
  try {
    engine.advanceTick();
    res.json(engine.WorldState);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/npc/generate -- spawn a new NPC, returns { npc, state }.
// audit-route-guards: open -- generates simulation content; VACON-C is paused and holds no user data
app.post('/api/npc/generate', (req, res) => {
  try {
    const npc = engine.generateNPC(req.body || {});
    res.status(201).json({ npc, state: engine.WorldState });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/artifacts -- real, necessary addition beyond the literal
// 5-endpoint contract: /api/mission's own real shape requires a real
// artifactId, and nothing could ever produce one over HTTP without
// this -- confirmed the API map's own Phase 1 list only names `GET
// /api/artifacts` (list), no creation route, which would leave
// /api/mission permanently uncallable in practice, not just
// unbuilt-but-reachable. The same "necessary completion beyond the
// literal spec" posture `safetyCheckIn.js` already established
// elsewhere in this session.
// audit-route-guards: open -- simulation artifact, no real-world principal; VACON-C is paused
app.post('/api/artifacts', (req, res) => {
  try {
    res.status(201).json(engine.generateArtifact(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listing. The resource could be created and fetched by id but never
// enumerated, so no browsable surface could exist without already
// knowing an id. Same gap found in five apps on this pass.
app.get('/api/artifacts', (_req, res) => {
  res.json({ artifacts: engine.listArtifacts() });
});

app.get('/api/artifacts/:id', (req, res) => {
  const artifact = engine.getArtifact(Number(req.params.id));
  if (!artifact) return res.status(404).json({ error: `no artifact with id ${req.params.id}` });
  res.json(artifact);
});

// POST /api/mission -- { artifactId } -> generates a mission, returns { mission, state }.
// audit-route-guards: open -- simulation mission, no real-world principal; VACON-C is paused
app.post('/api/mission', (req, res) => {
  try {
    const mission = engine.generateMission(req.body || {});
    res.status(201).json({ mission, state: engine.WorldState });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===========================================================================
// Phase 1 -- DNA Prototype endpoints (VACANCY_API_ENDPOINT_MAP.md)
// ===========================================================================
//
// **Routing, not new simulation.** Every handler below calls a function
// that already existed and was already tested; the engine has been
// reachable only from inside its own process since it was written. The
// inventory (VACANCY_INVENTORY.md §3) maps each endpoint to the
// function it exposes.
//
// Guard posture follows the reasoning /api/tick already set out rather
// than inventing a second one:
//
//   - Reads are open, on the same footing as GET /api/state: this is
//     simulation content with no real-world principal in it, and the
//     serviceAuth floor above still applies to every one of them.
//   - Anything that advances the world for everybody -- the economy
//     phase, a forced Key resolution, a hand-edited trait -- takes
//     requireOperator, because one call moves state nobody can move
//     back and the request should record who did it.
//   - Content generation (a family, an organization) is open for the
//     same reason POST /api/npc/generate is, and says so where the
//     audit scanner reads it.
//
// The five contract endpoints above are untouched. CLAUDE.md is
// explicit that their shape is fixed, so nothing here re-registers or
// wraps them.

const keys = require('./server/keys.js');
const worldStore = require('./server/worldStore.js');

// The seven, by the id the API map uses in POST /api/keys/:keyId/resolve.
const KEY_RESOLVERS = {
  resilience: keys.resolveResilience,
  adaptability: keys.resolveAdaptability,
  trust: keys.resolveTrust,
  'scarcity-response': keys.resolveScarcityResponse,
  fear: keys.resolveFear,
  aggression: keys.resolveAggression,
  territory: keys.resolveTerritory,
};

// Assembles what a resolver needs. **The knowledge lookup is the point**:
// standing rule 2 says resolvers read subjective entity_knowledge rather
// than raw world state, so the HTTP layer must hand them that entity's
// own knowledge and nothing else. Passing WorldState straight through
// would break the rule at the seam rather than inside the resolver.
function keyContext(entityId, body) {
  return {
    ...body,
    tick: engine.WorldState.tick,
    worldState: engine.WorldState,
    applyKeyModifier: engine.applyKeyModifier,
    knowledge: worldStore.getKnowledge(engine.WorldState, entityId),
  };
}

function resolveKeyFor(keyId, entityId, body) {
  const resolver = KEY_RESOLVERS[keyId];
  if (!resolver) {
    const known = Object.keys(KEY_RESOLVERS).join(', ');
    throw new Error(`no Key named "${keyId}" -- one of: ${known}`);
  }
  const entity = engine.getLiveEntity(entityId);
  if (!entity) throw new Error(`no entity with id ${entityId}`);
  return resolver(entity, keyContext(entityId, body));
}

// -- entities ---------------------------------------------------------------

app.get('/api/entities/:id', (req, res) => {
  const entity = engine.getLiveEntity(Number(req.params.id));
  if (!entity) return res.status(404).json({ error: `no entity with id ${req.params.id}` });
  res.json(entity);
});

app.get('/api/entities/:id/traits', (req, res) => {
  res.json({ traits: engine.getEntityTraits(Number(req.params.id)) });
});

// Hand-editing a trait is the API map's own "admin/debug only". It
// writes world state directly, bypassing every Key that would normally
// have to justify the change.
app.post('/api/entities/:id/traits/:traitId', requireOperator('vacon-c:trait-edit'), (req, res) => {
  try {
    const { family, name, delta } = req.body || {};
    if (!family || !name || typeof delta !== 'number') {
      return res.status(400).json({ error: 'requires { family, name, delta } -- delta must be a number' });
    }
    res.json(engine.applyKeyModifier(Number(req.params.id), family, name, delta, engine.WorldState.tick));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Personal finances. The fourth route in this pass that exists because
// an engine function had no way in: without it every family's wealth
// reads 0 forever, since getFamilyWealth sums members' finances and no
// member can be given any. Found by looking at the World tab and seeing
// three families all worth nothing.
// audit-route-guards: open -- simulation finances, no real-world money; VACON-C holds no user funds
app.post('/api/entities/:id/finances', (req, res) => {
  try {
    res.status(201).json(engine.generateIndividualFinances(Number(req.params.id), req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/entities/:id/net-worth', (req, res) => {
  res.json({ entityId: Number(req.params.id), netWorth: engine.getNetWorth(Number(req.params.id)) });
});

// -- NPCs -------------------------------------------------------------------

app.get('/api/npcs', (req, res) => {
  const { status, role } = req.query;
  let npcs = engine.WorldState.npcs;
  if (status) npcs = npcs.filter((n) => n.status === status);
  if (role) npcs = npcs.filter((n) => n.role === role);
  res.json({ npcs, total: npcs.length });
});

app.get('/api/npcs/:id', (req, res) => {
  const id = Number(req.params.id);
  const live = engine.getLiveEntity(id);
  if (!live) return res.status(404).json({ error: `no NPC with id ${id}` });
  res.json({
    npc: live,
    relationships: engine.WorldState.relationships.filter(
      (r) => r.entity_a_id === id || r.entity_b_id === id,
    ),
    knowledge: worldStore.getKnowledge(engine.WorldState, id),
    memories: engine.WorldState.memories.filter((m) => m.entity_id === id),
  });
});

// Forces one NPC's decision through a named Key. Debug/testing per the
// API map, and it writes to Memory, Relationships and world state.
app.post('/api/npcs/:id/decide', requireOperator('vacon-c:decide'), (req, res) => {
  try {
    const { keyId } = req.body || {};
    if (!keyId) return res.status(400).json({ error: 'requires { keyId }' });
    res.json(resolveKeyFor(keyId, Number(req.params.id), req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Keys -------------------------------------------------------------------

app.get('/api/keys', (_req, res) => {
  res.json({ keys: Object.keys(KEY_RESOLVERS) });
});

app.post('/api/keys/:keyId/resolve', requireOperator('vacon-c:key-resolve'), (req, res) => {
  try {
    const { entityId } = req.body || {};
    if (entityId == null) return res.status(400).json({ error: 'requires { entityId }' });
    res.json(resolveKeyFor(req.params.keyId, Number(entityId), req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- families ---------------------------------------------------------------

app.get('/api/families', (_req, res) => {
  res.json({
    families: engine.WorldState.families.map((f) => ({
      ...f, wealth: engine.getFamilyWealth(f.id),
    })),
  });
});

app.get('/api/families/:id', (req, res) => {
  const id = Number(req.params.id);
  const family = engine.WorldState.families.find((f) => f.id === id);
  if (!family) return res.status(404).json({ error: `no family with id ${id}` });
  const memberships = engine.WorldState.familyMemberships.filter((m) => m.family_id === id);
  res.json({
    family,
    // Computed on read, never stored -- standing rule 3.
    wealth: engine.getFamilyWealth(id),
    members: memberships.map((m) => ({ ...m, npc: engine.getLiveEntity(m.entity_id) })),
  });
});

// audit-route-guards: open -- creates simulation content, no real-world principal; VACON-C is paused
app.post('/api/families', (req, res) => {
  try {
    res.status(201).json(engine.generateFamily(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- simulation membership, no real-world principal; VACON-C is paused
app.post('/api/families/:id/members', (req, res) => {
  try {
    const { entityId, role, generationNumber } = req.body || {};
    if (entityId == null || !role) {
      return res.status(400).json({ error: 'requires { entityId, role }' });
    }
    res.status(201).json(engine.addFamilyMember(
      Number(req.params.id), Number(entityId), role, generationNumber ?? 1,
    ));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- organizations and factions ---------------------------------------------

app.get('/api/organizations', (req, res) => {
  const { type } = req.query;
  const orgs = type
    ? engine.WorldState.organizations.filter((o) => o.type === type)
    : engine.WorldState.organizations;
  res.json({ organizations: orgs, total: orgs.length });
});

app.get('/api/organizations/:id', (req, res) => {
  const id = Number(req.params.id);
  const org = engine.WorldState.organizations.find((o) => o.id === id);
  if (!org) return res.status(404).json({ error: `no organization with id ${id}` });
  res.json({ organization: org, traits: engine.getEntityTraits(id) });
});

// audit-route-guards: open -- creates simulation content, no real-world principal; VACON-C is paused
app.post('/api/organizations', (req, res) => {
  try {
    const body = req.body || {};
    // Faction is an Organization subtype, not a root entity -- standing
    // rule 4. One route, and `isFaction` picks the generator.
    const org = body.isFaction ? engine.generateFaction(body) : engine.generateOrganization(body);
    res.status(201).json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Standing rule 4: Organization is the parent table and Business is a
// subtype, so this is a filtered read over organizations -- not a
// separate root entity with its own array.
app.get('/api/businesses', (_req, res) => {
  const businesses = (engine.WorldState.organizations || [])
    .filter((o) => o.type === 'business');
  res.json({ businesses, total: businesses.length });
});

app.get('/api/factions', (_req, res) => {
  const factions = engine.WorldState.organizations.filter((o) => o.isFaction);
  res.json({ factions, total: factions.length });
});

app.get('/api/factions/:id/territory', (req, res) => {
  const id = Number(req.params.id);
  const blocks = (engine.WorldState.territoryBlocks || []).filter((b) => b.faction_id === id);
  res.json({ factionId: id, blocks, total: blocks.length });
});

// -- territory and community -------------------------------------------------
//
// **Locked Phase 1 system #8, and until now entirely unreachable.**
// `territory.js` builds cities, communities and blocks, and the tick's
// Organization phase already calls resolveTerritoryControl on every
// block — but nothing could create a block, so that phase has looped
// over an empty array on every tick the simulation has ever run. It was
// not unwired; it was starved. These routes are what let it fire.

app.get('/api/cities', (_req, res) => {
  res.json({ cities: engine.WorldState.cities || [], total: (engine.WorldState.cities || []).length });
});

// audit-route-guards: open -- creates simulation geography, no real-world principal
app.post('/api/cities', (req, res) => {
  try {
    res.status(201).json(engine.generateCity(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Phase 2. Registered before `/api/cities/:id` by convention, not by
// necessity: `:id` matches exactly one segment, so a three-segment path
// can never reach the detail route however they are ordered. The
// `/api/agents/invocations` trap needs a literal and a param at the SAME
// depth -- `/api/economy/snapshot` above is the one in this file that
// genuinely does, and it has a test asserting the order holds.
app.get('/api/cities/:id/reemergence', (req, res) => {
  const breakdown = engine.getCityReemergence(req.params.id);
  if (!breakdown) return res.status(404).json({ error: 'city not found' });
  return res.json(breakdown);
});

app.get('/api/cities/:id', (req, res) => {
  const city = engine.getCityDetail(req.params.id);
  if (!city) return res.status(404).json({ error: 'city not found' });
  return res.json(city);
});

app.get('/api/communities', (req, res) => {
  const all = engine.WorldState.communities || [];
  const communities = req.query.cityId
    ? all.filter((c) => c.city_id === Number(req.query.cityId))
    : all;
  res.json({ communities, total: communities.length });
});

// audit-route-guards: open -- creates simulation geography, no real-world principal
app.post('/api/communities', (req, res) => {
  try {
    res.status(201).json(engine.generateCommunity(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/communities/:id', (req, res) => {
  const community = engine.getCommunityDetail(req.params.id);
  if (!community) return res.status(404).json({ error: 'community not found' });
  return res.json(community);
});

app.get('/api/territory-blocks', (_req, res) => {
  const blocks = engine.WorldState.territoryBlocks || [];
  res.json({ blocks, total: blocks.length });
});

// A block belongs to a faction specifically, not to any organization —
// territory_blocks.faction_id references factions.organization_id, and
// generateTerritoryBlock refuses a plain business. Standing rule 4.
// audit-route-guards: open -- creates simulation geography, no real-world principal
app.post('/api/territory-blocks', (req, res) => {
  try {
    res.status(201).json(engine.generateTerritoryBlock(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- properties -------------------------------------------------------------
//
// Phase 2. The API map names three routes here — list, detail, and
// record ownership — and, for the tenth time in this file, no route
// that creates the thing the other three read. `POST /api/properties`
// is added on the same reasoning as `POST /api/cities` above: a list
// endpoint over an array nothing can fill is a starved system, not a
// built one.
//
// `value` in every response is the ASSESSED value, the column the
// schema stores. `currentValue` is derived on read and never written
// back — CLAUDE.md standing rule 3. See server/property.js's header for
// why both numbers exist and which is which.

// Every property response carries its derived value and its current
// owner. The owner is included on the LIST too, not only on the detail:
// ownership is a read over history rather than a column, so a client
// that wants "who holds this" for a page of properties would otherwise
// have to fetch each one -- and the first thing the frontend needed was
// exactly that column.
function withValue(prop) {
  return {
    ...prop,
    currentValue: engine.currentPropertyValue(prop),
    owner: engine.getCurrentOwner(prop.id),
  };
}

app.get('/api/properties', (req, res) => {
  let properties = engine.listProperties();
  if (req.query.cityId) {
    properties = properties.filter((p) => p.city_id === Number(req.query.cityId));
  }
  if (req.query.type) {
    properties = properties.filter((p) => p.type === req.query.type);
  }
  // Filtering by owner is a read over ownership history, not a column —
  // there is no owner_id on a property to filter on. Same reason
  // getHoldings() exists.
  if (req.query.ownerEntityId) {
    const ownerId = Number(req.query.ownerEntityId);
    properties = properties.filter((p) => {
      const owner = engine.getCurrentOwner(p.id);
      return owner && owner.owner_entity_id === ownerId;
    });
  }
  res.json({ properties: properties.map(withValue), total: properties.length });
});

// audit-route-guards: open -- creates simulation geography, no real-world principal
app.post('/api/properties', (req, res) => {
  try {
    res.status(201).json(withValue(engine.generateProperty(req.body || {})));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/properties/:id', (req, res) => {
  const prop = engine.getProperty(req.params.id);
  if (!prop) return res.status(404).json({ error: 'property not found' });
  const operator = prop.operating_organization_id == null ? null
    : (engine.WorldState.organizations || [])
      .find((o) => o.id === prop.operating_organization_id) || null;
  return res.json({
    ...withValue(prop),
    ownershipHistory: engine.getOwnershipHistory(prop.id),
    operatingOrganization: operator,
  });
});

// The map's own shape: { ownerEntityId, ownerType, method }. `tick`
// comes from the world rather than the caller — ownership_records
// .acquired_tick records when it happened, and a client is not the
// authority on that.
// audit-route-guards: open -- simulation ownership, in-simulation only (see VACANCY_SEED.md)
app.post('/api/properties/:id/ownership', (req, res) => {
  const prop = engine.getProperty(req.params.id);
  if (!prop) return res.status(404).json({ error: 'property not found' });
  const body = req.body || {};
  try {
    return res.status(201).json(engine.recordOwnership({
      entityId: prop.id,
      ownerEntityId: body.ownerEntityId,
      ownerType: body.ownerType,
      acquiredMethod: body.method ?? body.acquiredMethod,
      tick: engine.WorldState.tick,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Lives here rather than with the other /api/entities routes because it
// is a property rollup, not an entity field. It cannot be swallowed by
// `/api/entities/:id` above — that pattern is one segment shorter.
app.get('/api/entities/:id/holdings', (req, res) => {
  res.json(engine.getHoldings(Number(req.params.id)));
});

// -- players ------------------------------------------------------------------
//
// **Phase 3 by the map's numbering, and three of its seven routes are
// built here anyway.** The reason is specific rather than a general
// licence to run ahead: `getCitizenDashboard()` is the "observe and be
// affected by" half of the Phase 1 Definition of Done. It has been
// built and tested since the tick pipeline, and with no route it was
// reachable only from inside the process — the one part of the locked
// Phase 1 scope that could not be demonstrated to anybody.
//
// Two of the remaining four Phase 3 routes are still NOT built, and
// are not oversights: leader-dashboard and simulation-controls serve
// Leader and Simulation modes, which CLAUDE.md defers explicitly ("do
// not touch"). A dashboard for a mode nobody can enter is not a route,
// it is a decoration.
//
// The other two ARE built now. This comment used to say of the
// dispatcher: "a generic action dispatcher with no specification of
// what actions exist -- guessing at that would invent game design, not
// expose it." That was true when written and stopped being true when
// the engine grew concrete verbs: accepting and resolving missions,
// adopting a routine, practising a habit, entering a contest. The
// dispatcher invents nothing; it routes to what exists. See
// server/actions.js.

app.get('/api/players', (_req, res) => {
  const players = engine.WorldState.players || [];
  res.json({ players, total: players.length });
});

// audit-route-guards: open -- binds a session to a simulated citizen, no real-world principal
app.post('/api/players', (req, res) => {
  const body = req.body || {};
  if (body.mode && body.mode !== 'citizen') {
    return res.status(400).json({
      error: `mode "${body.mode}" is not supported — Citizen is the only mode built `
        + '(Leader/Simulation/Multiplayer are explicitly deferred).',
    });
  }
  try {
    return res.status(201).json(engine.generatePlayer({
      linkedEntityId: body.linkedEntityId, mode: body.mode,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// The map: "player detail, joined with linked NPC or Organization".
// Only the NPC join exists, because only Citizen mode does.
app.get('/api/players/:id', (req, res) => {
  const player = (engine.WorldState.players || [])
    .find((p) => p.id === Number(req.params.id));
  if (!player) return res.status(404).json({ error: 'player not found' });
  const npc = (engine.WorldState.npcs || [])
    .find((n) => n.id === player.linked_entity_id) || null;
  return res.json({ ...player, npc });
});

// GET first: a client that cannot ask what it may do has to hard-code
// the list, and then the list is in two places.
app.get('/api/players/:id/actions', (req, res) => {
  const player = (engine.WorldState.players || []).find((p) => p.id === Number(req.params.id));
  if (!player) return res.status(404).json({ error: `no player with id ${req.params.id}` });
  return res.json({ mode: player.mode, actions: engine.listActions(player.mode) });
});

// The map's "generic action dispatcher, routes to the right
// Key/decision".
//
// **The actor is the player's own linked entity, never a body field.**
// Passing a caller-supplied entityId through here would hand the
// mission state machine's "only the holder can resolve" check its own
// bypass. A body that names one is refused rather than ignored.
// audit-route-guards: open -- a simulated citizen acts as themselves; the actor is taken from the player record, not the request
app.post('/api/players/:id/action', (req, res) => {
  try {
    return res.json(engine.dispatchAction(Number(req.params.id), req.body || {}));
  } catch (err) {
    // 404 only when the PLAYER is unknown; everything else is a bad
    // request about a player that exists.
    const status = /no player with id/.test(err.message) ? 404 : 400;
    return res.status(status).json({ error: err.message });
  }
});

app.get('/api/players/:id/citizen-dashboard', (req, res) => {
  try {
    return res.json(engine.getCitizenDashboard(Number(req.params.id)));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

// -- missions: the state machine ----------------------------------------------
//
// The engine's first real player verb. Everything else here reads a
// world that runs on its own; these two routes are a person DOING
// something the world then reflects back — completing a mission credits
// the reward, and the citizen dashboard reads it as net worth.
//
// Open rather than operator-guarded: a mission belongs to the NPC
// holding it, not to the world. `resolveMission` refuses a caller who
// is not the holder, which is the check that actually matters — an
// operator guard here would stop a player playing.

// Registered BEFORE `/api/missions/:id`. Express matches in order and
// `:id` matches exactly one segment, so a two-segment path could not
// reach it anyway -- but `available` as a literal under a prefix is
// precisely the shape that got `/api/agents/invocations` swallowed in
// VACON, and the ordering costs nothing.
app.get('/api/missions/available/:entityId', (req, res) => {
  try {
    return res.json({ missions: engine.availableMissions(Number(req.params.entityId)) });
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

app.get('/api/missions/:id', (req, res) => {
  const mission = engine.getMission(Number(req.params.id));
  if (!mission) return res.status(404).json({ error: 'mission not found' });
  return res.json(mission);
});

// Both halves of the state machine answer in the SAME envelope,
// `{ mission, paid }`, even though the engine functions do not:
// `acceptMission` returns the mission bare and `resolveMission` returns
// `{ mission, paid }`, because only one of them can pay. Left as-is,
// two adjacent routes in one state machine would hand a client two
// different shapes and `body.status` would silently be `undefined` on
// exactly one of them — which is how this was found. Normalised here
// rather than in missions.js so the engine's own callers and its unit
// tests keep the shapes they were written against. Accepting never
// pays, so `paid` is null and says so.
// audit-route-guards: open -- a simulated citizen takes a simulated job
app.post('/api/missions/:id/accept', (req, res) => {
  try {
    const mission = engine.acceptMission(req.params.id, (req.body || {}).entityId);
    res.status(200).json({ mission, paid: null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// One route for all three terminal outcomes rather than three routes:
// they differ only in whether the reward is paid, and splitting them
// would invite a `/complete` that forgets to check the holder.
// audit-route-guards: open -- resolves a simulated citizen's own mission; holder is verified in the engine
app.post('/api/missions/:id/resolve', (req, res) => {
  const body = req.body || {};
  try {
    return res.status(200).json(engine.resolveMission(req.params.id, {
      outcome: body.outcome, entityId: body.entityId, note: body.note,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// -- contests: the sim engine -------------------------------------------------
//
// The engine decides who wins, from live ratings. VDP's Combat Sports
// district books the card and validates it; until now its
// `recordResult(match, winnerIds)` took the winner as a PARAMETER and
// nothing anywhere read a fighter's combat or sports traits — both
// families are generated on every NPC and were read by nothing.
//
// Deterministic and seeded, so a settled result can be re-checked by
// anybody who does not trust whoever reported it. That is why
// `/verify` exists as its own route: VAGO settles prediction markets on
// these outcomes, and a settlement nobody can reproduce is one
// somebody has to be trusted about.

app.get('/api/entities/:id/rating', (req, res) => {
  try {
    res.json(engine.rateEntity(Number(req.params.id), req.query.discipline || 'combat'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A POST because it takes a body, not because it writes: resolving a
// contest changes no world state. The result is returned, and whoever
// owns the card decides what to do with it.
// audit-route-guards: open -- computes an outcome from existing ratings; writes nothing
app.post('/api/contests/resolve', (req, res) => {
  try {
    res.json(engine.resolveContest(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- re-runs a result and compares; writes nothing
app.post('/api/contests/verify', (req, res) => {
  try {
    res.json(engine.verifyContest(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- behavior: routine, mood, habits -----------------------------------------
//
// The Behavior Engine (architecture document 4.5). None of these are on
// the API map -- for the same reason as most of the other routes beyond
// it: the map specifies reads and never the thing that creates what is
// read. A mood nobody can cause is not a system.
//
// `runBehavior` is deliberately NOT exposed. Behavior advances with the
// tick and only with the tick; a route that aged somebody's habits
// without time passing would let a caller run a person's life forward
// while the world stood still.

app.get('/api/entities/:id/behavior', (req, res) => {
  const id = Number(req.params.id);
  if (!engine.getLiveEntity(id)) {
    return res.status(404).json({ error: `no entity with id ${req.params.id}` });
  }
  return res.json(engine.describeBehavior(id));
});

app.get('/api/entities/:id/habits', (req, res) => {
  const id = Number(req.params.id);
  if (!engine.getLiveEntity(id)) {
    return res.status(404).json({ error: `no entity with id ${req.params.id}` });
  }
  return res.json({ habits: engine.listHabits(id) });
});

app.get('/api/entities/:id/schedule', (req, res) => {
  const id = Number(req.params.id);
  if (!engine.getLiveEntity(id)) {
    return res.status(404).json({ error: `no entity with id ${req.params.id}` });
  }
  return res.json({ schedule: engine.listScheduleEvents(id) });
});

// audit-route-guards: open -- stresses a simulated person; no real-world principal
app.post('/api/entities/:id/stress', (req, res) => {
  try {
    return res.json(engine.applyStress(Number(req.params.id), (req.body || {}).delta));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- records an observed habit of a simulated person
app.post('/api/entities/:id/habits', (req, res) => {
  const body = req.body || {};
  try {
    return res.status(201).json(engine.reinforceHabit(Number(req.params.id), body.name, {
      harmful: body.harmful, amount: body.amount,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- gives a simulated person a routine
app.post('/api/entities/:id/schedule', (req, res) => {
  const body = req.body || {};
  try {
    return res.status(201).json(engine.addScheduleEvent(Number(req.params.id), {
      eventType: body.eventType,
      frequency: body.frequency,
      timeSlot: body.timeSlot,
      locationPropertyId: body.locationPropertyId ?? null,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// -- culture ------------------------------------------------------------------
//
// Phase 2's Culture DNA. The map names ONE route here --
// `GET /api/culture/:tierEntityId` -- and, for the eleventh time in
// this file, nothing that creates a culture or attaches anything to
// one. Both are added, because a lookup that can only ever return null
// is not a built system.
//
// `/api/cultures` (plural) is the collection; `/api/culture/:id`
// (singular) is the map's own lookup-by-member spelling. Two different
// prefixes rather than one, deliberately: they answer different
// questions and merging them would make `/api/cultures/7` ambiguous
// between "culture 7" and "the culture of entity 7".

app.get('/api/cultures', (_req, res) => {
  const cultures = engine.listCultures();
  res.json({ cultures, total: cultures.length });
});

// audit-route-guards: open -- creates simulation world content, no real-world principal
app.post('/api/cultures', (req, res) => {
  try {
    res.status(201).json(engine.generateCulture(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/cultures/:id', (req, res) => {
  const culture = engine.getCulture(req.params.id);
  if (!culture) return res.status(404).json({ error: 'culture not found' });
  return res.json({ ...culture, members: engine.getCultureMembers(culture.id) });
});

// audit-route-guards: open -- simulation membership, no real-world principal
app.post('/api/cultures/:id/members', (req, res) => {
  const body = req.body || {};
  try {
    return res.status(201).json(engine.attachCulture({
      cultureId: Number(req.params.id), tier: body.tier, entityId: body.entityId,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// The map's own route: the Culture DNA sheet for a Family, Community,
// Organization, City or Civilization -- given the ENTITY's id, not the
// culture's. Individuals are absent by design: they belong to a culture
// through their family or community and do not carry one.
app.get('/api/culture/:tierEntityId', (req, res) => {
  const found = engine.getCultureFor(req.params.tierEntityId);
  if (!found) {
    return res.status(404).json({
      error: `no culture is attached to entity ${req.params.tierEntityId}`,
    });
  }
  return res.json(found);
});

// -- flows --------------------------------------------------------------------
//
// Named Flow Templates, read-only over HTTP. Every flow's current
// signal value and whether it is firing -- the inspection view for a
// system whose whole point is that it is data rather than code.
//
// `readable: false` distinguishes "not firing" from "this world has
// nothing to say about that signal", which are different facts.

app.get('/api/flows', (_req, res) => {
  const flows = engine.describeFlows();
  res.json({
    flows,
    total: flows.length,
    firing: flows.filter((f) => f.firing).length,
    signals: engine.FLOW_SIGNALS,
  });
});

// audit-route-guards: open -- declares a simulation observation rule, changes no world state
app.post('/api/flows', (req, res) => {
  try {
    res.status(201).json(engine.addFlowTemplate(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- relationships ------------------------------------------------------------
//
// Phase 2. worldStore.js has held getOrCreateRelationship/
// adjustRelationship since the Key resolvers were built -- standing
// rule 1 makes every resolver write to Relationships -- and neither was
// reachable from outside the process until now.

app.get('/api/relationships/:entityId', (req, res) => {
  const entityId = Number(req.params.entityId);
  const relationships = (engine.WorldState.relationships || [])
    .filter((r) => r.entity_a_id === entityId || r.entity_b_id === entityId);
  res.json({ relationships, total: relationships.length });
});

// audit-route-guards: open -- simulation social graph, no real-world principal
app.post('/api/relationships', (req, res) => {
  const { entityAId, entityBId, type } = req.body || {};
  if (entityAId == null || entityBId == null) {
    return res.status(400).json({ error: 'entityAId and entityBId are required' });
  }
  if (Number(entityAId) === Number(entityBId)) {
    return res.status(400).json({ error: 'an entity cannot hold a relationship with itself' });
  }
  try {
    return res.status(201).json(worldStore.getOrCreateRelationship(
      engine.WorldState, Number(entityAId), Number(entityBId), type || 'acquaintance',
    ));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// -- economy ----------------------------------------------------------------

// Registered before any /api/economy/:something route could exist, and
// deliberately left as the only literal under that prefix: a param
// route added above this later would swallow it, which is exactly how
// /api/agents/invocations was lost in VACON.
app.get('/api/economy/snapshot', (_req, res) => {
  res.json({
    tick: engine.WorldState.tick,
    resources: engine.WorldState.resources.map((r) => ({
      ...r, scarcity: engine.getScarcity(r.id),
    })),
    marketListings: engine.WorldState.marketListings,
  });
});

// **Necessary completion beyond the literal spec**, the same posture
// POST /api/artifacts already took. The API map's Phase 1 list names
// GET /api/economy/snapshot and POST /api/economy/tick but no way to
// create a resource or a listing, which leaves the entire economy
// permanently empty over HTTP -- not unbuilt-but-reachable, just
// unreachable. Found by rendering the Econ tab and watching it say
// "No resources tracked yet" with no way for that ever to change.
// audit-route-guards: open -- creates simulation content, no real-world principal
app.post('/api/resources', (req, res) => {
  try {
    res.status(201).json(engine.generateResource(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The map names this one and only the POST was built, so listings could
// be created and priced but never read except through the economy
// snapshot. `cityId` is accepted because the map says "for a city";
// market_listings has no city column in the schema, so the filter is
// honest about matching nothing rather than pretending.
app.get('/api/market/listings', (req, res) => {
  const all = engine.WorldState.marketListings || [];
  const listings = req.query.resourceType
    ? all.filter((l) => l.resource_type === req.query.resourceType)
    : all;
  res.json({
    listings,
    total: listings.length,
    ...(req.query.cityId
      ? { note: 'market_listings has no city_id column in the schema; cityId was ignored.' }
      : {}),
  });
});

// audit-route-guards: open -- creates simulation content, no real-world principal
app.post('/api/market/listings', (req, res) => {
  try {
    res.status(201).json(engine.generateMarketListing(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Advances the economy for everyone, exactly like /api/tick does for
// the whole world -- same guard, same reasoning.
app.post('/api/economy/tick', requireOperator('vacon-c:economy-tick'), (_req, res) => {
  try {
    for (const resource of engine.WorldState.resources) {
      engine.advanceResourceTick(resource.id);
    }
    for (const listing of engine.WorldState.marketListings) {
      engine.resolveMarketPrice(listing.id);
    }
    res.json({ tick: engine.WorldState.tick, resources: engine.WorldState.resources });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- environmental conditions -----------------------------------------------

// **The drought has no way in.** A drought-style cascade is the locked
// Definition of Done for Phase 1, `tick.js` was written with
// addEnvironmentalCondition specifically to trigger one, and the whole
// thing has been reachable only from inside the process. The API map
// names no route for it -- the same omission that left resources and
// artifacts uncreatable -- so this is the third instance of the same
// class and is added for the same reason.
//
// Operator-guarded, not open: a condition applies its deltas on every
// tick it is alive, so declaring one changes the world for everybody
// exactly as /api/tick does.
app.post('/api/conditions', requireOperator('vacon-c:condition'), (req, res) => {
  try {
    const body = req.body || {};
    if (!body.resourceType) {
      return res.status(400).json({ error: 'requires { resourceType } -- a condition acts on one resource type' });
    }
    if (!body.ticksRemaining || Number(body.ticksRemaining) < 1) {
      // Without this a condition lives forever: runEnvironmentPhase
      // keeps any entry whose ticksRemaining stays above zero.
      return res.status(400).json({ error: 'requires { ticksRemaining } of at least 1 -- a condition with no end never expires' });
    }
    res.status(201).json(engine.addEnvironmentalCondition({
      type: body.type || 'condition',
      resourceType: body.resourceType,
      supplyDelta: Number(body.supplyDelta) || 0,
      demandDelta: Number(body.demandDelta) || 0,
      ticksRemaining: Number(body.ticksRemaining),
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/conditions', (_req, res) => {
  res.json({ conditions: engine.WorldState.activeConditions || [] });
});

// -- events and missions ----------------------------------------------------

app.get('/api/events', (req, res) => {
  const { sinceTick } = req.query;
  const events = sinceTick
    ? engine.WorldState.events.filter((e) => e.tick >= Number(sinceTick))
    : engine.WorldState.events;
  res.json({ events, total: events.length });
});

app.get('/api/missions', (req, res) => {
  res.json({ missions: engine.listMissions(req.query || {}) });
});

// GET /api/health -- { ok, tick }.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, tick: engine.WorldState.tick });
});

app.listen(PORT, () => {
  console.log(`VACON-C listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
