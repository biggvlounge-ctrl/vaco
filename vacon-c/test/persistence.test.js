// VACANCY — boot load and checkpoint.
//
// `restore.test.js` proves a world round-trips. This proves the server
// actually does it: loads before it listens, checkpoints as it ticks,
// and — the sharp one — never overwrites a good archive with an empty
// world after a failed load.
//
// Needs a real Postgres; skips loudly without one, same as
// restore.test.js.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
let db;   // required lazily — see the note in test.before
let persistence;

let available = false;
let reason = '';

// Swallow the module's own console output so a test run is not full of
// deliberate error messages, while still capturing them to assert on —
// the messages are half of what these tests check.
function capture() {
  const lines = [];
  return { log: (...a) => lines.push(a.join(' ')), error: (...a) => lines.push(a.join(' ')), lines };
}

async function truncate() {
  const t = await db.query(
    "SELECT string_agg(tablename, ', ') AS t FROM pg_tables WHERE schemaname='public'");
  await db.query(`TRUNCATE ${t.rows[0].t} CASCADE`);
}

function freshWorld() {
  const W = engine.WorldState;
  for (const k of Object.keys(W)) if (Array.isArray(W[k])) W[k] = [];
  W.tick = 0;
  W.nextEntityId = 1;
  persistence.reset();
  return W;
}

// **A Postgres advisory lock, held for the whole file.**
//
// `node --test` runs test FILES concurrently, and every database-backed
// file here truncates and rewrites the same database. Run together they
// destroy each other's fixtures: the symptom was a round-trip that
// restored 0 of everything while passing perfectly on its own.
//
// Isolating by database or schema would be the heavier fix. These are
// integration tests against one shared resource and the honest thing is
// to serialise them, which an advisory lock does without depending on
// how the runner happens to be invoked. The key is arbitrary and shared
// by every file that takes it.
const DB_LOCK_KEY = 8809_0910;
let lockClient = null;

async function takeDbLock() {
  lockClient = await db.pool.connect();
  await lockClient.query('SELECT pg_advisory_lock($1)', [DB_LOCK_KEY]);
}

async function releaseDbLock() {
  if (!lockClient) return;
  await lockClient.query('SELECT pg_advisory_unlock($1)', [DB_LOCK_KEY]);
  lockClient.release();
  lockClient = null;
}

test.before(async () => {
  try {
    // **Required here, not at the top of the file.** `server/db.js`
    // pulls in `pg` at module load, and a release-archive extract is
    // source only — no node_modules anywhere. A top-level require
    // therefore threw "Cannot find module 'pg'" before a single test
    // ran, and the whole file FAILED rather than skipping.
    //
    // A missing driver is the same class of thing as a missing
    // database: this environment cannot run these checks. It should say
    // so and skip, exactly as it does when Postgres is unreachable.
    // Found by `scripts/package-release.mjs`, which runs the suite
    // inside the extracted archive rather than the working tree.
    db = require('../server/db.js');
    persistence = require('../server/persistence.js');

    await takeDbLock();
    const t = await db.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
    if (t.rows[0].n < 50) {
      reason = `connected, but only ${t.rows[0].n} tables — load the schema first`;
      return;
    }
    available = true;
  } catch (err) {
    reason = /Cannot find module/.test(err.message)
      ? `the pg driver is not installed here (${err.message}) — run npm install in vacon-c/`
      : `no Postgres at ${process.env.DATABASE_URL || 'the default local URL'}: ${err.message}`;
  }
});

test.after(async () => {
  if (!db) return;   // never got as far as loading the driver
  await releaseDbLock();
  if (available) await db.close();
});

test('booting against an empty database starts a new world rather than failing', async (t) => {
  if (!available) return t.skip(reason);
  await truncate();
  const W = freshWorld();
  const log = capture();

  const summary = await persistence.loadAtBoot(W, { log });

  assert.equal(summary, null, 'an empty database restored something');
  assert.equal(W.npcs.length, 0);
  assert.equal(persistence.state().loaded, true,
    'an empty database left the server in a not-loaded state, so it will never checkpoint');
  assert.equal(persistence.state().degraded, null);
  assert.match(log.lines.join('\n'), /empty/i);
});

test('a world is checkpointed as it ticks, and comes back on the next boot', async (t) => {
  if (!available) return t.skip(reason);
  await truncate();
  const W = freshWorld();
  const log = capture();
  await persistence.loadAtBoot(W, { log });

  for (let i = 0; i < 5; i++) engine.generateNPC();
  engine.generateOrganization({ type: 'gang' });
  const names = W.npcs.map((n) => n.name);

  const every = persistence.CHECKPOINT_EVERY_TICKS;
  for (let i = 0; i < every + 2; i++) {
    engine.advanceTick();
    await persistence.maybeCheckpoint(W, { log });
  }
  assert.equal(persistence.state().lastCheckpointTick, every,
    `expected a checkpoint at tick ${every}`);

  // The restart.
  const W2 = freshWorld();
  await persistence.loadAtBoot(W2, { log });

  assert.equal(W2.tick, every,
    'the restored world is not at the last checkpointed tick');
  assert.deepEqual(W2.npcs.map((n) => n.name), names,
    'the restored world has different people in it');
  assert.equal(W2.organizations.length, 1);

  // And it keeps running.
  engine.advanceTick();
  assert.equal(W2.tick, every + 1);
});

test('a checkpoint does not happen on every tick', async (t) => {
  if (!available) return t.skip(reason);
  await truncate();
  const W = freshWorld();
  const log = capture();
  await persistence.loadAtBoot(W, { log });
  engine.generateNPC();

  // A checkpoint rewrites every table. Doing that on each advance would
  // make the tick cost scale with the size of the world.
  engine.advanceTick();
  await persistence.maybeCheckpoint(W, { log });
  assert.equal(persistence.state().lastCheckpointTick, 0,
    `a checkpoint ran at tick 1, but the interval is ${persistence.CHECKPOINT_EVERY_TICKS}`);

  const written = await db.query('SELECT count(*)::int AS n FROM entities');
  assert.equal(written.rows[0].n, 0,
    'the database has rows in it after one tick, so a checkpoint ran when it should not have');
});

test('a checkpoint is a whole-world rewrite, not an append', async (t) => {
  if (!available) return t.skip(reason);
  await truncate();
  const W = freshWorld();
  const log = capture();
  await persistence.loadAtBoot(W, { log });
  for (let i = 0; i < 3; i++) engine.generateNPC();

  await persistence.checkpoint(W, { log });
  const first = await db.query('SELECT count(*)::int AS n FROM entities');

  // migrate.js INSERTs and has no upsert path — running it twice
  // against the same rows fails on the first primary key it meets. The
  // truncate-and-rewrite is what makes a checkpoint repeatable.
  await persistence.checkpoint(W, { log });
  const second = await db.query('SELECT count(*)::int AS n FROM entities');

  assert.equal(second.rows[0].n, first.rows[0].n,
    'a second checkpoint changed the row count — it is appending, not rewriting');
  assert.equal(first.rows[0].n, 3);
});

test('a failed load NEVER lets a later checkpoint overwrite the archive', async (t) => {
  if (!available) return t.skip(reason);

  // **The sharpest property in this file.** Suppose Postgres is briefly
  // unreachable at boot. The server fails soft and starts with an empty
  // world — correct, it should not refuse to run. Ten ticks later the
  // database is back.
  //
  // If a checkpoint then ran, it would TRUNCATE a database holding a
  // real world and write an empty one over it. A transient connection
  // blip at the wrong moment would destroy the archive, and the
  // truncate-and-rewrite that makes checkpoints repeatable is exactly
  // what would make it total.
  //
  // So a process that failed its load is permanently barred from
  // checkpointing, for its whole life.

  // Put a real world in the database first — this is what must survive.
  await truncate();
  const seeded = freshWorld();
  const log0 = capture();
  await persistence.loadAtBoot(seeded, { log: log0 });
  for (let i = 0; i < 4; i++) engine.generateNPC();
  await persistence.checkpoint(seeded, { log: log0 });
  const before = await db.query('SELECT count(*)::int AS n FROM entities');
  assert.equal(before.rows[0].n, 4, 'the fixture archive was not written');

  // Now a boot whose load fails.
  const W = freshWorld();
  const log = capture();
  const original = db.query;
  db.query = async () => { throw new Error('connection terminated unexpectedly'); };
  try {
    await persistence.loadAtBoot(W, { log });
  } finally {
    db.query = original;
  }

  assert.equal(persistence.state().degraded, 'connection terminated unexpectedly');
  assert.match(log.lines.join('\n'), /EMPTY world/,
    'a failed load did not say that the world it is running is empty');
  assert.match(log.lines.join('\n'), /lost on the next restart/,
    'a failed load did not say that nothing will be saved');

  // The database is reachable again, and the world ticks on.
  for (let i = 0; i < persistence.CHECKPOINT_EVERY_TICKS * 2; i++) {
    engine.advanceTick();
    await persistence.maybeCheckpoint(W, { log });
  }

  const after = await db.query('SELECT count(*)::int AS n FROM entities');
  assert.equal(after.rows[0].n, 4,
    'a process that failed its load overwrote the archive with its empty world');

  // Even an explicit checkpoint refuses.
  await persistence.checkpoint(W, { log });
  const forced = await db.query('SELECT count(*)::int AS n FROM entities');
  assert.equal(forced.rows[0].n, 4,
    'an explicit checkpoint from a degraded process wiped the archive');
});

test('the server loads before it listens', () => {
  // Not a runtime check — a structural one, because the failure it
  // guards is a race that would only sometimes reproduce.
  //
  // A server that opens its port while still restoring answers from a
  // half-built world: /api/state returns whatever arrays happen to be
  // filled, and a tick advances a world that is about to be
  // overwritten. Neither fails loudly.
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  const listen = src.indexOf('app.listen(');
  const load = src.indexOf('persistence.loadAtBoot(');
  assert.ok(load > 0, 'server.js never calls persistence.loadAtBoot');
  assert.ok(listen > 0, 'server.js never calls app.listen');
  assert.ok(load < listen,
    'app.listen appears before loadAtBoot — the port opens onto a world that is still loading');

  // And that listen is inside the load's callback rather than merely
  // after it in the file.
  const between = src.slice(load, listen);
  assert.match(between, /\.then\(/,
    'loadAtBoot is called before app.listen but not awaited, so the port still opens early');
});

test('a tick is not failed by a failed checkpoint', () => {
  // The simulation being unsaved is bad. The simulation being unusable
  // because the archive is unavailable is worse, and `POST /api/tick`
  // returning 400 for a storage problem tells the caller nothing true.
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'persistence.js'), 'utf8');

  // maybeCheckpoint catches rather than rethrows...
  const fn = src.slice(src.indexOf('async function maybeCheckpoint'));
  assert.match(fn, /catch \(err\)/,
    'maybeCheckpoint no longer catches, so a storage failure fails the tick');
  // ...and says so every time rather than swallowing it.
  assert.match(fn, /CHECKPOINT FAILED/,
    'a failed checkpoint is no longer reported — a server that has silently stopped saving '
    + 'looks exactly like one that is saving');
});

test('an empty database gets the schema loaded into it', async (t) => {
  if (!available) return t.skip(reason);

  // **The Replit/Neon/RDS case.** The Compose path mounts the schema
  // as a docker-entrypoint init script, which Postgres runs on first
  // boot. Nothing equivalent happens on a managed database, so
  // attaching one and starting the app used to give
  // `relation "entities" does not exist`, permanent degraded mode, and
  // a log line that did not say what to do about it.
  const scratch = `vacanc_schema_test_${Date.now()}`;
  const admin = new (require('pg').Client)({
    connectionString: (process.env.DATABASE_URL
      || 'postgres://vacancy:vacancy_dev@localhost:5432/vacancy')
      .replace(/\/[^/]*$/, '/postgres'),
  });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${scratch}`);
  await admin.end();

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: (process.env.DATABASE_URL
      || 'postgres://vacancy:vacancy_dev@localhost:5432/vacancy')
      .replace(/\/[^/]*$/, `/${scratch}`),
  });

  // Point the persistence layer at the scratch database by swapping
  // db.js's own accessors — the module reads through them, so this
  // exercises the real code path rather than a reimplementation.
  const realQuery = db.query;
  const realWithClient = db.withClient;
  db.query = (text, params) => pool.query(text, params);
  db.withClient = async (fn) => {
    const client = await pool.connect();
    try { return await fn(client); } finally { client.release(); }
  };

  try {
    const log = capture();
    const before = await pool.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
    assert.equal(before.rows[0].n, 0, 'the scratch database was not empty to begin with');

    const W = freshWorld();
    await persistence.loadAtBoot(W, { log });

    const after = await pool.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
    assert.ok(after.rows[0].n > 50,
      `only ${after.rows[0].n} tables after boot — the schema was not loaded`);
    assert.equal(persistence.state().degraded, null,
      'the server went degraded against a database it could have set up itself');
    assert.match(log.lines.join('\n'), /loading the schema/);

    // The extensions ran too, not just the base schema — the ordering
    // the Compose init scripts enforce with 01-/02- prefixes.
    const ext = await pool.query(
      "SELECT count(*)::int AS n FROM information_schema.columns "
      + "WHERE table_name='npcs' AND column_name='name'");
    assert.equal(ext.rows[0].n, 1,
      'server/schema-extensions.sql did not run, so npc names cannot round-trip');

    // Second boot must not try again.
    const log2 = capture();
    const loadedAgain = await persistence.ensureSchema({ log: log2 });
    assert.equal(loadedAgain, false, 'it tried to load the schema over an existing one');
  } finally {
    db.query = realQuery;
    db.withClient = realWithClient;
    await pool.end();
    const cleanup = new (require('pg').Client)({
      connectionString: (process.env.DATABASE_URL
        || 'postgres://vacancy:vacancy_dev@localhost:5432/vacancy')
        .replace(/\/[^/]*$/, '/postgres'),
    });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${scratch}`);
    await cleanup.end();
  }
});

test('a partially-loaded schema is refused, not completed', async (t) => {
  if (!available) return t.skip(reason);

  // Auto-creating into an EMPTY database is unambiguously right.
  // Running CREATE TABLE over a database that already has some tables
  // is not: that is an interrupted migration, a version mismatch, or
  // somebody else's database, and papering over any of them is worse
  // than refusing. The real database this suite runs against has its
  // schema, so ensureSchema must decline to touch it.
  const loaded = await persistence.ensureSchema({ log: capture() });
  assert.equal(loaded, false,
    'ensureSchema ran against a database that already has tables');
});
