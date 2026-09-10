// CHOPZ SHOP -- TikTok Shop model commerce layer. A separate,
// standalone app from CHOPZ itself (the video/social feed) -- same
// real relationship as TikTok to TikTok Shop, per explicit
// instruction. Native in-app checkout, creator-set performance-only
// affiliate commission, real VOID fulfillment.
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's CHOPZ
// section, CHOPZ_TIKTOK_COMPARABLES.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8801/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createChopzShopStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { createProduct, getProduct } = require('./lib/products');
const { createAffiliateLink, getAffiliateLink, recordClick } = require('./lib/affiliateLinks');
const {
  CHOPZ_ESCROW_ACCOUNT, DEFAULT_FEE_PERCENT, createOrder, getOrder, requestFulfillment, createCartCheckout,
} = require('./lib/orders');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const { traceMiddleware } = require('./lib/tracing.cjs');
// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8801;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';
const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';
const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';

// Internal services (V3, VACA, Analytics, Notify, VACON) refuse an
// unauthenticated mutating call. This app calls them server-to-server
// with no end-user session, so it presents a service credential. See
// shared/serviceAuth.js.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'chopz-shop';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createChopzShopStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Atomic settlement: every leg moves, or none does.
//
// **Every multi-party payment in this app used to be consecutive
// transfers.** The second leg can fail on its own -- often precisely
// because the first just drew down the account it pays from -- and the
// record that would mark the work done is written afterwards. So a
// partial failure left one party paid, another not, and a retry that
// paid the first one again.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass. `settleVCoin` is
// removed rather than kept beside it: a working single-transfer helper
// is what the next money path gets written with, and consecutive calls
// to it are the defect.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names what is being
      // settled, so it doubles as the idempotency key: a retried
      // settlement replays V3's first answer rather than paying
      // twice. Atomicity stops a *partial* settlement; this stops
      // a *duplicate* one.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// The real, injected `voidClient.createShipment()`-style call named in
// VOID_SERVICE_VERTICALS_COMPARABLES.md -- a live request into VOID's
// own job marketplace, `courier` vertical (that doc's own pick for the
// closest real fit to CHOPZ SHOP fulfillment). `unitPrice` is the real
// quoted shipping cost since `courier` is a flat-quote vertical.
async function requestVoidCourierJob(sellerId, shippingCost) {
  const res = await fetch(`${VOID_API_URL}/api/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verticalId: 'courier', customerId: sellerId, quantity: 1, unitPrice: shippingCost,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `requestVoidCourierJob failed (${res.status})`);
  return body;
}

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real checkout is never held up by VACO Analytics being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'chopz-shop', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

const { requireActor, requireSession } = require('./lib/shieldAuth.cjs');

// Fulfillment is requested against a paid order and dispatches a real
// VOID delivery, billed onward. Only the buyer on that order may ask
// for it.
function requireOrderBuyer() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const order = getOrder(store, Number(req.params.id));
    if (!order) return res.status(404).json({ error: `no order with id ${req.params.id}` });
    if (order.buyerId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the buyer on this order may request fulfillment' });
    }
    return next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'chopz-shop', escrowAccount: CHOPZ_ESCROW_ACCOUNT, defaultFeePercent: DEFAULT_FEE_PERCENT });
});

app.post('/chopz-shop/products', requireActor('sellerId'), (req, res) => {
  try {
    res.status(201).json(createProduct(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listing. The resource could be created and fetched by id but never
// enumerated, so no browsable surface could exist without already
// knowing an id. Same gap found in five apps on this pass.
app.get('/chopz-shop/products', (_req, res) => {
  res.json({ products: store.products });
});

app.get('/chopz-shop/products/:id', (req, res) => {
  const product = getProduct(store, Number(req.params.id));
  if (!product) return res.status(404).json({ error: `no product with id ${req.params.id}` });
  res.json(product);
});

app.post('/chopz-shop/affiliate/links', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(createAffiliateLink(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/chopz-shop/affiliate/links', (_req, res) => {
  res.json({ links: store.affiliateLinks });
});

app.get('/chopz-shop/affiliate/links/:id', (req, res) => {
  const link = getAffiliateLink(store, Number(req.params.id));
  if (!link) return res.status(404).json({ error: `no affiliate link with id ${req.params.id}` });
  res.json(link);
});

app.post('/chopz-shop/affiliate/links/:id/click', requireActor('buyerId'), (req, res) => {
  try {
    res.json(recordClick(store, { ...req.body, linkId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/chopz-shop/orders', requireActor('buyerId'), async (req, res) => {
  try {
    res.status(201).json(await createOrder(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/chopz-shop/cart-checkout', requireActor('buyerId'), async (req, res) => {
  try {
    const checkout = await createCartCheckout(store, { ...req.body, settleFn: settleVCoin });
    await pushMetric('checkout_revenue', checkout.totalCharged);
    res.status(201).json(checkout);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/chopz-shop/orders/:id', (req, res) => {
  const order = getOrder(store, Number(req.params.id));
  if (!order) return res.status(404).json({ error: `no order with id ${req.params.id}` });
  res.json(order);
});

app.post('/chopz-shop/orders/:id/request-fulfillment', requireOrderBuyer(), async (req, res) => {
  try {
    res.json(await requestFulfillment(store, {
      ...req.body, orderId: Number(req.params.id), voidRequestFn: requestVoidCourierJob,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CHOPZ SHOP listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
