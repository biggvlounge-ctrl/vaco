// World Layer — the cost model, measured rather than asserted.
//
// Two savings are claimed by `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`
// and until now neither could be checked against a running world: asset
// reuse ("one generated gas station appears in thousands of towns") and
// the automation share ("90%+ automated world construction, 10% human
// refinement"). Both are now computed, and this suite is what stops
// them becoming numbers that merely sound right.
//
// The load-bearing test in here is the last one: **a per-unit rate,
// not a lump sum**. The $420K-$960K hero figure covers ~1,200 UNESCO
// locations over the life of the project. Quoted as a launch cost it
// overstates a first release by more than an order of magnitude, and
// that misreading is the single most expensive mistake available in
// this whole cost model.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const locations = require('../locations.js');
const assetLibrary = require('../assetLibrary.js');
const costModel = require('../costModel.js');

function worldWith(tiers = []) {
  const w = locations.createWorldLayer();
  tiers.forEach((tier, i) => {
    locations.generateLocation(w, { name: `L${i}`, lat: i, lng: i, tier });
  });
  return w;
}

// ---------------------------------------------------------------------------
// Reuse
// ---------------------------------------------------------------------------

test('reuse totals the placements against the assets that served them', () => {
  const w = worldWith(['filler']);
  const place = w.locations[0];

  const station = assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'station.glb' });
  const house = assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'house.glb' });

  for (let i = 0; i < 40; i += 1) assetLibrary.useAsset(w, station.id, place.id);
  for (let i = 0; i < 60; i += 1) assetLibrary.useAsset(w, house.id, place.id);

  const report = costModel.getReuseReport(w);
  assert.equal(report.assetsCreated, 2);
  assert.equal(report.placements, 100);
  assert.equal(report.creationsAvoided, 98, '100 placements from 2 assets avoided 98 creations');
  assert.equal(report.reuseRatio, 50);
});

test('an asset nobody placed is inventory, not a saving', () => {
  const w = worldWith(['filler']);
  const place = w.locations[0];
  const used = assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'a.glb' });
  assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'unused.glb' });
  assetLibrary.useAsset(w, used.id, place.id);

  const report = costModel.getReuseReport(w);
  assert.equal(report.unusedAssets, 1);
  assert.equal(report.creationsAvoided, 0, 'one placement from two assets saved nothing');
});

test('reuse is broken out by type, because a reused building is not a reused vehicle', () => {
  const w = worldWith(['filler']);
  const place = w.locations[0];
  const building = assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'b.glb' });
  const vehicle = assetLibrary.registerAsset(w, { assetType: 'vehicle', generatedModel: 'v.glb' });

  for (let i = 0; i < 30; i += 1) assetLibrary.useAsset(w, building.id, place.id);
  assetLibrary.useAsset(w, vehicle.id, place.id);

  const report = costModel.getReuseReport(w);
  assert.equal(report.byType.building.reuseRatio, 30);
  assert.equal(report.byType.vehicle.reuseRatio, 1);
});

test('an empty library reports zero rather than dividing by nothing', () => {
  const report = costModel.getReuseReport(locations.createWorldLayer());
  assert.equal(report.assetsCreated, 0);
  assert.equal(report.reuseRatio, 0);
  assert.equal(report.creationsAvoided, 0);
});

// ---------------------------------------------------------------------------
// Tier coverage — the 90% claim, measured
// ---------------------------------------------------------------------------

test('only hero counts as paid human work; the other two tiers are pipeline output', () => {
  const w = worldWith(['hero', 'regional', 'filler', 'filler', 'filler']);
  const coverage = costModel.getTierCoverage(w);

  assert.equal(coverage.total, 5);
  assert.equal(coverage.paidHumanWork, 1);
  assert.equal(coverage.automated, 4, 'regional is AI-assisted, so it is not per-unit paid work');
  assert.equal(coverage.automatedShare, 80);
});

test('the 90% automation target is reported as met or not, from real counts', () => {
  const missing = worldWith(['hero', 'hero', 'filler', 'filler', 'filler']);
  assert.equal(costModel.getTierCoverage(missing).meetsAutomationTarget, false);

  const meeting = worldWith([
    'hero', 'regional', 'filler', 'filler', 'filler',
    'filler', 'filler', 'filler', 'filler', 'filler',
  ]);
  assert.equal(costModel.getTierCoverage(meeting).automatedShare, 90);
  assert.equal(costModel.getTierCoverage(meeting).meetsAutomationTarget, true);
});

// An empty world has not got 0% automation — it has nothing to have a
// share of. The same unknown-is-not-a-zero rule the flow signals follow.
test('an empty world reports null automation, not 0%', () => {
  const coverage = costModel.getTierCoverage(locations.createWorldLayer());
  assert.equal(coverage.total, 0);
  assert.equal(coverage.automatedShare, null);
  assert.equal(coverage.meetsAutomationTarget, null);
});

test('every tier appears in the breakdown even at zero', () => {
  const coverage = costModel.getTierCoverage(worldWith(['hero']));
  assert.deepEqual(Object.keys(coverage.byTier).sort(), ['filler', 'hero', 'regional']);
  assert.equal(coverage.byTier.filler, 0);
});

// ---------------------------------------------------------------------------
// Estimating a scope
// ---------------------------------------------------------------------------

test('a cost estimate multiplies real counts by supplied rates', () => {
  const w = worldWith(['hero', 'hero', 'regional', 'filler', 'filler', 'filler']);

  const estimate = costModel.estimateBuildCost(w, {
    hero: [350, 800],
    regional: [50, 120],
    filler: [0, 0],
  });

  assert.equal(estimate.low, 2 * 350 + 1 * 50);
  assert.equal(estimate.high, 2 * 800 + 1 * 120);
  assert.deepEqual(estimate.unpricedTiers, []);
});

// The distinction that keeps an estimate honest: a tier priced at zero
// and a tier nobody priced look identical in a total.
test('an unpriced tier is named, not silently treated as free', () => {
  const w = worldWith(['hero', 'regional']);
  const estimate = costModel.estimateBuildCost(w, { hero: [350, 800] });

  assert.deepEqual(estimate.unpricedTiers, ['regional', 'filler']);
  const regional = estimate.lines.find((l) => l.tier === 'regional');
  assert.equal(regional.low, null);
  assert.match(regional.note, /not counted as free/);
  assert.equal(estimate.low, 2 * 350 - 350, 'only the two priced hero locations are in the total');
});

test('nothing in the module prices a world on its own', () => {
  // No hardcoded rate anywhere: an estimate with no rates supplied is
  // zero with every tier flagged, not a number someone might quote.
  const w = worldWith(['hero', 'hero', 'hero']);
  const estimate = costModel.estimateBuildCost(w);

  assert.equal(estimate.low, 0);
  assert.equal(estimate.high, 0);
  assert.equal(estimate.unpricedTiers.length, 3);
});

// ---------------------------------------------------------------------------
// The arithmetic the recommendation rests on
// ---------------------------------------------------------------------------

test('the hero figure is a per-unit rate, and a launch is not 1,200 locations', () => {
  const rate = costModel.HERO_RATE_ON_FILE;

  // The derivation, checked rather than asserted: $420K-$960K over
  // ~1,200 UNESCO locations.
  const [totalLow, totalHigh] = rate.derivedFrom.tierTotal;
  const scope = rate.derivedFrom.tierScope;
  assert.equal(Math.round(totalLow / scope), rate.perLocation[0]);
  assert.equal(Math.round(totalHigh / scope), rate.perLocation[1]);

  // And the consequence. A launch built around one deep city plus a
  // handful of recognisable icons is tens of thousands of dollars of
  // hero work, not hundreds of thousands — the whole reason the
  // lifetime figure must not be quoted as a launch cost.
  const launch = worldWith(Array(25).fill('hero'));
  const estimate = costModel.estimateBuildCost(launch, { hero: rate.perLocation });

  assert.equal(estimate.low, 8750);
  assert.equal(estimate.high, 20000);
  assert.ok(estimate.high < totalLow / 20,
    'a 25-location launch is well under a twentieth of the lifetime figure');
});

test('the full 1,200-location scope reproduces the figure on file', () => {
  // The other direction: if the per-unit rate did not multiply back up
  // to the published total, one of the two would be wrong.
  const full = worldWith(Array(1200).fill('hero'));
  const estimate = costModel.estimateBuildCost(full, {
    hero: costModel.HERO_RATE_ON_FILE.perLocation,
  });

  assert.equal(estimate.low, 420000);
  assert.equal(estimate.high, 960000);
});
