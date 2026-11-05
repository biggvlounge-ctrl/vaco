// VENVS — its first real backend.
//
// `src/lib/marketplace.js`'s branded-storefront system
// (registerSeller/listProduct/getSellerStorefront/checkout) has
// existed since Phase 3, real and fully tested, with nowhere real to
// live: `MarketplaceView.jsx` calls `createMarketplace()` fresh on
// every component mount and seeds it with hardcoded demo sellers --
// a seller a real user registered vanished on the next page load.
// Per direct instruction (31 Oct 2026, correcting an earlier mis-
// scoped plan), Hunts and Vault Studios user accounts need a real
// storefront tied to their account, and there was no real account to
// tie to without one.
//
// This is that real backend: a persisted store, the same
// `lib/persistence.cjs` + `lib/storeBackend.cjs` boilerplate every
// other real app in this repo already uses (copied in per
// `sync-shared-runtime.sh`'s own documented per-app-copy convention —
// see that script's header on why `venvs` and `vdp` are its two
// deliberately hand-maintained exceptions rather than entries in its
// auto-synced lists). `vdp/server.cjs` is the template this follows
// almost verbatim: the same CJS-server-over-ESM-src/lib split, for
// the same reason — `src/lib/` stays real ESM (this app's own
// existing, tested marketplace logic), loaded here with a dynamic
// `import()` rather than duplicated into CommonJS.
//
// **Deliberately NOT built here, flagged rather than faked:** CHOPZ
// SHOP cross-posting (`markChopzEligible`/`publishToChopzShop`), real
// VOID physical fulfillment (`requestFulfillment`), and abandoned-
// cart recovery (`checkAbandonedCarts`/`generateRecoveryOffer`) — all
// real, existing functions in `src/lib/marketplace.js`, none wired to
// a route yet. The real, requested scope this round is narrower:
// register as a real seller, list a real product, browse, check out
// for real VCoin.
//
// Run:
//   npm install
//   node server.cjs
//
// Test:
//   curl http://localhost:8829/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { attachStore } = require('./lib/storeBackend.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { requireActor, requireCallingService } = require('./lib/shieldAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const PORT = process.env.PORT || 8829;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';
const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';
const CHOPZ_SHOP_API_URL = process.env.CHOPZ_SHOP_API_URL || 'http://localhost:8801';
const VDP_API_URL = process.env.VDP_API_URL || 'http://localhost:8827';
const CVLLEX_API_URL = process.env.CVLLEX_API_URL || 'http://localhost:8822';

// `start-ecosystem.sh` generates a single `VACO_SERVICE_TOKEN` and
// exports it for every child process; each app supplies its own name
// by defaulting to its own literal name when the env var is unset,
// same convention every other real backend in this repo already
// takes (see e.g. `vdp/server.cjs`).
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'venvs';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(traceMiddleware());

const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// VENVS's own `src/lib/marketplace.js` already draws this split in
// its own header: a buyer's own leg is money a browser may rightly
// instruct (Shield already proved it is really them), but a
// platform-paid seller payout is money only a trusted backend may
// move, because no credential fixes a client able to authenticate as
// the platform. Both legs below go through this one server-to-server
// call against V3 using VENVS's own service credential — the buyer's
// leg only because `requireActor('buyerId')` has already confirmed
// the real human behind it before this function is ever reached, the
// same two-layer shape `vdp/server.cjs`'s own `transferVCoin` already
// uses for a player's own purchases there.
async function transferVCoin(fromUserId, toUserId, amount, reason) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Name': VACO_SERVICE_NAME,
      'X-Service-Token': VACO_SERVICE_TOKEN,
    },
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `transferVCoin failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

// The real server-to-server client this app's own `src/lib/
// voidClient.js` could not be, server-side: that file reads
// `import.meta.env`, which only exists under Vite and throws in plain
// Node. Same real contract (`VOID_SERVICE_VERTICALS_COMPARABLES.md`'s
// own "courier" vertical, quantity 1, `unitPrice` the quoted shipping
// cost), reused rather than re-derived -- and the exact same shape
// CHOPZ SHOP's own already-shipped `requestVoidCourierJob`
// (`chopz/chopz-shop/server.js`) already uses, including this file's
// own real, checked-live limitation: VOID's `POST /api/job` is
// `requireActor('customerId')`, which wants the real seller's own
// Shield session, not a service credential or no credential at all.
// Neither this call nor CHOPZ SHOP's own identical one sends that
// session -- confirmed by reading CHOPZ SHOP's real source, not
// assumed -- so a real order spanning multiple sellers' own separate
// sessions cannot cleanly be fulfilled in one request as written here
// either. `requestFulfillment` still refuses honestly (a real 400
// with VOID's own real refusal message) rather than silently
// recording a shipment that was never actually created -- see
// `POST /api/marketplace/orders/:id/fulfillment`'s own header below.
async function createVoidShipment(sellerId, shippingCost) {
  const res = await fetch(`${VOID_API_URL}/api/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verticalId: 'courier', customerId: sellerId, quantity: 1, unitPrice: shippingCost }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `createVoidShipment failed (${res.status})`);
  return body;
}

// Same real gap: `src/lib/chopzClient.js` also reads `import.meta.env`
// and cannot run here. CHOPZ SHOP's own `POST /chopz-shop/products` is
// `requireActor('sellerId')` -- it demands the real seller's own
// Shield session, not a service credential, so this forwards the
// SAME `Authorization` header the incoming request already carried
// (and that `requireActor('ownerId')` on the route below already
// validated) rather than minting a second identity for one call.
async function registerWithChopzShop(sellerOwnerId, name, price, category, affiliateCommissionPercent, authHeader) {
  const res = await fetch(`${CHOPZ_SHOP_API_URL}/chopz-shop/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ sellerId: sellerOwnerId, name, price, category, affiliateCommissionPercent }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `registerWithChopzShop failed (${res.status})`);
  return body;
}

// `src/lib/catalog.js`'s own `libraryRecordFn` injection point --
// VDP's real `POST /api/library/record` route
// (`actorOrService(requireActor('buyerId'))`) wants either the real
// buyer's own Shield session or a trusted service credential. The
// buyer's own session already reached THIS route
// (`requireActor('buyerId')` below already validated it), so this
// forwards the SAME bearer token rather than minting a second
// identity -- the exact precedent `registerWithChopzShop` above
// already set for the identical cross-app shape.
async function recordLibraryEffect(payload, authHeader) {
  const res = await fetch(`${VDP_API_URL}/api/library/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `recordLibraryEffect failed (${res.status})`);
  return body;
}

// The real bridge from a VENVS book to a real CVLLEX collectible run
// -- "a special edition version of books in the physical... a signed
// version, a copy with special art on the front" (direct request),
// closing CVLLEX's own README's named gap: "VENVS's Publishing arm
// models print-on-demand economics for books but never names who
// presses them." CVLLEX's own `POST /api/production-orders` is
// `actorOrService(requireActor('creatorId'))` -- the real author's
// own session already reached THIS route (`requireActor('authorId')`
// below already validated it), so this forwards the SAME bearer
// token, the exact precedent `recordLibraryEffect`/
// `registerWithChopzShop` above already set.
async function createCvllexProductionOrder(payload, authHeader) {
  const res = await fetch(`${CVLLEX_API_URL}/api/production-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `createCvllexProductionOrder failed (${res.status})`);
  return body;
}

// A real, live lookup rather than trusting a caller-supplied vaultId
// -- the same "never trust a bare claim, verify live" discipline
// `chopz`'s own `verifyLinkedProduct` already established, named
// directly as this exact pattern in CVLLEX's own README.
async function fetchCvllexVault(vaultId) {
  const res = await fetch(`${CVLLEX_API_URL}/api/vault/${vaultId}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `fetchCvllexVault failed (${res.status})`);
  return body;
}

(async () => {
  const marketplaceLib = await import('./src/lib/marketplace.js');
  const svmikoDegvchiLib = await import('./src/lib/svmikoDegvchi.js');
  const catalogLib = await import('./src/lib/catalog.js');

  function createVenvsStore() {
    return { marketplace: marketplaceLib.createMarketplace(), catalog: catalogLib.createCatalog() };
  }

  let store = createVenvsStore();
  attachStore(app, {
    appKey: 'venvs',
    createDefault: createVenvsStore,
    filePath: path.join(__dirname, 'data', 'store.json'),
    onReady: (loaded) => {
      store = loaded;
      // Real, named storefronts this ecosystem already committed to
      // (`MarketplaceView.jsx`'s own former demo data, and Phase 11's
      // real SVMIKO DEGVCHI fashion house) -- seeded once, into the
      // real persisted store, rather than recreated in memory on
      // every browser tab's own mount. `sellers.length === 0` is the
      // real "never seeded yet" check -- a restart against an
      // already-seeded store must never duplicate these.
      if (store.marketplace.sellers.length === 0) {
        const hardware = marketplaceLib.registerSeller(store.marketplace, {
          name: 'Cherokee Hardware Co.', ownerId: 'seller-hardware',
          theme: { color: '#2a7d4f', banner: 'Est. 1962 — Cherokee St' },
        });
        const vinyl = marketplaceLib.registerSeller(store.marketplace, {
          name: 'Riverfront Vinyl', ownerId: 'seller-vinyl',
          theme: { color: '#a8452e', banner: 'New & used pressings' },
        });
        marketplaceLib.listProduct(store.marketplace, { sellerId: hardware.id, title: 'Claw Hammer', price: 18.5, category: 'tools' });
        marketplaceLib.listProduct(store.marketplace, { sellerId: hardware.id, title: 'Exterior Paint (1gal)', price: 34.0, category: 'paint' });
        marketplaceLib.listProduct(store.marketplace, { sellerId: vinyl.id, title: 'Local Pressing LP', price: 22.0, category: 'music' });
        svmikoDegvchiLib.seedSvmikoDegvchiStorefronts(store.marketplace);
      }

      // Same real demo catalog `App.jsx`'s own `SEED_CATALOG` used to
      // build fresh, client-side, on every page load (Phase 17) --
      // moved here so it persists across restarts instead of
      // vanishing, the same `books.length === 0` first-boot-only guard
      // the marketplace seed above already uses.
      if (store.catalog.books.length === 0) {
        catalogLib.publishBook(store.catalog, {
          title: 'Cherokee St After Dark', authorId: 'author-1', format: 'ebook', listPrice: 5.99, deliveryFee: 0.15,
        });
        catalogLib.publishBook(store.catalog, {
          title: 'An Existing Backlist Title', authorId: 'ingram-catalog', format: 'ebook', listPrice: 8.99, source: 'ingram',
        });
        catalogLib.publishBook(store.catalog, {
          title: 'The Complete Home Cook', authorId: 'ingram-catalog', format: 'ebook', listPrice: 12.99,
          source: 'ingram', skillSubject: 'Crafting',
        });
        catalogLib.publishBook(store.catalog, {
          title: "The Carpenter's Handbook", authorId: 'ingram-catalog', format: 'ebook', listPrice: 14.99,
          source: 'ingram', skillSubject: 'Construction',
        });
        catalogLib.publishBook(store.catalog, {
          title: 'The Secret', authorId: 'ingram-catalog', format: 'ebook', listPrice: 9.99,
          source: 'ingram', beliefTopic: 'positive-thinking', beliefType: 'philosophical',
        });
        catalogLib.publishBook(store.catalog, {
          title: 'The Bible', authorId: 'ingram-catalog', format: 'ebook', listPrice: 4.99,
          source: 'ingram', beliefTopic: 'faith', beliefType: 'religious',
        });
        catalogLib.publishBook(store.catalog, {
          title: 'Meditations', authorId: 'ingram-catalog', format: 'ebook', listPrice: 2.99,
          source: 'ingram', beliefTopic: 'stoicism', beliefType: 'philosophical',
        });
        catalogLib.publishBook(store.catalog, {
          title: 'Tao Te Ching', authorId: 'ingram-catalog', format: 'ebook', listPrice: 2.99,
          source: 'ingram', beliefTopic: 'taoism', beliefType: 'philosophical',
        });
      }
    },
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true, service: 'venvs',
      sellers: store.marketplace.sellers.length,
      products: store.marketplace.products.length,
      books: store.catalog.books.length,
    });
  });

  // -- Marketplace: real, persisted branded storefronts --------------------
  //
  // Any Shield-authenticated account can register — "one identity
  // (Shield), no VENVS-specific signup" per this app's own
  // `CLAUDE.md`. Deliberately NOT narrowed to Hunts/Vault Studios
  // accounts specifically: Shield carries no per-app account flag to
  // narrow by, and "any real account can become a real seller" is the
  // same posture `registerSeller`'s own existing signature (`ownerId`,
  // no app-of-origin field) already took before this backend existed.
  // A Hunts business or a Vault Studios creator registers exactly the
  // way anyone else does.
  app.post('/api/marketplace/sellers', requireActor('ownerId'), (req, res) => {
    try {
      const seller = marketplaceLib.registerSeller(store.marketplace, req.body);
      res.status(201).json(seller);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Every real storefront, for a unified seller directory -- the real
  // list `MarketplaceView.jsx` shows above its product browse list.
  app.get('/api/marketplace/sellers', (_req, res) => {
    res.json({ sellers: store.marketplace.sellers });
  });

  app.get('/api/marketplace/sellers/:id', (req, res) => {
    try {
      res.json(marketplaceLib.getSellerStorefront(store.marketplace, Number(req.params.id)));
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // Unified, Amazon-style browse across every real seller — real
  // query filters, same shape `browseProducts` already takes.
  app.get('/api/marketplace/products', (req, res) => {
    const { category, sellerId } = req.query;
    res.json({
      products: marketplaceLib.browseProducts(store.marketplace, {
        category: category || undefined,
        sellerId: sellerId !== undefined ? Number(sellerId) : undefined,
      }),
    });
  });

  // Listing a product under a storefront is the seller's own call.
  // `ownerId` must match both the real Shield session
  // (`requireActor`) AND the seller record's own stored owner — the
  // same resolve-then-compare resource-ownership shape this
  // ecosystem's other custom guards (e.g. VDP's
  // requireAccountOwner/requireWalletOwner) already use, kept inline
  // here since this is the only route in this app that needs it.
  app.post('/api/marketplace/sellers/:id/products', requireActor('ownerId'), (req, res) => {
    try {
      const seller = marketplaceLib.getSeller(store.marketplace, Number(req.params.id));
      if (!seller) return res.status(404).json({ error: `no seller with id ${req.params.id}` });
      if (seller.ownerId !== req.body.ownerId) {
        return res.status(403).json({ error: "only this storefront's own owner can list a product under it" });
      }
      const product = marketplaceLib.listProduct(store.marketplace, { ...req.body, sellerId: seller.id });
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // A seller's own full real inventory, delisted items included --
  // distinct from the public `GET /api/marketplace/products` browse
  // list (which hides a delisted product on purpose, see
  // `browseProducts`'s own header in marketplace.js). POST rather than
  // GET because the ownership check this route needs is the same
  // resolve-then-compare shape every other seller-only action in this
  // file already uses, and `requireActor` reads the claimed identity
  // out of a body a GET request cannot reliably carry.
  app.post('/api/marketplace/sellers/:id/inventory', requireActor('ownerId'), (req, res) => {
    try {
      const seller = marketplaceLib.getSeller(store.marketplace, Number(req.params.id));
      if (!seller) return res.status(404).json({ error: `no seller with id ${req.params.id}` });
      if (seller.ownerId !== req.body.ownerId) {
        return res.status(403).json({ error: "only this storefront's own owner can view its full inventory" });
      }
      res.json({
        products: marketplaceLib.browseProducts(store.marketplace, { sellerId: seller.id, includeInactive: true }),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delist/relist -- a product keeps its id, its order history, and
  // any CHOPZ cross-posting state either way; only whether it shows up
  // in the public browse list and can be freshly added to a cart
  // changes. Same resolve-then-compare ownership guard as
  // chopz-eligible/publish-to-chopz below.
  app.post('/api/marketplace/products/:id/active', requireActor('ownerId'), (req, res) => {
    try {
      const product = marketplaceLib.getProduct(store.marketplace, Number(req.params.id));
      if (!product) return res.status(404).json({ error: `no product with id ${req.params.id}` });
      const seller = marketplaceLib.getSeller(store.marketplace, product.sellerId);
      if (!seller || seller.ownerId !== req.body.ownerId) {
        return res.status(403).json({ error: "only this product's own seller can change its listing status" });
      }
      res.status(200).json(marketplaceLib.setProductActive(store.marketplace, product.id, req.body.active));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/marketplace/carts', requireActor('buyerId'), (req, res) => {
    try {
      res.status(201).json(marketplaceLib.createCart(store.marketplace, req.body));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/marketplace/carts/:id/items', requireActor('buyerId'), (req, res) => {
    try {
      const cart = marketplaceLib.getCart(store.marketplace, Number(req.params.id));
      if (!cart) return res.status(404).json({ error: `no cart with id ${req.params.id}` });
      if (cart.buyerId !== req.body.buyerId) {
        return res.status(403).json({ error: "only this cart's own buyer can add to it" });
      }
      const updated = marketplaceLib.addToCart(store.marketplace, cart.id, req.body.productId, req.body.quantity);
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/marketplace/carts/:id', requireActor('buyerId'), (req, res) => {
    const cart = marketplaceLib.getCart(store.marketplace, Number(req.params.id));
    if (!cart) return res.status(404).json({ error: `no cart with id ${req.params.id}` });
    if (cart.buyerId !== req.query.buyerId) {
      return res.status(403).json({ error: "only this cart's own buyer can read it" });
    }
    res.json(cart);
  });

  // Real checkout. The buyer's own leg is already authorised by Shield
  // (`requireActor('buyerId')`) before this handler is ever reached;
  // see `transferVCoin`'s own header above for why both legs still go
  // through VENVS's trusted service credential against V3.
  app.post('/api/marketplace/checkout', requireActor('buyerId'), async (req, res) => {
    try {
      const cart = marketplaceLib.getCart(store.marketplace, Number(req.body.cartId));
      if (!cart) return res.status(404).json({ error: `no cart with id ${req.body.cartId}` });
      if (cart.buyerId !== req.body.buyerId) {
        return res.status(403).json({ error: "only this cart's own buyer can check it out" });
      }
      const order = await marketplaceLib.checkout(store.marketplace, {
        cartId: cart.id,
        transferFn: transferVCoin,
        payoutFn: transferVCoin,
      });
      res.status(201).json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/marketplace/orders/:id', (req, res) => {
    const order = marketplaceLib.getOrder(store.marketplace, Number(req.params.id));
    if (!order) return res.status(404).json({ error: `no order with id ${req.params.id}` });
    res.json(order);
  });

  // -- Point of sale: a real HVNTZ business ringing up an in-person sale ---
  //
  // Per direct instruction, "make sure people's hunts and vault
  // accounts are tied to a... merch connection" and
  // `VENVS_SHOPIFY_INTEGRATION.md`'s own named POS gap: "real HVNTZ
  // businesses running VENVS as an actual point of sale, unifying
  // in-person and online sales." Real payment already has a real
  // physical-to-digital path -- VASH TAP's own `POST /api/taps/
  // :tapCode/pay`, a customer's own physical Tap resolving to their
  // real Shield session -- so this route does not move money a second
  // time; it records an already-settled in-person sale as a real
  // order, in the exact same list an online checkout produces. The
  // ownership guard is the same resolve-then-compare shape every other
  // seller-only action in this file already uses.
  app.post('/api/marketplace/sellers/:id/pos-sale', requireActor('ownerId'), (req, res) => {
    try {
      const seller = marketplaceLib.getSeller(store.marketplace, Number(req.params.id));
      if (!seller) return res.status(404).json({ error: `no seller with id ${req.params.id}` });
      if (seller.ownerId !== req.body.ownerId) {
        return res.status(403).json({ error: "only this storefront's own owner can ring up a sale for it" });
      }
      const order = marketplaceLib.recordPosSale(store.marketplace, {
        sellerId: seller.id, items: req.body.items, buyerId: req.body.buyerId || null,
      });
      res.status(201).json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Every real order this seller has, online or in-person -- the real
  // unified view the POS feature above exists to produce.
  app.get('/api/marketplace/sellers/:id/orders', (req, res) => {
    res.json({ orders: marketplaceLib.ordersForSeller(store.marketplace, Number(req.params.id)) });
  });

  // -- CHOPZ SHOP cross-posting ---------------------------------------------
  //
  // A seller opts specific items in (not the whole catalogue) and sets
  // what a creator earns per sale -- the same resolve-then-compare
  // ownership check `POST .../products` above already uses, since
  // only a product's own real seller may do either.
  app.post('/api/marketplace/products/:id/chopz-eligible', requireActor('ownerId'), (req, res) => {
    try {
      const product = marketplaceLib.getProduct(store.marketplace, Number(req.params.id));
      if (!product) return res.status(404).json({ error: `no product with id ${req.params.id}` });
      const seller = marketplaceLib.getSeller(store.marketplace, product.sellerId);
      if (!seller || seller.ownerId !== req.body.ownerId) {
        return res.status(403).json({ error: "only this product's own seller can mark it chopz-eligible" });
      }
      res.status(200).json(marketplaceLib.markChopzEligible(store.marketplace, product.id, req.body.affiliateCommissionPercent));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Registers the real product over in CHOPZ SHOP under the seller's
  // own real payout identity (`ownerId`), forwarding the SAME Shield
  // bearer token this route itself already validated -- see
  // `registerWithChopzShop`'s own header above for why that token,
  // not a service credential, is what CHOPZ SHOP's own route needs.
  app.post('/api/marketplace/products/:id/publish-to-chopz', requireActor('ownerId'), async (req, res) => {
    try {
      const product = marketplaceLib.getProduct(store.marketplace, Number(req.params.id));
      if (!product) return res.status(404).json({ error: `no product with id ${req.params.id}` });
      const seller = marketplaceLib.getSeller(store.marketplace, product.sellerId);
      if (!seller || seller.ownerId !== req.body.ownerId) {
        return res.status(403).json({ error: "only this product's own seller can publish it to CHOPZ SHOP" });
      }
      const updated = await marketplaceLib.publishToChopzShop(store.marketplace, product.id, {
        chopzRegisterFn: (sellerOwnerId, name, price, category, affiliateCommissionPercent) => registerWithChopzShop(
          sellerOwnerId, name, price, category, affiliateCommissionPercent, req.headers.authorization,
        ),
      });
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -- VOID physical fulfillment --------------------------------------------
  //
  // Operational -- a real order can span several sellers, each a
  // separate real VOID courier job, and no single buyer/seller field
  // is "the one acting human" for the whole order, the same reasoning
  // `conflicts.js`'s own group-level routes already document over in
  // VDP.
  app.post('/api/marketplace/orders/:id/fulfillment', requireCallingService(), async (req, res) => {
    try {
      const order = await marketplaceLib.requestFulfillment(store.marketplace, {
        orderId: Number(req.params.id), shippingCostPerSeller: req.body.shippingCostPerSeller, voidRequestFn: createVoidShipment,
      });
      res.status(200).json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -- Abandoned-cart recovery -----------------------------------------------
  app.post('/api/marketplace/abandoned-carts/sweep', requireCallingService(), (req, res) => {
    const abandoned = marketplaceLib.checkAbandonedCarts(store.marketplace, req.body || {});
    res.status(200).json({ abandoned });
  });

  // A pure, read-only derivation (no money moves, nothing stored) --
  // the same "compute fresh every call" posture `venues.js`'s own
  // `eventFinance` already takes over in VDP.
  app.get('/api/marketplace/carts/:id/recovery-offer', (req, res) => {
    try {
      const discountPercent = req.query.discountPercent !== undefined ? Number(req.query.discountPercent) : undefined;
      res.json(marketplaceLib.generateRecoveryOffer(store.marketplace, Number(req.params.id), { discountPercent }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -- Publishing: a real, persisted catalog ------------------------------
  //
  // Closes this app's own flagged gap: `PublishingView.jsx` called
  // `createCatalog()` fresh on every mount and seeded it client-side --
  // every published title and every purchase vanished on reload, and
  // no other browser tab or session ever saw either. Same real-backend
  // treatment Marketplace got in Phase 14, for the exact same reason.
  //
  // Any real Shield-authenticated account can publish, same "one
  // identity, no app-specific signup" posture `POST /api/marketplace/
  // sellers` above already takes -- `publishBook`'s own signature has
  // no app-of-origin field to narrow by.
  app.post('/api/publishing/books', requireActor('authorId'), (req, res) => {
    try {
      res.status(201).json(catalogLib.publishBook(store.catalog, req.body));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/publishing/books', (req, res) => {
    const { format, source, query } = req.query;
    res.json({ books: catalogLib.getCatalog(store.catalog, { format, source, query }) });
  });

  app.get('/api/publishing/books/:id', (req, res) => {
    const book = catalogLib.getBook(store.catalog, Number(req.params.id));
    if (!book) return res.status(404).json({ error: `no book with id ${req.params.id}` });
    res.json(book);
  });

  // -- Collectible editions: a real CVLLEX run of this book ---------------
  //
  // "A special edition version of books in the physical... a signed
  // version, a copy with special art on the front" (direct request),
  // closing CVLLEX's own README's own named gap. The resolve-then-
  // compare ownership check here is the same shape every other
  // seller-only action in this file already uses -- only a book's own
  // real author may order a collectible run of it.
  app.post('/api/publishing/books/:id/collectible-edition', requireActor('authorId'), async (req, res) => {
    try {
      const book = catalogLib.getBook(store.catalog, Number(req.params.id));
      if (!book) return res.status(404).json({ error: `no book with id ${req.params.id}` });
      if (book.authorId !== req.body.authorId) {
        return res.status(403).json({ error: "only this book's own author may order a collectible edition of it" });
      }
      const order = await createCvllexProductionOrder({
        creatorId: req.body.authorId,
        itemType: 'book',
        quantity: req.body.quantity,
        estimatedUnitCost: req.body.estimatedUnitCost,
        vendorNote: req.body.vendorNote,
      }, req.headers.authorization);
      res.status(201).json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Links a real, already-vaulted CVLLEX collectible run (produced,
  // then minted as a real Cvltvre Card -- both CVLLEX's own, separate
  // steps, performed over there first) back onto its real VENVS book.
  // The vault is fetched live from CVLLEX rather than trusted on the
  // caller's bare claim -- the same discipline `chopz`'s own
  // `verifyLinkedProduct` already established for an identical shape.
  app.post('/api/publishing/books/:id/collectible-edition/link-vault', requireActor('authorId'), async (req, res) => {
    try {
      const book = catalogLib.getBook(store.catalog, Number(req.params.id));
      if (!book) return res.status(404).json({ error: `no book with id ${req.params.id}` });
      if (book.authorId !== req.body.authorId) {
        return res.status(403).json({ error: "only this book's own author may link a collectible edition to it" });
      }
      const vault = await fetchCvllexVault(Number(req.body.vaultId));
      if (vault.creatorId !== req.body.authorId) {
        return res.status(403).json({ error: 'that CVLLEX vault was not ordered by this book\'s own author' });
      }
      res.status(201).json(catalogLib.linkCollectibleEdition(store.catalog, { bookId: book.id, vaultId: vault.id }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Real checkout. The buyer's own leg is already authorised by Shield
  // (`requireActor('buyerId')`) before this handler is ever reached --
  // same two-layer shape `POST /api/marketplace/checkout` above
  // already uses, and for the same reason: `purchaseBook` itself
  // refuses to run without a real `payoutFn` whenever a self-published
  // title owes its author a royalty (`requirePayoutFn`'s own guard),
  // so a flow that would charge the buyer and never pay the author
  // never starts rather than settling half.
  app.post('/api/publishing/books/:id/purchase', requireActor('buyerId'), async (req, res) => {
    try {
      const result = await catalogLib.purchaseBook(store.catalog, {
        bookId: Number(req.params.id),
        buyerId: req.body.buyerId,
        transferFn: transferVCoin,
        payoutFn: transferVCoin,
        // Optional: VDP's own library effect (a skill improved, a
        // belief shifted) is a signal, not money -- `purchaseBook`
        // already runs it AFTER the sale is recorded and returns its
        // failure rather than throwing, the same "fail soft on
        // signals, hard on money" line this ecosystem draws
        // everywhere else. Forwarding the real bearer token this
        // route itself already validated, not a service credential --
        // see `recordLibraryEffect`'s own header above.
        libraryRecordFn: (payload) => recordLibraryEffect(payload, req.headers.authorization),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Real print orders still needing a VOID shipment -- the same
  // "compute fresh every call" read Marketplace's own abandoned-cart
  // detection already is, scoped to print the same way
  // `listUnfulfilledBookOrders` itself already is.
  //
  // **Must be declared before `GET /api/publishing/orders/:id` below**
  // -- caught live in this same pass, the exact same route-ordering
  // bug fixed over in vaca's own reviewer-queue route earlier today:
  // Express matches by declaration order, and a bare `:id` param was
  // swallowing literal requests to `.../unfulfilled` too.
  app.get('/api/publishing/orders/unfulfilled', (_req, res) => {
    res.json({ orders: catalogLib.listUnfulfilledBookOrders(store.catalog) });
  });

  app.get('/api/publishing/orders/:id', (req, res) => {
    const order = catalogLib.getBookOrder(store.catalog, Number(req.params.id));
    if (!order) return res.status(404).json({ error: `no order with id ${req.params.id}` });
    res.json(order);
  });

  // Operational, same posture as `POST /api/marketplace/orders/:id/
  // fulfillment` above: a real VOID courier job, requested by a
  // trusted backend rather than the buyer or the shipping author/
  // platform directly. `requestBookFulfillment` itself works out who
  // ships it (the author for a self-published title, VENVS itself for
  // an Ingram one) and calls `voidRequestFn(shipperId, shippingCost)`
  // -- the exact same `createVoidShipment` already wired above, no
  // separate client needed.
  app.post('/api/publishing/orders/:id/fulfillment', requireCallingService(), async (req, res) => {
    try {
      const order = await catalogLib.requestBookFulfillment(store.catalog, {
        orderId: Number(req.params.id), shippingCost: req.body.shippingCost, voidRequestFn: createVoidShipment,
      });
      res.status(200).json(order);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`VENVS backend listening on :${PORT}`);
  });
})();
