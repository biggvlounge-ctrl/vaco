// "Explore skyscraper, explore library... every time we learn how to
// fish, we read a book... finding [main characters] will help us
// build missions that will happen in normal situations" — by direct
// instruction. `server/missionTriggers.js` is the real, bounded-chance
// wiring between a player visiting a real location and the real
// criminal main character controlling it (`mainCharacters.
// criminalLeaderOf`). See that file's own header for the measured
// rate and the honest scope (criminal only; `search-location` always,
// `practise-habit` only with an explicit `locationPropertyId`).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const missionTriggers = require('../server/missionTriggers.js');
const missions = require('../server/missions.js');
const engine = require('../server/engine.js');

// Standing rule 8: a hand-built world with exactly the real substrate
// `maybeTriggerMission` reads — a landmark property, a community, and
// (when requested) a real faction actually holding that community's
// ground with a real, installed leader.
function baseWorld() {
  return {
    tick: 0,
    communities: [{ id: 9, city_id: 1 }],
    properties: [{ id: 501, community_id: 9, landmark_category: 'library', name: 'Central Library' }],
    organizations: [],
    territoryBlocks: [],
    entityTraits: [],
    missions: [],
  };
}

// Same real-generator pattern test/authority.test.js and
// test/mainCharacters.test.js already use — `authority.holderOf`
// reads a faction's traits through `getLiveEntity`, which needs real
// `entity_traits` rows, not a hand-set `.traits` sheet.
function withControllingFaction(w, { leaderId = 701 } = {}) {
  const faction = engine.generateFaction({
    name: 'The Outfit', type: 'gang', traitValueFor: () => 80, leaderId,
  });
  w.organizations.push(faction);
  w.entityTraits = engine.WorldState.entityTraits.filter((r) => r.entity_id === faction.id);
  w.territoryBlocks = [{ id: 1, faction_id: faction.id, city_id: 1, community_id: 9, status: 'controlled' }];
  return faction;
}

test('no faction holding this ground: honestly nothing, never thrown', () => {
  const w = baseWorld();
  assert.equal(missionTriggers.maybeTriggerMission(w, 1, 501, { tick: 0 }), null);
});

test('a faction holds the ground but has no installed leader yet: honestly nothing', () => {
  const w = baseWorld();
  withControllingFaction(w, { leaderId: null });
  assert.equal(missionTriggers.maybeTriggerMission(w, 1, 501, { tick: 0 }), null);
});

test('a real faction with a real leader: repeated visits eventually generate a real mission, at the measured rate', () => {
  const w = baseWorld();
  const faction = withControllingFaction(w);

  let generated = null;
  let tick = 0;
  // The measured table in missionTriggers.js's own header says 0.1
  // should land well within 50 tries (mean 10.2) — generous headroom
  // above that so this test is not itself a coin flip on the seed.
  for (; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated, 'expected a mission to have generated within 50 visits');
  assert.equal(generated.location_property_id, 501);
  assert.equal(generated.controlling_faction_id, faction.id);
  assert.equal(generated.status, 'available');
  assert.equal(w.missions.length, 1);
});

test('a location with an already-open mission from its own main character gets no second one', () => {
  const w = baseWorld();
  withControllingFaction(w);
  // Force an already-open mission at this exact location, bypassing
  // the draw, to isolate the cap itself from the rate.
  missions.generateMission(w, { locationId: 501, objective: 'already working this one' });
  assert.equal(w.missions.length, 1);

  for (let tick = 0; tick < 100; tick += 1) {
    const result = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
    assert.equal(result, null, `tick ${tick}: must not stack a second open mission on this location`);
  }
  assert.equal(w.missions.length, 1, 'still exactly the one mission, never a second');
});

test('a resolved mission frees the location up again', () => {
  const w = baseWorld();
  withControllingFaction(w);
  const first = missions.generateMission(w, { locationId: 501, controllingFactionId: null, objective: 'first job' });
  first.status = 'resolved';
  assert.equal(missionTriggers.hasOpenMissionAt(w, 501), false);
});

test('reinforceHabit: practising at a real controlled location can generate a mission; practising with no location never can', () => {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const community = engine.generateCommunity({});
  const property = engine.generateProperty({
    type: 'commercial', value: 50000, communityId: community.id, landmarkCategory: 'library',
  });

  const faction = engine.generateFaction({ name: 'Measured Outfit', traitValueFor: () => 80, leaderId: npc.id });
  engine.WorldState.territoryBlocks.push({
    id: engine.WorldState.territoryBlocks.length + 1,
    faction_id: faction.id, city_id: 1, community_id: community.id, status: 'controlled',
  });

  // No location at all: never triggers, however long you try. The
  // tick is advanced by hand each time (rather than
  // `engine.advanceTick()`, which runs the full pipeline) because the
  // draw is keyed on (tick, propertyId, entityId) — standing rule 8,
  // isolating the one thing this test is actually about.
  for (let i = 0; i < 20; i += 1) {
    engine.WorldState.tick = i;
    const result = engine.dispatchAction(player.id, { action: 'practise-habit', name: 'reading' });
    assert.equal(result.result.missionGenerated, null);
  }

  // With a real location whose community has a real criminal leader:
  // eventually a mission, same measured rate as search-location.
  let found = null;
  for (let i = 0; i < 50 && !found; i += 1) {
    engine.WorldState.tick = 1000 + i;
    const result = engine.dispatchAction(player.id, {
      action: 'practise-habit', name: 'reading', locationPropertyId: property.id,
    });
    found = result.result.missionGenerated;
  }
  assert.ok(found, 'expected practise-habit with a real controlled location to eventually generate a mission');
  assert.equal(found.location_property_id, property.id);
});
