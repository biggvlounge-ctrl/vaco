// VACO Shell — the App Store.
//
// **What this turns Shell into.** Until now Shell was a launcher: a
// registry of 31 apps, session auth, and SSO. Real infrastructure, and
// a cost centre — no price attached to anything. The revenue inventory
// listed it under "monetizable, not yet monetized."
//
// This is the monetization. Listings with prices, per-user
// entitlements, purchases that settle through V3, and a revenue share
// back to whoever published the app. That is the difference between a
// launcher and Google Play.
//
// **The registry stays the source of truth for what an app IS.**
// `registry.js` holds identity, URL, category, and bundle. This module
// holds *commerce* — price, publisher, entitlement. A listing points at
// a registry app by id rather than restating it, so the two cannot
// drift into disagreeing about what VOID is.
//
// **Free is a first-class price, not a missing one.** Most of the 31
// apps are free and always will be — VOID and CVNVO make money inside
// themselves, not at the door. A free listing still produces an
// entitlement so "what do I have installed" has one answer regardless
// of how it was acquired.

const PRICING_MODELS = ['free', 'one-time', 'subscription'];

const SUBSCRIPTION_PERIODS = ['monthly', 'yearly'];

//: Flagged interpretive: no source document sets a store take rate.
//: 30% is the platform convention (Apple, Google Play at their
//: standard tier) and 15% is what both charge smaller publishers.
//: Starting at 15% is the deliberate choice — the same
//: worker-and-publisher-friendly posture VOID took against
//: Thumbtack's pay-per-lead and Vavlt Stvdios took against Twitch's
//: 50/50. Overridable per listing.
const DEFAULT_STORE_TAKE_RATE = 0.15;

//: The account store fees settle into. Distinct from
//: `void-platform` on purpose: store revenue and marketplace revenue
//: are different businesses and should be separately reportable.
const VACO_STORE_ACCOUNT = 'vaco-store';

//: How long a monthly/yearly subscription entitlement lasts. Real
//: durations rather than a generic 30 days, because a yearly plan
//: that expires in 360 days is a support ticket.
const PERIOD_DAYS = { monthly: 30, yearly: 365 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

class AppStoreError extends Error {}

function round(n) {
  return Math.round(n * 100) / 100;
}

// -- listings ----------------------------------------------------------

export function publishListing(store, options = {}) {
  const {
    appId, publisherId, pricingModel, priceVcoin = 0,
    subscriptionPeriod = null, takeRate = DEFAULT_STORE_TAKE_RATE,
    summary = null, appExistsFn = null, now = Date.now(),
  } = options;

  if (!appId) throw new AppStoreError('publishListing requires an appId');
  // Injected rather than importing the registry directly, the same way
  // every cross-boundary call in this repo is injected — it keeps this
  // module runnable against a plain object in tests. The route always
  // passes it, so in practice a listing cannot name an app that does
  // not exist, which is the drift this module's header promises to
  // prevent.
  if (typeof appExistsFn === 'function' && !appExistsFn(appId)) {
    throw new AppStoreError(`publishListing: "${appId}" is not a registered app`);
  }
  if (!publisherId) throw new AppStoreError('publishListing requires a publisherId');
  if (!PRICING_MODELS.includes(pricingModel)) {
    throw new AppStoreError(`publishListing: pricingModel must be one of ${PRICING_MODELS.join(', ')}`);
  }

  // A paid listing with no price is the single most likely publishing
  // mistake, and it would quietly give the app away.
  if (pricingModel !== 'free' && (!Number.isFinite(priceVcoin) || priceVcoin <= 0)) {
    throw new AppStoreError(`publishListing: a "${pricingModel}" listing requires a positive priceVcoin`);
  }
  if (pricingModel === 'free' && priceVcoin !== 0) {
    throw new AppStoreError('publishListing: a free listing cannot carry a price');
  }
  if (pricingModel === 'subscription' && !SUBSCRIPTION_PERIODS.includes(subscriptionPeriod)) {
    throw new AppStoreError(
      `publishListing: a subscription requires a period of ${SUBSCRIPTION_PERIODS.join(' or ')}`,
    );
  }
  if (!Number.isFinite(takeRate) || takeRate < 0 || takeRate >= 1) {
    throw new AppStoreError('publishListing: takeRate must be between 0 and 1');
  }

  const existing = store.listings.find((l) => l.appId === appId);
  if (existing) {
    Object.assign(existing, {
      publisherId, pricingModel, priceVcoin, subscriptionPeriod, takeRate, summary, updatedAt: now,
    });
    return existing;
  }

  const listing = {
    appId,
    publisherId,
    pricingModel,
    priceVcoin,
    subscriptionPeriod,
    takeRate,
    summary,
    published: true,
    installs: 0,
    createdAt: now,
    updatedAt: now,
  };
  store.listings.push(listing);
  return listing;
}

export function getListing(store, appId) {
  return store.listings.find((l) => l.appId === appId) || null;
}

export function unpublishListing(store, appId) {
  const listing = getListing(store, appId);
  if (!listing) throw new AppStoreError(`unpublishListing: no listing for "${appId}"`);
  // Unpublishing hides an app from the store. It deliberately does NOT
  // revoke entitlements — people who bought it keep it, which is how
  // every real store behaves and the only defensible answer.
  listing.published = false;
  return listing;
}

export function listStore(store, options = {}) {
  const { pricingModel = null, includeUnpublished = false } = options;
  return store.listings
    .filter((l) => (includeUnpublished || l.published))
    .filter((l) => (pricingModel === null || l.pricingModel === pricingModel));
}

// -- entitlements ------------------------------------------------------

export function getEntitlement(store, userId, appId) {
  return store.entitlements.find((e) => e.userId === userId && e.appId === appId) || null;
}

// The question every surface asks: may this user open this app?
export function hasAccess(store, userId, appId, now = Date.now()) {
  const entitlement = getEntitlement(store, userId, appId);
  if (!entitlement) return { allowed: false, reason: 'not installed' };
  if (entitlement.revokedAt !== null) return { allowed: false, reason: 'refunded' };
  if (entitlement.expiresAt !== null && entitlement.expiresAt <= now) {
    return { allowed: false, reason: 'subscription expired' };
  }
  return { allowed: true, reason: null };
}

// -- install & purchase ------------------------------------------------

// Installing is one call whether the app is free or paid. The caller
// should not have to branch on pricing model — that is the store's job,
// and making it the caller's job is how a paid app gets given away by
// a surface that forgot to check.
export async function install(store, options = {}) {
  const { userId, appId, settleFn = null, now = Date.now() } = options;

  if (!userId) throw new AppStoreError('install requires a userId');
  const listing = getListing(store, appId);
  if (!listing) throw new AppStoreError(`install: no listing for "${appId}"`);
  if (!listing.published) throw new AppStoreError(`install: "${appId}" is not published`);

  const existing = getEntitlement(store, userId, appId);
  if (existing && hasAccess(store, userId, appId, now).allowed) {
    // Already owned. Not an error — a store should be idempotent about
    // installing something you have.
    return { entitlement: existing, charged: 0, alreadyOwned: true };
  }

  let charged = 0;
  let publisherPayout = 0;
  let storeFee = 0;

  if (listing.pricingModel !== 'free') {
    if (typeof settleFn !== 'function') {
      throw new AppStoreError(
        `install: "${appId}" costs ${listing.priceVcoin} VCoin and requires a `
        + 'settleFn(legs, meta) that moves every leg atomically',
      );
    }
    charged = listing.priceVcoin;
    storeFee = round(charged * listing.takeRate);
    publisherPayout = round(charged - storeFee);

    // Two legs, same reasoning as V3 settlement everywhere else: the
    // publisher's earnings and the store's fee stay separately
    // auditable rather than netting into one movement.
    //
    // **One call, not two awaits.** Split, the second can fail on its
    // own -- the first just debited the same buyer -- and the throw
    // means the entitlement below is never written. The publisher has
    // been paid for an app the user does not own, and the buyer can
    // install again and pay again. `POST /api/vcoin/settle` moves every
    // leg or none.
    const legs = [{
      fromUserId: userId,
      toUserId: listing.publisherId,
      amount: publisherPayout,
      reason: `vaco_store_purchase:${appId}`,
    }];
    if (storeFee > 0) {
      legs.push({
        fromUserId: userId,
        toUserId: VACO_STORE_ACCOUNT,
        amount: storeFee,
        reason: `vaco_store_fee:${appId}`,
      });
    }
    await settleFn(legs, { reason: `vaco_store_install:${appId}:${userId}` });
  }

  const expiresAt = listing.pricingModel === 'subscription'
    ? now + PERIOD_DAYS[listing.subscriptionPeriod] * MS_PER_DAY
    : null;

  if (existing) {
    // Renewing or re-buying after expiry reuses the record so history
    // stays in one place.
    Object.assign(existing, {
      expiresAt, revokedAt: null, lastPurchasedAt: now, purchaseCount: existing.purchaseCount + 1,
    });
    listing.installs += 1;
    return { entitlement: existing, charged, publisherPayout, storeFee, alreadyOwned: false };
  }

  const entitlement = {
    userId,
    appId,
    pricingModel: listing.pricingModel,
    pricePaid: charged,
    expiresAt,
    revokedAt: null,
    purchaseCount: 1,
    installedAt: now,
    lastPurchasedAt: now,
  };
  store.entitlements.push(entitlement);
  listing.installs += 1;
  return { entitlement, charged, publisherPayout, storeFee, alreadyOwned: false };
}

// Uninstalling is not refunding. A user who removes an app they paid
// for keeps the entitlement — reinstalling must not charge them twice.
export function uninstall(store, options = {}) {
  const { userId, appId } = options;
  const entitlement = getEntitlement(store, userId, appId);
  if (!entitlement) throw new AppStoreError(`uninstall: "${userId}" has no entitlement for "${appId}"`);
  entitlement.uninstalledAt = Date.now();
  return entitlement;
}

// Refunding reverses the money AND the access. Distinct from
// uninstalling on purpose.
export async function refund(store, options = {}) {
  const { userId, appId, settleFn = null, reason = 'unspecified', now = Date.now() } = options;
  const entitlement = getEntitlement(store, userId, appId);
  if (!entitlement) throw new AppStoreError(`refund: "${userId}" has no entitlement for "${appId}"`);
  if (entitlement.revokedAt !== null) throw new AppStoreError(`refund: "${appId}" was already refunded`);

  const listing = getListing(store, appId);
  if (entitlement.pricePaid > 0) {
    if (typeof settleFn !== 'function') {
      throw new AppStoreError('refund of a paid app requires a settleFn(legs, meta)');
    }
    const storeFee = round(entitlement.pricePaid * listing.takeRate);
    const publisherPortion = round(entitlement.pricePaid - storeFee);
    // Both parties give back their share. The store refunding its fee
    // out of the publisher's pocket would be the easy shortcut and the
    // wrong one.
    //
    // **Worse than the purchase if split.** Two different payers refund
    // one user, so a failure between them leaves the publisher out of
    // pocket while the store keeps its fee -- and `revokedAt` below is
    // never set, so the guard at the top of this function still permits
    // a retry that refunds the publisher a second time.
    const legs = [{
      fromUserId: listing.publisherId,
      toUserId: userId,
      amount: publisherPortion,
      reason: `vaco_store_refund:${appId}`,
    }];
    if (storeFee > 0) {
      legs.push({
        fromUserId: VACO_STORE_ACCOUNT,
        toUserId: userId,
        amount: storeFee,
        reason: `vaco_store_fee_refund:${appId}`,
      });
    }
    await settleFn(legs, { reason: `vaco_store_refund:${appId}:${userId}` });
  }

  entitlement.revokedAt = now;
  entitlement.refundReason = reason;
  return entitlement;
}

// -- reading -----------------------------------------------------------

export function listLibrary(store, userId, now = Date.now()) {
  return store.entitlements
    .filter((e) => e.userId === userId)
    .map((e) => ({ ...e, access: hasAccess(store, userId, e.appId, now) }));
}

export function publisherEarnings(store, publisherId) {
  const listings = store.listings.filter((l) => l.publisherId === publisherId);
  let gross = 0;
  let fees = 0;
  for (const listing of listings) {
    for (const e of store.entitlements) {
      if (e.appId !== listing.appId || e.revokedAt !== null) continue;
      gross = round(gross + e.pricePaid * e.purchaseCount);
      fees = round(fees + e.pricePaid * e.purchaseCount * listing.takeRate);
    }
  }
  return {
    publisherId,
    listings: listings.length,
    grossVcoin: gross,
    storeFees: fees,
    netVcoin: round(gross - fees),
  };
}

export function describeStore(store) {
  const byModel = {};
  for (const l of store.listings) byModel[l.pricingModel] = (byModel[l.pricingModel] || 0) + 1;
  return {
    listings: store.listings.length,
    published: store.listings.filter((l) => l.published).length,
    byPricingModel: byModel,
    entitlements: store.entitlements.length,
    defaultTakeRate: DEFAULT_STORE_TAKE_RATE,
    storeAccount: VACO_STORE_ACCOUNT,
  };
}

export {
  PRICING_MODELS,
  SUBSCRIPTION_PERIODS,
  DEFAULT_STORE_TAKE_RATE,
  VACO_STORE_ACCOUNT,
  PERIOD_DAYS,
  AppStoreError,
};
