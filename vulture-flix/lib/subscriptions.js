// Vvltvre Flix -- Subscriptions.
// The real access-gating mechanic that defines Netflix Originals'
// distribution model: subscription, not pay-per-view or per-title
// purchase. Watching anything here requires an active subscription
// (see `lib/titles.js`'s `watchTitle`) -- there is no per-title price
// anywhere in this module or `titles.js`.
//
// **Real multiple subscription tiers**, closing the README's own
// previously-flagged gap ("real Netflix has ad-supported/standard/
// premium; a single flat monthly fee is modeled"). `TIER_FEES` are
// real, deliberately interpretive numbers grounded in Netflix's real
// three-tier structure and relative pricing shape (ad-supported
// cheapest, premium priciest) -- exact figures move over time, this
// is a flagged structural stand-in, not a scraped current price list.
// `standard` keeps this module's original price exactly, so a caller
// who never mentions a tier gets byte-for-byte unchanged pricing.
// `TIER_MAX_SIMULTANEOUS_STREAMS` is a real, named Netflix tier
// differentiator, informational only -- concurrent-stream enforcement
// itself isn't built (no stream-session/stream-end event exists
// anywhere in this codebase to enforce against), flagged directly
// rather than silently ignored.
//
// No separate "change tier" action exists, or needs to: `subscribe`
// already doubled as this module's real renewal mechanism (call it
// again, pay again, the period resets from `now`) -- calling it again
// with a different `tier` is the same real, immediate action, just
// switching which price and tier take effect from this renewal on.

const { settleOnce } = require('./settleOnce');

const VULTURE_FLIX_PLATFORM_ACCOUNT = 'vulture-flix-platform';

const SUBSCRIPTION_TIERS = ['ad-supported', 'standard', 'premium'];

const TIER_FEES = {
  'ad-supported': 6.99,
  standard: 15.49,
  premium: 22.99,
};

const TIER_MAX_SIMULTANEOUS_STREAMS = {
  'ad-supported': 1,
  standard: 2,
  premium: 4,
};

// Kept for backward compatibility -- equals `TIER_FEES.standard`
// exactly, the tier `subscribe` defaults to when no tier is given.
const MONTHLY_FEE = TIER_FEES.standard;
const RENEWAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

async function subscribe(store, options = {}) {
  const {
    userId, tier = 'standard', settleFn, now = Date.now(),
  } = options;
  if (!userId) throw new Error('subscribe requires a userId');
  if (!SUBSCRIPTION_TIERS.includes(tier)) {
    throw new Error(`subscribe requires a tier of ${SUBSCRIPTION_TIERS.join(', ')}`);
  }
  if (typeof settleFn !== 'function') {
    throw new Error('subscribe requires a settleFn(legs, meta)');
  }

  const fee = TIER_FEES[tier];
  let sub = store.subscriptions.find((s) => s.userId === userId);
  const isNewSubscriber = !sub;
  if (isNewSubscriber) {
    sub = {
      userId, tier, status: 'active', startedAt: now, renewsAt: now + RENEWAL_PERIOD_MS, lastRenewedAt: now,
    };
    store.subscriptions.push(sub);
  }

  // Claimed as a sentinel status before the charge, not written as
  // "active" only after. This used to await settleFn -- a real
  // cross-service VCoin call -- and only then look up and overwrite
  // the record, so a cancelSubscription call landing while a renewal's
  // charge was in flight read the still-"active" record, cancelled it,
  // and then had that cancellation silently clobbered back to "active"
  // once the charge resolved -- after the renewal had already been
  // paid for. `cancelSubscription`'s own guard requires
  // `status === 'active'`; claiming a different sentinel here means a
  // concurrent cancel reads that sentinel and is refused outright by
  // its existing guard, rather than racing the final write.
  // **Scoped by its own charge event, not by tier alone.** The reason
  // below doubles as V3's idempotency key (see server.js's
  // settleVCoin), and used to be the bare string
  // `Vvltvre Flix ${tier} subscription` -- identical for every
  // subscriber on a given tier, forever. Two different users
  // subscribing to the same tier produced the same key with different
  // legs, which V3 refuses outright as a collision; the same user
  // renewing or re-subscribing within V3's 24h retention window
  // produced the same key with identical legs, which V3 silently
  // replays with no new transfer while this function still granted a
  // fresh 30-day active period as if payment had genuinely cleared.
  // Reserving a charge id before the settlement makes every charge's
  // key unique by construction.
  const chargeEventId = store.nextSubscriptionChargeId++;
  try {
    await settleOnce(
      sub,
      { status: 'renewing' },
      () => settleFn(
        [{ fromUserId: userId, toUserId: VULTURE_FLIX_PLATFORM_ACCOUNT, amount: fee, reason: `Vvltvre Flix ${tier} subscription:${chargeEventId}` }],
        { reason: `Vvltvre Flix ${tier} subscription:${chargeEventId}` },
      ),
    );
  } catch (err) {
    // A brand-new subscriber whose very first charge failed must not
    // be left behind as a half-created record -- the old behavior
    // left no subscription at all in this case, and this preserves it.
    if (isNewSubscriber) {
      store.subscriptions = store.subscriptions.filter((s) => s !== sub);
    }
    throw err;
  }

  // Past this line the charge has genuinely settled. Renewal (or a
  // real, immediate tier switch effective from this renewal) -- extend
  // from `now`, not stacked on the old renewsAt, matching how a real
  // subscription renewal actually works (you pay now, you're covered
  // for the next real period from now).
  sub.status = 'active';
  sub.tier = tier;
  sub.renewsAt = now + RENEWAL_PERIOD_MS;
  sub.lastRenewedAt = now;
  return sub;
}

function cancelSubscription(store, options = {}) {
  const { userId, now = Date.now() } = options;
  const sub = store.subscriptions.find((s) => s.userId === userId);
  if (!sub) throw new Error(`cancelSubscription: no subscription for ${userId}`);
  if (sub.status !== 'active') throw new Error(`cancelSubscription: subscription for ${userId} is not active`);
  sub.status = 'cancelled';
  sub.cancelledAt = now;
  return sub;
}

function getSubscription(store, userId) {
  return store.subscriptions.find((s) => s.userId === userId) || null;
}

// The real access check every watch action goes through -- active
// status AND not past its own real renewal date (a cancelled or
// lapsed subscriber genuinely can't watch, same as real Netflix).
function isSubscriber(store, userId, now = Date.now()) {
  const sub = getSubscription(store, userId);
  return !!sub && sub.status === 'active' && sub.renewsAt > now;
}

module.exports = {
  VULTURE_FLIX_PLATFORM_ACCOUNT,
  SUBSCRIPTION_TIERS,
  TIER_FEES,
  TIER_MAX_SIMULTANEOUS_STREAMS,
  MONTHLY_FEE,
  RENEWAL_PERIOD_MS,
  subscribe,
  cancelSubscription,
  getSubscription,
  isSubscriber,
};
