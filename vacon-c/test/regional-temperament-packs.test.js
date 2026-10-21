// A real, peer-reviewed answer to "does a New York person have a
// different temperament than someone in Iowa" — Rentfrow, Gosling &
// Potter's three real psychological regions, reported on the region,
// deliberately not yet wired into the `Aggression`/`Volatility`
// traits it would most directly touch. Read
// `server/regionalTemperamentPacks.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const regionalTemperamentPacks = require('../server/regionalTemperamentPacks.js');
const migration = require('../server/migration.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

test('describeCluster reads a real, cited cluster, and null for an unrecognised key', () => {
  const described = regionalTemperamentPacks.describeCluster('temperamental-and-uninhibited');
  assert.equal(described.label, 'Temperamental and Uninhibited');
  assert.equal(described.source, 'rentfrow-gosling-potter-divided-we-stand-2013');
  assert.equal(regionalTemperamentPacks.describeCluster('made-up-cluster'), null);
});

test('every real cluster is in CLUSTERS and has a description', () => {
  for (const key of regionalTemperamentPacks.CLUSTERS) {
    assert.ok(regionalTemperamentPacks.describeCluster(key), `${key} has no description`);
  }
});

// ---------------------------------------------------------------------
// generateRegion wiring
// ---------------------------------------------------------------------

test('generateRegion reports a real cluster when given a recognised temperamentKey', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', temperamentKey: 'relaxed-and-creative' });
  assert.equal(region.temperamentCluster.label, 'Relaxed and Creative');
});

test('generateRegion leaves temperamentCluster null with no key or an unrecognised one', () => {
  const w = { regions: [] };
  const noKey = migration.generateRegion(w, { name: 'Test Region A' });
  assert.equal(noKey.temperamentCluster, null);
  const badKey = migration.generateRegion(w, { name: 'Test Region B', temperamentKey: 'made-up' });
  assert.equal(badKey.temperamentCluster, null);
  assert.equal(badKey.temperamentKey, 'made-up', 'the key itself is still recorded even if unrecognised');
});

// ---------------------------------------------------------------------
// A world built with it
// ---------------------------------------------------------------------

test('a world built with a real temperamentKey reports it on the generated region', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({
    seed: 'temperament-world-test', temperamentKey: 'friendly-and-conventional',
    communitiesPerCity: 1, populationPerCommunity: 5,
  });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.temperamentKey, 'friendly-and-conventional');
  assert.equal(region.temperamentCluster.label, 'Friendly and Conventional');
});

test('a world with no temperamentKey reports null, same as before this existed', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-temperament-world-test', communitiesPerCity: 1, populationPerCommunity: 5 });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.temperamentKey, null);
  assert.equal(region.temperamentCluster, null);
});

// ---------------------------------------------------------------------
// Deliberately not wired into trait generation
// ---------------------------------------------------------------------

test('no reader of this module appears in keys.js, where Aggression feeds the calibrated escalation system', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'keys.js'), 'utf8');
  assert.ok(!/regionalTemperamentPacks/.test(source),
    'keys.js should not read regionalTemperamentPacks until a calibration pass says otherwise');
});
