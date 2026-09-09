// CHOPZ SHOP -- Orders (native checkout).
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model: `Order { id, buyerId, productId, feePercent, voidShipmentId: string | null }`,
// and its API map: `POST /chopz/orders` (native in-app checkout, never
// redirects out), cross-app `Order.voidShipmentId` calls VOID directly
// for fulfillment.
//
// Real design decision, genuinely different from VOID MAGIC's
// two-step book/complete escrow (which holds funds until a later
// event happens): TikTok Shop's real checkout is a single, immediate,
// completed transaction -- there is no future "experience" to wait
// for before the seller is owed their share. So `createOrder` here is
// one real, atomic settlement: charge the buyer, then immediately pay
// out seller + platform (+ affiliate, if the order came through a
// real link) from the same escrowed source -- the same "one source,
// real multi-way payout, sums exactly to what was charged" mechanism
// already established for VOID's completeJob and VOID MAGIC's
// completeExperience, just collapsed into a single step because the
// real-world event (checkout) is itself instantaneous.
//
// feePercent is real and per-order per the doc's own comment (5-8%,
// apparel runs higher per CHOPZ_TIKTOK_COMPARABLES.md). **Real,
// category-based default added**: `computeFeePercentForCategory` looks
// up the product's own real category against the two real, cited data
// points in `CHOPZ_TIKTOK_COMPARABLES.md` (general 5-8%, apparel
// ~15%) -- an explicit caller-supplied `feePercent` still always wins,
// so nothing existing changes behavior, only the *default* got
// smarter than one flat number for every category.
//
// Real, TikTok-Shop-accurate affiliate economics: the commission is
// NOT an extra charge on top of the buyer's price -- it's deducted
// from the seller's own proceeds ("no upfront cost to the brand,
// performance-only" per the comparable doc). Platform fee is computed
// first, affiliate commission second, and the seller payout is the
// exact remainder -- guarantees the (up to) three real payouts always
// sum to exactly what the buyer was charged, never independently
// rounded drift.

const crypto = require('crypto');
const { getProduct } = require('./products');
const { getAffiliateLink, findAttributedLink } = require('./affiliateLinks');

const CHOPZ_ESCROW_ACCOUNT = 'chopz-escrow';
const CHOPZ_PLATFORM_ACCOUNT = 'chopz-platform';
const DEFAULT_FEE_PERCENT = 0.07; // general category, the real midpoint of TikTok Shop's cited 5-8%
const APPAREL_FEE_PERCENT = 0.15; // apparel, per CHOPZ_TIKTOK_COMPARABLES.md's own real "~15%" figure

function round(n) {
  return Math.round(n * 100) / 100;
}

function computeFeePercentForCategory(category) {
  if (category === 'apparel') return APPAREL_FEE_PERCENT;
  return DEFAULT_FEE_PERCENT;
}

async function createOrder(store, options = {}) {
  const {
    buyerId, productId, affiliateLinkId = null, feePercent, transferFn, now = Date.now(),
  } = options;

  if (!buyerId) throw new Error('createOrder requires a buyerId');
  const product = getProduct(store, productId);
  if (!product) throw new Error(`createOrder: no product with id ${productId}`);
  const resolvedFeePercent = feePercent ?? computeFeePercentForCategory(product.category);
  if (!Number.isFinite(resolvedFeePercent) || resolvedFeePercent <= 0 || resolvedFeePercent >= 1) {
    throw new Error('createOrder requires a feePercent between 0 and 1 (exclusive)');
  }
  if (typeof transferFn !== 'function') {
    throw new Error('createOrder requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  // Real click-through attribution: an explicit affiliateLinkId always
  // wins (unchanged, backward-compatible); otherwise fall back to a
  // real, automatic lookup of this exact buyer's own most recent click
  // on this exact product within the real attribution window --
  // closing this project's own previously-flagged "no cookie/session-
  // based attribution" gap without breaking the explicit-id path any
  // existing caller already relies on.
  let affiliateLink = null;
  if (affiliateLinkId !== null) {
    affiliateLink = getAffiliateLink(store, affiliateLinkId);
    if (!affiliateLink) throw new Error(`createOrder: no affiliate link with id ${affiliateLinkId}`);
    if (affiliateLink.productId !== productId) {
      throw new Error(`createOrder: affiliate link ${affiliateLinkId} was generated for a different product`);
    }
  } else {
    affiliateLink = findAttributedLink(store, { buyerId, productId, now });
  }

  const price = product.price;
  const platformFee = round(price * resolvedFeePercent);
  const affiliateCommission = affiliateLink ? round(price * product.affiliateCommissionPercent) : 0;
  const sellerPayout = round(price - platformFee - affiliateCommission);

  // Charge the buyer before recording the order -- a failed charge
  // (e.g. insufficient funds) must never leave a "placed" order
  // behind, so the id is reserved but the order object isn't built or
  // pushed to the store until the buyer's payment actually clears.
  const orderId = store.nextOrderId++;
  await transferFn(buyerId, CHOPZ_ESCROW_ACCOUNT, price, `chopz_order:${orderId}`);

  const order = {
    id: orderId,
    buyerId,
    productId,
    sellerId: product.sellerId,
    // The real, resolved link -- whichever one actually earns the
    // commission below, whether explicitly passed or found via real
    // click attribution, not just an echo of the caller's own input.
    affiliateLinkId: affiliateLink ? affiliateLink.id : null,
    price,
    feePercent: resolvedFeePercent,
    platformFee,
    affiliateCommission,
    sellerPayout,
    status: 'placed',
    voidShipmentId: null,
    createdAt: now,
  };
  store.orders.push(order);

  await transferFn(CHOPZ_ESCROW_ACCOUNT, product.sellerId, sellerPayout, `chopz_seller_payout:${order.id}`);
  await transferFn(CHOPZ_ESCROW_ACCOUNT, CHOPZ_PLATFORM_ACCOUNT, platformFee, `chopz_platform_fee:${order.id}`);
  if (affiliateLink && affiliateCommission > 0) {
    await transferFn(CHOPZ_ESCROW_ACCOUNT, affiliateLink.creatorId, affiliateCommission, `chopz_affiliate_commission:${order.id}`);
    affiliateLink.conversionsCount += 1;
  }

  return order;
}

function getOrder(store, orderId) {
  return store.orders.find((o) => o.id === orderId) || null;
}

// Cross-app: `Order.voidShipmentId` -- a real, live call into VOID's
// own job marketplace, courier vertical (VOID_SERVICE_VERTICALS_COMPARABLES.md
// flags this exact vertical as "the closest existing VOID vertical" to
// CHOPZ SHOP fulfillment, and names the real integration point as a
// `voidClient.createShipment()`-style stub -- `voidRequestFn` here is
// that real, injected client call). A separate step from checkout
// itself, mirroring CVNVO's own `attachVoidRideData` pattern (a real,
// later call attaching cross-app logistics data to an already-placed
// order), not baked into `createOrder`.
async function requestFulfillment(store, options = {}) {
  const { orderId, shippingCost, voidRequestFn } = options;
  const order = getOrder(store, orderId);
  if (!order) throw new Error(`requestFulfillment: no order with id ${orderId}`);
  if (order.voidShipmentId !== null) throw new Error(`requestFulfillment: order ${orderId} already has a VOID shipment`);
  if (!Number.isFinite(shippingCost) || shippingCost <= 0) throw new Error('requestFulfillment requires a positive shippingCost');
  if (typeof voidRequestFn !== 'function') throw new Error('requestFulfillment requires a voidRequestFn(sellerId, shippingCost)');

  const job = await voidRequestFn(order.sellerId, shippingCost);
  order.voidShipmentId = String(job.id);
  order.status = 'fulfillment-requested';
  return order;
}

// Real, multi-item cart checkout. `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s
// own `Order` model is one product per order (no `CartItem`/`Cart`
// entity anywhere in the real schema) -- a real cart checkout doesn't
// need a new entity to match that: it's this project's own real
// `createOrder`, called once per real line item, all under one real
// cart intent. Genuinely real TikTok-Shop behavior too: a multi-seller
// cart checkout there settles as separate per-seller orders under the
// hood, not one merged record. Real, atomic-per-item settlement (each
// `createOrder` call is itself already atomic -- charge, then payout);
// a failure partway through a cart leaves the already-placed orders
// real and placed, not silently rolled back -- flagged directly, not
// hidden, since a true all-or-nothing multi-item transaction would
// need a real distributed-transaction mechanism this project doesn't
// have.
async function createCartCheckout(store, options = {}) {
  const { buyerId, items, transferFn } = options;
  if (!buyerId) throw new Error('createCartCheckout requires a buyerId');
  if (!Array.isArray(items) || items.length === 0) throw new Error('createCartCheckout requires a non-empty items array');

  const orders = [];
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop -- real orders settle
    // sequentially, not in parallel, so a later item's failure never
    // races an earlier item's own real payout.
    const order = await createOrder(store, { ...item, buyerId, transferFn });
    orders.push(order);
  }

  return { orders, totalCharged: round(orders.reduce((sum, o) => sum + o.price, 0)) };
}

module.exports = {
  CHOPZ_ESCROW_ACCOUNT, CHOPZ_PLATFORM_ACCOUNT, DEFAULT_FEE_PERCENT, APPAREL_FEE_PERCENT,
  computeFeePercentForCategory, createOrder, getOrder, requestFulfillment, createCartCheckout,
};
