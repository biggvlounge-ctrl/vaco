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
  const fn = async (fromUserId, toUserId, amount, reason) => {
    moves.push({ fromUserId, toUserId, amount, reason });
    return { ok: true };
  };
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
  const transferFn = recorder();

  await subscribeToShow(store, {
    userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id, transferFn,
  });

  assert.equal(transferFn.moves.length, 2, 'a subscription did not move money exactly twice');
  assert.equal(transferFn.totalTo('creator-1'), 90);
  assert.equal(transferFn.totalTo(VULTURE_PODS_PLATFORM_ACCOUNT), 10);
  assert.equal(transferFn.totalFrom('ada'), 100, 'the listener was not charged exactly the tier price');
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
    const transferFn = recorder();
    await subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id, transferFn,
    });
    const paid = Math.round(transferFn.totalFrom('ada') * 100) / 100;
    assert.equal(paid, price, `at price ${price} the listener was charged ${paid}`);
  }
});

// -- Refusals move nothing -----------------------------------------------

test('a subscription with no transferFn is refused rather than silently free', async () => {
  const store = createPodsStore();
  const show = showWithTier(store);
  await assert.rejects(
    () => subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id,
    }),
    /requires a transferFn/,
  );
  assert.equal(store.showSubscriptions.length, 0, 'a subscription was recorded with no money moved');
});

test('subscribing to a tier that does not exist moves nothing', async () => {
  const store = createPodsStore();
  const show = showWithTier(store);
  const transferFn = recorder();
  await assert.rejects(
    () => subscribeToShow(store, {
      userId: 'ada', showId: show.id, tierId: 9999, transferFn,
    }),
    /no subscription tier/,
  );
  assert.equal(transferFn.moves.length, 0);
  assert.equal(store.showSubscriptions.length, 0);
});

test('subscribing to a show that does not exist moves nothing', async () => {
  const store = createPodsStore();
  const transferFn = recorder();
  await assert.rejects(
    () => subscribeToShow(store, { userId: 'ada', showId: 9999, tierId: 1, transferFn }),
    /no show with id/,
  );
  assert.equal(transferFn.moves.length, 0);
});

test('a show with no tiers cannot be subscribed to', async () => {
  const store = createPodsStore();
  const show = createShow(store, {
    creatorId: 'creator-1', title: 'Free Show', description: 'No tiers.', category: 'culture',
  });
  const transferFn = recorder();
  await assert.rejects(
    () => subscribeToShow(store, { userId: 'ada', showId: show.id, tierId: 1, transferFn }),
    /no subscription tiers/,
  );
  assert.equal(transferFn.moves.length, 0);
});

// -- Renewal and re-subscribe --------------------------------------------

test('re-subscribing does not create a second subscription, but does charge again', async () => {
  // Both halves matter. A duplicate row would double-count the
  // audience; a free re-subscribe would let a lapsed listener return
  // without paying.
  const store = createPodsStore();
  const show = showWithTier(store, 50);
  const transferFn = recorder();
  const tierId = show.subscriptionTiers[0].id;

  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, transferFn, now: 1000 });
  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, transferFn, now: 2000 });

  assert.equal(store.showSubscriptions.length, 1, 'a second subscription row was created');
  assert.equal(transferFn.totalFrom('ada'), 100, 'the second subscribe did not charge');
  assert.equal(transferFn.totalTo('creator-1'), 90);
});

test('the renewal date is set a full period out', async () => {
  const store = createPodsStore();
  const show = showWithTier(store);
  const transferFn = recorder();
  const sub = await subscribeToShow(store, {
    userId: 'ada', showId: show.id, tierId: show.subscriptionTiers[0].id, transferFn, now: 1000,
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
  const transferFn = recorder();
  const tierId = show.subscriptionTiers[0].id;

  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, transferFn });
  const movedBefore = transferFn.moves.length;

  cancelShowSubscription(store, { userId: 'ada', showId: show.id });

  assert.equal(transferFn.moves.length, movedBefore, 'cancelling moved money');
  assert.equal(isSubscribedToShow(store, { userId: 'ada', showId: show.id }), false);
});

test('one listener cancelling does not affect another', async () => {
  const store = createPodsStore();
  const show = showWithTier(store, 100);
  const transferFn = recorder();
  const tierId = show.subscriptionTiers[0].id;

  await subscribeToShow(store, { userId: 'ada', showId: show.id, tierId, transferFn });
  await subscribeToShow(store, { userId: 'bo', showId: show.id, tierId, transferFn });
  cancelShowSubscription(store, { userId: 'ada', showId: show.id });

  assert.equal(isSubscribedToShow(store, { userId: 'ada', showId: show.id }), false);
  assert.equal(isSubscribedToShow(store, { userId: 'bo', showId: show.id }), true);
  // And the creator keeps what both already paid.
  assert.equal(transferFn.totalTo('creator-1'), 180);
});

test('listSubscriptionsForUser returns only that user\'s subscriptions', async () => {
  const store = createPodsStore();
  const a = showWithTier(store, 10);
  const b = createShow(store, {
    creatorId: 'creator-2', title: 'Other', description: 'Other show.', category: 'culture',
    subscriptionTiers: [{ name: 'Base', priceVCoin: 20 }],
  });
  const transferFn = recorder();
  await subscribeToShow(store, { userId: 'ada', showId: a.id, tierId: a.subscriptionTiers[0].id, transferFn });
  await subscribeToShow(store, { userId: 'bo', showId: b.id, tierId: b.subscriptionTiers[0].id, transferFn });

  assert.equal(listSubscriptionsForUser(store, 'ada').length, 1);
  assert.equal(listSubscriptionsForUser(store, 'bo').length, 1);
  assert.equal(transferFn.totalTo('creator-1'), 9);
  assert.equal(transferFn.totalTo('creator-2'), 18);
});
