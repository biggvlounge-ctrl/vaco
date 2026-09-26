// Mission Chain #1 — "Start Here". See
// dev-docs/TUTORIAL_MISSIONS_DESIGN.md for the full design note.
//
// Three real steps composed, no new mechanic: a seeded starting book
// (not a mission — see the module's own header for why), a real
// Mission over a real searchable landmark, and a real Mission naming a
// real NPC who holds a real occupation.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const knowledge = require('../server/knowledge.js');
const tutorialMissions = require('../server/tutorialMissions.js');

// A landmark with a REAL significance, the same fixture shape
// discovery.test.js uses — `significanceOf` reads through
// `properties.history_ref`, so a bare number on the property would
// test a field nothing reads.
function landmark(worldState, id, category, communityId, significance = 80) {
  const record = { id: 90000 + id, significance, where_location_id: id };
  worldState.historicalRecords.push(record);
  worldState.properties.push({
    id,
    type: 'civic',
    landmark_category: category,
    history_ref: record.id,
    condition: 100,
    land_size: 500,
    floors: 1,
    occupants: [],
    community_id: communityId,
    operating_organization_id: null,
    discoveries_taken: 0,
  });
  return worldState.properties[worldState.properties.length - 1];
}

function hire(worldState, entityId, position) {
  worldState.employmentRecords.push({
    id: worldState.employmentRecords.length + 1,
    entity_id: entityId,
    position,
    status: 'active',
  });
}

test('giveStartingBook hands a real, study-able book to a real entity', () => {
  const npc = engine.generateNPC({ education: 'basic' });
  const result = tutorialMissions.giveStartingBook(engine.WorldState, npc.id);
  assert.equal(result.field, tutorialMissions.DEFAULT_FIELD);
  assert.equal(result.itemName, knowledge.itemNameFor(tutorialMissions.DEFAULT_FIELD, 'books'));

  // It really is study-able through the real action, not just present
  // in inventory.
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const { result: moved } = engine.dispatchAction(player.id, {
    action: 'study', source: 'books', field: result.field,
  });
  assert.ok(moved.traits.length > 0, 'the seeded book did not actually teach anything');
});

test('giveStartingBook refuses a field §24 does not name', () => {
  const npc = engine.generateNPC();
  assert.throws(
    () => tutorialMissions.giveStartingBook(engine.WorldState, npc.id, { field: 'combat' }),
    /not a real §24 field/,
  );
});

test('offerExploreMission opens a real Mission over a real searchable landmark', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7001;
  landmark(engine.WorldState, 7101, 'library', 7001);

  const mission = tutorialMissions.offerExploreMission(engine.WorldState, npc.id);
  assert.ok(mission, 'no mission was opened');
  assert.equal(mission.location_property_id, 7101);
  assert.equal(mission.status, 'available');

  // Real end to end: accept it, search the real landmark, resolve it.
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const accepted = engine.dispatchAction(player.id, { action: 'accept-mission', missionId: mission.id });
  assert.equal(accepted.result.mission.status, 'accepted');

  const searched = engine.dispatchAction(player.id, { action: 'search-location', propertyId: 7101 });
  assert.ok(searched.result.found, 'the seeded landmark had nothing in it');

  const resolved = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: mission.id, outcome: 'completed',
  });
  assert.equal(resolved.result.paid.amount, tutorialMissions.TUTORIAL_EXPLORE_REWARD);
});

test('offerExploreMission returns null rather than throwing when nothing is searchable', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7002; // a community with no landmarks at all
  assert.equal(tutorialMissions.offerExploreMission(engine.WorldState, npc.id), null);
});

test('offerMentorMission names a real NPC who really holds an occupation', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7003;
  const mentor = engine.generateNPC();
  mentor.communityId = 7003;
  hire(engine.WorldState, mentor.id, 'labourer');
  landmark(engine.WorldState, 7301, 'library', 7003);

  const offer = tutorialMissions.offerMentorMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no mentor mission was opened');
  assert.equal(offer.mentorId, mentor.id);
  assert.match(offer.mission.objective, new RegExp(mentor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('offerMentorMission skips somebody with no real occupation', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7004;
  const unemployed = engine.generateNPC();
  unemployed.communityId = 7004;
  landmark(engine.WorldState, 7401, 'library', 7004);

  assert.equal(tutorialMissions.offerMentorMission(engine.WorldState, npc.id), null);
});

test('seedTutorialStart composes all three, and each half is independently real', () => {
  const npc = engine.generateNPC({ education: 'basic' });
  npc.communityId = 7005;
  const mentor = engine.generateNPC();
  mentor.communityId = 7005;
  hire(engine.WorldState, mentor.id, 'trader');
  landmark(engine.WorldState, 7501, 'library', 7005);

  const start = engine.seedTutorialStart(npc.id);
  assert.equal(start.book.field, tutorialMissions.DEFAULT_FIELD);
  assert.ok(start.exploreMission);
  assert.ok(start.mentorMission);
  assert.equal(start.mentorId, mentor.id);
});

test('seedTutorialStart is refused for an entity that does not exist', () => {
  assert.throws(() => engine.seedTutorialStart(999999), /no entity with id/);
});
