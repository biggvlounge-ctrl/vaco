// VACO — the App Store.
//
// The failure modes worth testing here are the quiet ones. A paid app
// installed without a settleFn would return a perfectly good
// entitlement and charge nobody. A refund that reversed access but not
// money, or money but not access, looks fine from either side alone. A
// subscription whose expiry is never checked never expires. None of
// these throw on their own.

import test from 'node:test';
import assert from 'node:assert';

import { createShellStore } from '../lib/store.js';
import {
  publishListing, getListing, unpublishListing, listStore,
  install, uninstall, refund, hasAccess, listLibrary,
  publisherEarnings, describeStore, DEFAULT_STORE_TAKE_RATE,
  VACO_STORE_ACCOUNT, AppStoreError,
} from '../lib/appStore.js';

const DAY = 24 * 60 * 60 * 1000;

// A settleFn that records instead of calling V3. Every money
// assertion below reads this rather than trusting a return value.
// **`moves` and `calls` answer different questions.** `moves` is every
// leg, flattened — what an assertion about who was paid what wants.
// `calls` is how many times the ledger was asked, which is the only
// thing that distinguishes an atomic settlement from the consecutive
// transfers it replaced: the amounts are identical either way, which is
// exactly how that defect survived a green suite.
function recordingTransfers() {
  const moves = [];
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const l of legs) {
      moves.push({ from: l.fromUserId, to: l.toUserId, amount: l.amount, reason: l.reason });
    }
    return { ok: true };
  };
  fn.moves = moves;
  fn.calls = calls;
  return fn;
}

function storeWithListings() {
  const store = createShellStore();
  publishListing(store, { appId: 'void', publisherId: 'vega', pricingModel: 'free' });
  publishListing(store, { appId: 'vacon-c', publisherId: 'vega', pricingModel: 'one-time', priceVcoin: 100 });
  publishListing(store, {
    appId: 'venvm', publisherId: 'vulture', pricingModel: 'subscription',
    priceVcoin: 40, subscriptionPeriod: 'monthly',
  });
  return store;
}

// -- listings ----------------------------------------------------------

test('a paid listing with no price is refused', () => {
  const store = createShellStore();
  assert.throws(
    () => publishListing(store, { appId: 'venvm', publisherId: 'vega', pricingModel: 'one-time' }),
    AppStoreError,
  );
  // The mirror case: a free listing that quietly carries a price.
  assert.throws(
    () => publishListing(store, { appId: 'venvm', publisherId: 'vega', pricingModel: 'free', priceVcoin: 10 }),
    AppStoreError,
  );
});

test('a subscription without a period is refused', () => {
  const store = createShellStore();
  assert.throws(() => publishListing(store, {
    appId: 'venvm', publisherId: 'vega', pricingModel: 'subscription', priceVcoin: 40,
  }), AppStoreError);
});

test('publishing a listing for an unregistered app is refused when a registry check is injected', () => {
  const store = createShellStore();
  const appExistsFn = (id) => id === 'void';
  assert.throws(
    () => publishListing(store, { appId: 'not-an-app', publisherId: 'vega', pricingModel: 'free', appExistsFn }),
    /not a registered app/,
  );
  assert.ok(publishListing(store, { appId: 'void', publisherId: 'vega', pricingModel: 'free', appExistsFn }));
});

test('republishing updates in place rather than duplicating', () => {
  const store = storeWithListings();
  publishListing(store, { appId: 'vacon-c', publisherId: 'vega', pricingModel: 'one-time', priceVcoin: 150 });
  assert.equal(store.listings.filter((l) => l.appId === 'vacon-c').length, 1);
  assert.equal(getListing(store, 'vacon-c').priceVcoin, 150);
});

// -- install -----------------------------------------------------------

test('installing a free app needs no settleFn and moves no money', async () => {
  const store = storeWithListings();
  const result = await install(store, { userId: 'sam', appId: 'void' });
  assert.equal(result.charged, 0);
  assert.equal(hasAccess(store, 'sam', 'void').allowed, true);
});

test('installing a paid app without a settleFn is refused, not given away', async () => {
  const store = storeWithListings();
  await assert.rejects(
    () => install(store, { userId: 'sam', appId: 'vacon-c' }),
    /requires a settleFn/,
  );
  // And crucially: no entitlement was created on the way to failing.
  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, false);
});

test('a paid install splits publisher payout and store fee into two legs of ONE settlement', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  const result = await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });

  assert.equal(result.charged, 100);
  assert.equal(result.storeFee, 100 * DEFAULT_STORE_TAKE_RATE);
  assert.equal(result.publisherPayout, 85);

  // Two movements, separately auditable — not one netted transfer.
  assert.equal(settleFn.moves.length, 2);
  // **The assertion arithmetic cannot make.** Both legs must reach the
  // ledger in one call. Split into consecutive transfers, every line in
  // this test still passes, and a failure between them pays the
  // publisher for an app the buyer never receives an entitlement for.
  assert.equal(settleFn.calls.length, 1, 'the settlement must be a single atomic call');
  assert.deepEqual(settleFn.moves[0], {
    from: 'sam', to: 'vega', amount: 85, reason: 'vaco_store_purchase:vacon-c',
  });
  assert.deepEqual(settleFn.moves[1], {
    from: 'sam', to: VACO_STORE_ACCOUNT, amount: 15, reason: 'vaco_store_fee:vacon-c',
  });
});

test('installing something already owned is idempotent and does not charge twice', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  const second = await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });

  assert.equal(second.alreadyOwned, true);
  assert.equal(second.charged, 0);
  assert.equal(settleFn.moves.length, 2, 'the second install must not move money');
});

test('an unpublished app cannot be installed but existing owners keep it', async () => {
  const store = storeWithListings();
  await install(store, { userId: 'sam', appId: 'void' });
  unpublishListing(store, 'void');

  await assert.rejects(() => install(store, { userId: 'ada', appId: 'void' }), /not published/);
  // The whole point of unpublish-not-revoke.
  assert.equal(hasAccess(store, 'sam', 'void').allowed, true);
  assert.equal(listStore(store).some((l) => l.appId === 'void'), false);
});

// -- subscriptions -----------------------------------------------------

test('a monthly subscription expires and renewal reuses the same record', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  const t0 = Date.UTC(2026, 0, 1);
  await install(store, { userId: 'sam', appId: 'venvm', settleFn, now: t0 });

  assert.equal(hasAccess(store, 'sam', 'venvm', t0 + 29 * DAY).allowed, true);
  const expired = hasAccess(store, 'sam', 'venvm', t0 + 31 * DAY);
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, 'subscription expired');

  // Renewing after expiry charges again and extends, without creating
  // a second entitlement row for the same user and app.
  const renewal = await install(store, { userId: 'sam', appId: 'venvm', settleFn, now: t0 + 31 * DAY });
  assert.equal(renewal.charged, 40);
  assert.equal(renewal.entitlement.purchaseCount, 2);
  assert.equal(store.entitlements.filter((e) => e.userId === 'sam' && e.appId === 'venvm').length, 1);
  assert.equal(hasAccess(store, 'sam', 'venvm', t0 + 32 * DAY).allowed, true);
});

// -- uninstall vs refund -----------------------------------------------

test('uninstalling is not refunding — access and money both survive', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  uninstall(store, { userId: 'sam', appId: 'vacon-c' });

  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, true,
    'reinstalling must not charge a second time');
  assert.equal(settleFn.moves.length, 2);
});

test('a refund reverses both shares from the parties that received them', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  settleFn.moves.length = 0;

  await refund(store, { userId: 'sam', appId: 'vacon-c', settleFn, reason: 'did not work' });

  assert.equal(settleFn.moves.length, 2);
  // The publisher gives back its 85 and the store gives back its 15.
  // The store refunding out of the publisher's pocket is the shortcut
  // this asserts against.
  assert.deepEqual(settleFn.moves[0], {
    from: 'vega', to: 'sam', amount: 85, reason: 'vaco_store_refund:vacon-c',
  });
  assert.deepEqual(settleFn.moves[1], {
    from: VACO_STORE_ACCOUNT, to: 'sam', amount: 15, reason: 'vaco_store_fee_refund:vacon-c',
  });

  const access = hasAccess(store, 'sam', 'vacon-c');
  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'refunded');
});

test('refunding twice is refused', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  await refund(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  await assert.rejects(
    () => refund(store, { userId: 'sam', appId: 'vacon-c', settleFn }),
    /already refunded/,
  );
});

// -- reading -----------------------------------------------------------

test('a library reports access alongside each entitlement', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'void' });
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  await refund(store, { userId: 'sam', appId: 'vacon-c', settleFn });

  const library = listLibrary(store, 'sam');
  assert.equal(library.length, 2);
  assert.equal(library.find((e) => e.appId === 'void').access.allowed, true);
  assert.equal(library.find((e) => e.appId === 'vacon-c').access.allowed, false);
});

test('publisher earnings exclude refunded purchases', async () => {
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });
  await install(store, { userId: 'ada', appId: 'vacon-c', settleFn });
  assert.equal(publisherEarnings(store, 'vega').grossVcoin, 200);

  await refund(store, { userId: 'ada', appId: 'vacon-c', settleFn });
  const earnings = publisherEarnings(store, 'vega');
  assert.equal(earnings.grossVcoin, 100);
  assert.equal(earnings.storeFees, 15);
  assert.equal(earnings.netVcoin, 85);
});

test('describeStore reports what is actually in the store', () => {
  const store = storeWithListings();
  const described = describeStore(store);
  assert.equal(described.listings, 3);
  assert.equal(described.published, 3);
  assert.equal(described.byPricingModel.free, 1);
  assert.equal(described.byPricingModel.subscription, 1);
});

// -- atomicity ----------------------------------------------------------

test('a refused install charges nobody and grants nothing', async () => {
  // The entitlement is written only after the money moves, so a refused
  // settlement must leave the user with neither the app nor a debit.
  const store = storeWithListings();
  const settleFn = async () => {
    throw new Error('legs[1]: Insufficient VCoin balance. Nothing in this settlement was applied.');
  };

  await assert.rejects(
    () => install(store, { userId: 'sam', appId: 'vacon-c', settleFn }),
    /Nothing in this settlement was applied/,
  );
  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, false);
});

test('a refund is ONE settlement, so a retry cannot refund the publisher twice', async () => {
  // **The worst shape in this file.** A refund has two different
  // payers — the publisher returns their share and the store returns
  // its fee. Written as consecutive transfers, a failure between them
  // leaves the publisher out of pocket while the store keeps its fee,
  // and `revokedAt` is never set — so the guard at the top of `refund`
  // still permits a retry that takes the publisher's money again.
  const store = storeWithListings();
  const settleFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', settleFn });

  let refuse = true;
  const flaky = async (legs, meta) => {
    if (refuse) {
      refuse = false;
      throw new Error('legs[1]: Insufficient VCoin balance. Nothing in this settlement was applied.');
    }
    return settleFn(legs, meta);
  };

  await assert.rejects(
    () => refund(store, { userId: 'sam', appId: 'vacon-c', settleFn: flaky }),
    /Nothing in this settlement was applied/,
  );
  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, true,
    'a refused refund revoked access anyway');

  await refund(store, { userId: 'sam', appId: 'vacon-c', settleFn: flaky });

  // Two legs out (the purchase), two legs back (the refund). A split
  // refund that failed once and retried would show three or four legs
  // coming back.
  const refundLegs = settleFn.moves.filter((m) => m.reason.includes('refund'));
  assert.equal(refundLegs.length, 2, 'the publisher or store refunded more than once');
  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, false);
});
