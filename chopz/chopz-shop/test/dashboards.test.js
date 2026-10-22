// CHOPZ SHOP — Creator and Seller Dashboards, and trending products.
//
// Every number these report is a real aggregation over real orders
// and real affiliate links — these tests exist to prove the
// aggregation math itself, not just that a function returns.

const test = require('node:test');
const assert = require('node:assert');

const { createChopzShopStore } = require('../lib/store');
const products = require('../lib/products');
const affiliateLinks = require('../lib/affiliateLinks');
const orders = require('../lib/orders');
const { creatorDashboard, sellerDashboard, trendingProducts } = require('../lib/dashboards');

const NOW = Date.UTC(2026, 5, 1);

function ledger(initial = {}) {
  const balances = { ...initial };
  const fn = async (legs) => {
    for (const { fromUserId: from, toUserId: to, amount } of legs) {
      balances[from] = (balances[from] || 0) - amount;
      balances[to] = (balances[to] || 0) + amount;
    }
    return { ok: true };
  };
  return fn;
}

// -- Creator dashboard ----------------------------------------------------

test('creatorDashboard sums real clicks, conversions and commission across every one of a creator\'s links', async () => {
  const store = createChopzShopStore();
  const settleFn = ledger({ buyer1: 1000, buyer2: 1000 });
  const productA = products.createProduct(store, { sellerId: 'seller1', name: 'Hat', price: 50, affiliateCommissionPercent: 0.1, category: 'general' });
  const productB = products.createProduct(store, { sellerId: 'seller1', name: 'Shirt', price: 100, affiliateCommissionPercent: 0.1, category: 'apparel' });

  const linkA = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: productA.id });
  const linkB = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: productB.id });
  affiliateLinks.recordClick(store, { linkId: linkA.id, buyerId: 'buyer1', now: NOW });
  affiliateLinks.recordClick(store, { linkId: linkA.id, buyerId: 'buyer2', now: NOW });
  affiliateLinks.recordClick(store, { linkId: linkB.id, buyerId: 'buyer1', now: NOW });

  await orders.createOrder(store, { buyerId: 'buyer1', productId: productA.id, affiliateLinkId: linkA.id, settleFn, now: NOW });
  await orders.createOrder(store, { buyerId: 'buyer1', productId: productB.id, affiliateLinkId: linkB.id, settleFn, now: NOW });

  const dash = creatorDashboard(store, 'kaya');
  assert.strictEqual(dash.linkCount, 2);
  assert.strictEqual(dash.totalClicks, 3);
  assert.strictEqual(dash.totalConversions, 2);
  assert.strictEqual(dash.conversionRate, Math.round((2 / 3) * 100) / 100);
  // 10% of 50 + 10% of 100 = 5 + 10 = 15
  assert.strictEqual(dash.totalCommissionEarned, 15);
  assert.strictEqual(dash.topLink.linkId, linkB.id, 'the higher-commission link should rank first');
});

test('creatorDashboard reports an unmeasured conversion rate as null, not a fabricated zero', () => {
  const store = createChopzShopStore();
  const product = products.createProduct(store, { sellerId: 's1', name: 'Mug', price: 20, affiliateCommissionPercent: 0.1, category: 'general' });
  affiliateLinks.createAffiliateLink(store, { creatorId: 'nobody-clicked', productId: product.id });
  const dash = creatorDashboard(store, 'nobody-clicked');
  assert.strictEqual(dash.totalClicks, 0);
  assert.strictEqual(dash.conversionRate, null);
});

test('creatorDashboard for a creator with no links reports real, empty zeros', () => {
  const store = createChopzShopStore();
  const dash = creatorDashboard(store, 'ghost');
  assert.strictEqual(dash.linkCount, 0);
  assert.strictEqual(dash.totalCommissionEarned, 0);
  assert.strictEqual(dash.topLink, null);
});

// -- Seller dashboard -------------------------------------------------

test('sellerDashboard sums real revenue, fees and affiliate share across a seller\'s own orders only', async () => {
  const store = createChopzShopStore();
  const settleFn = ledger({ buyer1: 1000 });
  const productMine = products.createProduct(store, { sellerId: 'maker', name: 'Tee', price: 100, affiliateCommissionPercent: 0.1, category: 'apparel' });
  const productOther = products.createProduct(store, { sellerId: 'other-seller', name: 'Mug', price: 20, affiliateCommissionPercent: 0, category: 'general' });

  const link = affiliateLinks.createAffiliateLink(store, { creatorId: 'kaya', productId: productMine.id });
  await orders.createOrder(store, { buyerId: 'buyer1', productId: productMine.id, affiliateLinkId: link.id, settleFn, now: NOW });
  await orders.createOrder(store, { buyerId: 'buyer1', productId: productMine.id, settleFn, now: NOW }); // no affiliate this time
  await orders.createOrder(store, { buyerId: 'buyer1', productId: productOther.id, settleFn, now: NOW }); // a different seller entirely

  const dash = sellerDashboard(store, 'maker');
  assert.strictEqual(dash.orderCount, 2, 'the other seller\'s order must not be counted');
  assert.strictEqual(dash.affiliateOrderCount, 1);
  assert.strictEqual(dash.affiliateOrderShare, 0.5);
  assert.strictEqual(dash.topProducts.length, 1);
  assert.strictEqual(dash.topProducts[0].orderCount, 2);
});

test('sellerDashboard reports an unmeasured affiliate share as null for a seller with no orders at all', () => {
  const store = createChopzShopStore();
  const dash = sellerDashboard(store, 'brand-new-seller');
  assert.strictEqual(dash.orderCount, 0);
  assert.strictEqual(dash.affiliateOrderShare, null);
});

// -- Trending products (real product discovery) ------------------------

test('trendingProducts ranks by real order count, most-ordered first', async () => {
  const store = createChopzShopStore();
  const settleFn = ledger({ buyer1: 1000 });
  const popular = products.createProduct(store, { sellerId: 's1', name: 'Popular Mug', price: 10, affiliateCommissionPercent: 0, category: 'general' });
  const rare = products.createProduct(store, { sellerId: 's1', name: 'Rare Hat', price: 10, affiliateCommissionPercent: 0, category: 'general' });

  await orders.createOrder(store, { buyerId: 'buyer1', productId: popular.id, settleFn, now: NOW });
  await orders.createOrder(store, { buyerId: 'buyer1', productId: popular.id, settleFn, now: NOW });
  await orders.createOrder(store, { buyerId: 'buyer1', productId: rare.id, settleFn, now: NOW });

  const trending = trendingProducts(store, { limit: 10 });
  assert.strictEqual(trending[0].productId, popular.id);
  assert.strictEqual(trending[0].orderCount, 2);
  assert.strictEqual(trending[1].productId, rare.id);
});

test('trendingProducts respects its limit', async () => {
  const store = createChopzShopStore();
  const settleFn = ledger({ buyer1: 1000 });
  for (let i = 0; i < 5; i += 1) {
    const p = products.createProduct(store, { sellerId: 's1', name: `Item ${i}`, price: 10, affiliateCommissionPercent: 0, category: 'general' });
    await orders.createOrder(store, { buyerId: 'buyer1', productId: p.id, settleFn, now: NOW });
  }
  const trending = trendingProducts(store, { limit: 2 });
  assert.strictEqual(trending.length, 2);
});
