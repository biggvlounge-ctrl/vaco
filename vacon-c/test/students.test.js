// University students as a real population, not employees -- by
// direct instruction, continuing "the next five." Read
// `server/students.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const students = require('../server/students.js');

const YEAR = 365;

function world(options = {}) {
  const { tick = 10000 } = options;
  return {
    tick,
    npcs: [],
    communities: [],
    cities: [],
    properties: [],
    employmentRecords: [],
  };
}

let nextId = 1;
let nextCommunityId = 1;
let nextCityId = 1;
let nextPropertyId = 1;

function cityWithUniversity(w, { universities = 1 } = {}) {
  const cityId = nextCityId++;
  w.cities.push({ id: cityId });
  const communityId = nextCommunityId++;
  w.communities.push({ id: communityId, city_id: cityId });
  for (let i = 0; i < universities; i += 1) {
    w.properties.push({ id: nextPropertyId++, landmark_category: 'university', city_id: cityId });
  }
  return { cityId, communityId };
}

function cityWithoutUniversity(w) {
  const cityId = nextCityId++;
  w.cities.push({ id: cityId });
  const communityId = nextCommunityId++;
  w.communities.push({ id: communityId, city_id: cityId });
  return { cityId, communityId };
}

function resident(w, communityId, options = {}) {
  const {
    years = 20, education = 'secondary', enrolledUniversityId = null,
  } = options;
  const id = nextId++;
  w.npcs.push({
    id, communityId, createdTick: w.tick - Math.round(years * YEAR), education, enrolledUniversityId,
  });
  return id;
}

function employ(w, entityId, organizationId = 500) {
  w.employmentRecords.push({
    id: w.employmentRecords.length + 1, entity_id: entityId, employer_organization_id: organizationId, status: 'active', wage: 20,
  });
}

// ---------------------------------------------------------------------
// universitiesInCity / isEnrolled
// ---------------------------------------------------------------------

test('universitiesInCity finds every real university in the city and none outside it', () => {
  const w = world();
  const { cityId } = cityWithUniversity(w, { universities: 2 });
  const other = cityWithUniversity(w, { universities: 1 });
  const found = students.universitiesInCity(w, cityId);
  assert.equal(found.length, 2);
  assert.ok(found.every((p) => p.city_id === cityId));
  assert.ok(!found.some((p) => p.city_id === other.cityId));
});

test('isEnrolled reads npc.enrolledUniversityId honestly, null is not enrolled', () => {
  assert.equal(students.isEnrolled({ enrolledUniversityId: null }), false);
  assert.equal(students.isEnrolled({ enrolledUniversityId: undefined }), false);
  assert.equal(students.isEnrolled({ enrolledUniversityId: 7 }), true);
});

// ---------------------------------------------------------------------
// eligibleForEnrollment
// ---------------------------------------------------------------------

test('a real, unemployed, right-aged, right-attainment resident is eligible', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const id = resident(w, communityId, { years: 20, education: 'secondary' });
  const npc = w.npcs.find((n) => n.id === id);
  assert.equal(students.eligibleForEnrollment(w, npc, w.tick), true);
});

test('an already-enrolled resident is never eligible a second time', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const id = resident(w, communityId, { years: 20, education: 'secondary', enrolledUniversityId: 999 });
  const npc = w.npcs.find((n) => n.id === id);
  assert.equal(students.eligibleForEnrollment(w, npc, w.tick), false);
});

test('an active employee is never eligible -- the "not employees" line, read literally', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const id = resident(w, communityId, { years: 20, education: 'secondary' });
  employ(w, id);
  const npc = w.npcs.find((n) => n.id === id);
  assert.equal(students.eligibleForEnrollment(w, npc, w.tick), false);
});

test('too young or too old is never eligible', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const tooYoung = resident(w, communityId, { years: 16, education: 'secondary' });
  const tooOld = resident(w, communityId, { years: 35, education: 'secondary' });
  assert.equal(students.eligibleForEnrollment(w, w.npcs.find((n) => n.id === tooYoung), w.tick), false);
  assert.equal(students.eligibleForEnrollment(w, w.npcs.find((n) => n.id === tooOld), w.tick), false);
});

test('attainment below secondary, or already at the top rung, is never eligible', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const belowSecondary = resident(w, communityId, { years: 20, education: 'basic' });
  const atTop = resident(w, communityId, { years: 20, education: 'advanced' });
  assert.equal(students.eligibleForEnrollment(w, w.npcs.find((n) => n.id === belowSecondary), w.tick), false);
  assert.equal(students.eligibleForEnrollment(w, w.npcs.find((n) => n.id === atTop), w.tick), false);
});

// ---------------------------------------------------------------------
// runEnrollment
// ---------------------------------------------------------------------

test('a city with a real university enrolls real new students, bounded by the real NCES rate', () => {
  const w = world();
  const { communityId, cityId } = cityWithUniversity(w);
  const residentIds = [];
  for (let i = 0; i < 20; i += 1) residentIds.push(resident(w, communityId, { years: 20, education: 'secondary' }));

  const events = students.runEnrollment(w, w.tick);
  const enrolledEvents = events.filter((e) => e.type === 'student_enrolled');
  const expectedCapacity = Math.round(20 * students.NCES_COLLEGE_ENROLLMENT_RATE);
  assert.equal(enrolledEvents.length, expectedCapacity);

  const enrolledCount = w.npcs.filter((n) => students.isEnrolled(n)).length;
  assert.equal(enrolledCount, expectedCapacity);
  const university = students.universitiesInCity(w, cityId)[0];
  for (const npc of w.npcs) {
    if (students.isEnrolled(npc)) assert.equal(npc.enrolledUniversityId, university.id);
  }
});

test('a city with no real university enrolls nobody at all -- a real, honest no-op', () => {
  const w = world();
  const { communityId } = cityWithoutUniversity(w);
  for (let i = 0; i < 20; i += 1) resident(w, communityId, { years: 20, education: 'secondary' });

  const events = students.runEnrollment(w, w.tick);
  assert.equal(events.filter((e) => e.type === 'student_enrolled').length, 0);
  assert.equal(w.npcs.filter((n) => students.isEnrolled(n)).length, 0);
});

test('reaching the top rung while enrolled is a real graduation, not a dropout', () => {
  const w = world();
  const { communityId, cityId } = cityWithUniversity(w);
  const university = students.universitiesInCity(w, cityId)[0];
  const id = resident(w, communityId, { years: 22, education: 'advanced', enrolledUniversityId: university.id });

  const events = students.runEnrollment(w, w.tick);
  const grad = events.find((e) => e.type === 'student_graduated' && e.affected_entity_ids.includes(id));
  assert.ok(grad, 'graduation event never fired');
  assert.equal(events.some((e) => e.type === 'student_dropped_out' && e.affected_entity_ids.includes(id)), false);
  assert.equal(w.npcs.find((n) => n.id === id).enrolledUniversityId, null);
});

test('aging out while still enrolled and short of the top rung is a real dropout', () => {
  const w = world();
  const { communityId, cityId } = cityWithUniversity(w);
  const university = students.universitiesInCity(w, cityId)[0];
  const id = resident(w, communityId, { years: 31, education: 'higher', enrolledUniversityId: university.id });

  const events = students.runEnrollment(w, w.tick);
  const dropped = events.find((e) => e.type === 'student_dropped_out' && e.affected_entity_ids.includes(id));
  assert.ok(dropped, 'dropout event never fired for someone who aged out');
  assert.equal(w.npcs.find((n) => n.id === id).enrolledUniversityId, null);
});

test('becoming employed while enrolled is a real dropout -- never both at once', () => {
  const w = world();
  const { communityId, cityId } = cityWithUniversity(w);
  const university = students.universitiesInCity(w, cityId)[0];
  const id = resident(w, communityId, { years: 20, education: 'higher', enrolledUniversityId: university.id });
  employ(w, id);

  const events = students.runEnrollment(w, w.tick);
  const dropped = events.find((e) => e.type === 'student_dropped_out' && e.affected_entity_ids.includes(id));
  assert.ok(dropped, 'dropout event never fired for a newly-employed enrolled resident');
  assert.equal(w.npcs.find((n) => n.id === id).enrolledUniversityId, null);
});

test('losing the real university itself (no longer in the city) is a real dropout', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w, { universities: 0 });
  const id = resident(w, communityId, { years: 20, education: 'higher', enrolledUniversityId: 999999 });

  const events = students.runEnrollment(w, w.tick);
  const dropped = events.find((e) => e.type === 'student_dropped_out' && e.affected_entity_ids.includes(id));
  assert.ok(dropped, 'dropout event never fired when the real university is gone');
});

// ---------------------------------------------------------------------
// studentsOf
// ---------------------------------------------------------------------

test('studentsOf reports real students at this specific building, and only this one', () => {
  const w = world();
  const { communityId, cityId } = cityWithUniversity(w, { universities: 2 });
  const [uniA, uniB] = students.universitiesInCity(w, cityId);
  const a = resident(w, communityId, { years: 20, education: 'higher', enrolledUniversityId: uniA.id });
  resident(w, communityId, { years: 20, education: 'higher', enrolledUniversityId: uniB.id });

  const atA = students.studentsOf(w, uniA.id);
  assert.equal(atA.length, 1);
  assert.equal(atA[0].id, a);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: the employment exclusion is the real reason an employee is never drawn as a new student', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const employedId = resident(w, communityId, { years: 20, education: 'secondary' });
  employ(w, employedId);

  const events = students.runEnrollment(w, w.tick);
  assert.equal(events.some((e) => e.type === 'student_enrolled' && e.affected_entity_ids.includes(employedId)), false,
    'an active employee was enrolled as a new student -- the exclusion gate is not doing its real job');
});

test('mutation check: real capacity actually bounds enrollment rather than enrolling the whole eligible pool', () => {
  const w = world();
  const { communityId } = cityWithUniversity(w);
  const poolSize = 10;
  for (let i = 0; i < poolSize; i += 1) resident(w, communityId, { years: 20, education: 'secondary' });

  const events = students.runEnrollment(w, w.tick);
  const enrolledCount = events.filter((e) => e.type === 'student_enrolled').length;
  const expectedCapacity = Math.round(poolSize * students.NCES_COLLEGE_ENROLLMENT_RATE);
  assert.ok(expectedCapacity < poolSize, 'this fixture must leave real headroom, or the bound below proves nothing');
  assert.equal(enrolledCount, expectedCapacity,
    'every eligible resident was enrolled regardless of real capacity -- the cap is not doing its real job');
});

test('mutation check: the top-rung check is the real reason graduation and dropout are reported separately', () => {
  const w = world();
  const { communityId, cityId } = cityWithUniversity(w);
  const university = students.universitiesInCity(w, cityId)[0];
  const id = resident(w, communityId, { years: 22, education: 'advanced', enrolledUniversityId: university.id });

  const events = students.runEnrollment(w, w.tick);
  assert.equal(events.some((e) => e.type === 'student_dropped_out' && e.affected_entity_ids.includes(id)), false,
    'a real graduate at the top rung was reported as a dropout -- the top-rung check is not doing its real job');
});
