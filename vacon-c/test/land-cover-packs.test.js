// A real EarthEnv Consensus Land Cover classification, stored directly
// on the city -- the one pack reader in this registry that reports
// neither through a behavioral mechanism nor through statistics.js.
// Read server/landCoverPacks.js's own header before this file for why.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const landCoverPacks = require('../server/landCoverPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    plots: [{ plotId: 'p1', classKey: 'mixed-forest' }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.landCoverPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(landCoverPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(landCoverPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(landCoverPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a plot needs a plotId and one of the twelve real published classes', () => {
  const noId = landCoverPacks.validatePack(pack({ plots: [{ classKey: 'barren' }] }));
  assert.ok(noId.some((p) => p.includes('plotId')));

  const badClass = landCoverPacks.validatePack(pack({ plots: [{ plotId: 'p1', classKey: 'swampy-bog' }] }));
  assert.ok(badClass.some((p) => p.includes('classKey')));
});

test('an empty plots array is refused', () => {
  const problems = landCoverPacks.validatePack(pack({ plots: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('every real published class validates', () => {
  for (const classKey of landCoverPacks.LAND_COVER_CLASSES) {
    assert.deepEqual(landCoverPacks.validatePack(pack({ plots: [{ plotId: 'p1', classKey }] })), []);
  }
});

// ---------------------------------------------------------------------
// plotFor / classFor
// ---------------------------------------------------------------------

test('plotFor cycles by position, and is null with no pack', () => {
  const p = pack({ plots: [{ plotId: 'A', classKey: 'barren' }, { plotId: 'B', classKey: 'urban-and-built-up' }] });
  assert.equal(landCoverPacks.plotFor(p, 0).plotId, 'A');
  assert.equal(landCoverPacks.plotFor(p, 1).plotId, 'B');
  assert.equal(landCoverPacks.plotFor(p, 2).plotId, 'A', 'position 2 should wrap');
  assert.equal(landCoverPacks.plotFor(null, 0), null);
});

test('classFor reads a real class, and null with no plot or an unrecognised class', () => {
  assert.equal(landCoverPacks.classFor({ plotId: 'X', classKey: 'shrubland' }), 'shrubland');
  assert.equal(landCoverPacks.classFor({ plotId: 'X', classKey: 'made-up' }), null);
  assert.equal(landCoverPacks.classFor(null), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real land-cover pack sets city.landCoverClass', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'land-cover-pack-test',
      landCoverPack: pack({ plots: [{ plotId: 'p1', classKey: 'evergreen-needleleaf-forest' }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const city = w.cities[w.cities.length - 1];
    assert.equal(city.landCoverClass, 'evergreen-needleleaf-forest');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-land-cover-pack',
      landCoverPack: { region: 'X', source: 'sample', plots: [{ plotId: 'p1', classKey: 'lava' }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no land-cover pack leaves landCoverClass unset, not an invented default', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-land-cover-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const city = w.cities[w.cities.length - 1];
  assert.equal(city.landCoverClass, undefined);
  cleanup();
});
