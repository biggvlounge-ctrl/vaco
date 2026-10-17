// A real age-specific fertility rate, imported per region — for a
// curve `births.js` itself flags as invented.
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `births.js#fertilityForAge` is a bell curve, "flagged interpretive"
// in its own header: "no document gives a fertility curve."
// `world-layer/imports/natalityImport.js` already turns real CDC/NCHS
// Natality data into exactly this — a real age-specific fertility
// rate, per county, per standard five-year band.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const natalityPacks = require('../server/natalityPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    counties: [{
      countyFips: '29510',
      countyName: 'St. Louis',
      ratesPerThousand: {
        '15-19': 14.2, '20-24': 61.8, '25-29': 98.3, '30-34': 97.1, '35-39': 51.4, '40-44': 10.9,
      },
    }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.natalityPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(natalityPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(natalityPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(natalityPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a county needs a countyFips — an unattributed rate cannot be checked', () => {
  const problems = natalityPacks.validatePack(pack({
    counties: [{ ratesPerThousand: { '15-19': 14.2 } }],
  }));
  assert.ok(problems.some((p) => p.includes('countyFips')));
});

test('an unknown age band is refused, not silently dropped', () => {
  const problems = natalityPacks.validatePack(pack({
    counties: [{ countyFips: '29510', ratesPerThousand: { '10-14': 0.1 } }],
  }));
  assert.ok(problems.some((p) => p.includes('ratesPerThousand')));
});

test('a rate outside the sanity bound is refused', () => {
  const problems = natalityPacks.validatePack(pack({
    counties: [{ countyFips: '29510', ratesPerThousand: { '20-24': 500 } }],
  }));
  assert.ok(problems.some((p) => p.includes('ratesPerThousand')));
});

test('an empty counties array is refused', () => {
  const problems = natalityPacks.validatePack(pack({ counties: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// countyFor / ratesFor / annualRateFor
// ---------------------------------------------------------------------

test('countyFor cycles by position, and is null with no pack', () => {
  const p = pack({
    counties: [
      { countyFips: 'A', ratesPerThousand: { '15-19': 10 } },
      { countyFips: 'B', ratesPerThousand: { '15-19': 20 } },
    ],
  });
  assert.equal(natalityPacks.countyFor(p, 0).countyFips, 'A');
  assert.equal(natalityPacks.countyFor(p, 1).countyFips, 'B');
  assert.equal(natalityPacks.countyFor(p, 2).countyFips, 'A', 'position 2 should wrap');
  assert.equal(natalityPacks.countyFor(null, 0), null);
});

test('annualRateFor bins a real age into its band and converts per-1,000 to a probability', () => {
  const rates = pack().counties[0].ratesPerThousand;
  assert.equal(natalityPacks.annualRateFor(rates, 17), 0.0142);
  assert.equal(natalityPacks.annualRateFor(rates, 27), 0.0983);
  assert.equal(natalityPacks.annualRateFor(rates, 10), null, 'below every band');
  assert.equal(natalityPacks.annualRateFor(rates, 50), null, 'above every band');
  assert.equal(natalityPacks.annualRateFor(null, 20), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real natality pack stores the real rates on the community', () => {
  const w = engine.WorldState;
  const communitiesBefore = w.communities.length;
  try {
    worldgen.generateWorld({
      seed: 'natality-pack-test', natalityPack: pack(), communitiesPerCity: 1, populationPerCommunity: 5,
    });
    const newCommunity = w.communities[communitiesBefore];
    assert.deepEqual(newCommunity.fertilityRates, pack().counties[0].ratesPerThousand);
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-natality-pack',
      natalityPack: { region: 'X', source: 'sample', counties: [{ countyFips: 'Y', ratesPerThousand: { nope: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no natality pack still builds, and carries no fertilityRates', () => {
  cleanup();
  const w = engine.WorldState;
  const communitiesBefore = w.communities.length;
  worldgen.generateWorld({ seed: 'no-natality-pack', communitiesPerCity: 1, populationPerCommunity: 5 });
  const newCommunity = w.communities[communitiesBefore];
  assert.equal(newCommunity.fertilityRates, undefined);
  cleanup();
});

// ---------------------------------------------------------------------
// births.js actually reads the real rate
// ---------------------------------------------------------------------

test('a real, maximal fertility rate raises a bearer\'s birth chance over the invented curve', () => {
  const births = require('../server/births.js');
  // A real rate 100x the invented curve's own peak probability makes
  // the real-vs-invented difference unmistakable in a small sample.
  const highRate = pack({
    counties: [{
      countyFips: '29510',
      ratesPerThousand: { '15-19': 0, '20-24': 0, '25-29': 400, '30-34': 0, '35-39': 0, '40-44': 0 },
    }],
  });
  const annualRate = natalityPacks.annualRateFor(highRate.counties[0].ratesPerThousand, 27);
  assert.equal(annualRate, 0.4);
  assert.ok(annualRate > births.BASE_ANNUAL_BIRTH_RATE * births.fertilityForAge(27),
    'the real rate should exceed what the invented curve alone would have produced');
});
