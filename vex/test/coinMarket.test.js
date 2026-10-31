// VEX — VXC's constant-product market maker: the AMM math itself,
// the compliance gate guarding it separately from vex-brokerage, the
// "refused, never partly applied" discipline on an insufficient sell,
// and the same settlement-idempotency-key risk brokerage.test.js
// already proved for card orders, proved again here for coin orders.

const test = require('node:test');
const assert = require('node:assert');

const { createVexStore } = require('../lib/store');
const gate = require('../lib/complianceGate');
const coinMarket = require('../lib/coinMarket');

function stubSettle() {
  const legs = [];
  const seen = new Map();
  const settleFn = async (orderLegs, meta) => {
    if (seen.has(meta.reason)) return seen.get(meta.reason);
    legs.push(...orderLegs);
    const result = { ok: true, legs: orderLegs };
    seen.set(meta.reason, result);
    return result;
  };
  return { legs, settleFn };
}

function openedStore() {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-coin-trading', true);
  return store;
}

// -- The gate -------------------------------------------------------

test('a buy or sell is refused while vex-coin-trading is not cleared', async () => {
  const store = createVexStore();
  const { settleFn } = stubSettle();
  await assert.rejects(
    () => coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 10, settleFn }),
    /not cleared to move money/,
  );
});

// -- Price and the constant-product invariant ------------------------

test('the pool opens at the seeded price, and k stays constant across a trade', async () => {
  const store = openedStore();
  const before = coinMarket.getCoinPrice(store);
  assert.strictEqual(before, coinMarket.INITIAL_VCOIN_RESERVE / coinMarket.INITIAL_COIN_RESERVE);

  const kBefore = store.coinMarket.coinReserve * store.coinMarket.vcoinReserve;
  const { settleFn } = stubSettle();
  await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 1000, settleFn });
  const kAfter = store.coinMarket.coinReserve * store.coinMarket.vcoinReserve;

  // Not exactly equal -- both reserves are rounded to real, bounded
  // precision after the trade -- but close, which is the honest
  // real-world behavior of a rounded ledger, not a bug.
  assert.ok(Math.abs(kAfter - kBefore) / kBefore < 0.001, `k drifted too far: ${kBefore} -> ${kAfter}`);
});

test('buying VXC raises its price; selling the same amount back lowers it again', async () => {
  const store = openedStore();
  const priceAtStart = coinMarket.getCoinPrice(store);
  const { settleFn } = stubSettle();

  const buy = await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 50000, settleFn });
  assert.ok(buy.priceAfter > priceAtStart, 'a real buy should push the price up, not leave it flat');

  const sell = await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'sell', coinAmount: 50000, settleFn });
  assert.ok(sell.priceAfter < buy.priceAfter, 'selling back the same amount should push the price back down');
});

test('a larger order moves the price more than a smaller one — real slippage, not a flat quoted rate', async () => {
  const smallStore = openedStore();
  const bigStore = openedStore();
  const { settleFn: settleSmall } = stubSettle();
  const { settleFn: settleBig } = stubSettle();

  const small = await coinMarket.placeCoinOrder(smallStore, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 1000, settleFn: settleSmall });
  const big = await coinMarket.placeCoinOrder(bigStore, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 100000, settleFn: settleBig });

  const smallImpact = small.priceAfter - coinMarket.INITIAL_VCOIN_RESERVE / coinMarket.INITIAL_COIN_RESERVE;
  const bigImpact = big.priceAfter - coinMarket.INITIAL_VCOIN_RESERVE / coinMarket.INITIAL_COIN_RESERVE;
  assert.ok(bigImpact > smallImpact * 10, 'a 100x larger order should move price by meaningfully more than 1x');
});

// -- Holdings and the "refused, never partly applied" rule ------------

test('a buy credits the real VXC balance it paid for', async () => {
  const store = openedStore();
  const { settleFn } = stubSettle();
  await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 2500, settleFn });
  assert.strictEqual(coinMarket.getCoinHolding(store, 'ada'), 2500);
});

test('a sell larger than the real holding is refused before anything moves', async () => {
  const store = openedStore();
  const { settleFn } = stubSettle();
  await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 100, settleFn });

  const reserveBefore = { ...store.coinMarket };
  await assert.rejects(
    () => coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'sell', coinAmount: 101, settleFn }),
    /owns only 100/,
  );
  assert.strictEqual(coinMarket.getCoinHolding(store, 'ada'), 100, 'a refused sell must not touch the real holding');
  assert.deepStrictEqual(store.coinMarket, reserveBefore, 'a refused sell must not touch the real pool reserves');
});

test('a buy for more VXC than the pool holds is refused', async () => {
  const store = openedStore();
  const { settleFn } = stubSettle();
  await assert.rejects(
    () => coinMarket.placeCoinOrder(store, {
      accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: coinMarket.INITIAL_COIN_RESERVE, settleFn,
    }),
    /pool only holds/,
  );
});

// -- Settlement idempotency, the same risk brokerage.test.js proved ---

test('two distinct same-shaped orders get two distinct settlement keys, and both really move money', async () => {
  const store = openedStore();
  const { legs, settleFn } = stubSettle();

  const first = await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 500, settleFn });
  const second = await coinMarket.placeCoinOrder(store, { accountId: 1, userId: 'ada', orderType: 'buy', coinAmount: 500, settleFn });

  assert.notStrictEqual(first.id, second.id);
  assert.strictEqual(legs.length, 2, 'both orders should have genuinely settled, not replayed a cached result');
  assert.strictEqual(coinMarket.getCoinHolding(store, 'ada'), 1000);
});
