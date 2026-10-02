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
  resolveTapRegistrationSubject,
  linkDreamsScreen,
  unlinkDreamsScreen,
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

test('registerTap normalizes a string businessId to the real number HVNTZ uses', async () => {
  // The gap an audit found: HVNTZ's own `GET /api/business/:id` route
  // coerces (`Number(req.params.id)`) — a real `fetchHvntzBusiness`
  // call succeeds whether the caller's businessId was a string or a
  // number, because it only ever travels as a URL segment. But nothing
  // coerced what got STORED on the tap, so a client that JSON-encoded
  // businessId as `"9001"` registered a real, payable tap that
  // `/api/business/:id/taps` and `revenueByTap` (both compare with
  // `Number(...) === tap.businessId`) then never found — an easy,
  // honest client mistake with no test covering it.
  //
  // `looseBusinessFetchFn` mimics HVNTZ's own real coercion rather than
  // `fakeBusinessFetchFn`'s strict one, so this test actually exercises
  // the gap instead of just failing the lookup outright.
  const looseBusinessFetchFn = async (businessId) => (
    Number(businessId) === HUNT_ID ? { id: HUNT_ID, name: 'HUNT Barber Shop', ownerId: 'owner-hunt' } : null
  );
  const store = createTapStore();
  const tap = await registerTap(store, {
    tapType: 'business', businessId: String(HUNT_ID), businessFetchFn: looseBusinessFetchFn,
  });
  assert.strictEqual(tap.businessId, HUNT_ID, 'stored businessId must be the real number, not the string a client sent');
  assert.strictEqual(typeof tap.businessId, 'number');
});

test('registerTap rejects a businessId that cannot be a real number', async () => {
  const store = createTapStore();
  await assert.rejects(
    registerTap(store, { tapType: 'business', businessId: 'not-a-number', businessFetchFn: fakeBusinessFetchFn }),
    /businessId must be a number/,
  );
});

test('every declared TAP_TYPES value is accepted', async () => {
  for (const tapType of TAP_TYPES) {
    const store = createTapStore();
    const tap = await registerTap(store, { tapType, ownerIdentityId: 'ada' });
    assert.strictEqual(tap.tapType, tapType);
  }
});

// -- resolveTapRegistrationSubject --------------------------------------------
//
// server.js's requireCrossAppBusinessOwner used to require a
// businessId unconditionally, so POST /api/taps refused every
// personal/wear/embed registration with a 400 before registerTap --
// which fully supports them, see the two tests above -- was ever
// reached. This is the pure decision the route guard now makes,
// tested without a live Shield session or a spawned server.

test('a body with a businessId is a business-tap subject', () => {
  const subject = resolveTapRegistrationSubject({ businessId: 9001, tapType: 'business' });
  assert.deepStrictEqual(subject, { kind: 'business', businessId: 9001 });
});

test('a body with no businessId but an ownerIdentityId is a personal-tap subject', () => {
  // The exact shape the route used to refuse outright.
  const subject = resolveTapRegistrationSubject({ ownerIdentityId: 'ada', tapType: 'personal' });
  assert.deepStrictEqual(subject, { kind: 'personal', ownerIdentityId: 'ada' });
});

test('wear and embed taps resolve the same way as personal — none of them carry a businessId', () => {
  for (const tapType of ['wear', 'embed']) {
    const subject = resolveTapRegistrationSubject({ ownerIdentityId: 'ada', tapType });
    assert.strictEqual(subject.kind, 'personal');
  }
});

test('a body with neither id is "missing", not silently business', () => {
  assert.deepStrictEqual(resolveTapRegistrationSubject({ tapType: 'business' }), { kind: 'missing' });
  assert.deepStrictEqual(resolveTapRegistrationSubject({}), { kind: 'missing' });
});

test('businessId wins when a body somehow carries both', () => {
  const subject = resolveTapRegistrationSubject({ businessId: 9001, ownerIdentityId: 'ada' });
  assert.strictEqual(subject.kind, 'business');
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

test('currentAssignmentFor self-corrects the Tap\'s own stale currentAssignmentId', async () => {
  // The gap an audit found: `currentAssignmentId` was written once, at
  // `assignTap` time, and never again — so once the clock moved past
  // `endAt`, the raw field `GET /api/taps/:tapCode` actually returns
  // stayed pointed at an assignment that had already ended, even though
  // `currentAssignmentFor` itself always resolved correctly.
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const now = Date.now();
  const morning = await assignTap(store, {
    tapCode: tap.tapCode, assignedIdentityId: 'morning-barber', identityFetchFn: fakeIdentityFetchFn,
    startAt: now, endAt: now + 1000, now,
  });
  assert.strictEqual(tap.currentAssignmentId, morning.id, 'the field should be set while the assignment is live');

  const afterItEnded = currentAssignmentFor(store, tap, now + 2000);
  assert.strictEqual(afterItEnded, null, 'the resolved value must reflect the clock moving past endAt');
  assert.strictEqual(tap.currentAssignmentId, null,
    'the stored field stayed pointed at an assignment that had already ended');
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

test('resolveTap reports payable:false when VACA has explicitly revoked the assignee', async () => {
  // The gap an audit found: `assigneeVerified` was computed and then
  // never read by `payable`. `null` (VACA unreachable) stays payable,
  // tested above — but `false` is VACA actually answering the question,
  // not an outage, and an assignee verified at assignment time who is
  // later flagged or revoked by VACA must not stay payable forever.
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  // `identityFetchFn: null` at assignment time — assignTap only checks
  // VACA when given a fetcher, and this assignment needs to exist
  // regardless of the (unverified) identity, to isolate resolveTap's
  // own read of a later, real `verified: false`.
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'unverified-barber' });
  const resolved = await resolveTap(store, tap.tapCode, { identityFetchFn: fakeIdentityFetchFn });
  assert.strictEqual(resolved.assigneeVerified, false);
  assert.strictEqual(resolved.payable, false,
    'a tap assigned to someone VACA has explicitly not verified read as payable');
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

test('payViaTap with the same idempotencyKey returns the same record and never touches the ledger twice', async () => {
  // The gap an audit found: even when a caller correctly reuses an
  // idempotency key (so the real ledger charges only once), this
  // function pushed a brand new local transaction row on every call —
  // so revenue and spender history double-counted a payment the
  // ledger itself knew had only happened once.
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const calls = [];
  const options = {
    tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, tip: 8,
    idempotencyKey: 'tap-retry-key-1', transferFn: fakeTransferFn(calls),
  };

  const first = await payViaTap(store, options);
  const second = await payViaTap(store, options);

  assert.strictEqual(calls.length, 1, 'a retried tap reached the ledger a second time');
  assert.strictEqual(second, first, 'a retry with the same key must return the SAME record, not a new one');
  assert.strictEqual(store.transactions.length, 1, 'a retry recorded a second local transaction');
});

test('payViaTap with no idempotencyKey charges again on every call — the exposure this leaves, by design', async () => {
  // Not a bug by itself — an idempotency key is opt-in at this layer,
  // the same posture V3's own ledger takes (see server.js's own
  // comment on why the HTTP route requires it instead). This pins
  // down what "opt-in" actually means: with no key at all, payViaTap
  // has nothing to deduplicate against and correctly charges every
  // time, which is exactly why the real HTTP route refuses to omit it.
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assignTap(store, { tapCode: tap.tapCode, assignedIdentityId: 'barber-1', identityFetchFn: fakeIdentityFetchFn });
  const calls = [];
  const options = { tapCode: tap.tapCode, fromUserId: 'ada', amount: 40, transferFn: fakeTransferFn(calls) };

  await payViaTap(store, options);
  await payViaTap(store, options);

  assert.strictEqual(calls.length, 2);
  assert.strictEqual(store.transactions.length, 2);
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

// -- DREAMS screen link ----------------------------------------------------

const fakeScreenFetchFn = async (screenId) => (
  screenId === 501 ? { id: 501, screenOwnerId: 'owner-hunt', locationName: 'HUNT Barber Shop', locationAddress: '1 Main St' } : null
);

test('linkDreamsScreen verifies the screen is real rather than trusting the id', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assert.rejects(
    linkDreamsScreen(store, { tapCode: tap.tapCode, dreamsScreenId: 404, screenFetchFn: fakeScreenFetchFn }),
    /no DREAMS screen with id 404/,
  );
  assert.strictEqual(tap.dreamsScreenId, null);
});

test('linkDreamsScreen refuses a non-business tap — a screen sits at a place, not on a wearable', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'personal', ownerIdentityId: 'ada' });
  await assert.rejects(
    linkDreamsScreen(store, { tapCode: tap.tapCode, dreamsScreenId: 501, screenFetchFn: fakeScreenFetchFn }),
    /only a business tap can carry a DREAMS screen/,
  );
});

test('linkDreamsScreen references the screen without duplicating it, and unlinkDreamsScreen clears it', async () => {
  const store = createTapStore();
  const tap = await registerTap(store, { tapType: 'business', businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const linked = await linkDreamsScreen(store, { tapCode: tap.tapCode, dreamsScreenId: 501, screenFetchFn: fakeScreenFetchFn });
  assert.strictEqual(linked.dreamsScreenId, 501);
  assert.strictEqual(Object.keys(linked).includes('locationName'), false, 'the Tap must not absorb the screen\'s own fields');

  const unlinked = unlinkDreamsScreen(store, { tapCode: tap.tapCode });
  assert.strictEqual(unlinked.dreamsScreenId, null);
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
