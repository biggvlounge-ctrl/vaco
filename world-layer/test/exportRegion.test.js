// Exporting a region as a landmark pack — the consumer join.
//
// UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md's status section said for
// months that this module's consumers were "genuinely unbuilt" because
// VACON-C was paused. It was not paused, and it wrote its own landmark
// system without finding `locations.js`. This is the join, and it is a
// FILE rather than an import because no app may require across the
// directory boundary (the per-app Docker build context).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation, setLocationData } = require('../locations');
const { exportRegion, categoryOf, significanceOf, KEY_CATEGORIES } = require('../exportRegion');
const { importUnescoSites } = require('../imports/unescoImport');

function layerWith(entries) {
  const layer = createWorldLayer();
  for (const entry of entries) {
    const location = generateLocation(layer, {
      name: entry.name, lat: entry.lat ?? 1, lng: entry.lng ?? 2, tier: entry.tier ?? 'hero',
    });
    if (entry.landmarkData) setLocationData(layer, location.id, 'landmarkData', entry.landmarkData);
  }
  return layer;
}

test('a pack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportRegion(createWorldLayer(), {}), /requires options\.region/);
});

test('a location with a Key category exports with its name and coordinates', () => {
  const layer = layerWith([{
    name: 'Gateway Arch', lat: 38.6247, lng: -90.1848,
    landmarkData: { category: 'monument-memorial', area: 'Downtown', historicalImportance: 100 },
  }]);
  const pack = exportRegion(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.region, 'St. Louis, Missouri');
  assert.deepEqual(pack.areas, ['Downtown']);
  assert.deepEqual(pack.locations[0], {
    name: 'Gateway Arch',
    category: 'monument-memorial',
    tier: 'hero',
    significance: 100,
    area: 'Downtown',
    lat: 38.6247,
    lng: -90.1848,
  });
});

test('a location with no Key category is named as skipped, not silently defaulted', () => {
  // Defaulting to `other-distinctive-feature` is how a whole region
  // ends up as one category with nothing to show it happened.
  const layer = layerWith([{ name: 'Some Warehouse' }]);
  const pack = exportRegion(layer, { region: 'Nowhere' });
  assert.equal(pack.locations.length, 0);
  assert.equal(pack.skipped.length, 1);
  assert.equal(pack.skipped[0].name, 'Some Warehouse');
});

test('an invented category is not a Key category', () => {
  assert.equal(categoryOf({ landmarkData: { category: 'wizard-tower' } }), null);
  assert.equal(categoryOf({ landmarkData: {} }), null);
  assert.equal(categoryOf({}), null);
});

test('UNESCO inscription carries through as maximal significance', () => {
  // `imports/unescoImport.js` writes historicalImportance: 100 and says
  // why. That judgement belongs to the importer; this carries it rather
  // than forming a second opinion.
  const layer = createWorldLayer();
  importUnescoSites(layer, [{ name: 'Cahokia Mounds', lat: 38.6551, lng: -90.0611 }]);
  assert.equal(significanceOf(layer.locations[0]), 100);
  // But with no category on it, the export skips it and says so —
  // UNESCO gives a site, not a building type.
  const pack = exportRegion(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.skipped.length, 1);
});

test('filler-tier locations stay out of a landmark pack', () => {
  const layer = layerWith([
    { name: 'A House', tier: 'filler', landmarkData: { category: 'historic-site' } },
    { name: 'The Old Courthouse', tier: 'hero', landmarkData: { category: 'government-building' } },
  ]);
  const pack = exportRegion(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.locations.map((l) => l.name), ['The Old Courthouse']);
});

test('half a coordinate pair is dropped rather than exported', () => {
  // The consuming validator rejects one without the other, so an
  // export must not produce one.
  const layer = createWorldLayer();
  layer.locations.push({
    id: 1, name: 'Somewhere', lat: 38.6, lng: null, tier: 'hero',
    landmarkData: { category: 'library' },
  });
  const pack = exportRegion(layer, { region: 'Nowhere' });
  assert.equal(pack.locations[0].lat, undefined);
});

test('the Key is the documents’ twenty-three, in full', () => {
  assert.equal(KEY_CATEGORIES.length, 23);
  assert.ok(KEY_CATEGORIES.includes('masonic-building'));
  assert.ok(KEY_CATEGORIES.includes('other-distinctive-feature'));
});
