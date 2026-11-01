// VACA -- the ecosystem's identity/authenticity verification layer.
// One of V3's three real, distinct components (VCoin, VASH, VACA) --
// confirmed via direct investigation that VCoin/VASH were already
// genuinely separate (distinct stores, distinct API namespaces in
// `venvs-mock-backend`) but VACA had never been built as real code
// anywhere, only referenced by name across VSAFE's/VOKEN's own docs.
// This is that real, standalone, app-agnostic service.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8804/api/health

const { describeCryptoPosture } = require('./lib/cryptoAgility');
const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVacaStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const {
  VERIFICATION_STATUSES, AUTHENTICITY_GRADES, submitVerification, getVerification,
  listVerificationsForSubject, listPendingVerifications, approveVerification, rejectVerification, getAuthenticityGrade,
  isIdentityVerified,
} = require('./lib/verifications');
const { getChain, getBlock, verifyChainIntegrity } = require('./lib/blockchain');
const { isConfigured: chainAnchorConfigured, describeChainPosture, anchorHash } = require('./lib/publicChainAnchor');

const { requireActor } = require('./lib/shieldAuth.cjs');

const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

// -- Trusted-service allowlist ------------------------------------------
//
// VACA is the gate other apps trust. VOKEN's value algorithm consumes
// the authenticity grades submitted here, so an outsider able to flood
// the queue is an outsider shaping what VOKEN believes.
//
// `ROUTE_AUTHORIZATION_AUDIT.md` §3B: this app accepts writes from other
// apps with no end-user session to present, and until now accepted them
// from anyone. `serviceAuth` is the same mechanism V3 has used and
// proven -- per-service tokens, constant-time compare -- generalised
// out of V3 because it was never V3-specific.
//
// Reads are not gated; this stops unauthorized WRITES.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

const decisionLog = createDecisionLog({ app: 'vaca' });

const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8804;
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
let store = createVacaStore();
attachStore(app, {
  appKey: 'vaca',
  createDefault: createVacaStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'vaca', verificationStatuses: VERIFICATION_STATUSES, authenticityGrades: AUTHENTICITY_GRADES,
    // Real, live crypto-migration posture (QVAN_SECURITY_RESILIENCE_SCOPE.md
    // §2). VACA's identity signatures are the ecosystem's most
    // signature-dependent surface, so this is the one worth watching.
    crypto: describeCryptoPosture(),
  });
});

// audit-route-guards: open -- submitting a claim about yourself is self-service by design; the approve/reject decision is what carries vaca:verify
app.post('/api/verifications', (req, res) => {
  try {
    res.status(201).json(submitVerification(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The real reviewer queue, across every subject -- closes this
// project's own flagged "real reviewer/dashboard UI for working a
// verification queue" gap. Gated the same `vaca:verify` way as the
// approve/reject decision it feeds: a cross-subject list of who is
// awaiting verification is reviewer-facing, not self-service the way
// a single subject's own history is.
//
// **Must be declared before `GET /api/verifications/:id` below.**
// Express matches routes in declaration order, and `:id` is a bare
// param -- it was matching literal requests to `.../pending` too,
// which meant this route never ran at all. Caught live: a GET here
// returned the generic "no verification with id pending" 404 the
// id-lookup route produces for a non-numeric id, not the queue.
app.get('/api/verifications/pending', requireOperator('vaca:verify'), (_req, res) => {
  res.json({ verifications: listPendingVerifications(store) });
});

app.get('/api/verifications/:id', (req, res) => {
  const verification = getVerification(store, Number(req.params.id));
  if (!verification) return res.status(404).json({ error: `no verification with id ${req.params.id}` });
  res.json(verification);
});

app.get('/api/verifications/subject/:subjectType/:subjectId', (req, res) => {
  res.json({ verifications: listVerificationsForSubject(store, req.params.subjectType, req.params.subjectId) });
});

// **The reviewer must be the session.** `reviewedBy` was already a body
// field, and it was already the record of who made the call — but
// nothing checked it, so an unauthenticated POST could approve any
// claim under any reviewer's name. Verified: a self-approved grade 'A'
// came straight back out of /api/authenticity-grade.
//
// That matters because VOKEN's value algorithm consumes this grade, and
// VACA exists precisely because that endpoint used to trust whatever
// the caller claimed. An unguarded approve put the trust right back
// where VACA was built to remove it.
//
// requireActor on `reviewedBy` is the natural fit: the field naming the
// decision-maker becomes the field the session must match.
app.post('/api/verifications/:id/approve', requireOperator('vaca:verify'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/verifications/:id/approve',
      outcomeKind: 'credential',
      subjectType: 'verification',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  try {
    res.json(approveVerification(store, { ...req.body, verificationId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/verifications/:id/reject', requireOperator('vaca:verify'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/verifications/:id/reject',
      outcomeKind: 'enforcement',
      subjectType: 'verification',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  try {
    res.json(rejectVerification(store, { ...req.body, verificationId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/authenticity-grade/:subjectType/:subjectId', (req, res) => {
  res.json({
    subjectType: req.params.subjectType,
    subjectId: req.params.subjectId,
    grade: getAuthenticityGrade(store, req.params.subjectType, req.params.subjectId),
  });
});

app.get('/api/identity-status/:subjectType/:subjectId', (req, res) => {
  res.json({
    subjectType: req.params.subjectType,
    subjectId: req.params.subjectId,
    verified: isIdentityVerified(store, req.params.subjectType, req.params.subjectId),
  });
});

// -- The real local blockchain --------------------------------------
// See lib/blockchain.js's own header for what this honestly is (a
// real, cryptographically-linked chain of every verification
// decision) and is not (a distributed, multi-party network).

app.get('/api/chain', (_req, res) => {
  res.json({ chain: getChain(store), integrity: verifyChainIntegrity(store) });
});

app.get('/api/chain/block/:index', (req, res) => {
  const block = getBlock(store, Number(req.params.index));
  if (!block) return res.status(404).json({ error: `no block with index ${req.params.index}` });
  return res.json(block);
});

// -- Real public-blockchain anchoring --------------------------------
// See lib/publicChainAnchor.js's own header for why this is
// unconfigured by default and never fabricates a transaction.

app.get('/api/chain/posture', (_req, res) => {
  res.json(describeChainPosture());
});

// Spends real gas on every real call once configured -- operator-
// gated for that reason, and decision-logged the same way an
// approve/reject already is, since "post this hash publicly, for
// real money" is exactly the kind of outcome vaco-audit exists to
// record.
app.post('/api/verifications/:id/anchor-on-chain', requireOperator('vaca:verify'), async (req, res) => {
  const verification = getVerification(store, Number(req.params.id));
  if (!verification) return res.status(404).json({ error: `no verification with id ${req.params.id}` });
  if (!verification.blockHash) {
    return res.status(400).json({ error: `verification ${req.params.id} has not been decided yet -- nothing to anchor` });
  }
  try {
    await decisionLog.record({
      route: 'POST /api/verifications/:id/anchor-on-chain',
      outcomeKind: 'credential',
      subjectType: 'verification',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { blockHash: verification.blockHash },
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  try {
    const anchor = await anchorHash(verification.blockHash);
    verification.chainAnchor = anchor;
    res.status(201).json({ verification, anchor, chainConfigured: chainAnchorConfigured() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VACA listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
