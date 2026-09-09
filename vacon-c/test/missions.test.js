// VACANCY — the mission state machine.
//
// **The engine's first player verb.** Until 29 Aug 2026 a mission was
// created with `status: 'available'` and nothing could change it: no
// accept, no completion, no assignee, no route. `listMissions()`
// filtered by status and no code path ever moved one off `available`.
// The quest record existed; the quest loop did not.
//
// Everything else in VACON-C is a world that runs whether or not anyone
// is watching. This is the first thing a person DOES that the world
// reflects back — and because completion pays, the rules about who can
// resolve what are money rules, not flavour.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');

function setup({ reward = 250, savings = 100 } = {}) {
  const npc = engine.generateNPC();
  engine.generateIndividualFinances(npc.id, { savings });
  const artifact = engine.generateArtifact({ name: `Relic ${npc.id}` });
  const mission = engine.generateMission({
    artifactId: artifact.id, objective: 'Recover it', reward,
  });
  return { npc, artifact, mission };
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

test('a mission is created unassigned and unresolved', () => {
  const { mission } = setup();
  assert.equal(mission.status, 'available');
  assert.equal(mission.assigned_entity_id, null);
  assert.equal(mission.tick_accepted, null);
  assert.equal(mission.tick_resolved, null);
});

test('accepting records who took it and when', () => {
  const { npc, mission } = setup();
  engine.acceptMission(mission.id, npc.id);

  assert.equal(mission.status, 'accepted');
  assert.equal(mission.assigned_entity_id, npc.id);
  assert.equal(mission.tick_accepted, engine.WorldState.tick);
});

test('completing a mission pays the reward into the holder\'s finances', () => {
  // The whole point of the verb: a person acts, and the world's record
  // of them changes.
  const { npc, mission } = setup({ reward: 250, savings: 100 });
  const before = engine.getNetWorth(npc.id);

  engine.acceptMission(mission.id, npc.id);
  const { paid } = engine.resolveMission(mission.id, {
    outcome: 'completed', entityId: npc.id, note: 'found in the mill',
  });

  assert.equal(mission.status, 'completed');
  assert.equal(mission.outcome_note, 'found in the mill');
  assert.equal(paid.amount, 250);
  assert.equal(engine.getNetWorth(npc.id), before + 250);
});

test('the payment is a new finances row, not an overwrite of the last one', () => {
  // individual_finances is keyed (entity_id, tick) and a person's
  // financial history is worth keeping — the same append-only reasoning
  // ownership records follow.
  const { npc, mission } = setup();
  const rowsBefore = engine.WorldState.individualFinances
    .filter((r) => r.entity_id === npc.id).length;

  engine.acceptMission(mission.id, npc.id);
  engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id });

  const rowsAfter = engine.WorldState.individualFinances
    .filter((r) => r.entity_id === npc.id).length;
  assert.equal(rowsAfter, rowsBefore + 1);
});

// ---------------------------------------------------------------------------
// Money rules
// ---------------------------------------------------------------------------

test('a completed mission cannot be completed twice', () => {
  // Completion pays, so a re-completable mission is an infinite money
  // printer. This is the single most important assertion in the file.
  const { npc, mission } = setup({ reward: 500 });
  engine.acceptMission(mission.id, npc.id);
  engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id });

  const afterFirst = engine.getNetWorth(npc.id);
  assert.throws(
    () => engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id }),
    /is "completed"/,
  );
  assert.equal(engine.getNetWorth(npc.id), afterFirst, 'and nothing was paid on the attempt');
});

test('only the holder can resolve a mission', () => {
  const { npc, mission } = setup({ reward: 400 });
  const stranger = engine.generateNPC();
  engine.generateIndividualFinances(stranger.id, { savings: 0 });

  engine.acceptMission(mission.id, npc.id);
  assert.throws(
    () => engine.resolveMission(mission.id, { outcome: 'completed', entityId: stranger.id }),
    /is held by/,
  );
  assert.equal(engine.getNetWorth(stranger.id), 0, 'and the stranger was not paid');
  assert.equal(mission.status, 'accepted', 'the mission is untouched');
});

test('failing and abandoning pay nothing — which is why they are distinct outcomes', () => {
  for (const outcome of ['failed', 'abandoned']) {
    const { npc, mission } = setup({ reward: 900, savings: 50 });
    engine.acceptMission(mission.id, npc.id);
    const before = engine.getNetWorth(npc.id);

    const { paid } = engine.resolveMission(mission.id, { outcome, entityId: npc.id });

    assert.equal(mission.status, outcome);
    assert.equal(paid, null);
    assert.equal(engine.getNetWorth(npc.id), before, `${outcome} must not pay`);
  }
});

test('a mission with no reward completes cleanly and pays nothing', () => {
  const { npc, mission } = setup({ reward: null });
  engine.acceptMission(mission.id, npc.id);
  const { paid } = engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id });
  assert.equal(mission.status, 'completed');
  assert.equal(paid, null);
});

// ---------------------------------------------------------------------------
// Illegal transitions
// ---------------------------------------------------------------------------

test('an available mission cannot be resolved without being accepted', () => {
  const { npc, mission } = setup();
  assert.throws(
    () => engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id }),
    /only an accepted mission/,
  );
});

test('a mission already held cannot be taken by somebody else', () => {
  const { npc, mission } = setup();
  const other = engine.generateNPC();
  engine.acceptMission(mission.id, npc.id);

  assert.throws(() => engine.acceptMission(mission.id, other.id), /not available/);
  assert.equal(mission.assigned_entity_id, npc.id);
});

test('a terminal mission stays terminal', () => {
  const { npc, mission } = setup();
  engine.acceptMission(mission.id, npc.id);
  engine.resolveMission(mission.id, { outcome: 'abandoned', entityId: npc.id });

  assert.throws(() => engine.acceptMission(mission.id, npc.id), /not available/);
  assert.throws(
    () => engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id }),
    /only an accepted mission/,
  );
});

test('an outcome outside the three is refused', () => {
  const { npc, mission } = setup();
  engine.acceptMission(mission.id, npc.id);
  assert.throws(
    () => engine.resolveMission(mission.id, { outcome: 'sort of done', entityId: npc.id }),
    /is not an outcome/,
  );
  assert.equal(mission.status, 'accepted');
});

test('a mission must be taken by a real NPC', () => {
  const { mission } = setup();
  assert.throws(() => engine.acceptMission(mission.id, 999999), /not a real NPC/);
  assert.throws(() => engine.acceptMission(mission.id, null), /requires an entityId/);
});

test('a mission that does not exist is refused rather than created', () => {
  assert.throws(() => engine.acceptMission(999999, 1), /no mission with id/);
});

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

test('missions are filterable by every state they can be in', () => {
  const { npc, mission } = setup();
  assert.ok(engine.listMissions({ status: 'available' }).some((m) => m.id === mission.id));

  engine.acceptMission(mission.id, npc.id);
  assert.ok(engine.listMissions({ status: 'accepted' }).some((m) => m.id === mission.id));
  assert.ok(!engine.listMissions({ status: 'available' }).some((m) => m.id === mission.id));

  engine.resolveMission(mission.id, { outcome: 'completed', entityId: npc.id });
  assert.ok(engine.listMissions({ status: 'completed' }).some((m) => m.id === mission.id));
});

test('the five statuses are exactly the ones the schema comment names', () => {
  assert.deepEqual(engine.MISSION_STATUSES,
    ['available', 'accepted', 'completed', 'failed', 'abandoned']);
});
