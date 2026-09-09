// CHOPZ SHOP — the three-way split, category fees, and attribution.
//
// **Why this file exists.** Real VCoin moves through escrow on every
// order and nothing asserted on it. The audit listed it among the
// untested money surfaces.
//
// The failures targeted are the ones an affiliate marketplace produces
// quietly:
//
//   - a split that does not add back up, so the seller is short and
//     nobody notices until a payout statement
//   - the wrong category fee applied, which is a systematic
//     underpayment rather than a one-off
//   - a commission paid to a creator who did not drive the sale, or
//     not paid to one who did
//   - a click outside the attribution window still earning
//
// Every assertion is on money or on attribution, never on a status.

const test = require('node:test');
const assert = require('node:assert');

const { createChopzShopStore } = require('../lib/store');
const products = require('../lib/products');
const affiliateLinks = require('../lib/affiliateLinks');
const orders = require('../lib/orders');

const NOW = Date.UTC(2026, 5, 1);
const HOUR = 3600000;

function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const opening = Object.values(balances).reduce((a, b) => a + b, 0);
  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error(`ledger: non-numeric transfer of ${amount} (${reason})`);
    }
    if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  fn.of = (a) => balances[a] || 0;
  // Sub-cent, not bit-exact: rounded shares do not re-add to the
  // original in IEEE-754. A stranded cent is structural; 1e-14 is not.
  fn.isDrained = (a) => Math.abs(fn.of(a)) < 0.01;
  fn.drift = () => Object.values(balances).reduce((a, b) => a + b, 0) - opening;
  return fn;
}

// -- The split ----------------------------------------------------------

test('an order splits three ways and adds back up to what the buyer paid', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, {
    sellerId: 'maker', price: 100, affiliateCommissionPercent: 0.1, category: 'general',
  });
  const transferFn = ledger({ sam: 500 });

  const link = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: product.id });
  const order = await orders.createOrder(store, {
    buyerId: 'sam', productId: product.id, affiliateLinkId: link.id, transferFn, now: NOW,
  });

  assert.ok(Math.abs(order.sellerPayout + order.platformFee + order.affiliateCommission - order.price) < 0.01,
    'the three shares must add back up to exactly what the buyer paid');
  assert.strictEqual(transferFn.of('sam'), 400);
  assert.ok(transferFn.isDrained(orders.CHOPZ_ESCROW_ACCOUNT),
    'escrow must be fully drained — money left there belongs to nobody');
  assert.ok(Math.abs(transferFn.drift()) < 0.01);
});

test('apparel is charged the apparel fee, not the general one', async () => {
  const store = createChopzShopStore();
  const transferFn = ledger({ sam: 1000 });

  const tee = products.createProduct(store, { sellerId: 'maker', price: 100, category: 'apparel' });
  const mug = products.createProduct(store, { sellerId: 'maker', price: 100, category: 'general' });

  const teeOrder = await orders.createOrder(store, {
    buyerId: 'sam', productId: tee.id, transferFn, now: NOW,
  });
  const mugOrder = await orders.createOrder(store, {
    buyerId: 'sam', productId: mug.id, transferFn, now: NOW,
  });

  // Applying one rate to both would be a systematic mispayment — the
  // seller is short on every apparel sale, or the platform is.
  assert.strictEqual(teeOrder.feePercent, orders.APPAREL_FEE_PERCENT);
  assert.strictEqual(mugOrder.feePercent, orders.DEFAULT_FEE_PERCENT);
  assert.ok(teeOrder.platformFee > mugOrder.platformFee,
    'apparel carries the higher rate, so the same price yields a higher fee');
  assert.ok(teeOrder.sellerPayout < mugOrder.sellerPayout);
});

test('a product with no category falls back to the general fee', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', price: 50 });
  const transferFn = ledger({ sam: 500 });

  const order = await orders.createOrder(store, {
    buyerId: 'sam', productId: product.id, transferFn, now: NOW,
  });
  assert.strictEqual(order.feePercent, orders.DEFAULT_FEE_PERCENT);
});

test('a failed charge leaves no order behind', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 'maker', price: 100, category: 'general' });
  const declining = async () => { throw new Error('insufficient funds'); };

  await assert.rejects(() => orders.createOrder(store, {
    buyerId: 'broke', productId: product.id, transferFn: declining, now: NOW,
  }), /insufficient funds/);

  // A 'placed' order for money that never moved would show the seller a
  // sale they were never paid for.
  assert.strictEqual(store.orders.length, 0);
});

// -- Attribution --------------------------------------------------------

test('no affiliate link means no commission — the seller keeps that share', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, {
    sellerId: 'maker', price: 100, affiliateCommissionPercent: 0.1, category: 'general',
  });
  const transferFn = ledger({ sam: 500 });

  const order = await orders.createOrder(store, {
    buyerId: 'sam', productId: product.id, transferFn, now: NOW,
  });

  assert.strictEqual(order.affiliateCommission, 0);
  assert.strictEqual(order.affiliateLinkId, null);
  // Paying a commission with nobody to pay it to would strand it in
  // escrow; not reallocating it to the seller would short them.
  assert.ok(Math.abs(order.sellerPayout + order.platformFee - order.price) < 0.01);
  assert.ok(transferFn.isDrained(orders.CHOPZ_ESCROW_ACCOUNT));
});

test('a real click earns the commission without the buyer naming the link', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, {
    sellerId: 'maker', price: 100, affiliateCommissionPercent: 0.1, category: 'general',
  });
  const transferFn = ledger({ sam: 500 });

  const link = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: product.id });
  affiliateLinks.recordClick(store, { linkId: link.id, buyerId: 'sam', now: NOW });

  // The buyer does not pass an affiliateLinkId — a real shopper never
  // would. Attribution has to find the click on its own or creators are
  // never paid for the sales they actually drive.
  const order = await orders.createOrder(store, {
    buyerId: 'sam', productId: product.id, transferFn, now: NOW + HOUR,
  });

  assert.strictEqual(order.affiliateLinkId, link.id);
  assert.ok(order.affiliateCommission > 0);
  assert.strictEqual(transferFn.of('kaya'), order.affiliateCommission);
  assert.strictEqual(affiliateLinks.getAffiliateLink(store, link.id).conversionsCount, 1);
});

test('one buyer’s click does not earn commission on another buyer’s order', async () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, {
    sellerId: 'maker', price: 100, affiliateCommissionPercent: 0.1, category: 'general',
  });
  const transferFn = ledger({ sam: 500, ada: 500 });

  const link = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: product.id });
  affiliateLinks.recordClick(store, { linkId: link.id, buyerId: 'sam', now: NOW });

  // Ada never clicked. Crediting kaya here would pay a creator for
  // traffic they did not send.
  const order = await orders.createOrder(store, {
    buyerId: 'ada', productId: product.id, transferFn, now: NOW + HOUR,
  });
  assert.strictEqual(order.affiliateCommission, 0);
  assert.strictEqual(transferFn.of('kaya'), 0);
});

test('a link generated for another product cannot be claimed on this one', async () => {
  const store = createChopzShopStore();
  const tee = products.createProduct(store, { sellerId: 'maker', price: 100, category: 'general' });
  const mug = products.createProduct(store, { sellerId: 'maker', price: 40, category: 'general' });
  const transferFn = ledger({ sam: 500 });

  const link = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: mug.id });
  await assert.rejects(() => orders.createOrder(store, {
    buyerId: 'sam', productId: tee.id, affiliateLinkId: link.id, transferFn, now: NOW,
  }), /different product/);
  assert.strictEqual(transferFn.of('sam'), 500, 'a refused order must not charge the buyer');
});

// -- Cart ---------------------------------------------------------------

test('a cart checkout charges every item and settles each one', async () => {
  const store = createChopzShopStore();
  const transferFn = ledger({ sam: 1000 });

  const a = products.createProduct(store, { sellerId: 'maker', price: 30, category: 'general' });
  const b = products.createProduct(store, { sellerId: 'other', price: 70, category: 'apparel' });

  const result = await orders.createCartCheckout(store, {
    buyerId: 'sam',
    items: [{ productId: a.id }, { productId: b.id }],
    transferFn,
  });

  assert.strictEqual(result.orders.length, 2);
  assert.strictEqual(result.totalCharged, 100);
  assert.strictEqual(transferFn.of('sam'), 900);
  // Two different sellers must each be paid their own share — a cart
  // that settles only the first item is the classic multi-seller bug.
  assert.ok(transferFn.of('maker') > 0);
  assert.ok(transferFn.of('other') > 0);
  assert.ok(transferFn.isDrained(orders.CHOPZ_ESCROW_ACCOUNT));
  assert.ok(Math.abs(transferFn.drift()) < 0.01);
});

test('cart items settle sequentially, so a later failure cannot un-pay an earlier seller', async () => {
  const store = createChopzShopStore();
  const good = products.createProduct(store, { sellerId: 'maker', price: 30, category: 'general' });

  let calls = 0;
  const flaky = async (from, to, amount) => {
    calls += 1;
    // Fail once the second item's buyer charge comes around.
    if (calls > 3) throw new Error('insufficient funds');
    return { ok: true };
  };

  await assert.rejects(() => orders.createCartCheckout(store, {
    buyerId: 'sam',
    items: [{ productId: good.id }, { productId: good.id }],
    transferFn: flaky,
  }), /insufficient funds/);

  // The first item genuinely completed. That is the correct outcome for
  // sequential settlement, and it is asserted rather than assumed: the
  // alternative — a partial rollback that un-pays a seller who was
  // already paid — is worse and harder to detect.
  assert.strictEqual(store.orders.length, 1);
  assert.strictEqual(store.orders[0].status, 'placed');
});

test('an empty cart is refused rather than charging nothing successfully', async () => {
  const store = createChopzShopStore();
  await assert.rejects(() => orders.createCartCheckout(store, {
    buyerId: 'sam', items: [], transferFn: ledger(),
  }), /non-empty/);
});
