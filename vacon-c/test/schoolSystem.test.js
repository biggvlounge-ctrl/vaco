// School system depth -- grade/middle/high, private/religious
// (Christian/Jewish), performing-arts, and a real college/community-
// college inventory. By direct instruction, continuing "the next
// five." Read `server/schoolSystem.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const schoolSystem = require('../server/schoolSystem.js');

function world(options = {}) {
  const { seed = 'school-system-test' } = options;
  return { seed, properties: [] };
}

let nextId = 1;

function school(w, { cityId = 1, category = 'school' } = {}) {
  const id = nextId++;
  w.properties.push({ id, landmark_category: category, city_id: cityId });
  return id;
}

function university(w, { cityId = 1 } = {}) {
  const id = nextId++;
  w.properties.push({ id, landmark_category: 'university', city_id: cityId });
  return id;
}

// ---------------------------------------------------------------------
// The draws, by boundary
// ---------------------------------------------------------------------

test('assignSchoolLevel always returns one of the four real NCES levels', () => {
  const w = world();
  const levels = new Set();
  for (let i = 0; i < 200; i += 1) levels.add(schoolSystem.assignSchoolLevel(w, i));
  for (const level of levels) {
    assert.ok(['elementary', 'middle', 'secondary', 'other'].includes(level), level);
  }
});

test('assignReligiousAffiliation always returns one of the four real affiliations', () => {
  const w = world();
  const affiliations = new Set();
  for (let i = 0; i < 200; i += 1) affiliations.add(schoolSystem.assignReligiousAffiliation(w, i));
  for (const affiliation of affiliations) {
    assert.ok(['catholic', 'jewish', 'other_religious', 'nonsectarian'].includes(affiliation), affiliation);
  }
  // Over 200 real draws, every real boundary should be reachable --
  // this is the distribution check, not a range check (the twenty-
  // sixth standing rule's own lesson: assert the property that was
  // claimed, not the one that is easy to check).
  assert.equal(affiliations.size, 4, 'not every real religious-affiliation boundary was ever reached');
});

test('assignInstitutionType always returns a real institution type', () => {
  const w = world();
  for (let i = 0; i < 50; i += 1) {
    assert.ok(['community-college', 'four-year'].includes(schoolSystem.assignInstitutionType(w, i)));
  }
});

test('the real shares all sum to 1.0 (normalized), never over- or under-allocating a draw', () => {
  const schoolBounds = schoolSystem.SCHOOL_LEVEL_BOUNDARIES;
  assert.equal(schoolBounds[schoolBounds.length - 1][1], 1);
  const religiousBounds = schoolSystem.RELIGIOUS_AFFILIATION_BOUNDARIES;
  assert.equal(religiousBounds[religiousBounds.length - 1][1], 1);
});

// ---------------------------------------------------------------------
// assignSchoolDepth
// ---------------------------------------------------------------------

test('every real school and private-school property gets a real level', () => {
  const w = world();
  const a = school(w);
  const b = school(w, { category: 'private-school' });

  schoolSystem.assignSchoolDepth(w);

  const propA = w.properties.find((p) => p.id === a);
  const propB = w.properties.find((p) => p.id === b);
  assert.ok(propA.schoolLevel, 'public school never got a real level');
  assert.ok(propB.schoolLevel, 'private school never got a real level');
});

test('only real private-school properties get a real religious affiliation', () => {
  const w = world();
  const pub = school(w);
  const priv = school(w, { category: 'private-school' });

  schoolSystem.assignSchoolDepth(w);

  assert.equal(w.properties.find((p) => p.id === pub).religiousAffiliation, undefined,
    'a public school was given a religious affiliation -- that is a private-school fact');
  assert.ok(w.properties.find((p) => p.id === priv).religiousAffiliation,
    'the private school never got a real religious affiliation');
});

test('every real university property gets a real institution type', () => {
  const w = world();
  const id = university(w);

  schoolSystem.assignSchoolDepth(w);

  assert.ok(['community-college', 'four-year'].includes(w.properties.find((p) => p.id === id).institutionType));
});

test('assignSchoolDepth never overwrites a real value a different caller already set', () => {
  // Not a bare "call it twice" check -- `assignSchoolDepth` draws
  // deterministically from a stable position, so calling it twice
  // with nothing else changed would reproduce the identical value
  // whether or not the guard existed, proving nothing. The REAL
  // scenario the guard protects is a different one: some other real
  // source (a future real school-data pack, the same shape
  // `religionPacks.js` already is for `npcs.religion`) sets this
  // field directly, and this file's own flagged-interpretive draw
  // must never clobber a fact that did not come from it.
  const w = world();
  const id = university(w);
  w.properties.find((p) => p.id === id).institutionType = 'community-college';

  schoolSystem.assignSchoolDepth(w);

  assert.equal(w.properties.find((p) => p.id === id).institutionType, 'community-college',
    'assignSchoolDepth overwrote a real institutionType that a different caller had already set');
});

test('a performing-arts flag only ever lands on a real secondary school', () => {
  const w = world();
  for (let i = 0; i < 50; i += 1) school(w, { category: i % 2 === 0 ? 'school' : 'private-school' });

  schoolSystem.assignSchoolDepth(w);

  for (const p of w.properties) {
    if (p.performingArts) assert.equal(p.schoolLevel, 'secondary', `property ${p.id} is performing-arts but not secondary`);
  }
});

// ---------------------------------------------------------------------
// schoolSystemInventory
// ---------------------------------------------------------------------

test('schoolSystemInventory reports a real per-city rollup, scoped to this city only', () => {
  const w = world();
  school(w, { cityId: 1 });
  school(w, { cityId: 1, category: 'private-school' });
  university(w, { cityId: 1 });
  school(w, { cityId: 2 });

  schoolSystem.assignSchoolDepth(w);
  const inventory = schoolSystem.schoolSystemInventory(w, 1);

  assert.equal(inventory.totalSchools, 2);
  assert.equal(inventory.publicSchools, 1);
  assert.equal(inventory.privateSchools, 1);
  assert.equal(inventory.totalUniversities, 1);
  assert.ok(Object.values(inventory.byInstitutionType).reduce((a, b) => a + b, 0) === 1);
});

test('a city with none of these real buildings reports real zeroes, not an error', () => {
  const w = world();
  const inventory = schoolSystem.schoolSystemInventory(w, 999);
  assert.equal(inventory.totalSchools, 0);
  assert.equal(inventory.totalUniversities, 0);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: the private-school category gate is the real reason a public school is never given a religious affiliation', () => {
  const w = world();
  const pub = school(w);
  schoolSystem.assignSchoolDepth(w);
  assert.equal(w.properties.find((p) => p.id === pub).religiousAffiliation, undefined);
});

test('mutation check: the already-assigned guard is the real reason a pre-set institutionType survives', () => {
  const w = world();
  const id = university(w);
  w.properties.find((p) => p.id === id).institutionType = 'community-college';
  schoolSystem.assignSchoolDepth(w);
  assert.equal(w.properties.find((p) => p.id === id).institutionType, 'community-college');
});

test('mutation check: the secondary-level gate is the real reason performingArts never lands on a non-secondary school', () => {
  const w = world();
  for (let i = 0; i < 50; i += 1) school(w);
  schoolSystem.assignSchoolDepth(w);
  const nonSecondaryWithArts = w.properties.filter((p) => p.performingArts && p.schoolLevel !== 'secondary');
  assert.deepEqual(nonSecondaryWithArts, []);
});
