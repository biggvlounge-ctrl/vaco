// The same store, kept in Postgres instead of a JSON file.
//
// **What this is for.** 33 of the 34 apps keep their state in a JSON
// file under their own directory. `persistence.js` makes that safe for
// one process — atomic temp-then-rename writes, commit-before-respond
// on money — and it cannot be made safe for two. Two containers of the
// same app are two divergent ledgers, silently, with no way to tell
// afterwards which one was right. That is the single thing standing
// between this repo and a deployment that can be restarted, moved,
// backed up centrally, or run behind anything but one pinned host.
//
// This module is the other half of the same interface, so an app
// converts by changing how its store is built and nothing else. The
// libs, the routes and the guards do not move.
//
// ---------------------------------------------------------------------
// THE COST, STATED UP FRONT: the interface stops being synchronous
//
// `persistence.js` is synchronous end to end — `writeFileSync`,
// `commit()` returns a boolean, and `durable()` calls it inside
// `res.json`. There is no synchronous Postgres client for Node and
// there is not going to be one. So:
//
//   * `createPersistentStore` becomes async and must be awaited before
//     `app.listen`. A store that has not loaded yet is an empty store,
//     and an empty ledger that answers requests is worse than one that
//     is not listening.
//   * `commit` returns a promise.
//   * `durable` delays the response until that promise settles, so the
//     guarantee it exists for — written before the caller is told it
//     happened — survives the change. A commit that fails sends 500
//     rather than a 2xx nobody wrote down.
//
// That async conversion is the real work in moving an app across, and
// it is why this is not a drop-in swap. It is one module rather than 33
// rewrites, which is the point, but it is not free.
//
// ---------------------------------------------------------------------
// WHAT THIS DOES AND DOES NOT BUY, because the difference matters
//
// **Does:** removes the filesystem from the durability story. The store
// survives a container with no volume, is backed up wherever Postgres
// is backed up, and can be inspected and restored by ordinary means.
//
// **Does:** makes divergence *loud*. The row carries a version, every
// write is conditional on the version it read, and a second writer gets
// a refused write instead of a silent overwrite. Today that is a 500
// naming the problem; before, it was two ledgers and no error at all.
//
// **Does NOT:** make an app horizontally scalable on its own. This
// stores the whole store as one JSONB document, so two instances still
// cannot both write — they will merely find out. Real multi-writer
// means decomposing a store into rows and letting Postgres arbitrate
// per balance and per transaction, which is a second, per-app job and a
// much larger one. V3 is where it will matter first.
//
// Anyone reading this to plan the remaining apps should take the
// document store as the step that removes the filesystem and makes
// conflicts visible, not as the step that makes the system scale.

const { reactive } = require('./persistence');

// One table for every app's store. The app_key is the app's own name,
// so the table reads as an inventory of what has been converted.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS vaco_stores (
  app_key    TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  version    BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// Per-store bookkeeping, kept off the store object so it never lands in
// the persisted JSON and never changes the shape apps construct.
const STATE = new WeakMap();

class StoreConflictError extends Error {
  constructor(appKey, expected) {
    super(
      `persistence: refusing to overwrite ${appKey} — another process has written to it `
      + `since this one loaded (expected version ${expected}). This process's copy is stale. `
      + 'The document store supports one writer; two containers of the same app need the '
      + 'store decomposed into rows first.',
    );
    this.name = 'StoreConflictError';
    this.appKey = appKey;
    this.expectedVersion = expected;
  }
}

async function ensureSchema(pool) {
  await pool.query(SCHEMA);
}

// Loads the row, or creates it from `createDefault()` on first boot.
//
// Shallow-merged over a fresh default, exactly as the file backend
// does: a store shape that grows a top-level field in a later version
// must not crash trying to load a row written before it existed.
async function loadOrCreate(pool, appKey, createDefault) {
  const fresh = createDefault();

  const found = await pool.query(
    'SELECT data, version FROM vaco_stores WHERE app_key = $1',
    [appKey],
  );
  if (found.rowCount > 0) {
    return { initial: { ...fresh, ...found.rows[0].data }, version: Number(found.rows[0].version) };
  }

  // ON CONFLICT DO NOTHING, then re-read: two processes booting at the
  // same instant must not have one of them fail on a duplicate key.
  await pool.query(
    'INSERT INTO vaco_stores (app_key, data, version) VALUES ($1, $2, 1) ON CONFLICT (app_key) DO NOTHING',
    [appKey, JSON.stringify(fresh)],
  );
  const created = await pool.query(
    'SELECT data, version FROM vaco_stores WHERE app_key = $1',
    [appKey],
  );
  return {
    initial: { ...fresh, ...created.rows[0].data },
    version: Number(created.rows[0].version),
  };
}

// The conditional write. `WHERE version = $3` is the whole safety
// property: if anybody else has written since this process read, no row
// matches and nothing is overwritten.
async function writeStore(pool, appKey, store, expectedVersion) {
  const result = await pool.query(
    `UPDATE vaco_stores
        SET data = $1, version = version + 1, updated_at = now()
      WHERE app_key = $2 AND version = $3
      RETURNING version`,
    [JSON.stringify(store), appKey, expectedVersion],
  );
  if (result.rowCount === 0) throw new StoreConflictError(appKey, expectedVersion);
  return Number(result.rows[0].version);
}

/**
 * Build a Postgres-backed store. **Await this before `app.listen`.**
 *
 * @param {object}   pool          a `pg` Pool
 * @param {string}   appKey        the app's name, e.g. 'v3'
 * @param {function} createDefault returns a fresh empty store
 */
async function createPersistentStorePg(pool, appKey, createDefault, { debounceMs = 200 } = {}) {
  await ensureSchema(pool);
  const { initial, version } = await loadOrCreate(pool, appKey, createDefault);

  const state = {
    pool,
    appKey,
    version,
    timer: null,
    // Writes are serialised through this chain. Two overlapping commits
    // would otherwise race on `state.version` and the second would
    // conflict against a version the first had already moved.
    queue: Promise.resolve(),
    lastError: null,
  };

  function enqueue(fn) {
    state.queue = state.queue.then(fn, fn);
    return state.queue;
  }

  async function write() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.version = await writeStore(state.pool, state.appKey, state.store, state.version);
    return true;
  }

  // Background flush for ordinary mutations, same debounce as the file
  // backend. A failure here has nobody to tell — the request it came
  // from is long gone — so it is recorded and re-raised by the next
  // `commit`, which does have a caller waiting.
  function scheduleSave() {
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      enqueue(write).catch((err) => { state.lastError = err; });
    }, debounceMs);
    if (typeof state.timer.unref === 'function') state.timer.unref();
  }

  const store = reactive(initial, scheduleSave);
  state.store = store;
  STATE.set(store, state);
  return store;
}

/**
 * Force this store to Postgres now. Returns a promise for `true`, or
 * `false` if the store has no Postgres persistence attached — the same
 * quiet no-op the file backend gives an in-memory test store.
 */
async function commit(store) {
  const state = STATE.get(store);
  if (!state) return false;

  // A background flush that failed has been waiting for someone to tell.
  if (state.lastError) {
    const err = state.lastError;
    state.lastError = null;
    throw err;
  }

  // Queued behind any write already in flight, and run whether that one
  // succeeded or failed -- a previous failure is that caller's problem,
  // not a reason to refuse this one. Passing the same function as both
  // handlers is what makes the chain continue rather than latch.
  const run = async () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.version = await writeStore(state.pool, state.appKey, state.store, state.version);
    return true;
  };

  state.queue = state.queue.then(run, run);
  return state.queue;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Express middleware: the response does not go out until the store is
 * in Postgres.
 *
 * The file backend could commit synchronously inside `res.json` and
 * return. This cannot, so it holds the body, awaits the write, and
 * sends afterwards. The externally visible guarantee is identical —
 * nothing is acknowledged that is not written — and the failure mode
 * is explicit: a commit that throws answers 500 instead of a 2xx that
 * nobody recorded.
 */
function durable(store) {
  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 200 || res.statusCode >= 300) return originalJson(body);

      commit(store).then(
        () => originalJson(body),
        (err) => {
          // The write did not happen, so the caller must not be told it
          // did. A conflict is 409 -- somebody else owns this store --
          // and anything else is a 500.
          res.status(err instanceof StoreConflictError ? 409 : 500);
          originalJson({ error: err.message });
        },
      );
      return res;
    };

    return next();
  };
}

module.exports = {
  createPersistentStorePg, commit, durable, ensureSchema, StoreConflictError, SCHEMA,
};
