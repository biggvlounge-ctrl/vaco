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
const { importGnisFeatures } = require('../imports/gnisImport');
const { importOvertureDivisions } = require('../imports/overtureImport');

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

test('the Key is the documents’ twenty-three, plus the school they disagree about', () => {
  assert.equal(KEY_CATEGORIES.length, 24);
  assert.ok(KEY_CATEGORIES.includes('school'));
  assert.ok(KEY_CATEGORIES.includes('masonic-building'));
  assert.ok(KEY_CATEGORIES.includes('other-distinctive-feature'));
});

// ---------------------------------------------------------------------
// GNIS and Overture Divisions need no new exporter code at all — this
// locks that finding in rather than leaving it as something somebody
// has to re-derive. Both write onto `landmarkData` with categories
// already in `KEY_CATEGORIES`, the same field and vocabulary every
// other landmark source here uses, so `exportRegion` already reads
// them with zero changes.
// ---------------------------------------------------------------------

test('a real GNIS natural feature exports through the existing join, unmodified', () => {
  const layer = createWorldLayer();
  const { imported, places } = importGnisFeatures(layer, [
    { featureName: 'Elephant Rocks', featureClass: 'summit', primaryLatitude: 37.6, primaryLongitude: -90.7, countyName: 'Iron County' },
    { featureName: 'Mark Twain Cave', featureClass: 'cave', primaryLatitude: 39.5, primaryLongitude: -91.4 },
    { featureName: 'Hannibal', featureClass: 'populated place', primaryLatitude: 39.7, primaryLongitude: -91.3 },
  ]);
  assert.equal(imported.length, 2, 'the two real features should be placed');
  assert.deepEqual(places, ['Hannibal'], 'the populated place should be collected as an area name, not a landmark');

  const pack = exportRegion(layer, { region: 'Missouri', tiers: ['regional'] });
  assert.equal(pack.locations.length, 2);
  assert.ok(pack.locations.some((l) => l.name === 'Elephant Rocks' && l.category === 'natural-formation'));
  assert.ok(pack.locations.some((l) => l.name === 'Mark Twain Cave' && l.category === 'cave-system'));
  assert.equal(pack.locations.find((l) => l.name === 'Elephant Rocks').area, 'Iron County');
});

test('real Overture Divisions names are exactly the areas a landmark pack wants', () => {
  const layer = createWorldLayer();
  const { byLevel } = importOvertureDivisions(layer, [
    { names: { primary: 'Forest Park' }, subtype: 'neighborhood', lat: 38.64, lng: -90.29 },
    { names: { primary: 'Downtown' }, subtype: 'neighborhood', lat: 38.63, lng: -90.19 },
    { names: { primary: 'Missouri' }, subtype: 'region', lat: 38.5, lng: -92.3 },
  ]);
  // `byLevel.community` is already the shape `landmarkPacks.js`
  // validates as `pack.areas` — a caller assembling a real pack
  // passes it straight through, no transform needed.
  assert.deepEqual(byLevel.community.sort(), ['Downtown', 'Forest Park']);
});
