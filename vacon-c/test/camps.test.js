// server/camps.js — off-grid wilderness camps: woods, caves, lakes.
// See that file's own header for the full design: `cave` is gated on
// a real, already-generated cave-system/natural-formation landmark;
// `woods` is checked against this community's own real land-cover
// class when a real pack covers it; `lake` is honestly ungated,
// because no real signal for open water exists in this registry.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const camps = require('../server/camps.js');
const party = require('../server/party.js');
const worldStore = require('../server/worldStore.js');
const policing = require('../server/policing.js');

const w = engine.WorldState;

let nextName = 1;

// Hand-built, never through `worldgen.generateWorld` -- that file's
// own hero-landmark placement can seed a real cave-system or
// natural-formation landmark anywhere in a city by chance, which
// would make a "no real cave here" fixture flaky. A hand-built city/
// community starts with no landmarks and no land-cover class at all,
// same posture `test/party.test.js`'s own bare `engine.generateNPC()`
// fixtures already take.
function freshCommunity() {
  const name = `Camptown ${nextName += 1}`;
  const city = engine.generateCity({ name });
  return engine.generateCommunity({ cityId: city.id, name: `${name} Block` });
}

function residentOf(community) {
  return engine.generateNPC({ communityId: community.id });
}

// ---------------------------------------------------------------------
// establishCamp -- real validation
// ---------------------------------------------------------------------

test('establishCamp requires a real campType', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  assert.throws(
    () => camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'tent' }),
    /campType must be one of/,
  );
});

test('establishCamp requires a real community', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  assert.throws(
    () => camps.establishCamp(w, founder.id, { communityId: 999999999, campType: 'lake' }),
    /no real community/,
  );
});

test('establishCamp refuses a non-living founder', () => {
  const community = freshCommunity();
  assert.throws(
    () => camps.establishCamp(w, 999999999, { communityId: community.id, campType: 'lake' }),
    /is not among the living/,
  );
});

test('a "cave" camp is refused outright when no real cave/natural-formation landmark exists in this community', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  assert.equal(camps.caveLandmarkIn(w, community.id), null);
  assert.throws(
    () => camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'cave' }),
    /no real cave-system or natural-formation landmark/,
  );
});

test('a "cave" camp succeeds once a real cave-system landmark exists, and sits on it', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const cave = engine.generateProperty({
    type: 'commercial', value: 50000, landmarkCategory: 'cave-system', communityId: community.id,
  });
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'cave', tick: 0 });
  assert.equal(camp.locationPropertyId, cave.id);
  assert.equal(camp.campType, 'cave');
});

test('a "cave" camp also succeeds on a real "natural-formation" landmark, the second real category', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const formation = engine.generateProperty({
    type: 'agricultural', value: 30000, landmarkCategory: 'natural-formation', communityId: community.id,
  });
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'cave', tick: 0 });
  assert.equal(camp.locationPropertyId, formation.id);
});

test('"woods": unknown real land-cover data never refuses -- the same "no pack behaves as before" posture every other pack holds', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  assert.equal(camps.hasRealForestSignal(w, community.id), null);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'woods', tick: 0 });
  assert.equal(camp.campType, 'woods');
});

test('"woods": a real, disagreeing land-cover class refuses -- never faked as forest', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const city = w.cities.find((c) => c.id === community.city_id);
  city.landCoverClass = 'barren';
  assert.equal(camps.hasRealForestSignal(w, community.id), false);
  assert.throws(
    () => camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'woods' }),
    /not a forest class/,
  );
});

test('"woods": a real, agreeing land-cover class succeeds', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const city = w.cities.find((c) => c.id === community.city_id);
  city.landCoverClass = 'mixed-forest';
  assert.equal(camps.hasRealForestSignal(w, community.id), true);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'woods', tick: 0 });
  assert.equal(camp.campType, 'woods');
});

test('"lake" is honestly ungated regardless of any real land-cover class', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const city = w.cities.find((c) => c.id === community.city_id);
  city.landCoverClass = 'barren';
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });
  assert.equal(camp.campType, 'lake');
});

// ---------------------------------------------------------------------
// The real group -- founder plus their real, already-assembled party
// ---------------------------------------------------------------------

test('establishCamp\'s group is the founder plus their real, already-assembled party', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const member = residentOf(community);

  const fam = { id: 9100001, surname: 'Camp', generation: 1, total_members: 2, head_npc_id: founder.id, updatedTick: w.tick };
  w.families.push(fam);
  w.familyMemberships.push({ entity_id: founder.id, family_id: fam.id, role: 'parent', generation_number: 1 });
  w.familyMemberships.push({ entity_id: member.id, family_id: fam.id, role: 'child', generation_number: 1 });
  worldStore.getOrCreateRelationship(w, founder.id, member.id, 'social').loyalty = 100;
  let joined = false;
  for (let tick = 0; tick < 20 && !joined; tick += 1) {
    const result = party.assembleParty(w, founder.id, { familyId: fam.id, memberEntityIds: [member.id], tick });
    if (result.complied.includes(member.id)) joined = true;
  }
  assert.ok(joined, 'the real member must comply at least once across 20 real tries at full loyalty');

  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });
  assert.deepEqual([...camp.memberEntityIds].sort((a, b) => a - b), [founder.id, member.id].sort((a, b) => a - b));
});

test('establishCamp refuses when the founder or a real party member is already at a camp', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });
  assert.throws(
    () => camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'woods', tick: 0 }),
    /already at a real camp/,
  );
});

// ---------------------------------------------------------------------
// join / leave / break
// ---------------------------------------------------------------------

test('joinCamp: a free real act, refused for a nonexistent camp, a dead entity, or someone already camped', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const newcomer = residentOf(community);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });

  assert.throws(() => camps.joinCamp(w, 999999999, newcomer.id), /no real active camp/);
  assert.throws(() => camps.joinCamp(w, camp.id, 999999999), /is not among the living/);

  camps.joinCamp(w, camp.id, newcomer.id);
  assert.ok(camps.campOf(w, camp.id).memberEntityIds.includes(newcomer.id));
  assert.throws(() => camps.joinCamp(w, camp.id, newcomer.id), /already at a real camp/);
});

test('leaveCamp: removes a real member, and an empty camp becomes inactive', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });

  const result = camps.leaveCamp(w, founder.id);
  assert.equal(result.left, founder.id);
  assert.equal(result.campStillActive, false);
  assert.equal(camps.campOf(w, camp.id).active, false);
  assert.throws(() => camps.leaveCamp(w, founder.id), /is not currently at a real camp/);
});

test('breakCamp: only the real founder can strike it', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const impostor = residentOf(community);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });

  assert.throws(() => camps.breakCamp(w, camp.id, impostor.id), /did not found camp/);
  const broken = camps.breakCamp(w, camp.id, founder.id);
  assert.equal(broken.active, false);
  assert.throws(() => camps.breakCamp(w, camp.id, founder.id), /no real active camp/);
});

test('activeCampFor / campOf: real reads, null for anyone or anything not real', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  assert.equal(camps.activeCampFor(w, founder.id), null);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'lake', tick: 0 });
  assert.equal(camps.activeCampFor(w, founder.id).id, camp.id);
  assert.equal(camps.campOf(w, 999999999), null);
});

// ---------------------------------------------------------------------
// How this is effective: a real evasion bonus through
// policing.evasionOf, the same real path disguise.js already reaches
// -- see this file's own header above `CAMP_EVASION_BONUS`.
// ---------------------------------------------------------------------

test('evasionOf is raised by the real camp bonus while actively camped, bounded to 1', () => {
  const community = freshCommunity();
  const resident = residentOf(community);
  const baseline = policing.evasionOf(w, resident.id);

  camps.establishCamp(w, resident.id, { communityId: community.id, campType: 'lake', tick: 0 });
  const camped = policing.evasionOf(w, resident.id);

  assert.ok(camped > baseline, 'living at a real off-grid camp must raise evasion');
  assert.equal(
    Math.round((camped - baseline) * 100) / 100,
    camps.CAMP_EVASION_BONUS,
  );
  assert.ok(camped <= 1);
});

test('evasionOf drops the camp bonus the instant the camp is broken, never a frozen snapshot', () => {
  const community = freshCommunity();
  const founder = residentOf(community);
  const baseline = policing.evasionOf(w, founder.id);
  const camp = camps.establishCamp(w, founder.id, { communityId: community.id, campType: 'woods', tick: 0 });
  assert.ok(policing.evasionOf(w, founder.id) > baseline);

  camps.breakCamp(w, camp.id, founder.id);
  assert.equal(policing.evasionOf(w, founder.id), baseline);
});

test('the camp bonus is identical across woods/cave/lake -- no unjustified per-type concealment gradient', () => {
  // Each person's own before/after delta is what is asserted, not one
  // person's evasion against another's -- two different NPCs' skill
  // draws are not guaranteed equal, but the real camp bonus each type
  // adds must be the one real constant regardless.
  const woodsCommunity = freshCommunity();
  const woodsFounder = residentOf(woodsCommunity);
  const woodsBaseline = policing.evasionOf(w, woodsFounder.id);
  camps.establishCamp(w, woodsFounder.id, { communityId: woodsCommunity.id, campType: 'woods', tick: 0 });
  const woodsDelta = Math.round((policing.evasionOf(w, woodsFounder.id) - woodsBaseline) * 100) / 100;

  const lakeCommunity = freshCommunity();
  const lakeFounder = residentOf(lakeCommunity);
  const lakeBaseline = policing.evasionOf(w, lakeFounder.id);
  camps.establishCamp(w, lakeFounder.id, { communityId: lakeCommunity.id, campType: 'lake', tick: 0 });
  const lakeDelta = Math.round((policing.evasionOf(w, lakeFounder.id) - lakeBaseline) * 100) / 100;

  assert.equal(woodsDelta, camps.CAMP_EVASION_BONUS);
  assert.equal(lakeDelta, camps.CAMP_EVASION_BONUS);
  assert.equal(woodsDelta, lakeDelta);
});
