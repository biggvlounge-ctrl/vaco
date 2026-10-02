// VAGO — a settlement reason doubling as V3's idempotency key must be
// unique per leg, not just per event/match/market.
//
// **Why this file exists.** `settleOnce.test.js` proved each of these
// four payout loops settles exactly once under concurrency. It did not
// catch a separate, real bug in the same loops: the settlement
// `reason` string (which server.js's settleVCoin turns directly into
// V3's `Idempotency-Key`) was scoped only by the event/match/market id,
// with no per-winner component -- `vago_sports_payout:${eventId}`,
// `vago_esports_payout:${matchId}`, `vago_prediction_payout:${marketId}`,
// and, worst of all, the bare literal `'vago_fantasy_entry_payout'`
// with no scoping at all.
//
// V3's real idempotency store fingerprints the full request body and
// refuses a reused key whose body differs (422 "already used for a
// different request") rather than replaying it -- a reused key is only
// safe when it really is the same request. So the *second* winning
// payout in any of these loops, which has a different toUserId/amount
// than the first, collided with the first's key and was refused
// outright. That throw propagated out of the settleOnce-wrapped
// payout, which rolled the event/match/market back to its pre-
// settlement status even though the first winner had already been
// paid -- and every retry hit the identical collision on the next
// unpaid winner, so anything with two or more winners could never
// finish settling.
//
// The mock settleFn below reproduces that real behavior (fingerprint
// the legs, refuse a reused key whose fingerprint differs) rather than
// just recording calls, which is exactly the gap that let the bug ship
// unnoticed.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const sportsbook = require('../lib/sportsbook');
const esports = require('../lib/esportsStaking');
const fantasy = require('../lib/fantasy');
const markets = require('../lib/predictionMarkets');
const { createVagoStore } = require('../lib/store');

const quiet = async () => {};

function idempotentLedger() {
  const seen = new Map();
  const legs = [];
  const fn = async (settlementLegs, meta = {}) => {
    const fingerprint = JSON.stringify(settlementLegs);
    if (meta.reason) {
      const prior = seen.get(meta.reason);
      if (prior !== undefined) {
        if (prior !== fingerprint) {
          throw new Error(
            `Idempotency-Key "settle:${meta.reason}" was already used for a different request. `
            + 'Reusing a key with a changed body is a caller bug -- use a new key.',
          );
        }
        return { ok: true, idempotentReplay: true };
      }
      seen.set(meta.reason, fingerprint);
    }
    legs.push(...settlementLegs);
    return { ok: true };
  };
  fn.legs = legs;
  fn.total = () => Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  return fn;
}

test('a sports event with two different winners pays both, not just the first', async () => {
  const store = createVagoStore();
  sportsbook.createSportsEvent(store, {
    eventId: 'e-multi',
    description: 'A at B',
    outcomes: [{ outcomeId: 'a', label: 'A', odds: -150 }, { outcomeId: 'b', label: 'B', odds: 130 }],
  });
  for (const userId of ['u1', 'u2']) {
    await sportsbook.placeSportsBet(store, { eventId: 'e-multi', outcomeId: 'a', userId, stakeVCoin: 10, settleFn: quiet });
  }

  const fn = idempotentLedger();
  const { event, settledBets } = await sportsbook.settleSportsEvent(store,
    { eventId: 'e-multi', winningOutcomeId: 'a', settleFn: fn });

  assert.equal(event.status, 'settled', 'the event must finish settling, not roll back on the second winner');
  assert.equal(fn.legs.length, 2, 'both winning bets must be genuinely paid, not just the first');
  assert.equal(settledBets.filter((b) => b.status === 'won').length, 2);
});

test('an esports match pays a user who staked on the winner twice, both stakes', async () => {
  const store = createVagoStore();
  esports.createEsportsMatch(store, { matchId: 'm-multi', player1Id: 'p1', player2Id: 'p2' });
  await esports.placeStake(store, { matchId: 'm-multi', userId: 'u1', backedPlayerId: 'p1', amountVCoin: 10, settleFn: quiet });
  await esports.placeStake(store, { matchId: 'm-multi', userId: 'u1', backedPlayerId: 'p1', amountVCoin: 20, settleFn: quiet });
  await esports.placeStake(store, { matchId: 'm-multi', userId: 'u2', backedPlayerId: 'p2', amountVCoin: 15, settleFn: quiet });

  const fn = idempotentLedger();
  const { match, payouts } = await esports.resolveEsportsMatch(store,
    { matchId: 'm-multi', winnerId: 'p1', settleFn: fn });

  assert.equal(match.status, 'resolved', 'the match must finish resolving, not roll back on the second stake');
  assert.equal(payouts.length, 2, 'both of u1\'s winning stakes must be paid out separately');
  assert.equal(fn.total(), 45, 'the full 45.00 pool must reach the winner\'s backers');
});

test('a prediction market pays out two different winning holders, not just the first', async () => {
  const store = createVagoStore();
  const market = markets.createPredictionMarket(store,
    { question: 'q', category: 'c', source: 'real-world', creatorId: 'house' });
  await markets.buyContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 10, settleFn: quiet });
  await markets.buyContract(store, { marketId: market.id, userId: 'carol', side: 'yes', quantity: 30, settleFn: quiet });
  await markets.buyContract(store, { marketId: market.id, userId: 'bob', side: 'no', quantity: 20, settleFn: quiet });

  const fn = idempotentLedger();
  const { market: resolved, payouts } = await markets.resolveMarket(store,
    { marketId: market.id, outcome: 'yes', settleFn: fn });

  assert.equal(resolved.status, 'resolved', 'the market must finish resolving, not roll back on the second holder');
  assert.equal(payouts.length, 2, 'both winning holders must be paid, not just alice');
  assert.ok(payouts.some((p) => p.userId === 'alice') && payouts.some((p) => p.userId === 'carol'));
});

test('two different fantasy entries can both be graded — the key is not a bare global literal', async () => {
  const store = createVagoStore();
  const props = [0, 1].map((i) => fantasy.createProp(store,
    { category: 'points', description: `P${i}`, line: 10 }));

  const entryA = await fantasy.createFantasyEntry(store, {
    userId: 'alice', stakeAmount: 10, picks: props.map((p) => ({ propId: p.id, direction: 'more' })), settleFn: quiet,
  });
  const entryB = await fantasy.createFantasyEntry(store, {
    userId: 'bob', stakeAmount: 25, picks: props.map((p) => ({ propId: p.id, direction: 'more' })), settleFn: quiet,
  });
  for (const p of props) fantasy.resolveProp(store, { propId: p.id, actualValue: 20 });

  const fn = idempotentLedger();
  // Pre-fix, this is exactly the sequence that broke: the first
  // grading claims the one global key, and the second -- a different
  // user for a different amount -- collides with it and throws.
  const gradedA = await fantasy.gradeFantasyEntry(store, { entryId: entryA.id, settleFn: fn });
  const gradedB = await fantasy.gradeFantasyEntry(store, { entryId: entryB.id, settleFn: fn });

  assert.equal(gradedA.status, 'won');
  assert.equal(gradedB.status, 'won', 'the second entry graded in the store\'s lifetime must not be refused');
  assert.equal(fn.legs.length, 2, 'both entries must be genuinely paid');
});
