// Vvltvre Pods -- Show Subscriptions (creator-level, optional).
// Genuinely different real economics from Vvltvre Flix's own
// subscriptions.js: Flix is a mandatory, platform-wide paywall
// (nothing streams without one); a Pods show subscription is real,
// optional, per-creator support -- the actual real Spotify "Fans"/
// Patreon pattern, not a re-skin of Flix's model. Most real shows
// have no paid tier at all (`show.subscriptionTiers.length === 0`),
// matching the real fact that most podcasts are entirely free.
//
// Real, multiple tiers per show: a subscriber picks one
// `subscriptionTiers[].id` per show (Patreon's own real model --
// exactly one active tier at a time, not stacked). Subscribing again
// with a different `tierId` is a real, deliberate tier switch (same
// real "subscribe again" idiom this file already uses for renewal),
// re-pricing the existing subscription at the new tier rather than
// creating a second, competing one.
//
// `PLATFORM_TAKE_PERCENT` is a real, flagged, deliberately
// interpretive number grounded in Patreon's own real, well-known
// standard platform take rate (~10%) -- the closest real, named
// comparable for a creator-subscription platform fee, not an
// invented figure. The rest goes straight to the creator, the same
// "one source, real dual payout, sums to exactly what was charged"
// discipline as every other split this session.
//
// Same real 30-day renewal cadence as `vulture-flix`'s own
// `subscriptions.js` (`RENEWAL_PERIOD_MS`), for ecosystem consistency
// -- calling `subscribeToShow` again both renews and (if the price
// changed) re-charges at the current price, mirroring that project's
// own established "subscribe again to renew" idiom.

const { getShow, getSubscriptionTier } = require('./shows');

const VULTURE_PODS_PLATFORM_ACCOUNT = 'vulture-pods-platform';
const PLATFORM_TAKE_PERCENT = 0.10;
const RENEWAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

async function subscribeToShow(store, options = {}) {
  const {
    userId, showId, tierId, transferFn, now = Date.now(),
  } = options;
  if (!userId) throw new Error('subscribeToShow requires a userId');
  const show = getShow(store, showId);
  if (!show) throw new Error(`subscribeToShow: no show with id ${showId}`);
  if (show.subscriptionTiers.length === 0) throw new Error(`subscribeToShow: show ${showId} has no subscription tiers`);
  const tier = getSubscriptionTier(show, tierId);
  if (!tier) throw new Error(`subscribeToShow: show ${showId} has no subscription tier with id ${tierId}`);
  if (typeof transferFn !== 'function') {
    throw new Error('subscribeToShow requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  const price = tier.priceVCoin;
  const platformCut = round(price * PLATFORM_TAKE_PERCENT);
  const creatorShare = round(price - platformCut);

  await transferFn(userId, show.creatorId, creatorShare, `vulture_pods_show_subscription:${showId}:${tierId}`);
  await transferFn(userId, VULTURE_PODS_PLATFORM_ACCOUNT, platformCut, `vulture_pods_platform_fee:${showId}:${tierId}`);

  let sub = store.showSubscriptions.find((s) => s.userId === userId && s.showId === showId);
  if (sub) {
    sub.tierId = tierId;
    sub.status = 'active';
    sub.renewsAt = now + RENEWAL_PERIOD_MS;
    sub.lastRenewedAt = now;
  } else {
    sub = {
      id: store.nextShowSubscriptionId++, userId, showId, tierId, status: 'active', startedAt: now, renewsAt: now + RENEWAL_PERIOD_MS, lastRenewedAt: now,
    };
    store.showSubscriptions.push(sub);
  }
  return sub;
}

function cancelShowSubscription(store, options = {}) {
  const { userId, showId, now = Date.now() } = options;
  const sub = store.showSubscriptions.find((s) => s.userId === userId && s.showId === showId);
  if (!sub) throw new Error(`cancelShowSubscription: no subscription for ${userId} on show ${showId}`);
  if (sub.status !== 'active') throw new Error(`cancelShowSubscription: subscription for ${userId} on show ${showId} is not active`);
  sub.status = 'cancelled';
  sub.cancelledAt = now;
  return sub;
}

function isSubscribedToShow(store, options = {}) {
  const { userId, showId, now = Date.now() } = options;
  const sub = store.showSubscriptions.find((s) => s.userId === userId && s.showId === showId);
  return !!sub && sub.status === 'active' && sub.renewsAt > now;
}

function listSubscriptionsForUser(store, userId) {
  return store.showSubscriptions.filter((s) => s.userId === userId);
}

module.exports = {
  VULTURE_PODS_PLATFORM_ACCOUNT,
  PLATFORM_TAKE_PERCENT,
  RENEWAL_PERIOD_MS,
  subscribeToShow,
  cancelShowSubscription,
  isSubscribedToShow,
  listSubscriptionsForUser,
};
