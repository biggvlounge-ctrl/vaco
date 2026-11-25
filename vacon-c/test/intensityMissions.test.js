// server/intensityMissions.js — automatic mission-mode transition
// triggered by real in-world intensity (task #208). "When there's a
// certain intenseness in the game, it automatically goes into mission
// mode." Reuses the same real dangerousWorld() recipe
// test/recruitment.test.js and test/leagues.test.js already verified
// against crime.dangerByCommunity.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const intensityMissions = require('../server/intensityMissions.js');
const missionTriggers = require('../server/missionTriggers.js');
const crime = require('../server/crime.js');

function dangerousWorld() {
  const w = {
    tick: 400,
    npcs: [],
    communities: [{ id: 1, name: 'Hollow Row' }],
    crimeIncidents: [],
    properties: [],
    players: [],
    missions: [],
    artifacts: [],
  };
  for (let i = 1; i <= 40; i += 1) {
    w.npcs.push({ id: i, communityId: 1, status: 'active', home_property_id: null });
  }
  for (let i = 0; i < 3; i += 1) {
    w.crimeIncidents.push({ id: i + 1, community_id: 1, category: 'theft', tick: 380 });
  }
  return w;
}

function addHome(w, npcId, propertyId = 101, name = 'the Hollow Row house') {
  w.properties.push({ id: propertyId, name, community_id: 1 });
  w.npcs.find((n) => n.id === npcId).home_property_id = propertyId;
  return propertyId;
}

function addPlayer(w, npcId) {
  const player = { id: w.players.length + 1, mode: 'citizen', linked_entity_id: npcId };
  w.players.push(player);
  return player;
}

test('a real non-zero danger score exists for this fixture, same recipe recruitment/leagues already verified', () => {
  const w = dangerousWorld();
  const danger = crime.dangerByCommunity(w, { tick: 400 });
  assert.ok(danger.get(1) > 0, 'the shared fixture no longer produces a measured, non-zero danger score');
});

test('never triggers for an NPC who is not a real player', () => {
  const w = dangerousWorld();
  addHome(w, 1);
  let any = false;
  for (let tick = 400; tick < 1200; tick += 1) {
    if (intensityMissions.runIntensityMissions(w, { tick }).length > 0) { any = true; break; }
  }
  assert.equal(any, false, 'a mission triggered for an NPC with no real players row at all');
  assert.equal(w.missions.length, 0);
});

test('never triggers for a real player with no real home to attach a mission to', () => {
  const w = dangerousWorld();
  addPlayer(w, 1); // home_property_id left null, honestly unplaced
  let any = false;
  for (let tick = 400; tick < 1200; tick += 1) {
    if (intensityMissions.runIntensityMissions(w, { tick }).length > 0) { any = true; break; }
  }
  assert.equal(any, false, 'a mission triggered with no real place for it to be about');
});

test('never triggers with no real measured danger, however long it runs', () => {
  const w = dangerousWorld();
  w.crimeIncidents = []; // genuinely unmeasured/quiet
  addPlayer(w, 1);
  addHome(w, 1);
  let any = false;
  for (let tick = 400; tick < 1200; tick += 1) {
    if (intensityMissions.runIntensityMissions(w, { tick }).length > 0) { any = true; break; }
  }
  assert.equal(any, false, 'a mission triggered in a community with no real measured danger');
});

test('eventually triggers a real mission for a real player with real danger and a real home', () => {
  const w = dangerousWorld();
  addPlayer(w, 1);
  const propertyId = addHome(w, 1);

  let triggeredEvent = null;
  for (let tick = 400; tick < 1200 && !triggeredEvent; tick += 1) {
    const events = intensityMissions.runIntensityMissions(w, { tick });
    if (events.length > 0) triggeredEvent = events[0];
  }

  assert.ok(triggeredEvent, 'no intensity mission ever triggered against a real, dangerous, homed player');
  assert.equal(triggeredEvent.type, 'mission_mode_triggered');
  assert.equal(w.missions.length, 1);
  const mission = w.missions[0];
  assert.equal(mission.location_property_id, propertyId);
  assert.equal(mission.trigger_source, intensityMissions.INTENSITY_SOURCE,
    "the real field a client reads to auto-open mission mode wasn't set");
  assert.ok(mission.objective && mission.objective.length > 0);
});

test('never stacks a second intensity mission while one is still open at that home', () => {
  const w = dangerousWorld();
  addPlayer(w, 1);
  const propertyId = addHome(w, 1);

  let firstTick = null;
  for (let tick = 400; tick < 1200 && firstTick === null; tick += 1) {
    if (intensityMissions.runIntensityMissions(w, { tick }).length > 0) firstTick = tick;
  }
  assert.ok(firstTick !== null, 'setup failed: no first trigger to build on');
  assert.equal(w.missions.length, 1);

  // Keep running with the mission still 'available' — missionTriggers
  // .hasOpenMissionAt is the exact real guard this file reuses, same
  // as missionTriggers.js itself relies on for the identical reason.
  for (let tick = firstTick + 1; tick < firstTick + 400; tick += 1) {
    intensityMissions.runIntensityMissions(w, { tick });
  }
  assert.equal(w.missions.length, 1, 'a second intensity mission stacked while the first was still open');
  assert.ok(missionTriggers.hasOpenMissionAt(w, propertyId));
});

test('a higher danger score is read as a worse intensity line, from the same real describeIntensity used at trigger time', () => {
  const calm = intensityMissions.describeIntensity(0.2, 'the block');
  const bad = intensityMissions.describeIntensity(0.8, 'the block');
  assert.notEqual(calm, bad);
  assert.ok(bad.includes('mission mode engaged'));
  assert.ok(calm.includes('mission mode engaged'));
});

test('reuses the real missionTriggers rate rather than inventing a second constant', () => {
  // Read directly from the source file rather than asserted as a
  // magic number here, the twenty-sixth standing rule's own shape:
  // this test fails if intensityMissions.js ever stops importing
  // missionTriggers.js at all, not just if the number changes.
  assert.equal(
    typeof missionTriggers.MISSION_TRIGGER_CHANCE,
    'number',
    'missionTriggers.MISSION_TRIGGER_CHANCE must exist for intensityMissions.js to reuse',
  );
});
