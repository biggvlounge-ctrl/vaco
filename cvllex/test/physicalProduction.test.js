// CVLLEX — physical production orders: real minimum-run enforcement
// for pressed media, no-minimum for print-on-demand goods, and status
// transitions.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createCvllexStore } = require('../lib/store');
const {
  PRODUCTION_ITEM_TYPES, PRESSED_MEDIA_ITEM_TYPES, PRESSED_MEDIA_MINIMUM_UNITS,
  minimumUnitsFor, createProductionOrder, getProductionOrder,
  listProductionOrdersForCreator, advanceProductionOrder,
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
  const store = createCvllexStore();
  assert.throws(
    () => createProductionOrder(store, { creatorId: 'ada', itemType: 'snow-globe', quantity: 10 }),
    /invalid itemType/,
  );
});

test('createProductionOrder refuses a CD run below the real Qrates-style minimum', () => {
  const store = createCvllexStore();
  assert.throws(
    () => createProductionOrder(store, { creatorId: 'ada', itemType: 'cd', quantity: 1 }),
    /real minimum run of 100/,
  );
  assert.strictEqual(store.productionOrders.length, 0, 'a rejected order must not be recorded');
});

test('createProductionOrder accepts a CD run at exactly the minimum', () => {
  const store = createCvllexStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'cd', quantity: 100 });
  assert.strictEqual(order.quantity, 100);
  assert.strictEqual(order.minimumUnits, 100);
  assert.strictEqual(order.status, 'ordered');
  assert.strictEqual(order.vaultId, null);
});

test('createProductionOrder accepts a single-unit magazine or poster run — no real minimum', () => {
  const store = createCvllexStore();
  const magazine = createProductionOrder(store, { creatorId: 'ada', itemType: 'magazine', quantity: 1 });
  assert.strictEqual(magazine.quantity, 1);
  const poster = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 5 });
  assert.strictEqual(poster.quantity, 5);
});

test('createProductionOrder rejects a non-positive estimatedUnitCost when one is given', () => {
  const store = createCvllexStore();
  assert.throws(
    () => createProductionOrder(store, { creatorId: 'ada', itemType: 'pin', quantity: 1, estimatedUnitCost: -1 }),
    /estimatedUnitCost must be a positive number/,
  );
});

test('listProductionOrdersForCreator returns only that creator\'s orders, newest first', () => {
  const store = createCvllexStore();
  createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1, now: 1000 });
  createProductionOrder(store, { creatorId: 'ben', itemType: 'pin', quantity: 1, now: 2000 });
  const second = createProductionOrder(store, { creatorId: 'ada', itemType: 'magazine', quantity: 2, now: 3000 });
  const orders = listProductionOrdersForCreator(store, 'ada');
  assert.strictEqual(orders.length, 2);
  assert.strictEqual(orders[0].id, second.id);
});

test('advanceProductionOrder only allows the next real step, not skipping in-production', () => {
  const store = createCvllexStore();
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
  const store = createCvllexStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1 });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'cancelled' });
  assert.strictEqual(order.status, 'cancelled');
});

test('advanceProductionOrder refuses to move a produced or cancelled order any further', () => {
  const store = createCvllexStore();
  const order = createProductionOrder(store, { creatorId: 'ada', itemType: 'poster', quantity: 1 });
  advanceProductionOrder(store, { orderId: order.id, toStatus: 'cancelled' });
  assert.throws(
    () => advanceProductionOrder(store, { orderId: order.id, toStatus: 'in-production' }),
    /already cancelled and cannot change further/,
  );
});

test('getProductionOrder returns null for an unknown id, not a throw', () => {
  const store = createCvllexStore();
  assert.strictEqual(getProductionOrder(store, 999), null);
});

// -- 'book', closing this module's own long-named VENVS gap ------------

test('a single signed/special-edition book run is a real, valid, no-minimum order', () => {
  const store = createCvllexStore();
  const order = createProductionOrder(store, {
    creatorId: 'author-1', itemType: 'book', quantity: 1,
    vendorNote: 'signed hardcover, foil cover art',
  });
  assert.strictEqual(order.itemType, 'book');
  assert.strictEqual(order.minimumUnits, 1, 'book is print-on-demand, not pressed media -- no Qrates-style floor');
  assert.strictEqual(order.vendorNote, 'signed hardcover, foil cover art');
});
