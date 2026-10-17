// LA/Chicago open crime-data incident import — a real sub-city
// hot-spot signal, and a two-city exception. Read
// `imports/cityCrimeImport.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const cityCrime = require('../imports/cityCrimeImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'Area 1', lat: 34.0, lng: -118.2, tier: 'filler' });
}

test('a missing population figure gives no rate — a rate against an unknown base is invented', () => {
  assert.equal(cityCrime.toRatePerCapita(50, null), null);
});

test('a real rate at a plausible level computes correctly', () => {
  assert.equal(cityCrime.toRatePerCapita(450, 30000), 15);
});

test('a rate outside the sanity bound is refused, not clamped silently', () => {
  assert.equal(cityCrime.toRatePerCapita(900000, 1000), null, '900 per capita is a units error, not a real rate');
});

test('importAreaIncidents requires a recognized city', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(
    () => cityCrime.importAreaIncidents(w, p.id, { city: 'houston', areaName: 'Downtown' }),
    /one of: los-angeles, chicago/,
  );
});

test('importAreaIncidents requires an areaName', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => cityCrime.importAreaIncidents(w, p.id, { city: 'chicago' }), /areaName/);
});

test('importAreaIncidents writes real rates under the right per-city source, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  cityCrime.importAreaIncidents(w, p.id, {
    city: 'los-angeles', areaName: 'Rampart', year: 2023,
    violentCount: 300, propertyCount: 900, population: 30000,
  });
  assert.equal(p.populationData.crimeHotspot.source, 'la-open-data');
  assert.equal(p.populationData.crimeHotspot.violentRatePer1k, 10);
  assert.equal(p.populationData.crimeHotspot.propertyRatePer1k, 30);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('importAreaIncidents tags Chicago records with the Chicago source', () => {
  const w = createWorldLayer();
  const p = place(w);
  cityCrime.importAreaIncidents(w, p.id, {
    city: 'chicago', areaName: 'Englewood', year: 2023, propertyCount: 500, population: 25000,
  });
  assert.equal(p.populationData.crimeHotspot.source, 'chicago-open-data');
});

test('describeCrimeHotspotCoverage reports per-city counts and areas with no usable rate', () => {
  const w = createWorldLayer();
  cityCrime.importAreaIncidents(w, place(w).id, {
    city: 'los-angeles', areaName: 'A', propertyCount: 100, population: 10000,
  });
  cityCrime.importAreaIncidents(w, place(w).id, { city: 'chicago', areaName: 'B', population: null });
  const report = cityCrime.describeCrimeHotspotCoverage(w);
  assert.equal(report.areas, 2);
  assert.equal(report.withRate, 1);
  assert.equal(report.withoutRate, 1);
  assert.equal(report.byCity['los-angeles'], 1);
  assert.equal(report.byCity.chicago, 1);
});

test('fetchAreaIncidents throws naming the block, like every importer in this registry', () => {
  assert.throws(cityCrime.fetchAreaIncidents, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
