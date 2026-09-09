// V3 -- real unit tests for the VCoin ledger, using Node's own
// built-in test runner (node:test) -- zero new dependency, matching
// this ecosystem's "don't add what isn't needed" posture. First
// automated test suite in this app since it shipped; closes part of
// the ecosystem audit's "27 of 30 apps have zero automated tests"
// finding.
//
// Run: node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { STARTING_VCOIN_BALANCE, getBalance, transfer, getTransactionHistory } = require('../lib/vcoin');

test('getBalance auto-grants the starting balance on first touch', () => {
  const store = createV3Store();
  assert.equal(getBalance(store, 'new-user'), STARTING_VCOIN_BALANCE);
});

test('transfer moves the exact amount between two accounts', () => {
  const store = createV3Store();
  const result = transfer(store, { fromUserId: 'a', toUserId: 'b', amount: 100 });
  assert.equal(result.fromBalance, STARTING_VCOIN_BALANCE - 100);
  assert.equal(result.toBalance, STARTING_VCOIN_BALANCE + 100);
  assert.equal(getBalance(store, 'a'), STARTING_VCOIN_BALANCE - 100);
  assert.equal(getBalance(store, 'b'), STARTING_VCOIN_BALANCE + 100);
});

test('transfer rejects an amount exceeding the real balance', () => {
  const store = createV3Store();
  assert.throws(
    () => transfer(store, { fromUserId: 'a', toUserId: 'b', amount: STARTING_VCOIN_BALANCE + 1 }),
    /Insufficient VCoin balance/,
  );
});

test('transfer rejects a non-positive amount', () => {
  const store = createV3Store();
  assert.throws(() => transfer(store, { fromUserId: 'a', toUserId: 'b', amount: 0 }), /positive number/);
  assert.throws(() => transfer(store, { fromUserId: 'a', toUserId: 'b', amount: -5 }), /positive number/);
});

test('transfer requires both real user ids', () => {
  const store = createV3Store();
  assert.throws(() => transfer(store, { toUserId: 'b', amount: 5 }), /required/);
  assert.throws(() => transfer(store, { fromUserId: 'a', amount: 5 }), /required/);
});

test('a real transaction record is appended with a real, incrementing id', () => {
  const store = createV3Store();
  const first = transfer(store, { fromUserId: 'a', toUserId: 'b', amount: 10 });
  const second = transfer(store, { fromUserId: 'a', toUserId: 'b', amount: 10 });
  assert.equal(second.transaction.id, first.transaction.id + 1);
});

test('getTransactionHistory returns only transactions touching that real user', () => {
  const store = createV3Store();
  transfer(store, { fromUserId: 'a', toUserId: 'b', amount: 10 });
  transfer(store, { fromUserId: 'c', toUserId: 'd', amount: 10 });
  const history = getTransactionHistory(store, 'a');
  assert.equal(history.length, 1);
  assert.equal(history[0].fromUserId, 'a');
});
