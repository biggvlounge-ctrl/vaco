// VACO — the shell's store, kept in Postgres instead of a JSON file.
//
// **An ESM port of `shared/persistencePg.js`, not a new design.** That
// module is the ecosystem's Postgres store backend and 28 apps run on
// it; the only reason this copy exists is that they are CommonJS and
// `vaco-shell` is `"type": "module"`. Behaviour is deliberately
// identical — same `vaco.stores` table, same version-conditional write
// that turns two concurrent writers into a loud 409 instead of a
// silent overwrite, same debounced background flush and the same
// commit-before-responding guarantee `durable()` gives. If that file
// changes, this one should change with it. See its own header for the
// full rationale (why Postgres, what it does and does not buy, and the
// cost of going from a synchronous interface to an async one).
//
// Reuses `reactive` from this app's own `persistence.js` ESM port
// rather than a third copy of the same function.

import { reactive } from './persistence.js';

// Same schema as the shared backend, in its own `vaco` schema rather
// than `public` for the exact reason `shared/persistencePg.js`
// documents: VACON-C treats a non-empty `public` schema as a sign
// something foreign landed in its database, and a shared `vaco.stores`
// table must not trip that guard.
const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS vaco;
CREATE TABLE IF NOT EXISTS vaco.stores (
  app_key    TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  version    BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// Per-store bookkeeping, kept off the store object so it never lands in
// the persisted JSON and never changes the shape the app constructs.
const STATE = new WeakMap();

export class StoreConflictError extends Error {
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

export async function ensureSchema(pool) {
  await pool.query(SCHEMA);
}

// Loads the row, or creates it from `createDefault()` on first boot.
// Shallow-merged over a fresh default, exactly as the file backend
// does: a store shape that grows a top-level field in a later version
// must not crash trying to load a row written before it existed.
async function loadOrCreate(pool, appKey, createDefault) {
  const fresh = createDefault();

  const found = await pool.query(
    'SELECT data, version FROM vaco.stores WHERE app_key = $1',
    [appKey],
  );
  if (found.rowCount > 0) {
    return { initial: { ...fresh, ...found.rows[0].data }, version: Number(found.rows[0].version) };
  }

  // ON CONFLICT DO NOTHING, then re-read: two processes booting at the
  // same instant must not have one of them fail on a duplicate key.
  await pool.query(
    'INSERT INTO vaco.stores (app_key, data, version) VALUES ($1, $2, 1) ON CONFLICT (app_key) DO NOTHING',
    [appKey, JSON.stringify(fresh)],
  );
  const created = await pool.query(
    'SELECT data, version FROM vaco.stores WHERE app_key = $1',
    [appKey],
  );
  return {
    initial: { ...fresh, ...created.rows[0].data },
    version: Number(created.rows[0].version),
  };
}

// The conditional write. `WHERE version = $3` is the whole safety
// property: if anybody else has written since this process read, no
// row matches and nothing is overwritten.
async function writeStore(pool, appKey, store, expectedVersion) {
  const result = await pool.query(
    `UPDATE vaco.stores
        SET data = $1, version = version + 1, updated_at = now()
      WHERE app_key = $2 AND version = $3
      RETURNING version`,
    [JSON.stringify(store), appKey, expectedVersion],
  );
  if (result.rowCount === 0) throw new StoreConflictError(appKey, expectedVersion);
  return Number(result.rows[0].version);
}

// Build a Postgres-backed store. **Await this before `app.listen`.**
export async function createPersistentStorePg(pool, appKey, createDefault, { debounceMs = 200 } = {}) {
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

// Force this store to Postgres now. Returns a promise for `true`, or
// `false` if the store has no Postgres persistence attached — the same
// quiet no-op the file backend gives an in-memory test store.
export async function commit(store) {
  const state = STATE.get(store);
  if (!state) return false;

  // A background flush that failed has been waiting for someone to tell.
  if (state.lastError) {
    const err = state.lastError;
    state.lastError = null;
    throw err;
  }

  // Queued behind any write already in flight, and run whether that one
  // succeeded or failed — a previous failure is that caller's problem,
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

// Express middleware: the response does not go out until the store is
// in Postgres. The file backend could commit synchronously inside
// `res.json` and return; this cannot, so it holds the body, awaits the
// write, and sends afterwards. The externally visible guarantee is
// identical — nothing is acknowledged that is not written.
export function durable(store) {
  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 200 || res.statusCode >= 300) return originalJson(body);

      commit(store).then(
        () => originalJson(body),
        (err) => {
          // The write did not happen, so the caller must not be told it
          // did. A conflict is 409 — somebody else owns this store —
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
