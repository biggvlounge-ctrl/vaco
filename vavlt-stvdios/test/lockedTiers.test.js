// Vavlt Stvdios — locked content tier subscriptions.
//
// **This settlement had no test.** `subscribeTier` charges a subscriber
// and splits the payment between the creator and the platform, and
// nothing in this app's suite touched it — which is how the sweep found
// it: converting it to an atomic settlement changed nothing that any
// test could see, so the deliberate control that reintroduces the
// defect fired against nothing.
//
// Written as two consecutive transfers, the platform leg could fail
// after the creator had already been paid. `tier.subscribers` is
// appended only after both, so the subscriber was charged, held no
// subscription, and the retry paid the creator a second time.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTier, subscribeTier, isSubscribed, getTier,
  CREATOR_SPLIT_PERCENT, VAVLT_STVDIOS_PLATFORM_ACCOUNT,
} = require('../lib/lockedContentTiers');
const { createVavltStvdiosStore } = require('../lib/store');

// `legs` is every movement, flattened — what an assertion about who was
// paid what wants. `calls` is how many times the ledger was asked, and
// it is the only thing that distinguishes an atomic settlement from the
// consecutive transfers it replaced: the amounts are identical either
// way.
function ledger({ refuseFirst = false } = {}) {
  const calls = [];
  const legs = [];
  let refuse = refuseFirst;
  const fn = async (settlementLegs, meta = {}) => {
    if (refuse) {
      refuse = false;
      throw new Error('legs[1]: Insufficient VCoin balance. Nothing in this settlement was applied.');
    }
    calls.push({ legs: settlementLegs, meta });
    legs.push(...settlementLegs);
  };
  fn.calls = calls;
  fn.legs = legs;
  fn.paidTo = (userId) => legs
    .filter((l) => l.toUserId === userId)
    .reduce((n, l) => n + l.amount, 0);
  return fn;
}

function tierFor(store, priceVCoin = 100) {
  return createTier(store, {
    creatorId: 'nova', tierName: 'Inner Circle', priceVCoin,
    benefits: ['Behind the scenes'],
  });
}

test('a subscription pays creator and platform in ONE settlement', async () => {
  const store = createVavltStvdiosStore();
  const tier = tierFor(store);
  const settleFn = ledger();

  await subscribeTier(store, { tierId: tier.id, userId: 'ada', settleFn });

  // **The assertion arithmetic cannot make.** Both legs must reach the
  // ledger together; split, every amount below is identical.
  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.equal(settleFn.calls[0].legs.length, 2, 'creator and platform shares stay separately auditable');

  assert.equal(settleFn.paidTo('nova'), 100 * CREATOR_SPLIT_PERCENT);
  assert.equal(settleFn.paidTo(VAVLT_STVDIOS_PLATFORM_ACCOUNT), 100 - 100 * CREATOR_SPLIT_PERCENT);
  const total = settleFn.legs.reduce((n, l) => n + l.amount, 0);
  assert.equal(total, 100, 'the two shares must sum to exactly the tier price');
  assert.equal(isSubscribed(store, tier.id, 'ada'), true);
});

test('a refused settlement charges nobody and grants no access', async () => {
  const store = createVavltStvdiosStore();
  const tier = tierFor(store);
  const settleFn = ledger({ refuseFirst: true });

  await assert.rejects(
    () => subscribeTier(store, { tierId: tier.id, userId: 'ada', settleFn }),
    /Nothing in this settlement was applied/,
  );

  assert.equal(settleFn.paidTo('nova'), 0, 'a refused subscription paid the creator');
  assert.equal(isSubscribed(store, tier.id, 'ada'), false,
    'a refused subscription granted access to locked content');
  assert.equal(getTier(store, tier.id).subscribers.length, 0);
});

test('the retry after a refusal pays the creator exactly once', async () => {
  // **The regression.** Split, the first attempt would have paid the
  // creator before failing on the platform leg — and this retry, which
  // the missing subscription record permits, would pay them again.
  const store = createVavltStvdiosStore();
  const tier = tierFor(store);
  const settleFn = ledger({ refuseFirst: true });

  await assert.rejects(
    () => subscribeTier(store, { tierId: tier.id, userId: 'ada', settleFn }),
    /Nothing in this settlement was applied/,
  );
  await subscribeTier(store, { tierId: tier.id, userId: 'ada', settleFn });

  assert.equal(settleFn.paidTo('nova'), 100 * CREATOR_SPLIT_PERCENT,
    'the creator was paid more than once for a single subscription');
  assert.equal(isSubscribed(store, tier.id, 'ada'), true);
});

test('subscribing without a settleFn is refused rather than granted free', async () => {
  const store = createVavltStvdiosStore();
  const tier = tierFor(store);

  await assert.rejects(
    () => subscribeTier(store, { tierId: tier.id, userId: 'ada' }),
    /requires a settleFn/,
  );
  assert.equal(isSubscribed(store, tier.id, 'ada'), false);
});
