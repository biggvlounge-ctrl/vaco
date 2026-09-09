// VACANCY — the Phase 1 HTTP surface.
//
// Spawns the real server and sends real requests. The engine was
// unreachable from outside its own process until these routes existed,
// so testing the handlers by calling them directly would test the one
// thing that was never in doubt and skip the thing that was: whether
// the wiring holds.
//
// `VACO_SERVICE_AUTH_MODE=off` for the read paths -- the serviceAuth
// floor is tested in its own suite, and repeating it here would only
// prove the middleware is mounted. What IS tested here is the
// per-route operator guard, which is this file's own concern.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false
  : 'vacon-c/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 8000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}/api`;

let server;

test.before(async () => {
  if (SKIP) return;
  server = spawn('node', ['server.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: String(PORT), VACO_SERVICE_AUTH_MODE: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for the real listen line rather than a fixed sleep: a fixed
  // sleep either flakes on a slow machine or wastes time on a fast one.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start within 10s')), 10000);
    server.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) { clearTimeout(timer); resolve(); }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited before listening (code ${code})`));
    });
  });
});

// A SECOND server with the operator guard off. The guard on the main
// one fires before any handler runs -- correctly -- which makes a
// handler's own validation unreachable there: asking for a 400 gets a
// 401, as the first version of these tests discovered. Testing both
// properties needs both postures, so it runs both rather than turning
// the guard off and quietly losing the guard assertions.
let openServer;
const OPEN_PORT = PORT + 1;
const OPEN = `http://127.0.0.1:${OPEN_PORT}/api`;

test.before(async () => {
  if (SKIP) return;
  openServer = spawn('node', ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(OPEN_PORT),
      VACO_SERVICE_AUTH_MODE: 'off',
      VACO_OPERATOR_MODE: 'off',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('open server did not start within 10s')), 10000);
    openServer.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) { clearTimeout(timer); resolve(); }
    });
    openServer.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`open server exited before listening (code ${code})`));
    });
  });
});

test.after(() => {
  if (server) server.kill('SIGKILL');
  if (openServer) openServer.kill('SIGKILL');
});

const openPost = (p, body) => fetch(`${OPEN}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {}),
});

const get = (p) => fetch(`${BASE}${p}`);
const post = (p, body) => fetch(`${BASE}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {}),
});

// -- the contract endpoints still answer -------------------------------------

test('the five contract endpoints are untouched', { skip: SKIP }, async () => {
  // CLAUDE.md: "existing endpoints must keep their exact shape."
  const health = await (await get('/health')).json();
  assert.equal(health.ok, true);
  assert.equal(typeof health.tick, 'number');

  const state = await (await get('/state')).json();
  assert.ok(Array.isArray(state.npcs), '/api/state still returns the world snapshot');
});

// -- reads --------------------------------------------------------------------

test('every Phase 1 read answers 200', { skip: SKIP }, async () => {
  const paths = ['/keys', '/npcs', '/families', '/organizations', '/factions',
    '/events', '/missions', '/economy/snapshot'];
  for (const p of paths) {
    const res = await get(p);
    assert.equal(res.status, 200, `GET ${p} answered ${res.status}`);
  }
});

test('/api/economy/snapshot is not swallowed by a param route', { skip: SKIP }, async () => {
  // The VACON lesson: `/api/agents/invocations` was shadowed by
  // `/api/agents/:id` and returned "no agent with id invocations".
  // A literal under a prefix must be asserted, not assumed.
  const body = await (await get('/economy/snapshot')).json();
  assert.ok(Array.isArray(body.resources), 'snapshot must return resources, not a 404 for id "snapshot"');
  assert.equal(typeof body.tick, 'number');
});

test('GET /api/keys lists exactly the seven resolvers', { skip: SKIP }, async () => {
  const { keys } = await (await get('/keys')).json();
  assert.equal(keys.length, 7, `expected 7 Keys, got ${keys.length}: ${keys.join(', ')}`);
  for (const k of ['resilience', 'adaptability', 'trust', 'scarcity-response',
    'fear', 'aggression', 'territory']) {
    assert.ok(keys.includes(k), `missing Key: ${k}`);
  }
});

// -- entities and NPCs --------------------------------------------------------

test('an NPC can be created, then read back three ways', { skip: SKIP }, async () => {
  const { npc } = await (await post('/npc/generate', {})).json();
  assert.ok(npc.id, 'generate must return an id');

  const entity = await (await get(`/entities/${npc.id}`)).json();
  assert.equal(entity.id, npc.id);
  assert.ok(entity.traits, 'the live entity carries traits');

  const { traits } = await (await get(`/entities/${npc.id}/traits`)).json();
  assert.ok(Array.isArray(traits) && traits.length > 0, 'trait rows must be listable');

  const detail = await (await get(`/npcs/${npc.id}`)).json();
  for (const field of ['npc', 'relationships', 'knowledge', 'memories']) {
    assert.ok(field in detail, `NPC detail is missing ${field}`);
  }
});

test('a missing entity is a 404, not a 500', { skip: SKIP }, async () => {
  // A 500 here would mean an unhandled throw reached the client, and a
  // client cannot tell "does not exist" from "we are broken".
  for (const p of ['/entities/999999', '/npcs/999999', '/families/999999', '/organizations/999999']) {
    const res = await get(p);
    assert.equal(res.status, 404, `GET ${p} answered ${res.status}`);
    const body = await res.json();
    assert.ok(body.error, 'a 404 must say what was not found');
  }
});

// -- families -----------------------------------------------------------------

test('a family is created, gains a member, and reports computed wealth', { skip: SKIP }, async () => {
  const { npc } = await (await post('/npc/generate', {})).json();
  const family = await (await post('/families', { surname: 'Adeyemi' })).json();
  assert.ok(family.id);

  const added = await post(`/families/${family.id}/members`, { entityId: npc.id, role: 'head' });
  assert.equal(added.status, 201);

  const detail = await (await get(`/families/${family.id}`)).json();
  assert.equal(detail.family.surname, 'Adeyemi');
  assert.equal(detail.members.length, 1);
  assert.equal(typeof detail.wealth, 'number', 'wealth is computed on read — standing rule 3');
  assert.ok(detail.members[0].npc, 'a member must resolve to a real NPC, not just an id');
});

test('a family needs a surname, and the failure is a 400', { skip: SKIP }, async () => {
  const res = await post('/families', {});
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /surname/);
});

test('adding a member requires entityId and role', { skip: SKIP }, async () => {
  const family = await (await post('/families', { surname: 'Vance' })).json();
  const res = await post(`/families/${family.id}/members`, { role: 'head' });
  assert.equal(res.status, 400);
});

// -- organizations and factions -----------------------------------------------

test('an organization is created, and a faction is an organization', { skip: SKIP }, async () => {
  // Standing rule 4: Faction is an Organization subtype, not a root
  // entity. A faction must therefore appear in BOTH lists.
  const org = await (await post('/organizations', { type: 'business', name: 'Riverside Mill' })).json();
  const faction = await (await post('/organizations', {
    type: 'gang', name: 'The Kestrels', isFaction: true,
  })).json();

  const { organizations } = await (await get('/organizations')).json();
  const { factions } = await (await get('/factions')).json();

  const orgIds = organizations.map((o) => o.id);
  assert.ok(orgIds.includes(org.id), 'a business is an organization');
  assert.ok(orgIds.includes(faction.id), 'a faction is ALSO an organization — standing rule 4');
  assert.ok(factions.map((f) => f.id).includes(faction.id), 'and appears in the faction list');
  assert.ok(!factions.map((f) => f.id).includes(org.id), 'but a plain business does not');
});

test('an organization must declare a type', { skip: SKIP }, async () => {
  const res = await post('/organizations', { name: 'Nameless' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /type/);
});

test('faction territory is listable even when empty', { skip: SKIP }, async () => {
  const faction = await (await post('/organizations', {
    type: 'gang', name: 'The Wrens', isFaction: true,
  })).json();
  const body = await (await get(`/factions/${faction.id}/territory`)).json();

  assert.equal(body.factionId, faction.id);
  assert.deepEqual(body.blocks, [], 'no territory is an empty list, not a 404');
  assert.equal(body.total, 0);
});

// -- the economy --------------------------------------------------------------

test('a resource and a listing can be created, and the snapshot shows both', { skip: SKIP }, async () => {
  // These two routes exist because the Econ tab could otherwise never
  // show anything: the API map names the snapshot and the economy tick
  // but no way to put a resource or a listing into the world.
  const r = await post('/resources', {
    resourceType: 'water', quantity: 400, supply: 80, demand: 130,
  });
  assert.equal(r.status, 201);

  const l = await post('/market/listings', {
    productName: 'water ration', resourceType: 'water', price: 10, supply: 100, demand: 100,
  });
  assert.equal(l.status, 201);
  assert.equal((await l.json()).resource_type, 'water', 'the listing must remember its raw input');

  const snap = await (await get('/economy/snapshot')).json();
  const water = snap.resources.find((x) => x.resource_type === 'water');
  assert.ok(water, 'the snapshot must include the resource just created');
  assert.equal(typeof water.scarcity, 'number', 'scarcity is computed on read');
  assert.ok(water.scarcity > 60, `80 supply against 130 demand is scarce, got ${water.scarcity}`);

  assert.ok(snap.marketListings.some((x) => x.product_name === 'water ration'));
});

test('a resource must declare its type, and a listing a name and price', { skip: SKIP }, async () => {
  assert.equal((await post('/resources', {})).status, 400);
  assert.equal((await post('/market/listings', { price: 1 })).status, 400);
  assert.equal((await post('/market/listings', { productName: 'x' })).status, 400);
});

test('family wealth follows its members\' finances', { skip: SKIP }, async () => {
  // Without POST /api/entities/:id/finances every family reads 0
  // forever, because getFamilyWealth sums finances and nothing could
  // create any. Found by looking at the World tab, not by reasoning.
  const { npc } = await (await post('/npc/generate', {})).json();
  const family = await (await post('/families', { surname: 'Ferrer' })).json();
  await post(`/families/${family.id}/members`, { entityId: npc.id, role: 'head' });

  const before = (await (await get(`/families/${family.id}`)).json()).wealth;
  assert.equal(before, 0, 'a member with no finances contributes nothing');

  const f = await post(`/entities/${npc.id}/finances`, { savings: 500, assets: 200, debt: 50 });
  assert.equal(f.status, 201);

  const after = (await (await get(`/families/${family.id}`)).json()).wealth;
  assert.ok(after > before, `wealth must follow the member (was ${before}, now ${after})`);

  const nw = await (await get(`/entities/${npc.id}/net-worth`)).json();
  assert.equal(nw.netWorth, after, 'a one-member family is worth exactly its member');
});

// -- territory and community --------------------------------------------------

test('a city and its communities can be created and read back', { skip: SKIP }, async () => {
  const city = await (await post('/cities', { name: 'Saint Louis', population: 12000 })).json();
  assert.ok(city.id);
  assert.equal(city.reemergence_index, 34, 'the schema default, not an invented number');

  await post('/communities', { cityId: city.id, tier: 'block', population: 3200 });
  const scoped = await (await get(`/communities?cityId=${city.id}`)).json();
  assert.equal(scoped.total, 1, 'communities filter by city');
  assert.equal(scoped.communities[0].city_id, city.id);

  assert.equal((await post('/cities', {})).status, 400, 'a city must be named');
});

test('a territory block belongs to a faction, never a plain organization', { skip: SKIP }, async () => {
  // Standing rule 4 at the route level: territory_blocks.faction_id
  // references factions specifically. A business holding ground would
  // be a category error the schema does not allow.
  const business = await (await post('/organizations', { type: 'business', name: 'A Bakery' })).json();
  const faction = await (await post('/organizations', {
    type: 'gang', name: 'The Wrens', isFaction: true,
  })).json();

  const refused = await post('/territory-blocks', { factionId: business.id });
  assert.equal(refused.status, 400);
  assert.match((await refused.json()).error, /not an existing faction/);

  const ok = await post('/territory-blocks', { factionId: faction.id, buildingCount: 12 });
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).status, 'controlled', 'blocks start controlled, the schema default');

  assert.equal((await post('/territory-blocks', {})).status, 400, 'a block needs a faction');
});

test('the Organization phase resolves control once blocks exist', { skip: SKIP }, async () => {
  // **The point of these routes.** The tick's Organization phase has
  // always called resolveTerritoryControl on every territory block, and
  // has always looped over an empty array because nothing could create
  // one. It was starved, not unwired.
  //
  // **The outcome is forced, not observed.** The first version of this
  // test asserted only that the status was one of the three legal
  // values -- which a block that was never resolved also satisfies, so
  // re-starving the phase left the suite green. A test that a broken
  // phase passes is not a test. Faction traits are rolled randomly, so
  // the fix is to drive them somewhere the verdict is certain: control
  // is the mean of organization territory and power, and below 40 the
  // block goes contested. -100 on each puts any roll under that.
  const faction = await (await openPost('/organizations', {
    type: 'gang', name: 'The Harriers', isFaction: true,
  })).json();
  const block = await (await openPost('/territory-blocks', {
    factionId: faction.id, buildingCount: 20,
  })).json();
  assert.equal(block.status, 'controlled', 'blocks start controlled');

  await openPost(`/entities/${faction.id}/traits/0`, {
    family: 'organization', name: 'territory', delta: -100,
  });
  await openPost(`/entities/${faction.id}/traits/0`, {
    family: 'organization', name: 'power', delta: -100,
  });

  await openPost('/tick', {});

  const after = await (await fetch(`${OPEN}/territory-blocks`)).json();
  const mine = after.blocks.find((b) => b.id === block.id);
  assert.ok(mine, 'the block survives a tick');
  assert.equal(mine.status, 'contested',
    'a faction with no territory or power cannot hold ground -- if this is still '
    + '"controlled" the Organization phase did not run over this block');
  assert.notEqual(mine.contested_since_tick, null,
    'losing a block must record when it started being contested');
});

// -- environmental conditions -------------------------------------------------

test('a condition needs a resource type and an end', { skip: SKIP }, async () => {
  // Against the OPEN server: with the guard on this is a 401 before the
  // handler ever runs, so the validation could not be reached at all.
  //
  // The end matters. runEnvironmentPhase keeps any condition whose
  // ticksRemaining is still above zero, so one declared without an end
  // drains its resource for the life of the world.
  assert.equal((await openPost('/conditions', { ticksRemaining: 3 })).status, 400);

  const noEnd = await openPost('/conditions', { resourceType: 'water' });
  assert.equal(noEnd.status, 400);
  assert.match((await noEnd.json()).error, /ticksRemaining/);

  const good = await openPost('/conditions', {
    type: 'drought', resourceType: 'water', supplyDelta: -8, ticksRemaining: 3,
  });
  assert.equal(good.status, 201, 'a well-formed condition is accepted');
});

test('active conditions are listable', { skip: SKIP }, async () => {
  const res = await get('/conditions');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).conditions));
});

// -- the operator guards ------------------------------------------------------

test('everything that advances the world refuses an anonymous caller', { skip: SKIP }, async () => {
  // These four move state that nobody can move back. A 200 from any of
  // them would mean a stranger with the port can run the simulation.
  const guarded = [
    ['/keys/fear/resolve', { entityId: 1 }],
    ['/npcs/1/decide', { keyId: 'fear' }],
    ['/economy/tick', {}],
    ['/entities/1/traits/1', { family: 'emotional', name: 'Resilience', delta: 5 }],
    // A condition applies its deltas on every tick it is alive, so
    // declaring one moves the world for everybody exactly as a tick does.
    ['/conditions', { resourceType: 'water', supplyDelta: -8, ticksRemaining: 4 }],
  ];

  for (const [p, body] of guarded) {
    const res = await post(p, body);
    assert.ok(res.status === 401 || res.status === 403,
      `POST ${p} must be refused without an operator credential, got ${res.status}`);
  }
});

test('reads stay open — the guard is on writes, not on looking', { skip: SKIP }, async () => {
  // The inverse assertion. If a future change guards the whole app the
  // read surface goes dark, and this says so rather than letting it
  // pass as "more secure".
  for (const p of ['/npcs', '/families', '/keys', '/economy/snapshot']) {
    assert.equal((await get(p)).status, 200, `GET ${p} must stay readable`);
  }
});

// -- properties ---------------------------------------------------------------
//
// Phase 2. The API map names list/detail/ownership and, once again, no
// create route -- so the first thing asserted is that the create route
// this file added actually fills the list the other three read from.

test('a property can be created, listed, and fetched', { skip: SKIP }, async () => {
  const res = await post('/properties', {
    type: 'residential', value: 90000, lifecycleStage: 'operation',
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.type, 'residential');

  const list = await (await get('/properties')).json();
  assert.ok(list.properties.some((p) => p.id === created.id), 'the created property is listed');

  const detail = await (await get(`/properties/${created.id}`)).json();
  assert.equal(detail.id, created.id);
  assert.ok(Array.isArray(detail.ownershipHistory));
});

test('a property response carries both the assessed and the derived value', { skip: SKIP }, async () => {
  // Standing rule 3 over HTTP: `value` is the stored assessed number,
  // `currentValue` is derived on read. A response with only one of them
  // would make the distinction invisible to every client.
  const created = await (await post('/properties', {
    type: 'commercial', value: 200000, lifecycleStage: 'operation', condition: 50,
  })).json();

  assert.equal(created.value, 200000, 'assessed value is what was entered');
  assert.equal(created.currentValue, 100000, 'derived value reflects condition');

  const refetched = await (await get(`/properties/${created.id}`)).json();
  assert.equal(refetched.value, 200000, 'the row was not overwritten with the derived number');
  assert.equal(refetched.currentValue, 100000);
});

test('a nonexistent property is a 404, not an empty object', { skip: SKIP }, async () => {
  assert.equal((await get('/properties/99999')).status, 404);
  assert.equal((await post('/properties/99999/ownership', {
    ownerEntityId: 1, ownerType: 'individual',
  })).status, 404);
});

test('an invalid property is refused with the reason', { skip: SKIP }, async () => {
  const res = await openPost('/properties', { value: 100 });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /type/);
});

test('ownership is recorded, read back, and rolled up into holdings', { skip: SKIP }, async () => {
  const owner = await (await post('/npc/generate')).json();
  const ownerId = owner.npc.id;
  const home = await (await post('/properties', {
    type: 'residential', value: 120000, lifecycleStage: 'operation',
  })).json();

  const res = await post(`/properties/${home.id}/ownership`, {
    ownerEntityId: ownerId, ownerType: 'individual', method: 'purchased',
  });
  assert.equal(res.status, 201);
  const record = await res.json();
  assert.equal(record.owner_entity_id, ownerId);
  assert.equal(record.acquired_method, 'purchased');
  assert.equal(typeof record.acquired_tick, 'number', 'the tick comes from the world, not the caller');

  const detail = await (await get(`/properties/${home.id}`)).json();
  assert.equal(detail.owner.owner_entity_id, ownerId);

  const holdings = await (await get(`/entities/${ownerId}/holdings`)).json();
  assert.equal(holdings.count, 1);
  assert.equal(holdings.totalValue, 120000);
});

test('properties are filterable by owner, which is a read over history', { skip: SKIP }, async () => {
  const a = await (await post('/npc/generate')).json();
  const b = await (await post('/npc/generate')).json();
  const one = await (await post('/properties', { type: 'commercial', value: 10, lifecycleStage: 'operation' })).json();
  const two = await (await post('/properties', { type: 'commercial', value: 10, lifecycleStage: 'operation' })).json();

  await post(`/properties/${one.id}/ownership`, { ownerEntityId: a.npc.id, ownerType: 'individual' });
  await post(`/properties/${two.id}/ownership`, { ownerEntityId: b.npc.id, ownerType: 'individual' });

  const mine = await (await get(`/properties?ownerEntityId=${a.npc.id}`)).json();
  assert.deepEqual(mine.properties.map((p) => p.id), [one.id]);
});

test('an unknown owner type is refused rather than stored', { skip: SKIP }, async () => {
  const home = await (await openPost('/properties', { type: 'residential', value: 100 })).json();
  const res = await openPost(`/properties/${home.id}/ownership`, {
    ownerEntityId: 1, ownerType: 'landlord',
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not an owner type/);
});

// -- the rest of Phase 2's read surface ---------------------------------------

test('city detail carries a reemergence computed on read, not the stored default', { skip: SKIP }, async () => {
  const city = await (await post('/cities', {
    name: 'Testville', population: 900, economy: 46, infrastructure: 41, safety: 38,
  })).json();
  await post('/communities', { cityId: city.id, housing: 44, crime: 31, safety: 40, employment: 52 });
  await post('/communities', { cityId: city.id, housing: 58, crime: 12, safety: 66, employment: 61 });

  const detail = await (await get(`/cities/${city.id}`)).json();
  assert.equal(detail.id, city.id);
  assert.equal(detail.communities.length, 2);
  assert.equal(typeof detail.reemergence.composite, 'number');

  // Standing rule 3: the live number is computed, and the column on the
  // row is the schema's default sitting there unchanged.
  assert.equal(detail.reemergence.storedIndex, 34);
  assert.notEqual(detail.reemergence.composite, undefined);
});

test('the reemergence breakdown names its sub-indices and their scope', { skip: SKIP }, async () => {
  const city = await (await post('/cities', { name: 'Breakdownville' })).json();
  const res = await get(`/cities/${city.id}/reemergence`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.subIndices), 'the breakdown route returns sub-indices, not city detail');
  assert.equal(body.communities, undefined, 'it is the breakdown, not the city detail payload');
  assert.equal(body.subIndices.length, 4);
  // Two of the four are honestly world-scoped, and say so.
  assert.deepEqual(body.subIndices.map((s) => s.scope), ['city', 'city', 'city', 'world']);
});

test('community detail carries health, which is computed and not on the row', { skip: SKIP }, async () => {
  const city = await (await post('/cities', { name: 'Healthville' })).json();
  const community = await (await post('/communities', {
    cityId: city.id, housing: 80, safety: 80, employment: 80, education: 80, crime: 0,
  })).json();

  assert.equal(community.health, undefined, 'health is not stored on the generated row');

  const detail = await (await get(`/communities/${community.id}`)).json();
  assert.equal(typeof detail.health, 'number');
  assert.equal(detail.city.id, city.id);
});

test('a missing city or community is a 404', { skip: SKIP }, async () => {
  assert.equal((await get('/cities/99999')).status, 404);
  assert.equal((await get('/cities/99999/reemergence')).status, 404);
  assert.equal((await get('/communities/99999')).status, 404);
});

test('businesses are a filtered read over organizations, not a second table', { skip: SKIP }, async () => {
  // Standing rule 4: Organization is the parent, Business is a subtype.
  const mill = await (await post('/organizations', { name: 'Test Mill', type: 'business' })).json();
  const gang = await (await post('/organizations', { name: 'Test Gang', type: 'gang', isFaction: true })).json();

  const { businesses } = await (await get('/businesses')).json();
  const ids = businesses.map((b) => b.id);
  assert.ok(ids.includes(mill.id), 'the business is listed');
  assert.ok(!ids.includes(gang.id), 'the faction is not');
});

test('market listings are readable, not only creatable', { skip: SKIP }, async () => {
  await post('/resources', { resourceType: 'timber', quantity: 100, supply: 50, demand: 50 });
  await post('/market/listings', { productName: 'plank', resourceType: 'timber', price: 3, supply: 50, demand: 50 });
  await post('/market/listings', { productName: 'rope', price: 2, supply: 10, demand: 10 });

  const all = await (await get('/market/listings')).json();
  assert.ok(all.total >= 2);

  const timber = await (await get('/market/listings?resourceType=timber')).json();
  assert.ok(timber.listings.every((l) => l.resource_type === 'timber'));
  assert.ok(timber.listings.some((l) => l.product_name === 'plank'));
});

test('a cityId filter on market listings says it was ignored rather than lying', { skip: SKIP }, async () => {
  // market_listings has no city_id column. Silently returning everything
  // would read as "this city has every listing in the world".
  const body = await (await get('/market/listings?cityId=1')).json();
  assert.match(body.note, /no city_id column/);
});

test('a relationship can be created and read back from either side', { skip: SKIP }, async () => {
  const a = await (await post('/npc/generate')).json();
  const b = await (await post('/npc/generate')).json();

  const res = await post('/relationships', {
    entityAId: a.npc.id, entityBId: b.npc.id, type: 'rival',
  });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).relationship_type, 'rival');

  const fromA = await (await get(`/relationships/${a.npc.id}`)).json();
  const fromB = await (await get(`/relationships/${b.npc.id}`)).json();
  assert.ok(fromA.relationships.some((r) => r.entity_b_id === b.npc.id));
  assert.ok(fromB.relationships.some((r) => r.entity_a_id === a.npc.id),
    'a relationship is readable from the other end too');
});

test('a relationship needs two different entities', { skip: SKIP }, async () => {
  assert.equal((await openPost('/relationships', { entityAId: 1 })).status, 400);
  const same = await openPost('/relationships', { entityAId: 1, entityBId: 1 });
  assert.equal(same.status, 400);
  assert.match((await same.json()).error, /itself/);
});

// -- the citizen, over HTTP ---------------------------------------------------
//
// The half of the Phase 1 Definition of Done that had no route: a
// citizen who can observe the world and be affected by it. It was
// testable in-process and invisible from outside.

test('a citizen can be created and read back', { skip: SKIP }, async () => {
  const npc = await (await post('/npc/generate')).json();
  const res = await post('/players', { linkedEntityId: npc.npc.id });
  assert.equal(res.status, 201);
  const player = await res.json();
  assert.equal(player.mode, 'citizen');
  assert.equal(player.linked_entity_id, npc.npc.id);

  const detail = await (await get(`/players/${player.id}`)).json();
  assert.equal(detail.npc.id, npc.npc.id, 'player detail joins the linked NPC');
});

test('a player must bind to a real NPC, and only Citizen mode exists', { skip: SKIP }, async () => {
  const missing = await openPost('/players', { linkedEntityId: 999999 });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /not an existing NPC/);

  const npc = await (await openPost('/npc/generate')).json();
  const leader = await openPost('/players', { linkedEntityId: npc.npc.id, mode: 'leader' });
  assert.equal(leader.status, 400);
  assert.match((await leader.json()).error, /deferred|not supported/);
});

test('the citizen dashboard reaches every system the cascade touches', { skip: SKIP }, async () => {
  const npc = await (await post('/npc/generate')).json();
  const npcId = npc.npc.id;
  const player = await (await post('/players', { linkedEntityId: npcId })).json();

  await post(`/entities/${npcId}/finances`, { income: 120, savings: 400, debt: 60, assets: 250 });
  const home = await (await post('/properties', {
    type: 'residential', value: 95000, lifecycleStage: 'operation',
  })).json();
  await post(`/properties/${home.id}/ownership`, {
    ownerEntityId: npcId, ownerType: 'individual', method: 'purchased',
  });

  const dash = await (await get(`/players/${player.id}/citizen-dashboard`)).json();
  assert.equal(dash.player.linkedEntityId, npcId);
  assert.ok(dash.traits, 'live traits');
  assert.equal(typeof dash.netWorth, 'number');
  assert.equal(dash.propertySummary.count, 1, 'and what they own');
  assert.equal(dash.propertySummary.totalValue, 95000);
  assert.ok(Array.isArray(dash.recentEvents));

  // Mood, habits and routine. Until the Behavior Engine existed the
  // dashboard could say what a citizen owned and who they knew, and
  // nothing at all about how they were doing.
  assert.ok(dash.behavior, 'the dashboard reaches the Behavior Engine');
  assert.equal(dash.behavior.state, null, 'nothing has happened to them yet');
  await post(`/entities/${npcId}/stress`, { delta: 30 });
  await post(`/entities/${npcId}/schedule`, { eventType: 'night shift', frequency: 'daily' });
  const after = await (await get(`/players/${player.id}/citizen-dashboard`)).json();
  assert.ok(after.behavior.state.currentMood, 'and now it can say how they are');
  assert.equal(after.behavior.schedule.length, 1);
});

test('a citizen does something, and the world reflects it back', { skip: SKIP }, async () => {
  // **The Phase 1 Definition of Done, over HTTP, in one test.** CLAUDE.md
  // says Phase 1 is not done until a Citizen-mode player can "observe
  // and be affected by" the simulation. Every other test here proves one
  // half: the world runs, or the dashboard reads. This is the loop —
  // a person ACTS, money moves, and the same person reads the change
  // back out of their own dashboard, through the real API rather than
  // through the engine's in-process functions.
  //
  // It exists because VACANCY_INVENTORY.md claimed exactly this chain
  // in prose while nothing anywhere exercised it end to end.
  const npc = await (await post('/npc/generate')).json();
  const npcId = npc.npc.id;
  const player = await (await post('/players', { linkedEntityId: npcId })).json();
  await post(`/entities/${npcId}/finances`, { income: 0, savings: 100, debt: 0, assets: 0 });

  const before = await (await get(`/players/${player.id}/citizen-dashboard`)).json();

  const artifact = await (await post('/artifacts', { type: 'relic', name: 'Ledger Stone' })).json();
  const created = await (await post('/mission', { artifactId: artifact.id, reward: 250 })).json();
  const missionId = created.mission.id;

  // Both routes answer in the same `{ mission, paid }` envelope. They
  // did not until 29 Aug 2026 — accept returned the mission bare — and
  // the mismatch showed up here as `undefined` rather than as an error,
  // which is exactly how a client would have met it.
  const accepted = await (await post(`/missions/${missionId}/accept`, { entityId: npcId })).json();
  assert.equal(accepted.mission.status, 'accepted');
  assert.equal(accepted.mission.assigned_entity_id, npcId, 'the mission records who took it');
  assert.equal(accepted.paid, null, 'accepting a mission pays nothing');

  const resolved = await (await post(`/missions/${missionId}/resolve`, {
    outcome: 'completed', entityId: npcId,
  })).json();
  assert.equal(resolved.mission.status, 'completed');
  assert.equal(resolved.paid.amount ?? 250, 250, 'and completing it pays');

  const after = await (await get(`/players/${player.id}/citizen-dashboard`)).json();
  assert.equal(
    after.netWorth, before.netWorth + 250,
    'the reward has to show up in the citizen\'s own net worth, or the loop is open',
  );

  // And the negative case in the same shape, because a test that only
  // ever sees money arrive would pass just as happily against a
  // dashboard that added 250 to everything.
  const second = await (await post('/mission', { artifactId: artifact.id, reward: 250 })).json();
  await post(`/missions/${second.mission.id}/accept`, { entityId: npcId });
  await post(`/missions/${second.mission.id}/resolve`, { outcome: 'failed', entityId: npcId });
  const afterFailure = await (await get(`/players/${player.id}/citizen-dashboard`)).json();
  assert.equal(afterFailure.netWorth, after.netWorth, 'a failed mission pays nothing');
});

test('a missing player is a 404 on the dashboard too', { skip: SKIP }, async () => {
  assert.equal((await get('/players/99999')).status, 404);
  assert.equal((await get('/players/99999/citizen-dashboard')).status, 404);
});

// -- the player action dispatcher ---------------------------------------------

test('a player can ask what they may do, then do it', { skip: SKIP }, async () => {
  const { npc } = await (await post('/npc/generate')).json();
  const player = await (await post('/players', { linkedEntityId: npc.id })).json();
  await post(`/entities/${npc.id}/finances`, { income: 0, savings: 100, debt: 0, assets: 0 });

  const menu = await (await get(`/players/${player.id}/actions`)).json();
  assert.equal(menu.mode, 'citizen');
  assert.ok(menu.actions.length >= 5, 'the menu is real');
  assert.ok(menu.actions.every((a) => a.summary && Array.isArray(a.requires)));

  const artifact = await (await post('/artifacts', { type: 'relic', name: 'Stone' })).json();
  const created = await (await post('/mission', { artifactId: artifact.id, reward: 250 })).json();

  const available = await (await get(`/missions/available/${npc.id}`)).json();
  assert.ok(available.missions.some((m) => m.id === created.mission.id));

  const accepted = await (await post(`/players/${player.id}/action`, {
    action: 'accept-mission', missionId: created.mission.id,
  })).json();
  assert.equal(accepted.actorEntityId, npc.id, 'the dispatch says who acted');
  assert.equal(accepted.result.mission.status, 'accepted');

  const gone = await (await get(`/missions/available/${npc.id}`)).json();
  assert.ok(!gone.missions.some((m) => m.id === created.mission.id), 'a held mission is not on offer');

  const done = await (await post(`/players/${player.id}/action`, {
    action: 'resolve-mission', missionId: created.mission.id, outcome: 'completed',
  })).json();
  assert.equal(done.result.paid.amount, 250, 'and the reward is actually paid');

  const dash = await (await get(`/players/${player.id}/citizen-dashboard`)).json();
  assert.equal(dash.netWorth, 350, 'the citizen reads their own action back as net worth');
});

test('a player cannot act as somebody else over HTTP', { skip: SKIP }, async () => {
  // The attack, through the real API rather than the engine: take a
  // mission somebody else is holding and collect for it.
  const a = await (await post('/npc/generate')).json();
  const b = await (await post('/npc/generate')).json();
  const holder = await (await post('/players', { linkedEntityId: a.npc.id })).json();
  const thief = await (await post('/players', { linkedEntityId: b.npc.id })).json();
  await post(`/entities/${a.npc.id}/finances`, { income: 0, savings: 100, debt: 0, assets: 0 });

  const artifact = await (await post('/artifacts', { type: 'relic', name: 'Purse' })).json();
  const created = await (await post('/mission', { artifactId: artifact.id, reward: 500 })).json();
  await post(`/players/${holder.id}/action`, {
    action: 'accept-mission', missionId: created.mission.id,
  });

  // Straight attempt: refused by the state machine's holder check.
  const direct = await post(`/players/${thief.id}/action`, {
    action: 'resolve-mission', missionId: created.mission.id, outcome: 'completed',
  });
  assert.equal(direct.status, 400);
  assert.match((await direct.json()).error, /is held by/);

  // Smuggled actor: refused by name rather than silently dropped.
  const smuggled = await post(`/players/${thief.id}/action`, {
    action: 'resolve-mission', missionId: created.mission.id, outcome: 'completed',
    entityId: a.npc.id,
  });
  assert.equal(smuggled.status, 400);
  assert.match((await smuggled.json()).error, /acts as themselves/);

  const dash = await (await get(`/players/${holder.id}/citizen-dashboard`)).json();
  assert.equal(dash.netWorth, 100, 'nobody was paid for either attempt');
});

test('the dispatcher tells a caller what it will accept', { skip: SKIP }, async () => {
  const { npc } = await (await post('/npc/generate')).json();
  const player = await (await post('/players', { linkedEntityId: npc.id })).json();

  const unknown = await post(`/players/${player.id}/action`, { action: 'rob-the-bank' });
  assert.equal(unknown.status, 400);
  assert.match((await unknown.json()).error, /is not an action. Available: /);

  const nameless = await post(`/players/${player.id}/action`, {});
  assert.equal(nameless.status, 400);
  assert.match((await nameless.json()).error, /an action is required/);

  const incomplete = await post(`/players/${player.id}/action`, {
    action: 'adopt-routine', eventType: 'shift',
  });
  assert.equal(incomplete.status, 400);
  assert.match((await incomplete.json()).error, /requires frequency/);

  // An unknown PLAYER is a 404; a bad request about a real player is a
  // 400. A client cannot act on "does not exist" and "you asked wrong"
  // if they arrive as the same status.
  assert.equal((await post('/players/999999/action', { action: 'practise-habit', name: 'x' })).status, 404);
  assert.equal((await get('/players/999999/actions')).status, 404);
});

test('/api/missions/available/:entityId is not swallowed by /api/missions/:id',
  { skip: SKIP }, async () => {
    // `available` is a literal under a prefix that also has a `:id`
    // route — the exact shape that made `/api/agents/invocations`
    // return "no agent with id invocations" in VACON.
    const { npc } = await (await post('/npc/generate')).json();
    const res = await get(`/missions/available/${npc.id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.missions), 'must be the available list, not a mission lookup');
    assert.equal((await get('/missions/available/999999')).status, 404);
  });

// -- behavior: routine, mood, habits ------------------------------------------

test('a person can be given a routine, a habit and a bad day over HTTP', { skip: SKIP }, async () => {
  const { npc } = await (await post('/npc/generate')).json();

  // Nothing observed yet: no state, not a calm one.
  const empty = await (await get(`/entities/${npc.id}/behavior`)).json();
  assert.equal(empty.state, null, 'an unobserved person has no state, not a zeroed one');
  assert.deepEqual(empty.habits, []);
  assert.deepEqual(empty.schedule, []);

  const routine = await post(`/entities/${npc.id}/schedule`, {
    eventType: 'shift at the yard', frequency: 'daily', timeSlot: 'morning',
  });
  assert.equal(routine.status, 201);
  assert.equal((await routine.json()).tick_last_occurred, null, 'a new routine has not happened yet');

  assert.equal((await post(`/entities/${npc.id}/habits`, {
    name: 'the bottle', harmful: true, amount: 20,
  })).status, 201);

  const stressed = await (await post(`/entities/${npc.id}/stress`, { delta: 45 })).json();
  assert.ok(stressed.stressLevel > 0);
  assert.ok(stressed.currentMood, 'a mood comes back with the stress it is derived from');

  const full = await (await get(`/entities/${npc.id}/behavior`)).json();
  assert.equal(full.schedule.length, 1);
  assert.equal(full.habits.length, 1);
  assert.equal(full.habits[0].harmful, true);
  assert.equal(full.state.stressLevel, stressed.stressLevel);
});

test('behavior routes refuse a person who does not exist', { skip: SKIP }, async () => {
  // A 200 with an empty body here would be indistinguishable from a
  // real person nobody has observed -- which is a distinction this
  // whole system is built to keep.
  for (const p of ['/entities/999999/behavior', '/entities/999999/habits',
    '/entities/999999/schedule']) {
    assert.equal((await get(p)).status, 404, `GET ${p}`);
  }
  assert.equal((await post('/entities/999999/stress', { delta: 5 })).status, 400);
  assert.equal((await post('/entities/999999/habits', { name: 'x' })).status, 400);
});

test('a routine is refused unless every field is real', { skip: SKIP }, async () => {
  const { npc } = await (await post('/npc/generate')).json();
  assert.equal((await post(`/entities/${npc.id}/schedule`,
    { eventType: 'x', frequency: 'fortnightly' })).status, 400);
  assert.equal((await post(`/entities/${npc.id}/schedule`,
    { frequency: 'daily' })).status, 400);
  assert.equal((await post(`/entities/${npc.id}/schedule`,
    { eventType: 'x', frequency: 'daily', locationPropertyId: 999999 })).status, 400);
  assert.equal((await post(`/entities/${npc.id}/stress`, { delta: 'lots' })).status, 400);
});

test('/api/entities/:id/behavior is not swallowed by the :id param route', { skip: SKIP }, async () => {
  // Three segments cannot be matched by a two-segment `:id` route, but
  // that is worth an assertion rather than an argument -- the VACON
  // lesson, where `/api/agents/invocations` was shadowed and returned
  // "no agent with id invocations".
  const { npc } = await (await post('/npc/generate')).json();
  const body = await (await get(`/entities/${npc.id}/behavior`)).json();
  assert.equal(body.entityId, npc.id, 'must be the behavior summary, not the entity');
  assert.ok('habits' in body && 'schedule' in body);
});

// -- culture and flows: the last two Phase 2 systems --------------------------

test('a culture can be created, listed, and fetched', { skip: SKIP }, async () => {
  const res = await post('/cultures', {
    name: 'Riverside', traits: { tradition: 80, innovation: 20 },
    leadershipStyle: 'consensus', cuisine: ['river fish'],
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.traits.tradition, 80);
  assert.equal(created.leadershipStyle, 'consensus');

  const list = await (await get('/cultures')).json();
  assert.ok(list.cultures.some((c) => c.id === created.id));

  const detail = await (await get(`/cultures/${created.id}`)).json();
  assert.equal(detail.name, 'Riverside');
  assert.equal(detail.members.total, 0);
});

test('the map\'s own culture route answers from a tier entity id', { skip: SKIP }, async () => {
  const c = await (await post('/cultures', { name: 'Hill' })).json();
  const family = await (await post('/families', { surname: 'Hillfolk' })).json();

  const attached = await post(`/cultures/${c.id}/members`, {
    tier: 'family', entityId: family.id,
  });
  assert.equal(attached.status, 201);

  const found = await (await get(`/culture/${family.id}`)).json();
  assert.equal(found.tier, 'family');
  assert.equal(found.culture.id, c.id);
});

test('an entity with no culture is a 404, not an empty sheet', { skip: SKIP }, async () => {
  assert.equal((await get('/culture/99999')).status, 404);
  assert.equal((await get('/cultures/99999')).status, 404);
});

test('an individual is refused a culture over HTTP too', { skip: SKIP }, async () => {
  // The system's central rule, asserted at the edge as well as in the
  // module: individuals belong to a culture, they do not carry one.
  const c = await (await openPost('/cultures', { name: 'Refusal' })).json();
  const npc = await (await openPost('/npc/generate')).json();

  const res = await openPost(`/cultures/${c.id}/members`, {
    tier: 'individual', entityId: npc.npc.id,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not a tier a culture attaches to/);
});

test('an invalid culture is refused with the reason', { skip: SKIP }, async () => {
  const noName = await openPost('/cultures', { traits: { art: 50 } });
  assert.equal(noName.status, 400);
  assert.match((await noName.json()).error, /name/);

  const badStyle = await openPost('/cultures', { name: 'X', conflictResolution: 'shouting' });
  assert.equal(badStyle.status, 400);
  assert.match((await badStyle.json()).error, /is not a conflictResolution/);
});

test('every flow reports its signal, and says when it cannot read one', { skip: SKIP }, async () => {
  const body = await (await get('/flows')).json();

  assert.equal(body.total, body.flows.length);
  assert.ok(body.flows.length >= 10, 'the ten named flows at minimum');
  assert.ok(Array.isArray(body.signals) && body.signals.length > 0);

  for (const flow of body.flows) {
    assert.equal(typeof flow.id, 'string');
    assert.equal(typeof flow.firing, 'boolean');
    assert.equal(typeof flow.readable, 'boolean');
    if (!flow.readable) {
      assert.equal(flow.value, null, 'an unreadable signal reports null, not 0');
      assert.equal(flow.firing, false, 'and cannot be firing');
    }
  }
});

test('a flow added as data over HTTP shows up in the flow list', { skip: SKIP }, async () => {
  const res = await post('/flows', {
    id: 'http-added-flow',
    name: 'HTTP Added Flow',
    signal: 'property.count',
    comparator: 'atLeast',
    threshold: 1,
    severity: 'low',
  });
  assert.equal(res.status, 201);

  const { flows } = await (await get('/flows')).json();
  assert.ok(flows.some((f) => f.id === 'http-added-flow'),
    'declaring a flow over the API is enough to make it run — no deploy');
});

test('a flow naming a signal the engine cannot read is refused', { skip: SKIP }, async () => {
  const res = await openPost('/flows', {
    id: 'bad', name: 'Bad', signal: 'moon.phase', comparator: 'above', threshold: 1,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not a signal this engine reads/);
});
