// A real VIIRS nighttime-light reading, compounding into
// incomePacks.valueRangeFor's own centre -- the same shape
// populationPacks.overdoseBaselineFor already takes compounding with
// healthBaseline in mortality.diseasePressure. Read
// server/nightLightsPacks.js's own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const nightLightsPacks = require('../server/nightLightsPacks.js');
const incomePacks = require('../server/incomePacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    plots: [{ plotId: 'p1', radianceNanoWattsPerCm2Sr: 5 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.nightLightsPack;
  delete engine.WorldState.incomePack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(nightLightsPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(nightLightsPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(nightLightsPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a plot needs a plotId and a real, finite radiance', () => {
  const noId = nightLightsPacks.validatePack(pack({ plots: [{ radianceNanoWattsPerCm2Sr: 5 }] }));
  assert.ok(noId.some((p) => p.includes('plotId')));

  const noRadiance = nightLightsPacks.validatePack(pack({ plots: [{ plotId: 'p1' }] }));
  assert.ok(noRadiance.some((p) => p.includes('radianceNanoWattsPerCm2Sr')));
});

test('a real small negative composite reading validates -- VIIRS composites can read below zero', () => {
  assert.deepEqual(nightLightsPacks.validatePack(pack({ plots: [{ plotId: 'p1', radianceNanoWattsPerCm2Sr: -0.08 }] })), []);
});

test('an empty plots array is refused', () => {
  const problems = nightLightsPacks.validatePack(pack({ plots: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// plotFor / activityMultiplierFor
// ---------------------------------------------------------------------

test('plotFor cycles by position, and is null with no pack', () => {
  const p = pack({ plots: [{ plotId: 'A', radianceNanoWattsPerCm2Sr: 1 }, { plotId: 'B', radianceNanoWattsPerCm2Sr: 20 }] });
  assert.equal(nightLightsPacks.plotFor(p, 0).plotId, 'A');
  assert.equal(nightLightsPacks.plotFor(p, 1).plotId, 'B');
  assert.equal(nightLightsPacks.plotFor(p, 2).plotId, 'A', 'position 2 should wrap');
  assert.equal(nightLightsPacks.plotFor(null, 0), null);
});

test('activityMultiplierFor is 1 (no change) with no real reading', () => {
  assert.equal(nightLightsPacks.activityMultiplierFor(null), 1);
  assert.equal(nightLightsPacks.activityMultiplierFor({ plotId: 'X' }), 1);
});

test('activityMultiplierFor reproduces 1 at the ordinary reference radiance', () => {
  assert.equal(
    nightLightsPacks.activityMultiplierFor({ radianceNanoWattsPerCm2Sr: nightLightsPacks.ORDINARY_RADIANCE_NW_PER_CM2_SR }),
    1,
  );
});

test('activityMultiplierFor is bounded, never dominating the signal it compounds with', () => {
  const [low, high] = nightLightsPacks.ACTIVITY_MULTIPLIER_BOUNDS;
  assert.equal(nightLightsPacks.activityMultiplierFor({ radianceNanoWattsPerCm2Sr: 0.001 }), low);
  assert.equal(nightLightsPacks.activityMultiplierFor({ radianceNanoWattsPerCm2Sr: 100000 }), high);
});

// ---------------------------------------------------------------------
// Compounding into incomePacks.valueRangeFor
// ---------------------------------------------------------------------

test('valueRangeFor with no activityMultiplier behaves exactly as before (backward compatible)', () => {
  const tract = { tractId: 'T1', medianHouseholdIncome: 70000, giniIndex: 0.4 };
  assert.deepEqual(incomePacks.valueRangeFor(tract), incomePacks.valueRangeFor(tract, { activityMultiplier: 1 }));
});

test('a bright real reading raises the real income-based centre; a dark one lowers it', () => {
  const tract = { tractId: 'T1', medianHouseholdIncome: 70000, giniIndex: 0.4 };
  const base = incomePacks.valueRangeFor(tract);
  const bright = incomePacks.valueRangeFor(tract, { activityMultiplier: 2 });
  const dark = incomePacks.valueRangeFor(tract, { activityMultiplier: 0.5 });
  assert.ok(bright[0] > base[0] && bright[1] > base[1]);
  assert.ok(dark[0] < base[0] && dark[1] < base[1]);
});

test('an activityMultiplier alone -- no income or gini tract -- still produces a real range', () => {
  // The same "compounds regardless of the other baseline" shape
  // mortality.diseasePressure already takes for overdoseBaseline.
  assert.equal(incomePacks.valueRangeFor(null), null);
  const range = incomePacks.valueRangeFor(null, { activityMultiplier: 1.5 });
  assert.ok(Array.isArray(range));
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real night-lights pack scales the real home-value range', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'night-lights-pack-test',
      incomePack: { region: 'T', source: 'sample', tracts: [{ tractId: 'T1', medianHouseholdIncome: 70000, giniIndex: 0.4 }] },
      nightLightsPack: pack({ plots: [{ plotId: 'p1', radianceNanoWattsPerCm2Sr: 10 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const city = w.cities[w.cities.length - 1];
    const community = w.communities.find((c) => c.city_id === city.id);
    const homes = w.properties.filter((p) => p.community_id === community.id && p.type === 'residential');
    assert.ok(homes.length > 0);
    // radiance 10 vs ordinary 5 -> multiplier 2 -> every home value
    // should sit at or above the un-multiplied income-only range.
    const incomeOnlyRange = incomePacks.valueRangeFor({ tractId: 'T1', medianHouseholdIncome: 70000, giniIndex: 0.4 });
    for (const home of homes) {
      assert.ok(home.value >= incomeOnlyRange[0]);
    }
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-night-lights-pack',
      nightLightsPack: { region: 'X', source: 'sample', plots: [{ plotId: 'p1' }] },
    }),
    /not usable/,
  );
  cleanup();
});
