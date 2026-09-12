// VAGO — every settlement pays exactly once, under concurrency.
//
// **One race, five functions, found by scanning for a shape rather than
// by reading files.** After `cashOutMines` turned out to pay N times for
// N concurrent requests, the same structure was searched for across
// every money-moving module in the repo:
//
//     if (thing.status !== 'open') throw ...     <- the guard
//     await settleFn(...)                        <- Node yields HERE
//     thing.status = 'settled';                  <- the write
//
// Seventeen candidates; four more confirmed by probing, each measured
// with five concurrent calls:
//
//   settleSportsEvent    250.05 paid for 3 winning bets (correct: 50.01)
//   resolveEsportsMatch  200.00 paid out of a 40.00 pool
//   gradeFantasyEntry    150.00 paid on a 10.00 stake
//   resolveMarket         86.00 paid out of a 17.20 pool
//
// `settleSportsEvent` was the worst: it pays in a loop with an await per
// bet, so its window widens with every bet on the event.
//
// None of this needs exotic timing. A double-click, a retrying client,
// or two operators pressing settle at once is enough, because a real
// settlement is an HTTP call to V3 and the window is as wide as that
// call takes.
//
// **On the delay inside the ledger double below — a claim I had to
// correct.** The comment here first said the delay was load-bearing,
// and that without it every settlement would run to completion
// synchronously and all of these tests would pass against the broken
// code. Measured: with the delay removed AND the fix reverted, 5 of
// these 8 still fail.
//
// The reason is that `await` yields to the microtask queue even on an
// already-resolved promise, so a `settleFn` that does no real work
// still suspends its caller and the race still appears. The delay
// widens the window and makes every case fail rather than most of
// them, which is worth keeping — but it is not what makes the race
// visible, and saying it was would have been a comment asserting
// something the code disproves.
//
// **Scope note.** VAGO settles in VCoin and Gold Coin only; real-money
// gambling is out of scope per `README.md` and `VAGO_CLAUDE.md` §7.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { settleOnce } = require('../lib/settleOnce');
const sportsbook = require('../lib/sportsbook');
const esports = require('../lib/esportsStaking');
const fantasy = require('../lib/fantasy');
const markets = require('../lib/predictionMarkets');
const { createVagoStore } = require('../lib/store');

const CONCURRENT = 5;

function ledger({ delayMs = 15, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  fn.total = () => Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  return fn;
}

const quiet = async () => {};

// Run the same settlement `CONCURRENT` times at once and report how many
// callers were told they had done it.
async function raceIt(call) {
  const results = await Promise.allSettled(Array.from({ length: CONCURRENT }, call));
  return results.filter((r) => r.status === 'fulfilled').length;
}

// -- The helper itself ---------------------------------------------------

test('settleOnce claims before the first await', async () => {
  const record = { status: 'open' };
  let observedDuringPay = null;
  await settleOnce(record, { status: 'settled' }, async () => {
    observedDuringPay = record.status;
    await new Promise((r) => setTimeout(r, 5));
  });
  assert.equal(observedDuringPay, 'settled',
    'the claim was not visible while the payment was in flight — a concurrent caller would still pass the guard');
});

test('settleOnce restores exactly what it replaced when the payment fails', async () => {
  // Including falsy values, which a truthiness-based restore would turn
  // into undefined.
  const record = { status: 'open', winnerId: null, finalPool: 0 };
  await assert.rejects(() => settleOnce(record,
    { status: 'resolved', winnerId: 'p1', finalPool: 40 },
    async () => { throw new Error('nope'); }), /nope/);

  assert.deepEqual(record, { status: 'open', winnerId: null, finalPool: 0 },
    'a failed settlement did not put the record back as it was');
});

test('settleOnce removes fields that did not exist before', async () => {
  const record = { status: 'open' };
  await assert.rejects(() => settleOnce(record,
    { status: 'resolved', payout: 12 },
    async () => { throw new Error('nope'); }), /nope/);
  assert.equal('payout' in record, false,
    'a field the claim introduced survived a failed settlement');
});

// -- Each settlement path ------------------------------------------------

test('a sports event settles once, however many callers ask', async () => {
  const store = createVagoStore();
  sportsbook.createSportsEvent(store, {
    eventId: 'e1',
    description: 'A at B',
    outcomes: [{ outcomeId: 'a', label: 'A', odds: -150 }, { outcomeId: 'b', label: 'B', odds: 130 }],
  });
  for (const userId of ['u1', 'u2', 'u3']) {
    await sportsbook.placeSportsBet(store, { eventId: 'e1', outcomeId: 'a', userId, stakeVCoin: 10, settleFn: quiet });
  }

  const fn = ledger();
  const fulfilled = await raceIt(() => sportsbook.settleSportsEvent(store,
    { eventId: 'e1', winningOutcomeId: 'a', settleFn: fn }));

  // Three winning bets at -150 on a 10 stake: 16.67 each.
  assert.equal(fn.legs.length, 3,
    `3 winning bets produced ${fn.legs.length} payout legs totalling ${fn.total()}`);
  assert.equal(fulfilled, 1, 'more than one caller was told it had settled the event');
});

test('an esports match pays out its pool once, not once per caller', async () => {
  const store = createVagoStore();
  esports.createEsportsMatch(store, { matchId: 'm1', player1Id: 'p1', player2Id: 'p2' });
  esports.startEsportsMatch(store, { matchId: 'm1' });
  for (const userId of ['u1', 'u2']) {
    await esports.placeStake(store, { matchId: 'm1', userId, backedPlayerId: 'p1', amountVCoin: 20, settleFn: quiet });
  }

  const fn = ledger();
  const fulfilled = await raceIt(() => esports.resolveEsportsMatch(store,
    { matchId: 'm1', winnerId: 'p1', settleFn: fn }));

  assert.equal(fn.total(), 40,
    `a 40.00 pool paid out ${fn.total()} — the pool can only be paid once`);
  assert.equal(fulfilled, 1, 'more than one caller was told it had resolved the match');
});

test('a fantasy entry is graded once', async () => {
  const store = createVagoStore();
  const props = [0, 1].map((i) => fantasy.createProp(store,
    { category: 'points', description: `P${i}`, line: 10 }));
  const entry = await fantasy.createFantasyEntry(store, {
    userId: 'alice',
    stakeAmount: 10,
    picks: props.map((p) => ({ propId: p.id, direction: 'more' })),
    settleFn: quiet,
  });
  for (const p of props) fantasy.resolveProp(store, { propId: p.id, actualValue: 20 });

  const fn = ledger();
  const fulfilled = await raceIt(() => fantasy.gradeFantasyEntry(store,
    { entryId: entry.id, settleFn: fn }));

  assert.equal(fn.legs.length, 1,
    `one entry produced ${fn.legs.length} payouts totalling ${fn.total()} on a 10.00 stake`);
  assert.equal(fulfilled, 1, 'more than one caller was told it had graded the entry');
});

test('a prediction market resolves once, and the pool is the ceiling', async () => {
  const store = createVagoStore();
  const market = markets.createPredictionMarket(store,
    { question: 'q', category: 'c', source: 'real-world', creatorId: 'house' });
  await markets.buyContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 20, settleFn: quiet });
  await markets.buyContract(store, { marketId: market.id, userId: 'bob', side: 'no', quantity: 20, settleFn: quiet });
  const pool = Math.round((market.yesPool + market.noPool) * 100) / 100;

  const fn = ledger();
  const fulfilled = await raceIt(() => markets.resolveMarket(store,
    { marketId: market.id, outcome: 'yes', settleFn: fn }));

  assert.ok(fn.total() <= pool + 0.01,
    `a ${pool} pool paid out ${fn.total()} — "solvent by construction" is only true if it resolves once`);
  assert.equal(fulfilled, 1, 'more than one caller was told it had resolved the market');
});

// -- Failure must not cost anybody their win -----------------------------

test('a failed payout leaves the record settleable again', async () => {
  // Checked on the sportsbook because its claim carries two fields, so a
  // partial restore would show up here.
  const store = createVagoStore();
  sportsbook.createSportsEvent(store, {
    eventId: 'e2',
    description: 'C at D',
    outcomes: [{ outcomeId: 'c', label: 'C', odds: -110 }, { outcomeId: 'd', label: 'D', odds: -110 }],
  });
  await sportsbook.placeSportsBet(store, { eventId: 'e2', outcomeId: 'c', userId: 'u1', stakeVCoin: 10, settleFn: quiet });

  const fn = ledger({ failFirstCall: true, delayMs: 0 });
  await assert.rejects(() => sportsbook.settleSportsEvent(store,
    { eventId: 'e2', winningOutcomeId: 'c', settleFn: fn }), /V3 unreachable/);

  const event = sportsbook.getSportsEvent(store, 'e2');
  assert.equal(event.status, 'open',
    'a failed settlement left the event settled with nobody paid');
  assert.equal(event.winningOutcomeId, null, 'the winning outcome stuck despite the failure');

  const retried = await sportsbook.settleSportsEvent(store,
    { eventId: 'e2', winningOutcomeId: 'c', settleFn: fn });
  assert.equal(retried.event.status, 'settled');
  assert.equal(fn.legs.length, 1, 'the retry paid twice');
});
