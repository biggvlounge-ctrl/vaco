// V3 -- the ecosystem's canonical VCoin/VASH ledger.
// Real, standalone extraction out of `venvs-mock-backend`'s own real,
// already-running, already-relied-upon VCoin+VASH contract -- closing
// this ecosystem's own largest, most-flagged remaining gap ("V3 never
// getting its own standalone app; every app's env var default points
// at venvs-mock-backend"). See `lib/vcoin.js`/`lib/vash.js` for the
// full extraction rationale.
//
// Deliberately does NOT include Shield's own session/auth routes --
// V3 and Shield are two real, distinct ecosystem services (every
// source doc that mentions either names them separately: "Shield's
// session, V3's ledger"), combined into one mock process purely to
// keep an earlier session's scope manageable. This app is V3 only,
// matching exactly what was asked; Shield remains its own real,
// still-open gap, not silently folded in here.
//
// Every route below matches `venvs-mock-backend`'s own real contract
// exactly -- same paths, same request/response shapes -- so any app
// in this ecosystem can switch to this real service by changing its
// own `V3_API_URL` env var alone. No other app's code was changed as
// part of this build; see README.md's own "Switching an app over"
// section for how to do that per-app, deliberately left as a
// follow-up action rather than an ecosystem-wide flag day.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8811/api/health

const { describeCryptoPosture } = require('./lib/cryptoAgility');
const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createV3Store } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { STARTING_VCOIN_BALANCE, getBalance, transfer, settle, getTransactionHistory, reconcile } = require('./lib/vcoin');
const { VCOIN_TO_VASH_RATE, getVashBalance, cashout } = require('./lib/vash');
const { requireActor, actorOrService: actorOrServiceWith, requireCallingService } = require('./lib/shieldAuth.cjs');
const { idempotent, describeIdempotency } = require('./lib/idempotency');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8811;
// -- The store, and which backend holds it ----------------------------
//
// **`let`, not `const`, and the server does not listen until it is
// set.** V3 is the first app moved off a JSON file. With DATABASE_URL
// set the store lives in Postgres; without one it stays exactly where
// it was, byte for byte, so nothing about local development or the
// existing deployment changes until somebody sets the variable.
//
// The Postgres backend cannot be built synchronously -- there is no
// synchronous Postgres client for Node -- so `start()` below awaits it
// before `app.listen`. That ordering is the whole safety of it: a
// ledger that answers requests against an unloaded store would report
// every balance as zero and accept transfers against them.
//
// The route handlers close over this binding rather than a value, so
// they see whichever store `start()` installs. Nothing can reach them
// first: the server is not listening until it resolves.
let store = null;
let commitBeforeResponding = (req, res, next) => next();

// Mounted here, in the position `durable(store)` held, so it still runs
// ahead of every route. It delegates rather than deciding, because
// which backend is in play is not known until start() has run.
app.use((req, res, next) => commitBeforeResponding(req, res, next));

// Trusted-service allowlist. **Now defaults to 'enforce'.**
//
// It defaulted to 'observe' — allow unauthenticated writes, record who
// they came from — as a migration tool: wire the 18 integrations one at
// a time, then flip. That was a reasonable plan and the wiring is now
// done (every calling app sends X-Service-Name/X-Service-Token), so the
// migration default has outlived its purpose.
//
// Leaving it on 'observe' was not a mild default. Combined with the old
// `optionalOwnAccount` on the routes below — which called next() when
// no Authorization header was present — it meant this was a live,
// unauthenticated wallet drain:
//
//   curl -X POST /api/vcoin/transfer \
//     -d '{"fromUserId":"victim","toUserId":"attacker","amount":500}'
//
// Verified against a running instance. 500 VCoin moved.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// A mutating V3 route has two legitimate kinds of caller, and they
// authenticate differently:
//
//   a user, acting on their own money  -> Shield session matching the
//                                         request's own actor field
//   an internal service, settling      -> X-Service-Name + a matching
//                                         X-Service-Token
//
// Most of V3's real transfer volume is the second kind: pack-opening
// charges, referral bonuses, VEX settlement — there is no end-user
// session to present. Requiring a session everywhere would 401 every
// one of those. Requiring *nothing* is what produced the bug above.
//
// `req.callingService` is set by serviceAuth.middleware only after a
// constant-time token match, so this checks a verified fact rather
// than a header the caller chose.
// Lifted into shared/shieldAuth.js once a second app needed the exact
// same shape (VSAFE: a person opening the app, or CVNVO acting on their
// behalf). Kept as a one-line wrapper here so V3's call sites still read
// `actorOrService('fromUserId')` rather than nesting two helpers.
const actorOrService = (field) => actorOrServiceWith(requireActor(field));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'v3', startingVcoinBalance: STARTING_VCOIN_BALANCE, vcoinToVashRate: VCOIN_TO_VASH_RATE,
    // Real, live crypto-migration posture (QVAN_SECURITY_RESILIENCE_SCOPE.md
    // §2) -- so "are we PQC-ready yet" is answerable against a running
    // deployment, not just by reading code.
    crypto: describeCryptoPosture(),
    idempotency: describeIdempotency(store),
    serviceAuth: serviceAuth.describe(),
  });
});

app.get('/api/vcoin/balance/:userId', (req, res) => {
  res.json({ userId: req.params.userId, balance: getBalance(store, req.params.userId) });
});

// Exposed so the idempotency middleware can reach the same real store
// the handlers use, without re-importing or duplicating it.
app.set('v3Store', store);

app.post('/api/vcoin/transfer', idempotent('vcoin/transfer'), actorOrService('fromUserId'), (req, res) => {
  try {
    res.status(201).json(transfer(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Atomic multi-leg settlement: every leg moves, or none does.
//
// **Why this is `requireCallingService` and not `actorOrService`.** The
// transfer route matches the session against `fromUserId` in the body,
// and a settlement has no single such field — the payer sits inside
// each leg, and a settlement legitimately debits one person to pay two
// different parties. More to the point, deciding a platform's own fee
// split is not something an end user does on their own behalf: every
// real caller is a backend settling a job it just completed. Accepting
// a browser session here would let a user compose their own fee split
// and post it.
//
// So it requires a service credential specifically, the same shape as
// the operational routes in vaco-analytics. `serviceAuth.middleware` is
// mounted app-wide and proves *some* credential exists; this says which
// kind this route needs, which is the distinction that let an
// `audit-route-guards: open` marker sit on a route that wrote rows.
app.post('/api/vcoin/settle', idempotent('vcoin/settle'), requireCallingService(), (req, res) => {
  try {
    res.status(201).json(settle(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vcoin/transactions/:userId', (req, res) => {
  res.json({ userId: req.params.userId, transactions: getTransactionHistory(store, req.params.userId) });
});

// Whole-ledger audit: does the transaction history explain every
// balance? A banking or BaaS partner asks this first, and until the
// cashout gap was closed the honest answer was no.
//
// `serviceAuth.middleware` is already mounted app-wide above, so in
// enforce mode this route -- like every other -- needs a valid
// X-Service-Name/X-Service-Token pair. No second per-route guard: it is
// a read, and adding `serviceAuth` here as if it were middleware is a
// crash, because it is an object with a `.middleware` property.
app.get('/api/vcoin/reconciliation', (_req, res) => {
  res.json(reconcile(store));
});

app.post('/api/vash/cashout', idempotent('vash/cashout'), actorOrService('userId'), (req, res) => {
  try {
    res.status(201).json(cashout(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vash/balance/:userId', (req, res) => {
  res.json({ userId: req.params.userId, vashBalance: getVashBalance(store, req.params.userId) });
});

// -- Boot -------------------------------------------------------------
//
// Two backends, one store shape. The choice is made by whether
// DATABASE_URL is set and by nothing else -- no flag, no mode, no
// default that silently picks the wrong one.
//
// **A Postgres backend that cannot reach its database refuses to
// start.** That is deliberate and it is the opposite of what VACON-C
// does, for a reason worth stating: VACON-C is a simulation whose
// working set is regenerable, so an empty world that says so is a
// working demo. This is the ledger. An empty ledger that answers
// `/api/vcoin/balance` reports everyone's money as zero, and accepting
// a transfer against that is worse than being unreachable.
async function start() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const { Pool } = require('pg');
    const { createPersistentStorePg, durable: durablePg } = require('./lib/persistencePg');

    const pool = new Pool({ connectionString: databaseUrl });
    store = await createPersistentStorePg(pool, 'v3', createV3Store);
    commitBeforeResponding = durablePg(store);

    const closePool = () => pool.end().finally(() => process.exit(0));
    process.on('SIGTERM', closePool);
    process.on('SIGINT', closePool);

    console.log('V3 store: Postgres (DATABASE_URL is set)');
  } else {
    store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createV3Store);
    commitBeforeResponding = durable(store);
    console.log('V3 store: data/store.json (no DATABASE_URL) — safe for one process only');
  }

  app.listen(PORT, () => {
    console.log(`V3 listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
}

start().catch((err) => {
  // Nothing half-started: no store, no listener, and a message naming
  // the cause rather than a stack against an empty ledger later.
  console.error(`V3 failed to start: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
