// CDC/NCHS Natality — a real age-specific fertility rate, for a curve
// `vacon-c/server/births.js` labels invented.
//
// Held to the same four things every importer in this registry is:
// an unrecognised band is named, not defaulted; unknown is not zero;
// an ordinary real value passes through unchanged; and what this
// fills is a thing the engine actually reads
// (`vacon-c/server/natalityPacks.js`).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const natality = require('../imports/natalityImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'Tract 1', lat: 38.6, lng: -90.2, tier: 'filler' });
}

test('an unrecognised age band is named, not defaulted onto its neighbour', () => {
  const { byBand, dropped } = natality.toRateShape({ '15-19': 40, '10-14': 0.1 });
  assert.equal(byBand['15-19'], 40);
  assert.equal(byBand['10-14'], undefined);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].band, '10-14');
});

test('a suppressed or out-of-range rate is dropped, not read as zero births', () => {
  const { byBand, dropped } = natality.toRateShape({ '15-19': null, '20-24': 500 });
  assert.equal(byBand['15-19'], undefined);
  assert.equal(byBand['20-24'], undefined, '500 per 1,000 is outside RATE_BOUNDS');
  assert.equal(dropped.length, 2);
});

test('a real, ordinary rate passes through exactly as published', () => {
  const { byBand } = natality.toRateShape({ '25-29': 98.7 });
  assert.equal(byBand['25-29'], 98.7);
});

test('importNatalityRates requires a countyFips — this calibrates a real rate', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => natality.importNatalityRates(w, p.id, { rates: { '15-19': 30 } }),
    /countyFips/);
});

test('importNatalityRates writes a real rate shape, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  natality.importNatalityRates(w, p.id, {
    countyFips: '29510', countyName: 'St. Louis', year: 2022,
    rates: { '15-19': 14.2, '20-24': 61.8, '25-29': 98.3 },
  });
  assert.equal(p.populationData.natality.source, 'cdc-natality');
  assert.equal(p.populationData.natality.ratesPerThousand['20-24'], 61.8);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('importNatalityRates preserves an existing populationData field rather than clobbering it', () => {
  // The exact bug `exportPopulationPack` had: this writes onto the
  // same `populationData` object ACS already wrote shares onto.
  const w = createWorldLayer();
  const p = place(w);
  const { setLocationData } = require('../locations');
  setLocationData(w, p.id, 'populationData', { source: 'us-census-acs', ageBands: { child: 0.2 } });
  natality.importNatalityRates(w, p.id, { countyFips: '29510', rates: { '15-19': 14.2 } });
  assert.deepEqual(p.populationData.ageBands, { child: 0.2 }, 'the ACS shares should survive');
  assert.ok(p.populationData.natality.ratesPerThousand);
});

test('describeNatalityCoverage reports per-band coverage and the counties with no usable rate', () => {
  const w = createWorldLayer();
  const covered = place(w);
  natality.importNatalityRates(w, covered.id, { countyFips: 'A', rates: { '15-19': 14.2 } });
  const uncovered = place(w);
  natality.importNatalityRates(w, uncovered.id, { countyFips: 'B', rates: { '10-14': 0.1 } });

  const report = natality.describeNatalityCoverage(w);
  assert.equal(report.counties, 2);
  assert.equal(report.withRates, 1);
  assert.equal(report.withoutRates, 1);
  assert.equal(report.bandCoverage['15-19'], 1);
});

test('fetchNatalityRates throws naming the block, like every importer in this registry', () => {
  assert.throws(natality.fetchNatalityRates, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
