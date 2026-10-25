// VOKEN — physical production orders: real minimum-run enforcement
// for pressed media, no-minimum for print-on-demand goods, status
// transitions, and the bridge into the existing merch-listing/
// tokenization path.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { createMerchListing } = require('../lib/limitedEditionMerch');
const {
  PRODUCTION_ITEM_TYPES, PRESSED_MEDIA_ITEM_TYPES, PRESSED_MEDIA_MINIMUM_UNITS,
  minimumUnitsFor, createProductionOrder, getProductionOrder,
  listProductionOrdersForCreator, advanceProductionOrder, listProducedOrder,
} = require('../lib/physicalProduction');

test('minimumUnitsFor returns the real pressed-media floor for cd/vinyl/cassette, and 1 for everything else', () => {
  for (const itemType of PRESSED_MEDIA_ITEM_TYPES) {
    assert.strictEqual(minimumUnitsFor(itemType), PRESSED_MEDIA_MINIMUM_UNITS);
  }
  for (const itemType of PRODUCTION_ITEM_TYPES.filter((t) => !PRESSED_MEDIA_ITEM_TYPES.includes(t))) {
    assert.strictEqual(minimumUnitsFor(itemType), 1);
  }
});

test('createProductionOrder rejects an unknown itemType', () => {
  const store = createVokenStore();
  assert.throws(
    () => createProductionOrder(store, { creatorId: 'ada', itemType: 'snow-globe', quantity: 10 }),
    /invalid itemType/,
  );
});

test('createProductionOrder refuses a CD run below the real Qrates-style minimum', () => {
  const store = createVokenStore();
  assert.throws(
    () => createProductionOrder(store, { creatorId: 'ada', itemType: 'cd', quantity: 1 }),
    /real minimum run of 100/,
  );
  assert.strictEqual(store.productionOrders.length, 0, 'a rejected order must not be recorded');
});

test('createProductionOrder accepts a CD run at exactly the minimum', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'cd', quantity: 100 });
  assert.strictEqual(order.quantity, 100);
  assert.strictEqual(order.minimumUnits, 100);
  assert.strictEqual(order.status, 'ordered');
});

test('createProductionOrder accepts a single-unit magazine or poster run — no real minimum', () => {
  const store = createVokenStore();
  const magazine = createProductionOrder(store, { creatorId: 'ada', itemType: 'magazine', quantity: 1 });
  assert.strictEqual(magazine.quantity, 1);
  const poster = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 5 });
  assert.strictEqual(poster.quantity, 5);
});

test('createProductionOrder carries linkedCultureCardId through, same as a merch listing already does', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, {
    creatorId: 'ada', itemType: 'vinyl', quantity: 150, linkedCultureCardId: 42,
  });
  assert.strictEqual(order.linkedCultureCardId, 42);
});

test('createProductionOrder rejects a non-positive estimatedUnitCost when one is given', () => {
  const store = createVokenStore();
  assert.throws(
    () => createProductionOrder(store, { creatorId: 'ada', itemType: 'pin', quantity: 1, estimatedUnitCost: -1 }),
    /estimatedUnitCost must be a positive number/,
  );
});

test('listProductionOrdersForCreator returns only that creator\'s orders, newest first', () => {
  const store = createVokenStore();
  createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1, now: 1000 });
  createProductionOrder(store, { creatorId: 'ben', itemType: 'pin', quantity: 1, now: 2000 });
  const second = createProductionOrder(store, { creatorId: 'ada', itemType: 'magazine', quantity: 2, now: 3000 });
  const orders = listProductionOrdersForCreator(store, 'ada');
  assert.strictEqual(orders.length, 2);
  assert.strictEqual(orders[0].id, second.id);
});

test('advanceProductionOrder only allows the next real step, not skipping in-production', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1 });
  assert.throws(
    () => advanceProductionOrder(store, { orderId: order.id, toStatus: 'produced' }),
    /only the next step \(in-production\) or cancelled/,
  );
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'in-production' });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'produced' });
  assert.strictEqual(order.status, 'produced');
});

test('advanceProductionOrder allows cancelling from either open state', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1 });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'cancelled' });
  assert.strictEqual(order.status, 'cancelled');
});

test('advanceProductionOrder refuses to move a produced or cancelled order any further', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1 });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'cancelled' });
  assert.throws(
    () => advanceProductionOrder(store, { orderId: order.id, toStatus: 'in-production' }),
    /already cancelled and cannot change further/,
  );
});

test('listProducedOrder refuses to list an order that has not actually been produced yet', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 10 });
  assert.throws(
    () => listProducedOrder(store, { orderId: order.id, basePrice: 20, createMerchListingFn: createMerchListing }),
    /is ordered, not produced/,
  );
});

test('listProducedOrder bridges into the real, existing createMerchListing — same store, same linkedCultureCardId', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, {
    creatorId: 'ada', itemType: 'cd', quantity: 100, linkedCultureCardId: 7,
  });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'in-production' });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'produced' });

  const { listing } = listProducedOrder(store, { orderId: order.id, basePrice: 15, createMerchListingFn: createMerchListing });
  assert.strictEqual(listing.creatorId, 'ada');
  assert.strictEqual(listing.itemType, 'cd');
  assert.strictEqual(listing.totalSupply, 100);
  assert.strictEqual(listing.linkedCultureCardId, 7);
  assert.strictEqual(store.limitedEditionMerch.length, 1, 'must use the real, existing merch store, not a second one');
  assert.strictEqual(order.merchListingId, listing.id);
});

test('listProducedOrder refuses to list the same produced order twice', () => {
  const store = createVokenStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1 });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'in-production' });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'produced' });
  listProducedOrder(store, { orderId: order.id, basePrice: 10, createMerchListingFn: createMerchListing });
  assert.throws(
    () => listProducedOrder(store, { orderId: order.id, basePrice: 10, createMerchListingFn: createMerchListing }),
    /already been listed as merch listing/,
  );
});
