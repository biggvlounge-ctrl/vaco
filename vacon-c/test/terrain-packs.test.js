// A real USGS 3DEP terrain classification, re-centring and re-
// spreading construction.js's invented residential construction-cost
// band. Read server/terrainPacks.js's own header before this file for
// why that band, specifically, is the one terrain was asked to feed.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const terrainPacks = require('../server/terrainPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    plots: [{ plotId: 'p1', terrain: 'hilly' }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.terrainPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(terrainPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(terrainPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(terrainPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a plot needs a plotId and one of the four real published terrain classes', () => {
  const noId = terrainPacks.validatePack(pack({ plots: [{ terrain: 'flat' }] }));
  assert.ok(noId.some((p) => p.includes('plotId')));

  const badClass = terrainPacks.validatePack(pack({ plots: [{ plotId: 'p1', terrain: 'swampy' }] }));
  assert.ok(badClass.some((p) => p.includes('terrain')));
});

test('an empty plots array is refused', () => {
  const problems = terrainPacks.validatePack(pack({ plots: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('every real published class validates', () => {
  for (const terrain of terrainPacks.TERRAIN_CLASSES) {
    assert.deepEqual(terrainPacks.validatePack(pack({ plots: [{ plotId: 'p1', terrain }] })), []);
  }
});

// ---------------------------------------------------------------------
// plotFor / classFor
// ---------------------------------------------------------------------

test('plotFor cycles by position, and is null with no pack', () => {
  const p = pack({ plots: [{ plotId: 'A', terrain: 'flat' }, { plotId: 'B', terrain: 'mountainous' }] });
  assert.equal(terrainPacks.plotFor(p, 0).plotId, 'A');
  assert.equal(terrainPacks.plotFor(p, 1).plotId, 'B');
  assert.equal(terrainPacks.plotFor(p, 2).plotId, 'A', 'position 2 should wrap');
  assert.equal(terrainPacks.plotFor(null, 0), null);
});

test('classFor reads a real class, and null with no plot or an unrecognised class', () => {
  assert.equal(terrainPacks.classFor({ plotId: 'X', terrain: 'rolling' }), 'rolling');
  assert.equal(terrainPacks.classFor({ plotId: 'X', terrain: 'made-up' }), null);
  assert.equal(terrainPacks.classFor(null), null);
});

// ---------------------------------------------------------------------
// constructionCostMultiplierFor
// ---------------------------------------------------------------------

test('constructionCostMultiplierFor is 1 (no change) for a null or unrecognised class', () => {
  assert.equal(terrainPacks.constructionCostMultiplierFor(null), 1);
  assert.equal(terrainPacks.constructionCostMultiplierFor('made-up'), 1);
});

test('constructionCostMultiplierFor is 1 for flat and rises with every steeper class', () => {
  assert.equal(terrainPacks.constructionCostMultiplierFor('flat'), 1);
  const rolling = terrainPacks.constructionCostMultiplierFor('rolling');
  const hilly = terrainPacks.constructionCostMultiplierFor('hilly');
  const mountainous = terrainPacks.constructionCostMultiplierFor('mountainous');
  assert.ok(rolling > 1 && hilly > rolling && mountainous > hilly,
    'construction cost should rise monotonically with terrain ruggedness');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real terrain pack sets city.terrainClass', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'terrain-pack-test',
      terrainPack: pack({ plots: [{ plotId: 'p1', terrain: 'mountainous' }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const city = w.cities[w.cities.length - 1];
    assert.equal(city.terrainClass, 'mountainous');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-terrain-pack',
      terrainPack: { region: 'X', source: 'sample', plots: [{ plotId: 'p1', terrain: 'volcanic' }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no terrain pack leaves terrainClass unset, not an invented default', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-terrain-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const city = w.cities[w.cities.length - 1];
  assert.equal(city.terrainClass, undefined);
  cleanup();
});
