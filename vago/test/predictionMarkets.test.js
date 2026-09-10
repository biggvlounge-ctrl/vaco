// VAGO — prediction market purchases.
//
// **This path had no test of any kind.** `buyContract` is the only
// multi-leg money movement in this app: the contract cost and the
// trading fee both leave the buyer's account, and the market pools and
// the contract record are written only after both have moved.
//
// Written as two consecutive transfers — which is how it was — the fee
// leg could fail after the cost leg had already moved. The buyer had
// paid, no pool had grown, no contract existed, and the retry charged
// the cost a second time. Nothing in this repository would have
// noticed, because nothing here was tested at all.
//
// **Scope note.** VAGO settles in VCoin and Gold Coin only; real-money
// gambling is out of scope per `README.md` and `VAGO_CLAUDE.md` §7, and
// nothing here changes that. These tests are about a settlement that
// already existed being interruptible half-done.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPredictionMarket, buyContract, getPredictionMarket,
} = require('../lib/predictionMarkets');
const { VAGO_HOUSE_ACCOUNT } = require('../lib/casinoSession');
const { createVagoStore } = require('../lib/store');

// Records settlements. `legs` is every movement, flattened — what an
// assertion about who paid what wants. `calls` is how many times the
// ledger was asked, and it is the only thing that can tell an atomic
// settlement from the consecutive transfers it replaced: the amounts
// are identical either way.
function ledger({ failFirstCall = false } = {}) {
  const calls = [];
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs, meta = {}) => {
    if (refuse) {
      refuse = false;
      throw new Error('legs[1]: Insufficient VCoin balance. Nothing in this settlement was applied.');
    }
    calls.push({ legs: settlementLegs, meta });
    legs.push(...settlementLegs);
    return { settlementId: calls.length };
  };
  fn.calls = calls;
  fn.legs = legs;
  fn.paidBy = (userId) => legs
    .filter((l) => l.fromUserId === userId)
    .reduce((n, l) => n + l.amount, 0);
  return fn;
}

function openMarket(store) {
  return createPredictionMarket(store, {
    question: 'Will it rain in St. Louis tomorrow?',
    category: 'weather',
    source: 'real-world',
    creatorId: 'ada',
  });
}

test('a purchase moves the cost and the fee in ONE settlement', async () => {
  const store = createVagoStore();
  const market = openMarket(store);
  const settleFn = ledger();

  await buyContract(store, {
    marketId: market.id, userId: 'sam', side: 'yes', quantity: 10, settleFn,
  });

  // **The assertion arithmetic cannot make.** Both legs must reach the
  // ledger together. Split, every amount below is identical and the
  // buyer can still end up paying for nothing.
  assert.equal(settleFn.calls.length, 1, 'the purchase must be a single atomic settlement');

  // Two legs rather than one netted movement: the buy and the fee are
  // separately auditable even though both land in the house account.
  assert.equal(settleFn.legs.length, 2, 'cost and fee stay separately auditable');
  assert.ok(settleFn.legs.every((l) => l.toUserId === VAGO_HOUSE_ACCOUNT));
  assert.ok(settleFn.legs.every((l) => l.fromUserId === 'sam'));
  assert.match(settleFn.legs[0].reason, /vago_prediction_buy/);
  assert.match(settleFn.legs[1].reason, /vago_prediction_fee/);
});

test('a refused purchase leaves no contract, no pool, and no charge', async () => {
  // The market pools and the contract record are written after the
  // money moves, so a refused settlement must leave all three untouched
  // — otherwise a buyer holds a position they never paid for, or has
  // paid for one they do not hold.
  const store = createVagoStore();
  const market = openMarket(store);
  const settleFn = ledger({ failFirstCall: true });

  await assert.rejects(
    () => buyContract(store, {
      marketId: market.id, userId: 'sam', side: 'yes', quantity: 10, settleFn,
    }),
    /Nothing in this settlement was applied/,
  );

  const after = getPredictionMarket(store, market.id);
  assert.equal(after.yesPool, 0, 'a refused purchase grew the market pool');
  assert.equal(after.contracts.length, 0, 'a refused purchase recorded a contract');
  assert.equal(settleFn.paidBy('sam'), 0, 'a refused purchase charged the buyer');
});

test('the retry after a refusal charges exactly once', async () => {
  // **The regression.** With the legs split, the first attempt would
  // have moved the cost before failing on the fee — and this retry
  // would charge the cost again for one position.
  const store = createVagoStore();
  const market = openMarket(store);
  const settleFn = ledger({ failFirstCall: true });

  await assert.rejects(() => buyContract(store, {
    marketId: market.id, userId: 'sam', side: 'yes', quantity: 10, settleFn,
  }), /Nothing in this settlement was applied/);

  await buyContract(store, {
    marketId: market.id, userId: 'sam', side: 'yes', quantity: 10, settleFn,
  });

  const after = getPredictionMarket(store, market.id);
  assert.equal(after.contracts.length, 1, 'the retry created a second contract');
  const buys = settleFn.legs.filter((l) => /vago_prediction_buy/.test(l.reason));
  assert.equal(buys.length, 1, 'the buyer was charged the contract cost more than once');
  assert.equal(after.yesPool, buys[0].amount, 'the pool must match exactly what was charged');
});

test('buying without a settleFn is refused rather than given away', async () => {
  const store = createVagoStore();
  const market = openMarket(store);

  await assert.rejects(
    () => buyContract(store, { marketId: market.id, userId: 'sam', side: 'yes', quantity: 1 }),
    /requires a settleFn/,
  );
  assert.equal(getPredictionMarket(store, market.id).contracts.length, 0);
});
