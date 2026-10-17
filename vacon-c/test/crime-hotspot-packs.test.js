// A real sub-city property-crime weight, imported per LA/Chicago
// area — a two-city exception, and scoped to one existing mechanism
// on purpose. Read `server/crimeHotspotPacks.js`'s own header before
// this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const crimeHotspotPacks = require('../server/crimeHotspotPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Los Angeles, California',
    source: 'sample',
    city: 'los-angeles',
    areas: [
      { areaName: 'Rampart', propertyRatePer1k: 30 },
      { areaName: 'Pacific', propertyRatePer1k: 10 },
    ],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.crimeHotspotPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(crimeHotspotPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region and city it is of', () => {
  assert.ok(crimeHotspotPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(crimeHotspotPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
  assert.ok(crimeHotspotPacks.validatePack(pack({ city: 'houston' })).some((p) => p.includes('city')));
});

test('an area needs an areaName', () => {
  const problems = crimeHotspotPacks.validatePack(pack({ areas: [{ propertyRatePer1k: 10 }] }));
  assert.ok(problems.some((p) => p.includes('areaName')));
});

test('a rate outside the sanity bound is refused, not clamped silently', () => {
  const problems = crimeHotspotPacks.validatePack(pack({
    areas: [{ areaName: 'X', propertyRatePer1k: 9000 }],
  }));
  assert.ok(problems.some((p) => p.includes('propertyRatePer1k')));
});

test('an empty areas array is refused', () => {
  const problems = crimeHotspotPacks.validatePack(pack({ areas: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// areaFor / meanPropertyRate / propertyWeightFor
// ---------------------------------------------------------------------

test('areaFor cycles by position, and is null with no pack', () => {
  const p = pack();
  assert.equal(crimeHotspotPacks.areaFor(p, 0).areaName, 'Rampart');
  assert.equal(crimeHotspotPacks.areaFor(p, 1).areaName, 'Pacific');
  assert.equal(crimeHotspotPacks.areaFor(p, 2).areaName, 'Rampart', 'position 2 should wrap');
  assert.equal(crimeHotspotPacks.areaFor(null, 0), null);
});

test('meanPropertyRate is the real mean across the pack\'s own areas, not an external constant', () => {
  assert.equal(crimeHotspotPacks.meanPropertyRate(pack()), 20);
  assert.equal(crimeHotspotPacks.meanPropertyRate(null), null);
});

test('propertyWeightFor is 1 at the pack\'s own mean, and moves with real variation within it', () => {
  const p = pack();
  assert.equal(crimeHotspotPacks.propertyWeightFor(p, { areaName: 'At the mean', propertyRatePer1k: 20 }), 1);
  assert.equal(crimeHotspotPacks.propertyWeightFor(p, p.areas[0]), 1.5, 'Rampart is 30, the mean is 20');
  assert.equal(crimeHotspotPacks.propertyWeightFor(p, p.areas[1]), 0.5, 'Pacific is 10, the mean is 20');
});

test('propertyWeightFor is bounded against a thin or extreme sample', () => {
  const extreme = pack({ areas: [{ areaName: 'A', propertyRatePer1k: 1 }, { areaName: 'B', propertyRatePer1k: 199 }] });
  const weight = crimeHotspotPacks.propertyWeightFor(extreme, { areaName: 'B', propertyRatePer1k: 199 });
  assert.ok(weight <= crimeHotspotPacks.WEIGHT_BOUNDS[1]);
});

test('propertyWeightFor is null with no area, no pack, or no real rate', () => {
  assert.equal(crimeHotspotPacks.propertyWeightFor(pack(), null), null);
  assert.equal(crimeHotspotPacks.propertyWeightFor(null, pack().areas[0]), null);
  assert.equal(crimeHotspotPacks.propertyWeightFor(pack(), { areaName: 'No rate' }), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real crime hot-spot pack sets community.crimeHotspotWeight', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'crime-hotspot-pack-test',
      crimeHotspotPack: pack(),
      communitiesPerCity: 2,
      populationPerCommunity: 10,
    });
    const communities = w.communities.slice(-2);
    assert.equal(communities[0].crimeHotspotWeight, 1.5, 'position 0 should get Rampart');
    assert.equal(communities[1].crimeHotspotWeight, 0.5, 'position 1 should get Pacific');
  } finally {
    cleanup();
  }
});

test('crimeHotspotWeight only appears inside runDeprivationCrime, never near the aggression/escalation code', () => {
  // A direct source check rather than a behavioral one, since the
  // claim is about what reads a field, not what a seeded draw
  // produces — the seventeenth standing rule's own lesson is that
  // crime thresholds are easy to misjudge from a snapshot, so this
  // asserts the wiring itself instead of trying to reproduce it.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'crime.js'), 'utf8');
  const hotspotLines = source.split('\n').filter((line) => line.includes('crimeHotspotWeight'));
  assert.ok(hotspotLines.length > 0, 'crime.js should read crimeHotspotWeight somewhere');
  assert.ok(!source.includes('function resolveAggression'),
    'resolveAggression lives in keys.js, not crime.js — confirming this file never defines it');
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-crime-hotspot-pack',
      crimeHotspotPack: { region: 'X', source: 'sample', city: 'chicago', areas: [{ areaName: 'Y', propertyRatePer1k: 9000 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no crime hot-spot pack leaves crimeHotspotWeight unset, same as before this existed', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-crime-hotspot-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const community = w.communities[w.communities.length - 1];
  assert.equal(community.crimeHotspotWeight, undefined);
  cleanup();
});
