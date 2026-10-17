// CDC/NCHS drug overdose mortality — a second real excess-mortality
// signal, for the same multiplier `cdcImport.js` already feeds.
//
// Held to the same discipline every importer in this registry is:
// unknown is not zero, an ordinary real value passes through
// unchanged, and this folds into a mechanism the engine actually has
// (`mortality.diseasePressure`) rather than inventing one.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const overdose = require('../imports/overdoseImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'County 1', lat: 38.6, lng: -90.2, tier: 'filler' });
}

test('a missing or suppressed rate has no pressure, not an ordinary one', () => {
  const result = overdose.toOverdosePressure(null);
  assert.equal(result.pressure, null, 'returning 1 would say the county had been measured and found ordinary');
  assert.equal(overdose.toOverdosePressure(undefined).pressure, null);
  assert.equal(overdose.toOverdosePressure('').pressure, null);
});

test('a real rate at the ordinary reference returns a pressure of exactly 1', () => {
  const result = overdose.toOverdosePressure(overdose.ORDINARY_OVERDOSE_RATE_PER_100K);
  assert.equal(result.pressure, 1);
});

test('pressure is bounded, so an extreme rate cannot empty a world by arithmetic', () => {
  const result = overdose.toOverdosePressure(100000);
  assert.equal(result.pressure, overdose.PRESSURE_BOUNDS[1]);
});

test('a caller can pass its own ordinary reference rather than this file\'s flagged default', () => {
  const result = overdose.toOverdosePressure(60, { ordinary: 60 });
  assert.equal(result.pressure, 1);
});

test('importOverdoseRates requires a countyFips — a real death rate is not optional provenance', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => overdose.importOverdoseRates(w, p.id, { ratePer100k: 30 }), /countyFips/);
});

test('importOverdoseRates writes a real baseline, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  overdose.importOverdoseRates(w, p.id, { countyFips: '29510', ratePer100k: 45, year: 2022 });
  assert.equal(p.populationData.overdoseMortality.source, 'cdc-overdose');
  assert.equal(p.populationData.overdoseMortality.baselinePressure, 1.5);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('importOverdoseRates preserves an existing populationData field rather than clobbering it', () => {
  const w = createWorldLayer();
  const p = place(w);
  const { setLocationData } = require('../locations');
  setLocationData(w, p.id, 'populationData', { source: 'us-census-acs', ageBands: { child: 0.2 } });
  overdose.importOverdoseRates(w, p.id, { countyFips: '29510', ratePer100k: 30 });
  assert.deepEqual(p.populationData.ageBands, { child: 0.2 });
  assert.equal(p.populationData.overdoseMortality.baselinePressure, 1);
});

test('describeOverdoseCoverage reports a median and the counties with a suppressed rate', () => {
  const w = createWorldLayer();
  overdose.importOverdoseRates(w, place(w).id, { countyFips: 'A', ratePer100k: 30 });
  overdose.importOverdoseRates(w, place(w).id, { countyFips: 'B', ratePer100k: null });
  const report = overdose.describeOverdoseCoverage(w);
  assert.equal(report.counties, 2);
  assert.equal(report.withRate, 1);
  assert.equal(report.suppressedOrMissing, 1);
  assert.equal(report.medianRatePer100k, 30);
});

test('fetchOverdoseRates throws naming the block, like every importer in this registry', () => {
  assert.throws(overdose.fetchOverdoseRates, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
