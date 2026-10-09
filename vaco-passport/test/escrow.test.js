// VACO Business Network — Escrow (Level 3) core logic.
//
// `settleFn` is a fake exactly the way production injects the real
// `settleVCoin` (see server.js) — these tests never touch the
// network, and assert: the Level-3 gate (§30's own finding, "escrow
// is a Level 3 capability"), real money movement through the one
// injected settlement function, `settleOnce`'s claim-before-pay
// protection against a double release/refund, and that ESCROW_ACCOUNT
// is an ordinary V3 userId rather than a second ledger.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createPassportStore, registerPassport, verifyPassport, assessNetworkActivity } = require('../lib/passport');
const {
  ESCROW_ACCOUNT, HOLD_STATUSES, findEscrowHold, escrowHoldsForBusiness,
  requireNetworkLevelBusiness, openEscrowHold, releaseEscrowHold, refundEscrowHold, reseedIds,
} = require('../lib/escrow');

const HUNT_ID = 9001;
const fakeBusinessFetchFn = async (businessId) => (
  businessId === HUNT_ID ? { id: HUNT_ID, name: 'HUNT Barber Shop', ownerId: 'owner-hunt-barber-shop' } : null
);
const fakeVerifiedIdentityFetchFn = async (subjectType, subjectId) => ({ subjectType, subjectId, verified: true });

async function networkLevelStore() {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });
  await assessNetworkActivity(store, {
    businessId: HUNT_ID,
    transactionsFetchFn: async () => [{ id: 1, amount: 40, timestamp: 1000 }],
  });
  return store;
}

function fakeLedger() {
  const legsSeen = [];
  const settleFn = async (legs) => {
    legsSeen.push(...legs);
    return { ok: true };
  };
  return { settleFn, legsSeen };
}

// -- the Level 3 gate -----------------------------------------------------

test('requireNetworkLevelBusiness refuses a business with no Passport at all', () => {
  const store = createPassportStore();
  assert.throws(() => requireNetworkLevelBusiness(store, HUNT_ID), /has no Passport at all/);
});

test('requireNetworkLevelBusiness refuses a business stuck at member or verified', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  assert.throws(() => requireNetworkLevelBusiness(store, HUNT_ID), /not "network"/);

  await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });
  assert.throws(() => requireNetworkLevelBusiness(store, HUNT_ID), /not "network"/);
});

test('openEscrowHold refuses a business below Level 3, before any money moves', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const { settleFn, legsSeen } = fakeLedger();

  await assert.rejects(
    openEscrowHold(store, { businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn }),
    /escrow is a Level 3 capability/,
  );
  assert.strictEqual(legsSeen.length, 0, 'a refused open must never touch the ledger');
  assert.strictEqual(store.escrowHolds.length, 0);
});

// -- openEscrowHold ---------------------------------------------------------

test('openEscrowHold charges the payer into ESCROW_ACCOUNT and records a held hold', async () => {
  const store = await networkLevelStore();
  const { settleFn, legsSeen } = fakeLedger();

  const hold = await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn,
  });

  assert.strictEqual(hold.status, 'held');
  assert.strictEqual(hold.amount, 50);
  assert.strictEqual(legsSeen.length, 1);
  assert.deepStrictEqual(legsSeen[0], {
    fromUserId: 'alice', toUserId: ESCROW_ACCOUNT, amount: 50, reason: legsSeen[0].reason,
  });
  assert.strictEqual(findEscrowHold(store, hold.id), hold);
  assert.deepStrictEqual(escrowHoldsForBusiness(store, HUNT_ID), [hold]);
});

test('openEscrowHold rejects a non-positive amount without touching the ledger', async () => {
  const store = await networkLevelStore();
  const { settleFn, legsSeen } = fakeLedger();
  await assert.rejects(
    openEscrowHold(store, { businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 0, settleFn }),
    /positive amount/,
  );
  assert.strictEqual(legsSeen.length, 0);
});

// -- releaseEscrowHold / refundEscrowHold -----------------------------------

test('releaseEscrowHold pays the payee from ESCROW_ACCOUNT and settles the hold', async () => {
  const store = await networkLevelStore();
  const { settleFn, legsSeen } = fakeLedger();
  const hold = await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn,
  });

  const released = await releaseEscrowHold(store, { holdId: hold.id, settleFn });
  assert.strictEqual(released.status, 'released');
  assert.ok(released.settledAt);
  assert.strictEqual(legsSeen.length, 2, 'open + release');
  assert.deepStrictEqual(legsSeen[1], {
    fromUserId: ESCROW_ACCOUNT, toUserId: 'owner-hunt-barber-shop', amount: 50, reason: legsSeen[1].reason,
  });
});

test('refundEscrowHold pays the payer back from ESCROW_ACCOUNT and settles the hold', async () => {
  const store = await networkLevelStore();
  const { settleFn, legsSeen } = fakeLedger();
  const hold = await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn,
  });

  const refunded = await refundEscrowHold(store, { holdId: hold.id, settleFn });
  assert.strictEqual(refunded.status, 'refunded');
  assert.deepStrictEqual(legsSeen[1], {
    fromUserId: ESCROW_ACCOUNT, toUserId: 'alice', amount: 50, reason: legsSeen[1].reason,
  });
});

test('releaseEscrowHold refuses a hold that is not held', async () => {
  const store = await networkLevelStore();
  const { settleFn } = fakeLedger();
  const hold = await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn,
  });
  await releaseEscrowHold(store, { holdId: hold.id, settleFn });
  await assert.rejects(releaseEscrowHold(store, { holdId: hold.id, settleFn }), /is not held/);
});

// -- settleOnce double-release/refund protection ----------------------------

test('a release that races a refund can only pay out once — settleOnce claims the status before either payment runs', async () => {
  const store = await networkLevelStore();
  const legsSeen = [];
  let releaseStarted = false;
  let refundAllowedToProceed;
  const refundGate = new Promise((resolve) => { refundAllowedToProceed = resolve; });

  // A settleFn that stalls the FIRST payment (release) until the second
  // call (refund) has already attempted its own claim -- reproducing the
  // exact window settleOnce.js's own header describes: the race is only
  // visible when both callers are mid-flight at once.
  const settleFn = async (legs) => {
    legsSeen.push(...legs);
    if (legs[0].reason.includes('release') && !releaseStarted) {
      releaseStarted = true;
      await refundGate;
    }
    return { ok: true };
  };

  const hold = await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn,
  });

  const releasePromise = releaseEscrowHold(store, { holdId: hold.id, settleFn });
  // Give the release's settleFn a tick to run and hit the gate.
  await new Promise((resolve) => { setImmediate(resolve); });

  await assert.rejects(
    refundEscrowHold(store, { holdId: hold.id, settleFn }),
    /is not held/,
    'the claim (status: released) must already be visible to the concurrent refund, before its own payment ever runs',
  );
  refundAllowedToProceed();
  await releasePromise;

  assert.strictEqual(hold.status, 'released');
  const payoutLegs = legsSeen.filter((leg) => leg.fromUserId === ESCROW_ACCOUNT);
  assert.strictEqual(payoutLegs.length, 1, 'only one of release/refund may ever pay out of escrow');
});

test('a failed release restores the held status so a retry is possible', async () => {
  const store = await networkLevelStore();
  const { settleFn: openFn } = fakeLedger();
  const hold = await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn: openFn,
  });

  const failingSettleFn = async () => { throw new Error('V3 unreachable'); };
  await assert.rejects(releaseEscrowHold(store, { holdId: hold.id, settleFn: failingSettleFn }), /V3 unreachable/);
  assert.strictEqual(hold.status, 'held', 'a failed payment must not leave the hold stuck released with no money moved');

  const { settleFn: retrySettleFn, legsSeen } = fakeLedger();
  const released = await releaseEscrowHold(store, { holdId: hold.id, settleFn: retrySettleFn });
  assert.strictEqual(released.status, 'released');
  assert.strictEqual(legsSeen.length, 1);
});

// -- not a second ledger ------------------------------------------------------

test('ESCROW_ACCOUNT is an ordinary V3 userId string, not a special object', () => {
  assert.strictEqual(typeof ESCROW_ACCOUNT, 'string');
});

test('HOLD_STATUSES names exactly the three real states', () => {
  assert.deepStrictEqual(HOLD_STATUSES, ['held', 'released', 'refunded']);
});

// -- reseedIds ------------------------------------------------------------------

test('reseedIds picks up after the highest existing hold id, not the array length', async () => {
  const store = await networkLevelStore();
  const { settleFn } = fakeLedger();
  await openEscrowHold(store, {
    businessId: HUNT_ID, payerId: 'alice', payeeId: 'owner-hunt-barber-shop', amount: 50, settleFn,
  });
  store.escrowHolds = [];
  const seeded = reseedIds(store);
  assert.strictEqual(seeded.nextEscrowHoldId, 1, 'an empty escrowHolds array must reseed to 1, not stay stuck');
});
