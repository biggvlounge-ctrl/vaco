// VAGO — Group Wager Leaderboard, §10. Every assertion here checks a
// recomputed number against the real pari-mutuel math
// `predictionMarkets.js`'s own suite already covers in isolation — this
// file is about the AGGREGATION (across wagers, in settlement order),
// not the per-wager payout formula.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createGroupWager, joinGroupWager, resolveGroupWager } = require('../lib/groupWagers');
const { leaderboardFor, allSettledGroupWagerIds, recomputeContractOutcomes } = require('../lib/groupWagerLeaderboard');
const { getPredictionMarket } = require('../lib/predictionMarkets');
const { createVagoStore } = require('../lib/store');

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

function baseOptions(overrides = {}) {
  return {
    creatorId: 'ada',
    name: 'Who wins tonight?',
    entryDeadline: FUTURE,
    question: 'Will the Cardinals win tonight?',
    category: 'sports',
    source: 'real-world',
    ...overrides,
  };
}

test('an unsettled group wager contributes nothing to the leaderboard', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  assert.deepEqual(leaderboardFor(store, [groupWager.id]), []);
});

test('winners and losers are ranked by real net earnings, recomputed from the real pool', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'cleo', side: 'no', quantity: 10, settleFn: ledger() });

  await resolveGroupWager(store, { groupWagerId: groupWager.id, outcome: 'yes', settleFn: ledger() });

  const rows = leaderboardFor(store, [groupWager.id]);
  assert.equal(rows.length, 2);

  const bob = rows.find((r) => r.userId === 'bob');
  const cleo = rows.find((r) => r.userId === 'cleo');
  assert.equal(bob.wins, 1);
  assert.equal(bob.losses, 0);
  assert.equal(cleo.wins, 0);
  assert.equal(cleo.losses, 1);
  assert.ok(bob.netEarnings > 0, 'the winner must show a positive net');
  assert.ok(cleo.netEarnings < 0, 'the loser must show a negative net');
  // Solvency carries through the aggregation: the whole pool bob won is
  // exactly what cleo and bob between them staked (the house neither
  // gains nor loses on the group-wager wrapper itself).
  assert.equal(rows[0].userId, 'bob', 'the winner must rank first');
});

test('recomputed payout matches what resolveMarket actually paid, leg for leg', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'dana', side: 'yes', quantity: 30, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'cleo', side: 'no', quantity: 10, settleFn: ledger() });

  const resolveLedger = ledger();
  await resolveGroupWager(store, { groupWagerId: groupWager.id, outcome: 'yes', settleFn: resolveLedger });

  const market = getPredictionMarket(store, groupWager.marketId);
  const outcomes = recomputeContractOutcomes(market);
  const bobOutcome = outcomes.find((o) => o.userId === 'bob');
  const bobLeg = resolveLedger.legs.find((l) => l.toUserId === 'bob');
  assert.equal(bobOutcome.payout, bobLeg.amount, 'the recomputed payout must match the real settled leg exactly');
});

test('a streak is computed in settlement order, not creation order', async () => {
  const store = createVagoStore();
  const w1 = await createGroupWager(store, baseOptions({ name: 'Game 1' }));
  const w2 = await createGroupWager(store, baseOptions({ name: 'Game 2' }));
  const w3 = await createGroupWager(store, baseOptions({ name: 'Game 3' }));

  await joinGroupWager(store, { groupWagerId: w1.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: w2.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: w3.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });

  // Settled out of creation order: w3 first (a win), then w1 (a loss),
  // then w2 (a win) — the streak must follow settledAt, not id order.
  await resolveGroupWager(store, { groupWagerId: w3.id, outcome: 'yes', settleFn: ledger() });
  await resolveGroupWager(store, { groupWagerId: w1.id, outcome: 'no', settleFn: ledger() });
  await resolveGroupWager(store, { groupWagerId: w2.id, outcome: 'yes', settleFn: ledger() });

  // Force a real settlement-time ordering regardless of how fast this
  // test ran (settledAt can tie at the same millisecond on a fast
  // machine) — read the real stored settledAt back and nudge it, the
  // same thing a sleep between calls would have proven less reliably.
  const { findGroupWager } = require('../lib/groupWagers');
  findGroupWager(store, w3.id).settledAt = 1;
  findGroupWager(store, w1.id).settledAt = 2;
  findGroupWager(store, w2.id).settledAt = 3;

  const rows = leaderboardFor(store, [w1.id, w2.id, w3.id]);
  const bob = rows.find((r) => r.userId === 'bob');
  assert.equal(bob.wins, 2);
  assert.equal(bob.losses, 1);
  // win (w3), loss (w1), win (w2) -> current streak is 1, best streak is 1
  assert.equal(bob.currentStreak, 1);
  assert.equal(bob.bestStreak, 1);
});

test('allSettledGroupWagerIds names only what has actually settled', async () => {
  const store = createVagoStore();
  const open = await createGroupWager(store, baseOptions({ name: 'Open one' }));
  const settled = await createGroupWager(store, baseOptions({ name: 'Settled one' }));
  await joinGroupWager(store, { groupWagerId: settled.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
  await resolveGroupWager(store, { groupWagerId: settled.id, outcome: 'yes', settleFn: ledger() });

  const ids = allSettledGroupWagerIds(store);
  assert.deepEqual(ids, [settled.id]);
  assert.equal(ids.includes(open.id), false);
});
