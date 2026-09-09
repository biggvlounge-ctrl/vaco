// VOKEN -- the compliance gates.
//
// These are not ordinary feature flags. Both default to CLOSED on a
// legal hold, and `influencer-culture-card-rewards` in particular is
// held pending Deskins' review of the secondary-market disclosure
// question -- a founder decision, not an engineering one.
//
// The failure this file exists to catch: a refactor that changes the
// default from false to true, or drops a gate check from a purchase
// path. Neither throws. Both would quietly start moving money through
// a path that is legally on hold, and the first symptom would arrive
// from a regulator rather than from a stack trace.

const test = require('node:test');
const assert = require('node:assert');

const {
  GATES, createComplianceGateState, isComplianceCleared, setComplianceStatus,
} = require('../lib/complianceGate');
const { createVokenStore } = require('../lib/store');
const { mintCultureCard } = require('../lib/cultureCards');
const { buyShares, createFractionalListing } = require('../lib/fractionalOwnership');

// A store holding one card, one owned edition, and one open fractional
// listing. Built with the real library functions rather than
// hand-shaped objects, so the fixture cannot drift from what the app
// actually produces -- and so the gate is genuinely the thing that
// rejects, not a missing record earlier in the validation order.
function storeWithListing() {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'p1',
    category: 'property',
    rarityTier: 'rare',
    tokenizationType: 'tokenized',
    formats: ['digital'],
    plannedDigitalMintCount: 10,
  });
  const listing = createFractionalListing(store, {
    cardId: card.id, editionNumber: 1, format: 'digital',
    sellerId: 'p1', totalShares: 10, pricePerShare: 5,
  });
  return { store, card, listing };
}

test('both gates exist and BOTH default to closed', () => {
  const state = createComplianceGateState();
  assert.deepStrictEqual(GATES.sort(), ['fractional-ownership', 'influencer-culture-card-rewards']);
  assert.strictEqual(state['fractional-ownership'], false);
  assert.strictEqual(state['influencer-culture-card-rewards'], false);
});

test('a fresh store has both gates closed', () => {
  const store = createVokenStore();
  assert.strictEqual(isComplianceCleared(store, 'fractional-ownership'), false);
  assert.strictEqual(isComplianceCleared(store, 'influencer-culture-card-rewards'), false);
});

test('an unknown gate name throws rather than reading as cleared', () => {
  // A typo returning undefined would be falsy and therefore "closed",
  // which sounds safe -- but the same typo in setComplianceStatus
  // would write a gate nothing ever reads. Both throw instead.
  const store = createVokenStore();
  assert.throws(() => isComplianceCleared(store, 'fractionl-ownership'), /invalid gateName/);
  assert.throws(() => setComplianceStatus(store, 'nope', true), /invalid gateName/);
});

test('setComplianceStatus demands a real boolean', () => {
  const store = createVokenStore();
  // 'true', 1, and 'yes' are all truthy and would open a legal gate.
  for (const bad of ['true', 1, 'yes', {}]) {
    assert.throws(() => setComplianceStatus(store, 'fractional-ownership', bad), /boolean/);
  }
  assert.strictEqual(isComplianceCleared(store, 'fractional-ownership'), false);
});

test('the influencer gate is NOT opened by clearing the fractional gate', () => {
  // They are held for different reasons by different people. Clearing
  // one must never imply the other.
  const store = createVokenStore();
  setComplianceStatus(store, 'fractional-ownership', true);
  assert.strictEqual(isComplianceCleared(store, 'influencer-culture-card-rewards'), false);
});

test('buying a REAL open listing is refused while the gate is closed', async () => {
  const { store, listing } = storeWithListing();
  await assert.rejects(
    () => buyShares(store, {
      listingId: listing.id, buyerId: 'alice', shareCount: 1, transferFn: async () => {},
    }),
    // Asserting the message matters: an earlier validation failing
    // would also reject, and would look like the gate working while
    // proving nothing about it.
    /compliance/i,
  );
});

test('no money moves while the gate is closed', async () => {
  // The sharpest form of the check: prove the injected transferFn is
  // never reached, so a closed gate cannot charge anyone.
  const { store, listing } = storeWithListing();
  let transferCalls = 0;
  await assert.rejects(() => buyShares(store, {
    listingId: listing.id, buyerId: 'alice', shareCount: 1,
    transferFn: async () => { transferCalls += 1; },
  }));
  assert.strictEqual(transferCalls, 0);
});

test('the gate is checked before listing status, not after', async () => {
  // Ordering is load-bearing. If the status check ran first, closing a
  // listing would produce a "not open" error and mask whether the gate
  // is even consulted -- which is how a dropped gate check survives
  // review.
  const { store, listing } = storeWithListing();
  store.fractionalListings.find((l) => l.id === listing.id).status = 'closed';
  await assert.rejects(() => buyShares(store, {
    listingId: listing.id, buyerId: 'alice', shareCount: 1, transferFn: async () => {},
  }), /compliance/i);
});

test('creating a fractional listing is NOT gated -- documenting real behavior', () => {
  // Found while writing these tests, and left as-is rather than
  // "fixed": only `buyShares` and `buySecondaryShares` consult the
  // gate. Creating a listing succeeds with the gate closed.
  //
  // No money moves, so nobody can be charged on a held product line --
  // but `createFractionalListing` does call `transferEditionOwnership`,
  // moving the edition into the fractional pool. That is a real
  // custody change on a line that is legally on hold.
  //
  // Whether that should be gated too is a compliance judgment, not an
  // engineering one, so it is recorded here for Deskins rather than
  // decided unilaterally. This test pins current behavior; if the
  // decision is to gate it, this test is the one to invert.
  const { store, listing } = storeWithListing();
  assert.strictEqual(isComplianceCleared(store, 'fractional-ownership'), false);
  assert.strictEqual(listing.status, 'open');
});
