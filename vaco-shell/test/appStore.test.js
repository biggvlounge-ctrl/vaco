// VACO — the App Store.
//
// The failure modes worth testing here are the quiet ones. A paid app
// installed without a transferFn would return a perfectly good
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

// A transferFn that records instead of calling V3. Every money
// assertion below reads this rather than trusting a return value.
function recordingTransfers() {
  const moves = [];
  const fn = async (from, to, amount, reason) => {
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
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

test('installing a free app needs no transferFn and moves no money', async () => {
  const store = storeWithListings();
  const result = await install(store, { userId: 'sam', appId: 'void' });
  assert.equal(result.charged, 0);
  assert.equal(hasAccess(store, 'sam', 'void').allowed, true);
});

test('installing a paid app without a transferFn is refused, not given away', async () => {
  const store = storeWithListings();
  await assert.rejects(
    () => install(store, { userId: 'sam', appId: 'vacon-c' }),
    /requires a transferFn/,
  );
  // And crucially: no entitlement was created on the way to failing.
  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, false);
});

test('a paid install splits publisher payout and store fee into two transfers', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  const result = await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });

  assert.equal(result.charged, 100);
  assert.equal(result.storeFee, 100 * DEFAULT_STORE_TAKE_RATE);
  assert.equal(result.publisherPayout, 85);

  // Two movements, separately auditable — not one netted transfer.
  assert.equal(transferFn.moves.length, 2);
  assert.deepEqual(transferFn.moves[0], {
    from: 'sam', to: 'vega', amount: 85, reason: 'vaco_store_purchase:vacon-c',
  });
  assert.deepEqual(transferFn.moves[1], {
    from: 'sam', to: VACO_STORE_ACCOUNT, amount: 15, reason: 'vaco_store_fee:vacon-c',
  });
});

test('installing something already owned is idempotent and does not charge twice', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  const second = await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });

  assert.equal(second.alreadyOwned, true);
  assert.equal(second.charged, 0);
  assert.equal(transferFn.moves.length, 2, 'the second install must not move money');
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
  const transferFn = recordingTransfers();
  const t0 = Date.UTC(2026, 0, 1);
  await install(store, { userId: 'sam', appId: 'venvm', transferFn, now: t0 });

  assert.equal(hasAccess(store, 'sam', 'venvm', t0 + 29 * DAY).allowed, true);
  const expired = hasAccess(store, 'sam', 'venvm', t0 + 31 * DAY);
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, 'subscription expired');

  // Renewing after expiry charges again and extends, without creating
  // a second entitlement row for the same user and app.
  const renewal = await install(store, { userId: 'sam', appId: 'venvm', transferFn, now: t0 + 31 * DAY });
  assert.equal(renewal.charged, 40);
  assert.equal(renewal.entitlement.purchaseCount, 2);
  assert.equal(store.entitlements.filter((e) => e.userId === 'sam' && e.appId === 'venvm').length, 1);
  assert.equal(hasAccess(store, 'sam', 'venvm', t0 + 32 * DAY).allowed, true);
});

// -- uninstall vs refund -----------------------------------------------

test('uninstalling is not refunding — access and money both survive', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  uninstall(store, { userId: 'sam', appId: 'vacon-c' });

  assert.equal(hasAccess(store, 'sam', 'vacon-c').allowed, true,
    'reinstalling must not charge a second time');
  assert.equal(transferFn.moves.length, 2);
});

test('a refund reverses both shares from the parties that received them', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  transferFn.moves.length = 0;

  await refund(store, { userId: 'sam', appId: 'vacon-c', transferFn, reason: 'did not work' });

  assert.equal(transferFn.moves.length, 2);
  // The publisher gives back its 85 and the store gives back its 15.
  // The store refunding out of the publisher's pocket is the shortcut
  // this asserts against.
  assert.deepEqual(transferFn.moves[0], {
    from: 'vega', to: 'sam', amount: 85, reason: 'vaco_store_refund:vacon-c',
  });
  assert.deepEqual(transferFn.moves[1], {
    from: VACO_STORE_ACCOUNT, to: 'sam', amount: 15, reason: 'vaco_store_fee_refund:vacon-c',
  });

  const access = hasAccess(store, 'sam', 'vacon-c');
  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'refunded');
});

test('refunding twice is refused', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  await refund(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  await assert.rejects(
    () => refund(store, { userId: 'sam', appId: 'vacon-c', transferFn }),
    /already refunded/,
  );
});

// -- reading -----------------------------------------------------------

test('a library reports access alongside each entitlement', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'void' });
  await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  await refund(store, { userId: 'sam', appId: 'vacon-c', transferFn });

  const library = listLibrary(store, 'sam');
  assert.equal(library.length, 2);
  assert.equal(library.find((e) => e.appId === 'void').access.allowed, true);
  assert.equal(library.find((e) => e.appId === 'vacon-c').access.allowed, false);
});

test('publisher earnings exclude refunded purchases', async () => {
  const store = storeWithListings();
  const transferFn = recordingTransfers();
  await install(store, { userId: 'sam', appId: 'vacon-c', transferFn });
  await install(store, { userId: 'ada', appId: 'vacon-c', transferFn });
  assert.equal(publisherEarnings(store, 'vega').grossVcoin, 200);

  await refund(store, { userId: 'ada', appId: 'vacon-c', transferFn });
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
