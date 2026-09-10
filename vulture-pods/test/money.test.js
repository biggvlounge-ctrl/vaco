// Vvltvre Pods' money path: show subscriptions and the 90/10 split.
//
// Pods was at zero coverage while charging listeners and paying
// creators. Two balances move on every subscribe, and nothing asserted
// either.
//
// **Asserted on the money, never on a status.** `subscribeToShow`
// returns a subscription object with `status: 'active'` on it, and a
// test reading only that would pass while the creator was paid nothing,
// paid twice, or paid the platform's share.

const test = require('node:test');
const assert = require('node:assert');

const { createVulturePodsStore: createPodsStore } = require('../lib/store');
const { createShow } = require('../lib/shows');
const {
  VULTURE_PODS_PLATFORM_ACCOUNT, PLATFORM_TAKE_PERCENT, RENEWAL_PERIOD_MS,
  subscribeToShow, cancelShowSubscription, isSubscribedToShow, listSubscriptionsForUser,
} = require('../lib/subscriptions');

function recorder() {
  const moves = [];
  // Takes a settlement and applies each leg, so every existing
  // assertion below reads exactly as it did when these were
  // separate transfers. `calls` is the new question: how many
  // times the ledger was asked. Amounts are identical whether a
  // settlement is atomic or split, which is why only a call count
  // can tell them apart.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId: fromUserId, toUserId: toUserId, amount: amount, reason: reason } of legs) {
      moves.push({ fromUserId, toUserId, amount, reason });
    }
    return { ok: true };
  };
  fn.calls = calls;
  fn.moves = moves;
  fn.totalTo = (who) => moves.filter((m) => m.toUserId === who).reduce((n, m) => n + m.amount, 0);
  fn.totalFrom = (who) => moves.filter((m) => m.fromUserId === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

function showWithTier(store, priceVCoin = 100) {
  return createShow(store, {
    creatorId: 'creator-1',
    title: 'The Vvltvre Hour',
    description: 'A real show about real things.',
    category: 'culture',
    subscriptionTiers: [{ name: 'Supporter', priceVCoin }],
  });
}

// -- The split -----------------------------------------------------------

test('subscribing pays the creator and the platform, and charges the listener once', async () => {
  const store = createPodsStore();
  const show = showWithTier(store, 100);
  const settleFn = recorder();

  await subscribeToShow(store, {
    userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id, settleFn,
  });

  assert.equal(settleFn.moves.length, 2, 'a subscription did not move money exactly twice');
  assert.equal(settleFn.totalTo('creator-1'), 90);
  assert.equal(settleFn.totalTo(VULTURE_PODS_PLATFORM_ACCOUNT), 10);
  assert.equal(settleFn.totalFrom('ada'), 100, 'the listener was not charged exactly the tier price');

  // **The assertion arithmetic cannot make.** Both legs must reach
  // the ledger in ONE call. Split into consecutive transfers every
  // line above still passes — the amounts, the split, the total
  // charged — and yet the second leg can fail after the first has
  // moved, leaving the record unwritten and a retry paying again.
  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.equal(settleFn.calls[0].legs.length, 2, 'the two shares stay separately auditable');
});

test('the platform take is 10% and is asserted, not assumed', () => {
  assert.equal(PLATFORM_TAKE_PERCENT, 0.10);
});

test('the two shares sum to the tier price at awkward amounts', async () => {
  // The reason the creator share is derived by subtraction rather than
  // multiplied independently: two separately-rounded halves drift, and
  // the listener is the one who pays the difference.
  for (const price of [0.15, 0.25, 0.35, 1.05, 9.99, 19.95]) {
    const store = createPodsStore();
    const show = showWithTier(store, price);
    const settleFn = recorder();
    await subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id, settleFn,
    });
    const paid = Math.round(settleFn.totalFrom('ada') * 100) / 100;
    assert.equal(paid, price, `at price ${price} the listener was charged ${paid}`);
  }
});

// -- Refusals move nothing -----------------------------------------------

test('a subscription with no settleFn is refused rather than silently free', async () => {
  const store = createPodsStore();
  const show = showWithTier(store);
  await assert.rejects(
    () => subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id,
    }),
    /requires a settleFn/,
  );
  assert.equal(store.showSubscriptions.length, 0, 'a subscription was recorded with no money moved');
});

test('subscribing to a tier that does not exist moves nothing', async () => {
  const store = createPodsStore();
  const show = showWithTier(store);
  const settleFn = recorder();
  await assert.rejects(
    () => subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: 9999, settleFn,
    }),
    /no subscription tier/,
  );
  assert.equal(settleFn.moves.length, 0);
  assert.equal(store.showSubscriptions.length, 0);
});

test('subscribing to a show that does not exist moves nothing', async () => {
  const store = createPodsStore();
  const settleFn = recorder();
  await assert.rejects(
    () => subscribeToShow(store, { userId: 'ada', showId: 9999, tierId: 1, settleFn }),
    /no show with id/,
  );
  assert.equal(settleFn.moves.length, 0);
});

test('a show with no tiers cannot be subscribed to', async () => {
  const store = createPodsStore();
  const show = createShow(store, {
    creatorId: 'creator-1', title: 'Free Show', description: 'No tiers.', category: 'culture',
  });
  const settleFn = recorder();
  await assert.rejects(
    () => subscribeToShow(store, { userId: 'ada', showId: show.id, tierId: 1, settleFn }),
    /no subscription tiers/,
  );
  assert.equal(settleFn.moves.length, 0);
});

// -- Renewal and re-subscribe --------------------------------------------

test('re-subscribing does not create a second subscription, but does charge again', async () => {
  // Both halves matter. A duplicate row would double-count the
  // audience; a free re-subscribe would let a lapsed listener return
  // without paying.
  const store = createPodsStore();
  const show = showWithTier(store, 50);
  const settleFn = recorder();
  const tierId = show.subscriptionTiers[0].id;

  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, settleFn, now: 1000 });
  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, settleFn, now: 2000 });

  assert.equal(store.showSubscriptions.length, 1, 'a second subscription row was created');
  assert.equal(settleFn.totalFrom('ada'), 100, 'the second subscribe did not charge');
  assert.equal(settleFn.totalTo('creator-1'), 90);
});

test('the renewal date is set a full period out', async () => {
  const store = createPodsStore();
  const show = showWithTier(store);
  const settleFn = recorder();
  const sub = await subscribeToShow(store, {
    userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id, settleFn, now: 1000,
  });
  assert.equal(sub.renewsAt, 1000 + RENEWAL_PERIOD_MS);
  assert.equal(RENEWAL_PERIOD_MS, 30 * 24 * 60 * 60 * 1000);
});

// -- Cancellation ---------------------------------------------------------

test('cancelling ends access and refunds nothing', async () => {
  // Refunding on cancel is a product decision nobody made. What this
  // asserts is that cancelling does not quietly move money in either
  // direction.
  const store = createPodsStore();
  const show = showWithTier(store, 100);
  const settleFn = recorder();
  const tierId = show.subscriptionTiers[0].id;

  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, settleFn });
  const movedBefore = settleFn.moves.length;

  cancelShowSubscription(store, { userId: 'ada', showId: show.id });

  assert.equal(settleFn.moves.length, movedBefore, 'cancelling moved money');
  assert.equal(isSubscribedToShow(store, { userId: 'ada', showId: show.id }), false);
});

test('one listener cancelling does not affect another', async () => {
  const store = createPodsStore();
  const show = showWithTier(store, 100);
  const settleFn = recorder();
  const tierId = show.subscriptionTiers[0].id;

  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, settleFn });
  await subscribeToShow(store, { userId: 'bo', showId: show.id, tierId, settleFn });
  cancelShowSubscription(store, { userId: 'ada', showId: show.id });

  assert.equal(isSubscribedToShow(store, { userId: 'ada', showId: show.id }), false);
  assert.equal(isSubscribedToShow(store, { userId: 'bo', showId: show.id }), true);
  // And the creator keeps what both already paid.
  assert.equal(settleFn.totalTo('creator-1'), 180);
});

test('listSubscriptionsForUser returns only that user\'s subscriptions', async () => {
  const store = createPodsStore();
  const a = showWithTier(store, 10);
  const b = createShow(store, {
    creatorId: 'creator-2', title: 'Other', description: 'Other show.', category: 'culture',
    subscriptionTiers: [{ name: 'Base', priceVCoin: 20 }],
  });
  const settleFn = recorder();
  await subscribeToShow(store, { userId: 'ada', showId: a.id, tierId: a.subscriptionTiers[0].id, settleFn });
  await subscribeToShow(store, { userId: 'bo', showId: b.id, tierId: b.subscriptionTiers[0].id, settleFn });

  assert.equal(listSubscriptionsForUser(store, 'ada').length, 1);
  assert.equal(listSubscriptionsForUser(store, 'bo').length, 1);
  assert.equal(settleFn.totalTo('creator-1'), 9);
  assert.equal(settleFn.totalTo('creator-2'), 18);
});
