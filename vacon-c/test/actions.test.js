// VACANCY — the player action dispatcher.
//
// **The player verb.** Everything else in this engine is a world that
// runs on its own and a dashboard that reads it. This is the one place
// a person DOES something and the world reflects it back, which is the
// second half of the locked Definition of Done.
//
// `POST /api/players/:id/action` sat unbuilt with a note in server.js
// saying a "generic action dispatcher" had no specification of what
// actions exist, and that guessing would invent game design rather than
// expose it. That was true when written. It stopped being true when the
// engine grew concrete verbs — accepting and resolving missions,
// adopting a routine, practising a habit, entering a contest — each
// already built and already carrying its own rules.
//
// Two properties matter more than the routing:
//
//   1. **A player acts as themselves.** The actor comes from the player
//      record, never the request body. The mission state machine
//      refuses a mission held by somebody else; a dispatcher that
//      forwarded a caller-supplied entityId would hand that check its
//      own bypass.
//   2. **The dispatcher goes through the bound layer.** Calling the
//      underlying module directly skips wiring the engine supplies —
//      which is not hypothetical: the first version did exactly that
//      and a completed mission paid nothing.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const actions = require('../server/actions.js');
const engine = require('../server/engine.js');

function citizen({ savings = 100 } = {}) {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  engine.generateIndividualFinances(npc.id, {
    income: 0, savings, debt: 0, assets: 0,
  });
  return { npc, player };
}

function missionWorth(reward) {
  const artifact = engine.generateArtifact({ type: 'relic', name: 'Ledger Stone' });
  return engine.generateMission({ artifactId: artifact.id, reward });
}

// ---------------------------------------------------------------------------
// The registry is real
// ---------------------------------------------------------------------------

test('every registered action is well formed', () => {
  assert.doesNotThrow(() => actions.assertActionsAreReal());
  assert.ok(actions.ACTION_NAMES.length >= 5);
});

test('every verb an action names is one the engine actually supplies', () => {
  // The guard on the injection. An action naming a verb the engine does
  // not bind would fail only when somebody tried that one action, and a
  // registry exists precisely so nothing has to enumerate it by hand.
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  // A dispatch with a complete verb set gets as far as validating the
  // action; one with an incomplete set is refused before anything runs.
  assert.throws(
    () => actions.dispatchAction(engine.WorldState, player.id, { action: 'accept-mission' }, {}),
    /verb set missing/,
  );
  assert.throws(
    () => actions.dispatchAction(engine.WorldState, player.id, {}, undefined),
    /verb set missing/,
  );
  assert.deepEqual(
    actions.REQUIRED_VERBS,
    ['acceptMission', 'addScheduleEvent', 'reinforceHabit', 'resolveContest', 'resolveMission'],
  );
});

test('the action list is a real menu, not a list of names', () => {
  // A client that cannot ask what it may do has to hard-code the list,
  // and then the list lives in two places and one of them goes stale.
  const menu = engine.listActions('citizen');
  assert.ok(menu.length >= 5);
  for (const entry of menu) {
    assert.ok(entry.summary, `${entry.action} has no summary`);
    assert.ok(Array.isArray(entry.requires), `${entry.action} does not say what it needs`);
  }
});

test('no action is offered for a mode nobody can enter', () => {
  // CLAUDE.md defers Leader and Simulation modes. Advertising a verb
  // for either would be advertising the mode.
  assert.deepEqual(engine.listActions('leader'), []);
  assert.deepEqual(engine.listActions('simulation'), []);
});

// ---------------------------------------------------------------------------
// A player acts as themselves
// ---------------------------------------------------------------------------

test('a player cannot resolve somebody else\'s mission', () => {
  // The attack the whole design exists to stop: finish another player's
  // mission and collect for it.
  const mine = citizen();
  const theirs = citizen();
  const mission = missionWorth(250);

  engine.dispatchAction(mine.player.id, { action: 'accept-mission', missionId: mission.id });

  assert.throws(
    () => engine.dispatchAction(theirs.player.id, {
      action: 'resolve-mission', missionId: mission.id, outcome: 'completed',
    }),
    /is held by/,
  );
  assert.equal(engine.getNetWorth(theirs.npc.id), 100, 'and nothing was paid for trying');
});

test('naming an actor in the body is refused, not ignored', () => {
  // Silently dropping the field would let a caller believe they had
  // acted as somebody else and had it work. Every field that could name
  // an actor is refused by name, so the error says which one.
  const mine = citizen();
  const theirs = citizen();
  const mission = missionWorth(250);
  engine.dispatchAction(mine.player.id, { action: 'accept-mission', missionId: mission.id });

  for (const field of actions.ACTOR_FIELDS) {
    assert.throws(
      () => engine.dispatchAction(theirs.player.id, {
        action: 'resolve-mission',
        missionId: mission.id,
        outcome: 'completed',
        [field]: mine.npc.id,
      }),
      new RegExp(`acts as themselves.*${field}`, 's'),
      `${field} was not refused`,
    );
  }
  assert.equal(engine.getNetWorth(mine.npc.id), 100, 'the mission was never resolved');
});

test('a contest always includes the player who entered it', () => {
  // Otherwise a player could stage a bout between two other people and
  // have it recorded as their own.
  const mine = citizen();
  const a = engine.generateNPC();
  const result = engine.dispatchAction(mine.player.id, {
    action: 'enter-contest', opponentId: a.id, contestId: 'bout',
  });
  const entered = result.result.ratings.map((r) => r.entityId);
  assert.ok(entered.includes(mine.npc.id), 'the actor must be in their own contest');
  assert.equal(result.actorEntityId, mine.npc.id);
});

test('every dispatch reports which entity actually acted', () => {
  // So a caller can see that the actor was not the one they may have
  // tried to name.
  const mine = citizen();
  const out = engine.dispatchAction(mine.player.id, {
    action: 'adopt-routine', eventType: 'shift', frequency: 'daily',
  });
  assert.equal(out.actorEntityId, mine.npc.id);
  assert.equal(out.playerId, mine.player.id);
  assert.equal(out.action, 'adopt-routine');
  assert.equal(out.tick, engine.WorldState.tick);
});

// ---------------------------------------------------------------------------
// The dispatcher goes through the bound layer
// ---------------------------------------------------------------------------

test('a mission completed through the dispatcher actually pays', () => {
  // **The bug this file was written with.** The first version called
  // `missions.resolveMission` directly. That function takes a
  // `payReward` callback which `engine.js#resolveMission` supplies and
  // the raw module cannot know about — so the state machine ran
  // perfectly, the mission went to `completed`, and the money silently
  // never moved. Nothing about the mission looked wrong.
  const { npc, player } = citizen({ savings: 100 });
  const mission = missionWorth(250);

  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: mission.id });
  const out = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: mission.id, outcome: 'completed',
  });

  assert.equal(out.result.mission.status, 'completed');
  assert.ok(out.result.paid, 'a completed mission with a reward must report a payment');
  assert.equal(out.result.paid.amount, 250);
  assert.equal(engine.getNetWorth(npc.id), 350, 'and the money has to be there afterwards');
});

test('a failed mission through the dispatcher pays nothing', () => {
  // The negative case in the same shape: a test that only ever watches
  // money arrive would pass against a dispatcher that paid every time.
  const { npc, player } = citizen({ savings: 100 });
  const mission = missionWorth(250);
  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: mission.id });
  const out = engine.dispatchAction(player.id, {
    action: 'resolve-mission', missionId: mission.id, outcome: 'failed',
  });
  assert.equal(out.result.paid, null);
  assert.equal(engine.getNetWorth(npc.id), 100);
});

test('a routine adopted through the dispatcher is a real routine', () => {
  const { npc, player } = citizen();
  engine.dispatchAction(player.id, {
    action: 'adopt-routine', eventType: 'night shift', frequency: 'daily',
  });
  const schedule = engine.listScheduleEvents(npc.id);
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].event_type, 'night shift');
  // And it behaves like one: keeping it builds the habit of it.
  engine.advanceTick();
  assert.ok(engine.listHabits(npc.id).some((h) => h.habit_name === 'night shift'));
});

test('a habit practised through the dispatcher is the player\'s own', () => {
  const { npc, player } = citizen();
  const other = engine.generateNPC();
  engine.dispatchAction(player.id, { action: 'practise-habit', name: 'whittling', amount: 10 });
  assert.equal(engine.listHabits(npc.id).length, 1);
  assert.equal(engine.listHabits(other.id).length, 0, 'nobody else picked it up');
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test('an unknown action is refused with the real list', () => {
  const { player } = citizen();
  assert.throws(
    () => engine.dispatchAction(player.id, { action: 'rob-the-bank' }),
    /is not an action. Available: /,
  );
});

test('an action with no name is refused, and says what is on offer', () => {
  const { player } = citizen();
  assert.throws(() => engine.dispatchAction(player.id, {}), /an action is required/);
});

test('an action is refused when a required field is missing', () => {
  const { player } = citizen();
  assert.throws(
    () => engine.dispatchAction(player.id, { action: 'resolve-mission', missionId: 1 }),
    /requires outcome/,
  );
  assert.throws(
    () => engine.dispatchAction(player.id, { action: 'adopt-routine', eventType: 'x' }),
    /requires frequency/,
  );
});

test('a player who does not exist is refused', () => {
  assert.throws(
    () => engine.dispatchAction(999999, { action: 'practise-habit', name: 'x' }),
    /no player with id/,
  );
});

// ---------------------------------------------------------------------------
// Available missions
// ---------------------------------------------------------------------------

test('available missions are the ones nobody is holding', () => {
  const { npc, player } = citizen();
  const before = engine.availableMissions(npc.id).length;
  const mission = missionWorth(100);
  assert.equal(engine.availableMissions(npc.id).length, before + 1);

  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: mission.id });
  assert.equal(
    engine.availableMissions(npc.id).length, before,
    'a mission somebody has taken is not available to anybody, including its holder',
  );
});

test('status alone decides availability, because the two fields cannot disagree', () => {
  // `acceptMission` sets `status` and `assigned_entity_id` together, so
  // "available" and "held" is not a state the state machine can produce.
  // This is pinned rather than assumed because availableMissions() used
  // to carry a second filter on assigned_entity_id that could never
  // fire — deleting it broke no test, which is exactly the problem with
  // unreachable defensive code.
  const { player } = citizen();
  const mission = missionWorth(50);
  engine.dispatchAction(player.id, { action: 'accept-mission', missionId: mission.id });
  const held = engine.getMission(mission.id);
  assert.equal(held.status, 'accepted');
  assert.ok(held.assigned_entity_id != null, 'accepted and assigned move together');

  const stillAvailable = engine.listMissions({ status: 'available' })
    .filter((m) => m.assigned_entity_id != null);
  assert.deepEqual(stillAvailable, [], 'no mission is ever both available and held');
});

test('available missions are refused for an entity that does not exist', () => {
  assert.throws(() => engine.availableMissions(999999), /no entity with id/);
});
