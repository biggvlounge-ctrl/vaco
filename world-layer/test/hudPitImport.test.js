// HUD Point-in-Time homelessness count — a real deficit, for a
// mechanism that only ever generates a surplus.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const hud = require('../imports/hudPitImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'CoC Area 1', lat: 38.6, lng: -90.2, tier: 'filler' });
}

test('a missing population figure gives no rate — a rate against an unknown base is invented', () => {
  const result = hud.toHomelessnessRate(50, 20, null);
  assert.equal(result.rate, null);
});

test('a real rate at a plausible level computes correctly', () => {
  const result = hud.toHomelessnessRate(300, 200, 100000);
  assert.equal(result.rate, 0.005);
  assert.equal(result.total, 500);
});

test('a rate outside the sanity bound is refused, not clamped silently', () => {
  const result = hud.toHomelessnessRate(90000, 10000, 100000);
  assert.equal(result.rate, null, '100% homeless is a units error, not a real rate');
});

test('importPitCount requires a cocCode', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => hud.importPitCount(w, p.id, { shelteredCount: 10, population: 1000 }), /cocCode/);
});

test('importPitCount writes a real rate, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  hud.importPitCount(w, p.id, {
    cocCode: 'MO-500', cocName: 'St. Louis CoC', year: 2024,
    shelteredCount: 1200, unshelteredCount: 300, population: 300000,
  });
  assert.equal(p.populationData.homelessness.source, 'hud-pit');
  assert.equal(p.populationData.homelessness.totalCount, 1500);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('describePitCoverage reports a median and the CoCs with no usable rate', () => {
  const w = createWorldLayer();
  hud.importPitCount(w, place(w).id, { cocCode: 'A', shelteredCount: 100, population: 50000 });
  hud.importPitCount(w, place(w).id, { cocCode: 'B', population: null });
  const report = hud.describePitCoverage(w);
  assert.equal(report.cocs, 2);
  assert.equal(report.withRate, 1);
  assert.equal(report.withoutRate, 1);
});

test('fetchPitCounts throws naming the block, like every importer in this registry', () => {
  assert.throws(hud.fetchPitCounts, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
