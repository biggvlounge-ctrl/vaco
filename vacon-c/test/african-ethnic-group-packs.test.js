// A real, documented country-level ethnic/tribal composition
// reference — for the nationality, never for any American community
// or any one generated person. Read
// `server/africanEthnicGroupPacks.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const africanEthnicGroupPacks = require('../server/africanEthnicGroupPacks.js');
const ancestryPacks = require('../server/ancestryPacks.js');
const demographics = require('../server/demographics.js');

test('every covered country is a real ancestryPacks.GROUPS entry', () => {
  for (const group of Object.keys(africanEthnicGroupPacks.COMPOSITION)) {
    assert.ok(ancestryPacks.GROUPS.includes(group), `${group} is not in ancestryPacks.GROUPS`);
  }
});

test('compositionFor reads a real country\'s documented groups, summing close to 1', () => {
  const nigeria = africanEthnicGroupPacks.compositionFor('nigerian');
  assert.equal(nigeria.country, 'Nigeria');
  const total = Object.values(nigeria.groups).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 0.01, 'a country\'s named groups plus "other" should sum to ~1');
});

test('compositionFor is null for a country this table does not cover', () => {
  assert.equal(africanEthnicGroupPacks.compositionFor('somali'), null);
  assert.equal(africanEthnicGroupPacks.compositionFor('german'), null);
});

test('describeComposition carries the real source, and is null for an uncovered group', () => {
  const described = africanEthnicGroupPacks.describeComposition('kenyan');
  assert.equal(described.country, 'Kenya');
  assert.equal(described.source, 'cia-world-factbook-style-reference');
  assert.equal(africanEthnicGroupPacks.describeComposition('other'), null);
});

// ---------------------------------------------------------------------
// Reported through compositionOf, a fact about the country, never a
// per-person fact
// ---------------------------------------------------------------------

test('compositionOf reports the dominant group\'s real country composition', () => {
  const residents = [
    { id: 1, ethnicity: 'ethiopian' }, { id: 2, ethnicity: 'ethiopian' }, { id: 3, ethnicity: 'kenyan' },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.ethnicity.dominantEthnicComposition.country, 'Ethiopia');
});

test('compositionOf reports null dominantEthnicComposition for a group this table does not cover', () => {
  const residents = [{ id: 1, ethnicity: 'german' }, { id: 2, ethnicity: 'german' }];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.ethnicity.dominantEthnicComposition, null);
});
