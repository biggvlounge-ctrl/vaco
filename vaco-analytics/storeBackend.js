// VACO Analytics — one call that gives this app a store, whichever
// backend is holding it.
//
// **An ESM port of `shared/storeBackend.js`, not a new design.** That
// module lets a CommonJS app convert to Postgres by changing the two
// lines that build its store, with a gate in front of the routes that
// holds each request until the store has loaded rather than rewriting
// `listen`. This is that same shape for an ESM app. See its own header
// for the full rationale.
//
// `persistencePg.js` is required lazily (dynamic `import()`), the same
// reason the CommonJS original requires it lazily: an app running on
// its JSON file must not need `pg` installed or connectable, which
// matters while a DATABASE_URL-less deploy (or a dev box with no
// Postgres at all) still has to boot.

import path from 'node:path';
import { createPersistentStore, durable as durableFile } from './persistence.js';

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Give `app` a store, and tell the caller which one it got.
 *
 * @param {object}   app           the Express app
 * @param {object}   opts
 * @param {string}   opts.appKey        this app's name, e.g. 'vaco-analytics'
 * @param {function} opts.createDefault returns a fresh empty store
 * @param {string}   opts.filePath      where the JSON file lives
 * @param {function} opts.onReady       called with the real store once loaded
 * @returns {Promise} resolves with the store; rejects if it cannot load
 */
export function attachStore(app, { appKey, createDefault, filePath, onReady }) {
  if (!appKey) throw new Error('attachStore requires an appKey');
  if (typeof createDefault !== 'function') throw new Error('attachStore requires a createDefault function');
  if (!filePath) throw new Error('attachStore requires a filePath');
  if (typeof onReady !== 'function') throw new Error('attachStore requires an onReady callback');

  const databaseUrl = process.env.DATABASE_URL;
  let commitBeforeResponding = (req, res, next) => next();

  // Mounted before anything awaits, so the middleware order is fixed at
  // import time and does not depend on how fast the store loads.
  let ready;
  app.use((req, res, next) => {
    // `.then(next, next)` deliberately: a rejected load passes the
    // error to Express rather than leaving the request hanging
    // forever. In practice the process has already exited by then.
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
    // reachable, which matters while only some apps are converted.
    const { default: pg } = await import('pg');
    const { Pool } = pg;
    const { createPersistentStorePg, durable: durablePg } = await import('./persistencePg.js');

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
