// HVNTZ — Hunt discovery: text search and intensity-level filtering.
// Closes this project's own flagged "no hunt discovery beyond the
// Explore Page's ranked feed — no text search or category filters
// over hunts" gap. See lib/hunts.js's own header on searchHunts for
// why intensityLevel (the only real classification a hunt carries) is
// the filter, not an invented category.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createHvntzStore } = require('../lib/revenueStack');
const { createHunt, searchHunts } = require('../lib/hunts');

function seed(store) {
  createHunt(store, { title: 'Downtown Night Crawl', sponsorId: 'sponsor-1', totalBudget: 500, intensityLevel: 'action-based' });
  createHunt(store, { title: 'Riverfront Sunset Stroll', sponsorId: 'sponsor-1', totalBudget: 300, intensityLevel: 'leisurely' });
  createHunt(store, { title: 'Downtown History Walk', sponsorId: 'sponsor-2', totalBudget: 400, intensityLevel: 'moderate' });
}

test('with no filters, every real hunt is returned', () => {
  const store = createHvntzStore();
  seed(store);
  assert.equal(searchHunts(store).length, 3);
});

test('a text query matches title case-insensitively, as a substring', () => {
  const store = createHvntzStore();
  seed(store);
  const results = searchHunts(store, { query: 'downtown' });
  assert.equal(results.length, 2);
  assert.ok(results.every((h) => h.title.toLowerCase().includes('downtown')));
});

test('a query that matches nothing returns an empty list, not an error', () => {
  const store = createHvntzStore();
  seed(store);
  assert.deepStrictEqual(searchHunts(store, { query: 'nonexistent' }), []);
});

test('an intensityLevel filter returns only hunts at that real level', () => {
  const store = createHvntzStore();
  seed(store);
  const results = searchHunts(store, { intensityLevel: 'leisurely' });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Riverfront Sunset Stroll');
});

test('query and intensityLevel compose -- both must match', () => {
  const store = createHvntzStore();
  seed(store);
  const results = searchHunts(store, { query: 'downtown', intensityLevel: 'moderate' });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Downtown History Walk');
});

test('an invalid intensityLevel is refused rather than silently matching nothing', () => {
  const store = createHvntzStore();
  seed(store);
  assert.throws(() => searchHunts(store, { intensityLevel: 'extreme' }), /invalid intensityLevel/);
});
