// A real hazard profile, imported per region — so two cities in the
// same climate stop having the same disasters.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `environment.js` drew severe weather from `CLIMATES` alone — a
// profile per climate NAME, identical for every city that climate
// draws. `world-layer/imports/femaImport.js` already turns the real
// FEMA National Risk Index into a weight per `environment.SEVERE`
// condition, per real U.S. county.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const riskPacks = require('../server/riskPacks.js');
const environment = require('../server/environment.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    counties: [{ countyFips: '29510', countyName: 'St. Louis', hazardRisk: { storm: 1 } }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.riskPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(riskPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(riskPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(riskPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a county needs a countyFips — an unattributed rating cannot be checked', () => {
  const problems = riskPacks.validatePack(pack({ counties: [{ hazardRisk: { storm: 1 } }] }));
  assert.ok(problems.some((p) => p.includes('countyFips')));
});

test('an unknown hazard condition is refused, not silently dropped', () => {
  const problems = riskPacks.validatePack(pack({
    counties: [{ countyFips: '29510', hazardRisk: { wildfire: 1 } }],
  }));
  assert.ok(problems.some((p) => p.includes('hazardRisk')));
});

test('a weight outside 0..1 is refused, not clamped silently', () => {
  const problems = riskPacks.validatePack(pack({
    counties: [{ countyFips: '29510', hazardRisk: { storm: 1.5 } }],
  }));
  assert.ok(problems.some((p) => p.includes('hazardRisk')));
});

test('an empty counties array is refused', () => {
  const problems = riskPacks.validatePack(pack({ counties: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// countyFor / riskFor
// ---------------------------------------------------------------------

test('countyFor cycles by position, and is null with no pack', () => {
  const p = pack({
    counties: [{ countyFips: 'A', hazardRisk: { storm: 1 } }, { countyFips: 'B', hazardRisk: { drought: 1 } }],
  });
  assert.equal(riskPacks.countyFor(p, 0).countyFips, 'A');
  assert.equal(riskPacks.countyFor(p, 1).countyFips, 'B');
  assert.equal(riskPacks.countyFor(p, 2).countyFips, 'A', 'position 2 should wrap');
  assert.equal(riskPacks.countyFor(null, 0), null);
});

test('riskFor reads real weights, and is null with no county or no recorded risk', () => {
  const county = pack().counties[0];
  assert.deepEqual(riskPacks.riskFor(county), { storm: 1 });
  assert.equal(riskPacks.riskFor(null), null);
  assert.equal(riskPacks.riskFor({ countyFips: 'X', hazardRisk: {} }), null);
});

// ---------------------------------------------------------------------
// drawWeather actually boosts a real hazard, within the climate's own weights
// ---------------------------------------------------------------------

test('a real maximal hazard weight raises that weather\'s own share of the draw', () => {
  // `coastal`'s own storm weight is 2 of 20 — a real maximal storm
  // risk should make `storm` land noticeably more often across many
  // draws than the climate alone produces.
  let baseline = 0;
  let boosted = 0;
  const trials = 500;
  for (let tick = 0; tick < trials; tick += 1) {
    if (environment.drawWeather('coastal', 'seed-a', 1, tick) === 'storm') baseline += 1;
    if (environment.drawWeather('coastal', 'seed-a', 1, tick, { storm: 1 }) === 'storm') boosted += 1;
  }
  assert.ok(boosted > baseline, `expected more storms with a real risk weight (baseline ${baseline}, boosted ${boosted})`);
});

test('a real hazard weight cannot create a weather the climate assigns zero chance', () => {
  // `arid`'s own storm weight is 0 — a real maximal storm risk must not
  // make a desert flood, because climate decides what is POSSIBLE and
  // a hazard pack only narrows within that.
  for (let tick = 0; tick < 50; tick += 1) {
    assert.notEqual(environment.drawWeather('arid', 'seed-b', 1, tick, { storm: 1 }), 'storm');
  }
});

test('no riskWeights reproduces the exact previous computation', () => {
  for (let tick = 0; tick < 20; tick += 1) {
    assert.equal(
      environment.drawWeather('temperate', 'seed-c', 1, tick),
      environment.drawWeather('temperate', 'seed-c', 1, tick, null),
    );
  }
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real risk pack carries the real hazard weights on the city', () => {
  const w = engine.WorldState;
  const citiesBefore = w.cities.length;
  try {
    worldgen.generateWorld({
      seed: 'risk-pack-test', riskPack: pack(), communitiesPerCity: 1, populationPerCommunity: 5,
    });
    const newCity = w.cities[citiesBefore];
    assert.deepEqual(newCity.hazardRisk, { storm: 1 });
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-risk-pack',
      riskPack: { region: 'X', source: 'sample', counties: [{ countyFips: 'Y', hazardRisk: { wildfire: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no risk pack still builds, and its city carries no hazardRisk', () => {
  cleanup();
  const w = engine.WorldState;
  const citiesBefore = w.cities.length;
  worldgen.generateWorld({ seed: 'no-risk-pack', communitiesPerCity: 1, populationPerCommunity: 5 });
  const newCity = w.cities[citiesBefore];
  assert.equal(newCity.hazardRisk, undefined);
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s hazard conditions match environment.SEVERE, exactly', () => {
  assert.deepEqual(
    riskPacks.HAZARD_CONDITIONS.slice().sort(),
    Object.keys(environment.SEVERE).slice().sort(),
  );
});
