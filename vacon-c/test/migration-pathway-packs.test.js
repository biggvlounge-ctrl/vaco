// A real, documented, predominant immigration pathway per ancestry
// group — reported through `demographics.compositionOf`'s ethnicity
// block, never wired to any decision mechanic. Read
// `server/migrationPathwayPacks.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const migrationPathwayPacks = require('../server/migrationPathwayPacks.js');
const ancestryPacks = require('../server/ancestryPacks.js');
const demographics = require('../server/demographics.js');

test('every real ancestry group except "other" has a documented pathway', () => {
  const realGroups = ancestryPacks.GROUPS.filter((g) => g !== 'other');
  for (const group of realGroups) {
    assert.ok(migrationPathwayPacks.PATHWAYS.includes(migrationPathwayPacks.pathwayFor(group)),
      `${group} has no documented pathway classification`);
  }
});

test('pathwayFor is null for "other" and any unrecognised name — never a guessed default', () => {
  assert.equal(migrationPathwayPacks.pathwayFor('other'), null);
  assert.equal(migrationPathwayPacks.pathwayFor('martian'), null);
});

test('Somali and Bosnian read as refugee-asylee — the two examples that approved this work', () => {
  assert.equal(migrationPathwayPacks.pathwayFor('somali'), 'refugee-asylee');
  assert.equal(migrationPathwayPacks.pathwayFor('bosnian'), 'refugee-asylee');
});

test('legacy European ancestry groups read as legacy-not-applicable, not a fabricated pathway', () => {
  for (const group of ['german', 'irish', 'english', 'italian', 'polish']) {
    assert.equal(migrationPathwayPacks.pathwayFor(group), 'legacy-not-applicable');
  }
});

test('Mexico and the Northern Triangle countries read as mixed, not a single-channel pattern', () => {
  for (const group of ['mexican', 'guatemalan', 'honduran', 'salvadoran']) {
    assert.equal(migrationPathwayPacks.pathwayFor(group), 'mixed');
  }
});

test('describePathway carries the classification and a real source, and is null for "other"', () => {
  const described = migrationPathwayPacks.describePathway('asian-indian');
  assert.equal(described.pathway, 'employment-based');
  assert.equal(described.source, 'dhs-yearbook-cbp-enforcement-statistics');
  assert.equal(migrationPathwayPacks.describePathway('other'), null);
});

test('every key in PATHWAY_BY_GROUP is a real ancestryPacks.GROUPS entry', () => {
  for (const group of Object.keys(migrationPathwayPacks.PATHWAY_BY_GROUP)) {
    assert.ok(ancestryPacks.GROUPS.includes(group), `${group} is not in ancestryPacks.GROUPS`);
  }
});

// ---------------------------------------------------------------------
// Reported through compositionOf, never a per-person fact
// ---------------------------------------------------------------------

test('compositionOf reports the dominant group\'s real pathway', () => {
  const residents = [
    { id: 1, ethnicity: 'somali' }, { id: 2, ethnicity: 'somali' }, { id: 3, ethnicity: 'bosnian' },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.ethnicity.dominantPathway, 'refugee-asylee');
});

test('compositionOf reports a null dominantPathway for the invented vocabulary', () => {
  const residents = [{ id: 1, ethnicity: 'Riverborn' }, { id: 2, ethnicity: 'Riverborn' }];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.ethnicity.dominantPathway, null);
});

test('compositionOf reports a null dominantPathway when nothing is recorded', () => {
  const residents = [{ id: 1, ethnicity: null }, { id: 2, ethnicity: null }];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.equal(composition.ethnicity.dominantPathway, null);
});
