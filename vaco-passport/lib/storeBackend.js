// One call that gives an app a store, whichever backend is holding it.
//
// **Why this exists rather than 27 hand-written boot sequences.**
//
// Moving an app off its JSON file means its store must be awaited, and
// the obvious way to do that is to wrap the tail of `server.js` in an
// async `start()`. That works — V3 was converted exactly so — and it
// does not generalise: the 27 remaining servers end in a `listen` block
// that is *not* uniform. VACAY prints an extra line, VOKEN's is already
// nested inside another block, CVNVO listens on an `http.Server` rather
// than the app, and HVNTZ differs again. A codemod rewriting all of
// them would be 27 chances to silently break the boot of an app whose
// tests do not cover `server.js` at all.
//
// So this does not touch `listen`. The server starts listening exactly
// when it always did, and a **gate** in front of the routes holds each
// request until the store has loaded. At boot that is a few
// milliseconds on the first request or two; afterwards the promise is
// already settled and the gate is a resolved-promise hop.
//
// The per-app diff is then the two lines that built the store, and
// nothing else moves.
//
// ---------------------------------------------------------------------
// What it mounts, in order
//
//   1. the gate         -- no route runs against an unloaded store
//   2. the durable hook -- commit before the response goes out
//
// Both are mounted where `app.use(durable(store))` used to sit, so they
// still run ahead of every route.
//
// ---------------------------------------------------------------------
// Failure
//
// A file-backed store cannot really fail to load; a Postgres-backed one
// can, and an app whose store never loaded must not serve. It exits
// rather than answering every read with an empty store — the ledger
// case makes the reason obvious (an empty V3 reports everyone's balance
// as zero and will accept transfers against it) and it is the right
// answer for every other app too, just less dramatically.

const path = require('path');
const { createPersistentStore, durable: durableFile } = require('./persistence');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Give `app` a store, and tell the caller which one it got.
 *
 * @param {object}   app           the Express app
 * @param {object}   opts
 * @param {string}   opts.appKey        this app's name, e.g. 'shield'
 * @param {function} opts.createDefault returns a fresh empty store
 * @param {string}   opts.filePath      where the JSON file lives
 * @param {function} opts.onReady       called with the real store once loaded
 * @returns {Promise} resolves with the store; rejects if it cannot load
 */
function attachStore(app, { appKey, createDefault, filePath, onReady }) {
  if (!appKey) throw new Error('attachStore requires an appKey');
  if (typeof createDefault !== 'function') throw new Error('attachStore requires a createDefault function');
  if (!filePath) throw new Error('attachStore requires a filePath');
  if (typeof onReady !== 'function') throw new Error('attachStore requires an onReady callback');

  const databaseUrl = process.env.DATABASE_URL;
  let commitBeforeResponding = (req, res, next) => next();

  // Mounted before anything awaits, so the middleware order is fixed at
  // require time and does not depend on how fast the store loads.
  let ready;
  app.use((req, res, next) => {
    // `.then(next, next)` deliberately: a rejected load passes the error
    // to Express rather than leaving the request hanging forever. In
    // practice the process has already exited by then.
    ready.then(() => next(), next);
  });
  app.use((req, res, next) => commitBeforeResponding(req, res, next));

  ready = (async () => {
    if (!databaseUrl) {
      const store = createPersistentStore(filePath, createDefault);
      commitBeforeResponding = durableFile(store);
      onReady(store);
      console.log(`${appKey} store: ${path.basename(filePath)} (no DATABASE_URL) — safe for one process only`);
      return store;
    }

    // Required lazily: an app running on files must not need `pg`
    // installed, which matters while only some apps are converted.
    const { Pool } = require('pg');
    const { createPersistentStorePg, durable: durablePg } = require('./persistencePg');

    const pool = new Pool({ connectionString: databaseUrl });
    const store = await createPersistentStorePg(pool, appKey, createDefault);
    commitBeforeResponding = durablePg(store);
    onReady(store);

    const close = () => pool.end().finally(() => process.exit(0));
    process.on('SIGTERM', close);
    process.on('SIGINT', close);

    console.log(`${appKey} store: Postgres (DATABASE_URL is set)`);
    return store;
  })();

  ready.catch((err) => {
    console.error(`${appKey} failed to load its store: ${err.message}`);
    console.error('Refusing to serve requests against a store that never loaded.');
    process.exit(1);
  });

  return ready;
}

module.exports = { attachStore, MUTATING_METHODS };
