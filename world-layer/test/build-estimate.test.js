// What it would cost to produce this from zero — and the guards that
// keep that estimate from becoming a claim.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const estimate = require('../buildEstimate');
const costModel = require('../costModel');

const repoRoot = path.join(__dirname, '..', '..');

function countLines(dir, filter) {
  let lines = 0;
  let files = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!filter(entry.name)) continue;
    files += 1;
    lines += fs.readFileSync(path.join(dir, entry.name), 'utf8').split('\n').length;
  }
  return { files, lines };
}

// ---------------------------------------------------------------------
// Scope is counted, not claimed
// ---------------------------------------------------------------------

test('the engine scope in BUILD_SCOPE is what is actually on disk', () => {
  // **The whole estimate rests on this.** A scope figure that drifts
  // from the tree turns a derivation into a number somebody typed, and
  // this file would then be exactly the kind of document the rest of
  // this repository keeps finding and correcting.
  const dir = path.join(repoRoot, 'vacon-c', 'server');
  const counted = countLines(dir, (n) => n.endsWith('.js'));
  assert.equal(counted.files, estimate.BUILD_SCOPE.engine.modules,
    `BUILD_SCOPE says ${estimate.BUILD_SCOPE.engine.modules} engine modules, found ${counted.files}`);
  // Lines drift with every commit, so this is a tolerance rather than
  // an equality — but a 10% drift means the estimate needs re-running.
  const drift = Math.abs(counted.lines - estimate.BUILD_SCOPE.engine.lines)
    / estimate.BUILD_SCOPE.engine.lines;
  assert.ok(drift < 0.1,
    `engine lines drifted ${Math.round(drift * 100)}% from BUILD_SCOPE — re-count and re-run `
    + `the estimate (counted ${counted.lines}, recorded ${estimate.BUILD_SCOPE.engine.lines})`);
});

test('the world-layer scope is what is actually on disk', () => {
  const top = countLines(path.join(repoRoot, 'world-layer'), (n) => n.endsWith('.js'));
  const imports = countLines(path.join(repoRoot, 'world-layer', 'imports'), (n) => n.endsWith('.js'));
  const modules = top.files + imports.files;
  assert.equal(modules, estimate.BUILD_SCOPE.worldLayer.modules,
    `BUILD_SCOPE says ${estimate.BUILD_SCOPE.worldLayer.modules} world-layer modules, found ${modules}`);
});

test('the importer count matches the registry, not a number in a comment', () => {
  const sources = require('../sources');
  assert.equal(estimate.BUILD_SCOPE.worldLayer.importers, sources.wiredSources().length);
  assert.equal(estimate.BUILD_SCOPE.worldLayer.sources, sources.SOURCE_NAMES.length);
});

// ---------------------------------------------------------------------
// Rates are assumptions and behave like them
// ---------------------------------------------------------------------

test('no rate supplied is not a rate of zero', () => {
  // The rule costModel.estimateBuildCost already holds. A tier priced
  // at nothing and a tier nobody priced look identical in a total.
  const result = estimate.estimateEngineering();
  assert.equal(result.cost, null);
  assert.equal(result.ratesSupplied, false);
  // The day count is still there, because it does not need a rate and
  // it is the part worth sanity-checking against experience.
  assert.ok(result.days.low > 0);
  assert.ok(result.engineerYears.high > result.engineerYears.low);
});

test('every rate is flagged unverified, like every licence in the registry', () => {
  // A rate typed into prose is a rate nobody re-checks.
  assert.equal(estimate.RATE_ASSUMPTIONS.checkedAt, null);
  assert.equal(estimate.describeEstimate().ratesVerified, false);
});

test('a faster rate gives fewer days, not more', () => {
  // The bands invert between rate and duration, and getting that
  // backwards is a silent way to produce a confidently wrong estimate.
  const slow = estimate.estimateEngineering({ linesPerDay: [10, 20] });
  const fast = estimate.estimateEngineering({ linesPerDay: [200, 400] });
  assert.ok(fast.days.high < slow.days.low);
});

// ---------------------------------------------------------------------
// The category error this file exists to prevent
// ---------------------------------------------------------------------

test('this repository produces a data world, and says so from the tree', () => {
  // Not an opinion: VACON-C's dependencies are express, pg, cors and
  // dotenv. There is no renderer anywhere, so a hero location here is
  // research and a record, not geometry.
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'vacon-c', 'package.json'), 'utf8'),
  );
  const deps = Object.keys(pkg.dependencies ?? {});
  for (const rendering of ['three', 'cesium', '@react-three/fiber', 'babylonjs']) {
    assert.ok(!deps.includes(rendering), `a renderer (${rendering}) is now a dependency — `
      + 'WORLD_KINDS.data.isWhatThisRepoProduces needs revisiting, and so does every '
      + 'content figure that descends from it');
  }
  assert.equal(estimate.WORLD_KINDS.data.isWhatThisRepoProduces, true);
  assert.equal(estimate.WORLD_KINDS.rendered.isWhatThisRepoProduces, false);
});

test('a rendered hero location costs about an order of magnitude more', () => {
  // The most expensive misreading available in these documents, and it
  // is a bigger one than the lifetime-total-as-launch-cost error this
  // project already corrected.
  const comparison = estimate.compareToFigureOnFile(costModel.HERO_RATE_ON_FILE.perLocation);
  assert.equal(comparison.byKind.data.consistent, true,
    'the figure on file should be consistent with a data world — that is what it prices');
  assert.equal(comparison.byKind.rendered.consistent, false);
  assert.ok(comparison.byKind.rendered.shortfallFactor > 4,
    'a rendered world should come out multiples above the figure on file');
});

test('an unknown world kind is refused, never defaulted', () => {
  assert.throws(() => estimate.estimateHeroLocation('photoreal'), /not a world kind/);
});

test('this estimate shares no constant with the figure on file', () => {
  // A derivation that reuses the number it is checking is not a check —
  // the twentieth standing rule, pointed at an estimate.
  const source = fs.readFileSync(path.join(__dirname, '..', 'buildEstimate.js'), 'utf8');
  assert.ok(!/420000|960000|\b350\b\s*,\s*800/.test(source),
    'buildEstimate.js contains the on-file figure, so its comparison is circular');
  assert.ok(!/require\(['"]\.\/costModel/.test(source),
    'buildEstimate.js imports costModel, so it can no longer check it independently');
});

test('tests are reported as scope, not netted off as overhead', () => {
  // They are why the defects in this project were found. An estimate
  // that treats them as waste is pricing a different, worse product.
  const described = estimate.describeEstimate();
  assert.ok(described.testShare > 0.3, 'the test share of this tree is substantial and reported');
});
