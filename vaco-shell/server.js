// VACO -- the ecosystem's real app launcher and shared session
// host, named directly after the ecosystem itself: this is the one
// real front door to all of it. Lives on disk as `vaco-shell/` (not
// bare `vaco/`, which is the whole monorepo's own root and would
// collide) -- previously built and referred to as "Shell" before this
// rename. The single biggest confirmed gap across the ecosystem: at
// least seven other apps' own docs say some version of "trust Shell's
// unified session" or "needs its own Shell tile/entry point," and none
// of them had anywhere real to point at.
//
// **Real, deliberate choice: VACO does not reinvent auth.** A real,
// working, shared session contract already exists -- "Shield," mocked
// in `venvs-mock-backend/server.js` and already consumed live by both
// VDP and VENVS (`shieldAuth.js` in each). This app becomes the first
// real launcher UI *on top of* that existing service, proxying to it
// rather than standing up a second, competing session store. The
// genuinely new pieces are the app registry, the tile launcher, and a
// real SSO handoff via a `?shieldToken=` query param on outbound tile
// links -- a real, working mechanic given this environment has no
// shared cookie domain to build true silent SSO on top of (flagged
// directly, not glossed over -- see README.md's own "Not yet built").
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8789/api/apps
//   curl -X POST http://localhost:8789/api/session -H "Content-Type: application/json" -d '{"userId":"demo-user"}'

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { listApps, getApp, listBundles, getBundle } from './lib/registry.js';
import tracingModule from './lib/tracing.cjs';
const { traceMiddleware } = tracingModule;
import { getInsightCard } from './lib/insight.js';
import { createPersistentShellStore } from './lib/store.js';
import { durable } from './lib/persistence.js';
import { settleVCoin, V3_API_URL } from './lib/v3Client.js';
import shieldAuth from './lib/shieldAuth.cjs';
import serviceAuthModule from './lib/serviceAuth.cjs';
import decisionLogModule from './lib/decisionLog.cjs';
import operatorAuthModule from './lib/operatorAuth.cjs';

// This app is `"type": "module"`; both shared guards are CommonJS and
// sync as `.cjs` for exactly that reason. Default-imported and
// destructured rather than named-imported, which does not depend on
// Node's CJS named-export detection holding for these files.
const { requireActor, requireCallingService } = shieldAuth;
const { createServiceAuth } = serviceAuthModule;
const { createDecisionLog } = decisionLogModule;
const { createOperatorAuth } = operatorAuthModule;
import * as appStore from './lib/appStore.js';
import * as merch from './lib/merchStore.js';
import { seedStore } from './lib/seedStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));

const store = createPersistentShellStore();
// Money moves through these routes, so an acknowledged purchase is
// flushed to disk before the response goes out. Same posture as the
// other 24 apps.
app.use(durable(store));
seedStore(store);

const PORT = process.env.PORT || 8789;
const SHIELD_API_URL = process.env.SHIELD_API_URL || 'http://localhost:8812';



// Every store route funnels its errors through here so a bad request
// reads as a 400 with the module's own message rather than a stack.
function handle(res, fn, successStatus = 200) {
  return Promise.resolve()
    .then(fn)
    .then((body) => res.status(successStatus).json(body))
    .catch((err) => res.status(400).json({ error: err.message }));
}

app.get('/api/health', (_req, res) => {
  res.json({
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
    ok: true,
    service: 'vaco',
    shieldApiUrl: SHIELD_API_URL,
    appCount: listApps().length,
    store: appStore.describeStore(store),
    merch: merch.describeMerch(store),
  });
});

app.get('/api/apps', (_req, res) => {
  res.json({ apps: listApps() });
});

app.get('/api/apps/:id', (req, res) => {
  const found = getApp(req.params.id);
  if (!found) return res.status(404).json({ error: `no app with id ${req.params.id}` });
  res.json(found);
});

// -- Real bundle grouping (5 bundles of 3 parents each) --

app.get('/api/bundles', (_req, res) => {
  res.json({ bundles: listBundles() });
});

app.get('/api/bundles/:name', (req, res) => {
  const found = getBundle(req.params.name);
  if (!found) return res.status(404).json({ error: `no bundle named ${req.params.name}` });
  res.json(found);
});

// -- Real session, proxied to the existing Shield mock, not reinvented --

// audit-route-guards: open -- no actor exists yet; this route creates the session
app.post('/api/session', async (req, res) => {
  try {
    const shieldRes = await fetch(`${SHIELD_API_URL}/api/shield/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const body = await shieldRes.json();
    if (!shieldRes.ok) return res.status(shieldRes.status).json(body);
    res.status(shieldRes.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Shield session service unreachable: ${err.message}` });
  }
});

app.get('/api/session/:token', async (req, res) => {
  try {
    const shieldRes = await fetch(`${SHIELD_API_URL}/api/shield/session/${encodeURIComponent(req.params.token)}`);
    const body = await shieldRes.json();
    res.status(shieldRes.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Shield session service unreachable: ${err.message}` });
  }
});

// -- Real credential auth (Phase 4), proxied the same way session
// issuance already is above -- the real front door for a human to
// register/log in with a real password, not just claim a userId.

// audit-route-guards: open -- creates the identity a session would prove; nothing to check against
app.post('/api/register', async (req, res) => {
  try {
    const shieldRes = await fetch(`${SHIELD_API_URL}/api/shield/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const body = await shieldRes.json();
    res.status(shieldRes.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Shield session service unreachable: ${err.message}` });
  }
});

// audit-route-guards: open -- exchanges credentials for a session; requiring one would be circular
app.post('/api/login', async (req, res) => {
  try {
    const shieldRes = await fetch(`${SHIELD_API_URL}/api/shield/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const body = await shieldRes.json();
    res.status(shieldRes.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `Shield session service unreachable: ${err.message}` });
  }
});

// -- Real shared agent-layer surface, wrapping VACON --

app.get('/api/insight', async (req, res) => {
  try {
    const card = await getInsightCard({ query: req.query.query, invoke: req.query.invoke === 'true' });
    res.json(card);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The storefront needs to show a balance before it asks someone to
// spend it. Proxied rather than called from the browser so the page has
// one origin to talk to, the same reasoning as the Shield proxies above.
app.get('/api/wallet/:userId', async (req, res) => {
  try {
    const v3Res = await fetch(`${V3_API_URL}/api/vcoin/balance/${encodeURIComponent(req.params.userId)}`);
    const body = await v3Res.json();
    res.status(v3Res.status).json(body);
  } catch (err) {
    res.status(502).json({ error: `V3 ledger unreachable: ${err.message}` });
  }
});

// -- The App Store -------------------------------------------------
//
// What turns the shell from a launcher into a store. Listings carry
// price and publisher; the registry still owns what an app IS, so
// every read joins the two rather than restating one inside the other.

function withApp(listing) {
  const registryApp = getApp(listing.appId);
  return {
    ...listing,
    name: registryApp ? registryApp.name : listing.appId,
    description: registryApp ? registryApp.description : null,
    category: registryApp ? registryApp.category : null,
    bundle: registryApp ? registryApp.bundle : null,
    // `parent` was missing here, which is why the store rendered 37
    // flat tiles: the registry folds those into 18 real products
    // (Vvltvre is one product containing Music, Flix, Pods, Studios
    // and VENVM), and the UI could not see the folding because this
    // did not send it.
    parent: registryApp ? registryApp.parent || null : null,
    url: registryApp ? registryApp.url : null,
  };
}

app.get('/api/store/listings', (req, res) => {
  const listings = appStore.listStore(store, {
    pricingModel: req.query.pricingModel || null,
    includeUnpublished: req.query.includeUnpublished === 'true',
  });
  res.json({ listings: listings.map(withApp) });
});

app.get('/api/store/listings/:appId', (req, res) => {
  const listing = appStore.getListing(store, req.params.appId);
  if (!listing) return res.status(404).json({ error: `no listing for ${req.params.appId}` });
  res.json(withApp(listing));
});

// == Authorization boundary =============================================
//
// **Everything below this line requires a caller. Everything above it
// is how a caller is obtained.**
//
// `/api/session`, `/api/register` and `/api/login` are thin proxies to
// Shield's own three, and they are category A for the same reason
// Shield's are: requiring a credential to obtain a credential is
// circular. They are deliberately above the mount.
//
// That makes this the one place in the ecosystem where `app.use()`
// order is load-bearing by design rather than by accident, so it is
// stated rather than left to be inferred: **a new route added above
// this block is unauthenticated.** Add routes below it.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'vaco-shell' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

// Publishing an app to the store sets its price and take rate. The
// `publisherId` in the body is who gets paid, so guarding on it would
// confirm the payee is a real user -- the VAGO inversion again.
app.post('/api/store/listings', requireCallingService(), (req, res) => handle(res, () => appStore.publishListing(store, {
  ...req.body,
  // The registry check, injected. A listing for an app that does not
  // exist would be a store entry nobody can launch.
  appExistsFn: (id) => Boolean(getApp(id)),
}), 201));

app.delete('/api/store/listings/:appId', requireCallingService(), (req, res) => handle(
  res, () => appStore.unpublishListing(store, req.params.appId),
));

// **These three are not infrastructure-to-infrastructure.** Installing
// a paid app spends the user's VCoin, uninstalling revokes their own
// entitlement, and a merch order charges them for a physical good.
// They name a user, they move that user's money, and they take the
// actor check the rest of the ecosystem uses. Grouping them with the
// launcher routes would have left three live money paths open.
app.post('/api/store/install', requireActor('userId'), (req, res) => handle(res, () => appStore.install(store, {
  ...req.body,
  settleFn: settleVCoin,
}), 201));

app.post('/api/store/uninstall', requireActor('userId'), (req, res) => handle(res, () => appStore.uninstall(store, req.body || {})));

// A refund reverses a purchase. A buyer who could call it would have a
// free trial of every paid app in the store.
app.post('/api/store/refund', requireOperator('vaco-shell:reversal'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/store/refund',
      outcomeKind: 'reversal',
      subjectType: 'entitlement',
      subjectId: `${(req.body || {}).userId ?? ''}:${(req.body || {}).appId ?? ''}`,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  return handle(res, () => appStore.refund(store, {
    ...req.body,
    settleFn: settleVCoin,
  }));
});

app.get('/api/store/library/:userId', (req, res) => {
  res.json({ library: appStore.listLibrary(store, req.params.userId).map((e) => ({ ...e, ...withApp({ appId: e.appId }) })) });
});

app.get('/api/store/access/:userId/:appId', (req, res) => {
  res.json(appStore.hasAccess(store, req.params.userId, req.params.appId));
});

app.get('/api/store/publishers/:publisherId', (req, res) => {
  res.json(appStore.publisherEarnings(store, req.params.publisherId));
});

// -- VACO Merch ----------------------------------------------------
//
// One storefront across every app brand, zero inventory. Lives inside
// the App Store rather than beside it: merch is something you buy from
// the store, not a separate destination.

app.get('/api/merch/brands', (_req, res) => {
  res.json({ brands: merch.listBrands(store) });
});

app.get('/api/merch/products', (req, res) => {
  const brand = req.query.brand;
  const products = brand
    ? merch.listByBrand(store, brand)
    : store.merchProducts.filter((p) => p.available);
  res.json({ products });
});

app.get('/api/merch/products/:productId', (req, res) => {
  const product = merch.getProduct(store, req.params.productId);
  if (!product) return res.status(404).json({ error: `no product ${req.params.productId}` });
  res.json(product);
});

app.post('/api/merch/products', requireCallingService(), (req, res) => handle(
  res, () => merch.createProduct(store, req.body || {}), 201,
));

app.delete('/api/merch/products/:productId', requireCallingService(), (req, res) => handle(
  res, () => merch.discontinueProduct(store, req.params.productId),
));

app.post('/api/merch/orders', requireActor('customerId'), (req, res) => handle(res, () => merch.placeOrder(store, {
  ...req.body,
  settleFn: settleVCoin,
}), 201));

app.get('/api/merch/orders/:id', (req, res) => {
  const order = merch.getOrder(store, Number(req.params.id));
  if (!order) return res.status(404).json({ error: `no order ${req.params.id}` });
  res.json(order);
});

// Fulfilment pipeline state, reported by the print provider, not
// claimed by the customer.
app.post('/api/merch/orders/:id/submit', requireCallingService(), (req, res) => handle(res, () => merch.submitToFulfilment(store, {
  ...req.body, orderId: Number(req.params.id),
})));

app.post('/api/merch/orders/:id/advance', requireCallingService(), (req, res) => handle(res, () => merch.advanceOrder(store, {
  ...req.body, orderId: Number(req.params.id),
})));

app.get('/api/merch/customers/:customerId/orders', (req, res) => {
  res.json({ orders: merch.listOrdersForCustomer(store, req.params.customerId) });
});

app.get('/api/merch/brands/:appBrandId/earnings', (req, res) => {
  res.json(merch.brandEarnings(store, req.params.appBrandId));
});

app.listen(PORT, () => {
  console.log(`VACO listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
