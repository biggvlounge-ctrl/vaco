// VACO Merch Store — one storefront, every app brand.
//
// Built to `VACO_MERCH_STORE.md`'s own `VacoMerchProduct` shape rather
// than a reinvented one:
//
//   VacoMerchProduct { id, appBrandId, productType, designAssetUrl,
//                      fulfillmentProvider, isZeroInventory: true }
//
// **Zero-inventory is the whole model, and it is enforced rather than
// assumed.** Nothing is manufactured until a real order exists — no
// stock, no warehousing, no minimum order quantities. That is what
// makes launching merch for every app brand simultaneously realistic
// instead of a capital commitment. `isZeroInventory` is fixed true and
// cannot be set false by a caller, because a product that needed
// warehousing would silently break that promise.
//
// **Printify is the primary provider**, per the source document's own
// recommendation: a multi-brand dashboard that fits VACO's many-app
// structure, and materially better margins than Printful (~$4 cheaper
// per shirt, roughly $400/month more profit at 100 sales/month).
// Printful and Fourthwall are supported as alternates.
//
// **What this does NOT do**, stated plainly because the source document
// assumes it: there is no live Printify/Printful API integration here.
// An order is recorded and marked for fulfilment; nothing is actually
// manufactured or shipped. That is a real vendor integration and the
// seam is `submitToFulfilment`.
//
// Nor does the AI illustration layer exist. The source document expects
// designs to come from "VACO's existing AI illustration layer" — VENVM
// models the production process but cannot generate media. So
// `designAssetUrl` is a reference to art that must come from somewhere
// else today.

const PRODUCT_TYPES = ['apparel', 'watch-band', 'mug', 'accessory', 'other'];

const FULFILMENT_PROVIDERS = ['printify', 'printful', 'fourthwall'];

//: The source document's recommendation, made the default rather than
//: left to each caller.
const DEFAULT_FULFILMENT_PROVIDER = 'printify';

const ORDER_STATUSES = ['placed', 'submitted', 'in-production', 'shipped', 'delivered', 'cancelled'];

//: Flagged interpretive: no source document sets a merch margin. This
//: is the platform's cut of the retail price after the fulfilment cost
//: is paid, and it is deliberately separate from the App Store's take
//: rate — selling a mug and selling an app are different businesses.
const DEFAULT_MERCH_TAKE_RATE = 0.20;

//: Where merch revenue settles. Distinct from the store account, again
//: because these are separate lines that should report separately.
const VACO_MERCH_ACCOUNT = 'vaco-merch';

class MerchError extends Error {}

function round(n) {
  return Math.round(n * 100) / 100;
}

// -- products ----------------------------------------------------------

export function createProduct(store, options = {}) {
  const {
    productId, appBrandId, name, productType,
    designAssetUrl = null, retailPriceVcoin, fulfilmentCostVcoin,
    fulfillmentProvider = DEFAULT_FULFILMENT_PROVIDER,
    takeRate = DEFAULT_MERCH_TAKE_RATE, now = Date.now(),
  } = options;

  if (!productId) throw new MerchError('createProduct requires a productId');
  if (!appBrandId) throw new MerchError('createProduct requires an appBrandId');
  if (!name) throw new MerchError('createProduct requires a name');
  if (!PRODUCT_TYPES.includes(productType)) {
    throw new MerchError(`createProduct: productType must be one of ${PRODUCT_TYPES.join(', ')}`);
  }
  if (!FULFILMENT_PROVIDERS.includes(fulfillmentProvider)) {
    throw new MerchError(`createProduct: fulfillmentProvider must be one of ${FULFILMENT_PROVIDERS.join(', ')}`);
  }
  if (!Number.isFinite(retailPriceVcoin) || retailPriceVcoin <= 0) {
    throw new MerchError('createProduct requires a positive retailPriceVcoin');
  }
  if (!Number.isFinite(fulfilmentCostVcoin) || fulfilmentCostVcoin < 0) {
    throw new MerchError('createProduct requires a non-negative fulfilmentCostVcoin');
  }
  // Selling below cost is a real mistake that a zero-inventory model
  // makes easy: there is no stock sitting there to make the loss
  // obvious, so every unit sold quietly loses money.
  if (retailPriceVcoin <= fulfilmentCostVcoin) {
    throw new MerchError(
      `createProduct: retail ${retailPriceVcoin} does not cover fulfilment cost ${fulfilmentCostVcoin}`,
    );
  }
  // **`takeRate` had no validation, and it is the one field here that
  // can overcharge a customer.** `placeOrder` derives the platform fee
  // from it and gives the brand the residual, so a rate above 1 makes
  // the brand's share negative — and a negative leg is dropped rather
  // than refused, leaving the customer charged the fee anyway.
  // Measured, at `takeRate: 3` on a 30 VCoin tee: 70 VCoin left the
  // customer's balance against an order record that says `total: 30`.
  // A negative rate inverts it — the brand is paid more than the whole
  // margin and the customer funds that too.
  //
  // 1 is allowed: a platform taking the entire margin is a business
  // decision, and the arithmetic still balances at exactly 1 because
  // the brand's residual is zero rather than negative.
  //
  // `appStore.js` bounds its own take rate at `>= 1`, excluding 1, and
  // the difference is deliberate rather than drift: a listing whose
  // publisher receives nothing for every sale is not a pricing choice
  // anyone makes on purpose, whereas merch has house-brand products
  // where the brand and the platform are the same party. Scanning for
  // this shape across every money module found only these two rates,
  // and the app store's was already checked.
  if (!Number.isFinite(takeRate) || takeRate < 0 || takeRate > 1) {
    throw new MerchError(
      `createProduct: takeRate must be between 0 and 1, got ${takeRate}`,
    );
  }

  if (store.merchProducts.some((p) => p.productId === productId)) {
    throw new MerchError(`createProduct: "${productId}" already exists`);
  }

  const product = {
    productId,
    appBrandId,
    name,
    productType,
    designAssetUrl,
    fulfillmentProvider,
    // Fixed, not caller-settable. A product that needed warehousing
    // would silently break the model this store is built on.
    isZeroInventory: true,
    retailPriceVcoin,
    fulfilmentCostVcoin,
    takeRate,
    available: true,
    createdAt: now,
  };
  store.merchProducts.push(product);
  return product;
}

export function getProduct(store, productId) {
  return store.merchProducts.find((p) => p.productId === productId) || null;
}

// The storefront query: everything for one app brand. This is what
// makes it "one unified storefront serving every app brand" rather
// than fourteen separate shops.
export function listByBrand(store, appBrandId) {
  return store.merchProducts.filter((p) => p.appBrandId === appBrandId && p.available);
}

export function listBrands(store) {
  const brands = new Map();
  for (const p of store.merchProducts) {
    if (!p.available) continue;
    brands.set(p.appBrandId, (brands.get(p.appBrandId) || 0) + 1);
  }
  return [...brands.entries()]
    .map(([appBrandId, products]) => ({ appBrandId, products }))
    .sort((a, b) => b.products - a.products);
}

export function discontinueProduct(store, productId) {
  const product = getProduct(store, productId);
  if (!product) throw new MerchError(`discontinueProduct: no product "${productId}"`);
  // Zero inventory means discontinuing costs nothing — there is no
  // stock to write off. That is the model's quiet advantage.
  product.available = false;
  return product;
}

// -- orders ------------------------------------------------------------

export async function placeOrder(store, options = {}) {
  const {
    customerId, productId, quantity = 1, shippingRef = null,
    settleFn = null, now = Date.now(),
  } = options;

  if (!customerId) throw new MerchError('placeOrder requires a customerId');
  const product = getProduct(store, productId);
  if (!product) throw new MerchError(`placeOrder: no product "${productId}"`);
  if (!product.available) throw new MerchError(`placeOrder: "${productId}" is discontinued`);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new MerchError('placeOrder requires a positive integer quantity');
  }
  if (typeof settleFn !== 'function') {
    throw new MerchError('placeOrder requires a settleFn(legs, meta) that moves every leg atomically');
  }

  const total = round(product.retailPriceVcoin * quantity);
  const fulfilmentCost = round(product.fulfilmentCostVcoin * quantity);
  const grossMargin = round(total - fulfilmentCost);
  const platformFee = round(grossMargin * product.takeRate);
  const brandPayout = round(grossMargin - platformFee);

  // **Checked here as well as at creation, because this store is
  // loaded from a file or from Postgres.** `createProduct` now refuses
  // a `takeRate` outside 0..1, but a product written before that check
  // existed comes back from persistence with whatever it was saved
  // with, and this is the line where a bad rate actually takes money.
  // Refusing the order is the right end: the alternative is charging a
  // customer an amount the order record itself contradicts.
  if (brandPayout < 0 || platformFee < 0) {
    throw new MerchError(
      `placeOrder: "${productId}" has takeRate ${product.takeRate}, which splits a `
      + `${grossMargin} margin into a ${platformFee} fee and a ${brandPayout} brand payout`,
    );
  }

  // The customer pays once; the money splits three ways. Fulfilment
  // cost goes to the provider account, the brand keeps most of the
  // margin, the platform takes its rate of the margin — not of the
  // retail price, which would eat the brand's share on low-margin
  // items.
  //
  // **Three legs is the worst case for splitting them.** Written as
  // three consecutive awaits there were two windows for a partial
  // failure, and the order record below is only written after all of
  // them — so any failure left money moved, no order, and a customer
  // free to buy again. `POST /api/vcoin/settle` validates all three
  // against running balances and writes nothing unless every one of
  // them passes.
  const legs = [{
    fromUserId: customerId,
    toUserId: `merch-fulfilment:${product.fulfillmentProvider}`,
    amount: fulfilmentCost,
    reason: `vaco_merch_fulfilment:${productId}`,
  }];
  if (brandPayout > 0) {
    legs.push({
      fromUserId: customerId,
      toUserId: `brand:${product.appBrandId}`,
      amount: brandPayout,
      reason: `vaco_merch_brand_payout:${productId}`,
    });
  }
  if (platformFee > 0) {
    legs.push({
      fromUserId: customerId,
      toUserId: VACO_MERCH_ACCOUNT,
      amount: platformFee,
      reason: `vaco_merch_platform_fee:${productId}`,
    });
  }
  await settleFn(legs, { reason: `vaco_merch_order:${productId}:${customerId}` });

  const order = {
    id: store.nextMerchOrderId++,
    customerId,
    productId,
    appBrandId: product.appBrandId,
    quantity,
    total,
    fulfilmentCost,
    brandPayout,
    platformFee,
    fulfillmentProvider: product.fulfillmentProvider,
    shippingRef,
    status: 'placed',
    // Nothing exists yet. This is the point of zero inventory: the
    // order is what triggers manufacture.
    manufacturedAt: null,
    createdAt: now,
  };
  store.merchOrders.push(order);
  return order;
}

export function getOrder(store, orderId) {
  return store.merchOrders.find((o) => o.id === orderId) || null;
}

function requireOrder(store, orderId, action) {
  const order = getOrder(store, orderId);
  if (!order) throw new MerchError(`${action}: no order ${orderId}`);
  return order;
}

// The seam where a real Printify/Printful integration would go. Today
// it records intent; it does not call anyone.
export function submitToFulfilment(store, options = {}) {
  const { orderId, providerOrderRef = null, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'submitToFulfilment');
  if (order.status !== 'placed') {
    throw new MerchError(`submitToFulfilment: order ${orderId} is ${order.status}, not placed`);
  }
  order.status = 'submitted';
  order.providerOrderRef = providerOrderRef;
  order.submittedAt = now;
  order.integrationNote = 'recorded only — no live fulfilment API is connected';
  return order;
}

export function advanceOrder(store, options = {}) {
  const { orderId, to, now = Date.now() } = options;
  const order = requireOrder(store, orderId, 'advanceOrder');

  const allowed = {
    placed: ['submitted', 'cancelled'],
    submitted: ['in-production', 'cancelled'],
    'in-production': ['shipped'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  }[order.status];

  if (!allowed || !allowed.includes(to)) {
    throw new MerchError(
      `advanceOrder: order ${orderId} cannot go ${order.status} -> ${to}`
      + (allowed && allowed.length ? ` (allowed: ${allowed.join(', ')})` : ' (terminal)'),
    );
  }
  // Once it is in production it physically exists, which is the point
  // past which cancelling stops being free.
  if (to === 'in-production') order.manufacturedAt = now;
  order.status = to;
  return order;
}

export function listOrdersForCustomer(store, customerId) {
  return store.merchOrders.filter((o) => o.customerId === customerId);
}

export function brandEarnings(store, appBrandId) {
  const orders = store.merchOrders.filter(
    (o) => o.appBrandId === appBrandId && o.status !== 'cancelled',
  );
  return {
    appBrandId,
    orders: orders.length,
    unitsSold: orders.reduce((s, o) => s + o.quantity, 0),
    grossVcoin: round(orders.reduce((s, o) => s + o.total, 0)),
    fulfilmentCost: round(orders.reduce((s, o) => s + o.fulfilmentCost, 0)),
    brandPayout: round(orders.reduce((s, o) => s + o.brandPayout, 0)),
    platformFees: round(orders.reduce((s, o) => s + o.platformFee, 0)),
  };
}

export function describeMerch(store) {
  return {
    products: store.merchProducts.length,
    brands: listBrands(store).length,
    orders: store.merchOrders.length,
    zeroInventory: true,
    defaultProvider: DEFAULT_FULFILMENT_PROVIDER,
    defaultTakeRate: DEFAULT_MERCH_TAKE_RATE,
    notBuilt: [
      'no live Printify/Printful/Fourthwall API — orders are recorded, not manufactured',
      'no AI illustration layer — designAssetUrl must reference art created elsewhere',
    ],
  };
}

export {
  PRODUCT_TYPES,
  FULFILMENT_PROVIDERS,
  DEFAULT_FULFILMENT_PROVIDER,
  DEFAULT_MERCH_TAKE_RATE,
  VACO_MERCH_ACCOUNT,
  ORDER_STATUSES,
  MerchError,
};
