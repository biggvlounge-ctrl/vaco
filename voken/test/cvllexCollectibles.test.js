// VOKEN -- the real fix: only a finished CVLLEX production order is a
// real "collectible." The bug this file exists to catch: an
// `ordered`, `in-production`, or `cancelled` order showing up as
// something real to sell or promote when it hasn't actually shipped
// (or will never ship) at all.

const test = require('node:test');
const assert = require('node:assert');

const { filterProducedOrders } = require('../lib/cvllexCollectibles');

test('only a real, finished "produced" order passes through', () => {
  const orders = [
    { id: 1, status: 'ordered' },
    { id: 2, status: 'in-production' },
    { id: 3, status: 'produced' },
    { id: 4, status: 'cancelled' },
  ];
  const result = filterProducedOrders(orders);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 3);
});

test('an empty or missing real order list stays empty, never an error', () => {
  assert.deepEqual(filterProducedOrders([]), []);
  assert.deepEqual(filterProducedOrders(null), []);
  assert.deepEqual(filterProducedOrders(undefined), []);
  assert.deepEqual(filterProducedOrders('not-an-array'), []);
});

test('several real produced orders all pass through together', () => {
  const orders = [
    { id: 1, status: 'produced' },
    { id: 2, status: 'ordered' },
    { id: 3, status: 'produced' },
  ];
  const result = filterProducedOrders(orders);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((o) => o.id), [1, 3]);
});
