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
const worldStore = require('../server/worldStore.js');
const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const tutorialMissions = require('../server/tutorialMissions.js');

const YEAR = 365;

// Pushes a live trait to an exact value via the same real
// `applyKeyModifier` write path every Key resolver uses, rather than
// setting the field directly — so a test that needs a known starting
// point does not read a value a resolver could never have produced.
function setTrait(entityId, family, name, target) {
  const current = engine.getLiveEntity(entityId).traits[family][name];
  engine.applyKeyModifier(entityId, family, name, target - current, engine.WorldState.tick);
}

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

test('offerMysteryMission seeds a real crime and a real, confidence-weighted fact the victim actually holds', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7006;
  const victim = engine.generateNPC();
  victim.communityId = 7006;
  const perpetrator = engine.generateNPC();
  perpetrator.communityId = 7006;
  landmark(engine.WorldState, 7601, 'library', 7006);

  const offer = tutorialMissions.offerMysteryMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no mystery mission was opened');
  assert.equal(offer.victimId, victim.id);
  assert.equal(offer.perpetratorId, perpetrator.id);
  assert.equal(offer.incident.category, tutorialMissions.TUTORIAL_CRIME_CATEGORY);
  assert.match(offer.mission.objective, new RegExp(victim.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const victimKnowledge = worldStore.getKnowledge(engine.WorldState, victim.id, perpetrator.id);
  assert.ok(victimKnowledge.length > 0, 'the victim came away knowing nothing about who wronged them');
  assert.ok(victimKnowledge[0].confidence_level > 0);
});

test('offerMysteryMission returns null without two other real people in the community', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7007; // nobody else here
  assert.equal(tutorialMissions.offerMysteryMission(engine.WorldState, npc.id), null);
});

test('Chain #2 end to end: asking the victim really moves the fact to the player, over the real dispatcher', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7008;
  const victim = engine.generateNPC();
  victim.communityId = 7008;
  const perpetrator = engine.generateNPC();
  perpetrator.communityId = 7008;
  landmark(engine.WorldState, 7701, 'library', 7008);

  const offer = tutorialMissions.offerMysteryMission(engine.WorldState, npc.id);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  // Before asking, the player's own NPC knows nothing about the culprit.
  assert.equal(worldStore.getKnowledge(engine.WorldState, npc.id, perpetrator.id).length, 0);

  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: offer.mission.id });
  engine.dispatchAction(player.id, {
    action: 'call-meeting', attendeeIds: [victim.id], purpose: 'sit-down',
  });

  // shareAround really copied it — the same read GET /api/npcs/:id
  // already serves.
  const learned = worldStore.getKnowledge(engine.WorldState, npc.id, perpetrator.id);
  assert.ok(learned.length > 0, 'asking around taught the player nothing');
  assert.equal(learned[0].source_entity_id, victim.id, 'the fact does not say who it was heard from');

  const resolved = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: offer.mission.id, outcome: 'completed',
  });
  assert.equal(resolved.result.paid.amount, tutorialMissions.TUTORIAL_MYSTERY_REWARD);
});

test('offerSurvivalMission opens a real Mission over a real, measured shortage', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7009;
  engine.WorldState.communities.push({ id: 7009, city_id: 9009 });
  landmark(engine.WorldState, 7901, 'library', 7009);
  economy.generateResource(engine.WorldState, {
    cityId: 9009, resourceType: 'food', supply: 1, demand: 100,
  });

  const offer = tutorialMissions.offerSurvivalMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no survival mission was opened');
  assert.ok(offer.scarcity > 0, 'a demand:100/supply:1 resource must read as a real shortage');
  assert.equal(offer.mission.location_property_id, 7901);
  assert.match(offer.mission.objective, /shortage/);
  assert.equal(typeof offer.atRisk, 'boolean');

  // Real end to end: sell something real to build savings, same verb
  // the design note names as the answer to this mission.
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  engine.generateIndividualFinances(npc.id, {
    income: 0, savings: 1000, debt: 0, assets: 0,
  });
  const seller = engine.generateNPC();
  inventory.give(engine.WorldState, {
    entityId: seller.id, itemName: 'Hammer', quantity: 1, tick: engine.WorldState.tick,
  });
  const accepted = engine.dispatchAction(player.id, { action: 'accept-mission', missionId: offer.mission.id });
  assert.equal(accepted.result.mission.status, 'accepted');
  const traded = engine.dispatchAction(player.id, {
    action: 'trade', sellerId: seller.id, itemName: 'Hammer', quantity: 1,
  });
  assert.equal(traded.result.settled, true, traded.result.reason);
  const resolved = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: offer.mission.id, outcome: 'completed',
  });
  assert.equal(resolved.result.paid.amount, tutorialMissions.TUTORIAL_SURVIVAL_REWARD);
});

test('offerSurvivalMission returns null when the city is not really short of anything', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7010;
  engine.WorldState.communities.push({ id: 7010, city_id: 9010 });
  landmark(engine.WorldState, 7902, 'library', 7010);
  // No resources tracked at all for city 9010 — survivalScarcity reads 0.
  assert.equal(tutorialMissions.offerSurvivalMission(engine.WorldState, npc.id), null);
});

test('survivalStatusFor is a real, live read of the same threshold the mission uses', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7011;
  engine.WorldState.communities.push({ id: 7011, city_id: 9011 });
  economy.generateResource(engine.WorldState, {
    cityId: 9011, resourceType: 'water', supply: 1, demand: 50,
  });
  const status = engine.survivalStatusFor(npc.id);
  assert.equal(status.cityId, 9011);
  assert.ok(status.scarcity > 0);
  assert.equal(typeof status.atRisk, 'boolean');
});

test('offerTakeoverMission opens a real Mission over the easiest real, currently winnable property', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7012;
  npc.createdTick = engine.WorldState.tick - 30 * YEAR; // old enough to count as labour at all
  engine.WorldState.communities.push({ id: 7012, city_id: 9012 });
  const family = engine.generateFamily({ surname: 'Ransom' });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  landmark(engine.WorldState, 7912, 'shop', 7012);
  inventory.give(engine.WorldState, {
    entityId: npc.id, itemName: 'Hammer', quantity: 1, tick: engine.WorldState.tick,
  });

  const offer = tutorialMissions.offerTakeoverMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no takeover mission was opened');
  assert.equal(offer.locationId, 7912);
  assert.equal(offer.tribeId, family.id);
  assert.match(offer.mission.objective, /take/);
  assert.ok(offer.finalSuccessProbability > 0);

  // Real end to end: look before you leap (`assess-takeover`, already
  // a real player action), then try it (`attempt-takeover`), then
  // resolve the mission — the same two verbs Phase 3 already built and
  // no mission had ever used.
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const accepted = engine.dispatchAction(player.id, {
    action: 'accept-mission', missionId: offer.mission.id,
  });
  assert.equal(accepted.result.mission.status, 'accepted');

  const assessed = engine.dispatchAction(player.id, {
    action: 'assess-takeover', scale: 'property', locationId: 7912,
  });
  assert.equal(assessed.result.resolution.compositionRequirementMet, true);

  const attempted = engine.dispatchAction(player.id, {
    action: 'attempt-takeover', scale: 'property', locationId: 7912,
  });
  assert.ok(attempted.result, 'attempt-takeover must answer something either way');

  const resolved = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: offer.mission.id, outcome: 'completed',
  });
  assert.equal(resolved.result.paid.amount, tutorialMissions.TUTORIAL_TAKEOVER_REWARD);
});

test('offerTakeoverMission returns null for a citizen with no real family to act as a tribe', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7013;
  npc.createdTick = engine.WorldState.tick - 30 * YEAR;
  engine.WorldState.communities.push({ id: 7013, city_id: 9013 });
  landmark(engine.WorldState, 7903, 'shop', 7013);
  assert.equal(tutorialMissions.offerTakeoverMission(engine.WorldState, npc.id), null);
});

test('offerTakeoverMission returns null when nothing reachable is currently winnable', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7014;
  npc.createdTick = engine.WorldState.tick - 30 * YEAR;
  engine.WorldState.communities.push({ id: 7014, city_id: 9014 });
  const family = engine.generateFamily({ surname: 'Empty-Handed' });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  // A real property exists, but the tribe carries no real tools at all
  // — a real, possible shortfall, not a gap in the check.
  landmark(engine.WorldState, 7904, 'shop', 7014);
  assert.equal(tutorialMissions.offerTakeoverMission(engine.WorldState, npc.id), null);
});

test('offerShowdownMission names the toughest real opponent in the community, by real combat rating', () => {
  const npc = engine.generateNPC();
  npc.communityId = 8001;
  const weak = engine.generateNPC();
  weak.communityId = 8001;
  const tough = engine.generateNPC();
  tough.communityId = 8001;
  landmark(engine.WorldState, 8101, 'shop', 8001);

  const weakRating = engine.rateEntity(weak.id, 'combat').rating;
  // Push the tough NPC's live combat traits above the weak one's by a
  // real, measured amount, through the same key-modifier path every
  // resolver in this engine uses — not a hand-set field.
  engine.applyKeyModifier(tough.id, 'combat', 'Melee Skill', 100, engine.WorldState.tick);
  engine.applyKeyModifier(tough.id, 'combat', 'Weapon Mastery', 100, engine.WorldState.tick);
  const toughRating = engine.rateEntity(tough.id, 'combat').rating;
  assert.ok(toughRating > weakRating, 'the fixture must actually produce a tougher opponent');

  const offer = tutorialMissions.offerShowdownMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no showdown mission was opened');
  assert.equal(offer.opponentId, tough.id, 'the toughest real opponent must be the one named');
  assert.match(offer.mission.objective, new RegExp(tough.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('offerShowdownMission returns null for a citizen with nobody real to fight', () => {
  const npc = engine.generateNPC();
  npc.communityId = 8002; // alone
  assert.equal(tutorialMissions.offerShowdownMission(engine.WorldState, npc.id), null);
});

test('Chain #5 end to end: entering the real fight costs real stress either way, more for losing', () => {
  const npc = engine.generateNPC();
  npc.communityId = 8003;
  const opponent = engine.generateNPC();
  opponent.communityId = 8003;
  landmark(engine.WorldState, 8301, 'shop', 8003);

  const offer = tutorialMissions.offerShowdownMission(engine.WorldState, npc.id);
  assert.ok(offer);
  assert.equal(offer.opponentId, opponent.id);

  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: offer.mission.id });

  // Pin `loadMultiplier` to exactly 1 for BOTH fighters (equal
  // Volatility/Resilience, at whatever the clamp ceiling is) so the
  // stress delta below is a known constant rather than either
  // person's own random resilience — the eighth standing rule's own
  // fix, applied here. Confidence and Stamina are pinned to the middle
  // of their real 0..100 range for the same reason: a random birth
  // draw near either clamp would silently truncate the deltas below.
  for (const id of [npc.id, opponent.id]) {
    engine.applyKeyModifier(id, 'emotional', 'Volatility', 1000, engine.WorldState.tick);
    engine.applyKeyModifier(id, 'emotional', 'Resilience', 1000, engine.WorldState.tick);
    setTrait(id, 'personality', 'Confidence', 50);
    setTrait(id, 'physical', 'Stamina', 50);
  }

  const before = engine.getEntityState(npc.id)?.stressLevel ?? 0;
  const confidenceBefore = engine.getLiveEntity(npc.id).traits.personality.Confidence;
  const staminaBefore = engine.getLiveEntity(npc.id).traits.physical.Stamina;
  const fought = engine.dispatchAction(player.id, {
    action: 'enter-contest', opponentId: opponent.id, discipline: 'combat', contestId: 'showdown-8003',
  });
  assert.equal(fought.result.stakesApplied, true);
  assert.ok(fought.result.events.length > 0, 'a real fight must reach the event log');

  // `winProbability` is capped at 0.97 — never certain — so either
  // real outcome is a real possibility here and the assertion has to
  // name both, not assume the favourite always wins.
  const npcWon = fought.result.winnerId === npc.id;
  const expected = npcWon ? engine.SHOWDOWN_STRESS_WIN : engine.SHOWDOWN_STRESS_LOSS;
  const after = engine.getEntityState(npc.id)?.stressLevel ?? 0;
  assert.equal(
    Math.round((after - before) * 100) / 100, expected,
    `${npcWon ? 'winning' : 'losing'} must cost exactly the real, matching stress constant`,
  );
  assert.ok(
    engine.SHOWDOWN_STRESS_LOSS > engine.SHOWDOWN_STRESS_WIN,
    'losing must cost more than winning, or the fight was never dangerous',
  );

  // Pride — mapped to the one real trait that is actually about
  // self-belief, `personality.Confidence` — swings symmetrically with
  // the outcome, unlike stress.
  const confidenceAfter = engine.getLiveEntity(npc.id).traits.personality.Confidence;
  const confidenceSwing = npcWon ? engine.SHOWDOWN_CONFIDENCE_SWING : -engine.SHOWDOWN_CONFIDENCE_SWING;
  assert.equal(
    Math.round((confidenceAfter - confidenceBefore) * 100) / 100, confidenceSwing,
    'pride must swing by exactly the real, matching confidence constant',
  );

  // Stamina — real exertion, the same for both outcomes, since a fight
  // is equally tiring whether you win it or not.
  const staminaAfter = engine.getLiveEntity(npc.id).traits.physical.Stamina;
  assert.equal(
    Math.round((staminaAfter - staminaBefore) * 100) / 100, -engine.SHOWDOWN_STAMINA_COST,
    'a real fight must cost real stamina regardless of who won',
  );

  // Skills — real, but earned slowly through the habit of fighting,
  // the same way `compete` grows athleticism. One bout starts the
  // habit; it does not hand over a skill point outright.
  const sparring = engine.listHabits(npc.id).find((h) => h.habit_name === 'sparring');
  assert.ok(sparring, 'entering a real fight must start the real habit of fighting');
  assert.ok(sparring.strength > 0);

  // The other four disciplines stay exactly as they were — a friendly
  // game must not suddenly cost more through the dispatcher than it
  // does through a tick.
  const other = engine.generateNPC();
  other.communityId = 8003;
  const beforeGame = engine.getEntityState(npc.id)?.stressLevel ?? 0;
  const game = engine.dispatchAction(player.id, {
    action: 'enter-contest', opponentId: other.id, discipline: 'wits', contestId: 'card-game-8003',
  });
  assert.equal(game.result.stakesApplied, undefined);
  assert.equal(engine.getEntityState(npc.id)?.stressLevel ?? 0, beforeGame);

  const resolved = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: offer.mission.id, outcome: npcWon ? 'completed' : 'failed',
  });
  if (npcWon) {
    assert.equal(resolved.result.paid.amount, tutorialMissions.TUTORIAL_SHOWDOWN_REWARD);
  } else {
    assert.equal(resolved.result.paid, null, 'a lost fight paid out nothing, same as any other failed mission');
  }
});

test('seedTutorialStart composes all seven, and each half is independently real', () => {
  const npc = engine.generateNPC({ education: 'basic' });
  npc.communityId = 7005;
  // Order matters: offerMysteryMission casts the first two OTHER real
  // NPCs in the community as victim/perpetrator, so they are generated
  // before the mentor to keep this test's own assertions deterministic
  // — the real function itself makes no such distinction.
  const victim = engine.generateNPC();
  victim.communityId = 7005;
  const perpetrator = engine.generateNPC();
  perpetrator.communityId = 7005;
  const mentor = engine.generateNPC();
  mentor.communityId = 7005;
  hire(engine.WorldState, mentor.id, 'trader');
  landmark(engine.WorldState, 7501, 'library', 7005);
  engine.WorldState.communities.push({ id: 7005, city_id: 9005 });
  economy.generateResource(engine.WorldState, {
    cityId: 9005, resourceType: 'medicine', supply: 1, demand: 80,
  });

  const start = engine.seedTutorialStart(npc.id);
  assert.equal(start.book.field, tutorialMissions.DEFAULT_FIELD);
  assert.ok(start.exploreMission);
  assert.ok(start.mentorMission);
  assert.equal(start.mentorId, mentor.id);
  assert.ok(start.mysteryMission);
  assert.equal(start.mysteryVictimId, victim.id);
  assert.ok(start.survivalMission, 'the real medicine shortage should have opened a survival mission too');
  assert.ok(start.survivalScarcity > 0);
  assert.equal(start.takeoverMission, null, 'this citizen belongs to no family, so no tribe can act');
  assert.ok(start.showdownMission, 'real other people in the community means a real opponent exists');
  assert.ok([victim.id, perpetrator.id, mentor.id].includes(start.showdownOpponentId));

  // The tracker reports the same six real Missions, live.
  const progress = engine.tutorialProgressFor(npc.id);
  assert.equal(progress.totalMissions, 6);
  assert.equal(progress.completedCount, 0);
  assert.equal(progress.allComplete, false);
  assert.equal(progress.book.given, true);
  assert.equal(progress.book.field, tutorialMissions.DEFAULT_FIELD);

  const byKey = (key) => progress.chainMissions.find((m) => m.missionId === start[key]?.id);
  assert.equal(byKey('exploreMission').status, 'available');
  assert.equal(byKey('mentorMission').status, 'available');
  assert.equal(byKey('mysteryMission').status, 'available');
  assert.equal(byKey('survivalMission').status, 'available');
  assert.equal(byKey('showdownMission').status, 'available');

  // Chain 4 was never offered — a real, correct absence, not a gap —
  // and the tracker says so rather than pretending it exists.
  const takeoverRow = progress.chainMissions.find((m) => m.chain === 4);
  assert.equal(takeoverRow.missionId, null);
  assert.equal(takeoverRow.status, 'not offered');
});

test('tutorialProgressFor reflects real mission status changes, live', () => {
  const npc = engine.generateNPC();
  npc.communityId = 7015;
  engine.WorldState.communities.push({ id: 7015, city_id: 9015 });
  landmark(engine.WorldState, 7905, 'library', 7015);

  const offer = tutorialMissions.offerExploreMission(engine.WorldState, npc.id);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  // Record just this one mission's tracking row through the real
  // function `seedTutorialStart` uses internally, so this test does
  // not depend on the other five chains' real preconditions holding
  // too.
  tutorialMissions.recordTutorialProgress(engine.WorldState, npc.id, { exploreMission: offer });

  const before = engine.tutorialProgressFor(npc.id);
  const row = before.chainMissions.find((m) => m.chain === 1 && m.part === 'explore the landmark');
  assert.equal(row.status, 'available');

  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: offer.id });
  const afterAccept = engine.tutorialProgressFor(npc.id);
  assert.equal(
    afterAccept.chainMissions.find((m) => m.missionId === offer.id).status, 'accepted',
  );

  engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: offer.id, outcome: 'completed',
  });
  const afterResolve = engine.tutorialProgressFor(npc.id);
  assert.equal(
    afterResolve.chainMissions.find((m) => m.missionId === offer.id).status, 'completed',
  );
  assert.equal(afterResolve.completedCount, 1);
});

test('tutorialProgressFor is refused for an entity that does not exist', () => {
  assert.throws(() => engine.tutorialProgressFor(999999), /no entity with id/);
});

test('tutorialProgressFor for a citizen who was never seeded reports every chain as not offered', () => {
  const npc = engine.generateNPC();
  const progress = engine.tutorialProgressFor(npc.id);
  assert.equal(progress.totalMissions, 6);
  assert.ok(progress.chainMissions.every((m) => m.status === 'not offered' && m.missionId === null));
  assert.equal(progress.book.given, false);
});

test('seedTutorialStart is refused for an entity that does not exist', () => {
  assert.throws(() => engine.seedTutorialStart(999999), /no entity with id/);
});
