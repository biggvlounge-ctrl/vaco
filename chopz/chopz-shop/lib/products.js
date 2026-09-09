// CHOPZ SHOP -- Products.
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model: `Product { id, sellerId, price, affiliateCommissionPercent }`.
//
// affiliateCommissionPercent is real, seller-set, performance-only --
// per CHOPZ_TIKTOK_COMPARABLES.md's real TikTok Shop detail (5-20%,
// seller-set, no upfront cost to the brand). A product can set it to
// 0 (no affiliate program), but the field is always present since any
// product can become affiliate-eligible.
//
// **Real, flagged schema extension**: `category` isn't in the doc's
// own literal `Product` shape above, but it's the real, necessary
// input behind `orders.js`'s own category-based fee lookup (per
// `CHOPZ_TIKTOK_COMPARABLES.md`'s own real "5-8% depending on
// category, apparel runs higher, ~15%" detail) -- optional and
// unvalidated against a fixed enum, since the doc names only two real
// data points (general, apparel), not a closed category list.

function createProduct(store, options = {}) {
  const {
    sellerId, price, affiliateCommissionPercent = 0, category = null,
  } = options;

  if (!sellerId) throw new Error('createProduct requires a sellerId');
  if (!Number.isFinite(price) || price <= 0) throw new Error('createProduct requires a positive price');
  if (!Number.isFinite(affiliateCommissionPercent) || affiliateCommissionPercent < 0 || affiliateCommissionPercent >= 1) {
    throw new Error('createProduct requires an affiliateCommissionPercent between 0 and 1 (exclusive of 1)');
  }

  const product = {
    id: store.nextProductId++,
    sellerId,
    price,
    affiliateCommissionPercent,
    category,
    createdAt: Date.now(),
  };
  store.products.push(product);
  return product;
}

function getProduct(store, productId) {
  return store.products.find((p) => p.id === productId) || null;
}

module.exports = { createProduct, getProduct };
