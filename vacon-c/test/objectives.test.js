// A real, large objectives/checklist system — task #106.
//
// Every entry is one real action aimed at one real target already in
// `worldState`, never a second, invented quest list. See
// server/objectives.js's own header for exactly which five action
// types this covers and why the rest are left out.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const objectives = require('../server/objectives.js');
const landmarks = require('../server/landmarks.js');
const missions = require('../server/missions.js');

function world() {
  return {
    tick: 100,
    seed: 'objectives-test',
    npcs: [],
    properties: [],
    historicalRecords: [],
    missions: [],
    organizations: [],
    entityOrganizationMemberships: [],
    families: [],
    familyMemberships: [],
    relationships: [],
  };
}

function person(w, id) {
  w.npcs.push({ id, status: 'active', community_id: 1, traits: {} });
  return w.npcs[w.npcs.length - 1];
}

// A real landmark with real significance, same fixture shape
// `test/discovery.test.js` already establishes for the same reason:
// `findsAt`/`remainingAt` read significance through `history_ref`,
// not a bare number on the property.
function landmark(w, id, category, significance = 80, communityId = 1) {
  const record = { id: 5000 + id, significance, where_location_id: id };
  w.historicalRecords.push(record);
  w.properties.push({
    id,
    type: landmarks.propertyTypeFor(category),
    landmark_category: category,
    history_ref: record.id,
    community_id: communityId,
    discoveries_taken: 0,
  });
  return w.properties[w.properties.length - 1];
}

function organization(w, id, name = `org ${id}`) {
  w.organizations.push({ id, name, isFaction: false, leader_id: null });
  return w.organizations[w.organizations.length - 1];
}

test('an entity alone in an otherwise empty world has no real objectives', () => {
  const w = world();
  person(w, 1);
  const result = objectives.objectivesFor(w, 1);
  assert.deepEqual(result, { total: 0, objectives: [] });
});

test('talk-to and ask-around are offered for every other real living NPC, never for self', () => {
  const w = world();
  person(w, 1);
  person(w, 2);
  person(w, 3);
  const result = objectives.objectivesFor(w, 1);
  const talk = result.objectives.filter((o) => o.action === 'talk-to');
  const ask = result.objectives.filter((o) => o.action === 'ask-around');
  assert.equal(talk.length, 2);
  assert.equal(ask.length, 2);
  assert.ok(talk.every((o) => o.params.npcEntityId !== 1));
  assert.ok(ask.every((o) => o.params.subjectEntityId !== 1));
});

test('search-location is offered only for a real, currently searchable property', () => {
  const w = world();
  person(w, 1);
  landmark(w, 10, 'library', 80); // real pool, real finds left
  w.properties.push({ id: 11, type: 'house', community_id: 1 }); // no landmark_category at all
  const searchedOut = landmark(w, 12, 'library', 80);
  // Exhaust it exactly: searchObjectives must agree with discovery's
  // own remainingAt, not a second guess at the total.
  const discovery = require('../server/discovery.js');
  searchedOut.discoveries_taken = discovery.findsAt(w, 12);

  const result = objectives.objectivesFor(w, 1);
  const search = result.objectives.filter((o) => o.action === 'search-location');
  assert.deepEqual(search.map((o) => o.params.propertyId), [10]);
});

test('accept-mission mirrors availableMissions exactly, never a second filter', () => {
  const w = world();
  person(w, 1);
  landmark(w, 20, 'library', 80);
  const available = missions.generateMission(w, { locationId: 20, objective: 'Find the ledger' });
  const taken = missions.generateMission(w, { locationId: 20, objective: 'Already claimed' });
  taken.status = 'accepted';

  const result = objectives.objectivesFor(w, 1);
  const accept = result.objectives.filter((o) => o.action === 'accept-mission');
  assert.deepEqual(accept.map((o) => o.params.missionId), [available.id]);
  assert.match(accept[0].label, /Find the ledger/);
});

test('consult-heist is never offered with no real sponsor context', () => {
  const w = world();
  person(w, 1);
  organization(w, 50, 'Rival Co');
  const result = objectives.objectivesFor(w, 1);
  assert.equal(result.objectives.filter((o) => o.action === 'consult-heist').length, 0);
});

test('consult-heist uses the real organization membership when the entity has one', () => {
  const w = world();
  person(w, 1);
  organization(w, 40, 'Home Org');
  organization(w, 50, 'Rival Co');
  w.entityOrganizationMemberships.push({ entity_id: 1, organization_id: 40 });

  const result = objectives.objectivesFor(w, 1);
  const consult = result.objectives.filter((o) => o.action === 'consult-heist');
  // One target per real organization, including the player's own --
  // consulting about your own organization is a real, if odd, read,
  // and this module does not second-guess which targets are sensible,
  // only which ones `heists.js` would actually accept.
  assert.equal(consult.length, 2);
  assert.ok(consult.every((o) => o.params.organizationId === 40 && o.params.familyId === null));
});

test('consult-heist falls back to a real family membership when there is no organization one', () => {
  const w = world();
  person(w, 1);
  organization(w, 50, 'Rival Co');
  w.families.push({ id: 7, head_npc_id: 1 });
  w.familyMemberships.push({ entity_id: 1, family_id: 7 });

  const result = objectives.objectivesFor(w, 1);
  const consult = result.objectives.filter((o) => o.action === 'consult-heist');
  assert.equal(consult.length, 1);
  assert.deepEqual(consult[0].params, { organizationId: null, familyId: 7, targetOrganizationId: 50 });
});

test('a limit bounds the returned list but total still reports the real, full count', () => {
  const w = world();
  person(w, 1);
  for (let i = 2; i <= 12; i += 1) person(w, i);

  const result = objectives.objectivesFor(w, 1, { limit: 5 });
  assert.equal(result.objectives.length, 5);
  assert.equal(result.total, 22); // 11 other NPCs * (talk-to + ask-around)
});

test('an unknown entity is refused honestly rather than returning an empty list', () => {
  const w = world();
  person(w, 1);
  assert.throws(() => objectives.objectivesFor(w, 999), /no entity with id 999/);
});
