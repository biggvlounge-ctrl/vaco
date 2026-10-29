// GLAD Global Forest Change — the one real environmental fact nothing
// else in this registry names at all.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const glad = require('../imports/gladImport');

test('classifyForestStatus refuses coverage outside 0..100', () => {
  assert.throws(() => glad.classifyForestStatus({ treeCoverPct2000: 150 }), /real treeCoverPct2000/);
  assert.throws(() => glad.classifyForestStatus({ treeCoverPct2000: null }), /real treeCoverPct2000/);
});

test('below the published canopy threshold is non-forest regardless of lossYear', () => {
  assert.equal(glad.classifyForestStatus({ treeCoverPct2000: 10 }), 'non-forest');
  assert.equal(glad.classifyForestStatus({ treeCoverPct2000: 29.9 }), 'non-forest');
});

test('forest with no recorded loss is intact; forest with a recorded loss year is lost', () => {
  assert.equal(glad.classifyForestStatus({ treeCoverPct2000: 85, lossYear: null }), 'intact-forest');
  assert.equal(glad.classifyForestStatus({ treeCoverPct2000: 85, lossYear: 2017 }), 'lost-forest');
});

test('a lossYear outside the dataset\'s real range is refused, not silently accepted', () => {
  assert.throws(
    () => glad.classifyForestStatus({ treeCoverPct2000: 90, lossYear: 1999 }),
    /outside the dataset's real range/,
  );
  assert.throws(
    () => glad.classifyForestStatus({ treeCoverPct2000: 90, lossYear: 2999 }),
    /outside the dataset's real range/,
  );
});

test('importForestCover attaches the real record and the derived status together', () => {
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Somewhere', lat: 1, lng: 2, tier: 'filler' });
  glad.importForestCover(layer, place.id, { treeCoverPct2000: 92.4, lossYear: 2019 });

  const forest = place.geographyData.forestCover;
  assert.equal(forest.source, 'glad-global-forest-change');
  assert.equal(forest.treeCoverPct2000, 92.4);
  assert.equal(forest.lossYear, 2019);
  assert.equal(forest.status, 'lost-forest');
  assert.equal(forest.canopyThresholdPct, glad.FOREST_CANOPY_THRESHOLD_PCT);
});

test('a pixel with no recorded loss carries lossYear as null, never zero', () => {
  // Number(null) is 0, and 0 would read as "lost in year zero" — a
  // real, different claim from "never recorded as lost".
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'filler' });
  glad.importForestCover(layer, place.id, { treeCoverPct2000: 80 });
  assert.equal(place.geographyData.forestCover.lossYear, null);
});

test('importForestCover refuses an unknown location', () => {
  const layer = createWorldLayer();
  assert.throws(
    () => glad.importForestCover(layer, 999999, { treeCoverPct2000: 50 }),
    /no location with id 999999/,
  );
});

test('describeForestCoverage tallies real statuses across a world', () => {
  const layer = createWorldLayer();
  const a = generateLocation(layer, { name: 'A', lat: 1, lng: 2, tier: 'filler' });
  const b = generateLocation(layer, { name: 'B', lat: 3, lng: 4, tier: 'filler' });
  const c = generateLocation(layer, { name: 'C', lat: 5, lng: 6, tier: 'filler' });
  glad.importForestCover(layer, a.id, { treeCoverPct2000: 95, lossYear: null });
  glad.importForestCover(layer, b.id, { treeCoverPct2000: 95, lossYear: 2022 });
  glad.importForestCover(layer, c.id, { treeCoverPct2000: 5 });

  const report = glad.describeForestCoverage(layer);
  assert.equal(report.withData, 3);
  assert.deepEqual(report.byStatus, { 'intact-forest': 1, 'lost-forest': 1, 'non-forest': 1 });
  assert.equal(report.total, 3);
});

test('fetchForestChangeTile is honest about being blocked, and names the real import call', () => {
  assert.throws(glad.fetchForestChangeTile, (error) => {
    assert.match(error.message, /not implemented/);
    assert.match(error.message, /proxy allowlist/);
    assert.match(error.message, /importForestCover/);
    return true;
  });
});
