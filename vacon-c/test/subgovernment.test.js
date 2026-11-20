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
  }), /not a real sub-government role/);
  assert.equal(membership.findMembership(w, s, orgId).role_in_org, null);
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
