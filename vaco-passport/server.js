// VACO Verified Business Network — Business Passport, Levels 1-3.
//
// The narrowest real slice of
// `dev-docs/on-deck/VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md`, scoped
// by its own §30 mandatory audit — see `dev-docs/on-deck/README.md`,
// "The VACO Verified Business Network §30 audit, 25 Sep 2026" for what
// was confirmed real and what was confirmed missing.
// Built on: VACA (identity — already generic), HVNTZ (business
// records), V3 (the real ledger and its real transaction history).
// Does NOT attempt: Levels 4-5 (tokenization, tokenized assets — no
// legal/compliance review or VOKEN token-factory pipeline exists),
// multi-tenant employee/role permissions (no substrate anywhere in the
// ecosystem), business-distinct wallets or treasury authorization (V3
// is userId-only throughout), Community Treasury/Proof-of-Impact (zero
// real code found), and the Interoperability Gateway/SDK/Developer
// Portal (one narrow precedent exists — VOID Direct's API-key system —
// but no portal, sandbox, or scoping layer to extend).
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8826/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { attachStore } = require('./lib/storeBackend');
const {
  NETWORK_LEVELS, createPassportStore, findPassport, registerPassport,
  verifyPassport, assessNetworkActivity, reseedIds,
} = require('./lib/passport');
const { seedDemoData } = require('./lib/seedDemoData');
const { requireSession } = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(traceMiddleware());

// No route here has a legitimate anonymous caller — the same floor
// every other app in this ecosystem stands on.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8826;

// -- cross-app clients, injected rather than hard-wired -----------------
//
// Matches VOID's own documented convention and VASH TAP's own use of
// it. Every function here checks `res.ok` before trusting the body.
const HVNTZ_API_URL = process.env.HVNTZ_API_URL || 'http://localhost:8792';
const VACA_API_URL = process.env.VACA_API_URL || 'http://localhost:8804';
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-passport';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

async function fetchHvntzBusiness(businessId) {
  const res = await fetch(`${HVNTZ_API_URL}/api/business/${businessId}`, { headers: serviceHeaders() });
  const body = await res.json();
  if (!res.ok) return null;
  return body;
}

// Same distinction shieldAuth.cjs draws for Shield, and VASH TAP's
// server.js already draws for HVNTZ: "no such business" and "HVNTZ is
// unreachable" are different failures, and only one of them is a 404.
// Left unwrapped inside async Express middleware, a network error here
// is an unhandled rejection that never sends a response — VASH TAP's
// own README documents finding this the hard way.
async function resolveHvntzBusiness(businessId, res) {
  let business;
  try {
    business = await fetchHvntzBusiness(businessId);
  } catch (err) {
    res.status(502).json({ error: `HVNTZ unreachable (${err.message})` });
    return undefined;
  }
  if (!business) {
    res.status(404).json({ error: `no business with id ${businessId}` });
    return undefined;
  }
  return business;
}

async function fetchVacaIdentityStatus(subjectType, subjectId) {
  const res = await fetch(`${VACA_API_URL}/api/identity-status/${subjectType}/${subjectId}`, { headers: serviceHeaders() });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchVacaIdentityStatus failed (${res.status})`);
  return body;
}

// §4's own rule: read V3's real transaction history, never a second
// copy of it. This app never calls /api/vcoin/transfer — it has no
// route that moves money, only ones that read what V3 already recorded.
async function fetchV3Transactions(userId) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transactions/${encodeURIComponent(userId)}`, { headers: serviceHeaders() });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchV3Transactions failed (${res.status})`);
  return body.transactions || [];
}

// -- the store -----------------------------------------------------------

let store = createPassportStore();
attachStore(app, {
  appKey: 'vaco-passport',
  createDefault: createPassportStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => {
    store = loaded;
    reseedIds(store);
  },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vaco-passport',
    networkLevels: NETWORK_LEVELS,
    passports: store.passports.length,
    serviceAuth: serviceAuth.describe(),
  });
});

// -- ownership -------------------------------------------------------------
//
// Only the business's real HVNTZ owner may register, verify, or
// refresh a Passport — the same `requireBusinessOwner` shape HVNTZ's
// own server.js uses, and the same cross-app version VASH TAP already
// built, crossing the app boundary via `fetchHvntzBusiness`.
async function requireBusinessOwner(businessId, req, res, next) {
  const business = await resolveHvntzBusiness(businessId, res);
  if (!business) return undefined;
  if (String(business.ownerId) !== String(req.sessionUserId)) {
    return res.status(403).json({ error: 'only the owner of this business may act on its Passport' });
  }
  req.business = business;
  return next();
}
const requireBodyBusinessOwner = () => (req, res, next) => requireBusinessOwner((req.body || {}).businessId, req, res, next);
const requireParamBusinessOwner = () => (req, res, next) => requireBusinessOwner(Number(req.params.businessId), req, res, next);

// -- passports ---------------------------------------------------------

app.post('/api/passports', requireSession(), requireBodyBusinessOwner(), async (req, res) => {
  try {
    const passport = await registerPassport(store, { businessId: req.body.businessId, businessFetchFn: fetchHvntzBusiness });
    res.status(201).json(passport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public — the same "resolution identifies, it does not authorize"
// reasoning VASH TAP's own resolve route documents. Fails soft on an
// HVNTZ outage rather than 502ing the one open read route, matching
// resolveTap's own precedent.
app.get('/api/passports/:businessId', async (req, res) => {
  const businessId = Number(req.params.businessId);
  const passport = findPassport(store, businessId);
  if (!passport) return res.status(404).json({ error: `no Passport for business ${businessId}` });
  let business = null;
  try {
    business = await fetchHvntzBusiness(businessId);
  } catch {
    business = null;
  }
  return res.json({ ...passport, business });
});

app.post('/api/passports/:businessId/verify', requireSession(), requireParamBusinessOwner(), async (req, res) => {
  try {
    const passport = await verifyPassport(store, {
      businessId: Number(req.params.businessId),
      identityFetchFn: fetchVacaIdentityStatus,
    });
    res.json(passport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/passports/:businessId/network-activity', requireSession(), requireParamBusinessOwner(), async (req, res) => {
  try {
    const passport = await assessNetworkActivity(store, {
      businessId: Number(req.params.businessId),
      transactionsFetchFn: () => fetchV3Transactions(req.business.ownerId),
    });
    res.json(passport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// §46-equivalent demo, narrowed the same way VASH TAP's was: a single
// real HVNTZ business (HUNT Barber Shop, already seeded by VASH TAP's
// own demo data under businessId 9001) with a Passport at Level 1,
// verified through real registerPassport/verifyPassport functions.
async function start() {
  if (store.passports.length === 0) {
    await seedDemoData(store, { registerPassport, verifyPassport });
  }
  app.listen(PORT, () => {
    console.log(`VACO Passport listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
}

start();
