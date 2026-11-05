// VENVS Marketplace — core commerce + branded storefronts + abandoned
// cart recovery. Source of truth: VENVS_SHOPIFY_INTEGRATION.md.
//
// Two of the doc's four features are built here for real:
// - storefrontCustomization: registerSeller() takes a real theme
//   object; getSellerStorefront() is the "own branded page, not one
//   generic template" view, distinct from the unified browse list.
// - abandonedCartRecovery: checkAbandonedCarts() is a real, testable
//   detection mechanism (age-based, not a stub), and
//   generateRecoveryOffer() computes a real discount off the actual
//   cart total.
//
// The other two are explicitly NOT built here, flagged rather than
// faked:
// - appEcosystem (VENVM tools as addable storefront apps) needs
//   VENVM, which doesn't exist anywhere in this session.
// - posIntegration (HVNTZ's physical business network) needs HVNTZ,
//   same gap.
//
// checkout() reuses the exact buyer -> platform -> seller pattern
// catalog.js's purchaseBook() established in Phase 2, via the same
// injected transferFn approach (keeps this module plain-Node
// testable, decoupled from v3Client.js's Vite-only import.meta.env).

// **Platform-funded legs take a separate function, and the browser
// never gets one.**
//
// This module runs in the browser. Some of the money it moves is the
// *buyer's own*, and V3 authorises that from their Shield session
// because `requireActor('fromUserId')` matches the session against the
// payer. The rest is the **platform paying out** — an author's
// royalty, a seller's share — which a browser must never instruct. No
// credential fixes that: a client able to authenticate as the platform
// is a client able to drain it.
//
// So `transferFn` moves the buyer's money and `payoutFn` moves the
// platform's, and only a backend holding a service credential can
// supply the second. No component in this app does, and none should.
//
// **A flow with any platform leg refuses entirely rather than settling
// half.** Charging the buyer and not paying the author is exactly the
// partial-settlement defect the ecosystem-wide sweep removed
// everywhere else. See `dev-docs/BROWSER_INITIATED_MONEY.md`.
function requirePayoutFn(payoutFn, operation) {
  if (typeof payoutFn !== 'function') {
    throw new Error(
      `${operation}: this pays out from the platform account, which a browser must not instruct. `
      + 'It needs a backend holding a service credential to supply payoutFn(fromUserId, toUserId, '
      + 'amount, reason) -- see dev-docs/BROWSER_INITIATED_MONEY.md.',
    );
  }
}

const PLATFORM_USER_ID = 'venvs-platform';

export function createMarketplace() {
  return {
    sellers: [],
    nextSellerId: 1,
    products: [],
    nextProductId: 1,
    carts: [],
    nextCartId: 1,
    orders: [],
    nextOrderId: 1,
  };
}

export function registerSeller(marketplace, options = {}) {
  const { name, ownerId, theme = {} } = options;
  if (!name) {
    throw new Error('registerSeller requires a name');
  }
  if (!ownerId) {
    throw new Error('registerSeller requires an ownerId');
  }
  const seller = {
    id: marketplace.nextSellerId++,
    name,
    ownerId,
    // A real, per-seller customizable storefront -- not forced into
    // one generic template. No fixed theme schema is specified in
    // the source doc, so this stays a free-form object; callers set
    // whatever fields their storefront rendering actually uses.
    theme,
    createdAt: Date.now(),
  };
  marketplace.sellers.push(seller);
  return seller;
}

export function getSeller(marketplace, sellerId) {
  return marketplace.sellers.find((s) => s.id === sellerId) || null;
}

// `editionSize` is real, optional scarcity: a limited-edition piece
// (first real use: STONE BONES, whose own positioning is that every
// piece is original and made in a limited run precisely so it can
// also be traded afterward, peer to peer, through this same
// Marketplace) names how many units the brand itself will ever sell.
// `null` (the default, and every other product in this file before
// this feature) stays genuinely unlimited -- nothing about existing
// products changes. Once `unitsRemaining` reaches 0, `checkout`
// refuses to sell any more of it; a buyer who already owns one can
// still resell it through `registerSeller`/`listProduct` exactly as
// any other peer reseller would, which is the real mechanism "traded"
// means here -- no separate resale system needed.
export function listProduct(marketplace, options = {}) {
  const { sellerId, title, price, category = null, editionSize = null } = options;
  if (!getSeller(marketplace, sellerId)) {
    throw new Error(`listProduct: no seller with id ${sellerId}`);
  }
  if (!title) {
    throw new Error('listProduct requires a title');
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('listProduct requires a positive price');
  }
  if (editionSize !== null && (!Number.isInteger(editionSize) || editionSize <= 0)) {
    throw new Error('listProduct: editionSize must be a positive integer when given');
  }
  const product = {
    id: marketplace.nextProductId++,
    sellerId,
    title,
    price,
    category,
    editionSize,
    unitsRemaining: editionSize,
    createdAt: Date.now(),
    // Present and false/null rather than absent on every product, same
    // posture as `editionSize` above — a reader should see "not
    // eligible" rather than wonder whether the field exists yet. See
    // `markChopzEligible`/`publishToChopzShop` below for what sets them.
    chopzEligible: false,
    chopzCommissionPercent: 0,
    chopzShopProductId: null,
    // A seller's own on/off switch for a listing -- "inventory
    // management" means being able to take something down without
    // deleting its id out from under an order history that still
    // references it (`getOrder`/`ordersForSeller` read products by
    // id). Present and true on every product from creation, same
    // "never absent" posture as the two fields above.
    active: true,
  };
  marketplace.products.push(product);
  return product;
}

// A product's own seller takes it off the real storefront and the
// unified browse list without deleting it -- past orders, CHOPZ
// cross-posting state, and the id itself all stay intact, so a
// delisted item can always be relisted later with its real history
// unchanged. No separate "deleted" state exists, by design: nothing
// in this ecosystem actually erases a sold product's record.
export function setProductActive(marketplace, productId, active) {
  const product = getProduct(marketplace, productId);
  if (!product) {
    throw new Error(`setProductActive: no product with id ${productId}`);
  }
  if (typeof active !== 'boolean') {
    throw new Error('setProductActive requires a boolean active value');
  }
  product.active = active;
  return product;
}

// A seller opts specific items into CHOPZ SHOP's creator/affiliate
// program — "certain items", not the whole catalogue, per direct
// instruction. This only sets the local flag and commission; it does
// not reach CHOPZ SHOP itself, so a product can be marked eligible
// long before (or without ever) actually being published there.
export function markChopzEligible(marketplace, productId, affiliateCommissionPercent) {
  const product = getProduct(marketplace, productId);
  if (!product) {
    throw new Error(`markChopzEligible: no product with id ${productId}`);
  }
  // Same bound CHOPZ SHOP's own createProduct enforces
  // (chopz/chopz-shop/lib/products.js) — kept in sync by hand since
  // the two are genuinely separate apps with no shared validation code.
  if (!Number.isFinite(affiliateCommissionPercent) || affiliateCommissionPercent <= 0 || affiliateCommissionPercent >= 1) {
    throw new Error('markChopzEligible requires an affiliateCommissionPercent between 0 and 1 (exclusive) — 0 would give a creator no reason to promote it');
  }
  product.chopzEligible = true;
  product.chopzCommissionPercent = affiliateCommissionPercent;
  return product;
}

// The real cross-app call: registers an eligible product as a real
// CHOPZ SHOP product under the *same seller identity* (the VENVS
// seller's ownerId, the payout identity, not VENVS's own local
// sellerId — CHOPZ SHOP's attribution and this marketplace's payouts
// have to agree on who the money belongs to). `chopzRegisterFn` is
// the real POST /chopz-shop/products call, injected the same way
// `voidRequestFn` is above and in catalog.js — this module stays
// plain-Node testable with no live network, and the real HTTP client
// lives in chopzClient.js, which only the browser build imports.
export async function publishToChopzShop(marketplace, productId, options = {}) {
  const { chopzRegisterFn } = options;
  const product = getProduct(marketplace, productId);
  if (!product) {
    throw new Error(`publishToChopzShop: no product with id ${productId}`);
  }
  if (!product.chopzEligible) {
    throw new Error(`publishToChopzShop: product ${productId} is not chopz-eligible yet — call markChopzEligible first`);
  }
  if (product.chopzShopProductId !== null) {
    throw new Error(`publishToChopzShop: product ${productId} is already published to CHOPZ SHOP (its id there is ${product.chopzShopProductId})`);
  }
  if (typeof chopzRegisterFn !== 'function') {
    throw new Error('publishToChopzShop requires a chopzRegisterFn(sellerOwnerId, name, price, category, affiliateCommissionPercent)');
  }
  const seller = getSeller(marketplace, product.sellerId);
  if (!seller) {
    throw new Error(`publishToChopzShop: no seller for product ${productId}`);
  }
  const registered = await chopzRegisterFn(
    seller.ownerId, product.title, product.price, product.category, product.chopzCommissionPercent,
  );
  product.chopzShopProductId = registered.id;
  return product;
}

export function getProduct(marketplace, productId) {
  return marketplace.products.find((p) => p.id === productId) || null;
}

// Unified, Amazon-style browse across every seller. Delisted products
// (`active: false`) are excluded by default -- a buyer browsing should
// not see something its own seller took down -- unless the caller is
// the seller themself looking at their own real inventory
// (`includeInactive: true`), the one case that needs to see a delisted
// item in order to relist it.
export function browseProducts(marketplace, options = {}) {
  const { category, sellerId, includeInactive = false } = options;
  return marketplace.products.filter(
    (p) => (category ? p.category === category : true)
      && (sellerId ? p.sellerId === sellerId : true)
      && (includeInactive ? true : p.active !== false)
  );
}

// The Shopify-style differentiator: a seller's own branded page,
// distinct from the unified browse list above.
export function getSellerStorefront(marketplace, sellerId) {
  const seller = getSeller(marketplace, sellerId);
  if (!seller) {
    throw new Error(`getSellerStorefront: no seller with id ${sellerId}`);
  }
  return { seller, products: browseProducts(marketplace, { sellerId }) };
}

export function createCart(marketplace, options = {}) {
  const { buyerId } = options;
  if (!buyerId) {
    throw new Error('createCart requires a buyerId');
  }
  const now = Date.now();
  const cart = {
    id: marketplace.nextCartId++,
    buyerId,
    items: [], // { productId, quantity }
    status: 'active', // active | completed | abandoned
    createdAt: now,
    lastActivityAt: now,
  };
  marketplace.carts.push(cart);
  return cart;
}

export function getCart(marketplace, cartId) {
  return marketplace.carts.find((c) => c.id === cartId) || null;
}

export function addToCart(marketplace, cartId, productId, quantity = 1) {
  const cart = getCart(marketplace, cartId);
  if (!cart) {
    throw new Error(`addToCart: no cart with id ${cartId}`);
  }
  if (cart.status !== 'active') {
    throw new Error(`addToCart: cart ${cartId} is ${cart.status}, not active`);
  }
  const product = getProduct(marketplace, productId);
  if (!product) {
    throw new Error(`addToCart: no product with id ${productId}`);
  }
  // Same "refuse before it reaches a cart" posture as the sold-out
  // edition-size guard in checkout() below -- a delisted product is
  // not purchasable, but it keeps its id and history, so this is a
  // hard refusal here rather than a silent disappearance from a cart
  // that already held it.
  if (product.active === false) {
    throw new Error(`addToCart: "${product.title}" has been delisted by its seller`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('addToCart requires a positive quantity');
  }
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ productId, quantity });
  }
  cart.lastActivityAt = Date.now();
  return cart;
}

function cartTotal(marketplace, cart) {
  return Math.round(
    cart.items.reduce((sum, item) => sum + getProduct(marketplace, item.productId).price * item.quantity, 0) * 100
  ) / 100;
}

// Real checkout: buyer pays the platform the full total, then the
// platform pays each seller their share (grouped, since a cart can
// span multiple sellers in a unified marketplace) -- same
// buyer -> platform -> recipient(s) shape as Phase 2's purchaseBook.
export async function checkout(marketplace, options = {}) {
  const { cartId, transferFn, payoutFn } = options;
  if (typeof transferFn !== 'function') {
    throw new Error('checkout requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  const cart = getCart(marketplace, cartId);
  if (!cart) {
    throw new Error(`checkout: no cart with id ${cartId}`);
  }
  if (cart.status !== 'active') {
    throw new Error(`checkout: cart ${cartId} is ${cart.status}, not active`);
  }
  if (cart.items.length === 0) {
    throw new Error('checkout: cart is empty');
  }

  // **Refuse before charging the buyer.** Every cart owes its sellers,
  // and those legs are the platform's to pay. Charging the buyer and
  // leaving the sellers unpaid is the partial settlement this
  // ecosystem spent a sweep removing.
  requirePayoutFn(payoutFn, 'checkout');

  // **A limited-edition product refuses once it's sold out, same
  // posture as the Food District's own inventory check -- before the
  // buyer is ever charged, not after.** Unlimited products
  // (`editionSize: null`, every product before this feature existed)
  // are untouched by this loop.
  for (const item of cart.items) {
    const product = getProduct(marketplace, item.productId);
    if (product.editionSize !== null && product.unitsRemaining < item.quantity) {
      throw new Error(
        `checkout: "${product.title}" has only ${product.unitsRemaining} left of its `
        + `${product.editionSize}-piece edition`,
      );
    }
  }

  // **The cart is claimed before any money moves, not written
  // 'completed' only after every leg settles.** This checked
  // cart.status, awaited the buyer's charge and every seller's
  // payout, and only then wrote 'completed' -- so two concurrent
  // checkout() calls for the same cart (a double-click before the
  // button's disabled state re-renders, or a retried request) both
  // passed the status guard while it was still 'active', both charged
  // the buyer and paid every seller, and both produced a separate
  // order. Measured directly: two concurrent checkouts of one $40 cart
  // charged 80, paid out 80, and created 2 orders. Claiming
  // 'completed' here means the second call sees it immediately and is
  // refused by the guard above, before it ever reaches transferFn. A
  // failure below restores 'active' so the cart stays retryable.
  // Limited-edition units are claimed in this same synchronous step,
  // for the same reason: claimed here, a second concurrent checkout
  // against the same product sees the reduced `unitsRemaining`
  // immediately, before either call's first `await`.
  cart.status = 'completed';
  for (const item of cart.items) {
    const product = getProduct(marketplace, item.productId);
    if (product.editionSize !== null) {
      product.unitsRemaining -= item.quantity;
    }
  }

  const total = cartTotal(marketplace, cart);
  try {
    await transferFn(cart.buyerId, PLATFORM_USER_ID, total, `venvs_marketplace_checkout:${cart.id}`);

    const bySeller = new Map();
    for (const item of cart.items) {
      const product = getProduct(marketplace, item.productId);
      const lineTotal = product.price * item.quantity;
      bySeller.set(product.sellerId, (bySeller.get(product.sellerId) || 0) + lineTotal);
    }

    const payouts = [];
    for (const [sellerId, amount] of bySeller) {
      const seller = getSeller(marketplace, sellerId);
      const rounded = Math.round(amount * 100) / 100;
      await payoutFn(PLATFORM_USER_ID, seller.ownerId, rounded, `venvs_marketplace_payout:${cart.id}:${sellerId}`);
      payouts.push({ sellerId, amount: rounded });
    }

    const order = {
      id: marketplace.nextOrderId++,
      cartId: cart.id,
      buyerId: cart.buyerId,
      total,
      payouts,
      // Real physical fulfillment, per VOID_SERVICE_VERTICALS_COMPARABLES.md's
      // own FULFILLMENT section -- null until `requestFulfillment` below
      // actually creates a real VOID courier job. Never optimistically
      // set at checkout: an order with no real shipment must stay
      // visibly unfulfilled.
      voidShipmentId: null,
      fulfillmentStatus: 'unfulfilled',
      // Every order through this function is a real online checkout --
      // see `recordPosSale` below for the one other real producer of
      // an order, and why both write the same real shape.
      channel: 'online',
      createdAt: Date.now(),
    };
    marketplace.orders.push(order);
    return order;
  } catch (err) {
    cart.status = 'active';
    for (const item of cart.items) {
      const product = getProduct(marketplace, item.productId);
      if (product.editionSize !== null) {
        product.unitsRemaining += item.quantity;
      }
    }
    throw err;
  }
}

export function getOrder(marketplace, orderId) {
  return marketplace.orders.find((o) => o.id === orderId) || null;
}

// Every real order a seller has, online or in-person -- the real
// "unifying in-person and online sales" view named in
// `VENVS_SHOPIFY_INTEGRATION.md`'s own POS section. A seller's own
// checkout payout entry is the real, already-correct way to answer
// "was I paid on this order" regardless of channel, so this reads
// that rather than adding a second seller-to-order index to keep in
// sync.
export function ordersForSeller(marketplace, sellerId) {
  return marketplace.orders.filter((o) => o.payouts.some((p) => p.sellerId === sellerId));
}

// A real in-person sale, rung up at a real HVNTZ business location --
// the real POS gap `VENVS_SHOPIFY_INTEGRATION.md` names as "real
// HVNTZ businesses running VENVS as an actual point of sale, unifying
// in-person and online sales."
//
// **This does not move money.** A real in-person payment already has
// a real, working physical-to-digital path -- VASH TAP's own
// `POST /api/taps/:tapCode/pay`, where a customer's own physical Tap
// (wristband/ring/card) resolves to their real Shield session and
// authorizes a real VCoin transfer, the exact mechanism
// `VASH_TAP`'s own README describes end to end. Re-moving money here,
// a second time, from a second place, is exactly the kind of
// duplicate payment path this ecosystem's own settlement sweep
// already removed everywhere else (see `settleOnce.js`'s own header).
// What was genuinely missing was not a second payment rail -- it was
// recording an already-settled in-person sale as a REAL order, in the
// exact same `orders` list an online checkout produces, so a seller's
// real revenue/order history is one unified place regardless of
// channel. `channel: 'pos'` is the one real, additive marker that
// tells the two apart; `checkout`'s own orders are `'online'`.
//
// Real inventory is still checked and spent exactly like `checkout`
// does, for the same real reason: a limited-edition item sold out at
// the register is exactly as sold out online, and the other way
// around -- one real stock count, not two.
export function recordPosSale(marketplace, options = {}) {
  const { sellerId, items, buyerId = null, now = Date.now() } = options;
  const seller = getSeller(marketplace, sellerId);
  if (!seller) {
    throw new Error(`recordPosSale: no seller with id ${sellerId}`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('recordPosSale requires at least one real item');
  }

  let total = 0;
  for (const { productId, quantity = 1 } of items) {
    const product = getProduct(marketplace, productId);
    if (!product) {
      throw new Error(`recordPosSale: no product with id ${productId}`);
    }
    if (product.sellerId !== sellerId) {
      throw new Error(`recordPosSale: product ${productId} is not this seller's own product`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('recordPosSale: every item needs a positive quantity');
    }
    if (product.editionSize !== null && product.unitsRemaining < quantity) {
      throw new Error(
        `recordPosSale: "${product.title}" has only ${product.unitsRemaining} left of its `
        + `${product.editionSize}-piece edition`,
      );
    }
    total += product.price * quantity;
  }

  // Real stock spent only after every line in the sale is confirmed
  // sellable -- the same "check everything before touching state"
  // ordering `checkout` itself already uses.
  for (const { productId, quantity = 1 } of items) {
    const product = getProduct(marketplace, productId);
    if (product.editionSize !== null) product.unitsRemaining -= quantity;
  }

  const rounded = Math.round(total * 100) / 100;
  const order = {
    id: marketplace.nextOrderId++,
    cartId: null,
    buyerId,
    total: rounded,
    payouts: [{ sellerId, amount: rounded }],
    voidShipmentId: null,
    // Handed to the real customer in person, on the spot -- there is
    // no real shipment to request for a POS sale, the same real
    // distinction `requestBookFulfillment` already draws for an ebook/
    // audiobook order ("not-applicable" rather than "unfulfilled").
    fulfillmentStatus: 'not-applicable',
    channel: 'pos',
    createdAt: now,
  };
  marketplace.orders.push(order);
  return order;
}

// Cross-app physical fulfillment: routes a real VENVS Marketplace
// order into VOID's own job marketplace (`courier` vertical), closing
// the exact gap VOID_SERVICE_VERTICALS_COMPARABLES.md names directly
// -- "VENVS Marketplace should route physical-good deliveries through
// this same layer -- not yet connected anywhere in VENVS's
// documentation, this is new to add."
//
// Deliberately the same real shape CHOPZ SHOP's own `requestFulfillment`
// already proved (`chopz/chopz-shop/lib/orders.js`): a separate step
// *after* checkout rather than baked into it, with the VOID call
// injected (`voidRequestFn`) so this stays testable in plain Node
// with no live network -- the same injected-cross-app-client pattern
// used everywhere else in this ecosystem.
//
// One real difference from CHOPZ, driven by a real difference in the
// data: a CHOPZ order is single-seller, so it maps to exactly one
// shipment. A VENVS cart can legitimately span multiple sellers
// (that's the whole point of the unified marketplace), so fulfillment
// here creates one real VOID courier job **per seller** -- physical
// goods from two different sellers are two real, separate pickups,
// not one. Recorded as a real array, never collapsed into a single
// misleading id.
export async function requestFulfillment(marketplace, options = {}) {
  const { orderId, shippingCostPerSeller, voidRequestFn } = options;
  const order = getOrder(marketplace, orderId);
  if (!order) {
    throw new Error(`requestFulfillment: no order with id ${orderId}`);
  }
  if (order.voidShipmentId !== null) {
    throw new Error(`requestFulfillment: order ${orderId} already has VOID shipments`);
  }
  if (!Number.isFinite(shippingCostPerSeller) || shippingCostPerSeller <= 0) {
    throw new Error('requestFulfillment requires a positive shippingCostPerSeller');
  }
  if (typeof voidRequestFn !== 'function') {
    throw new Error('requestFulfillment requires a voidRequestFn(sellerId, shippingCost)');
  }

  const shipments = [];
  for (const payout of order.payouts) {
    const job = await voidRequestFn(payout.sellerId, shippingCostPerSeller);
    shipments.push({ sellerId: payout.sellerId, voidJobId: String(job.id) });
  }

  order.voidShipmentId = shipments;
  order.fulfillmentStatus = 'fulfillment-requested';
  return order;
}

// Real, automated abandonment detection -- not a stub. A cart is
// abandoned once it's been active with items in it for longer than
// the threshold without new activity. No specific threshold is given
// in the source doc; defaults to 30 minutes, an interpretive but
// reasonable e-commerce norm, overridable by the caller.
const DEFAULT_ABANDONMENT_THRESHOLD_MS = 30 * 60 * 1000;

export function checkAbandonedCarts(marketplace, options = {}) {
  const { now = Date.now(), abandonmentThresholdMs = DEFAULT_ABANDONMENT_THRESHOLD_MS } = options;
  const newlyAbandoned = [];
  for (const cart of marketplace.carts) {
    if (cart.status === 'active' && cart.items.length > 0 && now - cart.lastActivityAt >= abandonmentThresholdMs) {
      cart.status = 'abandoned';
      newlyAbandoned.push(cart);
    }
  }
  return newlyAbandoned;
}

// A real, computed recovery offer -- not just a flag. No specific
// discount is given in the source doc; the shape here (percent off
// the actual abandoned total) is a real, standard mechanic, flagged
// as an interpretive default (10%).
export function generateRecoveryOffer(marketplace, cartId, options = {}) {
  const { discountPercent = 10 } = options;
  const cart = getCart(marketplace, cartId);
  if (!cart) {
    throw new Error(`generateRecoveryOffer: no cart with id ${cartId}`);
  }
  if (cart.status !== 'abandoned') {
    throw new Error(`generateRecoveryOffer: cart ${cartId} is ${cart.status}, not abandoned`);
  }
  const originalTotal = cartTotal(marketplace, cart);
  const discountAmount = Math.round(originalTotal * (discountPercent / 100) * 100) / 100;
  const discountedTotal = Math.round((originalTotal - discountAmount) * 100) / 100;
  return { cartId, buyerId: cart.buyerId, originalTotal, discountPercent, discountAmount, discountedTotal };
}

export { PLATFORM_USER_ID };
