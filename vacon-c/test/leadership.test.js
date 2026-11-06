// VACANCY — Leader mode, reopened by explicit instruction. See
// server/leadership.js's own header for the full design: one embodied
// avatar throughout (linked_entity_id stays an NPC, never becomes an
// organization), "leader" and "influencer" are both just
// `organizations.leader_id` on different org types, directing someone
// is a real probability draw against their own loyalty rather than a
// guaranteed command, and a directed mission is the same real mission
// state machine missions.js already has, never a second one.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const economy = require('../server/economy.js');
const missions = require('../server/missions.js');
const membership = require('../server/membership.js');
const worldStore = require('../server/worldStore.js');
const players = require('../server/players.js');
const leadership = require('../server/leadership.js');
const influence = require('../server/influence.js');

let nextId = 900000;

function world({ tick = 36500 } = {}) {
  const worldState = {
    tick,
    seed: 'leadership-test',
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    communities: [],
    cities: [],
    entityTraits: [],
    entityState: [],
    habits: [],
    scheduleEvents: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    individualFinances: [],
    employmentRecords: [],
    crimeIncidents: [],
    inventory: [],
    properties: [],
    ownershipRecords: [],
    resources: [],
    marketListings: [],
    artifacts: [],
    missions: [],
    players: [],
    events: [],
    entityKnowledge: [],
    nextEntityId: 1,
  };
  economy.reseedIds(worldState);
  missions.reseedIds(worldState);
  return worldState;
}

function person(worldState) {
  const npc = {
    id: nextId++, status: 'active', communityId: null, home_property_id: null,
    createdTick: worldState.tick - 365 * 30, updatedTick: worldState.tick,
    generation: 1, role: null, traits: {},
  };
  worldState.npcs.push(npc);
  return npc;
}

function organization(worldState, { type = 'government', leaderId = null, influence = 50 } = {}) {
  const org = {
    id: nextId++, name: `Org ${nextId}`, type, founder_id: leaderId, leader_id: leaderId,
    members: 0, assets: 0, income: 0, expenses: 0, influence, security: 50, innovation: 50,
    reputation: 50,
  };
  worldState.organizations.push(org);
  return org;
}

function join(worldState, entityId, organizationId, role = null) {
  return membership.joinOrganization(worldState, { entityId, organizationId, role });
}

function artifact(worldState, name) {
  return missions.generateArtifact(worldState, { name });
}

// -- isLeaderOf / organizationsLedBy -------------------------------------

test('isLeaderOf reads the real organizations.leader_id column, nothing else', () => {
  const w = world();
  const leader = person(w);
  const other = person(w);
  const org = organization(w, { leaderId: leader.id });

  assert.equal(leadership.isLeaderOf(w, leader.id, org.id), true);
  assert.equal(leadership.isLeaderOf(w, other.id, org.id), false);
  assert.deepStrictEqual(leadership.organizationsLedBy(w, leader.id).map((o) => o.id), [org.id]);
  assert.deepStrictEqual(leadership.organizationsLedBy(w, other.id), []);
});

// -- promoteToLeader -------------------------------------------------------

test('promoteToLeader is granted only to a citizen who already, really holds a seat', () => {
  const w = world();
  const commoner = person(w);
  const player = players.generatePlayer(w, { linkedEntityId: commoner.id });

  assert.throws(
    () => leadership.promoteToLeader(w, player.id),
    /does not lead any real organization/,
  );

  const general = person(w);
  const militaryPlayer = players.generatePlayer(w, { linkedEntityId: general.id });
  organization(w, { type: 'military', leaderId: general.id });

  const promoted = leadership.promoteToLeader(w, militaryPlayer.id);
  assert.equal(promoted.mode, 'leader');

  // Idempotent -- promoting an already-promoted leader is a no-op, not
  // an error.
  assert.equal(leadership.promoteToLeader(w, militaryPlayer.id).mode, 'leader');
});

test('promoteToLeader never trusts a caller-supplied claim -- it is the real column or nothing', () => {
  const w = world();
  const npc = person(w);
  const player = players.generatePlayer(w, { linkedEntityId: npc.id });
  // No organization anywhere names this NPC as leader_id.
  assert.throws(() => leadership.promoteToLeader(w, player.id), /does not lead any real organization/);
});

// -- getLeaderDashboard -----------------------------------------------------

test('getLeaderDashboard refuses a citizen-mode player', () => {
  const w = world();
  const npc = person(w);
  const player = players.generatePlayer(w, { linkedEntityId: npc.id });
  assert.throws(() => leadership.getLeaderDashboard(w, player.id), /not 'leader'/);
});

test('getLeaderDashboard re-verifies leadership live rather than trusting a stale player.mode', () => {
  const w = world();
  const leaderNpc = person(w);
  const player = players.generatePlayer(w, { linkedEntityId: leaderNpc.id, mode: 'leader' });
  // player.mode says 'leader' but no real organization backs it --
  // exactly what an ousted or succeeded leader looks like the moment
  // nothing demotes them automatically (leadership.js's own stated
  // limitation).
  assert.throws(
    () => leadership.getLeaderDashboard(w, player.id),
    /no longer leads any organization/,
  );
});

test('getLeaderDashboard reports real members, their real loyalty, and directed missions -- never fabricated', () => {
  const w = world();
  const leaderNpc = person(w);
  const soldier = person(w);
  const civilian = person(w); // same world, not a member -- must not appear
  const org = organization(w, { type: 'military', leaderId: leaderNpc.id, influence: 70 });
  join(w, soldier.id, org.id, 'soldier');
  worldStore.adjustRelationship(w, leaderNpc.id, soldier.id, 'social', { trust: 0 });
  worldStore.getOrCreateRelationship(w, leaderNpc.id, soldier.id, 'social').loyalty = 72;

  const player = players.generatePlayer(w, { linkedEntityId: leaderNpc.id, mode: 'leader' });
  const dashboard = leadership.getLeaderDashboard(w, player.id);

  assert.equal(dashboard.organizations.length, 1);
  const [orgView] = dashboard.organizations;
  assert.equal(orgView.id, org.id);
  assert.equal(orgView.type, 'military');
  assert.equal(orgView.canBroadcast, false);
  assert.equal(orgView.members.length, 1, 'only real members appear -- never the whole world');
  assert.equal(orgView.members[0].id, soldier.id);
  assert.equal(orgView.members[0].roleInOrg, 'soldier');
  assert.equal(orgView.members[0].loyalty, 72);
  assert.ok(!orgView.members.some((m) => m.id === civilian.id));
});

test('getLeaderDashboard surfaces the leader\'s own real influenceRating and extendedFamily, read live, same as getCitizenDashboard', () => {
  const w = world();
  const leaderNpc = person(w);
  organization(w, { type: 'business', leaderId: leaderNpc.id, influence: 40 });
  const player = players.generatePlayer(w, { linkedEntityId: leaderNpc.id, mode: 'leader' });

  const dashboard = leadership.getLeaderDashboard(w, player.id);

  assert.equal(dashboard.influenceRating, influence.influenceRatingOf(w, leaderNpc.id));
  assert.deepEqual(dashboard.extendedFamily, { entityId: leaderNpc.id, family: null, parents: [], siblings: [], cousins: [] });
});

// -- directMission ----------------------------------------------------------

test('directMission refuses an entity who does not actually lead the named organization', () => {
  const w = world();
  const impostor = person(w);
  const realLeader = person(w);
  const subordinate = person(w);
  const org = organization(w, { leaderId: realLeader.id });
  join(w, subordinate.id, org.id);

  assert.throws(
    () => leadership.directMission(w, impostor.id, {
      organizationId: org.id, subordinateEntityId: subordinate.id, locationId: null, artifactId: artifact(w, 'Relic').id,
    }),
    /does not lead organization/,
  );
});

test('directMission refuses to direct someone who is not actually a member', () => {
  const w = world();
  const leader = person(w);
  const stranger = person(w);
  const org = organization(w, { leaderId: leader.id });
  const relic = artifact(w, 'Relic');

  assert.throws(
    () => leadership.directMission(w, leader.id, {
      organizationId: org.id, subordinateEntityId: stranger.id, artifactId: relic.id,
    }),
    /is not a member of organization/,
  );
});

test('directMission refuses a leader directing themselves', () => {
  const w = world();
  const leader = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, leader.id, org.id);
  const relic = artifact(w, 'Relic');

  assert.throws(
    () => leadership.directMission(w, leader.id, {
      organizationId: org.id, subordinateEntityId: leader.id, artifactId: relic.id,
    }),
    /cannot direct themselves/,
  );
});

test('directMission still requires a mission to be about a real thing or place -- missions.js\'s own rule, not bypassed', () => {
  const w = world();
  const leader = person(w);
  const subordinate = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, subordinate.id, org.id);
  // Pinned to full loyalty so compliance is guaranteed and this test is
  // actually about the artifact/location rule, not a coin toss on top of it.
  worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social').loyalty = 100;

  assert.throws(
    () => leadership.directMission(w, leader.id, {
      organizationId: org.id, subordinateEntityId: subordinate.id,
    }),
    /requires an artifactId or a locationId/,
  );
});

test('a subordinate with full loyalty always complies, and a subordinate with zero loyalty never does -- the two deterministic ends of the same real draw', () => {
  const w = world();
  const leader = person(w);
  const loyalSoldier = person(w);
  const disloyalSoldier = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, loyalSoldier.id, org.id);
  join(w, disloyalSoldier.id, org.id);
  worldStore.getOrCreateRelationship(w, leader.id, loyalSoldier.id, 'social').loyalty = 100;
  worldStore.getOrCreateRelationship(w, leader.id, disloyalSoldier.id, 'social').loyalty = 0;

  for (let tick = 0; tick < 25; tick += 1) {
    const relic = artifact(w, `Relic ${tick}`);
    const loyalResult = leadership.directMission(w, leader.id, {
      organizationId: org.id, subordinateEntityId: loyalSoldier.id, artifactId: relic.id, tick,
    });
    assert.equal(loyalResult.complied, true, `tick ${tick}: full loyalty must always comply`);
    assert.equal(loyalResult.mission.status, 'accepted');
    assert.equal(loyalResult.mission.assigned_entity_id, loyalSoldier.id);
    assert.equal(loyalResult.mission.issued_by_entity_id, leader.id);
    assert.equal(loyalResult.mission.issuing_organization_id, org.id);

    const relic2 = artifact(w, `Relic2 ${tick}`);
    const disloyalResult = leadership.directMission(w, leader.id, {
      organizationId: org.id, subordinateEntityId: disloyalSoldier.id, artifactId: relic2.id, tick,
    });
    assert.equal(disloyalResult.complied, false, `tick ${tick}: zero loyalty must never comply`);
    assert.equal(disloyalResult.mission, null, 'a refused order creates no mission at all');
  }
});

test('compliance at middling loyalty is a real distribution, not a coin either leader can call', () => {
  const w = world();
  const leader = person(w);
  const subordinate = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, subordinate.id, org.id);
  worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social').loyalty = 50;

  let complied = 0;
  const trials = 300;
  for (let tick = 0; tick < trials; tick += 1) {
    const relic = artifact(w, `Relic ${tick}`);
    const result = leadership.directMission(w, leader.id, {
      organizationId: org.id, subordinateEntityId: subordinate.id, artifactId: relic.id, tick,
    });
    if (result.complied) complied += 1;
  }
  const rate = complied / trials;
  assert.ok(rate > 0.35 && rate < 0.65, `50 loyalty should comply roughly half the time, got ${rate}`);
});

test('a directed mission is the real mission state machine -- it can be resolved and paid exactly like any other', () => {
  const w = world();
  const leader = person(w);
  const subordinate = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, subordinate.id, org.id);
  worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social').loyalty = 100;
  const relic = artifact(w, 'Relic');

  const { mission } = leadership.directMission(w, leader.id, {
    organizationId: org.id, subordinateEntityId: subordinate.id, artifactId: relic.id, reward: 500,
  });

  let paidTo = null;
  let paidAmount = null;
  const { paid } = missions.resolveMission(w, mission.id, {
    outcome: 'completed',
    entityId: subordinate.id,
    payReward: (entityId, amount) => { paidTo = entityId; paidAmount = amount; return true; },
  });

  assert.equal(mission.status, 'completed');
  assert.equal(paidTo, subordinate.id);
  assert.equal(paidAmount, 500);
  assert.equal(paid, true);
});

// -- broadcastMessage ---------------------------------------------------

test('broadcastMessage refuses an entity who does not lead the named organization', () => {
  const w = world();
  const impostor = person(w);
  const realLeader = person(w);
  const org = organization(w, { type: 'media', leaderId: realLeader.id });

  assert.throws(
    () => leadership.broadcastMessage(w, impostor.id, { organizationId: org.id, factContent: 'breaking news' }),
    /does not lead organization/,
  );
});

test('broadcastMessage refuses a leader whose organization is not actually media', () => {
  const w = world();
  const leader = person(w);
  const org = organization(w, { type: 'government', leaderId: leader.id });

  assert.throws(
    () => leadership.broadcastMessage(w, leader.id, { organizationId: org.id, factContent: 'state of the union' }),
    /not "media"/,
  );
});

// -- directMission, the organization-free path (influence.js) ------------

test('directMission with no organizationId needs no membership at all -- compliance gates on real influence instead', () => {
  const w = world();
  const bigShot = person(w);
  const stranger = person(w); // no shared organization, never met
  worldStore.getOrCreateRelationship(w, bigShot.id, stranger.id, 'social').influence = 100;
  const relic = artifact(w, 'Loose Relic');

  const result = leadership.directMission(w, bigShot.id, {
    subordinateEntityId: stranger.id, artifactId: relic.id,
  });
  assert.equal(result.basis, 'influence');
  assert.equal(result.gatingValue, 100);
  assert.equal(result.complied, true);
  assert.equal(result.mission.issuing_organization_id, null, 'no organization was involved');
});

test('directMission with no organizationId and no prior relationship gates on the real influenceRatingOf baseline, not an invented default', () => {
  const w = world();
  const nobody = person(w);
  const stranger = person(w);
  const relic = artifact(w, 'Fresh Relic');

  const expectedRating = influence.influenceRatingOf(w, nobody.id);
  const result = leadership.directMission(w, nobody.id, {
    subordinateEntityId: stranger.id, artifactId: relic.id,
  });
  assert.equal(result.basis, 'influence');
  assert.equal(result.gatingValue, expectedRating);
});

test('directMission zero-influence stranger never complies on the organization-free path, same deterministic shape as zero loyalty', () => {
  const w = world();
  const nobody = person(w);
  const stranger = person(w);
  worldStore.getOrCreateRelationship(w, nobody.id, stranger.id, 'social').influence = 0;

  for (let tick = 0; tick < 10; tick += 1) {
    const relic = artifact(w, `Relic ${tick}`);
    const result = leadership.directMission(w, nobody.id, {
      subordinateEntityId: stranger.id, artifactId: relic.id, tick,
    });
    assert.equal(result.complied, false);
    assert.equal(result.mission, null);
  }
});

test('a compliance (either path) really raises influence between leader and subordinate -- directing is itself an event now', () => {
  const w = world();
  const leader = person(w);
  const subordinate = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, subordinate.id, org.id);
  worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social').loyalty = 100;
  const before = worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social').influence;

  const relic = artifact(w, 'Relic');
  leadership.directMission(w, leader.id, {
    organizationId: org.id, subordinateEntityId: subordinate.id, artifactId: relic.id,
  });

  const after = worldStore.findRelationship(w, leader.id, subordinate.id).influence;
  assert.ok(after > before, `compliance must raise real influence: ${before} -> ${after}`);
});

test('a REFUSED order really lowers the leader\'s influence over that subordinate -- being refused costs real sway', () => {
  const w = world();
  const leader = person(w);
  const subordinate = person(w);
  const org = organization(w, { leaderId: leader.id });
  join(w, subordinate.id, org.id);
  worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social').loyalty = 0;
  const rel = worldStore.getOrCreateRelationship(w, leader.id, subordinate.id, 'social');
  rel.influence = 50; // a real, pre-existing value, so the drop is unambiguous

  const relic = artifact(w, 'Relic');
  const result = leadership.directMission(w, leader.id, {
    organizationId: org.id, subordinateEntityId: subordinate.id, artifactId: relic.id,
  });

  assert.equal(result.complied, false);
  assert.ok(rel.influence < 50, `a refusal must really lower influence, got ${rel.influence}`);
});

test('a refusal on the organization-free path also lowers real influence, the identical shape as the org path', () => {
  const w = world();
  const nobody = person(w);
  const stranger = person(w);
  const rel = worldStore.getOrCreateRelationship(w, nobody.id, stranger.id, 'social');
  rel.influence = 50;

  const relic = artifact(w, 'Relic');
  const result = leadership.directMission(w, nobody.id, {
    subordinateEntityId: stranger.id, artifactId: relic.id,
  });

  assert.equal(result.complied, false);
  assert.ok(rel.influence < 50);
});

test('broadcastMessage puts a real, attributed fact through the real media.broadcast pipeline', () => {
  const w = world();
  const leader = person(w);
  const listener = person(w);
  organization(w, { type: 'media', leaderId: leader.id, influence: 100 });
  const org = w.organizations[w.organizations.length - 1];

  const written = leadership.broadcastMessage(w, leader.id, {
    organizationId: org.id,
    factContent: 'the harvest failed',
    channel: 'word_of_mouth',
  });

  assert.ok(Array.isArray(written));
  assert.ok(written.length > 0, 'a real audience exists (the leader + listener), so the broadcast must reach somebody');
  for (const row of written) {
    assert.equal(row.source_entity_id, leader.id, 'the broadcast is attributed to the real leader, not anonymous');
  }
});
