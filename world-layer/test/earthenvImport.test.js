// EarthEnv — the global-tier analogue of usgsImport's elevation, plus
// a real, tested, currently-consumerless land-cover transform.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const usgs = require('../imports/usgsImport');
const earthenv = require('../imports/earthenvImport');

test('importEarthenvElevation attaches a real reading and classifies terrain', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Somewhere', lat: 1, lng: 2, tier: 'filler' });
  earthenv.importEarthenvElevation(layer, place.id, {
    elevationMetres: 250,
    sample: [100, 180, 250, 300, 400],
  });
  assert.equal(place.geographyData.source, 'earthenv-dem90');
  assert.equal(place.geographyData.resolution, earthenv.EARTHENV_DEM_RESOLUTION_METRES);
  assert.equal(place.geographyData.earthenvElevationMetres, 250);
  assert.ok(place.terrainType, 'a usable sample must produce a real terrain classification');
});

test('importEarthenvElevation requires a finite elevation', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'filler' });
  assert.throws(
    () => earthenv.importEarthenvElevation(layer, place.id, { elevationMetres: null }),
    /finite record.elevationMetres/,
  );
});

test('a real USGS reading is never overwritten by the coarser global layer', () => {
  // 3DEP is 1-10m for the United States; EarthEnv-DEM90 is 90m
  // everywhere. Importing EarthEnv second must not regress a point
  // that already has the finer measurement.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'St. Louis', lat: 38.62, lng: -90.19, tier: 'regional' });
  usgs.importElevation(layer, place.id, { elevationMetres: 142, resolution: 1, sample: [130, 140, 142, 150, 160] });
  const usgsTerrain = place.terrainType;
  const usgsElevation = place.geographyData.elevationMetres;

  earthenv.importEarthenvElevation(layer, place.id, {
    elevationMetres: 9999, // deliberately absurd, so a silent overwrite would be obvious
    sample: [9000, 9500, 9999, 10200, 10500],
  });

  assert.equal(place.geographyData.source, 'usgs-3dep', 'the finer source was overwritten');
  assert.equal(place.geographyData.elevationMetres, usgsElevation);
  assert.equal(place.terrainType, usgsTerrain);
  // The real EarthEnv figure is still recorded, just not as primary.
  assert.equal(place.geographyData.earthenvElevationMetres, 9999);
});

test('importEarthenvLandCover refuses a class outside the twelve published consensus classes', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'filler' });
  assert.throws(
    () => earthenv.importEarthenvLandCover(layer, place.id, { classKey: 'swampy-bog' }),
    /not one of the twelve published Consensus Land-Cover classes/,
  );
});

test('importEarthenvLandCover attaches a real class and an honest agreement score', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'filler' });
  earthenv.importEarthenvLandCover(layer, place.id, { classKey: 'mixed-forest', agreement: 0.8 });
  assert.equal(place.geographyData.landCoverClass, 'mixed-forest');
  assert.equal(place.geographyData.landCoverSource, 'earthenv-consensus-land-cover');
  assert.equal(place.geographyData.landCoverAgreement, 0.8);
});

test('a missing agreement score is honestly null, not assumed perfect', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'filler' });
  earthenv.importEarthenvLandCover(layer, place.id, { classKey: 'barren' });
  assert.equal(place.geographyData.landCoverAgreement, null);
});

test('describeEarthenvCoverage counts elevation and land cover separately', () => {
  const layer = createWorldLayer();
  const a = generateLocation(layer, { name: 'A', lat: 1, lng: 2, tier: 'filler' });
  const b = generateLocation(layer, { name: 'B', lat: 3, lng: 4, tier: 'filler' });
  earthenv.importEarthenvElevation(layer, a.id, { elevationMetres: 50 });
  earthenv.importEarthenvLandCover(layer, b.id, { classKey: 'urban-and-built-up' });

  const report = earthenv.describeEarthenvCoverage(layer);
  assert.equal(report.withElevation, 1);
  assert.equal(report.withLandCover, 1);
  assert.deepEqual(report.byLandCoverClass, { 'urban-and-built-up': 1 });
  assert.equal(report.total, 2);
});

test('both fetchers are honest about being blocked at the proxy, not faked', () => {
  for (const fetcher of [earthenv.fetchEarthenvElevation, earthenv.fetchEarthenvLandCover]) {
    assert.throws(fetcher, (error) => {
      assert.match(error.message, /not implemented/);
      assert.match(error.message, /proxy allowlist/);
      assert.match(error.message, /importEarthenv/);
      return true;
    });
  }
});
