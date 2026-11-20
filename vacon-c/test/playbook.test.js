// Playbook/role-allocation system (assign N members to strategy/
// security/etc.) — by direct instruction. Read `server/playbook.js`'s
// own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const playbook = require('../server/playbook.js');
const membership = require('../server/membership.js');

let nextId = 980000;

function world() {
  return {
    tick: 10,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    relationships: [],
    entityTraits: [],
    employmentRecords: [],
    players: [],
  };
}

function person(w) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active', traits: {} });
  return id;
}

function organization(w, { leaderId, type = 'business', isFaction = false } = {}) {
  const id = nextId++;
  w.organizations.push({ id, name: `Org ${id}`, type, leader_id: leaderId, isFaction, assets: 0 });
  return id;
}

function member(w, entityId, organizationId) {
  membership.joinOrganization(w, { entityId, organizationId, tick: w.tick });
}

// Deterministic compliance: `complianceDraw` maps loyalty straight to
// a probability, so 100 always complies and 0 never does -- no
// probabilistic tick loop needed for a direct, synchronous call.
function setLoyalty(w, leaderId, subordinateId, loyalty) {
  w.relationships.push({
    id: nextId++, entity_a_id: leaderId, entity_b_id: subordinateId,
    relationship_type: 'social', loyalty, influence: 0,
  });
}

// ---------------------------------------------------------------------
// assignToPlaybook
// ---------------------------------------------------------------------

test('N compliant members are all assigned to the real named category in one bulk call', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const subs = [person(w), person(w), person(w)];
  for (const s of subs) { member(w, s, orgId); setLoyalty(w, leaderId, s, 100); }

  const results = playbook.assignToPlaybook(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: subs, category: 'security',
  });

  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.complied === true));
  for (const s of subs) {
    assert.equal(membership.findMembership(w, s, orgId).role_in_org, 'security');
  }
});

test('a refused member does not erase the real outcome of the others in the same batch', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const [willingA, refuser, willingB] = [person(w), person(w), person(w)];
  member(w, willingA, orgId);
  member(w, refuser, orgId);
  member(w, willingB, orgId);
  setLoyalty(w, leaderId, willingA, 100);
  setLoyalty(w, leaderId, refuser, 0);
  setLoyalty(w, leaderId, willingB, 100);

  const results = playbook.assignToPlaybook(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [willingA, refuser, willingB], category: 'strategy',
  });

  assert.equal(results.length, 3, 'one refusal must never shrink the real report');
  assert.equal(results[0].complied, true);
  assert.equal(results[1].complied, false);
  assert.equal(results[2].complied, true);
  assert.equal(membership.findMembership(w, willingA, orgId).role_in_org, 'strategy');
  assert.equal(membership.findMembership(w, refuser, orgId).role_in_org, null);
  assert.equal(membership.findMembership(w, willingB, orgId).role_in_org, 'strategy');
});

test('a subordinate who is not a real member of the organization is reported, not thrown past the others', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const realMember = person(w);
  const notAMember = person(w);
  member(w, realMember, orgId);
  setLoyalty(w, leaderId, realMember, 100);

  const results = playbook.assignToPlaybook(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [notAMember, realMember], category: 'operations',
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].complied, false);
  assert.ok(results[0].refusalReason.includes('not a member'));
  assert.equal(results[1].complied, true);
});

test('a gang/faction organization refuses every member in the batch, reported honestly, never thrown blind', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId, type: 'gang' });
  const subs = [person(w), person(w)];
  for (const s of subs) { member(w, s, orgId); setLoyalty(w, leaderId, s, 100); }

  const results = playbook.assignToPlaybook(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: subs, category: 'security',
  });
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.complied === false));
  assert.ok(results.every((r) => r.refusalReason.includes('gang')));
});

test('an unreal category is refused outright, before any member is touched', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const subs = [person(w)];
  member(w, subs[0], orgId);
  setLoyalty(w, leaderId, subs[0], 100);

  assert.throws(() => playbook.assignToPlaybook(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: subs, category: 'diplomacy',
  }), /not a real playbook category/);
  assert.equal(membership.findMembership(w, subs[0], orgId).role_in_org, null,
    'a refused category must never half-apply to anybody');
});

// ---------------------------------------------------------------------
// playbookOf
// ---------------------------------------------------------------------

test('playbookOf tallies real, live role_in_org values, never a second stored count', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const [a, b, c, unassigned] = [person(w), person(w), person(w), person(w)];
  for (const s of [a, b, c, unassigned]) member(w, s, orgId);
  for (const s of [a, b, c]) setLoyalty(w, leaderId, s, 100);

  playbook.assignToPlaybook(w, leaderId, { organizationId: orgId, subordinateEntityIds: [a], category: 'security' });
  playbook.assignToPlaybook(w, leaderId, { organizationId: orgId, subordinateEntityIds: [b, c], category: 'strategy' });

  const result = playbook.playbookOf(w, orgId);
  assert.deepEqual(result.breakdown.security, [a]);
  assert.deepEqual(result.breakdown.strategy, [b, c]);
  assert.deepEqual(result.breakdown.operations, []);
  assert.deepEqual(result.breakdown.recruitment, []);
  assert.deepEqual(result.unassigned, [unassigned]);
});

test('playbookOf reports a free-text role outside the real vocabulary as unassigned, never miscategorised', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const s = person(w);
  member(w, s, orgId);
  membership.findMembership(w, s, orgId).role_in_org = 'treasurer';

  const result = playbook.playbookOf(w, orgId);
  assert.deepEqual(result.unassigned, [s]);
  for (const category of playbook.PLAYBOOK_CATEGORIES) {
    assert.deepEqual(result.breakdown[category], []);
  }
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: without the per-member try/catch, one invalid member would throw past the whole batch', () => {
  // `assignRole` returns `{complied: false}` for a real LOYALTY
  // refusal -- that is not what this file's own per-member catch is
  // for. It throws for a real INPUT error (not a member of the
  // organization), and this confirms the naive, unwrapped version
  // this file deliberately does not use would lose the first
  // member's own real, already-applied outcome the moment the second
  // one throws.
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const willing = person(w);
  const notAMember = person(w);
  member(w, willing, orgId);
  setLoyalty(w, leaderId, willing, 100);

  const leadership = require('../server/leadership.js');
  const naive = () => [willing, notAMember].map((subordinateEntityId) => leadership.assignRole(w, leaderId, {
    organizationId: orgId, subordinateEntityId, role: 'security', tick: w.tick,
  }));
  assert.throws(naive, /is not a member of organization/);
  // The naive call above threw AFTER applying `willing`'s real,
  // already-complied assignment -- proof the lost information is
  // real, not hypothetical.
  assert.equal(membership.findMembership(w, willing, orgId).role_in_org, 'security');
});

test('mutation check: assignToPlaybook genuinely calls the real leadership.assignRole gate, not a bypass', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const s = person(w);
  member(w, s, orgId);
  setLoyalty(w, leaderId, s, 0);

  const results = playbook.assignToPlaybook(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [s], category: 'recruitment',
  });
  assert.equal(results[0].complied, false, 'zero real loyalty must still be able to refuse through the real gate');
  assert.equal(membership.findMembership(w, s, orgId).role_in_org, null);
});
