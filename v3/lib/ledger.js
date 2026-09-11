// One ledger interface, two implementations underneath.
//
// V3's routes should not know or care whether balances live in rows or
// in a JSON document. Branching per route would mean eight `if
// (usingPostgres)` blocks in the money app, each one a place for the two
// paths to drift apart — and drift in a ledger is not a cosmetic bug.
//
// So: one object, built once at boot, whose methods are the operations
// the routes perform. Both implementations are async, including the
// in-memory one. That costs the file path a microtask per call and buys
// a single call shape everywhere, which is the right trade in the app
// where every route moves money.
//
// ---------------------------------------------------------------------
// WHICH ONE, AND WHY THE FILE PATH IS STILL HERE
//
// `DATABASE_URL` set     -> rows. Two containers can both write.
// `DATABASE_URL` unset   -> the in-memory store, exactly as before.
//
// The second is not a fallback kept out of politeness. Every one of
// V3's 85 existing tests drives the in-memory functions directly, local
// development runs without a database, and the Replit path has no
// Postgres unless somebody attaches one. Removing it would mean
// rewriting all of that at the same time as changing how money moves,
// which is two risky changes wearing one commit.

const vcoin = require('./vcoin');
const vash = require('./vash');
const rows = require('./ledgerPg');
const memoryIdempotency = require('./idempotency');
const rowIdempotency = require('./idempotencyPg');

/**
 * The in-memory ledger, wrapped so it answers the same shape as the row
 * one. Every method is async and every one is a thin pass-through —
 * there is no behaviour here, deliberately, because `lib/vcoin.js` and
 * `lib/vash.js` are what the existing tests assert against and this must
 * not become a second place where the rules live.
 */
function documentLedger(getStore) {
  return {
    kind: 'document',
    getBalance: async (userId) => vcoin.getBalance(getStore(), userId),
    getVashBalance: async (userId) => vash.getVashBalance(getStore(), userId),
    transfer: async (options) => vcoin.transfer(getStore(), options),
    settle: async (options) => vcoin.settle(getStore(), options),
    cashout: async (options) => vash.cashout(getStore(), options),
    getTransactionHistory: async (userId) => vcoin.getTransactionHistory(getStore(), userId),
    reconcile: async () => vcoin.reconcile(getStore()),
    // **`idempotent(routeName)`, not `idempotent(store, routeName)`.**
    // The in-memory middleware finds the store itself, via
    // `req.app.get('v3Store')` — unlike the row version, which is handed
    // a pool. Passing the store as the first argument made `routeName`
    // the store object, so every recorded key carried
    // `route: <the entire store>` and the next flush died on
    //
    //   Converting circular structure to JSON
    //     property 'idempotencyRecords' -> index 5 -> ...
    //
    // which surfaced as a 400 on the transfer that triggered it. The two
    // backends taking their dependency differently is exactly the kind
    // of seam an adapter is supposed to absorb, and it absorbed it
    // wrongly until this was checked against the signature.
    idempotent: (routeName) => memoryIdempotency.idempotent(routeName),
    describe: async () => memoryIdempotency.describeIdempotency(getStore()),
  };
}

/**
 * The row ledger. Balances are rows, a transfer is one SQL transaction,
 * and Postgres arbitrates between writers.
 */
function rowLedger(pool) {
  return {
    kind: 'rows',
    getBalance: (userId) => rows.getBalance(pool, userId),
    getVashBalance: (userId) => rows.getVashBalance(pool, userId),
    transfer: (options) => rows.transfer(pool, options),
    settle: (options) => rows.settle(pool, options),
    cashout: (options) => rows.cashout(pool, options),
    getTransactionHistory: (userId) => rows.getTransactionHistory(pool, userId),
    reconcile: () => rows.reconcile(pool),
    idempotent: (routeName) => rowIdempotency.idempotent(pool, routeName),
    describe: () => rowIdempotency.describeIdempotency(pool),
  };
}

/**
 * Build whichever one this deployment is configured for.
 *
 * `getStore` is a function rather than a store, because the document
 * store is installed asynchronously by `attachStore` and a value
 * captured here would be the empty placeholder — the same trap that
 * `app.set('v3Store', store)` fell into.
 */
async function createLedger({ databaseUrl, getStore }) {
  if (!databaseUrl) return documentLedger(getStore);

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  await rows.ensureSchema(pool);
  await rowIdempotency.ensureSchema(pool);
  return rowLedger(pool);
}

module.exports = { createLedger, documentLedger, rowLedger };
