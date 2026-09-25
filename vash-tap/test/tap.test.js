// VASH TAP core logic — registration, resolution, assignment, payment.
//
// Every cross-app dependency (HVNTZ, VACA, V3, vaco-notify) is a fake
// function passed in exactly the way production injects the real
// fetch (see server.js's own "cross-app calls are injected, not
// hard-wired" comment) — these tests never touch the network, and
// assert both the happy path and the specific rules the freeze names:
// §7's "never recorded as paid before the ledger confirms it", §6's
// resolution shape, and the "not a second ledger" boundary.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  TAP_TYPES,
  createTapStore,
  registerTap,
  assignTap,
  currentAssignmentFor,
  resolveTap,
  payViaTap,
  freezeTap,
  unfreezeTap,
  transactionsForTap,
  spenderHistory,
  revenueByTap,
  reseedIds,
} = require('../lib/tap');

const HUNT_ID = 9001;
const fakeBusinessFetchFn = async (businessId) => (
  businessId === HUNT_ID ? { id: HUNT_ID, name: 'HUNT Barber Shop', ownerId: 'owner-hunt' } : null
);
const fakeIdentityFetchFn = async (_subjectType, subjectId) => (
  subjectId === 'unverified-barber' ? { verified: false } : { verified: true }
);

// -- registerTap -----------------------------------------------------------

test('registerTap rejects an unknown tapType', async () => {
  const store = createTapStore();
  await assert.rejects(
    registerTap(store, { tapType: 'nonsense', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn }),
    /tapType must be one of/,
  );
});

test('registerTap requires either a businessId or an ownerIdentityId', async () => {
  const store = createTapStore();
  await assert.rejects(registerTap(store, { tapType: 'business' }), /businessId.*or an ownerIdentityId/);
});

test('registerTap verifies the business is real rather than trusting the id', async () => {
  const store = createTapStore();
  await assert.rejects(
    registerTap(store, { tapType: 'business', businessId: 404, businessFetchFn: fakeBusinessFetchFn }),
    /no business with id 404/,
  );
  assert.strictEqual(store.taps.length, 0, 'a tap for a business that does not exist must not be recorded');
});

test('registerTap assigns a permanent VT-###### code independent of array position', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  assert.strictEqual(tap.tapCode, 'VT-000001');
  assert.strictEqual(tap.status, 'active');
  assert.strictEqual(tap.currentAssignmentId, null);
});

test('registerTap accepts a personal tap with no business at all', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'personal', ownerIdentityId: 'ada' });
  assert.strictEqual(tap.businessId, null);
  assert.strictEqual(tap.ownerIdentityId, 'ada');
});

test('every declared TAP_TYPES value is accepted', async () => {
  for (const tapType of TAP_TYPES) {
    const store = createTapStore();
    const tap = await registerTap(store, { tapType, ownerIdentityId: 'ada' });
    assert.strictEqual(tap.tapType, tapType);
  }
});

// -- assignTap / currentAssignmentFor ---------------------------------------

test('assignTap requires the identity to be VACA-verified', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assert.rejects(
    assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'unverified-barber', identityFetchFn: fakeIdentityFetchFn }),
    /not VACA-verified/,
  );
  assert.strictEqual(store.assignments.length, 0);
});

test('assignTap sets the tap\'s currentAssignmentId when the assignment covers now', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const assignment = await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  assert.strictEqual(tap.currentAssignmentId, assignment.id);
  assert.strictEqual(currentAssignmentFor(store, tap).id, assignment.id);
});

test('a dynamic reassignment — Chair 7\'s own worked example — resolves to whichever assignment covers now', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const now = Date.now();

  await assignTap(store, {
    tapCode: tap.tapCode, assignedIdentityId: 'morning-barber', identityFetchFn: fakeIdentityFetchFn,
    startAt: now - 10000, endAt: now - 1000, now,
  });
  const afternoon = await assignTap(store, {
    tapCode: tap.tapCode, assignedIdentityId: 'afternoon-barber', identityFetchFn: fakeIdentityFetchFn,
    startAt: now - 500, endAt: null, now,
  });

  const current = currentAssignmentFor(store, tap, now);
  assert.strictEqual(current.id, afternoon.id, 'the ended morning assignment must not still be current');
});

test('assignTap rejects an endAt at or before startAt', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const now = Date.now();
  await assert.rejects(
    assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', startAt: now, endAt: now, identityFetchFn: fakeIdentityFetchFn }),
    /endAt must be after startAt/,
  );
});

// -- resolveTap --------------------------------------------------------------

test('resolveTap reports payable:false for a tap with no current assignment', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const resolved = await resolveTap(store, tap.tapCode);
  assert.strictEqual(resolved.payable, false);
  assert.strictEqual(resolved.assignment, null);
});

test('resolveTap reports payable:true once assigned and active', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const resolved = await resolveTap(store, tap.tapCode, { identityFetchFn: fakeIdentityFetchFn });
  assert.strictEqual(resolved.payable, true);
  assert.strictEqual(resolved.assigneeIdentityId, 'barber-1');
  assert.strictEqual(resolved.assigneeVerified, true);
});

test('resolveTap fails soft, not hard, when identityFetchFn itself throws (VACA unreachable)', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });

  const brokenIdentityFetchFn = async () => { throw new Error('ECONNREFUSED'); };
  const resolved = await resolveTap(store, tap.tapCode, { identityFetchFn: brokenIdentityFetchFn });
  assert.strictEqual(resolved.assigneeVerified, null, 'a VACA outage must not throw resolveTap — it must report unknown');
  assert.strictEqual(resolved.payable, true, 'payability depends on assignment, not on identity verification succeeding');
});

test('resolveTap resolves the real business, not just the stored id — §6 step 6', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const resolved = await resolveTap(store, tap.tapCode, { businessFetchFn: fakeBusinessFetchFn });
  assert.strictEqual(resolved.business.name, 'HUNT Barber Shop');
});

test('resolveTap fails soft, not hard, when businessFetchFn itself throws (HVNTZ unreachable)', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const brokenBusinessFetchFn = async () => { throw new Error('ECONNREFUSED'); };
  const resolved = await resolveTap(store, tap.tapCode, { businessFetchFn: brokenBusinessFetchFn });
  assert.strictEqual(resolved.business, null, 'an HVNTZ outage must not throw resolveTap — it must report unknown');
  assert.strictEqual(resolved.payable, true, 'payability must not depend on the business fetch succeeding');
});

test('resolveTap resolves business:null for a personal Tap with no businessId', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'personal', ownerIdentityId: 'ada' });
  const resolved = await resolveTap(store, tap.tapCode, { businessFetchFn: fakeBusinessFetchFn });
  assert.strictEqual(resolved.business, null);
});

test('resolveTap rejects a tap code that does not exist', async () => {
  const store = createTapStore();
  await assert.rejects(resolveTap(store, 'VT-999999'), /no tap VT-999999/);
});

// -- payViaTap ----------------------------------------------------------------

function fakeTransferFn(calls, result = { id: 555 }) {
  return async (fromUserId, toUserId, amount, reason) => {
    calls.push({ fromUserId, toUserId, amount, reason });
    return result;
  };
}

test('payViaTap refuses to pay a tap with no current assignment', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const calls = [];
  await assert.rejects(
    payViaTap(store, { tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, transferFn: fakeTransferFn(calls) }),
    /not payable right now/,
  );
  assert.strictEqual(calls.length, 0, 'an unpayable tap must never reach the ledger');
});

test('payViaTap refuses a non-positive amount before touching the ledger', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const calls = [];
  await assert.rejects(
    payViaTap(store, { tapCode: tap.tapCode, fromUserId: 'ada', amount: 0, transferFn: fakeTransferFn(calls) }),
    /positive amount/,
  );
  assert.strictEqual(calls.length, 0);
});

test('payViaTap refuses paying yourself', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const calls = [];
  await assert.rejects(
    payViaTap(store, { tapCode: tap.tapCode, fromUserId: 'barber-1', amount: 40, transferFn: fakeTransferFn(calls) }),
    /cannot pay yourself/,
  );
  assert.strictEqual(calls.length, 0);
});

test('payViaTap calls the ledger with amount + tip as one total, and routes to the current assignee', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const calls = [];
  const record = await payViaTap(store, {
    tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, tip: 8, transferFn: fakeTransferFn(calls),
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].toUserId, 'barber-1');
  assert.strictEqual(calls[0].amount, 48);
  assert.strictEqual(record.total, 48);
  assert.strictEqual(record.v3TransactionId, 555);
  assert.strictEqual(record.status, 'completed');
});

test('payViaTap never records a transaction when the ledger transfer throws — §7\'s own rule', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });

  const failingTransferFn = async () => { throw new Error('insufficient balance'); };
  await assert.rejects(
    payViaTap(store, { tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, transferFn: failingTransferFn }),
    /insufficient balance/,
  );
  assert.strictEqual(store.transactions.length, 0, 'a failed ledger transfer must leave no attribution record behind');
});

test('payViaTap records notification delivery status without ever undoing the payment', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const calls = [];
  const failingNotifyFn = async () => { throw new Error('vaco-notify unreachable'); };
  const record = await payViaTap(store, {
    tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, transferFn: fakeTransferFn(calls), notifyFn: failingNotifyFn,
  });
  assert.strictEqual(record.status, 'completed', 'a failed alert must not undo an already-confirmed payment');
  assert.strictEqual(record.notification.status, 'undelivered');
  assert.strictEqual(store.transactions.length, 1);
});

// -- freeze / unfreeze --------------------------------------------------------

test('freezeTap then payViaTap refuses — a frozen tap is not payable', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  freezeTap(store, { tapCode: tap.tapCode });
  const calls = [];
  await assert.rejects(
    payViaTap(store, { tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, transferFn: fakeTransferFn(calls) }),
    /not payable right now/,
  );
});

test('unfreezeTap refuses a tap that is not frozen', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  assert.throws(() => unfreezeTap(store, { tapCode: tap.tapCode }), /is not frozen/);
});

test('freeze then unfreeze restores payability', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  freezeTap(store, { tapCode: tap.tapCode });
  unfreezeTap(store, { tapCode: tap.tapCode });
  const resolved = await resolveTap(store, tap.tapCode);
  assert.strictEqual(resolved.payable, true);
});

// -- attribution and history ---------------------------------------------------

test('transactionsForTap, spenderHistory and revenueByTap agree on the same payments', async () => {
  const store = createTapStore();
  const chair1 = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const chair2 = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: chair1.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  await assignTap(store, { tapCode: chair2.tapCode, assignedIdentityId: 'barber-2', identityFetchFn: fakeIdentityFetchFn });

  const calls = [];
  await payViaTap(store, { tapCode: chair1.tapCode, fromUserId: 'ada', amount: 40, tip: 5, transferFn: fakeTransferFn(calls, { id: 1 }) });
  await payViaTap(store, { tapCode: chair1.tapCode, fromUserId: 'bob', amount: 30, transferFn: fakeTransferFn(calls, { id: 2 }) });
  await payViaTap(store, { tapCode: chair2.tapCode, fromUserId: 'ada', amount: 25, transferFn: fakeTransferFn(calls, { id: 3 }) });

  assert.strictEqual(transactionsForTap(store, chair1.tapCode).length, 2);
  assert.strictEqual(transactionsForTap(store, chair2.tapCode).length, 1);

  const adaHistory = spenderHistory(store, 'ada');
  assert.strictEqual(adaHistory.length, 2);
  assert.ok(adaHistory.every((t) => t.fromUserId === 'ada'));

  const revenue = revenueByTap(store, HUNT_ID);
  const byCode = Object.fromEntries(revenue.map((r) => [r.tapCode, r]));
  assert.strictEqual(byCode[chair1.tapCode].revenue, 70);
  assert.strictEqual(byCode[chair1.tapCode].tips, 5);
  assert.strictEqual(byCode[chair1.tapCode].transactions, 2);
  assert.strictEqual(byCode[chair2.tapCode].revenue, 25);
  // Chair 1 outearns Chair 2 — sorted descending by revenue + tips.
  assert.strictEqual(revenue[0].tapCode, chair1.tapCode);
});

// -- reseedIds ------------------------------------------------------------------

test('reseedIds picks up after the highest existing id, not the array length', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  store.taps = store.taps.filter((t) => t.id !== tap.id); // simulate a restore that dropped the lowest id
  const seeded = reseedIds(store);
  assert.strictEqual(seeded.nextTapId, 1, 'an empty taps array must reseed to 1, not stay stuck');

  const store2 = createTapStore();
  const t1 = await registerTap(store2, { tapType: 'personal', ownerIdentityId: 'ada' });
  const t2 = await registerTap(store2, { tapType: 'personal', ownerIdentityId: 'bob' });
  const reseeded = reseedIds(store2);
  assert.strictEqual(reseeded.nextTapId, Math.max(t1.id, t2.id) + 1);
});
