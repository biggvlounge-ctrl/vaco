// V3 — atomic multi-leg settlement.
//
// **What these are actually protecting.** Every assertion about totals
// passes just as happily when a settlement is split back into separate
// transfers: the balances are identical either way. That is precisely
// why the defect `settle` exists for survived a green suite. So the
// tests below deliberately assert things arithmetic cannot see —
// **how many rows were written**, and **whether anything was written
// at all** when a later leg is refused.
//
// The failure being prevented, concretely: VOID's `settleJob` paid the
// provider and then the platform in two consecutive awaits. When the
// second one failed, the first had already moved money, the job's
// settlement fields were never set, and `completeBooking`'s retry
// guard (`status !== 'confirmed'`) still passed — so a retry paid the
// provider a second time.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { STARTING_VCOIN_BALANCE, getBalance, settle } = require('../lib/vcoin');

const legs = (...specs) => specs.map(([fromUserId, toUserId, amount, reason]) => ({
  fromUserId, toUserId, amount, reason,
}));

test('a settlement moves every leg', () => {
  const store = createV3Store();
  const result = settle(store, {
    legs: legs(
      ['buyer', 'provider', 80, 'payout'],
      ['buyer', 'platform', 20, 'fee'],
    ),
    reason: 'void_petcare:1',
  });

  assert.equal(getBalance(store, 'buyer'), STARTING_VCOIN_BALANCE - 100);
  assert.equal(getBalance(store, 'provider'), STARTING_VCOIN_BALANCE + 80);
  assert.equal(getBalance(store, 'platform'), STARTING_VCOIN_BALANCE + 20);
  assert.equal(result.transactions.length, 2);
});

test('every leg of one settlement shares a settlementId', () => {
  // The ledger must still be readable as separate transfers — the
  // provider's earnings and the platform's fee stay independently
  // auditable, which is why these are not netted — AND readable as one
  // event. Both, not either.
  const store = createV3Store();
  const { settlementId } = settle(store, {
    legs: legs(['buyer', 'provider', 80], ['buyer', 'platform', 20]),
    reason: 'void_petcare:1',
  });

  const rows = store.transactions;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.settlementId === settlementId));
  assert.ok(rows.every((r) => r.settlementReason === 'void_petcare:1'));
  // Separately auditable: each row still names its own two parties.
  assert.deepEqual(rows.map((r) => r.toUserId), ['provider', 'platform']);
});

test('two settlements get different ids', () => {
  const store = createV3Store();
  const a = settle(store, { legs: legs(['buyer', 'provider', 10]) });
  const b = settle(store, { legs: legs(['buyer', 'provider', 10]) });
  assert.notEqual(a.settlementId, b.settlementId);
});

// -- the atomicity itself ------------------------------------------------

test('a refused leg leaves NOTHING applied', () => {
  // **The one that matters.** Leg 1 is affordable; leg 2 is not. The
  // old shape paid leg 1 and then threw. Every balance must be
  // untouched, and the ledger must have no new rows — a partial
  // settlement that recorded one row would be indistinguishable from a
  // legitimate single transfer later.
  const store = createV3Store();

  assert.throws(
    () => settle(store, {
      legs: legs(
        ['buyer', 'provider', 900],
        ['buyer', 'platform', 900],
      ),
      reason: 'void_petcare:1',
    }),
    /Insufficient VCoin balance\. Nothing in this settlement was applied\./,
  );

  assert.equal(store.vcoinBalances.provider, undefined,
    'the provider was paid by a settlement that was refused');
  assert.equal(store.transactions.length, 0,
    'a refused settlement wrote a ledger row');
});

test('legs are checked against running balances, not the opening one', () => {
  // Two legs of 600 from an account holding 1000 are each individually
  // affordable and jointly are not. Validating each against the
  // opening balance would admit the overdraft — which is the bug this
  // check exists to refuse, not a hypothetical.
  const store = createV3Store();
  assert.equal(getBalance(store, 'buyer'), 1000);

  assert.throws(
    () => settle(store, { legs: legs(['buyer', 'a', 600], ['buyer', 'b', 600]) }),
    /legs\[1\]: Insufficient VCoin balance/,
  );

  assert.equal(store.vcoinBalances.buyer, 1000, 'the payer was debited by a refused settlement');
  assert.equal(store.transactions.length, 0);
});

test('a NaN amount anywhere in the set refuses the whole settlement', () => {
  // `transfer`'s own header explains why this is not a formality: NaN
  // passes `typeof amount === 'number'` and every `<` comparison, and
  // once a balance is NaN there is no reversal endpoint to undo it.
  const store = createV3Store();

  assert.throws(
    () => settle(store, { legs: legs(['buyer', 'provider', 80], ['buyer', 'platform', NaN]) }),
    /legs\[1\]: 'amount' must be a positive number\./,
  );

  assert.equal(store.vcoinBalances.provider, undefined);
  assert.equal(store.transactions.length, 0);
});

test('an empty or missing legs array is refused, not treated as success', () => {
  // A settlement of nothing returning ok is how a caller ends up
  // marking a job paid that no money moved for.
  const store = createV3Store();
  assert.throws(() => settle(store, { legs: [] }), /non-empty array/);
  assert.throws(() => settle(store, {}), /non-empty array/);
  assert.equal(store.transactions.length, 0);
});

test('a leg missing a party is refused before anything moves', () => {
  const store = createV3Store();
  assert.throws(
    () => settle(store, { legs: legs(['buyer', 'provider', 80], [null, 'platform', 20]) }),
    /legs\[1\]: 'fromUserId' and 'toUserId' are required\./,
  );
  assert.equal(store.transactions.length, 0);
});

// -- the ledger stays explainable ---------------------------------------

test('a settlement keeps the ledger reconcilable', () => {
  // `reconcile` is the whole-ledger audit a banking partner asks for:
  // does the transaction history explain every balance? A settlement
  // that wrote balances without matching rows would pass every test
  // above and fail this one.
  const { reconcile } = require('../lib/vcoin');
  const store = createV3Store();

  settle(store, { legs: legs(['buyer', 'provider', 80], ['buyer', 'platform', 20]) });
  settle(store, { legs: legs(['provider', 'buyer', 5]) });

  const audit = reconcile(store);
  assert.equal(audit.balanced, true, `ledger does not reconcile: ${JSON.stringify(audit.discrepancies)}`);
});

test('a settlement counter that never initialised does not produce NaN ids', () => {
  // A store persisted before `nextSettlementId` existed shallow-merges
  // back without it. `undefined + 1` is NaN, and every settlement from
  // then on would share the same unusable id.
  const store = createV3Store();
  delete store.nextSettlementId;

  const { settlementId } = settle(store, { legs: legs(['buyer', 'provider', 10]) });
  assert.equal(Number.isFinite(settlementId), true);
  assert.equal(Number.isFinite(settle(store, { legs: legs(['buyer', 'provider', 10]) }).settlementId), true);
});
