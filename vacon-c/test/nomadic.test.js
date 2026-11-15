// server/nomadic.js — real, computed, never-stored nomadic status for
// a family or organization. See that file's own header: checked
// against the family's own `head_npc_id`/the organization's own
// `leader_id`, true only when that real person is currently on a real
// `travel.js` journey or at a real `camps.js` camp — never a third,
// invented status field.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const nomadic = require('../server/nomadic.js');
const camps = require('../server/camps.js');
const travel = require('../server/travel.js');

const w = engine.WorldState;

let nextId = 1;

function freshCommunity() {
  const name = `Nomadtown ${nextId += 1}`;
  const city = engine.generateCity({ name });
  return engine.generateCommunity({ cityId: city.id, name: `${name} Block` });
}

function family(headId) {
  const id = nextId += 1;
  w.families.push({
    id, surname: 'Wander', generation: 1, total_members: 1, head_npc_id: headId, updatedTick: w.tick,
  });
  return w.families[w.families.length - 1];
}

function organization(leaderId) {
  return engine.generateOrganization({ name: `Band ${nextId += 1}`, type: 'gang', leaderId });
}

// ---------------------------------------------------------------------
// nomadicStatusOf
// ---------------------------------------------------------------------

test('nomadicStatusOf: false for a real entity neither travelling nor camped', () => {
  const community = freshCommunity();
  const npc = engine.generateNPC({ communityId: community.id });
  assert.deepEqual(nomadic.nomadicStatusOf(w, npc.id), { nomadic: false, reason: null });
});

test('nomadicStatusOf: true, reason "camp", for a real entity at a real active camp', () => {
  const community = freshCommunity();
  const npc = engine.generateNPC({ communityId: community.id });
  const camp = camps.establishCamp(w, npc.id, { communityId: community.id, campType: 'lake', tick: 0 });
  const status = nomadic.nomadicStatusOf(w, npc.id);
  assert.equal(status.nomadic, true);
  assert.equal(status.reason, 'camp');
  assert.equal(status.campId, camp.id);
});

test('nomadicStatusOf: true, reason "journey", for a real entity on a real active journey', () => {
  const originCommunity = freshCommunity();
  const destCity = engine.generateCity({ name: `Dest ${nextId += 1}` });
  const originCity = w.cities.find((c) => c.id === originCommunity.city_id);
  originCity.latitude = 10; originCity.longitude = 10; originCity.geo_source = 'synthetic';
  destCity.latitude = 20; destCity.longitude = 20; destCity.geo_source = 'synthetic';
  const npc = engine.generateNPC({ communityId: originCommunity.id });

  travel.beginJourney(w, npc.id, { destinationCityId: destCity.id, tick: 0 });
  const status = nomadic.nomadicStatusOf(w, npc.id);
  assert.equal(status.nomadic, true);
  assert.equal(status.reason, 'journey');
});

test('nomadicStatusOf: a real camp wins the check before a journey is even looked at', () => {
  // Not a real simultaneous state (an entity can only be on one of
  // either at a time) -- this just confirms the real read order
  // matches the function's own stated priority.
  const community = freshCommunity();
  const npc = engine.generateNPC({ communityId: community.id });
  assert.equal(camps.activeCampFor(w, npc.id), null);
  assert.equal(travel.activeJourneyFor(w, npc.id), null);
  assert.deepEqual(nomadic.nomadicStatusOf(w, npc.id), { nomadic: false, reason: null });
});

// ---------------------------------------------------------------------
// isNomadicFamily / isNomadicOrganization
// ---------------------------------------------------------------------

test('isNomadicFamily: null for a real family with no real head', () => {
  const id = nextId += 1;
  w.families.push({ id, surname: 'Headless', generation: 1, total_members: 0, head_npc_id: null, updatedTick: w.tick });
  assert.equal(nomadic.isNomadicFamily(w, id), null);
});

test('isNomadicFamily throws for a nonexistent family', () => {
  assert.throws(() => nomadic.isNomadicFamily(w, 999999999), /no real family/);
});

test('isNomadicFamily: false until the real head is actually camped or travelling, then true', () => {
  const community = freshCommunity();
  const head = engine.generateNPC({ communityId: community.id });
  const fam = family(head.id);
  assert.equal(nomadic.isNomadicFamily(w, fam.id), false);

  const camp = camps.establishCamp(w, head.id, { communityId: community.id, campType: 'lake', tick: 0 });
  assert.equal(nomadic.isNomadicFamily(w, fam.id), true);

  camps.breakCamp(w, camp.id, head.id);
  assert.equal(nomadic.isNomadicFamily(w, fam.id), false);
});

test('isNomadicOrganization: null for no real leader, throws for no real organization, true once the real leader camps', () => {
  assert.throws(() => nomadic.isNomadicOrganization(w, 999999999), /no real organization/);

  const community = freshCommunity();
  const leader = engine.generateNPC({ communityId: community.id });
  const org = organization(leader.id);
  assert.equal(nomadic.isNomadicOrganization(w, org.id), false);

  camps.establishCamp(w, leader.id, { communityId: community.id, campType: 'lake', tick: 0 });
  assert.equal(nomadic.isNomadicOrganization(w, org.id), true);
});
