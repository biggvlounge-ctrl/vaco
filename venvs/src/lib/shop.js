// VENVS — Shop (Amazon-style).
// Source of truth: CLAUDE.md §1/§4: "Amazon-style Shop" as one of the
// 5 analog-mode tabs, distinct from Marketplace's "Facebook-
// Marketplace-style peer resale" (multi-seller, branded storefronts,
// Phase 3). Shop is VENVS's own single retail catalog -- no
// third-party sellers, no per-seller payout split. Every sale's
// revenue goes to the platform itself, same as real first-party
// Amazon retail vs. its separate marketplace program.
//
// No source doc specifies actual products or prices -- an
// interpretive, real, testable catalog, same posture as every other
// invented-content phase in this project.

const PLATFORM_USER_ID = 'venvs-platform';

export function createShop() {
  return { products: [], nextProductId: 1 };
}

export function listProduct(shop, options = {}) {
  const { title, price, category = null } = options;
  if (!title) {
    throw new Error('listProduct requires a title');
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('listProduct requires a positive price');
  }
  const product = { id: shop.nextProductId++, title, price, category, createdAt: Date.now() };
  shop.products.push(product);
  return product;
}

export function getProduct(shop, productId) {
  return shop.products.find((p) => p.id === productId) || null;
}

export function browseProducts(shop, options = {}) {
  const { category } = options;
  return shop.products.filter((p) => (category ? p.category === category : true));
}

export async function buyNow(shop, options = {}) {
  const { productId, buyerId, transferFn } = options;
  if (typeof transferFn !== 'function') {
    throw new Error('buyNow requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  const product = getProduct(shop, productId);
  if (!product) {
    throw new Error(`buyNow: no product with id ${productId}`);
  }
  if (!buyerId) {
    throw new Error('buyNow requires a buyerId');
  }

  await transferFn(buyerId, PLATFORM_USER_ID, product.price, `venvs_shop_purchase:${product.id}`);
  return { product, pricePaid: product.price };
}

export { PLATFORM_USER_ID };
