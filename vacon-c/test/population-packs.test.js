// Real demographic shapes, imported per region — `landmark-packs.test.js`'s
// sibling for age and educational attainment.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `worldgen.js` drew age from a fixed exponent curve and adult
// attainment from a fixed threshold ladder, identical in every
// community in every city — which works against `areaStats.js`,
// whose whole purpose is to make neighbourhoods differ.
// `world-layer/imports/censusImport.js` already turns real U.S.
// Census Bureau (ACS) tract data into exactly the shapes this file
// needs, at the one grain that matches a generated community.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const populationPacks = require('../server/populationPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    tracts: [{
      tractId: 'T1',
      ageBands: { child: 0.1, working: 0.6, elder: 0.3 },
      attainment: {
        none: 0, basic: 0, secondary: 0, vocational: 0, higher: 1, advanced: 0,
      },
    }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.populationPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(populationPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(populationPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(populationPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId — an unattributed statistic cannot be checked', () => {
  const problems = populationPacks.validatePack(pack({ tracts: [{ ageBands: { child: 1 } }] }));
  assert.ok(problems.some((p) => p.includes('tractId')));
});

test('shares outside 0..1 are refused, not clamped silently', () => {
  const problems = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', ageBands: { child: 1.4, working: 0, elder: 0 } }],
  }));
  assert.ok(problems.some((p) => p.includes('ageBands')));
});

// ---------------------------------------------------------------------
// healthBaseline — CDC PLACES, the multiplicative mortality floor
// ---------------------------------------------------------------------

test('a healthBaseline outside [0.75, 1.5] is refused, not clamped silently', () => {
  const tooHigh = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', healthBaseline: 2.1 }],
  }));
  assert.ok(tooHigh.some((p) => p.includes('healthBaseline')));
  const tooLow = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', healthBaseline: 0.1 }],
  }));
  assert.ok(tooLow.some((p) => p.includes('healthBaseline')));
});

test('a healthBaseline inside the bound validates, and a tract with none at all still does', () => {
  assert.deepEqual(populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', healthBaseline: 1.2 }],
  })), []);
  assert.deepEqual(populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1' }],
  })), []);
});

test('healthBaselineFor reads a real number, and null with no value or no tract', () => {
  assert.equal(populationPacks.healthBaselineFor({ tractId: 'T1', healthBaseline: 1.3 }), 1.3);
  assert.equal(populationPacks.healthBaselineFor({ tractId: 'T1' }), null);
  assert.equal(populationPacks.healthBaselineFor(null), null);
});

// ---------------------------------------------------------------------
// overdoseBaseline — CDC/NCHS, the second real mortality multiplier
// ---------------------------------------------------------------------

test('an overdoseBaseline outside [0.75, 1.75] is refused, not clamped silently', () => {
  const tooHigh = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', overdoseBaseline: 2.1 }],
  }));
  assert.ok(tooHigh.some((p) => p.includes('overdoseBaseline')));
  const tooLow = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', overdoseBaseline: 0.1 }],
  }));
  assert.ok(tooLow.some((p) => p.includes('overdoseBaseline')));
});

test('an overdoseBaseline inside the bound validates alongside a healthBaseline', () => {
  assert.deepEqual(populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', healthBaseline: 1.1, overdoseBaseline: 1.4 }],
  })), []);
});

test('overdoseBaselineFor reads a real number, independently of healthBaselineFor', () => {
  const tract = { tractId: 'T1', healthBaseline: 1.1, overdoseBaseline: 1.4 };
  assert.equal(populationPacks.overdoseBaselineFor(tract), 1.4);
  assert.equal(populationPacks.healthBaselineFor(tract), 1.1);
  assert.equal(populationPacks.overdoseBaselineFor({ tractId: 'T1' }), null);
  assert.equal(populationPacks.overdoseBaselineFor(null), null);
});

// ---------------------------------------------------------------------
// homelessnessRate — HUD Point-in-Time, the opposite condition
// `homesPerResident`'s invented margin can never express on its own
// ---------------------------------------------------------------------

test('a homelessnessRate outside [0, 0.05] is refused, not clamped silently', () => {
  const tooHigh = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', homelessnessRate: 0.09 }],
  }));
  assert.ok(tooHigh.some((p) => p.includes('homelessnessRate')));
  const negative = populationPacks.validatePack(pack({
    tracts: [{ tractId: 'T1', homelessnessRate: -0.01 }],
  }));
  assert.ok(negative.some((p) => p.includes('homelessnessRate')));
});

test('a homelessnessRate inside the bound validates alongside health and overdose baselines', () => {
  assert.deepEqual(populationPacks.validatePack(pack({
    tracts: [{
      tractId: 'T1', healthBaseline: 1.1, overdoseBaseline: 1.4, homelessnessRate: 0.012,
    }],
  })), []);
});

test('homelessnessRateFor reads a real rate, including a real zero, and null with no tract or value', () => {
  assert.equal(populationPacks.homelessnessRateFor({ tractId: 'T1', homelessnessRate: 0.012 }), 0.012);
  assert.equal(populationPacks.homelessnessRateFor({ tractId: 'T1', homelessnessRate: 0 }), 0);
  assert.equal(populationPacks.homelessnessRateFor({ tractId: 'T1' }), null);
  assert.equal(populationPacks.homelessnessRateFor(null), null);
});

test('a world built with a real homelessness rate draws homeCount below the invented margin', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'homelessness-pack-test',
      populationPack: pack({
        tracts: [{ tractId: 'T1', homelessnessRate: 0.04 }],
      }),
      communitiesPerCity: 1,
      populationPerCommunity: 100,
    });
    const community = w.communities[w.communities.length - 1];
    const homesPerResident = 1 - 0.04;
    const expectedHomeCount = Math.round(100 * homesPerResident);
    const homesInCommunity = w.properties.filter(
      (p) => p.type === 'residential' && p.community_id === community.id,
    );
    assert.equal(homesInCommunity.length, expectedHomeCount);
    assert.ok(expectedHomeCount < Math.round(100 * 1.15),
      'a real homelessness rate should produce fewer homes than the invented 1.15 margin');
  } finally {
    cleanup();
  }
});

test('a bad homelessnessRate is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-homelessness-pack',
      populationPack: { region: 'X', source: 'sample', tracts: [{ tractId: 'Y', homelessnessRate: 0.5 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no homelessness data still builds homeCount from the invented 1.15 margin', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-homelessness-pack', communitiesPerCity: 1, populationPerCommunity: 100 });
  const community = w.communities[w.communities.length - 1];
  const homesInCommunity = w.properties.filter(
    (p) => p.type === 'residential' && p.community_id === community.id,
  );
  assert.equal(homesInCommunity.length, Math.round(100 * 1.15));
  cleanup();
});

// ---------------------------------------------------------------------
// tractFor, ageBandFor, attainmentFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({ tracts: [{ tractId: 'A' }, { tractId: 'B' }, { tractId: 'C' }] });
  assert.equal(populationPacks.tractFor(p, 0).tractId, 'A');
  assert.equal(populationPacks.tractFor(p, 1).tractId, 'B');
  assert.equal(populationPacks.tractFor(p, 3).tractId, 'A', 'position 3 should wrap to the first tract');
  assert.equal(populationPacks.tractFor(null, 0), null);
});

test('ageBandFor and attainmentFor read real shares; null with no tract', () => {
  const tract = pack().tracts[0];
  // The tract is 100% "higher" attainment and the elder band the pack
  // leans toward with a draw near 1.
  assert.equal(populationPacks.attainmentFor(tract, 0.5), 'higher');
  assert.equal(populationPacks.ageBandFor(tract, 0.95), 'elder');
  assert.equal(populationPacks.ageBandFor(null, 0.5), null);
  assert.equal(populationPacks.attainmentFor(null, 0.5), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with an all-"elder" tract produces adults, never under-18s claiming elder work', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'pop-pack-elder',
      populationPack: pack({
        tracts: [{ tractId: 'T1', ageBands: { child: 0, working: 0, elder: 1 } }],
      }),
      communitiesPerCity: 1,
      populationPerCommunity: 20,
    });
    // **Scoped to what THIS call made, never the whole accumulated
    // world.** `engine.WorldState` is a shared module-level singleton
    // that `generateWorld` appends to on every call — `w.npcs` after
    // an earlier test's call is still sitting there.
    const made = w.npcs.slice(before);
    const ages = made.map((n) => (w.tick - n.createdTick) / 365);
    assert.ok(ages.length > 0, 'this call should have made some residents');
    assert.ok(ages.every((a) => a >= 65), `every resident should land in the elder band: ${ages}`);
  } finally {
    cleanup();
  }
});

test('a world built with an all-"higher" tract gives every adult higher attainment', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'pop-pack-edu',
      populationPack: pack(),
      communitiesPerCity: 1,
      populationPerCommunity: 20,
    });
    const made = w.npcs.slice(before);
    const adults = made.filter((n) => (w.tick - n.createdTick) / 365 >= 18);
    assert.ok(adults.length > 0, 'the all-working/elder tract should have produced some adults');
    assert.ok(adults.every((n) => n.education === 'higher'), 'every adult should read the real tract attainment');
  } finally {
    cleanup();
  }
});

test('a world built with a real health baseline averages it onto the city, and mortality reads it', () => {
  const mortality = require('../server/mortality.js');
  const w = engine.WorldState;
  const citiesBefore = w.cities.length;
  try {
    worldgen.generateWorld({
      seed: 'pop-pack-health',
      populationPack: pack({ tracts: [{ tractId: 'T1', healthBaseline: 1.35 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 5,
    });
    const newCity = w.cities[citiesBefore];
    assert.equal(newCity.healthBaseline, 1.35);
    // No active conditions in a freshly generated city, so the real
    // baseline is the pressure, unmultiplied.
    assert.equal(mortality.diseasePressure(w, newCity.id), 1.35);
  } finally {
    cleanup();
  }
});

test('a world built with both a real health and overdose baseline compounds them in diseasePressure', () => {
  const mortality = require('../server/mortality.js');
  const w = engine.WorldState;
  const citiesBefore = w.cities.length;
  try {
    worldgen.generateWorld({
      seed: 'pop-pack-overdose',
      populationPack: pack({ tracts: [{ tractId: 'T1', healthBaseline: 1.1, overdoseBaseline: 1.4 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 5,
    });
    const newCity = w.cities[citiesBefore];
    assert.equal(newCity.healthBaseline, 1.1);
    assert.equal(newCity.overdoseBaseline, 1.4);
    // Independent real inputs compound multiplicatively, same as an
    // active condition does against the baseline.
    assert.equal(Math.round(mortality.diseasePressure(w, newCity.id) * 100) / 100, 1.54);
  } finally {
    cleanup();
  }
});

test('a world with no health baseline leaves diseasePressure at its unmeasured default of 1', () => {
  const mortality = require('../server/mortality.js');
  cleanup();
  const w = engine.WorldState;
  const citiesBefore = w.cities.length;
  worldgen.generateWorld({ seed: 'pop-pack-no-health', communitiesPerCity: 1, populationPerCommunity: 5 });
  const newCity = w.cities[citiesBefore];
  assert.equal(newCity.healthBaseline, undefined);
  assert.equal(mortality.diseasePressure(w, newCity.id), 1);
  cleanup();
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-pop-pack',
      populationPack: { region: 'X', source: 'sample', tracts: [] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no population pack still builds exactly as before', () => {
  cleanup();
  worldgen.generateWorld({ seed: 'no-pop-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const w = engine.WorldState;
  assert.equal(w.npcs.length >= 10, true);
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s education levels match demographics.js, exactly', () => {
  const demographics = require('../server/demographics.js');
  assert.deepEqual(
    populationPacks.EDUCATION_LEVELS.slice().sort(),
    demographics.EDUCATION_LEVELS.slice().sort(),
  );
});

test('this module\'s age bands match world-layer\'s own AGE_BANDS keys', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'imports', 'censusImport.js'), 'utf8',
  );
  const block = source.match(/const AGE_BANDS = \[([\s\S]*?)\];/);
  assert.ok(block, 'world-layer/imports/censusImport.js no longer declares AGE_BANDS');
  const theirs = [...block[1].matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(theirs.slice().sort(), populationPacks.AGE_BAND_KEYS.slice().sort());
});
