// Real labour-market shapes, imported per region — `landmark-packs.test.js`'s
// sibling for jobs and wages.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `occupations.drawOccupation` weighted every pool by `1/tier` alone,
// and `worldgen.js`'s general hiring loop drew a flat wage,
// `random.range(8, 90, ...)`, for every hire regardless of what they
// do. `world-layer/imports/blsImport.js` already turns real U.S.
// Bureau of Labor Statistics (OES) data into the real employment
// share and the real median wage per SOC major group per metro.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const labourPacks = require('../server/labourPacks.js');
const occupations = require('../server/occupations.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

const ALL_GROUPS = ['11', '13', '17', '19', '21', '25', '27', '29', '31', '33', '35', '45', '47', '49', '51', '53'];

// Every real SOC group this engine maps to, all paid the same real
// wage — so a test does not need to know which occupation a seeded
// draw lands on to assert that a real wage, not the invented band,
// was used.
function uniformPack(wage, overrides = {}) {
  const employmentShares = {};
  const wages = {};
  for (const group of ALL_GROUPS) {
    employmentShares[group] = 1 / ALL_GROUPS.length;
    wages[group] = { medianWage: wage, meanWage: wage };
  }
  return {
    region: 'Testville', source: 'sample',
    metros: [{ areaCode: 'T1', employmentShares, wages }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.labourPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(labourPacks.validatePack(uniformPack(50000)), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(labourPacks.validatePack(uniformPack(50000, { source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(labourPacks.validatePack(uniformPack(50000, { region: undefined })).some((p) => p.includes('region')));
});

test('a metro needs an areaCode — an unattributed statistic cannot be checked', () => {
  const problems = labourPacks.validatePack({
    region: 'X', source: 'sample', metros: [{ employmentShares: { 11: 1 } }],
  });
  assert.ok(problems.some((p) => p.includes('areaCode')));
});

test('an out-of-range employment share is refused, not clamped silently', () => {
  const problems = labourPacks.validatePack({
    region: 'X', source: 'sample', metros: [{ areaCode: 'T1', employmentShares: { 11: 4 } }],
  });
  assert.ok(problems.some((p) => p.includes('employmentShares')));
});

// ---------------------------------------------------------------------
// metroFor, employmentShareFor, medianWageFor
// ---------------------------------------------------------------------

test('metroFor cycles by position, and is null with no pack', () => {
  const p = uniformPack(50000, {
    metros: [{ areaCode: 'A', employmentShares: {}, wages: {} }, { areaCode: 'B', employmentShares: {}, wages: {} }],
  });
  assert.equal(labourPacks.metroFor(p, 0).areaCode, 'A');
  assert.equal(labourPacks.metroFor(p, 1).areaCode, 'B');
  assert.equal(labourPacks.metroFor(p, 2).areaCode, 'A', 'position 2 should wrap');
  assert.equal(labourPacks.metroFor(null, 0), null);
});

test('employmentShareFor and medianWageFor map through the real SOC group, and are null without one', () => {
  const metro = { employmentShares: { 17: 0.3 }, wages: { 17: { medianWage: 85000 } } };
  assert.equal(labourPacks.employmentShareFor(metro, 'engineer'), 0.3);
  assert.equal(labourPacks.medianWageFor(metro, 'engineer'), 85000);
  assert.equal(labourPacks.employmentShareFor(metro, 'not-a-real-occupation'), null);
  assert.equal(labourPacks.medianWageFor(null, 'engineer'), null);
});

// ---------------------------------------------------------------------
// drawOccupation reads a real metro, when given one
// ---------------------------------------------------------------------

test('drawOccupation falls back to the tier pyramid when the pool has no real share', () => {
  // No metro at all — the existing, unchanged behaviour.
  const name = occupations.drawOccupation({ organizationType: 'hospital', seed: 'x' });
  assert.ok(name, 'a hospital should still produce an occupation with no metro');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a uniform high-wage labour pack hires nobody at the old flat band', () => {
  const w = engine.WorldState;
  const before = (w.employmentRecords || []).length;
  try {
    worldgen.generateWorld({
      seed: 'labour-pack-wage',
      labourPack: uniformPack(500000),
      communitiesPerCity: 1,
      populationPerCommunity: 20,
      employmentRate: 1,
    });
    // Scoped to the records THIS call made — `engine.WorldState` is a
    // shared singleton that accumulates across every call in this file.
    const made = (w.employmentRecords || []).slice(before);
    const wages = made.filter((r) => r.status === 'active').map((r) => Number(r.wage));
    assert.ok(wages.length > 0, 'the world should have made some hires');
    assert.ok(wages.every((wage) => wage > 90), `every real-pack wage should exceed the old flat band's max: ${wages}`);
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-labour-pack',
      labourPack: { region: 'X', source: 'sample', metros: [] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no labour pack still builds exactly as before', () => {
  cleanup();
  worldgen.generateWorld({ seed: 'no-labour-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s SOC map matches world-layer\'s own SOC_GROUP_BY_OCCUPATION, exactly', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'imports', 'blsImport.js'), 'utf8',
  );
  const block = source.match(/const SOC_GROUP_BY_OCCUPATION = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'world-layer/imports/blsImport.js no longer declares SOC_GROUP_BY_OCCUPATION');
  const theirs = {};
  for (const m of block[1].matchAll(/(\w+): '(\d+)'/g)) theirs[m[1]] = m[2];
  assert.deepEqual(theirs, labourPacks.SOC_GROUP_BY_OCCUPATION);
});

test('every engine occupation appears in the SOC map exactly once', () => {
  for (const name of occupations.OCCUPATION_NAMES) {
    assert.ok(labourPacks.SOC_GROUP_BY_OCCUPATION[name], `${name} has no SOC group mapped`);
  }
});
