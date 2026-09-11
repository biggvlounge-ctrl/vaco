// VACO OPERATOR -- the one place operator authority is issued and verified.
//
// Answers one question for the whole ecosystem: **may this person make
// this decision?** Shield answers "who is this?", V3 holds the money,
// vaco-audit records what was decided. This holds authority, and only
// authority.
//
// See dev-docs/OPERATOR_ROLES_SCOPE.md for the decisions behind the
// shape, and dev-docs/DECISION_AUDIT.md for where every use of it is
// recorded.
//
// Run:
//   npm install
//   VACO_OPERATOR_BOOTSTRAP=vop_... npm start
//
// Test:
//   curl http://localhost:8820/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createOperatorStore } = require('./lib/store');
const { attachStore } = require('./lib/storeBackend');
const {
  SCOPES, BOOTSTRAP_SCOPE, createOperator, getOperator, disableOperator,
  grantScope, revokeScope, scopesFor, verify, bootstrap, describeCoverage,
} = require('./lib/operators');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8820;
// -- The store, and which backend holds it ----------------------------
//
// `let`, not `const`: with DATABASE_URL set this service's store lives
// in Postgres, which cannot be built synchronously. `attachStore` mounts
// a gate ahead of the routes so no request runs before the store has
// loaded, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide.
//
// **The bootstrap moved in here, and for this service it matters more
// than most.** It ran at module level, which would now seed an operator
// into the empty placeholder -- the real store would come up with no
// operators at all, and every `operator:grant` route would refuse
// forever with no way to grant the first credential. An authority
// service that cannot be bootstrapped is bricked, quietly.
let store = createOperatorStore();
attachStore(app, {
  appKey: 'vaco-operator',
  createDefault: createOperatorStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => {
    store = loaded;
    // Runs once, from the environment, and grants `operator:grant` and
    // nothing else. Unset means no operators, which is the correct
    // starting state for an authority service.
    const seeded = bootstrap(store, process.env.VACO_OPERATOR_BOOTSTRAP || '');
    if (seeded) {
      console.log(`VACO OPERATOR: bootstrap operator "${seeded.name}" seeded with ${BOOTSTRAP_SCOPE} only`);
    }
  },
});

// Mounted above every route, per the rule VOID learned the hard way --
// a route added above this line would be unauthenticated.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

const decisionLog = createDecisionLog({ app: 'vaco-operator' });

// The seed. Runs once, from the environment, and grants `operator:grant`
// and nothing else. Unset means no operators, which is the correct
// starting state for an authority service.

// -- The guard this service applies to itself ---------------------------
//
// Granting authority is itself a decision with a loser, so these routes
// are gated the same way the routes they protect will be: an operator
// credential holding `operator:grant`. There is deliberately no service
// fallback (scope doc §3.6) -- a compromised service must not be able
// to mint operators.
//
// A factory returning the middleware, rather than the middleware
// itself. That is not style: `scripts/audit-route-guards.mjs` matches
// the ecosystem convention `require[A-Z]\w*(` , so a guard passed as a
// bare reference reads as *unguarded* in the audit -- these four routes
// showed as open while being the most sensitive in the service. A tool
// that cannot see a guard is a tool that will let the next one go
// missing.
function requireGrantAuthority() {
  return function grantAuthorityGuard(req, res, next) {
    const result = verify(store, {
      credential: req.headers['x-operator-credential'],
      scope: 'operator:grant',
    });
    if (!result.ok) {
      return res.status(result.reason.includes('not presented') ? 401 : 403)
        .json({ error: `operator:grant required -- ${result.reason}` });
    }
    req.operator = result;
    return next();
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vaco-operator',
    scopes: SCOPES,
    coverage: describeCoverage(store),
    serviceAuth: serviceAuth.describe(),
    decisionLog: decisionLog.describe(),
  });
});

// -- Verification -------------------------------------------------------
//
// The hot path: every guarded route in the ecosystem calls this. Left
// open to any verified service (the app-level serviceAuth above), and
// deliberately NOT gated on an operator scope -- an app asking "is this
// credential allowed to settle?" does not itself hold authority.
//
// A GET would put the credential in a URL, and URLs end up in access
// logs. POST keeps it in a body.
// audit-route-guards: open -- the hot path every guarded route calls; an app asking "may this credential act" does not itself hold authority
app.post('/api/verify', (req, res) => {
  const { credential, scope } = req.body || {};
  const result = verify(store, { credential, scope });
  // Always 200: this reports a verdict, it is not itself refused. The
  // caller turns `ok: false` into its own 401/403 with its own message.
  res.json(result);
});

// -- Operators ----------------------------------------------------------

app.post('/api/operators', requireGrantAuthority(), async (req, res) => {
  try {
    const { operator, credential } = createOperator(store, {
      name: (req.body || {}).name,
      createdBy: String(req.operator.operatorId),
    });
    await decisionLog.record({
      route: 'POST /api/operators',
      outcomeKind: 'credential',
      subjectType: 'operator',
      subjectId: operator.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { name: operator.name },
      reason: (req.body || {}).reason || null,
    });
    // The credential is returned exactly once, here. It is not
    // recoverable afterwards -- only its digest is stored.
    //
    // The digest is stripped on the way out, matching GET
    // /api/operators/:id. It is not the credential, but handing it to a
    // caller lets them verify guesses offline against it, and there is
    // no reason anyone outside this service needs it.
    const { credentialDigest, ...safe } = operator;
    res.status(201).json({ operator: safe, credential });
  } catch (err) {
    res.status(err.name === 'DecisionNotRecordedError' ? 503 : 400).json({ error: err.message });
  }
});

app.get('/api/operators', (_req, res) => {
  res.json({
    operators: store.operators.map((o) => ({
      id: o.id,
      name: o.name,
      createdBy: o.createdBy,
      createdAt: o.createdAt,
      disabledAt: o.disabledAt,
      scopes: scopesFor(store, o.id),
    })),
  });
});

app.get('/api/operators/:id', (req, res) => {
  const operator = getOperator(store, Number(req.params.id));
  if (!operator) return res.status(404).json({ error: `no operator with id ${req.params.id}` });
  const { credentialDigest, ...safe } = operator;
  res.json({ ...safe, scopes: scopesFor(store, operator.id) });
});

app.post('/api/operators/:id/disable', requireGrantAuthority(), async (req, res) => {
  try {
    const operator = disableOperator(store, {
      operatorId: Number(req.params.id),
      actingOperatorId: req.operator.operatorId,
      disabledBy: String(req.operator.operatorId),
    });
    await decisionLog.record({
      route: 'POST /api/operators/:id/disable',
      outcomeKind: 'enforcement',
      subjectType: 'operator',
      subjectId: operator.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { name: operator.name },
      reason: (req.body || {}).reason || null,
    });
    res.json(operator);
  } catch (err) {
    res.status(err.name === 'DecisionNotRecordedError' ? 503 : 400).json({ error: err.message });
  }
});

// -- Grants -------------------------------------------------------------

app.post('/api/operators/:id/grants', requireGrantAuthority(), async (req, res) => {
  try {
    const grant = grantScope(store, {
      operatorId: Number(req.params.id),
      scope: (req.body || {}).scope,
      // From the verified credential, never from the body. A caller
      // that could name its own `grantedBy` could name someone else and
      // walk straight past the self-grant refusal.
      grantedBy: req.operator.operatorId,
    });
    await decisionLog.record({
      route: 'POST /api/operators/:id/grants',
      outcomeKind: 'credential',
      subjectType: 'operator',
      subjectId: grant.operatorId,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { scope: grant.scope },
      reason: (req.body || {}).reason || null,
    });
    res.status(201).json(grant);
  } catch (err) {
    res.status(err.name === 'DecisionNotRecordedError' ? 503 : 400).json({ error: err.message });
  }
});

app.post('/api/operators/:id/grants/revoke', requireGrantAuthority(), async (req, res) => {
  try {
    const grant = revokeScope(store, {
      operatorId: Number(req.params.id),
      scope: (req.body || {}).scope,
      revokedBy: req.operator.operatorId,
    });
    await decisionLog.record({
      route: 'POST /api/operators/:id/grants/revoke',
      outcomeKind: 'credential',
      subjectType: 'operator',
      subjectId: grant.operatorId,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { scope: grant.scope, revoked: true },
      reason: (req.body || {}).reason || null,
    });
    res.json(grant);
  } catch (err) {
    res.status(err.name === 'DecisionNotRecordedError' ? 503 : 400).json({ error: err.message });
  }
});

// The audit question, first-class: "who could do this, and who gave it
// to them?" Includes revoked grants, because "who could settle events
// last March" is exactly what this has to answer.
app.get('/api/scopes/:scope/holders', (req, res) => {
  res.json({
    scope: req.params.scope,
    known: SCOPES.includes(req.params.scope),
    holders: store.grants
      .filter((g) => g.scope === req.params.scope)
      .map((g) => ({
        ...g,
        operatorName: (getOperator(store, g.operatorId) || {}).name || null,
      })),
  });
});

app.get('/api/coverage', (_req, res) => {
  res.json(describeCoverage(store));
});

app.listen(PORT, () => {
  console.log(`VACO OPERATOR listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
