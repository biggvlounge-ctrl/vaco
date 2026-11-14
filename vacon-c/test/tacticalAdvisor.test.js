// server/tacticalAdvisor.js — a real, trait-weighted split
// recommendation over a leader's own real party. See that file's own
// header for the full design: three real, bounded approach types,
// each person assigned to whichever they measure best at, applying it
// reuses the real party.assignPartyRole/leadership.assignRole chain
// rather than a second compliance system.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const tacticalAdvisor = require('../server/tacticalAdvisor.js');
const party = require('../server/party.js');
const membership = require('../server/membership.js');
const worldStore = require('../server/worldStore.js');

const w = engine.WorldState;

let nextId = 990001;

function person(traitValueFor) {
  return engine.generateNPC({ traitValueFor });
}

function flatTraits(value) {
  return () => value;
}

function organization(leaderId, type = 'business') {
  return engine.generateOrganization({ name: `Org ${nextId += 1}`, type, leaderId });
}

function joinedParty(leader, org, members) {
  for (const m of members) {
    membership.joinOrganization(w, { entityId: m.id, organizationId: org.id });
    worldStore.getOrCreateRelationship(w, leader.id, m.id, 'social').loyalty = 100;
  }
  let allJoined = false;
  for (let tick = 0; tick < 30 && !allJoined; tick += 1) {
    const result = party.assembleParty(w, leader.id, {
      organizationId: org.id, memberEntityIds: members.map((m) => m.id), tick,
    });
    allJoined = result.refused.length === 0 && result.unavailable.length === 0;
  }
  return allJoined;
}

test('approachAptitudeOf: a real, weighted composite over three distinct approach types', () => {
  const sneak = person((def) => {
    if (def.family === 'criminal' && def.name === 'Stealth') return 90;
    if (def.family === 'combat' && def.name === 'Tactical Awareness') return 80;
    return 50;
  });
  const result = tacticalAdvisor.approachAptitudeOf(w, sneak.id);
  assert.equal(result.stealth_entry, 0.6 * 90 + 0.4 * 80);
  assert.ok(result.stealth_entry > result.forced_entry);
  assert.ok(result.stealth_entry > result.social_entry);
});

test('recommendSplit: throws for a leader with no real escorts when the leader themselves is excluded', () => {
  const leader = person(flatTraits(50));
  assert.throws(
    () => tacticalAdvisor.recommendSplit(w, leader.id, { includeLeader: false }),
    /has no real party to split/,
  );
});

test('recommendSplit: each real person is assigned to whichever real approach type they measure best at', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const sneaky = person((def) => (
    (def.family === 'criminal' && def.name === 'Stealth')
    || (def.family === 'combat' && def.name === 'Tactical Awareness') ? 95 : 10
  ));
  const brawler = person((def) => (
    (def.family === 'combat' && (def.name === 'Melee Skill' || def.name === 'Weapon Mastery')) ? 95 : 10
  ));
  const talker = person((def) => (
    (def.family === 'criminal' && def.name === 'Deception')
    || (def.family === 'social' && def.name === 'Persuasion') ? 95 : 10
  ));
  assert.ok(joinedParty(leader, org, [sneaky, brawler, talker]));

  const result = tacticalAdvisor.recommendSplit(w, leader.id, { includeLeader: false });
  assert.deepEqual(result.groups.stealth_entry, [sneaky.id]);
  assert.deepEqual(result.groups.forced_entry, [brawler.id]);
  assert.deepEqual(result.groups.social_entry, [talker.id]);
});

test('recommendSplit: a tie is broken toward whichever group currently has the fewest members', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const twin1 = person(flatTraits(50));
  const twin2 = person(flatTraits(50));
  assert.ok(joinedParty(leader, org, [twin1, twin2]));

  const result = tacticalAdvisor.recommendSplit(w, leader.id, { includeLeader: false });
  const assigned = APPROACH_TYPES_FOR_TEST(result);
  assert.equal(assigned.length, 2, 'both real members are placed exactly once');
  const counts = Object.values(result.groups).map((g) => g.length);
  assert.ok(Math.max(...counts) <= 1, 'tied members do not pile into the same group');
});

function APPROACH_TYPES_FOR_TEST(result) {
  return Object.values(result.groups).flat();
}

test('recommendSplit: physicalApproachSlots reads a real target property\'s own real floors, and is null with no target', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const member = person(flatTraits(50));
  assert.ok(joinedParty(leader, org, [member]));

  const noTarget = tacticalAdvisor.recommendSplit(w, leader.id);
  assert.equal(noTarget.physicalApproachSlots, null);

  const target = engine.generateProperty({ type: 'commercial', value: 500000, floors: 6 });
  const withTarget = tacticalAdvisor.recommendSplit(w, leader.id, { targetPropertyId: target.id });
  assert.equal(withTarget.physicalApproachSlots, 2, 'clamped, never an unbounded real floor count');
});

test('applyRecommendedSplit: reuses the real party.assignPartyRole/leadership.assignRole chain -- an unescorted outsider is refused the identical way', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const member = person(flatTraits(50));
  assert.ok(joinedParty(leader, org, [member]));

  const recommendation = tacticalAdvisor.recommendSplit(w, leader.id, { includeLeader: false });
  const results = tacticalAdvisor.applyRecommendedSplit(w, leader.id, recommendation, 0);
  assert.equal(results[member.id].complied, true);
  const row = membership.findMembership(w, member.id, org.id);
  assert.ok(tacticalAdvisor.APPROACH_TYPES.includes(row.role_in_org));

  const outsider = person(flatTraits(50));
  const bogusRecommendation = { groups: { stealth_entry: [outsider.id], forced_entry: [], social_entry: [] } };
  assert.throws(
    () => tacticalAdvisor.applyRecommendedSplit(w, leader.id, bogusRecommendation, 0),
    /is not currently escorting/,
  );
});

test('applyRecommendedSplit: a gang\'s real, trait-computed role_in_org is never overwritten by a tactical assignment -- the pre-existing assignRole refusal is preserved, not papered over', () => {
  const leader = person(flatTraits(50));
  const gang = organization(leader.id, 'gang');
  const member = person(flatTraits(50));
  assert.ok(joinedParty(leader, gang, [member]));

  const recommendation = tacticalAdvisor.recommendSplit(w, leader.id, { includeLeader: false });
  assert.throws(
    () => tacticalAdvisor.applyRecommendedSplit(w, leader.id, recommendation, 0),
    /is a gang\/faction/,
  );
});
