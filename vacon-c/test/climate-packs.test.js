// A real Köppen-Geiger climate key, for a column two files already
// refused to invent one for.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `migration.js#generateRegion` accepts `climateKey`, has never been
// passed one by any caller, and says exactly why it does not invent
// one: "`geography_key` and `climate_key` are free TEXT with no
// enumeration anywhere in the package, so a caller supplies them or
// they stay null." `barter.js` lists `regions.climate_key` as a price
// modifier it cannot model for the same reason.
// `world-layer/imports/noaaImport.js` already classifies real NOAA
// climate normals into the real, published Köppen-Geiger vocabulary —
// the caller both files were waiting for.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const climatePacks = require('../server/climatePacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'noaa-climate-normals',
    climateKey: 'Cfa',
    measures: {
      annualMeanC: 14.2, annualPrecipitationMm: 965, coldestMonthC: -2.1, warmestMonthC: 26.8,
    },
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.climatePack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(climatePacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(climatePacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(climatePacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a climateKey must start with a real Köppen group letter', () => {
  const problems = climatePacks.validatePack(pack({ climateKey: 'Zxy' }));
  assert.ok(problems.some((p) => p.includes('Köppen group letter')));
});

test('an empty climateKey is refused', () => {
  const problems = climatePacks.validatePack(pack({ climateKey: '' }));
  assert.ok(problems.some((p) => p.includes('climateKey')));
});

test('a non-numeric measure is refused; a negative or zero one is not', () => {
  // `coldestMonthC` and `annualMeanC` are routinely negative or zero —
  // only a genuinely non-numeric value is a mistake.
  assert.deepEqual(climatePacks.validatePack(pack({
    measures: { coldestMonthC: -40, annualMeanC: 0 },
  })), []);
  const problems = climatePacks.validatePack(pack({ measures: { annualMeanC: 'cold' } }));
  assert.ok(problems.some((p) => p.includes('annualMeanC')));
});

test('measures are optional — a climate key with no detail is still usable', () => {
  assert.deepEqual(climatePacks.validatePack(pack({ measures: null })), []);
});

// ---------------------------------------------------------------------
// packFor / climateKeyFor
// ---------------------------------------------------------------------

test('climateKeyFor reads the real key, and is null with no pack', () => {
  assert.equal(climatePacks.climateKeyFor(pack()), 'Cfa');
  assert.equal(climatePacks.climateKeyFor(null), null);
});

test('packFor reads the pack off a world state, or null', () => {
  assert.equal(climatePacks.packFor({ climatePack: pack() }).climateKey, 'Cfa');
  assert.equal(climatePacks.packFor({}), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real climate pack gives its region the real Köppen key', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({ seed: 'climate-pack-test', climatePack: pack(), communitiesPerCity: 1 });
    const region = w.regions[w.regions.length - 1];
    assert.equal(region.climate_key, 'Cfa');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-climate-pack',
      climatePack: { region: 'X', source: 'sample', climateKey: 'nope' },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no climate pack still builds, and its region keeps a null climate key', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-climate-pack', communitiesPerCity: 1 });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.climate_key, null);
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s Köppen group letters match world-layer\'s own KOPPEN_GROUPS keys', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'imports', 'noaaImport.js'), 'utf8',
  );
  const block = source.match(/const KOPPEN_GROUPS = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'world-layer/imports/noaaImport.js no longer declares KOPPEN_GROUPS');
  const theirs = [...block[1].matchAll(/^\s*([A-Z]):/gm)].map((m) => m[1]);
  assert.deepEqual(theirs.slice().sort(), climatePacks.KOPPEN_GROUP_LETTERS.slice().sort());
});
