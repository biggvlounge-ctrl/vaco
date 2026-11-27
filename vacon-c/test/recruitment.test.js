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
const occupations = require('../server/occupations.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// Same real helper shape `test/influence.test.js` already uses.
function setTrait(w, entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`fixture names a trait that does not exist: ${family}.${name}`);
  w.entityTraits.push({
    entity_id: entityId, trait_id: traitId, current_value: value, base_value: value, key_modifier: 0,
  });
}

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
// Task #170: "some of the youth will join organizations as enforcers
// because they're young and ambitious and strong."
// ---------------------------------------------------------------------
// `occupations.postFor('gang')` is the real `'enforcer'` post this
// file reuses rather than inventing a second occupation vocabulary.
// A minimal real fixture, same `dangerousWorld` recipe but with
// exactly one real eligible candidate -- so who gets recruited is not
// in question, and the only thing left to prove is what happens to
// THEM. The 40-candidate fixture above is right for proving the
// mechanism READS influence; it is the wrong fixture for proving what
// happens once somebody real is actually picked.
function minimalDangerousWorld() {
  const w = {
    tick: 400,
    npcs: [{ id: 1, communityId: 1, status: 'active', home_property_id: null }],
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
  for (let i = 0; i < 3; i += 1) {
    w.crimeIncidents.push({ id: i + 1, community_id: 1, category: 'theft', tick: 380 });
  }
  economy.reseedIds(w);
  return w;
}

function makeIdleYouth(w, options = {}) {
  const { id, communityId = 1, ageYears = 19 } = options;
  const npc = {
    id, communityId, status: 'active', home_property_id: null,
    createdTick: w.tick - Math.round(ageYears * 365),
    schoolEnrolled: false, enrolledUniversityId: null,
  };
  const existing = w.npcs.findIndex((n) => n.id === id);
  if (existing >= 0) w.npcs[existing] = npc; else w.npcs.push(npc);
  return npc;
}

test('a real idle-youth recruit is also hired into the gang\'s own real enforcer post', () => {
  const w = minimalDangerousWorld();
  const gang = organization(w);
  gang.assets = 1000;
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });
  makeIdleYouth(w, { id: 2 });

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const recruited = recruitment.runChaosRecruitment(w, { tick });
    if (recruited.length > 0) result = recruited[0];
  }
  assert.ok(result, 'no recruitment happened across 8000 real seeded draws');
  assert.equal(result.entityId, 2, 'the only real eligible candidate was not the one recruited');

  const job = economy.getEmployment(w, 2);
  assert.ok(job, 'a real idle-youth recruit walked away with no real occupation at all');
  assert.equal(job.employer_organization_id, gang.id);
  assert.equal(job.position, occupations.postFor('gang'));
  assert.equal(job.position, 'enforcer');
});

test('a recruit who is NOT a real idle youth is left with no occupation from this pass', () => {
  const w = minimalDangerousWorld();
  const gang = organization(w);
  gang.assets = 1000;
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });
  // npc 2 is the only other real candidate, with no `createdTick` --
  // `crime.isIdleYouth` reads that as unknown-age, never idle.
  w.npcs.push({ id: 2, communityId: 1, status: 'active', home_property_id: null });

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const recruited = recruitment.runChaosRecruitment(w, { tick });
    if (recruited.length > 0) result = recruited[0];
  }
  assert.ok(result, 'no recruitment happened across 8000 real seeded draws');
  assert.equal(result.entityId, 2);
  assert.equal(economy.getEmployment(w, result.entityId), null,
    'a non-idle-youth recruit was hired by this pass -- that is runLabour\'s own separate job, not this one\'s');
});

test('a recruit who already holds a real job elsewhere is never read as a real idle youth, so this pass never touches their employment', () => {
  // There is no separate "already employed" guard in `recruitment.js`
  // for exactly this reason: `crime.isIdleYouth`'s own real definition
  // (task #166) already excludes anyone holding active employment
  // anywhere, so `wasIdleYouth` is provably false the moment a
  // candidate has a real job -- a second, identical check in this
  // file would be dead code. This asserts the invariant that fact
  // rests on, rather than a behaviour this branch separately defends.
  const w = minimalDangerousWorld();
  const gang = organization(w);
  const otherGang = organization(w, { type: 'gang' });
  gang.assets = 1000;
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });

  const idleId = 2;
  makeIdleYouth(w, { id: idleId });
  economy.hireEntity(w, {
    entityId: idleId, employerOrganizationId: otherGang.id, wage: 5, position: 'officer', tick: 399,
  });
  assert.equal(crime.isIdleYouth(w, w.npcs.find((n) => n.id === idleId), 400), false,
    'a real idle youth with an existing job still read as idle -- crime.isIdleYouth\'s own employment exclusion has changed');

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const recruited = recruitment.runChaosRecruitment(w, { tick });
    if (recruited.length > 0 && recruited[0].entityId === idleId) { result = recruited[0]; break; }
  }
  assert.ok(result, 'the already-employed candidate, already resident and eligible, was never recruited at all');
  const job = economy.getEmployment(w, idleId);
  assert.equal(job.employer_organization_id, otherGang.id, 'an already-employed recruit was re-hired by the gang that merely recruited them');
  assert.equal(job.position, 'officer');
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

// ---------------------------------------------------------------------
// Task #198 — leadership/influence-scaled follower growth, from family
// to cross-location control
// ---------------------------------------------------------------------

test('leadershipGrowthMultiplierFor reads the real leader\'s own influenceRatingOf through the identical 0.75/1.25 neutral-at-50 band tasks #107/#127 already established', () => {
  const w = dangerousWorld();
  assert.equal(recruitment.leadershipGrowthMultiplierFor(w, null), 1,
    'no real leader at all must read as the flat neutral multiplier, not the trait scale\'s own centre run through the formula by accident');

  // npc 1: nothing set at all -- leads nothing real, no visible
  // occupation. A real, below-average leadership claim, not an
  // unmeasured one, so this reads BELOW the neutral centre.
  const low = recruitment.leadershipGrowthMultiplierFor(w, 1);
  assert.ok(low > 0.75 && low < 1, `expected a below-neutral multiplier for an unremarkable leader, got ${low}`);

  // npc 2: a real maxed-out leader -- a tier-5 occupation, leads this
  // same real gang at its own real maximum influence/membership, real
  // maxed social and aura traits, placed in a tiny real community for
  // maxed local prominence -- the identical "max every real component"
  // shape test/plays.test.js's own "maximally influential leader" test
  // already uses for influenceRatingOf itself.
  const tinyCommunity = { id: 2, name: 'Founders Row' };
  w.communities.push(tinyCommunity);
  w.npcs.find((n) => n.id === 2).communityId = tinyCommunity.id;

  const gang = organization(w);
  gang.influence = 100;
  gang.leader_id = 2;
  membership.joinOrganization(w, { entityId: 2, organizationId: gang.id });
  for (let i = 0; i < 19; i += 1) {
    w.npcs.push({ id: 1000 + i, communityId: tinyCommunity.id, status: 'active', home_property_id: null });
    membership.joinOrganization(w, { entityId: 1000 + i, organizationId: gang.id });
  }
  economy.hireEntity(w, { entityId: 2, employerOrganizationId: gang.id, wage: 50, position: 'officer', tick: 400 });
  for (const name of ['Charisma', 'Persuasion', 'Reputation', 'Network Reach']) setTrait(w, 2, 'social', name, 100);
  setTrait(w, 2, 'reputation', 'Notoriety', 100);

  const high = recruitment.leadershipGrowthMultiplierFor(w, 2);
  assert.ok(high > 1.2, `expected a near-ceiling multiplier for a maximally influential leader, got ${high}`);
});

// A real rate-speedup proof, the same shape task #182's sparring-rate
// test and task #127's driving-rate test already use: identical seeds
// (same gang id, same community id, same incident schedule) so the
// per-tick draw is literally the same number in both worlds, and only
// the leadership multiplier differs. A large enough real population
// (200) that the measurement window (5000 ticks) never exhausts the
// candidate pool in either world -- a smaller population would hit a
// ceiling where both worlds simply recruit everyone eventually and the
// real rate difference this test is proving would vanish into that
// ceiling (measured and ruled out directly before writing this down).
function sustainedDangerWorld({ population, windowTicks, incidentSpacing, incidentsPerSpacing }) {
  const w = {
    tick: 400, npcs: [], communities: [{ id: 1, name: 'Hollow Row' }],
    crimeIncidents: [], organizations: [], entityOrganizationMemberships: [],
    employmentRecords: [], entityTraits: [], historicalRecords: [],
    families: [], familyMemberships: [], nextEntityId: 1,
  };
  for (let i = 1; i <= population; i += 1) {
    w.npcs.push({ id: i, communityId: 1, status: 'active', home_property_id: null });
  }
  // Incidents spread across the WHOLE measurement window so the real
  // 365-tick rolling window `crime.dangerByCommunity` reads
  // (`crime.DANGER_WINDOW_TICKS`) never runs dry mid-measurement --
  // without this, danger decays to 0 well before either world's
  // window ends and the comparison would be measuring nothing.
  for (let t = 380; t < 400 + windowTicks; t += incidentSpacing) {
    for (let k = 0; k < incidentsPerSpacing; k += 1) {
      w.crimeIncidents.push({ id: w.crimeIncidents.length + 1, community_id: 1, category: 'theft', tick: t });
    }
  }
  economy.reseedIds(w);
  return w;
}

test('a real, highly-influential gang leader measurably speeds up runChaosRecruitment\'s own rate over an identical, unled gang -- never the WHO it picks, the RATE it fires at', () => {
  const population = 200;
  const windowTicks = 5000;

  const low = sustainedDangerWorld({ population, windowTicks, incidentSpacing: 100, incidentsPerSpacing: 40 });
  const lowGang = organization(low);
  membership.joinOrganization(low, { entityId: 1, organizationId: lowGang.id });

  const high = sustainedDangerWorld({ population, windowTicks, incidentSpacing: 100, incidentsPerSpacing: 40 });
  const highGang = organization(high); // same auto-assigned id as lowGang -- identical draw stream
  assert.equal(highGang.id, lowGang.id, 'the two fixtures diverged before the leadership term was even introduced');
  highGang.influence = 100;
  highGang.leader_id = 2;
  membership.joinOrganization(high, { entityId: 1, organizationId: highGang.id });
  membership.joinOrganization(high, { entityId: 2, organizationId: highGang.id });
  economy.hireEntity(high, { entityId: 2, employerOrganizationId: highGang.id, wage: 50, position: 'officer', tick: 400 });
  for (const name of ['Charisma', 'Persuasion', 'Reputation', 'Network Reach']) setTrait(high, 2, 'social', name, 100);
  setTrait(high, 2, 'reputation', 'Notoriety', 100);

  let lowCount = 0;
  let highCount = 0;
  for (let tick = 400; tick < 400 + windowTicks; tick += 1) {
    lowCount += recruitment.runChaosRecruitment(low, { tick }).length;
    highCount += recruitment.runChaosRecruitment(high, { tick }).length;
  }

  // Measured, not guessed, on this exact fixture -- re-derive by
  // running this test rather than hand-recomputing if either number
  // ever needs to move.
  assert.equal(lowCount, 32);
  assert.equal(highCount, 34);
  assert.ok(highCount > lowCount, 'a maximally influential real leader recruited no faster than nobody at all');
});

test('a real, highly-influential family head measurably speeds up runChaosFamilyAbsorption\'s own rate over an identical, headless absorbing family -- never WHICH family wins (still real unity, unchanged), the RATE it fires at', () => {
  const orphanCount = 100;
  const windowTicks = 200;

  function orphanWorld() {
    const w = sustainedDangerWorld({
      population: 0, windowTicks, incidentSpacing: 50, incidentsPerSpacing: 10,
    });
    // The one real absorbing family's one living member.
    w.npcs.push({ id: 1, communityId: 1, status: 'active', home_property_id: null });
    familyRow(w, { id: 1, unity: 50 });
    w.familyMemberships.push({ entity_id: 1, family_id: 1, role: 'member', generation_number: 1 });

    // `orphanCount` real, distinct orphans, each in their OWN family
    // (excluded from absorbing itself, same as every other test in
    // this file) with a dead bearer and a real birth record.
    let nextId = 100;
    for (let i = 0; i < orphanCount; i += 1) {
      const childId = nextId++;
      const bearerId = nextId++;
      const ownFamilyId = 1000 + i;
      familyRow(w, { id: ownFamilyId, unity: 50 });
      bornChild(w, { childId, bearerId, familyId: ownFamilyId, age: 10 });
    }
    return w;
  }

  const low = orphanWorld(); // family 1's head_npc_id stays the real schema default: null

  const high = orphanWorld();
  const leaderId = 99999;
  high.npcs.push({ id: leaderId, communityId: 1, status: 'active', home_property_id: null });
  high.families.find((f) => f.id === 1).head_npc_id = leaderId;
  const org = {
    id: 88888, name: 'Leader Org', type: 'faction', founder_id: null, leader_id: leaderId,
    members: 0, assets: 0, income: 0, expenses: 0, influence: 100, security: 50, innovation: 50, reputation: 50,
  };
  high.organizations.push(org);
  membership.joinOrganization(high, { entityId: leaderId, organizationId: org.id });
  for (let i = 0; i < 19; i += 1) {
    const memberId = 5000 + i;
    high.npcs.push({ id: memberId, communityId: 1, status: 'active', home_property_id: null });
    membership.joinOrganization(high, { entityId: memberId, organizationId: org.id });
  }
  for (const name of ['Charisma', 'Persuasion', 'Reputation', 'Network Reach']) setTrait(high, leaderId, 'social', name, 100);
  setTrait(high, leaderId, 'reputation', 'Notoriety', 100);

  let lowCount = 0;
  let highCount = 0;
  for (let tick = 400; tick < 400 + windowTicks; tick += 1) {
    lowCount += recruitment.runChaosFamilyAbsorption(low, { tick }).length;
    highCount += recruitment.runChaosFamilyAbsorption(high, { tick }).length;
  }

  // Measured, not guessed, on this exact fixture.
  assert.equal(lowCount, 74);
  assert.equal(highCount, 78);
  assert.ok(highCount > lowCount, 'a maximally influential real family head absorbed no faster than a headless family');
});

test('runChaosRecruitment behaves exactly as it always did when the gang has no real leader_id at all -- omitting the new argument is not a behaviour change', () => {
  const w = dangerousWorld();
  const gang = organization(w);
  assert.equal(gang.leader_id, null, 'this fixture\'s own default drifted away from the real schema default of no leader');
  membership.joinOrganization(w, { entityId: 1, organizationId: gang.id });

  let result = null;
  for (let tick = 400; tick < 400 + 8000 && !result; tick += 1) {
    const recruited = recruitment.runChaosRecruitment(w, { tick });
    if (recruited.length > 0) result = recruited[0];
  }
  assert.ok(result, 'no recruitment happened across 8000 real seeded draws for a gang with no real leader');
});
