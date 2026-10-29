// Google Earth Engine (VIIRS nighttime lights) — the one source in
// this registry whose real gap is credentials, not a proxy block.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const earthEngine = require('../imports/earthEngineImport');

test('classifyActivityLevel bands a real radiance value, and is null for a non-number', () => {
  assert.equal(earthEngine.classifyActivityLevel(0.1), 'dark');
  assert.equal(earthEngine.classifyActivityLevel(2), 'dim');
  assert.equal(earthEngine.classifyActivityLevel(15), 'lit');
  assert.equal(earthEngine.classifyActivityLevel(500), 'bright');
  assert.equal(earthEngine.classifyActivityLevel(null), null);
  assert.equal(earthEngine.classifyActivityLevel('not-a-number'), null);
});

test('importNightLights requires a finite radiance and a real composite date', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'regional' });
  assert.throws(
    () => earthEngine.importNightLights(layer, place.id, { compositeYear: 2023, compositeMonth: 6 }),
    /finite record.radianceNanoWattsPerCm2Sr/,
  );
  assert.throws(
    () => earthEngine.importNightLights(layer, place.id, { radianceNanoWattsPerCm2Sr: 10 }),
    /integer record.compositeYear and record.compositeMonth/,
  );
  assert.throws(
    () => earthEngine.importNightLights(layer, place.id, {
      radianceNanoWattsPerCm2Sr: 10, compositeYear: 2023, compositeMonth: 13,
    }),
    /compositeMonth 13 is not 1-12/,
  );
});

test('importNightLights attaches a real reading and its derived activity level', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Somewhere', lat: 1, lng: 2, tier: 'regional' });
  earthEngine.importNightLights(layer, place.id, {
    radianceNanoWattsPerCm2Sr: 42.7, compositeYear: 2024, compositeMonth: 3,
  });
  const lights = place.economicData.nightLights;
  assert.equal(lights.source, 'viirs-dnb-via-earth-engine');
  assert.equal(lights.radianceNanoWattsPerCm2Sr, 42.7);
  assert.equal(lights.compositeYear, 2024);
  assert.equal(lights.compositeMonth, 3);
  assert.equal(lights.activityLevel, 'bright');
});

test('a real small negative composite reading is kept, not clamped to zero', () => {
  // VIIRS' own stray-light correction can leave a composite slightly
  // below zero over a very dark area -- a real property of the
  // product, not bad data to be hidden.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'regional' });
  earthEngine.importNightLights(layer, place.id, {
    radianceNanoWattsPerCm2Sr: -0.08, compositeYear: 2024, compositeMonth: 1,
  });
  assert.equal(place.economicData.nightLights.radianceNanoWattsPerCm2Sr, -0.08);
});

test('importNightLights refuses an unknown location', () => {
  const layer = createWorldLayer();
  assert.throws(
    () => earthEngine.importNightLights(layer, 999999, {
      radianceNanoWattsPerCm2Sr: 5, compositeYear: 2024, compositeMonth: 1,
    }),
    /no location with id 999999/,
  );
});

test('describeNightLightsCoverage tallies real activity levels across a world', () => {
  const layer = createWorldLayer();
  const a = generateLocation(layer, { name: 'A', lat: 1, lng: 2, tier: 'regional' });
  const b = generateLocation(layer, { name: 'B', lat: 3, lng: 4, tier: 'regional' });
  earthEngine.importNightLights(layer, a.id, { radianceNanoWattsPerCm2Sr: 0.1, compositeYear: 2024, compositeMonth: 1 });
  earthEngine.importNightLights(layer, b.id, { radianceNanoWattsPerCm2Sr: 80, compositeYear: 2024, compositeMonth: 1 });

  const report = earthEngine.describeNightLightsCoverage(layer);
  assert.equal(report.withData, 2);
  assert.deepEqual(report.byLevel, { dark: 1, bright: 1 });
  assert.equal(report.total, 2);
});

test('fetchViirsNightLights names the real gap (credentials), not a proxy block it never hit', () => {
  // This is the one fetch stub in the registry that must NOT claim a
  // 403 CONNECT -- the real failure here, checked directly, is a
  // genuine 401 from Google's own API because no Earth Engine project
  // is registered, and claiming otherwise would misreport which real
  // obstacle is in the way.
  assert.throws(earthEngine.fetchViirsNightLights, (error) => {
    assert.match(error.message, /not implemented/);
    assert.doesNotMatch(error.message, /403 CONNECT/);
    assert.match(error.message, /401 UNAUTHENTICATED|credentials|Earth Engine Cloud Project/);
    assert.match(error.message, /importNightLights/);
    return true;
  });
});
