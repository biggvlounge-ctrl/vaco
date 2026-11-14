// server/party.js — a persistent escort/party roster. See that
// file's own header for the full design: sponsored through the
// identical real authority and per-person compliance draw
// heists.js/espionage.js already established, standing (not one-shot)
// until released, a person can only ever escort one leader at a
// time, and role assignment delegates entirely to the real,
// already-built leadership.assignRole.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const party = require('../server/party.js');
const leadership = require('../server/leadership.js');
const membership = require('../server/membership.js');
const worldStore = require('../server/worldStore.js');

const w = engine.WorldState;

let nextId = 970001;

function person(traitValueFor) {
  return engine.generateNPC({ traitValueFor });
}

function flatTraits(value) {
  return () => value;
}

function organization(leaderId, type = 'business') {
  return engine.generateOrganization({ name: `Org ${nextId += 1}`, type, leaderId });
}

function family(headId) {
  const id = nextId += 1;
  w.families.push({ id, surname: 'Escort', generation: 1, total_members: 1, head_npc_id: headId, updatedTick: w.tick });
  w.familyMemberships.push({ entity_id: headId, family_id: id, role: 'parent', generation_number: 1 });
  return w.families[w.families.length - 1];
}

function addToFamily(fam, entityId) {
  w.familyMemberships.push({ entity_id: entityId, family_id: fam.id, role: 'child', generation_number: 1 });
}

// ---------------------------------------------------------------------
// assembleParty — authority and real membership, same shape heists.js
// already established
// ---------------------------------------------------------------------

test('assembleParty: requires exactly one of organizationId/familyId, and a real sponsor', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const fam = family(leader.id);
  const member = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: member.id, organizationId: org.id });

  assert.throws(
    () => party.assembleParty(w, leader.id, { memberEntityIds: [member.id] }),
    /requires exactly one/,
  );
  assert.throws(
    () => party.assembleParty(w, leader.id, {
      organizationId: org.id, familyId: fam.id, memberEntityIds: [member.id],
    }),
    /requires exactly one/,
  );

  const impostor = person(flatTraits(50));
  assert.throws(
    () => party.assembleParty(w, impostor.id, { organizationId: org.id, memberEntityIds: [member.id] }),
    /does not lead organization/,
  );
});

test('assembleParty: refuses a candidate who is not a real member under this sponsor\'s authority', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const stranger = person(flatTraits(50));
  assert.throws(
    () => party.assembleParty(w, leader.id, { organizationId: org.id, memberEntityIds: [stranger.id] }),
    /is not a real member/,
  );
});

// ---------------------------------------------------------------------
// assembleParty — per-person compliance, "whatever they want to do"
// ---------------------------------------------------------------------

test('assembleParty: each candidate complies or refuses on their own real loyalty', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const loyal = person(flatTraits(50));
  const refuser = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: loyal.id, organizationId: org.id });
  membership.joinOrganization(w, { entityId: refuser.id, organizationId: org.id });
  worldStore.getOrCreateRelationship(w, leader.id, loyal.id, 'social').loyalty = 100;
  worldStore.getOrCreateRelationship(w, leader.id, refuser.id, 'social').loyalty = 0;

  const result = party.assembleParty(w, leader.id, {
    organizationId: org.id, memberEntityIds: [loyal.id, refuser.id], tick: 0,
  });
  assert.deepEqual(result.complied, [loyal.id]);
  assert.deepEqual(result.refused, [refuser.id]);
  assert.deepEqual(party.partyOf(w, leader.id).map((n) => n.id), [loyal.id]);
  assert.ok(leadership.serviceRecordOf(w, loyal.id) > 0, 'a complying member gets real service credit');
});

test('assembleParty: calling it again is idempotent -- an already-escorting member is not re-drawn', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const member = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: member.id, organizationId: org.id });
  worldStore.getOrCreateRelationship(w, leader.id, member.id, 'social').loyalty = 0;

  const first = party.assembleParty(w, leader.id, { organizationId: org.id, memberEntityIds: [member.id], tick: 0 });
  assert.deepEqual(first.refused, [member.id]);

  worldStore.getOrCreateRelationship(w, leader.id, member.id, 'social').loyalty = 100;
  let joined = false;
  for (let tick = 1; tick < 20 && !joined; tick += 1) {
    const result = party.assembleParty(w, leader.id, { organizationId: org.id, memberEntityIds: [member.id], tick });
    if (result.complied.includes(member.id)) joined = true;
  }
  assert.ok(joined);

  const before = w.partyMemberships.length;
  const again = party.assembleParty(w, leader.id, { organizationId: org.id, memberEntityIds: [member.id], tick: 999 });
  assert.deepEqual(again.complied, [member.id]);
  assert.equal(w.partyMemberships.length, before, 'no duplicate row for an already-escorting member');
});

// ---------------------------------------------------------------------
// A person can only ever escort one leader at a time
// ---------------------------------------------------------------------

test('assembleParty: a member already escorting a DIFFERENT leader is reported unavailable, never asked to comply', () => {
  const leaderA = person(flatTraits(50));
  const leaderB = person(flatTraits(50));
  const orgA = organization(leaderA.id);
  const orgB = organization(leaderB.id);
  const member = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: member.id, organizationId: orgA.id });
  membership.joinOrganization(w, { entityId: member.id, organizationId: orgB.id });
  worldStore.getOrCreateRelationship(w, leaderA.id, member.id, 'social').loyalty = 100;
  worldStore.getOrCreateRelationship(w, leaderB.id, member.id, 'social').loyalty = 100;

  const first = party.assembleParty(w, leaderA.id, { organizationId: orgA.id, memberEntityIds: [member.id], tick: 0 });
  assert.deepEqual(first.complied, [member.id]);

  const second = party.assembleParty(w, leaderB.id, { organizationId: orgB.id, memberEntityIds: [member.id], tick: 0 });
  assert.deepEqual(second.unavailable, [member.id]);
  assert.deepEqual(second.complied, []);
  assert.deepEqual(second.refused, []);
  assert.equal(party.escortLeaderOf(w, member.id), leaderA.id);
});

// ---------------------------------------------------------------------
// releaseFromParty
// ---------------------------------------------------------------------

test('releaseFromParty: releases a real escort, and refuses a release of someone not actually escorting this leader', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const member = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: member.id, organizationId: org.id });
  worldStore.getOrCreateRelationship(w, leader.id, member.id, 'social').loyalty = 100;
  party.assembleParty(w, leader.id, { organizationId: org.id, memberEntityIds: [member.id], tick: 0 });
  assert.equal(party.escortLeaderOf(w, member.id), leader.id);

  party.releaseFromParty(w, leader.id, member.id);
  assert.equal(party.escortLeaderOf(w, member.id), null);

  assert.throws(
    () => party.releaseFromParty(w, leader.id, member.id),
    /is not currently escorting/,
  );

  const bystander = person(flatTraits(50));
  assert.throws(
    () => party.releaseFromParty(w, leader.id, bystander.id),
    /is not currently escorting/,
  );
});

// ---------------------------------------------------------------------
// assignPartyRole — delegates entirely to the real leadership.assignRole
// ---------------------------------------------------------------------

test('assignPartyRole: refuses a role assignment to someone who is not currently escorting this leader', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const outsider = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: outsider.id, organizationId: org.id });
  assert.throws(
    () => party.assignPartyRole(w, leader.id, outsider.id, 'scout', 0),
    /is not currently escorting/,
  );
});

test('assignPartyRole: a real current escort gets a real role through leadership.assignRole, for both the organization and family path', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const escort = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: escort.id, organizationId: org.id });
  worldStore.getOrCreateRelationship(w, leader.id, escort.id, 'social').loyalty = 100;
  party.assembleParty(w, leader.id, { organizationId: org.id, memberEntityIds: [escort.id], tick: 0 });

  const result = party.assignPartyRole(w, leader.id, escort.id, 'scout', 1);
  assert.equal(result.complied, true);
  assert.equal(result.basis, 'organization');
  const row = membership.findMembership(w, escort.id, org.id);
  assert.equal(row.role_in_org, 'scout');

  const head = person(flatTraits(50));
  const fam = family(head.id);
  const kid = person(flatTraits(50));
  addToFamily(fam, kid.id);
  worldStore.getOrCreateRelationship(w, head.id, kid.id, 'social').loyalty = 100;
  party.assembleParty(w, head.id, { familyId: fam.id, memberEntityIds: [kid.id], tick: 0 });
  const familyResult = party.assignPartyRole(w, head.id, kid.id, 'protector', 1);
  assert.equal(familyResult.complied, true);
  assert.equal(familyResult.basis, 'family');
});

// ---------------------------------------------------------------------
// The family path, end to end
// ---------------------------------------------------------------------

test('assembleParty: a family head assembles a real escort from family members, the identical way an organization leader can', () => {
  const head = person(flatTraits(50));
  const kid = person(flatTraits(50));
  const fam = family(head.id);
  addToFamily(fam, kid.id);
  worldStore.getOrCreateRelationship(w, head.id, kid.id, 'social').loyalty = 100;

  const result = party.assembleParty(w, head.id, { familyId: fam.id, memberEntityIds: [kid.id], tick: 0 });
  assert.deepEqual(result.complied, [kid.id]);
  assert.deepEqual(party.partyOf(w, head.id).map((n) => n.id), [kid.id]);
});
