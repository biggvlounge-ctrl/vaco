// VDP — barter.js: direct trade of exotic, smuggled old-world goods.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBarterStore, addExoticGood, removeExoticGood, inventoryFor, seedFromSmuggledGoods,
  proposeTrade, acceptTrade, cancelTrade, listOpenTrades, tradesInvolving,
} from '../src/lib/barter.js';

test('addExoticGood/removeExoticGood build a real, per-entity inventory', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'antique rifle', 1);
  addExoticGood(store, 'alice', 'antique rifle', 2);
  assert.deepEqual(inventoryFor(store, 'alice'), { 'antique rifle': 3 });

  removeExoticGood(store, 'alice', 'antique rifle', 1);
  assert.deepEqual(inventoryFor(store, 'alice'), { 'antique rifle': 2 });
});

test('removeExoticGood refuses to take more than an entity actually has', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'books', 1);
  assert.throws(() => removeExoticGood(store, 'alice', 'books', 2), /only has 1/);
});

test('seedFromSmuggledGoods reads immigration.js\'s own real smuggledGoods list, one unit each', () => {
  const store = createBarterStore();
  seedFromSmuggledGoods(store, 'bob', ['guns', 'books', 'books']);
  assert.deepEqual(inventoryFor(store, 'bob'), { guns: 1, books: 2 });
});

test('proposeTrade requires a real item on both sides, and refuses an offer the proposer cannot back', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'books', 1);
  assert.throws(
    () => proposeTrade(store, { fromId: 'alice', toId: 'bob', offer: [], request: [{ itemName: 'guns', quantity: 1 }] }),
    /at least one real item/,
  );
  assert.throws(
    () => proposeTrade(store, {
      fromId: 'alice', toId: 'bob', offer: [{ itemName: 'guns', quantity: 1 }], request: [{ itemName: 'drugs', quantity: 1 }],
    }),
    /does not have 1 "guns"/,
  );
});

test('acceptTrade swaps real items both ways, exactly once', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'books', 1);
  addExoticGood(store, 'bob', 'guns', 1);
  const trade = proposeTrade(store, {
    fromId: 'alice', toId: 'bob',
    offer: [{ itemName: 'books', quantity: 1 }], request: [{ itemName: 'guns', quantity: 1 }],
  });

  const accepted = acceptTrade(store, trade.id);
  assert.equal(accepted.status, 'accepted');
  assert.deepEqual(inventoryFor(store, 'alice'), { books: 0, guns: 1 });
  assert.deepEqual(inventoryFor(store, 'bob'), { guns: 0, books: 1 });
  assert.throws(() => acceptTrade(store, trade.id), /is not open/);
});

test('acceptTrade refuses when the receiving side no longer has the requested real item', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'books', 1);
  const trade = proposeTrade(store, {
    fromId: 'alice', toId: 'bob',
    offer: [{ itemName: 'books', quantity: 1 }], request: [{ itemName: 'guns', quantity: 1 }],
  });
  // bob never actually had the guns -- checked again at accept time.
  assert.throws(() => acceptTrade(store, trade.id), /"bob" does not have 1 "guns"/);
});

test('cancelTrade closes a real open trade without moving anything', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'books', 1);
  const trade = proposeTrade(store, {
    fromId: 'alice', toId: 'bob',
    offer: [{ itemName: 'books', quantity: 1 }], request: [{ itemName: 'guns', quantity: 1 }],
  });
  const cancelled = cancelTrade(store, trade.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(inventoryFor(store, 'alice'), { books: 1 });
  assert.equal(listOpenTrades(store).length, 0);
});

test('listOpenTrades/tradesInvolving find exactly the real, relevant trades', () => {
  const store = createBarterStore();
  addExoticGood(store, 'alice', 'books', 1);
  const trade = proposeTrade(store, {
    fromId: 'alice', toId: 'bob',
    offer: [{ itemName: 'books', quantity: 1 }], request: [{ itemName: 'guns', quantity: 1 }],
  });
  assert.deepEqual(listOpenTrades(store), [trade]);
  assert.deepEqual(tradesInvolving(store, 'alice'), [trade]);
  assert.deepEqual(tradesInvolving(store, 'bob'), [trade]);
  assert.deepEqual(tradesInvolving(store, 'carol'), []);
});
