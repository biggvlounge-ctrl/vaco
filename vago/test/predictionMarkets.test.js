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

// -- Pricing: the cold start, and the money pump it hid -------------------
//
// **A risk-free money pump, found by probing and measured before being
// fixed.** The price was `yesPool / (yesPool + noPool)`, so the first
// trade in a market moved the price on its own evidence alone:
//
//   alice buys 10 yes at 0.50        -> pays 5, yesPool = 5, noPool = 0
//   price is now 5/5 = 1.00          -> clamped to 0.99
//   alice sells the same 10 at 0.99  -> receives 9.90
//
// Net +4.72 VCoin after the fee, from a market with no other
// participant, repeatable until the house account was empty. The pool
// clamped to zero and the house simply went short, which is why nothing
// surfaced it.
//
// Two changes close it, and both are asserted below because either one
// alone leaves a hole: virtual liquidity stops the price swinging to a
// bound on the first trade, and a hard cap stops any sell paying out
// more than that side's pool actually holds.

const {
  sellContract, resolveMarket, getMarketPrice, MIN_PRICE, MAX_PRICE,
} = require('../lib/predictionMarkets');

// Net VCoin a user gained across every recorded leg. Negative means
// they paid in more than they took out.
function netFor(legs, userId) {
  return legs.reduce((n, l) => n
    + (l.toUserId === userId ? l.amount : 0)
    - (l.fromUserId === userId ? l.amount : 0), 0);
}

test('an instant buy-then-sell round trip cannot profit', async () => {
  const store = createVagoStore();
  const fn = ledger();
  const { legs } = fn;
  const market = createPredictionMarket(store, {
    question: 'q', category: 'c', source: 'real-world', creatorId: 'house',
  });

  await buyContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 10, settleFn: fn });
  await sellContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 10, settleFn: fn });

  const net = netFor(legs, 'alice');
  assert.ok(net <= 0,
    `alice gained ${net} VCoin by buying and immediately selling into her own price move — `
    + 'that is a risk-free pump on the house account, repeatable until it is empty');
});

test('a sell never pays out more than that side of the pool holds', async () => {
  const store = createVagoStore();
  const fn = ledger();
  const { legs } = fn;
  const market = createPredictionMarket(store, {
    question: 'q', category: 'c', source: 'real-world', creatorId: 'house',
  });

  await buyContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 10, settleFn: fn });
  const pooledBeforeSell = market.yesPool;
  const sold = await sellContract(store, {
    marketId: market.id, userId: 'alice', side: 'yes', quantity: 10, settleFn: fn,
  });

  assert.ok(sold.proceeds <= pooledBeforeSell,
    `a sell paid out ${sold.proceeds} against a pool of ${pooledBeforeSell}`);
  assert.ok(market.yesPool >= 0, 'the pool went negative');
  // And it says so rather than quietly paying a different number than
  // the quoted price implies.
  if (sold.proceeds < sold.requested) {
    assert.equal(sold.capped, true, 'a capped sell must report that it was capped');
  }
});

test('the house is never short after a resolution', async () => {
  // Solvency end to end: everything the house paid out must be covered
  // by what it took in. This is the property the pari-mutuel design
  // claims, stated as a number rather than as a comment.
  const store = createVagoStore();
  const fn = ledger();
  const { legs } = fn;
  const market = createPredictionMarket(store, {
    question: 'q', category: 'c', source: 'real-world', creatorId: 'house',
  });

  await buyContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 20, settleFn: fn });
  await buyContract(store, { marketId: market.id, userId: 'bob', side: 'no', quantity: 30, settleFn: fn });
  await resolveMarket(store, { marketId: market.id, outcome: 'yes', settleFn: fn });

  const house = netFor(legs, VAGO_HOUSE_ACCOUNT);
  assert.ok(house >= 0,
    `the house ended ${house} VCoin short — it paid out more than it collected`);
});

test('a market opens at the price it was given, not at a coin flip', () => {
  const store = createVagoStore();
  const seeded = createPredictionMarket(store, {
    question: 'q', category: 'sports', source: 'real-world', creatorId: 'house',
    openingYesPrice: 0.58,
  });
  assert.equal(getMarketPrice(seeded).yesPrice, 0.58);

  const unseeded = createPredictionMarket(store, {
    question: 'q2', category: 'c', source: 'real-world', creatorId: 'house',
  });
  assert.equal(getMarketPrice(unseeded).yesPrice, 0.5,
    'a market with no opening price must still start at 50c');
});

test('an opening price outside the tradeable bounds is refused', () => {
  const store = createVagoStore();
  for (const bad of [0, 1, -0.2, 1.5]) {
    assert.throws(() => createPredictionMarket(store, {
      question: 'q', category: 'c', source: 'real-world', creatorId: 'house', openingYesPrice: bad,
    }), /openingYesPrice must be between/, `openingYesPrice ${bad} was accepted`);
  }
});

test('the opening price is a starting point, not a floor', async () => {
  // Seeding must not pin the price. Real stake has to be able to move
  // it against the house's own opinion, or the market is decoration.
  const store = createVagoStore();
  const fn = ledger();
  const market = createPredictionMarket(store, {
    question: 'q', category: 'sports', source: 'real-world', creatorId: 'house',
    openingYesPrice: 0.58,
  });
  await buyContract(store, { marketId: market.id, userId: 'bob', side: 'no', quantity: 200, settleFn: fn });
  assert.ok(getMarketPrice(market).yesPrice < 0.58,
    'heavy no buying did not move the price below its opening');
});

test('the virtual liquidity never becomes money anyone is paid', async () => {
  // The whole safety argument for virtual liquidity is that it affects
  // the displayed price and nothing else. If it ever leaked into a
  // pool, resolution would promise money nobody paid in — which is the
  // original insolvency this module already fixed once.
  const store = createVagoStore();
  const fn = ledger();
  const { legs } = fn;
  const market = createPredictionMarket(store, {
    question: 'q', category: 'c', source: 'real-world', creatorId: 'house', openingYesPrice: 0.9,
  });

  await buyContract(store, { marketId: market.id, userId: 'alice', side: 'yes', quantity: 5, settleFn: fn });
  const paidIn = market.yesPool + market.noPool;
  const { payouts } = await resolveMarket(store, { marketId: market.id, outcome: 'yes', settleFn: fn });
  const paidOut = payouts.reduce((n, p) => n + p.payout, 0);

  assert.ok(paidOut <= paidIn + 0.01,
    `resolution paid out ${paidOut} against ${paidIn} actually collected`);
});
