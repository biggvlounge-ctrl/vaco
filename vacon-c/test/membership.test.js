// Organization membership — the join table that had no code.
//
// `entity_organization_memberships` was in the schema from the first
// version and `urbanSystems.js` listed it as `schemaOnly`: a table
// cited as evidence and touched by nothing. It is the missing link
// behind gang membership per area — faction CONTROL of a block was
// always real, and nothing connected a resident to a faction.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const membership = require('../server/membership.js');
const mortality = require('../server/mortality.js');
const territory = require('../server/territory.js');
const engine = require('../server/engine.js');

let nextId = 500;

function world() {
  const worldState = {
    tick: 50,
    npcs: [],
    deceased: [],
    organizations: [],
    communities: [],
    entityOrganizationMemberships: [],
    entityTraits: [],
    memories: [],
    historicalRecords: [],
    resources: [],
    individualFinances: [],
  };
  territory.reseedIds(worldState);
  return worldState;
}

function person(worldState, communityId = null) {
  const npc = { id: nextId++, status: 'active', communityId, home_property_id: null, createdTick: 0 };
  worldState.npcs.push(npc);
  return npc;
}

function org(worldState, { type = 'business', isFaction = false, members = 0 } = {}) {
  const o = { id: nextId++, name: `Org ${nextId}`, type, isFaction, members, influence: 40 };
  worldState.organizations.push(o);
  return o;
}

test('joining requires an organization that exists and somebody living', () => {
  const w = world();
  const a = person(w);
  assert.throws(() => membership.joinOrganization(w, {
    entityId: a.id, organizationId: 999999,
  }), /no organization 999999/);

  const o = org(w);
  assert.throws(() => membership.joinOrganization(w, {
    entityId: 999999, organizationId: o.id,
  }), /not among the living/);
});

test('a second join updates the role instead of adding a second row', () => {
  // The schema's own primary key is (entity_id, organization_id), so a
  // duplicate is not merely untidy — it is a row the database will
  // refuse, and every headcount would be wrong before it got there.
  const w = world();
  const a = person(w);
  const o = org(w);
  membership.joinOrganization(w, { entityId: a.id, organizationId: o.id, role: 'member' });
  membership.joinOrganization(w, { entityId: a.id, organizationId: o.id, role: 'lieutenant' });

  assert.equal(w.entityOrganizationMemberships.length, 1);
  assert.equal(membership.findMembership(w, a.id, o.id).role_in_org, 'lieutenant');
  assert.equal(membership.memberCount(w, o.id), 1);
});

test('death releases every membership', () => {
  // **Moving the row out of `npcs` does not reach into other tables.**
  // A membership left behind keeps a dead person in every organization
  // headcount and every per-area gang rate, forever — the same failure
  // mode moving the row was chosen to prevent, except a join table has
  // no `npcs` to be absent from.
  const w = world();
  const a = person(w);
  const b = person(w);
  const gang = org(w, { type: 'gang' });
  membership.joinOrganization(w, { entityId: a.id, organizationId: gang.id });
  membership.joinOrganization(w, { entityId: b.id, organizationId: gang.id });
  assert.equal(membership.memberCount(w, gang.id), 2);

  mortality.recordDeath(w, { entityId: a.id, cause: 'violence', tick: 51 });
  assert.equal(membership.memberCount(w, gang.id), 1,
    'a corpse is still on the roster');
  assert.deepEqual(membership.membersOf(w, gang.id).map((n) => n.id), [b.id]);
});

test('a gang is either an organization typed gang or a faction', () => {
  // Standing rule 4: Organization is the parent and Faction is a
  // subtype, and the two claims are not the same — a gang that holds
  // no territory is still a gang, and a faction can be a militia.
  // Reading only one of them would miss half the gangs in any world.
  assert.equal(membership.isGang({ type: 'gang', isFaction: false }), true);
  assert.equal(membership.isGang({ type: 'military', isFaction: true }), true);
  assert.equal(membership.isGang({ type: 'business', isFaction: false }), false);
  assert.equal(membership.isGang(null), false);
});

test('gang membership is a rate per area, and an empty area has none', () => {
  const w = world();
  const here = territory.generateCommunity(w, {});
  const there = territory.generateCommunity(w, {});
  const empty = territory.generateCommunity(w, {});
  const gang = org(w, { type: 'gang' });
  const shop = org(w, { type: 'business' });

  const a = person(w, here.id);
  const b = person(w, here.id);
  const c = person(w, here.id);
  const d = person(w, here.id);
  const outsider = person(w, there.id);

  membership.joinOrganization(w, { entityId: a.id, organizationId: gang.id });
  membership.joinOrganization(w, { entityId: b.id, organizationId: gang.id });
  membership.joinOrganization(w, { entityId: c.id, organizationId: shop.id });
  membership.joinOrganization(w, { entityId: outsider.id, organizationId: gang.id });
  void d;

  assert.equal(membership.gangMembershipRate(w, here.id), 0.5, '2 of 4 residents');
  assert.equal(membership.gangMembershipRate(w, there.id), 1);
  assert.equal(membership.gangMembershipRate(w, empty.id), null,
    'an area with no residents has an unknown rate, not a rate of zero');
});

test('somebody in two gangs is one gang member', () => {
  // Counting rows rather than people would let a rate exceed 1, which
  // is the classic way to compute a share that cannot be compared.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, c.id);
  const one = org(w, { type: 'gang' });
  const two = org(w, { isFaction: true });
  membership.joinOrganization(w, { entityId: a.id, organizationId: one.id });
  membership.joinOrganization(w, { entityId: a.id, organizationId: two.id });

  assert.equal(membership.gangMembershipRate(w, c.id), 1);
});

test('presence is defined by resident members, because organizations have no address', () => {
  // No table in the schema gives an organization a location. Defining
  // presence by people is not a workaround — an organization with
  // forty members on a block is present there whatever its registered
  // office would say.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const elsewhere = territory.generateCommunity(w, {});
  const gang = org(w, { type: 'gang' });
  const shop = org(w, { type: 'business' });

  for (let i = 0; i < 3; i += 1) {
    membership.joinOrganization(w, { entityId: person(w, c.id).id, organizationId: gang.id });
  }
  membership.joinOrganization(w, { entityId: person(w, c.id).id, organizationId: shop.id });
  membership.joinOrganization(w, { entityId: person(w, elsewhere.id).id, organizationId: shop.id });

  const presence = membership.organizationPresence(w, c.id);
  assert.equal(presence.length, 2);
  assert.deepEqual(presence[0], {
    organizationId: gang.id, type: 'gang', members: 3, isGang: true, influence: 40,
  });
  assert.equal(presence[1].members, 1, 'only the shop member who lives here');
});

test('organizations.members is a stored placeholder and nothing writes it back', () => {
  // Same shape as `communities.employment`: a column seeded at
  // generation that reads as a measurement. Standing rule 3 — report
  // the drift, do not close it by duplicating a computable rollup.
  const w = world();
  const o = org(w, { members: 12 });
  membership.joinOrganization(w, { entityId: person(w).id, organizationId: o.id });
  membership.joinOrganization(w, { entityId: person(w).id, organizationId: o.id });

  assert.deepEqual(membership.describeMemberDrift(w, o.id), {
    organizationId: o.id, stored: 12, computed: 2, drifted: true,
  });
  assert.equal(o.members, 12, 'describeMemberDrift wrote back to the stored column');
});

test('the WorldState the engine ships carries the membership array', () => {
  assert.ok(Array.isArray(engine.WorldState.entityOrganizationMemberships));
});
