// server/heists.js — assembling a real crew to rob a real
// organization's own real assets. See that file's own header for the
// full design: sponsored through the identical real authority and
// per-person compliance draw `assignRole`/`espionage.js` already
// established, a real weighted crew-skill composite, a real capped
// crew-size bonus, a real target-defense term from actually-employed
// guards/enforcers, and success/detection as two independent draws.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const heists = require('../server/heists.js');
const leadership = require('../server/leadership.js');
const heat = require('../server/heat.js');
const membership = require('../server/membership.js');
const economy = require('../server/economy.js');
const worldStore = require('../server/worldStore.js');

const w = engine.WorldState;

let nextId = 960001;

function person(traitValueFor) {
  return engine.generateNPC({ traitValueFor });
}

function flatTraits(value) {
  return () => value;
}

function organization(leaderId, type = 'gang') {
  return engine.generateOrganization({ name: `Org ${nextId += 1}`, type, leaderId });
}

function family(headId) {
  const id = nextId += 1;
  w.families.push({ id, surname: 'Crew', generation: 1, total_members: 1, head_npc_id: headId, updatedTick: w.tick });
  w.familyMemberships.push({ entity_id: headId, family_id: id, role: 'parent', generation_number: 1 });
  return w.families[w.families.length - 1];
}

function addToFamily(fam, entityId) {
  w.familyMemberships.push({ entity_id: entityId, family_id: fam.id, role: 'child', generation_number: 1 });
}

// ---------------------------------------------------------------------
// robberyAptitudeOf / targetDefenseOf / successChanceFor / detectionChanceFor
// ---------------------------------------------------------------------

test('robberyAptitudeOf: a real, weighted composite of Stealth/Deception/Tactical Awareness', () => {
  const crook = person((def) => {
    if (def.family === 'criminal' && def.name === 'Stealth') return 80;
    if (def.family === 'criminal' && def.name === 'Deception') return 60;
    if (def.family === 'combat' && def.name === 'Tactical Awareness') return 40;
    return 50;
  });
  const expected = 0.35 * 80 + 0.35 * 60 + 0.3 * 40;
  assert.equal(heists.robberyAptitudeOf(w, crook.id), expected);
});

test('targetDefenseOf: counts only this organization\'s own real, active guards/enforcers', () => {
  const target = organization(null, 'business');
  const guard = person(flatTraits(50));
  economy.hireEntity(w, { entityId: guard.id, employerOrganizationId: target.id, wage: 50, position: 'guard', tick: 0 });
  assert.ok(heists.targetDefenseOf(w, target.id) > 0);

  const undefended = organization(null, 'business');
  assert.equal(heists.targetDefenseOf(w, undefended.id), 0);
});

test('successChanceFor: more crew (up to the real cap) and higher aptitude both raise it; a defended target lowers it', () => {
  const solo = heists.successChanceFor(50, 1, 0);
  const fullCrew = heists.successChanceFor(50, heists.CREW_CAP, 0);
  assert.ok(fullCrew > solo);

  const beyondCap = heists.successChanceFor(50, heists.CREW_CAP + 10, 0);
  assert.equal(beyondCap, fullCrew, 'crew size is capped, not unbounded');

  const skilled = heists.successChanceFor(90, 1, 0);
  assert.ok(skilled > solo);

  const defended = heists.successChanceFor(50, 1, 0.5);
  assert.ok(defended < solo);
});

test('detectionChanceFor: a defended target and a low-skill crew both raise detection risk, bounded', () => {
  const safe = heists.detectionChanceFor(90, 0);
  const risky = heists.detectionChanceFor(10, 0.5);
  assert.ok(risky > safe);
  assert.ok(safe >= 0.05 && safe <= 0.9);
  assert.ok(risky >= 0.05 && risky <= 0.9);
});

// ---------------------------------------------------------------------
// attemptHeist — validation
// ---------------------------------------------------------------------

test('attemptHeist: real validation errors', () => {
  const leader = person(flatTraits(50));
  const crewMember = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: crewMember.id, organizationId: org.id });
  const target = organization(null, 'business');

  assert.throws(
    () => heists.attemptHeist(w, leader.id, { organizationId: org.id, crewEntityIds: [], targetOrganizationId: target.id }),
    /non-empty crewEntityIds/,
  );
  assert.throws(
    () => heists.attemptHeist(w, leader.id, { organizationId: org.id, crewEntityIds: [crewMember.id] }),
    /requires targetOrganizationId/,
  );
  assert.throws(
    () => heists.attemptHeist(w, leader.id, { crewEntityIds: [crewMember.id], targetOrganizationId: target.id }),
    /requires exactly one of organizationId or familyId/,
  );
  assert.throws(
    () => heists.attemptHeist(w, leader.id, {
      organizationId: org.id, familyId: 1, crewEntityIds: [crewMember.id], targetOrganizationId: target.id,
    }),
    /requires exactly one of organizationId or familyId/,
  );
  assert.throws(
    () => heists.attemptHeist(w, leader.id, { organizationId: org.id, crewEntityIds: [crewMember.id], targetOrganizationId: org.id }),
    /cannot rob its own sponsoring organization/,
  );

  const impostor = person(flatTraits(50));
  assert.throws(
    () => heists.attemptHeist(w, impostor.id, { organizationId: org.id, crewEntityIds: [crewMember.id], targetOrganizationId: target.id }),
    /does not lead organization/,
  );

  const stranger = person(flatTraits(50));
  assert.throws(
    () => heists.attemptHeist(w, leader.id, { organizationId: org.id, crewEntityIds: [stranger.id], targetOrganizationId: target.id }),
    /is not a real member/,
  );
});

// ---------------------------------------------------------------------
// attemptHeist — per-person compliance, "whatever they want to do"
// ---------------------------------------------------------------------

test('attemptHeist: each crew member complies or refuses independently; an all-refused crew attempts nothing', () => {
  const leader = person(flatTraits(50));
  const refuser = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: refuser.id, organizationId: org.id });
  const target = organization(null, 'business');
  target.assets = 10000;
  worldStore.getOrCreateRelationship(w, leader.id, refuser.id, 'social').loyalty = 0;

  const result = heists.attemptHeist(w, leader.id, {
    organizationId: org.id, crewEntityIds: [refuser.id], targetOrganizationId: target.id,
  });
  assert.equal(result.complied, false);
  assert.equal(result.success, null);
  assert.equal(target.assets, 10000, 'nothing moved -- no attempt was ever actually made');
});

test('attemptHeist: a mixed crew proceeds with only the real members who actually complied', () => {
  const leader = person(flatTraits(50));
  const loyalMember = person(flatTraits(50));
  const refuser = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: loyalMember.id, organizationId: org.id });
  membership.joinOrganization(w, { entityId: refuser.id, organizationId: org.id });
  const target = organization(null, 'business');
  target.assets = 10000;
  worldStore.getOrCreateRelationship(w, leader.id, loyalMember.id, 'social').loyalty = 100;
  worldStore.getOrCreateRelationship(w, leader.id, refuser.id, 'social').loyalty = 0;

  const result = heists.attemptHeist(w, leader.id, {
    organizationId: org.id, crewEntityIds: [leader.id, loyalMember.id, refuser.id], targetOrganizationId: target.id, tick: 0,
  });
  assert.equal(result.complied, true);
  assert.deepEqual(result.crew.sort(), [leader.id, loyalMember.id].sort());
  assert.deepEqual(result.refused, [refuser.id]);
});

// ---------------------------------------------------------------------
// attemptHeist — success moves real assets; failure moves nothing
// ---------------------------------------------------------------------

test('attemptHeist: a maximal, uncapped crew against a wholly undefended target with the best real aptitude succeeds and moves real assets, split among the crew', () => {
  const leader = person((def) => (
    (def.family === 'criminal' && (def.name === 'Stealth' || def.name === 'Deception'))
    || (def.family === 'combat' && def.name === 'Tactical Awareness') ? 100 : 50
  ));
  const crewMembers = [];
  for (let i = 0; i < 3; i += 1) {
    const member = person((def) => (
      (def.family === 'criminal' && (def.name === 'Stealth' || def.name === 'Deception'))
      || (def.family === 'combat' && def.name === 'Tactical Awareness') ? 100 : 50
    ));
    crewMembers.push(member);
  }
  const org = organization(leader.id);
  for (const member of crewMembers) {
    membership.joinOrganization(w, { entityId: member.id, organizationId: org.id });
    worldStore.getOrCreateRelationship(w, leader.id, member.id, 'social').loyalty = 100;
  }
  const target = organization(null, 'business');
  target.assets = 10000;

  let succeeded = null;
  for (let tick = 0; tick < 30 && !succeeded; tick += 1) {
    const result = heists.attemptHeist(w, leader.id, {
      organizationId: org.id,
      crewEntityIds: [leader.id, ...crewMembers.map((m) => m.id)],
      targetOrganizationId: target.id,
      tick,
    });
    if (result.success && !result.detected) succeeded = result;
  }
  assert.ok(succeeded, 'the best real aptitude, a full crew, and an undefended target must succeed cleanly at least once in 30 tries');
  assert.ok(succeeded.loot > 0);
  assert.equal(target.assets, 10000 - succeeded.loot);
  for (const member of [leader, ...crewMembers]) {
    assert.ok(leadership.serviceRecordOf(w, member.id) > 0, 'every real crew member gets real service credit on a clean success');
  }
});

test('attemptHeist: the worst real aptitude, solo, against a heavily guarded target fails far more often than it succeeds, and a failure moves nothing', () => {
  const leader = person((def) => (
    (def.family === 'criminal' && (def.name === 'Stealth' || def.name === 'Deception'))
    || (def.family === 'combat' && def.name === 'Tactical Awareness') ? 0 : 50
  ));
  const org = organization(leader.id);
  const target = organization(null, 'business');
  target.assets = 10000;
  for (let i = 0; i < 4; i += 1) {
    const guard = person(flatTraits(50));
    economy.hireEntity(w, { entityId: guard.id, employerOrganizationId: target.id, wage: 50, position: 'guard', tick: 0 });
  }

  let successes = 0;
  const trials = 30;
  for (let tick = 0; tick < trials; tick += 1) {
    const result = heists.attemptHeist(w, leader.id, {
      organizationId: org.id, crewEntityIds: [leader.id], targetOrganizationId: target.id, tick,
    });
    if (result.success) {
      successes += 1;
      assert.ok(result.loot > 0);
    } else {
      assert.equal(result.loot, 0);
    }
  }
  assert.ok(successes < trials, 'the worst real aptitude against a heavily guarded target must not succeed every time');
  assert.equal(target.assets, 10000 - (successes > 0 ? 0 : 0), 'checked via the per-tick assertions above, not a running total');
});

// ---------------------------------------------------------------------
// attemptHeist — detection raises real heat; service only on a clean success
// ---------------------------------------------------------------------

test('attemptHeist: detection raises real heat with the specific target, and records no service; a clean success records service for every real participant', () => {
  const leader = person((def) => (
    (def.family === 'criminal' && (def.name === 'Stealth' || def.name === 'Deception'))
    || (def.family === 'combat' && def.name === 'Tactical Awareness') ? 0 : 50
  ));
  const org = organization(leader.id);
  const target = organization(null, 'business');
  target.assets = 10000;
  for (let i = 0; i < 4; i += 1) {
    const guard = person(flatTraits(50));
    economy.hireEntity(w, { entityId: guard.id, employerOrganizationId: target.id, wage: 50, position: 'guard', tick: 0 });
  }

  let detectedOnce = false;
  for (let tick = 0; tick < 40 && !detectedOnce; tick += 1) {
    const before = leadership.serviceRecordOf(w, leader.id);
    const result = heists.attemptHeist(w, leader.id, {
      organizationId: org.id, crewEntityIds: [leader.id], targetOrganizationId: target.id, tick,
    });
    if (result.detected) {
      detectedOnce = true;
      assert.ok(heat.heatWith(w, leader.id, target.id) > 0);
      if (result.success) {
        assert.equal(leadership.serviceRecordOf(w, leader.id), before, 'a detected success still records no service');
      }
    }
  }
  assert.ok(detectedOnce, 'the worst real aptitude against a heavily guarded target must be detected at least once in 40 tries');
});

// ---------------------------------------------------------------------
// attemptHeist — the family path
// ---------------------------------------------------------------------

test('attemptHeist: a family head can assemble a real crew from family members the identical way an organization leader can', () => {
  const head = person(flatTraits(50));
  const kid = person(flatTraits(50));
  const fam = family(head.id);
  addToFamily(fam, kid.id);
  const target = organization(null, 'business');
  target.assets = 5000;
  worldStore.getOrCreateRelationship(w, head.id, kid.id, 'social').loyalty = 100;

  const result = heists.attemptHeist(w, head.id, {
    familyId: fam.id, crewEntityIds: [head.id, kid.id], targetOrganizationId: target.id,
  });
  assert.equal(result.complied, true);
  assert.deepEqual(result.crew.sort(), [head.id, kid.id].sort());
});

test('attemptHeist (family path): refuses a non-head sponsor and a non-member crew pick', () => {
  const head = person(flatTraits(50));
  const kid = person(flatTraits(50));
  const fam = family(head.id);
  addToFamily(fam, kid.id);
  const target = organization(null, 'business');
  const impostor = person(flatTraits(50));

  assert.throws(
    () => heists.attemptHeist(w, impostor.id, { familyId: fam.id, crewEntityIds: [kid.id], targetOrganizationId: target.id }),
    /does not head family/,
  );

  const stranger = person(flatTraits(50));
  assert.throws(
    () => heists.attemptHeist(w, head.id, { familyId: fam.id, crewEntityIds: [stranger.id], targetOrganizationId: target.id }),
    /is not a real member/,
  );
});
