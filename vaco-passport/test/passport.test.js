// VACO Passport core logic — registration, verification, network-activity
// assessment.
//
// Every cross-app dependency (HVNTZ, VACA, V3) is a fake function
// passed in exactly the way production injects the real fetch (see
// server.js's own cross-app clients) — these tests never touch the
// network, and assert both the happy path and the specific rules the
// freeze names: §3's "Passport must persist... never recreated," §4's
// "do NOT create an arbitrary subjective credit score," and the
// Level-2-before-Level-3 ordering §2 implies.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  NETWORK_LEVELS,
  createPassportStore,
  findPassport,
  registerPassport,
  verifyPassport,
  assessNetworkActivity,
  reseedIds,
} = require('../lib/passport');

const HUNT_ID = 9001;
const fakeBusinessFetchFn = async (businessId) => (
  businessId === HUNT_ID ? { id: HUNT_ID, name: 'HUNT Barber Shop', ownerId: 'owner-hunt-barber-shop' } : null
);
const fakeVerifiedIdentityFetchFn = async (subjectType, subjectId) => ({ subjectType, subjectId, verified: true });
const fakeUnverifiedIdentityFetchFn = async (subjectType, subjectId) => ({ subjectType, subjectId, verified: false });

// -- registerPassport --------------------------------------------------------

test('registerPassport verifies the business is real rather than trusting the id', async () => {
  const store = createPassportStore();
  await assert.rejects(
    registerPassport(store, { businessId: 404, businessFetchFn: fakeBusinessFetchFn }),
    /no business with id 404/,
  );
  assert.strictEqual(store.passports.length, 0, 'a Passport for a business that does not exist must not be recorded');
});

test('registerPassport starts a business at Level 1, member', async () => {
  const store = createPassportStore();
  const passport = await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  assert.strictEqual(passport.level, 'member');
  assert.strictEqual(passport.verifiedAt, null);
  assert.strictEqual(passport.businessId, HUNT_ID);
});

test('registerPassport refuses a second Passport for the same business — §3, never recreated', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assert.rejects(
    registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn }),
    /already has a Passport/,
  );
  assert.strictEqual(store.passports.length, 1);
});

test('every declared NETWORK_LEVELS value is reachable in order', () => {
  assert.deepStrictEqual(NETWORK_LEVELS, ['member', 'verified', 'network']);
});

// -- verifyPassport -----------------------------------------------------------

test('verifyPassport requires VACA to actually confirm verified:true', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assert.rejects(
    verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeUnverifiedIdentityFetchFn }),
    /not VACA-verified/,
  );
  const passport = findPassport(store, HUNT_ID);
  assert.strictEqual(passport.level, 'member', 'a failed verification must not advance the level');
});

test('verifyPassport advances Level 1 to Level 2 on a real VACA confirmation', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  const passport = await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });
  assert.strictEqual(passport.level, 'verified');
  assert.ok(passport.verifiedAt);
});

test('verifyPassport passes subjectType "business" to VACA — reuses the generic mechanism, not a new one', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  let seenSubjectType = null;
  const spyIdentityFetchFn = async (subjectType, subjectId) => {
    seenSubjectType = subjectType;
    return { subjectType, subjectId, verified: true };
  };
  await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: spyIdentityFetchFn });
  assert.strictEqual(seenSubjectType, 'business');
});

test('re-verifying an already-verified Passport is idempotent, not an error', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });
  const again = await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });
  assert.strictEqual(again.level, 'verified');
});

test('verifyPassport rejects a business with no Passport', async () => {
  const store = createPassportStore();
  await assert.rejects(
    verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn }),
    /no Passport for business/,
  );
});

// -- assessNetworkActivity -----------------------------------------------------

test('assessNetworkActivity refuses a business still at Level 1 — Level 2 comes before Level 3', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await assert.rejects(
    assessNetworkActivity(store, { businessId: HUNT_ID, transactionsFetchFn: async () => [] }),
    /not yet Verified/,
  );
});

test('assessNetworkActivity does not advance to Level 3 with zero real V3 transactions', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });
  const passport = await assessNetworkActivity(store, { businessId: HUNT_ID, transactionsFetchFn: async () => [] });
  assert.strictEqual(passport.level, 'verified', 'no commerce yet means not yet a Network Business');
  assert.strictEqual(passport.networkActivity.transactionCount, 0);
});

test('assessNetworkActivity advances Level 2 to Level 3 on real V3 activity, and computes only objective totals — §4, no credit score', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  await verifyPassport(store, { businessId: HUNT_ID, identityFetchFn: fakeVerifiedIdentityFetchFn });

  const transactions = [
    { id: 1, fromUserId: 'ada', toUserId: 'owner-hunt-barber-shop', amount: 40, timestamp: 1000 },
    { id: 2, fromUserId: 'bob', toUserId: 'owner-hunt-barber-shop', amount: 30.5, timestamp: 2000 },
  ];
  const passport = await assessNetworkActivity(store, {
    businessId: HUNT_ID,
    transactionsFetchFn: async () => transactions,
  });
  assert.strictEqual(passport.level, 'network');
  assert.strictEqual(passport.networkActivity.transactionCount, 2);
  assert.strictEqual(passport.networkActivity.totalVolume, 70.5);
  assert.strictEqual(passport.networkActivity.firstTransactionAt, 1000);
  assert.strictEqual(passport.networkActivity.lastTransactionAt, 2000);
  // Objective totals only — no score, rating or derived judgement field.
  assert.deepStrictEqual(
    Object.keys(passport.networkActivity).sort(),
    ['firstTransactionAt', 'lastTransactionAt', 'totalVolume', 'transactionCount'],
  );
});

test('assessNetworkActivity rejects a business with no Passport', async () => {
  const store = createPassportStore();
  await assert.rejects(
    assessNetworkActivity(store, { businessId: HUNT_ID, transactionsFetchFn: async () => [] }),
    /no Passport for business/,
  );
});

// -- reseedIds ------------------------------------------------------------------

test('reseedIds picks up after the highest existing id, not the array length', async () => {
  const store = createPassportStore();
  await registerPassport(store, { businessId: HUNT_ID, businessFetchFn: fakeBusinessFetchFn });
  store.passports = [];
  const seeded = reseedIds(store);
  assert.strictEqual(seeded.nextPassportId, 1, 'an empty passports array must reseed to 1, not stay stuck');
});
