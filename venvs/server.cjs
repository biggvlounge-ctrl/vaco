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
const { requireActor } = require('./lib/shieldAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const PORT = process.env.PORT || 8829;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

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

(async () => {
  const marketplaceLib = await import('./src/lib/marketplace.js');

  function createVenvsStore() {
    return { marketplace: marketplaceLib.createMarketplace() };
  }

  let store = createVenvsStore();
  attachStore(app, {
    appKey: 'venvs',
    createDefault: createVenvsStore,
    filePath: path.join(__dirname, 'data', 'store.json'),
    onReady: (loaded) => { store = loaded; },
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true, service: 'venvs',
      sellers: store.marketplace.sellers.length,
      products: store.marketplace.products.length,
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

  app.listen(PORT, () => {
    console.log(`VENVS backend listening on :${PORT}`);
  });
})();
