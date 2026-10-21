// U.S. Census ACS Ancestry (Table B04006) import — real national-origin
// composition, for a field `worldgen.js` otherwise draws from an
// invented vocabulary. Read `imports/ancestryImport.js`'s own header
// before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const ancestry = require('../imports/ancestryImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'Tract 1', lat: 44.9, lng: -93.2, tier: 'filler' });
}

test('groupFor keeps Somali, Bosnian and named country groups as their own groups, not folded into a region', () => {
  assert.equal(ancestry.groupFor('somali'), 'somali');
  assert.equal(ancestry.groupFor('bosnian'), 'bosnian');
  assert.equal(ancestry.groupFor('nigerian'), 'nigerian');
  assert.equal(ancestry.groupFor('ethiopian'), 'ethiopian');
  assert.equal(ancestry.groupFor('subsaharanAfricanOther'), 'subsaharan-african');
  assert.equal(ancestry.groupFor('unknownCode'), null);
});

test('toDistribution with no population figure gives no shares, not shares of the claimed total', () => {
  const result = ancestry.toDistribution({ somali: 5000 }, null);
  assert.equal(result.shares, null);
});

test('toDistribution computes real shares, with the remainder as unspecified', () => {
  const result = ancestry.toDistribution({ somali: 6000, bosnian: 2000 }, 20000);
  assert.equal(result.shares.somali, 0.3);
  assert.equal(result.shares.bosnian, 0.1);
  assert.equal(result.shares.unspecified, 0.6);
});

test('an unrecognised code is counted under other and named, never silently dropped', () => {
  const result = ancestry.toDistribution({ somali: 1000, martian: 500 }, 10000);
  assert.equal(result.shares.other, 0.05);
  assert.deepEqual(result.unrecognised, [{ code: 'martian', count: 500 }]);
});

test('importAncestryTract requires a tractId', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => ancestry.importAncestryTract(w, p.id, { counts: { somali: 100 } }), /tractId/);
});

test('importAncestryTract writes real shares, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  ancestry.importAncestryTract(w, p.id, {
    tractId: '27053001100', year: 2022, population: 5000, counts: { somali: 1500, german: 1000 },
  });
  assert.equal(p.populationData.ancestry.source, 'us-census-acs-ancestry');
  assert.equal(p.populationData.ancestry.shares.somali, 0.3);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('describeAncestryCoverage reports tracts with no usable shares and unrecognised codes', () => {
  const w = createWorldLayer();
  ancestry.importAncestryTract(w, place(w).id, { tractId: 'A', population: 1000, counts: { somali: 200 } });
  ancestry.importAncestryTract(w, place(w).id, { tractId: 'B', population: null });
  const report = ancestry.describeAncestryCoverage(w);
  assert.equal(report.tracts, 2);
  assert.equal(report.withShares, 1);
  assert.equal(report.withoutPopulation, 1);
});

test('fetchAncestryTable throws naming the block, like every importer in this registry', () => {
  assert.throws(ancestry.fetchAncestryTable, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
