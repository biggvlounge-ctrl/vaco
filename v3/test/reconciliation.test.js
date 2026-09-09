// V3 — does the ledger explain the balances?
//
// **A regression suite for a real bug, found by running the code rather
// than reading it.**
//
// `store.vcoinBalances` was authoritative and `store.transactions` was
// written alongside it, and nothing forced the two to agree. They did
// not: `vash.cashout()` moved VCoin out of an account and pushed no
// entry at all. Only `vcoin.transfer()` ever wrote to the ledger.
//
// So a user could cash out 500 VCoin and
// `GET /api/vcoin/transactions/:userId` would show nothing — the money
// left the balance with no record it had moved. Reproduced at exactly
// 500 drift before the fix.
//
// This is the same shape as the property-value rule elsewhere in this
// codebase — a stored number drifting from the inputs that should
// derive it — except that here the stored number is money, and the
// first question any banking partner or BaaS underwriter asks is
// whether the history explains the balances.
//
// Balances are deliberately NOT converted to derived-on-read. Dozens of
// shipped tests across this ecosystem assert against the existing
// contract. What changed is that drift is now detectable, and the one
// operation that created it no longer does.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const vcoin = require('../lib/vcoin.js');
const vash = require('../lib/vash.js');

function freshStore(balances = {}) {
  return {
    vcoinBalances: { ...balances },
    vashBalances: {},
    transactions: [],
    nextTransactionId: 1,
  };
}

// ---------------------------------------------------------------------------
// The bug itself
// ---------------------------------------------------------------------------

test('a cashout writes a ledger entry — it used to write none', () => {
  const store = freshStore({ alice: 1000 });

  vash.cashout(store, { userId: 'alice', vcoinAmount: 500 });

  assert.equal(store.transactions.length, 1, 'the cashout is in the ledger');
  const entry = store.transactions[0];
  assert.equal(entry.type, 'cashout');
  assert.equal(entry.fromUserId, 'alice');
  assert.equal(entry.amount, 500);
  assert.equal(entry.vashCredited, 5);
});

test('the cashout appears in the account holder\'s own transaction history', () => {
  // The user-visible symptom: money gone from the balance, nothing on
  // the statement. This is the assertion that names it.
  const store = freshStore({ alice: 1000 });

  vash.cashout(store, { userId: 'alice', vcoinAmount: 500 });

  const history = vcoin.getTransactionHistory(store, 'alice');
  assert.equal(history.length, 1);
  assert.equal(history[0].type, 'cashout');
});

test('a cashout has no counterparty, and the entry says so rather than inventing one', () => {
  const store = freshStore({ alice: 1000 });
  vash.cashout(store, { userId: 'alice', vcoinAmount: 100 });

  assert.equal(store.transactions[0].toUserId, null,
    'VCoin is destroyed and VASH credited — there is no house account, and none is faked');
});

// ---------------------------------------------------------------------------
// reconcile()
// ---------------------------------------------------------------------------

test('a ledger with only transfers balances', () => {
  const store = freshStore({ alice: 1000, bob: 1000 });
  vcoin.transfer(store, { fromUserId: 'alice', toUserId: 'bob', amount: 250 });

  const report = vcoin.reconcile(store);
  assert.equal(report.balanced, true);
  assert.deepEqual(report.discrepancies, []);
  assert.equal(report.accounts, 2);
  assert.equal(report.entries, 1);
});

test('a transfer and a cashout together still balance', () => {
  // The exact sequence that produced 500 of silent drift.
  const store = freshStore({ alice: 1000 });
  vcoin.transfer(store, { fromUserId: 'alice', toUserId: 'bob', amount: 100 });
  vash.cashout(store, { userId: 'alice', vcoinAmount: 500 });

  const report = vcoin.reconcile(store);
  assert.equal(report.balanced, true, `expected no drift, got ${JSON.stringify(report.discrepancies)}`);
  assert.equal(store.vcoinBalances.alice, 400);
});

test('reconcile catches a balance that the history cannot account for', () => {
  // The check has to be able to FAIL, or it is decoration. This writes
  // the balance directly, which is exactly what the old cashout did.
  const store = freshStore({ alice: 1000 });
  store.vcoinBalances.alice = 400; // 600 gone, no entry

  const report = vcoin.reconcile(store);
  assert.equal(report.balanced, false);
  assert.equal(report.discrepancies.length, 1);
  assert.deepEqual(report.discrepancies[0], {
    userId: 'alice', expected: 1000, actual: 400, drift: -600,
  });
});

test('reconcile catches money that appeared from nowhere, not just money that vanished', () => {
  const store = freshStore({ alice: 1000 });
  store.vcoinBalances.alice = 5000;

  const report = vcoin.reconcile(store);
  assert.equal(report.balanced, false);
  assert.equal(report.discrepancies[0].drift, 4000, 'a credit with no entry is as wrong as a debit with no entry');
});

test('the opening auto-grant is treated as the opening balance, not as drift', () => {
  // An account auto-grants STARTING_VCOIN_BALANCE on first touch and
  // that grant is not a transaction. If reconcile did not know this,
  // every untouched account would report as 1000 out.
  const store = freshStore({});
  vcoin.getBalance(store, 'newcomer');

  const report = vcoin.reconcile(store);
  assert.equal(report.balanced, true);
  assert.equal(store.vcoinBalances.newcomer, vcoin.STARTING_VCOIN_BALANCE);
});

test('an account that only ever received money reconciles', () => {
  const store = freshStore({ alice: 1000 });
  vcoin.transfer(store, { fromUserId: 'alice', toUserId: 'bob', amount: 300 });

  const report = vcoin.reconcile(store);
  assert.equal(report.balanced, true);
  assert.equal(store.vcoinBalances.bob, 1300, 'opening 1000 plus 300 received');
});

test('reconcile reports every drifting account, not just the first', () => {
  const store = freshStore({ alice: 1000, bob: 1000, carol: 1000 });
  store.vcoinBalances.alice = 900;
  store.vcoinBalances.carol = 1100;

  const report = vcoin.reconcile(store);
  assert.equal(report.discrepancies.length, 2);
  assert.deepEqual(report.discrepancies.map((d) => d.userId).sort(), ['alice', 'carol']);
});

test('an empty ledger is balanced rather than an error', () => {
  const report = vcoin.reconcile(freshStore());
  assert.equal(report.balanced, true);
  assert.equal(report.accounts, 0);
  assert.equal(report.entries, 0);
});

// ---------------------------------------------------------------------------
// The existing contract is unchanged
// ---------------------------------------------------------------------------

test('transfers still carry the fields every consumer already reads', () => {
  // `type` was added to transfer entries alongside cashout recording.
  // Additive only: dozens of shipped tests across this ecosystem read
  // fromUserId/toUserId/amount and must be untouched.
  const store = freshStore({ alice: 1000 });
  const result = vcoin.transfer(store, {
    fromUserId: 'alice', toUserId: 'bob', amount: 50, reason: 'test',
  });

  const entry = store.transactions[0];
  assert.equal(entry.fromUserId, 'alice');
  assert.equal(entry.toUserId, 'bob');
  assert.equal(entry.amount, 50);
  assert.equal(entry.reason, 'test');
  assert.equal(typeof entry.timestamp, 'number');
  assert.equal(entry.type, 'transfer');
  assert.equal(result.fromBalance, 950);
});

test('the cashout return shape is unchanged', () => {
  const store = freshStore({ alice: 1000 });
  const result = vash.cashout(store, { userId: 'alice', vcoinAmount: 200 });

  assert.equal(result.userId, 'alice');
  assert.equal(result.vcoinDeducted, 200);
  assert.equal(result.vashCredited, 2);
  assert.equal(result.rate, vash.VCOIN_TO_VASH_RATE);
  assert.equal(result.newVcoinBalance, 800);
  assert.equal(result.newVashBalance, 2);
});

test('a refused cashout writes no ledger entry', () => {
  // Alice is brought down to 10 by a real transfer rather than by
  // seeding the balance at 10. Writing the balance directly IS drift by
  // reconcile's own definition, and the first version of this test did
  // exactly that and failed — the fixture was wrong, not the check.
  const store = freshStore({ alice: 1000 });
  vcoin.transfer(store, { fromUserId: 'alice', toUserId: 'bob', amount: 990 });
  assert.equal(vcoin.getBalance(store, 'alice'), 10);

  assert.throws(() => vash.cashout(store, { userId: 'alice', vcoinAmount: 500 }), /Insufficient/);
  assert.equal(store.transactions.length, 1, 'the transfer, and nothing for the refused cashout');
  assert.equal(vcoin.reconcile(store).balanced, true);
});
