// Yap -- CVNVO's decoupled dating-safety report app, modeled on the
// real Tea app. A separate, standalone app from CVNVO itself, per
// explicit instruction -- calls back into CVNVO's real profile API
// for reporter verification and subject lookups, rather than owning a
// local copy of profile data.
// Source of truth: CVNVO_ARCHITECTURE.md, CVNVO_CORE_FEATURES.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8802/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createYapStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const { traceMiddleware } = require('./lib/tracing.cjs');
const {
  YAP_FLAGS, submitYapReport, getYapReports, getYapSummary, getSafetyLookup,
} = require('./lib/yap');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8802;
const CVNVO_API_URL = process.env.CVNVO_API_URL || 'http://localhost:8798';
// -- The store, and which backend holds it ----------------------------
//
// `let`, not `const`: with DATABASE_URL set this app's store lives in
// Postgres, which cannot be built synchronously. `attachStore` mounts a
// gate ahead of the routes so no request runs before the store has
// loaded, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide. The route handlers close
// over this binding rather than a value, so they see the real store the
// moment it is installed.
//
// Without DATABASE_URL nothing changes: the same JSON file, in the same
// place, with the same guarantees.
let store = createYapStore();
attachStore(app, {
  appKey: 'yap',
  createDefault: createYapStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// The real, injected cross-app call back into CVNVO's own, already-
// live `GET /api/profiles/:userId` -- mirrors CVNVO's own
// `voidFetchFn`/`vsafeCreateFn` pattern, just in the reverse
// direction, since Yap is the one that doesn't own the profile data
// here.
async function fetchCvnvoProfile(userId) {
  const res = await fetch(`${CVNVO_API_URL}/api/profiles/${userId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchCvnvoProfile failed (${res.status})`);
  return body;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'yap', yapFlags: YAP_FLAGS });
});

// audit-route-guards: open -- anonymous signal submission is the product; attribution would defeat it
app.post('/yap/reports', async (req, res) => {
  try {
    res.status(201).json(await submitYapReport(store, { ...req.body, profileFetchFn: fetchCvnvoProfile }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/yap/reports/:subjectId', (req, res) => {
  try {
    res.json({ reports: getYapReports(store, req.params.subjectId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/yap/summary/:subjectId', (req, res) => {
  try {
    res.json(getYapSummary(store, req.params.subjectId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/yap/lookup/:subjectId', async (req, res) => {
  try {
    res.json(await getSafetyLookup(store, req.params.subjectId, { profileFetchFn: fetchCvnvoProfile }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Yap listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
