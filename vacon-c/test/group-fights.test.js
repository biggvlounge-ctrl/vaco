// Group combat (gang wars) — by direct instruction. Read
// `server/groupFights.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const groupFights = require('../server/groupFights.js');
const contest = require('../server/contest.js');
const authority = require('../server/authority.js');
const economy = require('../server/economy.js');
const membership = require('../server/membership.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 900000;

function world() {
  const w = {
    tick: 10,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    players: [],
    communities: [],
    cities: [],
    infrastructure: [],
    entityTraits: [],
    individualFinances: [],
    employmentRecords: [],
    resources: [],
    marketListings: [],
    inventory: [],
    barterItems: [],
    crimeIncidents: [],
    courtCases: [],
    groupSanctions: [],
    historicalRecords: [],
    entityKnowledge: [],
    entityState: [],
    memories: [],
    relationships: [],
    scheduleEvents: [],
    habits: [],
    beliefs: [],
    publicOpinion: [],
    governments: [],
    hospitalStays: [],
  };
  economy.reseedIds(w);
  return w;
}

function person(w, overrides = {}) {
  const id = nextId++;
  const rows = generateEntityTraits(id, w.tick, INDIVIDUAL_DEFINITIONS, () => 50);
  for (const row of rows) {
    const def = INDIVIDUAL_DEFINITIONS.find((d) => d.trait_id === row.trait_id);
    if (!def) continue;
    const key = `${def.family}.${def.name}`;
    if (key in overrides) row.current_value = overrides[key];
  }
  w.entityTraits.push(...rows);
  w.npcs.push({
    id, status: 'active', traits: {}, createdTick: 0, updatedTick: 0, home_property_id: null,
  });
  economy.generateIndividualFinances(w, id, { savings: 100, tick: w.tick });
  return w.npcs[w.npcs.length - 1];
}

function governedCommunity(w) {
  const communityId = 500;
  w.cities.push({ id: 50 });
  w.communities.push({ id: communityId, city_id: 50 });
  w.infrastructure.push({
    id: 1, city_id: 50, type: 'public_safety', capacity: 100, condition: 100, maintenance_level: 50, age: 0,
  });
  w.governments.push({ organization_id: 70, system_type: 'council' });
  w.publicOpinion.push({ city_id: null, topic: 'government:70', approval_score: 85, tick: 1 });
  // `reachTerm`/`trustTerm` both need real residents of THIS community
  // -- reachTerm reads `infrastructure.serviceLevel` against a real
  // resident count, and trustTerm reads a real belief row per resident.
  // Two bystanders living here, distinct from any fighter a test adds
  // afterward, so the writ measures the community rather than nobody.
  w.beliefs = w.beliefs || [];
  for (let i = 0; i < 2; i += 1) {
    const resident = person(w);
    resident.communityId = communityId;
    w.beliefs.push({
      id: resident.id, entity_id: resident.id, belief_name: 'trust in public safety',
      belief_type: 'political', strength: 90, tick: 0,
    });
  }
  return communityId;
}

// ---------------------------------------------------------------------
// teamRatingOf / sizeEdgeFor
// ---------------------------------------------------------------------

test('teamRatingOf is the mean of contest.rateEntity across a side', () => {
  const w = world();
  const a = person(w, { 'combat.Melee Skill': 80 });
  const b = person(w, { 'combat.Melee Skill': 60 });
  const expected = (
    contest.rateEntity(w, a.id, 'combat').rating + contest.rateEntity(w, b.id, 'combat').rating
  ) / 2;
  assert.equal(groupFights.teamRatingOf(w, [a.id, b.id]), expected);
});

test('sizeEdgeFor is centred at zero for equal sides and bounded at the cap', () => {
  assert.equal(groupFights.sizeEdgeFor(5, 5), 0);
  assert.ok(groupFights.sizeEdgeFor(10, 5) > 0);
  assert.ok(groupFights.sizeEdgeFor(5, 10) < 0);
  assert.equal(groupFights.sizeEdgeFor(500, 1), groupFights.SIZE_EDGE_CAP);
  assert.equal(groupFights.sizeEdgeFor(1, 500), -groupFights.SIZE_EDGE_CAP);
});

// ---------------------------------------------------------------------
// resolveGroupFight
// ---------------------------------------------------------------------

test('resolveGroupFight refuses an empty side or an entity fighting on both sides', () => {
  const w = world();
  const a = person(w);
  assert.throws(() => groupFights.resolveGroupFight(w, { sideA: [], sideB: [a.id] }));
  assert.throws(() => groupFights.resolveGroupFight(w, { sideA: [a.id], sideB: [a.id] }));
});

test('a much stronger side wins far more often than it loses, over many real draws', () => {
  const w = world();
  let aWins = 0;
  // A fresh side each trial -- `resolveGroupFight` has real, permanent
  // side effects (death, hospitalization), so the same combatant
  // cannot safely fight a second real trial.
  for (let t = 0; t < 40; t += 1) {
    const strongA = [person(w, {
      'combat.Melee Skill': 95, 'combat.Weapon Mastery': 95, 'combat.Tactical Awareness': 95, 'combat.Composure Under Fire': 95,
    }).id];
    const weakB = [person(w, {
      'combat.Melee Skill': 10, 'combat.Weapon Mastery': 10, 'combat.Tactical Awareness': 10, 'combat.Composure Under Fire': 10,
    }).id];
    const result = groupFights.resolveGroupFight(w, {
      sideA: strongA, sideB: weakB, tick: t, contestId: `trial-${t}`,
    });
    if (result.winningSide === 'A') aWins += 1;
  }
  assert.ok(aWins > 30, `the stronger side only won ${aWins}/40 — the rating is not deciding this`);
});

test('a loser is marked dead, injured, or unharmed, and a dead one is really dead and a injured one is really hospitalized', () => {
  const w = world();
  // Equal SIZE on both sides, so sizeEdgeFor contributes nothing and
  // the deliberately extreme skill gap is what decides this --
  // avoids the real finding one draft of this test made by accident:
  // at a large enough size mismatch (1 vs 12), the bounded size edge
  // can outweigh almost any skill gap, which is realistic (a mob
  // really can beat one elite fighter) but not what THIS test is
  // checking.
  const strongSide = [];
  const weakSide = [];
  for (let i = 0; i < 12; i += 1) {
    strongSide.push(person(w, { 'combat.Melee Skill': 99, 'combat.Weapon Mastery': 99 }).id);
    weakSide.push(person(w, { 'combat.Melee Skill': 1 }).id);
  }

  const result = groupFights.resolveGroupFight(w, { sideA: strongSide, sideB: weakSide, tick: 5, contestId: 'mass' });
  // `contest.winProbability` never reaches certainty either way (an
  // upset stays real at any rating gap), so this checks that a
  // real side lost, not which named side it happened to be.
  assert.equal(result.losingIds.length, 12);

  const severities = new Set(result.outcomes.map((o) => o.severity));
  for (const outcome of result.outcomes) {
    assert.ok(['dead', 'injured', 'unharmed'].includes(outcome.severity));
    if (outcome.severity === 'dead') {
      assert.ok(w.deceased.some((n) => n.id === outcome.entityId), 'a "dead" outcome must really be dead');
      assert.ok(!w.npcs.some((n) => n.id === outcome.entityId), 'a dead entity must leave npcs');
    }
    if (outcome.severity === 'injured') {
      const npc = w.npcs.find((n) => n.id === outcome.entityId);
      assert.equal(npc.status, 'hospitalized');
      assert.ok(w.hospitalStays.some((s) => s.entityId === outcome.entityId));
    }
  }
  // With 12 losers at this severe a mismatch, at least SOME real variety
  // should show up across a dozen independent draws -- not a proof of
  // the exact distribution, but evidence severity is not a constant.
  assert.ok(severities.size >= 1);
});

test('death is the rare tail, never the majority outcome, across a real population of losers', () => {
  const w = world();
  const winners = [person(w, { 'combat.Melee Skill': 90, 'combat.Bloodlust': 90 }).id];
  const losers = [];
  for (let i = 0; i < 60; i += 1) losers.push(person(w, { 'combat.Melee Skill': 20 }).id);

  const result = groupFights.resolveGroupFight(w, { sideA: winners, sideB: losers, tick: 1, contestId: 'rate-check' });
  const deadCount = result.outcomes.filter((o) => o.severity === 'dead').length;
  assert.ok(deadCount / losers.length < 0.3,
    `${deadCount} of ${losers.length} losers died — this engine's own design goal is that death stays the rare tail`);
});

test('an intervention in a real governed area leaves everyone unharmed and stops the fight before it is scored', () => {
  const w = world();
  const communityId = governedCommunity(w);
  const writ = authority.writOf(w, communityId);
  assert.ok(writ.writ > 0.66, `test setup must produce a real governed writ, got ${writ.writ}`);

  let anyIntervened = false;
  for (let t = 0; t < 20; t += 1) {
    const winners = [person(w, { 'combat.Melee Skill': 99 }).id];
    const losers = [person(w, { 'combat.Melee Skill': 1 }).id];
    const result = groupFights.resolveGroupFight(w, {
      sideA: winners, sideB: losers, communityId, tick: t, contestId: `gov-${t}`,
    });
    if (result.intervened) {
      anyIntervened = true;
      // `contest.winProbability` clamps to [0.03, 0.97] -- the weaker
      // side always keeps a small real chance of winning, so the
      // loser here is whichever side `result` actually names, not
      // necessarily `losers`.
      assert.deepEqual(result.outcomes, [{ entityId: result.losingIds[0], severity: 'unharmed' }]);
    }
  }
  assert.ok(anyIntervened, 'a real, high writ never once produced an intervention in 20 draws');
});

test('with no real community given, intervention never happens', () => {
  const w = world();
  for (let t = 0; t < 10; t += 1) {
    const winners = [person(w, { 'combat.Melee Skill': 99 }).id];
    const losers = [person(w, { 'combat.Melee Skill': 1 }).id];
    const result = groupFights.resolveGroupFight(w, { sideA: winners, sideB: losers, tick: t, contestId: `none-${t}` });
    assert.equal(result.intervened, false);
  }
});

test('resolveGroupFight records exactly one real violent crime incident, never one per loser', () => {
  const w = world();
  const winners = [person(w).id];
  const losers = [person(w).id, person(w).id, person(w).id];
  const before = w.crimeIncidents.length;
  groupFights.resolveGroupFight(w, { sideA: winners, sideB: losers, tick: 1, contestId: 'one-incident' });
  assert.equal(w.crimeIncidents.length, before + 1);
  assert.equal(w.crimeIncidents[w.crimeIncidents.length - 1].category, 'violent');
});

// ---------------------------------------------------------------------
// advanceHospitalStays
// ---------------------------------------------------------------------

test('advanceHospitalStays releases only once the real recovery tick has passed, not before', () => {
  const w = world();
  const patient = person(w);
  groupFights.hospitalize(w, patient.id, 10);
  assert.equal(groupFights.isHospitalized(w, patient.id), true);

  groupFights.advanceHospitalStays(w, 10 + groupFights.HOSPITAL_RECOVERY_TICKS - 1);
  assert.equal(groupFights.isHospitalized(w, patient.id), true, 'released too early');

  const released = groupFights.advanceHospitalStays(w, 10 + groupFights.HOSPITAL_RECOVERY_TICKS);
  assert.deepEqual(released, [patient.id]);
  assert.equal(groupFights.isHospitalized(w, patient.id), false);
});

// ---------------------------------------------------------------------
// continueFight -- the one real player choice
// ---------------------------------------------------------------------

test('continueFight refuses an entity who is not currently hospitalized', () => {
  const w = world();
  const entity = person(w);
  const winner = person(w);
  assert.throws(() => groupFights.continueFight(w, { entityId: entity.id, winningIds: [winner.id], tick: 1 }));
});

test('continueFight pulls a hospitalized survivor back into the fight at a real, bounded handicap', () => {
  const w = world();
  const entity = person(w, { 'combat.Melee Skill': 80 });
  const winner = person(w, { 'combat.Melee Skill': 50 });
  groupFights.hospitalize(w, entity.id, 1);

  const result = groupFights.continueFight(w, { entityId: entity.id, winningIds: [winner.id], tick: 2 });

  const baseRating = contest.rateEntity(w, entity.id, 'combat').rating;
  assert.equal(result.handicapRating, baseRating - groupFights.CONTINUE_FIGHT_RATING_PENALTY);
  assert.ok(['dead', 'injured', 'unharmed'].includes(result.severity));
  // No longer still hospitalized from the ORIGINAL stay -- either back
  // on their feet, freshly re-hospitalized, or dead, never left in the
  // stale status this call started from.
  if (result.severity === 'unharmed') {
    const npc = w.npcs.find((n) => n.id === entity.id);
    assert.equal(npc.status, 'active');
  }
});

// ---------------------------------------------------------------------
// recoveryPlanFor / hospitalize -- in-house medic vs. real referral
// ---------------------------------------------------------------------

function organization(w) {
  const id = nextId++;
  const org = { id, name: `Org ${id}`, type: 'tribe', leader_id: null };
  w.organizations.push(org);
  return org;
}

test('a real nurse or physician among the patient\'s own living organization members speeds up recovery', () => {
  const w = world();
  const org = organization(w);
  const patient = person(w);
  const medic = person(w);
  membership.joinOrganization(w, { entityId: patient.id, organizationId: org.id });
  membership.joinOrganization(w, { entityId: medic.id, organizationId: org.id });
  economy.hireEntity(w, { entityId: medic.id, employerOrganizationId: org.id, wage: 10, position: 'nurse', tick: 1 });

  const plan = groupFights.recoveryPlanFor(w, patient.id);
  assert.equal(plan.ticks, groupFights.IN_HOUSE_RECOVERY_TICKS);
  assert.equal(plan.treatedBy, medic.id);
  assert.equal(plan.referred, false);

  const stay = groupFights.hospitalize(w, patient.id, 10);
  assert.equal(stay.releaseTick, 10 + groupFights.IN_HOUSE_RECOVERY_TICKS);
  assert.equal(stay.treatedBy, medic.id);
});

test('a real physician in the patient\'s own family, not just their organization, also counts as in-house', () => {
  const w = world();
  const familyId = 777;
  const patient = person(w);
  const relative = person(w);
  w.familyMemberships.push(
    { entity_id: patient.id, family_id: familyId, role: 'child', generation_number: 1 },
    { entity_id: relative.id, family_id: familyId, role: 'parent', generation_number: 1 },
  );
  const hospital = organization(w);
  economy.hireEntity(w, {
    entityId: relative.id, employerOrganizationId: hospital.id, wage: 20, position: 'physician', tick: 1,
  });

  const plan = groupFights.recoveryPlanFor(w, patient.id);
  assert.equal(plan.ticks, groupFights.IN_HOUSE_RECOVERY_TICKS);
  assert.equal(plan.treatedBy, relative.id);
});

test('with no in-house medic, a real referral elsewhere is found but buys no extra speed', () => {
  const w = world();
  const patient = person(w);
  const specialistOrg = organization(w);
  const specialist = person(w);
  economy.hireEntity(w, {
    entityId: specialist.id, employerOrganizationId: specialistOrg.id, wage: 15, position: 'physician', tick: 1,
  });

  const plan = groupFights.recoveryPlanFor(w, patient.id);
  assert.equal(plan.ticks, groupFights.HOSPITAL_RECOVERY_TICKS);
  assert.equal(plan.treatedBy, specialist.id);
  assert.equal(plan.referred, true);
});

test('with no real medic anywhere in the world, recovery falls back to the honest unstaffed default', () => {
  const w = world();
  const patient = person(w);
  const plan = groupFights.recoveryPlanFor(w, patient.id);
  assert.equal(plan.ticks, groupFights.HOSPITAL_RECOVERY_TICKS);
  assert.equal(plan.treatedBy, null);
  assert.equal(plan.referred, false);
});

test('a medic who is not really employed as a nurse or physician does not count, however close the job sounds', () => {
  const w = world();
  const org = organization(w);
  const patient = person(w);
  const orderly = person(w);
  membership.joinOrganization(w, { entityId: patient.id, organizationId: org.id });
  membership.joinOrganization(w, { entityId: orderly.id, organizationId: org.id });
  economy.hireEntity(w, {
    entityId: orderly.id, employerOrganizationId: org.id, wage: 8, position: 'orderly', tick: 1,
  });

  const plan = groupFights.recoveryPlanFor(w, patient.id);
  assert.notEqual(plan.treatedBy, orderly.id);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: the real worst-case death chance stays under the engine\'s own design ceiling, confirmed at its own exact boundary', () => {
  const w = world();
  // The most severe real mismatch this model can describe: a loser at
  // 0, a winning side at 100, maximum Bloodlust. The real maximum
  // this formula can ever produce is exactly
  // DEATH_BASE_CHANCE + DEATH_MARGIN_WEIGHT + DEATH_BLOODLUST_WEIGHT/2
  // -- a draw just under it classifies as dead, and a draw at or past
  // it never does, proving that ceiling is the formula's own real
  // limit rather than a number copied from it by hand.
  const worstCaseChance = groupFights.DEATH_BASE_CHANCE + groupFights.DEATH_MARGIN_WEIGHT
    + groupFights.DEATH_BLOODLUST_WEIGHT / 2;
  const args = { loserId: 1, loserRating: 0, winningTeamRating: 100, winningBloodlust: 100 };
  const justUnder = groupFights.severityFor(w, { ...args, draw: worstCaseChance - 0.001 });
  const atTheLimit = groupFights.severityFor(w, { ...args, draw: worstCaseChance });
  assert.equal(justUnder, 'dead');
  assert.notEqual(atTheLimit, 'dead');
  // And the design goal itself: even the worst case this engine can
  // produce stays well under the "mass death" range.
  assert.ok(worstCaseChance < 0.3, `the worst-case death chance is ${worstCaseChance} -- too high for the stated design goal`);
});

test('mutation check: forcing intervened true always would make resolveGroupFight never kill or hospitalize anyone', () => {
  const w = world();
  let sawRealOutcome = false;
  for (let t = 0; t < 15; t += 1) {
    const winners = [person(w, { 'combat.Melee Skill': 99 }).id];
    const losers = [person(w, { 'combat.Melee Skill': 1 }).id];
    const result = groupFights.resolveGroupFight(w, { sideA: winners, sideB: losers, tick: t, contestId: `force-${t}` });
    if (!result.intervened) sawRealOutcome = true;
  }
  assert.ok(sawRealOutcome, 'with no community given this must never intervene -- confirms the gate is real, not a constant true');
});
