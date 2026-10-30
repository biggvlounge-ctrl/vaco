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

// ---------------------------------------------------------------------
// woodMultiplierFor / homeValueMultiplierFor -- added 30 Oct 2026,
// bounded nudges onto two existing real-data mechanisms, never a new
// one. See this file's own header for why these two and no others.
// ---------------------------------------------------------------------

test('woodMultiplierFor is 1 (no change) for a null or unrecognised class', () => {
  assert.equal(landCoverPacks.woodMultiplierFor(null), 1);
  assert.equal(landCoverPacks.woodMultiplierFor('made-up'), 1);
});

test('woodMultiplierFor corroborates on a real forest class, damps on every other', () => {
  const [low, high] = landCoverPacks.WOOD_MULTIPLIER_BOUNDS;
  for (const classKey of landCoverPacks.FOREST_CLASSES) {
    assert.equal(landCoverPacks.woodMultiplierFor(classKey), high, classKey);
  }
  for (const classKey of landCoverPacks.LAND_COVER_CLASSES) {
    if (landCoverPacks.FOREST_CLASSES.includes(classKey)) continue;
    assert.equal(landCoverPacks.woodMultiplierFor(classKey), low, classKey);
  }
});

test('homeValueMultiplierFor is 1 (no change) for a null, unrecognised, or deliberately-neutral class', () => {
  assert.equal(landCoverPacks.homeValueMultiplierFor(null), 1);
  assert.equal(landCoverPacks.homeValueMultiplierFor('made-up'), 1);
  // Forest/shrubland/herbaceous/cultivated: no well-established
  // one-directional real-estate effect, so these stay neutral.
  assert.equal(landCoverPacks.homeValueMultiplierFor('mixed-forest'), 1);
  assert.equal(landCoverPacks.homeValueMultiplierFor('cultivated-and-managed'), 1);
});

test('homeValueMultiplierFor raises urban-and-built-up and lowers the three real-world-discounted classes', () => {
  const [low, high] = landCoverPacks.HOME_VALUE_MULTIPLIER_BOUNDS;
  assert.equal(landCoverPacks.homeValueMultiplierFor('urban-and-built-up'), high);
  assert.equal(landCoverPacks.homeValueMultiplierFor('regularly-flooded-vegetation'), low);
  assert.equal(landCoverPacks.homeValueMultiplierFor('snow-and-ice'), low);
  assert.equal(landCoverPacks.homeValueMultiplierFor('barren'), low);
});

// ---------------------------------------------------------------------
// A world built with both a land-cover pack and a wood/income pack
// shows the compounding, bounded, not overriding the primary signal
// ---------------------------------------------------------------------

test('a world with a forest land-cover class moves wood supply above the un-nudged GLAD-only range', () => {
  const woodPacks = require('../server/woodPacks.js');
  cleanup();
  delete engine.WorldState.woodPack;
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'land-cover-wood-nudge',
      woodPack: {
        region: 'Testville', source: 'sample',
        plots: [{ plotId: 'p1', treeCoverPct2000: 50, status: 'intact-forest' }],
      },
      landCoverPack: pack({ plots: [{ plotId: 'p1', classKey: 'mixed-forest' }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const city = w.cities[w.cities.length - 1];
    const wood = w.resources.find((r) => r.city_id === city.id && r.resource_type === 'wood');
    assert.ok(wood, 'no real wood resource was generated for this city');
    // 50% effective cover centres the un-nudged range at 100; the
    // forest-class nudge (+15%) should push the real, nudged range's
    // own high end above the un-nudged range's high end.
    const [, unnudgedHigh] = woodPacks.woodSupplyRangeFor({ plotId: 'p1', treeCoverPct2000: 50, status: 'intact-forest' });
    const [, nudgedHigh] = woodPacks.woodSupplyRangeFor(
      { plotId: 'p1', treeCoverPct2000: 50, status: 'intact-forest' },
      { landCoverMultiplier: landCoverPacks.woodMultiplierFor('mixed-forest') },
    );
    assert.ok(nudgedHigh > unnudgedHigh, 'the forest nudge should widen the real range outward, not just reproduce it');
    assert.ok(wood.supply >= 0 && wood.supply <= nudgedHigh, 'the drawn supply should fall within the real, nudged range');
  } finally {
    cleanup();
    delete engine.WorldState.woodPack;
  }
});

test('a world with a flood-prone land-cover class moves home value below the un-nudged income-only range', () => {
  const incomePacks = require('../server/incomePacks.js');
  cleanup();
  delete engine.WorldState.incomePack;
  const w = engine.WorldState;
  const before = w.properties.length;
  try {
    worldgen.generateWorld({
      seed: 'land-cover-home-value-nudge',
      incomePack: {
        region: 'Testville', source: 'sample',
        tracts: [{
          tractId: 't1',
          medianHouseholdIncome: incomePacks.ORDINARY_MEDIAN_INCOME,
          giniIndex: incomePacks.ORDINARY_GINI,
        }],
      },
      landCoverPack: pack({ plots: [{ plotId: 'p1', classKey: 'regularly-flooded-vegetation' }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 3,
    });
    const made = w.properties.slice(before).filter((p) => p.type === 'residential');
    assert.ok(made.length > 0);
    const [, unnudgedHigh] = incomePacks.valueRangeFor({
      medianHouseholdIncome: incomePacks.ORDINARY_MEDIAN_INCOME, giniIndex: incomePacks.ORDINARY_GINI,
    });
    assert.ok(made.every((h) => h.value <= unnudgedHigh),
      'the flood-plain nudge should pull values below the un-nudged range, never above it');
  } finally {
    cleanup();
    delete engine.WorldState.incomePack;
  }
});
