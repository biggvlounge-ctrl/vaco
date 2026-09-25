// VASH TAP — the physical-to-digital interaction layer.
//
// The narrowest real slice of `dev-docs/on-deck/VASH_TAP_FREEZE.md`,
// scoped by its own mandatory §1/§55 audit — see
// `dev-docs/on-deck/README.md`, "The VASH TAP §1/§55 audit, 25 Sep
// 2026" for what was confirmed real and what was confirmed missing.
// Built on: V3 (VCoin/VASH ledger), VACA (identity), HVNTZ (business),
// vaco-notify (dispatch). Does NOT attempt: real phone push (does not
// exist anywhere in this ecosystem — vaco-notify's console/webhook
// channels stand in), general messaging (the only real messaging
// system is locked to matched CVNVO dating pairs), QVAN/fraud (QVAN is
// a chat persona name, not a security system), employee accounts or
// recurring scheduling, dimensioned/geographic analytics (the existing
// analytics schema has no per-entity or location field).
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8825/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { attachStore } = require('./lib/storeBackend');
const {
  TAP_TYPES, createTapStore, registerTap, linkDreamsScreen, unlinkDreamsScreen,
  assignTap, resolveTap, payViaTap,
  freezeTap, unfreezeTap, transactionsForTap, spenderHistory, revenueByTap, reseedIds,
} = require('./lib/tap');
const { seedDemoData } = require('./lib/seedDemoData');
const { requireActor, requireSession } = require('./lib/shieldAuth.cjs');
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

const PORT = process.env.PORT || 8825;

// -- cross-app clients, injected rather than hard-wired -----------------
//
// Matches VOID's own documented convention ("Cross-app calls are
// injected, not hard-wired — a transferFn, hvntzFetchFn, voidRequestFn,
// etc. Keeps modules runnable in plain Node with no live network").
// Every function here checks `res.ok` before trusting the body — the
// exact bug this ecosystem already found and fixed once elsewhere.
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';
const VACA_API_URL = process.env.VACA_API_URL || 'http://localhost:8804';
const HVNTZ_API_URL = process.env.HVNTZ_API_URL || 'http://localhost:8792';
const VACO_NOTIFY_URL = process.env.VACO_NOTIFY_URL || 'http://localhost:8818';
const DREAMS_API_URL = process.env.DREAMS_API_URL || 'http://localhost:8814';

// The credential this app presents AS a caller — distinct from
// serviceAuth's allowlist above, which checks who calls *this* app.
// V3's `/api/vcoin/transfer` is `actorOrService('fromUserId')`: a
// live session matching fromUserId satisfies it, or a verified
// service does. requireActor('fromUserId') already proved the
// request came from that user at vash-tap's own layer, but that proof
// does not travel with a plain server-to-server fetch — nothing here
// forwards the spender's Authorization header on to V3. Without this,
// every payment 401s against a real V3, exactly the "no ledger, only
// attribution" boundary made unreachable. Same reasoning covers
// vaco-notify's `POST /api/notify`, which enforces the identical
// app-level floor. See void/server.js's own `serviceHeaders()`.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vash-tap';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

async function fetchHvntzBusiness(businessId) {
  const res = await fetch(`${HVNTZ_API_URL}/api/business/${businessId}`);
  const body = await res.json();
  if (!res.ok) return null;
  return body;
}

// Three call sites ask HVNTZ whether the caller owns a business, and
// all three need the same distinction shieldAuth.cjs already draws for
// Shield: HVNTZ answering "no such business" and HVNTZ being
// unreachable are different failures. `fetchHvntzBusiness` throws on
// the network failure (`fetch` itself rejects); left unwrapped inside
// an async Express 4 middleware or handler, that throw becomes an
// unhandled rejection and the request just hangs — no response, ever
// — rather than the clean 502 an outage should produce. This is the
// one place that distinction is made, so every caller gets it.
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

async function fetchDreamsScreen(screenId) {
  const res = await fetch(`${DREAMS_API_URL}/api/screens/${screenId}`);
  if (res.status === 404) return null;
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchDreamsScreen failed (${res.status})`);
  return body;
}

// Same "network failure is a 502, not a validation error" distinction
// as `resolveHvntzBusiness` above — a DREAMS outage while linking a
// screen must not read as "that screen doesn't exist."
async function resolveDreamsScreen(screenId, res) {
  let screen;
  try {
    screen = await fetchDreamsScreen(screenId);
  } catch (err) {
    res.status(502).json({ error: `DREAMS unreachable (${err.message})` });
    return undefined;
  }
  if (!screen) {
    res.status(404).json({ error: `no DREAMS screen with id ${screenId}` });
    return undefined;
  }
  return screen;
}

async function fetchVacaIdentityStatus(subjectType, subjectId) {
  const res = await fetch(`${VACA_API_URL}/api/identity-status/${subjectType}/${subjectId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchVacaIdentityStatus failed (${res.status})`);
  return body;
}

// §7's flow: VASH TAP -> VACA -> VASH authorization -> EXISTING VASH
// TRANSACTION SYSTEM. This is the last step — the only thing that
// moves VCoin. An optional idempotency key is forwarded to V3's own
// idempotency layer so a retried tap payment cannot double-charge.
async function transferViaV3(fromUserId, toUserId, amount, reason, idempotencyKey) {
  const headers = { 'Content-Type': 'application/json', ...serviceHeaders() };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `transferViaV3 failed (${res.status})`);
  return body;
}

// §8's "immediate phone alert", using the real channel that exists
// today (see the file header). `send` never throws for an undelivered
// notification — it reports `status: 'undelivered'` — so this mirrors
// that rather than wrapping it in a try/catch that would hide it.
async function sendViaNotify(notification) {
  const res = await fetch(`${VACO_NOTIFY_URL}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
    body: JSON.stringify(notification),
  });
  return res.json();
}

// -- the store -----------------------------------------------------------

let store = createTapStore();
attachStore(app, {
  appKey: 'vash-tap',
  createDefault: createTapStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => {
    store = loaded;
    reseedIds(store);
  },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vash-tap',
    tapTypes: TAP_TYPES,
    taps: store.taps.length,
    assignments: store.assignments.length,
    transactions: store.transactions.length,
    serviceAuth: serviceAuth.describe(),
  });
});

// -- taps ------------------------------------------------------------------
//
// Only the business's real HVNTZ owner may register a Tap Point for
// it — the same `requireBusinessOwner` shape HVNTZ's own server.js
// uses, crossing the app boundary via `fetchHvntzBusiness` instead of
// a local store lookup.
async function requireCrossAppBusinessOwner(req, res, next) {
  const businessId = (req.body || {}).businessId;
  if (businessId === undefined || businessId === null) {
    return res.status(400).json({ error: 'this route must name the businessId it acts on' });
  }
  const business = await resolveHvntzBusiness(businessId, res);
  if (!business) return undefined;
  if (String(business.ownerId) !== String(req.sessionUserId)) {
    return res.status(403).json({ error: 'only the owner of this business may act on it' });
  }
  return next();
}

app.post('/api/taps', requireSession(), requireCrossAppBusinessOwner, async (req, res) => {
  try {
    const tap = await registerTap(store, { ...req.body, businessFetchFn: fetchHvntzBusiness });
    res.status(201).json(tap);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/taps/:tapCode', (req, res) => {
  const tap = store.taps.find((t) => t.tapCode === req.params.tapCode);
  if (!tap) return res.status(404).json({ error: `no tap ${req.params.tapCode}` });
  res.json(tap);
});

app.get('/api/business/:businessId/taps', (req, res) => {
  const businessId = Number(req.params.businessId);
  res.json({ taps: store.taps.filter((t) => t.businessId === businessId) });
});

// §6, Tap Resolution — open, no session required. §2's own framing:
// tapping identifies the OBJECT; authorization happens at the payment
// step, not at resolution. A closed door here would break the most
// basic demo — "what is this Tap" — for the one caller who genuinely
// has no account yet: someone tapping for the first time.
app.get('/api/taps/:tapCode/resolve', async (req, res) => {
  try {
    const resolved = await resolveTap(store, req.params.tapCode, {
      identityFetchFn: fetchVacaIdentityStatus,
      businessFetchFn: fetchHvntzBusiness,
    });
    res.json(resolved);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// -- assignments -------------------------------------------------------
//
// §5's dynamic assignment. Only the business owner may assign a Tap —
// same cross-app ownership check as creation, resolved from the Tap's
// own businessId rather than the body, since an assignment names who
// is assigned, not which business it belongs to.
async function requireTapBusinessOwner(req, res, next) {
  const tap = store.taps.find((t) => t.tapCode === req.params.tapCode);
  if (!tap) return res.status(404).json({ error: `no tap ${req.params.tapCode}` });
  if (!tap.businessId) return res.status(400).json({ error: `tap ${tap.tapCode} has no business to check ownership against` });
  const business = await resolveHvntzBusiness(tap.businessId, res);
  if (!business) return undefined;
  if (String(business.ownerId) !== String(req.sessionUserId)) {
    return res.status(403).json({ error: 'only the owner of this tap\'s business may act on it' });
  }
  req.tap = tap;
  return next();
}

app.post('/api/taps/:tapCode/assignments', requireSession(), requireTapBusinessOwner, async (req, res) => {
  try {
    const assignment = await assignTap(store, {
      ...req.body,
      tapCode: req.params.tapCode,
      createdBy: req.sessionUserId,
      identityFetchFn: fetchVacaIdentityStatus,
    });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// §40, Lost/Stolen Tap — "Owner can immediately: Freeze Tap... Stop new
// protected transactions." Same ownership check as assignment, since
// it is the identical question: does this session own the business
// this Tap belongs to. Scoped like the rest of this build to business
// Taps (`requireTapBusinessOwner` requires `tap.businessId`) — a
// personal Tap's freeze would need an identity-owner check this pass
// never built, since no personal Tap exists in the seeded demo either.
app.post('/api/taps/:tapCode/freeze', requireSession(), requireTapBusinessOwner, (req, res) => {
  try {
    res.json(freezeTap(store, { tapCode: req.params.tapCode }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/taps/:tapCode/unfreeze', requireSession(), requireTapBusinessOwner, (req, res) => {
  try {
    res.json(unfreezeTap(store, { tapCode: req.params.tapCode }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- DREAMS screen link ---------------------------------------------------
//
// Optional, reference-only: a business Tap Point can name a real DREAMS
// screen at the same physical location, so that location also carries
// ad inventory. Neither app's record moves — DREAMS keeps owning the
// screen, VASH TAP keeps owning the Tap; this only stores the id.
// Ownership check is the same `requireTapBusinessOwner` as freeze —
// only the business that owns the Tap may point it at a screen.
app.post('/api/taps/:tapCode/dreams-screen', requireSession(), requireTapBusinessOwner, async (req, res) => {
  const { dreamsScreenId } = req.body || {};
  if (dreamsScreenId === undefined || dreamsScreenId === null) {
    return res.status(400).json({ error: 'this route requires a dreamsScreenId' });
  }
  const screen = await resolveDreamsScreen(dreamsScreenId, res);
  if (!screen) return undefined;
  try {
    const tap = await linkDreamsScreen(store, {
      tapCode: req.params.tapCode,
      dreamsScreenId,
      screenFetchFn: async () => screen,
    });
    return res.json(tap);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/taps/:tapCode/dreams-screen/unlink', requireSession(), requireTapBusinessOwner, (req, res) => {
  try {
    res.json(unlinkDreamsScreen(store, { tapCode: req.params.tapCode }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- payment -------------------------------------------------------------
//
// §7 end to end. `requireActor('fromUserId')` proves the spender's own
// session, exactly as V3's own `/api/vcoin/transfer` does — the same
// person authorizing the money is the one whose session this checks.
app.post('/api/taps/:tapCode/pay', requireActor('fromUserId'), async (req, res) => {
  try {
    const { fromUserId, amount, tip, message, idempotencyKey } = req.body || {};
    const record = await payViaTap(store, {
      tapCode: req.params.tapCode,
      fromUserId,
      amount,
      tip,
      message,
      identityFetchFn: fetchVacaIdentityStatus,
      transferFn: (from, to, total, reason) => transferViaV3(from, to, total, reason, idempotencyKey),
      notifyFn: sendViaNotify,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- attribution and history ---------------------------------------------

app.get('/api/taps/:tapCode/transactions', (req, res) => {
  res.json({ transactions: transactionsForTap(store, req.params.tapCode) });
});

// §18, spender-side complete tracking — the caller's own history only.
app.get('/api/spenders/:userId/history', requireSession(), (req, res) => {
  if (String(req.params.userId) !== String(req.sessionUserId)) {
    return res.status(403).json({ error: 'a spender may only read their own history' });
  }
  return res.json({ transactions: spenderHistory(store, req.params.userId) });
});

// §16, revenue attribution — Tap -> transaction -> revenue -> business,
// visible only to the business's real HVNTZ owner.
app.get('/api/business/:businessId/revenue', requireSession(), async (req, res) => {
  const businessId = Number(req.params.businessId);
  const business = await resolveHvntzBusiness(businessId, res);
  if (!business) return undefined;
  if (String(business.ownerId) !== String(req.sessionUserId)) {
    return res.status(403).json({ error: 'only the owner of this business may read its revenue' });
  }
  return res.json({ businessId, byTap: revenueByTap(store, businessId) });
});

// §46's own required runnable demo -- HUNT Barber Shop, Chair 1
// through 5. Seeded through the real registerTap/assignTap functions
// (see lib/seedDemoData.js), only against a genuinely empty store, so
// a persisted store with real taps is never touched and restarting the
// server twice never double-seeds. Same file-backed-store timing as
// hvntz/vago/void's own onReady: for the no-DATABASE_URL path
// attachStore's onReady runs synchronously above this line, so `store`
// already names the loaded store by the time this checks it.
async function start() {
  if (store.taps.length === 0) {
    await seedDemoData(store, { registerTap, assignTap });
  }
  app.listen(PORT, () => {
    console.log(`VASH TAP listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
}

start();
