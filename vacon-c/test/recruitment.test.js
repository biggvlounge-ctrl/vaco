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
    families: [],
    familyMemberships: [],
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

// ---------------------------------------------------------------------
// Families/tribes: kinship absorbing an already-orphaned child
// ---------------------------------------------------------------------

// `memberId` is explicit, never drawn from `w.nextEntityId` -- this
// fixture's own 40 base NPCs occupy ids 1-40 directly without ever
// advancing that counter (`economy.reseedIds` does not touch it
// either), so an auto-incremented id here would collide with one of
// them.
function familyRow(w, { id, unity = 50, memberId = null, memberCommunityId = null } = {}) {
  const family = {
    id, surname: `Family${id}`, founder_id: null, generation: 1, head_npc_id: null,
    total_members: 0, wealth: 0, reputation: 50, unity, conflict: 0, traditions: null,
    religion: null, political_influence: 0,
  };
  w.families.push(family);
  if (memberId != null) {
    w.npcs.push({ id: memberId, communityId: memberCommunityId, status: 'active', home_property_id: null });
    w.familyMemberships.push({ entity_id: memberId, family_id: id, role: 'member', generation_number: 1 });
    family.total_members = 1;
  }
  return family;
}

// Real shape `births.js` itself writes: a child, a birth historical
// record naming the real bearer (and optional co-parent), and a
// `family_memberships` row for the child under the bearer's own
// family. Built directly rather than run through `births.js`/`tick.js`
// for thousands of real ticks -- the same "construct the state you
// need" fixture style this whole file already uses for `crimeIncidents`.
function bornChild(w, { childId, bearerId, otherId = null, familyId, age }) {
  w.npcs.push({ id: childId, communityId: 1, status: 'active', home_property_id: null, createdTick: 0 });
  // `mortality.ageInYears` reads `createdTick` against the current
  // tick at 365 ticks/year -- backdating `createdTick` is the real way
  // to give a fixture NPC a specific age without waiting real ticks.
  w.npcs.find((n) => n.id === childId).createdTick = w.tick - Math.round(age * 365);
  w.historicalRecords.push({
    what: 'birth', who: [childId, bearerId, ...(otherId ? [otherId] : [])], when_tick: 0,
  });
  if (familyId != null) {
    w.familyMemberships.push({ entity_id: childId, family_id: familyId, role: 'child', generation_number: 2 });
  }
}

test('parentIdsOf reads the real births.js birth record, not a family role nobody ever sets to parent', () => {
  const w = dangerousWorld();
  bornChild(w, { childId: 100, bearerId: 1, otherId: 2, familyId: null, age: 10 });
  assert.deepEqual(recruitment.parentIdsOf(w, 100), [1, 2]);
  assert.equal(recruitment.parentIdsOf(w, 1), null, 'an NPC with no real birth record must read null, not an empty-but-present list');
});

test('isOrphan is true only for a real minor whose every real birth parent is no longer among the living', () => {
  const w = dangerousWorld();
  bornChild(w, { childId: 100, bearerId: 1, familyId: null, age: 10 });
  bornChild(w, { childId: 101, bearerId: 2, otherId: 3, familyId: null, age: 10 });
  bornChild(w, { childId: 102, bearerId: 4, familyId: null, age: 20 }); // adult
  const noBirthRecordMinor = w.npcs.find((n) => n.id === 5);

  // 100's only real parent (1) is removed from the living.
  w.npcs = w.npcs.filter((n) => n.id !== 1);
  assert.equal(recruitment.isOrphan(w, w.npcs.find((n) => n.id === 100)), true);

  // 101 has two real parents (2, 3); only one is removed -- still not an orphan.
  w.npcs = w.npcs.filter((n) => n.id !== 2);
  assert.equal(recruitment.isOrphan(w, w.npcs.find((n) => n.id === 101)), false);

  assert.equal(recruitment.isOrphan(w, w.npcs.find((n) => n.id === 102)), false, 'an adult must never read as an orphan');
  assert.equal(recruitment.isOrphan(w, noBirthRecordMinor), false, 'no real birth record means not a modeled orphan case, not a free pass');
});

test('runChaosFamilyAbsorption absorbs a real orphan into the real highest-unity eligible family, never the orphan\'s own', () => {
  const w = dangerousWorld();
  bornChild(w, { childId: 100, bearerId: 1, familyId: 1, age: 10 });
  w.families = [];
  familyRow(w, { id: 1, unity: 90, memberId: 200, memberCommunityId: 1 }); // the orphan's OWN family -- must never be picked
  familyRow(w, { id: 2, unity: 40, memberId: 201, memberCommunityId: 1 });
  familyRow(w, { id: 3, unity: 75, memberId: 202, memberCommunityId: 1 }); // real highest eligible unity
  w.npcs = w.npcs.filter((n) => n.id !== 1); // the bearer dies

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const absorbed = recruitment.runChaosFamilyAbsorption(w, { tick });
    if (absorbed.length > 0) result = absorbed[0];
  }
  assert.ok(result, 'no absorption happened across 8000 real seeded draws');
  assert.equal(result.entityId, 100);
  assert.equal(result.familyId, 3, 'the real highest-unity eligible family (not the orphan\'s own, not the lower-unity one) was not chosen');

  const row = w.familyMemberships.find((m) => m.entity_id === 100 && m.family_id === 3);
  assert.ok(row, 'runChaosFamilyAbsorption reported an absorption with no real family_memberships row behind it');
  assert.equal(row.role, 'child');

  const family3 = w.families.find((f) => f.id === 3);
  assert.equal(family3.total_members, 2, 'the real absorbing family\'s own total_members was not incremented');

  assert.equal(w.chaosFamilyAbsorptionEvents.length, 1);
  assert.equal(recruitment.familyAbsorptionEventsFor(w, 1).length, 1);
  assert.ok(w.historicalRecords.some((r) => r.event_type === 'chaos_family_absorption'));
});

test('runChaosFamilyAbsorption never absorbs the same real orphan twice', () => {
  const w = dangerousWorld();
  bornChild(w, { childId: 100, bearerId: 1, familyId: 1, age: 10 });
  w.families = [];
  familyRow(w, { id: 1, unity: 50, memberId: 200, memberCommunityId: 1 });
  familyRow(w, { id: 2, unity: 80, memberId: 201, memberCommunityId: 1 });
  w.npcs = w.npcs.filter((n) => n.id !== 1);

  let absorptions = 0;
  for (let tick = 400; tick < 400 + 8000; tick += 1) {
    absorptions += recruitment.runChaosFamilyAbsorption(w, { tick }).length;
  }
  assert.equal(absorptions, 1, 'the same real orphan was absorbed more than once across repeated ticks');
});

test('runChaosFamilyAbsorption never absorbs a real orphan when no other real family has a living member in that community', () => {
  const w = dangerousWorld();
  bornChild(w, { childId: 100, bearerId: 1, familyId: 1, age: 10 });
  w.families = [];
  familyRow(w, { id: 1, unity: 50, memberId: 200, memberCommunityId: 1 }); // the orphan's own, the only one present
  w.npcs = w.npcs.filter((n) => n.id !== 1);

  let absorptions = 0;
  for (let tick = 400; tick < 400 + 8000; tick += 1) {
    absorptions += recruitment.runChaosFamilyAbsorption(w, { tick }).length;
  }
  assert.equal(absorptions, 0, 'an orphan was absorbed with no real eligible family present at all');
});
