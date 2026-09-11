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
const { attachStore } = require('./lib/storeBackend');
const { STARTING_VCOIN_BALANCE } = require('./lib/vcoin');
const { VCOIN_TO_VASH_RATE } = require('./lib/vash');
const { createLedger } = require('./lib/ledger');
const { requireActor, actorOrService: actorOrServiceWith, requireCallingService } = require('./lib/shieldAuth.cjs');

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
// `let`, not `const`: with DATABASE_URL set V3's ledger lives in
// Postgres, which cannot be built synchronously. `attachStore` mounts a
// gate ahead of the routes so no request runs against an unloaded
// store, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide.
//
// That gate matters more here than anywhere else: a ledger answering
// `/api/vcoin/balance` from an empty store reports everyone's money as
// zero, and would then accept transfers against it.
//
// Without DATABASE_URL nothing changes: the same JSON file, in the same
// place, with the same guarantees.
let store = createV3Store();

// -- The ledger ---------------------------------------------------------
//
// Balances, transfers, settlements, cashouts and idempotency keys, from
// whichever backend this deployment is configured for: rows in Postgres
// when DATABASE_URL is set, the in-memory store otherwise. The routes
// below call `ledger.transfer(...)` either way and never branch — eight
// `if (usingPostgres)` blocks in the money app would be eight places for
// the two paths to drift, and drift in a ledger is not cosmetic.
//
// **`idempotentFor` exists because middleware is mounted at require
// time and the ledger is not ready until later.** Mounting
// `ledger.idempotent(name)` directly would read `ledger` while it is
// still null. This defers the lookup to the request, which
// `attachStore`'s gate guarantees happens after boot.
let ledger = null;
let ledgerReady = null;

// **A second gate, because `attachStore`'s covers the store and the
// ledger is built after it.** Without this a request arriving in the
// window between the store loading and the ledger being constructed
// would find `ledger` null and crash the handler. The window is small
// and it is exactly the kind that only opens under load, on the first
// requests after a restart.
app.use((req, res, next) => {
  if (ledger) return next();
  return ledgerReady.then(() => next(), next);
});

const idempotentFor = (routeName) => {
  let mounted = null;
  return (req, res, next) => {
    if (!mounted) mounted = ledger.idempotent(routeName);
    return mounted(req, res, next);
  };
};

ledgerReady = attachStore(app, {
  appKey: 'v3',
  createDefault: createV3Store,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => {
    store = loaded;
    // **Must be set here, not at module level.** `app.set` copies the
    // value, unlike the route handlers which read the `store` binding
    // when a request arrives. Setting it beside the declaration would
    // hand the idempotency middleware the empty placeholder for the
    // life of the process — every replayed request would miss its
    // record and execute a second time, which on a transfer route means
    // moving the money twice.
    app.set('v3Store', loaded);
  },
})
  // The ledger is built from the same DATABASE_URL `attachStore` used,
  // so the two cannot disagree about which backend this process is on.
  // Chained onto the store's readiness rather than run beside it: the
  // document ledger reads `store`, and it must be the loaded one.
  .then(async () => {
    ledger = await createLedger({
      databaseUrl: process.env.DATABASE_URL,
      getStore: () => store,
    });
    console.log(`v3 ledger: ${ledger.kind === 'rows' ? 'Postgres rows' : 'in-memory document'}`);
  })
  .catch((err) => {
    console.error(`V3 could not build its ledger: ${err.message}`);
    console.error('Refusing to serve money routes against a ledger that never loaded.');
    process.exit(1);
  });

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

app.get('/api/health', async (_req, res, next) => {
  try {
    res.json({
      ok: true, service: 'v3', startingVcoinBalance: STARTING_VCOIN_BALANCE, vcoinToVashRate: VCOIN_TO_VASH_RATE,
    // Real, live crypto-migration posture (QVAN_SECURITY_RESILIENCE_SCOPE.md
    // §2) -- so "are we PQC-ready yet" is answerable against a running
    // deployment, not just by reading code.
      crypto: describeCryptoPosture(),
      idempotency: await ledger.describe(),
      serviceAuth: serviceAuth.describe(),
      ledger: ledger.kind,
    });
  } catch (err) { next(err); }
});

app.get('/api/vcoin/balance/:userId', async (req, res, next) => {
  try {
    res.json({ userId: req.params.userId, balance: await ledger.getBalance(req.params.userId) });
  } catch (err) { next(err); }
});

app.post('/api/vcoin/transfer', idempotentFor('vcoin/transfer'), actorOrService('fromUserId'), async (req, res) => {
  try {
    res.status(201).json(await ledger.transfer(req.body || {}));
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
app.post('/api/vcoin/settle', idempotentFor('vcoin/settle'), requireCallingService(), async (req, res) => {
  try {
    res.status(201).json(await ledger.settle(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vcoin/transactions/:userId', async (req, res, next) => {
  try {
    res.json({
      userId: req.params.userId,
      transactions: await ledger.getTransactionHistory(req.params.userId),
    });
  } catch (err) { next(err); }
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
app.get('/api/vcoin/reconciliation', async (_req, res, next) => {
  try {
    res.json(await ledger.reconcile());
  } catch (err) { next(err); }
});

app.post('/api/vash/cashout', idempotentFor('vash/cashout'), actorOrService('userId'), async (req, res) => {
  try {
    res.status(201).json(await ledger.cashout(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vash/balance/:userId', async (req, res, next) => {
  try {
    res.json({ userId: req.params.userId, vashBalance: await ledger.getVashBalance(req.params.userId) });
  } catch (err) { next(err); }
});

app.listen(PORT, () => {
  console.log(`V3 listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});

