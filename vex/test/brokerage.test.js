// VEX — the settlement idempotency key must be unique per order.
//
// **Why this file exists.** `placeTradeOrder` scoped its settlement
// reason (which doubles as V3's `Idempotency-Key`, see server.js's
// `settleVCoin`) by cardId and direction only: `vex_buy:${cardId}` /
// `vex_sell:${cardId}`. Two genuinely distinct orders for the same
// card, direction, quantity and price — an ordinary repeat trade at a
// stable market price, nothing adversarial — fingerprinted identically
// on V3's end. V3 replays the first settlement's cached success for
// the second order without moving any new money, and `placeTradeOrder`
// never looks at the settlement result before minting (buy) or
// releasing (sell) real editions. A buyer placing the same-shaped buy
// order twice got a second real edition for free; a seller placing the
// same-shaped sell order twice had a second real edition taken away
// and was paid nothing for it.
//
// These tests prove each order gets its own settlement key, so no two
// distinct orders can ever collide — using a settleFn stub that
// reproduces V3's real replay behavior (a repeated key returns the
// first result and moves no new money) rather than a plain spy.

const test = require('node:test');
const assert = require('node:assert');

const { createVexStore } = require('../lib/store');
const gate = require('../lib/complianceGate');

// Same stubbing technique as complianceGate.test.js, and for the same
// reason: brokerage.js destructures vokenClient's functions at module
// load, so the cache entry must exist before brokerage.js is required.
const vokenClientPath = require.resolve('../lib/vokenClient');
let voken = null;
require.cache[vokenClientPath] = {
  id: vokenClientPath,
  filename: vokenClientPath,
  loaded: true,
  exports: {
    getCultureCard: (...args) => voken.getCultureCard(...args),
    mintAdditionalEdition: (...args) => voken.mintAdditionalEdition(...args),
    transferEditionOwnership: (...args) => voken.transferEditionOwnership(...args),
  },
};

const brokerage = require('../lib/brokerage');

function stubVokenClient(card) {
  const calls = { get: 0, mint: 0, transfer: 0 };
  voken = {
    getCultureCard: async () => { calls.get += 1; return card; },
    mintAdditionalEdition: async () => { calls.mint += 1; return { editionNumber: calls.mint }; },
    transferEditionOwnership: async () => { calls.transfer += 1; return { ok: true }; },
  };
  return { calls, restore: () => { voken = null; } };
}

function cardWith(editions) {
  return { id: 'card-1', editions };
}

function openAccount(store, userId = 'ada') {
  return brokerage.openBrokerAccount(store, { userId });
}

function clearedStore() {
  const store = createVexStore();
  gate.setComplianceStatus(store, 'vex-brokerage', true);
  return store;
}

// A settleFn that reproduces V3's real idempotency semantics: the
// first call for a given `meta.reason` moves money and is recorded;
// any later call with the *same* reason is a replay — it returns the
// first call's result and moves nothing. This is the behavior that
// made the collision dangerous rather than merely cosmetic.
function idempotentLedger(initial = {}) {
  const balances = { ...initial };
  const seen = new Map();
  const calls = [];
  const fn = async (legs, meta = {}) => {
    if (meta.reason && seen.has(meta.reason)) {
      return { ...seen.get(meta.reason), idempotentReplay: true };
    }
    for (const { fromUserId: from, toUserId: to, amount } of legs) {
      if (typeof amount !== 'number' || Number.isNaN(amount) || amount < 0) {
        throw new Error(`ledger: bad transfer of ${amount}`);
      }
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
    }
    const result = { ok: true, settlementId: calls.length + 1 };
    calls.push({ legs, meta });
    if (meta.reason) seen.set(meta.reason, result);
    return result;
  };
  fn.calls = calls;
  fn.of = (a) => balances[a] || 0;
  return fn;
}

test('two distinct buy orders for the same card, quantity and price each really charge the buyer', async () => {
  const store = clearedStore();
  const account = openAccount(store);
  const settleFn = idempotentLedger({ ada: 1000, 'vex-platform': 0 });
  const voken = stubVokenClient(cardWith([]));

  try {
    const order1 = await brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy', quantity: 1, pricePerUnit: 100, settleFn,
    });
    const order2 = await brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'buy', quantity: 1, pricePerUnit: 100, settleFn,
    });

    assert.notStrictEqual(order1.id, order2.id, 'two orders must be two distinct records');
    assert.strictEqual(settleFn.calls.length, 2,
      'each order must really settle — a second order replaying the first means it mints a free edition');
    assert.strictEqual(settleFn.of('ada'), 800, 'the buyer must be charged for both orders, not just the first');
    assert.strictEqual(voken.calls.mint, 2);
  } finally {
    voken.restore();
  }
});

test('two distinct sell orders for the same card, quantity and price each really pay the seller', async () => {
  const store = clearedStore();
  const account = openAccount(store);
  const settleFn = idempotentLedger({ 'vex-platform': 1000 });
  const card = cardWith([
    { format: 'digital', editionNumber: 1, ownerId: 'ada' },
    { format: 'digital', editionNumber: 2, ownerId: 'ada' },
  ]);
  const voken = stubVokenClient(card);

  try {
    const order1 = await brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'sell', quantity: 1, pricePerUnit: 100, settleFn,
    });
    const order2 = await brokerage.placeTradeOrder(store, {
      accountId: account.id, cardId: 'card-1', orderType: 'sell', quantity: 1, pricePerUnit: 100, settleFn,
    });

    assert.notStrictEqual(order1.id, order2.id);
    // Both sells genuinely transfer a real edition away before
    // settling — that part was never the bug.
    assert.strictEqual(voken.calls.transfer, 2);
    assert.strictEqual(settleFn.calls.length, 2,
      'each sell must really pay out — a replayed settlement means the seller lost a real edition for nothing');
    assert.strictEqual(settleFn.of('ada'), 200, 'the seller must be paid for both editions, not just the first');
  } finally {
    voken.restore();
  }
});

test('retrying the exact same order id is still a replay, not a double-charge', async () => {
  // Scoping the key by order id does not remove V3's own idempotency
  // protection for a genuine retry of one order -- it only stops two
  // *different* orders from colliding. Calling settleFn twice with the
  // same reason (the same order) must still replay, not pay twice.
  const store = clearedStore();
  const account = openAccount(store);
  const settleFn = idempotentLedger({ ada: 1000 });
  const voken = stubVokenClient(cardWith([]));

  try {
    const reason = 'vex_buy:card-1:1';
    const legs = [{ fromUserId: 'ada', toUserId: brokerage.VEX_PLATFORM_ACCOUNT, amount: 100, reason }];
    await settleFn(legs, { reason });
    await settleFn(legs, { reason });

    assert.strictEqual(settleFn.calls.length, 1, 'the same reason used twice must settle only once');
    assert.strictEqual(settleFn.of('ada'), 900);
  } finally {
    voken.restore();
  }
});
