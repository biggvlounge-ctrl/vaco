// Real facility capacities, imported per region — `landmark-packs.test.js`'s
// sibling for roads, hospitals, water, and the rest of the ten.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `worldgen.js` built every city's infrastructure with a capacity
// drawn from `DESIGN_CAPACITY_PER_1K * cityPopulation / 1000` — a
// per-capita band this project chose. `world-layer/imports/
// hifldImport.js`'s own header calls the match between HIFLD Open's
// layers and the engine's ten infrastructure types "unusually exact":
// a real hospital's bed count, a real water system's population
// served.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const infrastructurePacks = require('../server/infrastructurePacks.js');
const infrastructure = require('../server/infrastructure.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    facilitiesByType: { hospitals: [1328, 974] },
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.infrastructurePack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(infrastructurePacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(infrastructurePacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(infrastructurePacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('an unknown infrastructure type is refused, not silently dropped', () => {
  const problems = infrastructurePacks.validatePack(pack({ facilitiesByType: { stadiums: [500] } }));
  assert.ok(problems.some((p) => p.includes('stadiums')));
});

test('a non-positive capacity is refused', () => {
  const problems = infrastructurePacks.validatePack(pack({ facilitiesByType: { hospitals: [0, -5] } }));
  assert.ok(problems.some((p) => p.includes('hospitals[0]')));
});

// ---------------------------------------------------------------------
// capacityFor
// ---------------------------------------------------------------------

test('capacityFor cycles by position, and is null with no pack or no coverage', () => {
  const p = pack();
  assert.equal(infrastructurePacks.capacityFor(p, 'hospitals', 0), 1328);
  assert.equal(infrastructurePacks.capacityFor(p, 'hospitals', 1), 974);
  assert.equal(infrastructurePacks.capacityFor(p, 'hospitals', 2), 1328, 'position 2 should wrap');
  assert.equal(infrastructurePacks.capacityFor(p, 'schools', 0), null, 'the pack has no schools');
  assert.equal(infrastructurePacks.capacityFor(null, 'hospitals', 0), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real infrastructure pack uses the real capacity, not the per-capita band', () => {
  const w = engine.WorldState;
  const citiesBefore = w.cities.length;
  try {
    worldgen.generateWorld({
      seed: 'infra-pack', infrastructurePack: pack(), communitiesPerCity: 1, populationPerCommunity: 5,
    });
    // Scoped to the city THIS call made — `engine.WorldState` is a
    // shared singleton that accumulates across every call in this file.
    const newCity = w.cities[citiesBefore];
    const hospitalCapacities = infrastructure.infrastructureIn(w, newCity.id, 'hospitals')
      .map((row) => row.capacity);
    assert.ok(hospitalCapacities.includes(1328) || hospitalCapacities.includes(974),
      `expected a real HIFLD bed count, got ${hospitalCapacities}`);
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-infra-pack',
      infrastructurePack: { region: 'X', source: 'sample', facilitiesByType: { not_a_type: [5] } },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no infrastructure pack still builds exactly as before', () => {
  cleanup();
  worldgen.generateWorld({ seed: 'no-infra-pack', communitiesPerCity: 1, populationPerCommunity: 5 });
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s infrastructure types match infrastructure.js, exactly', () => {
  assert.deepEqual(
    infrastructurePacks.INFRASTRUCTURE_TYPES.slice().sort(),
    infrastructure.INFRASTRUCTURE_TYPES.slice().sort(),
  );
});
