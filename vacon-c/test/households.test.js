// Who actually lives together.
//
// **A family is a lineage; a household is an address**, and the engine
// had only the first. `mean_household_size` computed family size and
// called it household size — not a rounding error but a different
// quantity: somebody living alone next door to their brother is one
// family and two households, and a lodger is a household member and no
// relation at all.
//
// Two findings came out of building it, and the second is the one worth
// keeping:
//
//   1. `households` had no store, so the statistic had no choice but
//      to use family membership as a proxy, and said so.
//   2. **Nobody in any generated world had ever lived with anybody.**
//      `worldgen` handed out homes one per person by array index, so
//      every dwelling held exactly one occupant: 40 households of size
//      1, a mean of 1.00 and a solo rate of 100%. That is not a
//      demographic edge case, it is a world where cohabitation does not
//      exist — and no test of the households module alone could have
//      found it, because the module was doing its job perfectly on the
//      input it was given.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const households = require('../server/households.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

let nextId = 400000;

function world(extra = {}) {
  const w = {
    tick: 10, npcs: [], properties: [], communities: [], households: [], ...extra,
  };
  households.reseedIds(w);
  return w;
}

function dwelling(w, communityId = 1) {
  const id = nextId += 1;
  w.properties.push({ id, type: 'residential', community_id: communityId, occupants: [] });
  return id;
}

function person(w, homePropertyId = null) {
  const id = nextId += 1;
  w.npcs.push({ id, status: 'active', home_property_id: homePropertyId });
  return id;
}

// -- what a household is -------------------------------------------------

test('people sharing a dwelling are one household', () => {
  const w = world();
  const home = dwelling(w);
  const a = person(w, home);
  const b = person(w, home);
  const alone = person(w, dwelling(w));

  households.syncHouseholds(w);

  assert.equal(w.households.length, 2);
  assert.equal(households.householdOf(w, a).id, households.householdOf(w, b).id);
  assert.notEqual(households.householdOf(w, alone).id, households.householdOf(w, a).id);
  assert.deepEqual(households.membersOf(w, households.householdOf(w, a).id), [a, b].sort((x, y) => x - y));
});

test('somebody with no home is in no household', () => {
  const w = world();
  const homeless = person(w, null);
  households.syncHouseholds(w);
  assert.equal(w.households.length, 0);
  assert.equal(households.householdOf(w, homeless), null);
  assert.equal(households.describeHousehold(w, homeless), null);
});

test('membership is ordered, so two runs of one world agree', () => {
  // §88. An array that depended on npc order would make the same seed
  // produce a different membership list.
  const w = world();
  const home = dwelling(w);
  const b = person(w, home);
  const a = person(w, home);
  households.syncHouseholds(w);
  assert.deepEqual(w.households[0].member_entity_ids, [b, a].sort((x, y) => x - y));
});

// -- it is kept true, on a crossing --------------------------------------

test('a household is rewritten only when its membership changes', () => {
  // **Standing rule 3 and 7 together.** Rewriting the array every tick
  // would make this a stored rollup in the plain sense, and would stamp
  // `updated_tick` on a household where nothing happened.
  const w = world();
  const home = dwelling(w);
  person(w, home);
  households.syncHouseholds(w, { tick: 5 });

  const row = w.households[0];
  assert.equal(row.formed_tick, 5);
  assert.equal(row.updated_tick, 5);

  for (let t = 6; t < 50; t += 1) households.syncHouseholds(w, { tick: t });
  assert.equal(w.households.length, 1, 'a second household appeared for the same dwelling');
  assert.equal(row.updated_tick, 5, 'a household with no change was stamped as updated');

  person(w, home);
  const changes = households.syncHouseholds(w, { tick: 60 });
  assert.equal(changes.changed.length, 1);
  assert.equal(row.updated_tick, 60);
  assert.equal(row.member_entity_ids.length, 2);
});

test('a household shrinks when somebody dies, without knowing about death', () => {
  // `mortality.recordDeath` moves a dead person out of `worldState.npcs`
  // — iterating the living is what makes this work with no coupling.
  const w = world();
  const home = dwelling(w);
  const a = person(w, home);
  const b = person(w, home);
  households.syncHouseholds(w);
  assert.equal(w.households[0].member_entity_ids.length, 2);

  w.npcs = w.npcs.filter((n) => n.id !== b);
  households.syncHouseholds(w);
  assert.deepEqual(w.households[0].member_entity_ids, [a]);
});

test('an emptied household is kept, not deleted, and excluded from the mean', () => {
  // The household really existed and `formed_tick` is a fact about the
  // world. An empty one counted in the mean would drag it toward zero.
  const w = world();
  const home = dwelling(w);
  person(w, home);
  const other = dwelling(w);
  person(w, other);
  person(w, other);
  households.syncHouseholds(w, { tick: 1 });
  assert.equal(households.meanSizeIn(w), 1.5);

  w.npcs = w.npcs.filter((n) => n.home_property_id !== home);
  const changes = households.syncHouseholds(w, { tick: 2 });

  assert.equal(changes.dissolved.length, 1);
  assert.equal(w.households.length, 2, 'the record of the household was erased');
  assert.deepEqual(w.households[0].member_entity_ids, []);
  assert.equal(households.meanSizeIn(w), 2, 'an empty household dragged the mean down');
});

test('an area with no dwellings has no household size, rather than zero', () => {
  const w = world();
  assert.equal(households.meanSizeIn(w), null);
  assert.equal(households.soloShareIn(w), null);
});

// -- properties.occupants ------------------------------------------------

test('the household is written into properties.occupants, which nothing wrote', () => {
  // `tick.js`'s own header names this gap: "properties exist to move
  // into, but nothing chooses a destination or writes `occupants`".
  const w = world();
  const home = dwelling(w);
  const a = person(w, home);
  const empty = dwelling(w);

  households.syncHouseholds(w);

  assert.deepEqual(w.properties.find((p) => p.id === home).occupants, [a]);
  assert.deepEqual(w.properties.find((p) => p.id === empty).occupants, []);
});

// -- the world ------------------------------------------------------------

test('a generated world has households of more than one size', () => {
  // **The finding this file exists for.** Before `worldgen` let a
  // family share a roof, every household in every world held exactly
  // one person — and the households module was working perfectly on
  // that input, so only a test of the WORLD could see it.
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 20, seed: 'home' });
  for (let t = 0; t < 40; t += 1) engine.advanceTick();

  assert.ok(w.households.length > 0, 'a generated world has no households at all');

  const sizes = w.households
    .map((h) => h.member_entity_ids.length)
    .filter((n) => n > 0);
  assert.ok(new Set(sizes).size > 1,
    `every household in the world holds ${sizes[0]} people — nobody lives with anybody`);
  assert.ok(households.meanSizeIn(w) > 1, 'the mean household is one person');

  const solo = households.soloShareIn(w);
  assert.ok(solo > 0 && solo < 1,
    `${solo} of households are one person — a world of all or nothing`);
});

test('a household member lives where the property says they do', () => {
  const w = engine.WorldState;
  const withHome = w.npcs.find((n) => n.home_property_id != null);
  const described = households.describeHousehold(w, withHome.id);

  assert.equal(described.propertyId, withHome.home_property_id);
  assert.ok(described.members.includes(withHome.id));
  assert.equal(described.size, described.members.length);
  assert.equal(described.livesAlone, described.size === 1);
});

test('the household statistic measures households, not families', () => {
  // The accuracy fix. A world where these two numbers are equal would
  // not prove anything, so this asserts the statistic reads the real
  // grouping rather than the proxy it used to.
  const statistics = require('../server/statistics.js');
  const w = engine.WorldState;
  const profile = statistics.profileFor(w, w.communities[0].id);

  const reported = profile.statistics.mean_household_size.value;
  assert.equal(reported, households.meanSizeIn(w, w.communities[0].id));
  assert.ok(profile.statistics.solo_household_share.known,
    'solo_household_share cannot be answered, which family membership never could');
});

test('ids survive a reseed', () => {
  const w = world();
  w.households.push({ id: 7, property_id: 1, member_entity_ids: [] });
  assert.deepEqual(households.reseedIds(w), { nextHouseholdId: 8 });
});
