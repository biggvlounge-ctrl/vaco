// server/organizationTraits.js's first test file — the module carried
// nothing but a flat constant list (ORGANIZATION_TRAIT_FAMILIES) until
// the training/cohesion round gave it a real function, `cohesionOf`,
// the organization-tier sibling of `familyTraits.cohesionOf`.
//
// See `organizationTraits.js`'s own header for the one real asymmetry
// this carries versus the family version: no stored `organizations
// .unity`/`.conflict` stock exists, so this computes its "unity" and
// "conflict" terms LIVE off real member relationships every call,
// rather than reading a slow-moving persisted figure.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const organizationTraits = require('../server/organizationTraits.js');
const membership = require('../server/membership.js');
const { generateEntityTraits } = require('../server/entityTraits.js');
const { ORGANIZATION_DEFINITIONS } = require('../server/traitDefinitions.js');

let nextId = 800000;

function world(extra = {}) {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    entityTraits: [],
    relationships: [],
    entityOrganizationMemberships: [],
    ...extra,
  };
}

function org(w, loyalty = 50, extra = {}) {
  const id = nextId += 1;
  w.entityTraits.push(...generateEntityTraits(
    id, w.tick, ORGANIZATION_DEFINITIONS, (def) => (def.name === 'internalLoyalty' ? loyalty : 50),
  ));
  w.organizations.push({ id, type: 'club', ...extra });
  return id;
}

function member(w) {
  const id = nextId += 1;
  w.npcs.push({ id, status: 'active' });
  return id;
}

function relate(w, a, b, trust, conflict = 0) {
  w.relationships.push({ entity_a_id: a, entity_b_id: b, trust, conflict });
}

test('cohesionOf returns null for an organization that does not exist', () => {
  const w = world();
  assert.equal(organizationTraits.cohesionOf(w, 999999), null);
});

test('an organization with no real members still gets a score, from internalLoyalty alone', () => {
  const w = world();
  const id = org(w, 80);
  // pull = ((50 + 80) / 2) / 100 = 0.65, drag = 1 (no relationships to discount)
  assert.equal(organizationTraits.cohesionOf(w, id), 0.65);
});

test('two members with real trust and no conflict: pull averages loyalty and mean trust, no drag', () => {
  const w = world();
  const id = org(w, 60);
  const a = member(w);
  const b = member(w);
  membership.joinOrganization(w, { entityId: a, organizationId: id });
  membership.joinOrganization(w, { entityId: b, organizationId: id });
  relate(w, a, b, 80, 0);
  // pull = ((80 + 60) / 2) / 100 = 0.7, drag = 1
  assert.equal(organizationTraits.cohesionOf(w, id), 0.7);
});

test('real conflict among members discounts the score, the same shape as familyTraits.cohesionOf', () => {
  const w = world();
  const id = org(w, 50);
  const a = member(w);
  const b = member(w);
  membership.joinOrganization(w, { entityId: a, organizationId: id });
  membership.joinOrganization(w, { entityId: b, organizationId: id });
  relate(w, a, b, 50, 40);
  // pull = ((50 + 50) / 2) / 100 = 0.5, drag = 1 - 40/100 = 0.6
  assert.equal(organizationTraits.cohesionOf(w, id), 0.3);
});

test('only relationships BETWEEN real members count -- an outsider\'s relationship to a member is not internal', () => {
  const w = world();
  const id = org(w, 50);
  const a = member(w);
  const b = member(w);
  const outsider = member(w);
  membership.joinOrganization(w, { entityId: a, organizationId: id });
  membership.joinOrganization(w, { entityId: b, organizationId: id });
  relate(w, a, outsider, 100, 0);
  // No internal relationship between a and b exists, so meanTrust falls
  // back to 50 and meanConflict stays 0 -- the outsider's trust must
  // not leak in.
  assert.equal(organizationTraits.cohesionOf(w, id), 0.5);
});

test('an ordinary, unmeasured organization scores 0.5, the same centring familyTraits.cohesionOf holds', () => {
  const w = world();
  const id = org(w, 50);
  assert.equal(organizationTraits.cohesionOf(w, id), 0.5);
});

test('cohesionOf is bounded to 0..1 even at the real formula\'s extremes', () => {
  const w = world();
  const id = org(w, 100);
  const a = member(w);
  const b = member(w);
  membership.joinOrganization(w, { entityId: a, organizationId: id });
  membership.joinOrganization(w, { entityId: b, organizationId: id });
  relate(w, a, b, 100, 0);
  assert.equal(organizationTraits.cohesionOf(w, id), 1);

  const id2 = org(w, 0);
  const c = member(w);
  const d = member(w);
  membership.joinOrganization(w, { entityId: c, organizationId: id2 });
  membership.joinOrganization(w, { entityId: d, organizationId: id2 });
  relate(w, c, d, 0, 100);
  assert.equal(organizationTraits.cohesionOf(w, id2), 0);
});
