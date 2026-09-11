// The Postgres store backend.
//
// **Run against a real Postgres, never a fake.** The property this
// module exists for -- a second writer is refused rather than allowed
// to overwrite -- lives entirely in `UPDATE ... WHERE version = $3`.
// A stub would be a test of the stub. Skips cleanly when no database is
// reachable, and says so, rather than passing on nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

const URL_ = process.env.DATABASE_URL
  || 'postgres://vacancy:vacancy_dev@localhost:5432/vacancy';

// `pg` lives in vacon-c, the only app that had a database until now.
let Pool;
try {
  ({ Pool } = require(path.join(REPO_ROOT, 'vacon-c', 'node_modules', 'pg')));
} catch {
  Pool = null;
}

const pg = require(path.join(REPO_ROOT, 'shared', 'persistencePg.js'));

let pool = null;
let SKIP = false;
if (!Pool) {
  SKIP = 'the pg package is not installed — run ./install-ecosystem.sh';
} else {
  pool = new Pool({ connectionString: URL_, max: 4 });
  try {
    await pool.query('SELECT 1');
    await pg.ensureSchema(pool);
  } catch (err) {
    SKIP = `no Postgres at ${URL_.replace(/:[^:@]*@/, ':***@')} (${err.message})`;
    await pool.end().catch(() => {});
    pool = null;
  }
}

let keySeq = 0;
const freshKey = () => `test-store-${process.pid}-${Date.now()}-${keySeq += 1}`;
const emptyStore = () => ({ items: [], counters: {}, nextId: 1 });

async function drop(appKey) {
  if (pool) await pool.query('DELETE FROM vaco_stores WHERE app_key = $1', [appKey]);
}

test('a first boot creates the row and returns an empty store', { skip: SKIP }, async () => {
  const key = freshKey();
  try {
    const store = await pg.createPersistentStorePg(pool, key, emptyStore);
    assert.deepEqual(store.items, []);
    assert.equal(store.nextId, 1);

    const row = await pool.query('SELECT version FROM vaco_stores WHERE app_key = $1', [key]);
    assert.equal(row.rowCount, 1, 'first boot did not create a row');
    assert.equal(Number(row.rows[0].version), 1);
  } finally { await drop(key); }
});

test('a mutation reaches Postgres once committed, and comes back on reload', { skip: SKIP }, async () => {
  const key = freshKey();
  try {
    const store = await pg.createPersistentStorePg(pool, key, emptyStore);
    store.items.push({ id: 1, name: 'a real row' });
    store.counters.seen = 7;
    await pg.commit(store);

    // A second process, loading the same key from scratch.
    const reloaded = await pg.createPersistentStorePg(pool, key, emptyStore);
    assert.deepEqual(reloaded.items, [{ id: 1, name: 'a real row' }]);
    assert.equal(reloaded.counters.seen, 7);
  } finally { await drop(key); }
});

test('a store shape that grew a new field still loads an older row', { skip: SKIP }, async () => {
  // The same shallow-merge the file backend does. Without it, adding a
  // top-level collection makes every existing row unloadable.
  const key = freshKey();
  try {
    const store = await pg.createPersistentStorePg(pool, key, emptyStore);
    store.items.push({ id: 1 });
    await pg.commit(store);

    const widened = () => ({ items: [], counters: {}, nextId: 1, addedLater: [] });
    const reloaded = await pg.createPersistentStorePg(pool, key, widened);
    assert.deepEqual(reloaded.items, [{ id: 1 }], 'the old data did not survive');
    assert.deepEqual(reloaded.addedLater, [], 'the new field was not defaulted');
  } finally { await drop(key); }
});

// -- The reason this module exists ---------------------------------------

test('a second writer is refused, not allowed to overwrite', { skip: SKIP }, async () => {
  // Two processes, both loaded at version 1. This is precisely the case
  // the file backend cannot see: there, both would write and the last
  // one would win silently, leaving two histories and no error.
  const key = freshKey();
  try {
    const a = await pg.createPersistentStorePg(pool, key, emptyStore);
    const b = await pg.createPersistentStorePg(pool, key, emptyStore);

    a.items.push({ id: 1, from: 'process A' });
    await pg.commit(a);

    b.items.push({ id: 2, from: 'process B' });
    await assert.rejects(
      () => pg.commit(b),
      (err) => err instanceof pg.StoreConflictError,
      'the stale writer was allowed to overwrite — this is the divergence the file backend cannot detect',
    );

    // A's write is intact, B's is not half-applied.
    const row = await pool.query('SELECT data FROM vaco_stores WHERE app_key = $1', [key]);
    assert.deepEqual(row.rows[0].data.items, [{ id: 1, from: 'process A' }]);
  } finally { await drop(key); }
});

test('the winning writer can keep writing afterwards', { skip: SKIP }, async () => {
  // A conflict must not poison the store that was right.
  const key = freshKey();
  try {
    const a = await pg.createPersistentStorePg(pool, key, emptyStore);
    const b = await pg.createPersistentStorePg(pool, key, emptyStore);

    a.items.push({ id: 1 });
    await pg.commit(a);
    b.items.push({ id: 2 });
    await pg.commit(b).catch(() => {});

    a.items.push({ id: 3 });
    await pg.commit(a);

    const row = await pool.query('SELECT data, version FROM vaco_stores WHERE app_key = $1', [key]);
    assert.deepEqual(row.rows[0].data.items.map((i) => i.id), [1, 3]);
    assert.equal(Number(row.rows[0].version), 3, 'version should advance once per successful write');
  } finally { await drop(key); }
});

test('overlapping commits do not race each other into a false conflict', { skip: SKIP }, async () => {
  // Two commits issued without awaiting the first. They share a store
  // and a version, so without serialisation the second would be sent
  // with a version the first had already consumed.
  const key = freshKey();
  try {
    const store = await pg.createPersistentStorePg(pool, key, emptyStore);
    store.items.push({ id: 1 });
    const first = pg.commit(store);
    store.items.push({ id: 2 });
    const second = pg.commit(store);

    await assert.doesNotReject(Promise.all([first, second]),
      'concurrent commits on one store conflicted with themselves');

    const row = await pool.query('SELECT data FROM vaco_stores WHERE app_key = $1', [key]);
    assert.deepEqual(row.rows[0].data.items.map((i) => i.id), [1, 2]);
  } finally { await drop(key); }
});

test('commit on a store with no persistence is a quiet no-op', { skip: SKIP }, async () => {
  // Apps build plain in-memory stores in tests; a commit there must not
  // throw. Same contract as the file backend.
  assert.equal(await pg.commit({ items: [] }), false);
});

test.after(async () => { if (pool) await pool.end(); });
