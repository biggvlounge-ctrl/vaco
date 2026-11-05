// CHOPZ SHOP — Live Shopping Events. Closes this project's own
// flagged gap: real Vavlt Stvdios channels and real CHOPZ SHOP
// products existed in separate apps with nothing connecting them. See
// lib/liveShoppingEvents.js's own header for exactly what this closes
// and what it deliberately does not claim (no fabricated engagement
// lift, no new checkout path).

const test = require('node:test');
const assert = require('node:assert');

const { createChopzShopStore } = require('../lib/store');
const products = require('../lib/products');
const orders = require('../lib/orders');
const {
  createLiveShoppingEvent, getLiveShoppingEvent, listLiveShoppingEvents,
  goLiveShoppingEvent, endLiveShoppingEvent, getLiveShoppingEventSales,
} = require('../lib/liveShoppingEvents');

const NOW = Date.UTC(2026, 10, 5);

function ledger(initial = {}) {
  const balances = { ...initial };
  const fn = async (legs) => {
    for (const { fromUserId: from, toUserId: to, amount } of legs) {
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
    }
    return { ok: true };
  };
  fn.of = (a) => balances[a] || 0;
  return fn;
}

function realChannel(ownerId) {
  return async () => ({ id: 1, ownerId, name: 'Maker Live', streamUrl: 'rtmp://example.test/live' });
}

function missingChannel() {
  return async () => null;
}

// -- Scheduling: real ownership checks both ways --------------------------

test('scheduling a live shopping event verifies the real channel live, never trusting the claim', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20 });

  const event = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'Weekly Drop', vavltChannelId: 1,
    featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });

  assert.equal(event.status, 'scheduled');
  assert.deepStrictEqual(event.featuredProductIds, [product.id]);
});

test('scheduling is refused if the real channel does not belong to this seller', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20 });

  await assert.rejects(
    () => createLiveShoppingEvent(store, {
      sellerId: 'maker', title: 'Weekly Drop', vavltChannelId: 1,
      featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('someone-else'), now: NOW,
    }),
    /not owned by maker/,
  );
});

test('scheduling is refused if the real channel does not exist', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20 });

  await assert.rejects(
    () => createLiveShoppingEvent(store, {
      sellerId: 'maker', title: 'Weekly Drop', vavltChannelId: 999,
      featuredProductIds: [product.id], vavltChannelFetchFn: missingChannel(), now: NOW,
    }),
    /no Vavlt Stvdios channel/,
  );
});

test('a seller cannot feature a product they do not own, or an empty list of products', async () => {
  const store = createChopzShopStore();
  const own = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20 });
  const stranger = products.createProduct(store, { sellerId: 'other', name: 'Hat', price: 15 });

  await assert.rejects(
    () => createLiveShoppingEvent(store, {
      sellerId: 'maker', title: 'X', vavltChannelId: 1,
      featuredProductIds: [own.id, stranger.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
    }),
    /not owned by maker/,
  );
  await assert.rejects(
    () => createLiveShoppingEvent(store, {
      sellerId: 'maker', title: 'X', vavltChannelId: 1,
      featuredProductIds: [], vavltChannelFetchFn: realChannel('maker'), now: NOW,
    }),
    /non-empty featuredProductIds/,
  );
});

// -- Status progression ----------------------------------------------------

test('an event goes scheduled -> live -> ended, and cannot skip or reverse', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20 });
  const event = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'X', vavltChannelId: 1,
    featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });

  assert.throws(() => endLiveShoppingEvent(store, { eventId: event.id }), /expected "live"/);
  const live = goLiveShoppingEvent(store, { eventId: event.id, now: NOW + 1000 });
  assert.equal(live.status, 'live');
  assert.equal(live.wentLiveAt, NOW + 1000);

  assert.throws(() => goLiveShoppingEvent(store, { eventId: event.id }), /expected "scheduled"/);
  const ended = endLiveShoppingEvent(store, { eventId: event.id, now: NOW + 2000 });
  assert.equal(ended.status, 'ended');
  assert.equal(ended.endedAt, NOW + 2000);
});

// -- Order attribution: no new checkout path -------------------------------

test('a real purchase during a live event is attributed to it, through the exact same createOrder', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20, category: 'general' });
  const event = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'X', vavltChannelId: 1,
    featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });
  goLiveShoppingEvent(store, { eventId: event.id, now: NOW });

  const settleFn = ledger({ sam: 100 });
  const order = await orders.createOrder(store, {
    buyerId: 'sam', productId: product.id, liveShoppingEventId: event.id, settleFn, now: NOW,
  });

  assert.equal(order.liveShoppingEventId, event.id);
  assert.equal(settleFn.of('sam'), 80, 'the real checkout itself must be entirely unchanged');
});

test('an order cannot be attributed to an event that is not live', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20, category: 'general' });
  const event = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'X', vavltChannelId: 1,
    featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });

  const settleFn = ledger({ sam: 100 });
  await assert.rejects(
    () => orders.createOrder(store, { buyerId: 'sam', productId: product.id, liveShoppingEventId: event.id, settleFn, now: NOW }),
    /must be "live"/,
  );
  assert.equal(settleFn.of('sam'), 100, 'a refused attribution must not have charged the buyer');
});

test('an order cannot be attributed to an event for a product that event does not feature', async () => {
  const store = createChopzShopStore();
  const featured = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20, category: 'general' });
  const notFeatured = products.createProduct(store, { sellerId: 'maker', name: 'Hat', price: 15, category: 'general' });
  const event = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'X', vavltChannelId: 1,
    featuredProductIds: [featured.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });
  goLiveShoppingEvent(store, { eventId: event.id, now: NOW });

  const settleFn = ledger({ sam: 100 });
  await assert.rejects(
    () => orders.createOrder(store, { buyerId: 'sam', productId: notFeatured.id, liveShoppingEventId: event.id, settleFn, now: NOW }),
    /not featured/,
  );
});

test('an ordinary order with no liveShoppingEventId is unaffected -- it carries a real, honest null', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20, category: 'general' });
  const settleFn = ledger({ sam: 100 });
  const order = await orders.createOrder(store, { buyerId: 'sam', productId: product.id, settleFn, now: NOW });
  assert.equal(order.liveShoppingEventId, null);
});

// -- Real, honest measurement, no fabricated lift --------------------------

test('getLiveShoppingEventSales reports only the real orders genuinely attributed to this event', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20, category: 'general' });
  const event = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'X', vavltChannelId: 1,
    featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });
  goLiveShoppingEvent(store, { eventId: event.id, now: NOW });

  const settleFn = ledger({ sam: 100, rio: 100 });
  await orders.createOrder(store, { buyerId: 'sam', productId: product.id, liveShoppingEventId: event.id, settleFn, now: NOW });
  // A real order NOT through the live event must not count toward it.
  await orders.createOrder(store, { buyerId: 'rio', productId: product.id, settleFn, now: NOW });

  const sales = getLiveShoppingEventSales(store, event.id);
  assert.equal(sales.orderCount, 1);
  assert.equal(sales.gmv, 20);
});

test('listLiveShoppingEvents filters by real sellerId and status', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', name: 'Mug', price: 20 });
  const other = products.createProduct(store, { sellerId: 'other', name: 'Hat', price: 15 });
  const a = await createLiveShoppingEvent(store, {
    sellerId: 'maker', title: 'A', vavltChannelId: 1, featuredProductIds: [product.id], vavltChannelFetchFn: realChannel('maker'), now: NOW,
  });
  await createLiveShoppingEvent(store, {
    sellerId: 'other', title: 'B', vavltChannelId: 2, featuredProductIds: [other.id], vavltChannelFetchFn: realChannel('other'), now: NOW,
  });
  goLiveShoppingEvent(store, { eventId: a.id, now: NOW });

  assert.equal(listLiveShoppingEvents(store, { sellerId: 'maker' }).length, 1);
  assert.equal(listLiveShoppingEvents(store, { status: 'live' }).length, 1);
  assert.equal(listLiveShoppingEvents(store, {}).length, 2);
});
