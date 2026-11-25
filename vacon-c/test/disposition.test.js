// server/disposition.js -- real post-encounter disposition choice
// (task #216), from the master spec's §9. Read that file's own header
// first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const disposition = require('../server/disposition.js');
const membership = require('../server/membership.js');

let nextId = 960000;

function world() {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    communities: [{ id: 1, name: 'Hollow Row' }, { id: 2, name: 'Far Town' }],
    properties: [],
    relationships: [],
    entityOrganizationMemberships: [],
    employmentRecords: [],
    scheduleEvents: [],
    memories: [],
    migrations: [],
    captures: [],
  };
}

function person(w, { communityId = 1 } = {}) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active', communityId, home_property_id: null });
  return id;
}

function organization(w, { leaderId } = {}) {
  const id = nextId++;
  w.organizations.push({
    id, name: `Org ${id}`, type: 'gang', leader_id: leaderId ?? null,
    isFaction: true, influence: 0, assets: 0,
  });
  return id;
}

function setLoyalty(w, a, b, loyalty) {
  w.relationships.push({
    id: nextId++, entity_a_id: a, entity_b_id: b, relationship_type: 'social', loyalty, influence: 0,
  });
}

function employ(w, entityId) {
  w.employmentRecords.push({ entity_id: entityId, status: 'active', position: 'laborer', wage: 10 });
}

test('capture refuses to take someone who fled -- only defeated or submitted can be captured', () => {
  const w = world();
  const winner = person(w);
  const fledLoser = person(w);
  assert.throws(
    () => disposition.capture(w, { capturedEntityId: fledLoser, capturedByEntityId: winner, loserOutcome: 'fled' }),
    /not a real capturable outcome/,
  );
});

test('capture takes a real submitted loser captive, ends their real job, and clears their schedule', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  employ(w, loser);
  w.scheduleEvents.push({ entity_id: loser, activity: 'work' });

  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'submitted' });

  assert.equal(w.npcs.find((n) => n.id === loser).status, 'captive');
  assert.equal(record.disposition, null);
  assert.equal(w.employmentRecords.find((r) => r.entity_id === loser).status, 'ended');
  assert.equal(w.scheduleEvents.filter((e) => e.entity_id === loser).length, 0);
  assert.equal(w.memories.filter((m) => m.entity_id === loser).length, 1);
});

test('capture refuses to capture someone already a real captive', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'defeated' });
  assert.throws(
    () => disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'defeated' }),
    /already a real captive/,
  );
});

test('disposeOf(recruit) complies for a fully loyal captive, joins the real organization, and frees them', () => {
  const w = world();
  const winner = person(w);
  const orgId = organization(w, { leaderId: winner });
  const loser = person(w);
  setLoyalty(w, winner, loser, 100);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'submitted' });

  const outcome = disposition.disposeOf(w, record.id, { disposition: 'recruit', organizationId: orgId });

  assert.equal(outcome.complied, true);
  assert.equal(w.npcs.find((n) => n.id === loser).status, 'active');
  assert.ok(membership.findMembership(w, loser, orgId));
  assert.equal(record.disposition, 'recruit');
});

test('disposeOf(recruit) leaves the capture open on a real refusal -- zero loyalty never complies', () => {
  const w = world();
  const winner = person(w);
  const orgId = organization(w, { leaderId: winner });
  const loser = person(w);
  setLoyalty(w, winner, loser, 0);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'submitted' });

  const outcome = disposition.disposeOf(w, record.id, { disposition: 'recruit', organizationId: orgId });

  assert.equal(outcome.complied, false);
  assert.equal(w.npcs.find((n) => n.id === loser).status, 'captive', 'a refused recruit was freed anyway');
  assert.equal(record.disposition, null, 'a refused recruit resolved the capture anyway');
  assert.equal(membership.findMembership(w, loser, orgId), null);
});

test('disposeOf(exile) relocates a real captive to a real community and frees them', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w, { communityId: 1 });
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'defeated' });

  disposition.disposeOf(w, record.id, { disposition: 'exile', toCommunityId: 2 });

  const npc = w.npcs.find((n) => n.id === loser);
  assert.equal(npc.status, 'active');
  assert.equal(npc.communityId, 2);
  assert.equal(record.disposition, 'exile');
});

test('disposeOf(exile) refuses a non-existent destination community', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'defeated' });
  assert.throws(
    () => disposition.disposeOf(w, record.id, { disposition: 'exile', toCommunityId: 999999 }),
    /no real community/,
  );
});

test('disposeOf(custody) resolves the capture and leaves the captive exactly as captive', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'defeated' });

  disposition.disposeOf(w, record.id, { disposition: 'custody' });

  assert.equal(w.npcs.find((n) => n.id === loser).status, 'captive');
  assert.equal(record.disposition, 'custody');
});

test('disposeOf(release) frees a real captive', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'submitted' });

  disposition.disposeOf(w, record.id, { disposition: 'release' });

  assert.equal(w.npcs.find((n) => n.id === loser).status, 'active');
  assert.equal(record.disposition, 'release');
});

test('disposeOf refuses a capture that was already resolved', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'submitted' });
  disposition.disposeOf(w, record.id, { disposition: 'release' });

  assert.throws(
    () => disposition.disposeOf(w, record.id, { disposition: 'custody' }),
    /already disposed of/,
  );
});

test('disposeOf refuses a fake disposition', () => {
  const w = world();
  const winner = person(w);
  const loser = person(w);
  const record = disposition.capture(w, { capturedEntityId: loser, capturedByEntityId: winner, loserOutcome: 'submitted' });
  assert.throws(
    () => disposition.disposeOf(w, record.id, { disposition: 'execute' }),
    /not a real disposition/,
  );
});

test('capturesOf finds a real captor\'s own open captures, never someone else\'s', () => {
  const w = world();
  const winnerA = person(w);
  const winnerB = person(w);
  const loserA = person(w);
  const loserB = person(w);
  disposition.capture(w, { capturedEntityId: loserA, capturedByEntityId: winnerA, loserOutcome: 'submitted' });
  disposition.capture(w, { capturedEntityId: loserB, capturedByEntityId: winnerB, loserOutcome: 'defeated' });

  const aOnly = disposition.capturesOf(w, { capturedByEntityId: winnerA, open: true });
  assert.equal(aOnly.length, 1);
  assert.equal(aOnly[0].captured_entity_id, loserA);
});
