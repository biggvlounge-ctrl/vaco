// Sub-governments for orgs/tribes/gangs/towns, cohesion scaling with
// organization level — by direct instruction. Read
// `server/subGovernment.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const subGovernment = require('../server/subGovernment.js');
const membership = require('../server/membership.js');
const { ORGANIZATION_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 960000;

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
  };
}

function person(w) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active', traits: {} });
  return id;
}

function organization(w, { leaderId = null, type = 'business', internalLoyalty = 50 } = {}) {
  const id = nextId++;
  w.organizations.push({ id, name: `Org ${id}`, type, leader_id: leaderId, assets: 0 });
  w.entityTraits.push(...generateEntityTraits(id, w.tick, ORGANIZATION_DEFINITIONS, (def) => (
    def.name === 'internalLoyalty' ? internalLoyalty : 50
  )));
  return id;
}

function member(w, entityId, organizationId, role = null) {
  const row = membership.joinOrganization(w, { entityId, organizationId, tick: w.tick });
  if (role) row.role_in_org = role;
  return row;
}

function setLoyalty(w, leaderId, subordinateId, loyalty) {
  w.relationships.push({
    id: nextId++, entity_a_id: leaderId, entity_b_id: subordinateId,
    relationship_type: 'social', loyalty, influence: 0,
  });
}

// ---------------------------------------------------------------------
// requiredSubLeadersFor / currentSubLeadersOf / subGovernmentCoverageOf
// ---------------------------------------------------------------------

test('requiredSubLeadersFor is real member count divided by the real span-of-control number', () => {
  const w = world();
  const orgId = organization(w);
  for (let i = 0; i < 25; i += 1) member(w, person(w), orgId);
  assert.equal(membership.memberCount(w, orgId), 25);
  assert.equal(subGovernment.requiredSubLeadersFor(w, orgId), Math.floor(25 / subGovernment.MEMBERS_PER_SUBLEADER));
});

test('an organization too small to need a sub-leader reports full real coverage', () => {
  const w = world();
  const orgId = organization(w);
  member(w, person(w), orgId);
  assert.equal(subGovernment.requiredSubLeadersFor(w, orgId), 0);
  assert.equal(subGovernment.subGovernmentCoverageOf(w, orgId), 1);
});

test('a large ordinary organization with no real sub-leaders assigned reports zero coverage', () => {
  const w = world();
  const orgId = organization(w);
  for (let i = 0; i < 20; i += 1) member(w, person(w), orgId);
  assert.ok(subGovernment.requiredSubLeadersFor(w, orgId) > 0);
  assert.equal(subGovernment.subGovernmentCoverageOf(w, orgId), 0);
});

test('a large ordinary organization fully staffed with real sub-leaders reports full coverage, capped at 1', () => {
  const w = world();
  const orgId = organization(w);
  const required = 2;
  for (let i = 0; i < required * subGovernment.MEMBERS_PER_SUBLEADER; i += 1) member(w, person(w), orgId);
  for (let i = 0; i < required + 3; i += 1) member(w, person(w), orgId, 'lieutenant');

  assert.equal(subGovernment.subGovernmentCoverageOf(w, orgId), 1);
});

test('currentSubLeadersOf reads a gang\'s own real command tiers, not this file\'s ordinary vocabulary', () => {
  const w = world();
  const orgId = organization(w, { type: 'gang' });
  const shotCaller = person(w);
  const lieutenant = person(w);
  const soldier = person(w);
  member(w, shotCaller, orgId, 'shot_caller');
  member(w, lieutenant, orgId, 'lieutenant');
  member(w, soldier, orgId, 'soldier');

  const leaders = subGovernment.currentSubLeadersOf(w, orgId);
  assert.deepEqual(new Set(leaders), new Set([shotCaller, lieutenant]));
});

test('currentSubLeadersOf never counts a gang\'s own command tiers for an ordinary organization', () => {
  const w = world();
  const orgId = organization(w);
  const notReally = person(w);
  member(w, notReally, orgId, 'shot_caller');
  assert.deepEqual(subGovernment.currentSubLeadersOf(w, orgId), []);
});

// ---------------------------------------------------------------------
// organizationCohesionOf
// ---------------------------------------------------------------------

test('organizationCohesionOf reads the real internalLoyalty trait as its pull', () => {
  const w = world();
  const loyal = organization(w, { internalLoyalty: 100 });
  member(w, person(w), loyal);
  const disloyal = organization(w, { internalLoyalty: 0 });
  member(w, person(w), disloyal);

  assert.ok(subGovernment.organizationCohesionOf(w, loyal) > subGovernment.organizationCohesionOf(w, disloyal));
});

test('organizationCohesionOf scales down with organization level when structure does not keep pace', () => {
  const w = world();
  const orgId = organization(w, { internalLoyalty: 100 });
  for (let i = 0; i < 1; i += 1) member(w, person(w), orgId);
  const smallCohesion = subGovernment.organizationCohesionOf(w, orgId);

  const w2 = world();
  const orgId2 = organization(w2, { internalLoyalty: 100 });
  for (let i = 0; i < 20; i += 1) member(w2, person(w2), orgId2);
  const grownCohesion = subGovernment.organizationCohesionOf(w2, orgId2);

  assert.ok(grownCohesion < smallCohesion,
    'growing past the real span-of-control with no real sub-leaders assigned must lower cohesion');
});

test('organizationCohesionOf for a well-staffed grown organization recovers to its full real loyalty pull', () => {
  const w = world();
  const orgId = organization(w, { internalLoyalty: 80 });
  for (let i = 0; i < subGovernment.MEMBERS_PER_SUBLEADER; i += 1) member(w, person(w), orgId);
  member(w, person(w), orgId, 'lieutenant');

  assert.equal(subGovernment.organizationCohesionOf(w, orgId), 0.8);
});

// ---------------------------------------------------------------------
// assignSubLeaders
// ---------------------------------------------------------------------

test('N compliant members are bulk-assigned a real sub-government role in one call', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const subs = [person(w), person(w)];
  for (const s of subs) { member(w, s, orgId); setLoyalty(w, leaderId, s, 100); }

  const results = subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: subs, role: 'lieutenant',
  });
  assert.ok(results.every((r) => r.complied === true));
  for (const s of subs) assert.equal(membership.findMembership(w, s, orgId).role_in_org, 'lieutenant');
});

test('a gang organization refuses a sub-leader assignment through the same real gate assignRole already has', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId, type: 'gang' });
  const s = person(w);
  member(w, s, orgId);
  setLoyalty(w, leaderId, s, 100);

  const results = subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [s], role: 'lieutenant',
  });
  assert.equal(results[0].complied, false);
  assert.ok(results[0].refusalReason.includes('gang'));
});

test('an unreal sub-government role is refused outright, before any member is touched', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const s = person(w);
  member(w, s, orgId);
  setLoyalty(w, leaderId, s, 100);

  assert.throws(() => subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [s], role: 'strategy',
  }), /not a real sub-leader role/);
  assert.equal(membership.findMembership(w, s, orgId).role_in_org, null);
});

// ---------------------------------------------------------------------
// Task #111: real government/religious/military sub-leader
// vocabularies, distinct from the generic ordinary-organization list
// and from each other
// ---------------------------------------------------------------------

test('subLeaderRolesFor returns the real, distinct vocabulary for each of government, religion and military', () => {
  assert.deepEqual(subGovernment.subLeaderRolesFor({ type: 'government' }), subGovernment.GOVERNMENT_ROLES);
  assert.deepEqual(subGovernment.subLeaderRolesFor({ type: 'religion' }), subGovernment.RELIGIOUS_ROLES);
  assert.deepEqual(subGovernment.subLeaderRolesFor({ type: 'military' }), subGovernment.MILITARY_ROLES);
  // And all three are genuinely different from one another, and from
  // the generic ordinary-organization list -- not the same list under
  // three names.
  const lists = [
    subGovernment.GOVERNMENT_ROLES, subGovernment.RELIGIOUS_ROLES,
    subGovernment.MILITARY_ROLES, subGovernment.SUBGOVERNMENT_ROLES,
  ];
  for (let i = 0; i < lists.length; i += 1) {
    for (let j = i + 1; j < lists.length; j += 1) {
      assert.notDeepEqual(lists[i], lists[j]);
    }
  }
});

test('subLeaderRolesFor falls back to the generic ordinary-organization list for a business, tribe or club', () => {
  for (const type of ['business', 'club', 'corporation', 'tribe']) {
    assert.deepEqual(subGovernment.subLeaderRolesFor({ type }), subGovernment.SUBGOVERNMENT_ROLES);
  }
});

test('subLeaderRolesFor prefers the gang vocabulary over any type-based one when both could apply', () => {
  // A gang IS `organizations.type === 'gang'`, which is not one of the
  // three per-system-type keys above, so this also exercises the
  // ordinary fallback path landing correctly on the gang branch first.
  assert.deepEqual(subGovernment.subLeaderRolesFor({ type: 'gang' }), subGovernment.GANG_COMMAND_TIERS);
  assert.deepEqual(subGovernment.subLeaderRolesFor({ type: 'business', isFaction: true }), subGovernment.GANG_COMMAND_TIERS);
});

test('a real religious organization accepts its own real elder/deacon roles, and refuses a gang or government one', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId, type: 'religion' });
  const subs = [person(w), person(w)];
  for (const s of subs) { member(w, s, orgId); setLoyalty(w, leaderId, s, 100); }

  const elderResult = subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [subs[0]], role: 'elder',
  });
  assert.equal(elderResult[0].complied, true);
  assert.equal(membership.findMembership(w, subs[0], orgId).role_in_org, 'elder');

  assert.throws(() => subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [subs[1]], role: 'lieutenant',
  }), /not a real sub-leader role/, 'a religious organization has no lieutenants');
  assert.throws(() => subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [subs[1]], role: 'council_member',
  }), /not a real sub-leader role/, 'nor council members -- that is the real government vocabulary, not this one');
});

test('a real military organization accepts its own real officer/NCO roles, and currentSubLeadersOf reads them back', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId, type: 'military' });
  const subs = [person(w), person(w)];
  for (const s of subs) { member(w, s, orgId); setLoyalty(w, leaderId, s, 100); }

  subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [subs[0]], role: 'non_commissioned_officer',
  });
  subGovernment.assignSubLeaders(w, leaderId, {
    organizationId: orgId, subordinateEntityIds: [subs[1]], role: 'officer',
  });
  const current = subGovernment.currentSubLeadersOf(w, orgId);
  assert.equal(current.length, 2);
  assert.ok(current.includes(subs[0]) && current.includes(subs[1]));
});

test('a real government organization keeps the already-sensible council_member/deputy roles, and gains the real clerk one', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId, type: 'government' });
  const subs = [person(w), person(w), person(w)];
  for (const s of subs) { member(w, s, orgId); setLoyalty(w, leaderId, s, 100); }

  const results = [
    subGovernment.assignSubLeaders(w, leaderId, { organizationId: orgId, subordinateEntityIds: [subs[0]], role: 'council_member' }),
    subGovernment.assignSubLeaders(w, leaderId, { organizationId: orgId, subordinateEntityIds: [subs[1]], role: 'deputy' }),
    subGovernment.assignSubLeaders(w, leaderId, { organizationId: orgId, subordinateEntityIds: [subs[2]], role: 'clerk' }),
  ];
  for (const r of results) assert.equal(r[0].complied, true);
  assert.equal(subGovernment.currentSubLeadersOf(w, orgId).length, 3);
});

test('subGovernmentCoverageOf and organizationCohesionOf work identically for a real religious/military organization as for an ordinary one', () => {
  // These two functions never branch on organization type themselves
  // -- they go through `currentSubLeadersOf`, which now does. This is
  // the integration check that the dispatch change did not silently
  // break the two real, already-tested consumers.
  const w = world();
  const orgId = organization(w, { type: 'religion', internalLoyalty: 80 });
  const members = [person(w), person(w), person(w), person(w), person(w),
    person(w), person(w), person(w), person(w), person(w), person(w)];
  for (const m of members) member(w, m, orgId);
  member(w, members[0], orgId, 'elder');

  assert.equal(subGovernment.requiredSubLeadersFor(w, orgId), 1);
  assert.equal(subGovernment.subGovernmentCoverageOf(w, orgId), 1);
  const cohesion = subGovernment.organizationCohesionOf(w, orgId);
  assert.equal(cohesion, 0.8, 'full coverage: cohesion is the real loyalty pull, undiminished');
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: the real gang/ordinary branch in currentSubLeadersOf is what keeps the two vocabularies apart', () => {
  const w = world();
  const gangId = organization(w, { type: 'gang' });
  const shotCaller = person(w);
  member(w, shotCaller, gangId, 'shot_caller');

  // Confirms the real gate directly: `membership.isGang` must read
  // true for this fixture, or the branch this file depends on was
  // never actually exercised.
  const org = w.organizations.find((o) => o.id === gangId);
  assert.equal(membership.isGang(org), true);
  assert.deepEqual(subGovernment.currentSubLeadersOf(w, gangId), [shotCaller]);
});

test('mutation check: zero real sub-leaders at a required count above zero is the real reason coverage reads 0, not a different formula', () => {
  const w = world();
  const orgId = organization(w);
  for (let i = 0; i < subGovernment.MEMBERS_PER_SUBLEADER; i += 1) member(w, person(w), orgId);
  assert.equal(subGovernment.requiredSubLeadersFor(w, orgId), 1);
  assert.equal(subGovernment.currentSubLeadersOf(w, orgId).length, 0);
  assert.equal(subGovernment.subGovernmentCoverageOf(w, orgId), 0);
});

test('mutation check: organizationCohesionOf\'s uncovered penalty is exactly UNCOVERED_COHESION_PENALTY, not a different fraction', () => {
  const w = world();
  const orgId = organization(w, { internalLoyalty: 100 });
  for (let i = 0; i < subGovernment.MEMBERS_PER_SUBLEADER; i += 1) member(w, person(w), orgId);
  assert.equal(subGovernment.subGovernmentCoverageOf(w, orgId), 0);
  assert.equal(subGovernment.organizationCohesionOf(w, orgId), subGovernment.UNCOVERED_COHESION_PENALTY);
});
