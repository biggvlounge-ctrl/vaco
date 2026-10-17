// Real median household income and a real Gini index, imported per
// region — re-centring and re-spreading a home-value band this
// project chose with no document behind it.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const incomePacks = require('../server/incomePacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    tracts: [{ tractId: 'T1', medianHouseholdIncome: 70000, giniIndex: 0.4 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.incomePack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(incomePacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(incomePacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(incomePacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId', () => {
  const problems = incomePacks.validatePack(pack({ tracts: [{ medianHouseholdIncome: 70000 }] }));
  assert.ok(problems.some((p) => p.includes('tractId')));
});

test('a non-positive income is refused', () => {
  const problems = incomePacks.validatePack(pack({ tracts: [{ tractId: 'T1', medianHouseholdIncome: -5 }] }));
  assert.ok(problems.some((p) => p.includes('medianHouseholdIncome')));
});

test('a Gini index outside 0..1 is refused', () => {
  const problems = incomePacks.validatePack(pack({ tracts: [{ tractId: 'T1', giniIndex: 1.4 }] }));
  assert.ok(problems.some((p) => p.includes('giniIndex')));
});

test('an empty tracts array is refused', () => {
  const problems = incomePacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// tractFor / valueRangeFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({ tracts: [{ tractId: 'A' }, { tractId: 'B' }] });
  assert.equal(incomePacks.tractFor(p, 0).tractId, 'A');
  assert.equal(incomePacks.tractFor(p, 1).tractId, 'B');
  assert.equal(incomePacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(incomePacks.tractFor(null, 0), null);
});

test('valueRangeFor at the ordinary reference income and Gini reproduces the invented band exactly', () => {
  const [low, high] = incomePacks.valueRangeFor({
    tractId: 'T1', medianHouseholdIncome: incomePacks.ORDINARY_MEDIAN_INCOME, giniIndex: incomePacks.ORDINARY_GINI,
  });
  assert.deepEqual([low, high], incomePacks.INVENTED_VALUE_RANGE);
});

test('a real income above the ordinary reference raises both ends of the range', () => {
  const [low, high] = incomePacks.valueRangeFor({
    tractId: 'T1', medianHouseholdIncome: incomePacks.ORDINARY_MEDIAN_INCOME * 2, giniIndex: incomePacks.ORDINARY_GINI,
  });
  const [investedLow, investedHigh] = incomePacks.INVENTED_VALUE_RANGE;
  assert.ok(low > investedLow);
  assert.ok(high > investedHigh);
});

test('valueRangeFor is null with no tract and no real figure', () => {
  assert.equal(incomePacks.valueRangeFor(null), null);
  assert.equal(incomePacks.valueRangeFor({ tractId: 'T1' }), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real high-income tract draws homes from a higher-value range', () => {
  const w = engine.WorldState;
  const before = w.properties.length;
  try {
    worldgen.generateWorld({
      seed: 'income-pack-test',
      incomePack: pack({ tracts: [{ tractId: 'T1', medianHouseholdIncome: 140000, giniIndex: 0.5 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 5,
    });
    const made = w.properties.slice(before).filter((p) => p.type === 'residential');
    assert.ok(made.length > 0);
    const [investedLow] = incomePacks.INVENTED_VALUE_RANGE;
    assert.ok(made.every((h) => h.value > investedLow),
      'every home should be drawn from the real, higher-centred range');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-income-pack',
      incomePack: { region: 'X', source: 'sample', tracts: [{ tractId: 'Y', giniIndex: 5 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no income pack still builds homes in the invented range', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.properties.length;
  worldgen.generateWorld({ seed: 'no-income-pack', communitiesPerCity: 1, populationPerCommunity: 5 });
  const made = w.properties.slice(before).filter((p) => p.type === 'residential');
  const [investedLow, investedHigh] = incomePacks.INVENTED_VALUE_RANGE;
  assert.ok(made.every((h) => h.value >= investedLow && h.value <= investedHigh));
  cleanup();
});
