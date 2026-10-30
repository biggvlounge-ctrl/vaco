// Cesium OSM Buildings — real, and genuinely redundant with Overture
// Buildings for the same two already-named fields. The failure this
// file exists to catch: a rendered default-extrusion height read as
// a real measurement.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer } = require('../locations');
const cesium = require('../imports/cesiumImport');

test('importCesiumBuildings requires an array', () => {
  const layer = createWorldLayer();
  assert.throws(() => cesium.importCesiumBuildings(layer, null), /requires an array/);
});

test('a building with no usable coordinates is skipped and named, never placed at a guess', () => {
  const layer = createWorldLayer();
  const { imported, skipped } = cesium.importCesiumBuildings(layer, [{ name: 'X' }]);
  assert.equal(imported.length, 0);
  assert.match(skipped[0].reason, /no usable coordinates/);
});

test('an unnamed building is kept — the footprint is the value, not the name', () => {
  const layer = createWorldLayer();
  const { imported } = cesium.importCesiumBuildings(layer, [
    { lat: 38.6201, lng: -90.1902, footprintArea: 140 },
  ]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].buildingData.named, false);
  assert.ok(imported[0].name.includes('38.62010'));
});

test('a real OSM building tag maps through the same vocabulary Overture buildings use', () => {
  const layer = createWorldLayer();
  const { imported } = cesium.importCesiumBuildings(layer, [
    { lat: 1, lng: 2, osmBuildingTag: 'warehouse' },
  ]);
  assert.equal(imported[0].buildingData.propertyType, 'industrial');
});

test('a height with no real OSM tag is recorded but flagged, never presented as measured', () => {
  const layer = createWorldLayer();
  const { imported } = cesium.importCesiumBuildings(layer, [
    { lat: 1, lng: 2, heightMetres: 10 }, // heightIsMeasured omitted
  ]);
  assert.equal(imported[0].buildingData.heightMetres, 10);
  assert.equal(imported[0].buildingData.heightIsMeasured, false,
    'a height with no explicit heightIsMeasured must default to false, not be trusted as real');
});

test('a real, explicitly-measured height is recorded as such', () => {
  const layer = createWorldLayer();
  const { imported } = cesium.importCesiumBuildings(layer, [
    { lat: 1, lng: 2, heightMetres: 45, heightIsMeasured: true },
  ]);
  assert.equal(imported[0].buildingData.heightIsMeasured, true);
});

test('describeCesiumCoverage separates real measured heights from default-extrusion-only ones', () => {
  const layer = createWorldLayer();
  cesium.importCesiumBuildings(layer, [
    { lat: 1, lng: 2, heightMetres: 45, heightIsMeasured: true },
    { lat: 3, lng: 4, heightMetres: 8, heightIsMeasured: false },
    { lat: 5, lng: 6 },
  ]);
  const report = cesium.describeCesiumCoverage(layer);
  assert.equal(report.withData, 3);
  assert.equal(report.withMeasuredHeight, 1);
  assert.equal(report.withDefaultExtrusionOnly, 2);
  assert.equal(report.total, 3);
});

test('fetchCesiumBuildings names both real blockers: the proxy block and the missing token', () => {
  assert.throws(cesium.fetchCesiumBuildings, (error) => {
    assert.match(error.message, /not implemented/);
    assert.match(error.message, /403 CONNECT/);
    assert.match(error.message, /ion access token/);
    assert.match(error.message, /importCesiumBuildings/);
    return true;
  });
});
