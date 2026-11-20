// server/youthPrograms.js — community leaders/orgs/tribe gangs
// reopening real youth-program sites (schools, parks, stadiums) when
// idle youth are present in a dangerous community. By direct
// instruction (task #169); see that file's own header for why this
// reuses `control.attempt` and `recruitment.BASE_RECRUITMENT_RISK`
// rather than inventing a second takeover mechanism or a second rate.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const youthPrograms = require('../server/youthPrograms.js');
const property = require('../server/property.js');

const YEAR = 365;

// Same recipe `test/control.test.js` and `test/recruitment.test.js`
// already use for their own fixtures — constructed, not generated
// (standing rule 8), so every assertion is about a specific real
// condition rather than whatever a seed happens to produce.
function world(options = {}) {
  const { tick = 10000 } = options;
  const age = (years) => tick - Math.round(years * YEAR);
  return {
    tick,
    seed: 'youth-programs-test',
    families: [],
    familyMemberships: [],
    npcs: [],
    relationships: [],
    memories: [],
    employmentRecords: [],
    organizations: [],
    entityOrganizationMemberships: [],
    properties: [],
    ownershipRecords: [],
    infrastructure: [],
    communities: [{ id: 1, name: 'Hollow Row' }],
    cities: [],
    civilizations: [],
    entityTraits: [],
    crimeIncidents: [],
    historicalRecords: [],
    events: [],
    inventory: [],
    barterItems: [],
    age,
  };
}

// A real, measurable danger score for community 1 — the same recipe
// `test/recruitment.test.js` already verified against
// `crime.dangerByCommunity`.
function makeDangerous(w) {
  for (let i = 0; i < 3; i += 1) {
    w.crimeIncidents.push({ id: i + 1, community_id: 1, category: 'theft', tick: w.tick - 20 });
  }
}

// A real, idle, resident 19-year-old — `crime.isIdleYouth`'s own real
// age-band/school/employment/membership gate, built for task #166.
function idleYouth(w, communityId = 1) {
  const id = (w.npcs.length ? Math.max(...w.npcs.map((n) => n.id)) : 0) + 1;
  w.npcs.push({
    id, communityId, status: 'active', home_property_id: null,
    createdTick: w.tick - 19 * YEAR, schoolEnrolled: false, enrolledUniversityId: null,
  });
  return id;
}

function kit(w, entityId, quantity = 10) {
  w.inventory.push({
    id: w.inventory.length + 1, holder_entity_id: entityId, item_name: 'Hammer', quantity, condition: 80,
  });
}

// A real tribe with one real, fielded (`youth-labor`) adult resident
// in the given community, carrying the one real tool `compositionFor`
// would otherwise fault it for lacking.
function tribe(w, options = {}) {
  const { id = 900, communityId = 1 } = options;
  w.families.push({
    id, surname: 'Vance', unity: 50, conflict: 0, head_npc_id: null,
  });
  const memberId = (w.npcs.length ? Math.max(...w.npcs.map((n) => n.id)) : 0) + 1;
  w.npcs.push({
    id: memberId, communityId, status: 'alive', home_property_id: null, createdTick: w.tick - 30 * YEAR,
  });
  w.familyMemberships.push({ entity_id: memberId, family_id: id, role: 'sibling', generation_number: 1 });
  kit(w, memberId);
  return id;
}

function school(w, options = {}) {
  const { id = 1, communityId = 1, category = 'school' } = options;
  const p = {
    id, community_id: communityId, landmark_category: category,
    operating_organization_id: null, occupants: [], condition: 80, value: 1000,
  };
  w.properties.push(p);
  return p;
}

test('idleYouthPresent is false with no idle youth resident in the community', () => {
  const w = world();
  assert.equal(youthPrograms.idleYouthPresent(w, 1, w.tick), false);
});

test('idleYouthPresent is true once a real idle youth lives there', () => {
  const w = world();
  idleYouth(w);
  assert.equal(youthPrograms.idleYouthPresent(w, 1, w.tick), true);
});

test('familiesResidentIn finds a real tribe by its living resident member, not by family id order', () => {
  const w = world();
  tribe(w, { id: 42 });
  const found = youthPrograms.familiesResidentIn(w, 1).map((f) => f.id);
  assert.deepEqual(found, [42]);
});

test('youthFacilityTargetsIn offers a real school/park/stadium and refuses a plain business', () => {
  const w = world();
  tribe(w);
  school(w, { id: 1, category: 'school' });
  school(w, { id: 2, category: 'grocery-store' });
  const targets = youthPrograms.youthFacilityTargetsIn(w, 1, 900).map((p) => p.id);
  assert.deepEqual(targets, [1]);
});

test('youthFacilityTargetsIn excludes a facility this same tribe already owns', () => {
  const w = world();
  tribe(w);
  const target = school(w);
  w.ownershipRecords.push({
    entity_id: target.id, owner_entity_id: 900, owner_type: 'family',
    acquired_method: 'stolen', acquired_tick: w.tick - 10,
  });
  const targets = youthPrograms.youthFacilityTargetsIn(w, 1, 900);
  assert.equal(targets.length, 0, 'a school this tribe already holds was offered again');
});

test('runYouthProgramTakeovers never attempts anything with no real danger measured', () => {
  const w = world(); // no crimeIncidents at all — genuinely unmeasured
  tribe(w);
  idleYouth(w);
  school(w);
  let any = false;
  for (let t = w.tick; t < w.tick + 600; t += 1) {
    if (youthPrograms.runYouthProgramTakeovers(w, { tick: t }).length > 0) { any = true; break; }
  }
  assert.equal(any, false, 'an attempt happened in a community with no real measured danger');
});

test('runYouthProgramTakeovers never attempts anything with no idle youth present', () => {
  const w = world();
  makeDangerous(w);
  tribe(w);
  school(w);
  let any = false;
  for (let t = w.tick; t < w.tick + 600; t += 1) {
    if (youthPrograms.runYouthProgramTakeovers(w, { tick: t }).length > 0) { any = true; break; }
  }
  assert.equal(any, false, 'an attempt happened with no real idle youth in the community');
});

test('runYouthProgramTakeovers never attempts anything with no real tribe resident there', () => {
  const w = world();
  makeDangerous(w);
  idleYouth(w);
  school(w); // a school exists, but no family lives here to take it
  let any = false;
  for (let t = w.tick; t < w.tick + 600; t += 1) {
    if (youthPrograms.runYouthProgramTakeovers(w, { tick: t }).length > 0) { any = true; break; }
  }
  assert.equal(any, false, 'an attempt happened with no real tribe resident in the community');
});

test('with real danger, real idle youth and a real resident tribe, a real takeover attempt eventually happens and the result is recorded', () => {
  const w = world();
  makeDangerous(w);
  idleYouth(w);
  tribe(w);
  const target = school(w);

  let attempt = null;
  for (let t = w.tick; t < w.tick + 2000 && attempt === null; t += 1) {
    const results = youthPrograms.runYouthProgramTakeovers(w, { tick: t });
    if (results.length > 0) attempt = results[0];
  }

  assert.ok(attempt, 'no real attempt happened in 2000 ticks with every real condition met');
  assert.equal(attempt.familyId, 900);
  assert.equal(attempt.communityId, 1);
  assert.equal(attempt.propertyId, target.id);
  assert.equal(attempt.category, 'school');
  assert.ok(
    w.historicalRecords.some((r) => r.event_type === 'youth_program_takeover' && r.where_location_id === target.id),
    'no real historical record was written for the attempt',
  );
  if (attempt.succeeded) {
    assert.equal(property.getCurrentOwner(w, target.id)?.owner_entity_id, 900);
  }
});
