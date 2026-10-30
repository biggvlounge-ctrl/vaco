// §7 system 30, Construction — a first mover for a lifecycle that
// already runs. See server/construction.js's header for the full
// reasoning: `property.ACQUIRED_METHODS` has named `built` since the
// Property Engine shipped, with no caller anywhere.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const construction = require('../server/construction.js');
const property = require('../server/property.js');
const economy = require('../server/economy.js');
const { seededDraw } = require('../server/seeded.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function world({ tick = 1000, seed = 'build-test' } = {}) {
  const w = {
    tick,
    seed,
    npcs: [],
    properties: [],
    ownershipRecords: [],
    individualFinances: [],
    communities: [{ id: 1, city_id: 10 }],
    nextEntityId: 9000,
  };
  economy.reseedIds(w);
  return w;
}

function person(w, { id, savings = 0, createdTick = 0, communityId = 1, status = 'active' } = {}) {
  w.npcs.push({ id, status, createdTick, communityId });
  economy.generateIndividualFinances(w, id, { savings, tick: w.tick });
  return w.npcs[w.npcs.length - 1];
}

const WORKING_AGE_CREATED_TICK = -(economy.WORKING_AGE + 5) * 365;

// ---------------------------------------------------------------------
// constructResidentialProperty
// ---------------------------------------------------------------------

test('building a home moves real money out of savings and records real ownership', () => {
  const w = world();
  person(w, { id: 1, savings: 100000, createdTick: WORKING_AGE_CREATED_TICK });

  const built = construction.constructResidentialProperty(w, {
    builderId: 1, communityId: 1, cityId: 10, tick: w.tick,
  });

  assert.equal(built.type, 'residential');
  assert.equal(built.lifecycle_stage, 'planning');
  assert.ok(built.value >= construction.RESIDENTIAL_COST_MIN
    && built.value <= construction.RESIDENTIAL_COST_MAX,
    'cost should fall in the same range worldgen draws a residential value from');

  const savingsLeft = economy.getLatestFinances(w, 1).savings;
  assert.equal(savingsLeft, 100000 - built.value);

  const owner = property.getCurrentOwner(w, built.id);
  assert.equal(owner.owner_entity_id, 1);
  assert.equal(owner.owner_type, 'individual');
  assert.equal(owner.acquired_method, 'built', 'built, not purchased — nobody sold it to them');
});

test('building is refused without enough savings to cover the drawn cost', () => {
  const w = world();
  person(w, { id: 1, savings: 1, createdTick: WORKING_AGE_CREATED_TICK });

  assert.throws(
    () => construction.constructResidentialProperty(w, { builderId: 1, communityId: 1, tick: w.tick }),
    /has 1 savings, needs/,
  );
  assert.equal(w.properties.length, 0, 'a refused build leaves no half-built row behind');
});

test('costFor is deterministic and reused rather than redrawn at construction time', () => {
  const w = world();
  person(w, { id: 1, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });
  const expected = construction.costFor(w.seed, w.tick, 1);
  const built = construction.constructResidentialProperty(w, { builderId: 1, communityId: 1, tick: w.tick });
  assert.equal(built.value, expected);
});

// ---------------------------------------------------------------------
// terrainCostMultiplierFor / real terrain re-centring the cost band
// ---------------------------------------------------------------------

test('terrainCostMultiplierFor is 1 (no change) with no cities, no terrainClass, or an unknown community', () => {
  const w = world();
  assert.equal(construction.terrainCostMultiplierFor(w, 1), 1, 'no w.cities at all');
  w.cities = [{ id: 10 }];
  assert.equal(construction.terrainCostMultiplierFor(w, 1), 1, 'city has no real terrainClass');
  assert.equal(construction.terrainCostMultiplierFor(w, 999), 1, 'no such community');
});

test('terrainCostMultiplierFor reads the real terrainClass of the community\'s own city', () => {
  const w = world();
  w.cities = [{ id: 10, terrainClass: 'mountainous' }];
  const multiplier = construction.terrainCostMultiplierFor(w, 1);
  assert.ok(multiplier > 1, 'mountainous terrain should raise construction cost');
});

test('costFor with a real terrain multiplier scales the drawn cost, never invents a second number', () => {
  const w = world();
  w.cities = [{ id: 10, terrainClass: 'mountainous' }];
  const flat = construction.costFor(w.seed, w.tick, 1);
  const multiplier = construction.terrainCostMultiplierFor(w, 1);
  const nudged = construction.costFor(w.seed, w.tick, 1, { costMultiplier: multiplier });
  assert.ok(nudged > flat, 'mountainous terrain should cost more than the flat-band draw');
  // Scaling both ends of the same band, not a second invented range.
  assert.ok(nudged <= construction.RESIDENTIAL_COST_MAX * multiplier);
});

test('a home built on mountainous terrain costs more than the identical build on flat terrain', () => {
  const flatWorld = world();
  flatWorld.cities = [{ id: 10, terrainClass: 'flat' }];
  person(flatWorld, { id: 1, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });
  const flatBuilt = construction.constructResidentialProperty(flatWorld, {
    builderId: 1, communityId: 1, cityId: 10, tick: flatWorld.tick,
  });

  const mountainWorld = world();
  mountainWorld.cities = [{ id: 10, terrainClass: 'mountainous' }];
  person(mountainWorld, { id: 1, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });
  const mountainBuilt = construction.constructResidentialProperty(mountainWorld, {
    builderId: 1, communityId: 1, cityId: 10, tick: mountainWorld.tick,
  });

  assert.ok(mountainBuilt.value > flatBuilt.value,
    'the same draw should cost more on real mountainous terrain than on real flat terrain');
});

test('the pre-filter and the actual build charge the same real terrain-adjusted cost', () => {
  const seed = 'construct-hit-terrain';
  const tick = 2000;
  const w = world({ tick, seed });
  w.cities = [{ id: 10, terrainClass: 'mountainous' }];
  const id = findId(seed, tick, construction.BUILD_CHANCE_PER_TICK, true);
  const multiplier = construction.terrainCostMultiplierFor(w, 1);
  const realCost = construction.costFor(seed, tick, id, { costMultiplier: multiplier });
  // Just enough for the real terrain-adjusted cost, not enough for a
  // second, unadjusted draw of it — if the filter and the build ever
  // disagreed on the multiplier, one of these two assertions would.
  person(w, { id, savings: realCost, createdTick: WORKING_AGE_CREATED_TICK });

  const result = construction.runConstruction(w, tick);
  assert.equal(result.built, 1, 'exactly enough savings for the real terrain-adjusted cost should still build');
  assert.equal(w.properties[0].value, realCost);
});

// ---------------------------------------------------------------------
// runConstruction — the seeded gate, pinned exactly (standing rule 26)
// ---------------------------------------------------------------------

function findId(seed, tick, chance, wantBelow) {
  for (let id = 1; id < 200000; id += 1) {
    const draw = seededDraw([seed, 'construct', tick, id]);
    if (wantBelow ? draw < chance : draw >= chance) return id;
  }
  throw new Error('no id found in range');
}

test('a candidate whose draw clears the build chance actually builds', () => {
  const seed = 'construct-hit';
  const tick = 2000;
  const w = world({ tick, seed });
  const id = findId(seed, tick, construction.BUILD_CHANCE_PER_TICK, true);
  person(w, { id, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });

  const result = construction.runConstruction(w, tick);
  assert.equal(result.built, 1);
  assert.equal(w.properties.length, 1);
  assert.equal(property.getCurrentOwner(w, w.properties[0].id).owner_entity_id, id);
});

test('a candidate whose draw misses the build chance builds nothing, however rich', () => {
  const seed = 'construct-miss';
  const tick = 2000;
  const w = world({ tick, seed });
  const id = findId(seed, tick, construction.BUILD_CHANCE_PER_TICK, false);
  person(w, { id, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });

  const result = construction.runConstruction(w, tick);
  assert.equal(result.built, 0);
  assert.equal(w.properties.length, 0);
});

test('somebody who already owns a property is not a candidate at all', () => {
  const seed = 'construct-hit';
  const tick = 2000;
  const w = world({ tick, seed });
  const id = findId(seed, tick, construction.BUILD_CHANCE_PER_TICK, true);
  person(w, { id, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });

  // Already owns somewhere.
  const existing = property.generateProperty(w, { type: 'residential', value: 5000 });
  property.recordOwnership(w, {
    entityId: existing.id, ownerEntityId: id, ownerType: 'individual', acquiredMethod: 'purchased', tick: w.tick,
  });

  const result = construction.runConstruction(w, tick);
  assert.equal(result.built, 0, 'a homeowner building a second home is not this mechanism');
});

test('runConstruction is a no-op in a world with nobody eligible', () => {
  const w = world();
  const result = construction.runConstruction(w, w.tick);
  assert.deepEqual(result, { events: [], built: 0 });
});

// ---------------------------------------------------------------------
// On a real generated world — the sixteenth standing rule
// ---------------------------------------------------------------------

test('a generated world actually builds new homes over real ticks', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'construction-integration' });

  const before = w.properties.length;
  const TICKS = 300;
  for (let t = 0; t < TICKS; t += 1) engine.advanceTick();

  const built = w.properties.filter((p) => {
    const owner = property.getCurrentOwner(w, p.id);
    return owner && owner.acquired_method === 'built';
  });
  assert.ok(built.length > 0,
    'BUILD_CHANCE_PER_TICK should have produced at least one built home over 300 ticks '
    + 'in a populated world — if this fails, the rate needs remeasuring, not re-asserting');
  assert.ok(w.properties.length > before, 'the housing stock actually grew');

  for (const p of built) {
    assert.ok(['planning', 'construction', 'operation', 'maintenance', 'renovation',
      'expansion', 'historical_legacy'].includes(p.lifecycle_stage));
  }
});
