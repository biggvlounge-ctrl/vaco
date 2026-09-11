// VACO AUDIT -- the one decision log.
//
// Shipped ahead of the operator-role work on purpose. Attribution is
// useful the moment it exists, and it depends on none of the open role
// questions: today every row says "a service token decided this, here
// is which one," which is a strictly better answer than the current
// one, which is nothing at all.
//
// See dev-docs/DECISION_AUDIT.md for the posture and
// dev-docs/OPERATOR_ROLES_SCOPE.md for what it is a step toward.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8819/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createAuditStore } = require('./lib/store');
const { attachStore } = require('./lib/storeBackend');
const {
  OUTCOME_KINDS, MAX_INPUT_BYTES, recordDecision, getDecision,
  queryDecisions, historyFor, describeCoverage,
} = require('./lib/decisions');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { requireCallingService } = require('./lib/shieldAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8819;
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
let store = createAuditStore();
attachStore(app, {
  appKey: 'vaco-audit',
  createDefault: createAuditStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// Every writer is another VACO service; no browser posts here. Mounted
// above every route, per the rule VOID learned the hard way -- a new
// route added above this line would be unauthenticated.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vaco-audit',
    outcomeKinds: OUTCOME_KINDS,
    maxInputBytes: MAX_INPUT_BYTES,
    // The migration metric: what share of recorded decisions can name a
    // person rather than a service. 0% today, by construction.
    coverage: describeCoverage(store),
    serviceAuth: serviceAuth.describe(),
  });
});

// -- Append ------------------------------------------------------------
//
// The only write in this service. There is deliberately no PUT, PATCH
// or DELETE anywhere in this file: an audit trail the audited party can
// edit is not evidence, and leaving the verbs unimplemented is a
// stronger guarantee than implementing them behind a guard.
//
// **`requireCallingService()`, not the app-level serviceAuth alone.**
// The mount above is necessary and not sufficient, and the difference
// is the whole reason that fourth guard shape exists: serviceAuth's
// middleware accepts *either* a service credential or a user session
// (`if (kind === 'user-session') return next()`), because on a normal
// app a logged-in person is a legitimate caller. Here they are not.
// Without this line any account holder with a Bearer token could post
// fabricated rows -- naming whoever they liked in `decidedBy` -- into a
// log that is append-only by design and therefore can never be cleaned
// up afterwards. Poisoning the evidence is the one attack this service
// has no recovery from.
//
// It also makes `recordedByService` non-null on every row, which is
// what makes the claim-vs-fact pairing below worth keeping at all.
app.post('/api/decisions', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(recordDecision(store, {
      ...req.body,
      // Who *transported* the record, taken from the verified service
      // credential rather than the body. A caller can lie about
      // `decidedBy` in the body; it cannot lie about which token it
      // presented, so the two together are checkable against each other
      // later even though only one of them is trusted today.
      recordedByService: req.callingService || null,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Read --------------------------------------------------------------

app.get('/api/decisions', (req, res) => {
  try {
    const q = req.query;
    res.json({
      decisions: queryDecisions(store, {
        app: q.app ?? null,
        route: q.route ?? null,
        outcomeKind: q.outcomeKind ?? null,
        subjectType: q.subjectType ?? null,
        subjectId: q.subjectId ?? null,
        decidedBy: q.decidedBy ?? null,
        decidedByKind: q.decidedByKind ?? null,
        since: q.since ? Number(q.since) : null,
        until: q.until ? Number(q.until) : null,
        limit: q.limit ? Number(q.limit) : 100,
      }),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/decisions/:id', (req, res) => {
  const decision = getDecision(store, Number(req.params.id));
  if (!decision) return res.status(404).json({ error: `no decision with id ${req.params.id}` });
  res.json(decision);
});

// The dispute question, first-class: "what has ever been decided about
// this thing", oldest first, so it reads as a timeline.
app.get('/api/history/:subjectType/:subjectId', (req, res) => {
  res.json({
    subjectType: req.params.subjectType,
    subjectId: req.params.subjectId,
    history: historyFor(store, req.params.subjectType, req.params.subjectId),
  });
});

app.get('/api/coverage', (_req, res) => {
  res.json(describeCoverage(store));
});

app.listen(PORT, () => {
  console.log(`VACO AUDIT listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
