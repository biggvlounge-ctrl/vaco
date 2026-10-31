'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createConflict, ConflictError, assertBookable, startConflict, currentDuel,
  recordDuelResult, forfeitSide, predictionEligibility, describeConflict,
  assessWarEscalation, escalateToWar, WAR_THRESHOLDS,
} from '../src/lib/conflicts.js';
import { createLeaderboardsStore, recordFor, recordConflictResult } from '../src/lib/leaderboards.js';

function dispute(overrides = {}) {
  return createConflict({
    conflictId: 'c1',
    kind: 'dispute',
    reason: 'turf',
    sideA: { groupId: 'tribe-ashwood', label: 'Ashwood Tribe', participantIds: ['a1', 'a2'] },
    sideB: { groupId: 'tribe-redrock', label: 'Redrock Tribe', participantIds: ['b1'] },
    ...overrides,
  });
}

test('createConflict refuses an empty side, an id reused on both sides, and a blank kind', () => {
  assert.throws(() => createConflict({
    conflictId: 'c1', kind: 'street-fight',
    sideA: { participantIds: [] }, sideB: { participantIds: ['b1'] },
  }), ConflictError);
  assert.throws(() => createConflict({
    conflictId: 'c1', kind: 'street-fight',
    sideA: { participantIds: ['x1', 'x2'] }, sideB: { participantIds: ['x2', 'x3'] },
  }), /x2.*listed on both sides/);
  assert.throws(() => createConflict({
    conflictId: 'c1', kind: '',
    sideA: { participantIds: ['a1'] }, sideB: { participantIds: ['b1'] },
  }), ConflictError);
});

test('createConflict allows any uneven handicap -- 12 versus 8, 1 versus 3, no rules', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => `big-${i}`);
  const eight = Array.from({ length: 8 }, (_, i) => `small-${i}`);
  const c = createConflict({
    conflictId: 'c-handicap', kind: 'street-fight',
    sideA: { participantIds: twelve }, sideB: { participantIds: eight },
  });
  assert.equal(c.sideA.participantIds.length, 12);
  assert.equal(c.sideB.participantIds.length, 8);

  const oneVsThree = createConflict({
    conflictId: 'c-1v3', kind: 'street-fight',
    sideA: { participantIds: ['solo'] }, sideB: { participantIds: ['x1', 'x2', 'x3'] },
  });
  assert.equal(oneVsThree.sideA.participantIds.length, 1);
  assert.equal(oneVsThree.sideB.participantIds.length, 3);
});

test('a side with no groupId defaults to a real "street crew" label', () => {
  const c = createConflict({
    conflictId: 'c1', kind: 'street-fight',
    sideA: { participantIds: ['a1'] }, sideB: { participantIds: ['b1'] },
  });
  assert.equal(c.sideA.label, 'street crew');
});

test('assertBookable refuses a fighter already engaged elsewhere', () => {
  const c = dispute();
  assert.throws(() => assertBookable(c, ['a2']), /a2.*already engaged/);
  assertBookable(c, ['someone-else']);
});

test('startConflict refuses to start twice', () => {
  const c = dispute();
  startConflict(c);
  assert.throws(() => startConflict(c), /not scheduled/);
});

test('a gauntlet runs duel by duel, eliminating only the loser, until one side is empty', () => {
  const c = dispute(); // Ashwood (a1, a2) vs Redrock (b1) -- a real 2v1 handicap
  startConflict(c);
  assert.deepEqual(currentDuel(c), { sideAFighter: 'a1', sideBFighter: 'b1' });

  // a1 beats b1 -- Redrock's only fighter is gone, conflict over.
  recordDuelResult(c, 'a1');
  assert.equal(c.status, 'finished');
  assert.equal(c.winningSide, 'A');
  assert.equal(c.resolution, 'gauntlet');
  assert.equal(c.sideB.queue.length, 0);
  assert.equal(c.sideA.queue.length, 2, 'a1 was never eliminated -- the winner stays in');
});

test('a losing front fighter is eliminated and the winner faces the next fighter in line', () => {
  const c = createConflict({
    conflictId: 'c2', kind: 'dispute',
    sideA: { participantIds: ['a1', 'a2'] }, sideB: { participantIds: ['b1', 'b2'] },
  });
  startConflict(c);
  recordDuelResult(c, 'b1'); // b1 beats a1 -- a1 eliminated
  assert.deepEqual(currentDuel(c), { sideAFighter: 'a2', sideBFighter: 'b1' });
  recordDuelResult(c, 'a2'); // a2 beats b1 -- b1 eliminated
  assert.deepEqual(currentDuel(c), { sideAFighter: 'a2', sideBFighter: 'b2' });
  assert.equal(c.status, 'live');
  recordDuelResult(c, 'a2'); // a2 sweeps -- b2 eliminated, side B empty
  assert.equal(c.status, 'finished');
  assert.equal(c.winningSide, 'A');
});

test('recordDuelResult refuses a winner who is not in the current duel', () => {
  const c = dispute();
  startConflict(c);
  assert.throws(() => recordDuelResult(c, 'a2'), /not fighting in the current duel/);
});

test('recordDuelResult refuses on a conflict that is not live', () => {
  const c = dispute();
  assert.throws(() => recordDuelResult(c, 'a1'), /not live/);
});

test('forfeitSide ends the whole conflict for the other side immediately', () => {
  const c = dispute();
  startConflict(c);
  forfeitSide(c, 'B');
  assert.equal(c.status, 'finished');
  assert.equal(c.winningSide, 'A');
  assert.equal(c.resolution, 'forfeit');
});

test('forfeitSide refuses an already-decided conflict and a bad side key', () => {
  const c = dispute();
  startConflict(c);
  assert.throws(() => forfeitSide(c, 'C'), /sideKey must be/);
  forfeitSide(c, 'A');
  assert.throws(() => forfeitSide(c, 'B'), /already decided/);
});

test('predictionEligibility is open for a street fight the moment it exists -- no tier gate', () => {
  const c = createConflict({
    conflictId: 'c1', kind: 'street-fight',
    sideA: { participantIds: ['a1'] }, sideB: { participantIds: ['b1'] },
  });
  assert.equal(predictionEligibility(c).eligible, true);
  startConflict(c);
  assert.equal(predictionEligibility(c).eligible, true);
  recordDuelResult(c, 'a1');
  assert.equal(predictionEligibility(c).eligible, false);
});

test('describeConflict reports real remaining counts and the live duel', () => {
  const c = dispute();
  startConflict(c);
  const described = describeConflict(c);
  assert.equal(described.sideA.startingCount, 2);
  assert.equal(described.sideA.remaining, 2);
  assert.equal(described.sideB.remaining, 1);
  assert.deepEqual(described.currentDuel, { sideAFighter: 'a1', sideBFighter: 'b1' });
  assert.equal(described.predictions, 'open');
});

// -- recordConflictResult (leaderboards.js) ------------------------------

test('recordConflictResult credits every individual who fought, win or lose, under conflict:<kind>', () => {
  const store = createLeaderboardsStore();
  const c = dispute(); // Ashwood (a1, a2) vs Redrock (b1)
  startConflict(c);
  recordDuelResult(c, 'a1');
  recordConflictResult(store, c);

  const a1 = recordFor(store, 'a1');
  assert.equal(a1.wins, 1);
  assert.deepEqual(a1.byDiscipline['conflict:dispute'], { wins: 1, losses: 0 });
  // a2 never fought a duel but is still credited for the side's win.
  const a2 = recordFor(store, 'a2');
  assert.equal(a2.wins, 1);
  const b1 = recordFor(store, 'b1');
  assert.equal(b1.losses, 1);
});

test('recordConflictResult also credits the two real groups a head-to-head result', () => {
  const store = createLeaderboardsStore();
  const c = dispute();
  startConflict(c);
  recordDuelResult(c, 'a1');
  recordConflictResult(store, c);

  const ashwood = recordFor(store, 'tribe-ashwood');
  assert.equal(ashwood.wins, 1);
  assert.deepEqual(ashwood.byDiscipline['conflict:group'], { wins: 1, losses: 0 });
  const redrock = recordFor(store, 'tribe-redrock');
  assert.equal(redrock.losses, 1);
});

test('recordConflictResult never credits a group when a side is an ad hoc street crew (no groupId)', () => {
  const store = createLeaderboardsStore();
  const c = createConflict({
    conflictId: 'c-street', kind: 'street-fight',
    sideA: { participantIds: ['a1', 'a2'] }, sideB: { participantIds: ['b1'] },
  });
  startConflict(c);
  recordDuelResult(c, 'a1');
  recordConflictResult(store, c);
  assert.equal(recordFor(store, 'a1').wins, 1, 'individuals are still credited');
  assert.equal(Object.keys(store.records).length, 3, 'no phantom group record was created');
});

test('recordConflictResult refuses a conflict that is not finished', () => {
  const store = createLeaderboardsStore();
  const c = dispute();
  assert.throws(() => recordConflictResult(store, c), /finished conflict/);
});

// -- War escalation -------------------------------------------------------

function bigConflict() {
  return createConflict({
    conflictId: 'c-war', kind: 'dispute', reason: 'border land',
    sideA: { groupId: 'tribe-ashwood', participantIds: ['a1', 'a2', 'a3'] },
    sideB: { groupId: 'tribe-redrock', participantIds: ['b1', 'b2', 'b3'] },
  });
}

// Three duels that split back and forth -- a1 beats b1, b2 beats a1,
// a2 beats b2 -- land on exactly 3 injuries while BOTH sides still
// have a fighter left (A: a2,a3 remain; B: b3 remains), so the
// conflict is still real and live, not already decided, at the
// moment the war threshold is checked.
function runThreeSplitDuels(c) {
  recordDuelResult(c, 'a1'); // a1 beats b1
  recordDuelResult(c, 'b2'); // b2 beats a1
  recordDuelResult(c, 'a2'); // a2 beats b2
}

test('assessWarEscalation requires real injuries, headcount, and duration together, not any one alone', () => {
  const c = bigConflict();
  const start = 1_000_000;
  startConflict(c, { now: start });
  // Enough headcount (6) from the start, but no duels yet and no time passed.
  assert.equal(assessWarEscalation(c, { now: start }).escalated, false);

  recordDuelResult(c, 'a1'); // 1 injury
  recordDuelResult(c, 'b2'); // 2 injuries
  // Still short of WAR_THRESHOLDS.minInjuries (3) and no time has passed.
  assert.equal(assessWarEscalation(c, { now: start }).escalated, false);

  recordDuelResult(c, 'a2'); // 3 injuries -- but duration is still 0
  assert.equal(assessWarEscalation(c, { now: start }).escalated, false, 'injuries and headcount alone are not enough without real duration');
  assert.equal(c.status, 'live', 'both sides still have a fighter left');

  const later = start + WAR_THRESHOLDS.minDurationMs;
  const assessment = assessWarEscalation(c, { now: later });
  assert.equal(assessment.escalated, true);
  assert.equal(assessment.metrics.injuries, 3);
  assert.equal(assessment.metrics.totalParticipants, 6);
});

test('escalateToWar refuses a conflict that has not crossed the real threshold yet', () => {
  const c = dispute(); // only 3 total participants -- can never cross minTotalParticipants (6)
  startConflict(c);
  assert.throws(() => escalateToWar(c, { now: Date.now() + WAR_THRESHOLDS.minDurationMs }), /has not crossed the real war threshold/);
});

test('escalateToWar is idempotent once a conflict is already a war', () => {
  const c = bigConflict();
  const start = 2_000_000;
  startConflict(c, { now: start });
  runThreeSplitDuels(c);
  const later = start + WAR_THRESHOLDS.minDurationMs;
  escalateToWar(c, { now: later });
  assert.ok(c.escalation);
  const firstSince = c.escalation.since;
  escalateToWar(c, { now: later + 999 }); // called again -- must not overwrite
  assert.equal(c.escalation.since, firstSince);
});

test('escalateToWar refuses once the conflict is already decided', () => {
  const c = bigConflict();
  const start = 3_000_000;
  startConflict(c, { now: start });
  recordDuelResult(c, 'a1'); // beats b1
  recordDuelResult(c, 'a1'); // beats b2
  recordDuelResult(c, 'a1'); // beats b3
  // After a1 sweeps side B's whole queue (b1,b2,b3), side B is empty -- finished.
  assert.equal(c.status, 'finished');
  assert.throws(() => escalateToWar(c, { now: start + WAR_THRESHOLDS.minDurationMs }), /already decided/);
});

test('describeConflict surfaces escalation state and the live threshold assessment', () => {
  const c = bigConflict();
  const start = 4_000_000;
  startConflict(c, { now: start });
  let described = describeConflict(c);
  assert.equal(described.escalation, null);
  assert.equal(described.warEscalation.escalated, false);

  runThreeSplitDuels(c);
  escalateToWar(c, { now: start + WAR_THRESHOLDS.minDurationMs });
  described = describeConflict(c);
  assert.ok(described.escalation);
});

test('recordConflictResult credits an escalated conflict under conflict:war, not conflict:<kind>', () => {
  const store = createLeaderboardsStore();
  const c = bigConflict();
  const start = 5_000_000;
  startConflict(c, { now: start });
  runThreeSplitDuels(c); // live, A: a2,a3 remain; B: b3 remains
  escalateToWar(c, { now: start + WAR_THRESHOLDS.minDurationMs });
  recordDuelResult(c, 'a2'); // a2 beats b3 -- side B empty, conflict finished
  assert.equal(c.status, 'finished');
  assert.equal(c.winningSide, 'A');

  recordConflictResult(store, c);
  const a1 = recordFor(store, 'a1');
  assert.deepEqual(a1.byDiscipline['conflict:war'], { wins: 1, losses: 0 });
  assert.equal(a1.byDiscipline['conflict:dispute'], undefined, 'an escalated conflict never also counts as a plain dispute');
});
