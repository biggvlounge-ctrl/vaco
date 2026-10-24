// V3 -- every real transaction record (transfer, settle, cashout) now
// carries a real, tamper-evident `integrityHash` through the
// crypto-agility layer (lib/cryptoAgility.js) that existed but was
// wired into nothing before this. Verifies the hash is real -- it
// recomputes to the same value over the transaction's own real
// fields, and a tampered field recomputes to a different one.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { transfer, settle } = require('../lib/vcoin');
const { cashout } = require('../lib/vash');
const { hashPayload } = require('../lib/cryptoAgility');

test('transfer attaches a real integrityHash that recomputes over its own fields', () => {
  const store = createV3Store();
  const { transaction } = transfer(store, { fromUserId: 'ada', toUserId: 'bea', amount: 50 });

  assert.ok(transaction.integrityHash);
  const recomputed = hashPayload({
    id: transaction.id, fromUserId: transaction.fromUserId, toUserId: transaction.toUserId,
    amount: transaction.amount, reason: transaction.reason, timestamp: transaction.timestamp, type: transaction.type,
  }).hash;
  assert.equal(transaction.integrityHash, recomputed);

  // A tampered field -- the real point of a tamper-evident hash -- no
  // longer recomputes to the stored value.
  const tamperedHash = hashPayload({
    id: transaction.id, fromUserId: transaction.fromUserId, toUserId: transaction.toUserId,
    amount: 999999, reason: transaction.reason, timestamp: transaction.timestamp, type: transaction.type,
  }).hash;
  assert.notEqual(transaction.integrityHash, tamperedHash);
});

test('settle attaches a real integrityHash to every leg, including the settlement grouping', () => {
  const store = createV3Store();
  const result = settle(store, {
    legs: [
      { fromUserId: 'payer', toUserId: 'provider', amount: 80 },
      { fromUserId: 'payer', toUserId: 'platform', amount: 20 },
    ],
    reason: 'job payout',
  });

  for (const transaction of result.transactions) {
    assert.ok(transaction.integrityHash);
    const recomputed = hashPayload({
      id: transaction.id, fromUserId: transaction.fromUserId, toUserId: transaction.toUserId,
      amount: transaction.amount, reason: transaction.reason, timestamp: transaction.timestamp, type: transaction.type,
      settlementId: transaction.settlementId, settlementReason: transaction.settlementReason,
    }).hash;
    assert.equal(transaction.integrityHash, recomputed);
  }
  // Two real legs, two distinct real hashes -- not one hash reused.
  assert.notEqual(result.transactions[0].integrityHash, result.transactions[1].integrityHash);
});

test('a VASH cashout -- the one operation touching both ledgers -- gets the same real hash treatment', () => {
  const store = createV3Store();
  transfer(store, { fromUserId: 'house', toUserId: 'ada', amount: 500 });
  const result = cashout(store, { userId: 'ada', vcoinAmount: 200 });

  const record = store.transactions.find((t) => t.type === 'cashout');
  assert.ok(record);
  assert.equal(record.integrityHash, hashPayload({
    id: record.id, fromUserId: record.fromUserId, toUserId: record.toUserId, amount: record.amount,
    reason: record.reason, timestamp: record.timestamp, type: record.type,
    vashCredited: record.vashCredited, rate: record.rate,
  }).hash);
  assert.equal(result.vashCredited, record.vashCredited);
});
