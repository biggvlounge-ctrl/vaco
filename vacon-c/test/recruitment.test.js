// VACANCY — chaos-driven recruitment (server/recruitment.js).
//
// "Once the chaos starts to erupt, there will be a lot of recruitment
// and added members for safety. This will depend on the
// characteristics of people that they encounter."

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const recruitment = require('../server/recruitment.js');
const crime = require('../server/crime.js');
const membership = require('../server/membership.js');
const economy = require('../server/economy.js');

// Real shape from `test/crime.test.js`'s own "the danger map and the
// displayed level are built from the same rate" — the known-working
// recipe for a real, non-zero `dangerByCommunity` score, reused
// rather than re-derived.
function dangerousWorld() {
  const w = {
    tick: 400,
    npcs: [],
    communities: [{ id: 1, name: 'Hollow Row' }],
    crimeIncidents: [],
    organizations: [],
    entityOrganizationMemberships: [],
    employmentRecords: [],
    entityTraits: [],
    historicalRecords: [],
    nextEntityId: 1,
  };
  for (let i = 1; i <= 40; i += 1) {
    w.npcs.push({ id: i, communityId: 1, status: 'active', home_property_id: null });
  }
  for (let i = 0; i < 3; i += 1) {
    w.crimeIncidents.push({ id: i + 1, community_id: 1, category: 'theft', tick: 380 });
  }
  economy.reseedIds(w);
  return w;
}

function organization(w, { type = 'gang' } = {}) {
  const org = {
    id: w.nextEntityId++, name: 'Hollow Row Crew', type,
    founder_id: null, leader_id: null, members: 0, assets: 0, income: 0, expenses: 0,
    influence: 20, security: 50, innovation: 50, reputation: 50,
  };
  w.organizations.push(org);
  return org;
}

test('a real non-zero danger score exists for this fixture, same recipe test/crime.test.js already verified', () => {
  const w = dangerousWorld();
  const danger = crime.dangerByCommunity(w, { tick: 400 });
  assert.ok(danger.get(1) > 0, 'the shared fixture no longer produces a measured, non-zero danger score');
});

test('eligibleCandidates excludes existing members and anyone currently imprisoned', () => {
  const w = dangerousWorld();
  const gang = organization(w);
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });
  w.npcs.find((n) => n.id === 2).status = 'imprisoned';

  const candidates = recruitment.eligibleCandidates(w, gang.id, 1).map((n) => n.id);
  assert.ok(!candidates.includes(1), 'an existing member was offered as a fresh recruit');
  assert.ok(!candidates.includes(2), 'someone currently imprisoned was offered a street recruitment');
  assert.equal(candidates.length, 38);
});

test('runChaosRecruitment never recruits when no gang is present in the community, how ever dangerous it is', () => {
  const w = dangerousWorld(); // no organizations at all
  let anyRecruit = false;
  for (let tick = 400; tick < 1000; tick += 1) {
    if (recruitment.runChaosRecruitment(w, { tick }).length > 0) { anyRecruit = true; break; }
  }
  assert.equal(anyRecruit, false, 'a recruitment happened with no real gang present to do the recruiting');
  assert.equal(w.chaosRecruitmentEvents, undefined);
});

test('runChaosRecruitment never recruits when the community has no real measured danger', () => {
  const w = dangerousWorld();
  w.crimeIncidents = []; // real, but genuinely unmeasured/quiet once there is no incident at all
  const gang = organization(w);
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });

  let anyRecruit = false;
  for (let tick = 400; tick < 3000; tick += 1) {
    if (recruitment.runChaosRecruitment(w, { tick }).length > 0) { anyRecruit = true; break; }
  }
  assert.equal(anyRecruit, false, 'recruitment fired in a community with no measured danger at all');
});

test('a real, measured danger score eventually produces a real recruitment into the real present gang, recorded in the real log', () => {
  const w = dangerousWorld();
  const gang = organization(w);
  // Seed one real member so the gang actually has presence in
  // community 1 (membership.organizationPresence is resident-driven).
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const recruited = recruitment.runChaosRecruitment(w, { tick });
    if (recruited.length > 0) result = recruited[0];
  }
  assert.ok(result, 'no recruitment happened across 8000 real seeded draws at a real, non-zero danger score');
  assert.equal(result.organizationId, gang.id);
  assert.equal(result.communityId, 1);
  assert.notEqual(result.entityId, 1, 'the already-recruited founding member was "recruited" a second time');

  const row = w.entityOrganizationMemberships.find(
    (m) => m.entity_id === result.entityId && m.organization_id === gang.id,
  );
  assert.ok(row, 'runChaosRecruitment reported a recruit with no real membership row behind it');

  assert.equal(w.chaosRecruitmentEvents.length, 1);
  assert.equal(recruitment.recruitmentEventsFor(w, 1).length, 1);
  assert.equal(recruitment.recruitmentEventsFor(w, 999).length, 0, 'an event leaked into a community it never happened in');

  assert.ok(w.historicalRecords.some((r) => r.event_type === 'chaos_recruitment'));
});

test('who gets recruited is real and deterministic -- the highest real influenceRatingOf among eligible candidates, not a lottery', () => {
  const w = dangerousWorld();
  const gang = organization(w);
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });

  // Give npc 40 -- deliberately the LAST real candidate in iteration
  // order, not the first, so a mutation that just grabbed
  // `candidates[0]` cannot pass this test by accident -- a real
  // occupation tier bump over every other candidate: the one real,
  // already-derived signal recruitment.js uses for "the
  // characteristics of people they encounter."
  economy.hireEntity(w, {
    entityId: 40, employerOrganizationId: gang.id, wage: 20, position: 'officer', tick: 400,
  });

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const recruited = recruitment.runChaosRecruitment(w, { tick });
    if (recruited.length > 0) result = recruited[0];
  }
  assert.ok(result, 'no recruitment happened across 8000 real seeded draws');
  assert.equal(result.entityId, 40, 'the real highest-influence-rating candidate was not the one recruited');
});

test('BASE_RECRUITMENT_RISK is a real multiple of crime.BASE_DEPRIVATION_RISK, not a bare invented number', () => {
  assert.equal(recruitment.BASE_RECRUITMENT_RISK, crime.BASE_DEPRIVATION_RISK * 10);
});
