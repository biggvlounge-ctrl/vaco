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
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const {
  YAP_FLAGS, YAP_STATUSES, submitYapReport, getYapReports, getYapSummary, getSafetyLookup,
} = require('./lib/yap');
const {
  listModerationQueue, queueDepth, publishReport, rejectReport,
  disputeYapReport, removeReport, detectBrigading,
} = require('./lib/moderation');

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

// **The guard that decides who may publish a report about a person.**
// There is deliberately no service-token fallback on these routes:
// `operatorAuth`'s own header explains why, and it applies with full
// force here. A compromised service should not be able to publish a
// defamatory claim about a named individual.
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'yap',
    yapFlags: YAP_FLAGS,
    yapStatuses: YAP_STATUSES,
    operatorAuth: operatorAuth.describe(),
    // The backlog, on the health endpoint on purpose: an unattended
    // moderation queue is an operational failure of this app, not a
    // separate dashboard's problem. A growing `pending` number means
    // real reports nobody has read.
    moderationQueue: queueDepth(store),
  });
});

// audit-route-guards: open -- submitting a report is the product, and it no longer publishes anything; a moderator decides that at POST /yap/moderation/:id/publish
app.post('/yap/reports', async (req, res) => {
  try {
    const report = await submitYapReport(store, { ...req.body, profileFetchFn: fetchCvnvoProfile });
    // 202, not 201. The report was accepted, not published — and the
    // status code is the cheapest place to say so, because a client
    // that reads 201 as "it is live now" would be wrong and would tell
    // the reporter so.
    res.status(202).json({
      report,
      published: false,
      message: 'Report received and queued for human review. It is not visible to anyone yet.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The subject's side of due process. Guarded as open in the same sense
// the submission route is — but the module still checks that the named
// subject is the report's actual subject, so this cannot be used to
// dispute somebody else's report.
//
// audit-route-guards: open -- the subject of a report contesting it; the module verifies the named subject owns the report, and a session check belongs here once CVNVO exposes one
app.post('/yap/reports/:id/dispute', (req, res) => {
  try {
    res.json(disputeYapReport(store, { ...req.body, reportId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- moderation, all four behind one scope ----------------------------

app.get('/yap/moderation/queue', requireOperator('yap:moderate'), (req, res) => {
  try {
    const { status, subjectId } = req.query;
    res.json({
      queue: listModerationQueue(store, {
        ...(status ? { status: String(status).split(',') } : {}),
        ...(subjectId ? { subjectId: String(subjectId) } : {}),
      }),
      depth: queueDepth(store),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/yap/moderation/:id/publish', requireOperator('yap:moderate'), (req, res) => {
  try {
    res.json(publishReport(store, { ...req.body, reportId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/yap/moderation/:id/reject', requireOperator('yap:moderate'), (req, res) => {
  try {
    res.json(rejectReport(store, { ...req.body, reportId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/yap/moderation/:id/remove', requireOperator('yap:moderate'), (req, res) => {
  try {
    res.json(removeReport(store, { ...req.body, reportId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Flags only. Nothing acts on this — see `detectBrigading`.
app.get('/yap/moderation/brigading', requireOperator('yap:moderate'), (_req, res) => {
  try {
    res.json({ flagged: detectBrigading(store) });
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
