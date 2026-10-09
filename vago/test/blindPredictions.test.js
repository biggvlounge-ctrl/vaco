// VAGO — BLIND (§17) and Before-the-Answer (§18), one engine over a
// real stake pool. No prior VAGO mechanic to reuse here — unlike Side
// Wagers/Team roles/Leaderboard, this is genuinely new, so every
// settlement path (entry, resolution, payout) gets its own test here
// rather than inheriting predictionMarkets.js's suite.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBlindRound, submitAnswer, determineWinners, resolveBlindRound,
  blindRoundView, isBlindRoundLocked, FORMATS, ANSWER_TYPES,
} = require('../lib/blindPredictions');
const { createVagoStore } = require('../lib/store');
const { VAGO_HOUSE_ACCOUNT } = require('../lib/casinoSession');

function ledger() {
  const legs = [];
  const fn = async (settlementLegs) => {
    legs.push(...settlementLegs);
    return { settlementId: legs.length };
  };
  fn.legs = legs;
  return fn;
}

const FUTURE = Date.now() + 60 * 60 * 1000;
const PAST = Date.now() - 1000;

function baseOptions(overrides = {}) {
  return {
    creatorId: 'ada',
    format: 'blind',
    proposition: 'How many points will the Cardinals score tonight?',
    answerType: 'numeric',
    entryAmount: 10,
    entryDeadline: FUTURE,
    ...overrides,
  };
}

// -- createBlindRound -------------------------------------------------------

test('every declared FORMATS and ANSWER_TYPES value is accepted', () => {
  const store = createVagoStore();
  for (const format of FORMATS) {
    const round = createBlindRound(store, baseOptions({ format }));
    assert.equal(round.format, format);
  }
  for (const answerType of ANSWER_TYPES) {
    const round = createBlindRound(store, baseOptions({ answerType }));
    assert.equal(round.answerType, answerType);
  }
});

test('createBlindRound requires a positive entryAmount and a future deadline', () => {
  const store = createVagoStore();
  assert.throws(() => createBlindRound(store, baseOptions({ entryAmount: 0 })), /positive entryAmount/);
  assert.throws(() => createBlindRound(store, baseOptions({ entryDeadline: PAST })), /entryDeadline in the future/);
});

test('an invented format or answerType is refused', () => {
  const store = createVagoStore();
  assert.throws(() => createBlindRound(store, baseOptions({ format: 'invented' })), /format must be one of/);
  assert.throws(() => createBlindRound(store, baseOptions({ answerType: 'invented' })), /answerType must be one of/);
});

// -- submitAnswer (JOIN+FUND+answer, atomically) -----------------------------

test('submitAnswer charges the real entry fee into the real house account', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  const settleFn = ledger();
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 7, settleFn });

  assert.equal(settleFn.legs.length, 1);
  assert.equal(settleFn.legs[0].fromUserId, 'bob');
  assert.equal(settleFn.legs[0].toUserId, VAGO_HOUSE_ACCOUNT);
  assert.equal(settleFn.legs[0].amount, 10);
  assert.equal(round.pool, 10);
  assert.equal(round.answers.length, 1);
});

test('a numeric round refuses a non-numeric answer, and an exact round refuses an empty one', async () => {
  const store = createVagoStore();
  const numeric = createBlindRound(store, baseOptions({ answerType: 'numeric' }));
  await assert.rejects(
    submitAnswer(store, { blindRoundId: numeric.id, userId: 'bob', answer: 'seven', settleFn: ledger() }),
    /requires a numeric answer/,
  );

  const exact = createBlindRound(store, baseOptions({ answerType: 'exact', proposition: 'Capital of Mongolia?' }));
  await assert.rejects(
    submitAnswer(store, { blindRoundId: exact.id, userId: 'bob', answer: '', settleFn: ledger() }),
    /non-empty answer/,
  );
});

test('a user cannot answer the same round twice', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 7, settleFn: ledger() });
  await assert.rejects(
    submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 9, settleFn: ledger() }),
    /already submitted an answer/,
  );
});

test('a full round refuses a new entrant', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions({ maxParticipants: 2 }));
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 7, settleFn: ledger() });
  await submitAnswer(store, { blindRoundId: round.id, userId: 'cleo', answer: 9, settleFn: ledger() });
  await assert.rejects(
    submitAnswer(store, { blindRoundId: round.id, userId: 'dana', answer: 11, settleFn: ledger() }),
    /is full/,
  );
});

test('a locked round (past its deadline, or already resolved) refuses a new answer', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions({ entryDeadline: Date.now() + 50 }));
  assert.equal(isBlindRoundLocked(round, Date.now() + 100), true);
  await assert.rejects(
    submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 7, settleFn: ledger(), now: Date.now() + 100 }),
    /is locked/,
  );
});

// -- determineWinners ---------------------------------------------------------

test('numeric winners are whoever is closest, ties shared', () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  round.answers = [
    { userId: 'bob', answer: 5 },
    { userId: 'cleo', answer: 8 },
    { userId: 'dana', answer: 12 },
  ];
  round.realAnswer = 8;
  const winners = determineWinners(round);
  assert.deepEqual(winners.map((w) => w.userId), ['cleo']);
});

test('a numeric tie produces multiple winners, per §17', () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  round.answers = [
    { userId: 'bob', answer: 6 },
    { userId: 'cleo', answer: 10 },
  ];
  round.realAnswer = 8; // both 2 away
  const winners = determineWinners(round);
  assert.deepEqual(new Set(winners.map((w) => w.userId)), new Set(['bob', 'cleo']));
});

test('exact winners match case- and whitespace-insensitively', () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions({ answerType: 'exact', proposition: 'Capital of Mongolia?' }));
  round.answers = [
    { userId: 'bob', answer: '  Ulaanbaatar ' },
    { userId: 'cleo', answer: 'Beijing' },
  ];
  round.realAnswer = 'ulaanbaatar';
  const winners = determineWinners(round);
  assert.deepEqual(winners.map((w) => w.userId), ['bob']);
});

test('no answers means no winners', () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  round.realAnswer = 8;
  assert.deepEqual(determineWinners(round), []);
});

// -- resolveBlindRound --------------------------------------------------------

test('the whole pool is solvent by construction — paid out exactly once', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 8, settleFn: ledger() });
  await submitAnswer(store, { blindRoundId: round.id, userId: 'cleo', answer: 12, settleFn: ledger() });

  const resolveLedger = ledger();
  const { payouts } = await resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: resolveLedger });

  assert.equal(payouts.length, 1);
  assert.equal(payouts[0].userId, 'bob');
  assert.equal(payouts[0].payout, 20, 'the winner takes the whole real pool');
  assert.equal(resolveLedger.legs.length, 1);
  assert.equal(round.status, 'resolved');
});

test('a tie splits the pool evenly between winners', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 6, settleFn: ledger() });
  await submitAnswer(store, { blindRoundId: round.id, userId: 'cleo', answer: 10, settleFn: ledger() });
  await submitAnswer(store, { blindRoundId: round.id, userId: 'dana', answer: 2, settleFn: ledger() });

  const { payouts } = await resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: ledger() });
  assert.equal(payouts.length, 2);
  for (const payout of payouts) assert.equal(payout.payout, 15, 'a 30-pool split two ways is 15 each');
});

test('a round with no entrants resolves with no payouts and no error', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  const { payouts } = await resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: ledger() });
  assert.deepEqual(payouts, []);
});

test('resolving twice is refused, and a failed payout leaves the round resolvable again', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 8, settleFn: ledger() });

  const failingSettle = async () => { throw new Error('ledger down'); };
  await assert.rejects(resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: failingSettle }), /ledger down/);
  assert.equal(round.status, 'open', 'a failed payout must not leave the round claimed as resolved');

  await resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: ledger() });
  assert.equal(round.status, 'resolved');
  await assert.rejects(
    resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: ledger() }),
    /is not open/,
  );
});

// -- blindRoundView -----------------------------------------------------------

test('blindRoundView carries live locked/winners state, and winners stay null until resolved', async () => {
  const store = createVagoStore();
  const round = createBlindRound(store, baseOptions());
  await submitAnswer(store, { blindRoundId: round.id, userId: 'bob', answer: 8, settleFn: ledger() });

  const openView = blindRoundView(store, round.id);
  assert.equal(openView.participantCount, 1);
  assert.equal(openView.winners, null);

  await resolveBlindRound(store, { blindRoundId: round.id, realAnswer: 8, settleFn: ledger() });
  const resolvedView = blindRoundView(store, round.id);
  assert.deepEqual(resolvedView.winners, ['bob']);
});

test('blindRoundView returns null for an unknown round', () => {
  const store = createVagoStore();
  assert.equal(blindRoundView(store, 9999), null);
});
