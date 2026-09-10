// server/persistence.js
//
// Boot-time load and periodic checkpoint — the bit that turns
// `migrate.js` + `restore.js` from two functions into a world that
// actually survives a restart.
//
// **The shape, and why it is this shape.** Postgres is the durable
// record; memory is the working set. Load at boot, checkpoint after
// every N ticks. See server/restore.js's header for why this rather
// than converting the whole engine to async Postgres reads — briefly:
// a tick sweeps the entire world, so per-row round-trips would be
// thousands of queries to compute what the process already holds; it
// would not make anything more durable, since what loses the
// simulation is that nothing reads the database back; and interleaved
// async reads through the tick pipeline is how a deterministic engine
// stops being one.
//
// ---------------------------------------------------------------------
// **Fail soft on load, hard on nothing.**
//
// If Postgres is unreachable at boot, VACON-C starts with an empty
// world and says so, loudly, once. It does not exit. A simulation
// server that refuses to start because its archive is unavailable is
// less useful than one that starts empty and tells you — and the
// ecosystem's own convention (`start-ecosystem.sh` health checks) is
// that an app either answers or is visibly DOWN, not that it hangs.
//
// The checkpoint is the opposite: if a checkpoint fails, that IS
// reported every time, because a server that has silently stopped
// saving looks exactly like one that is saving.
//
// ---------------------------------------------------------------------
// **A checkpoint is a whole-world rewrite, not an append.**
//
// migrate.js INSERTs; it has no upsert path, and running it twice
// against the same database fails on the first primary key it meets.
// So a checkpoint truncates and rewrites inside migrate.js's own
// transaction. That is honest for a snapshot model and it is what
// makes the checkpoint idempotent — but it does mean the database is
// briefly empty mid-transaction, which is fine because nothing else
// reads it and the whole thing rolls back on failure.

'use strict';

const db = require('./db.js');
const { migrateWorldStateToPostgres } = require('./migrate.js');
const { restoreWorldStateFromPostgres } = require('./restore.js');

// Ticks between checkpoints. A checkpoint rewrites every table, so this
// is not free; 10 keeps a crash to at most ten ticks of lost history
// without writing the world on every advance.
//
// //: INTERPRETIVE — nothing in the package says how often a world
// should be saved. Overridable, and named rather than buried as a
// literal.
const CHECKPOINT_EVERY_TICKS = Number(process.env.VACONC_CHECKPOINT_TICKS) || 10;

let lastCheckpointTick = null;
let loaded = false;
let degraded = null;

// Load whatever is in the database into `worldState`. Returns a
// summary, or null when there is nothing to load or nothing to load
// from.
async function loadAtBoot(worldState, { log = console } = {}) {
  try {
    const counted = await db.query('SELECT count(*)::int AS n FROM entities');
    if (counted.rows[0].n === 0) {
      log.log('VACON-C: database reachable and empty — starting a new world.');
      loaded = true;
      lastCheckpointTick = worldState.tick;
      return null;
    }

    const summary = await restoreWorldStateFromPostgres(worldState);
    loaded = true;
    lastCheckpointTick = worldState.tick;
    log.log(
      `VACON-C: restored a world at tick ${summary.tick} — `
      + `${summary.npcs} npcs, ${summary.organizations} organizations, `
      + `${summary.families} families, ${summary.events} events.`,
    );
    return summary;
  } catch (err) {
    // The one place this fails soft. Say it once, in full, and carry on
    // with an empty world rather than pretending the world is empty
    // because it is.
    degraded = err.message;
    log.error(
      `VACON-C: could not load from Postgres — ${err.message}\n`
      + '  Starting with an EMPTY world. Nothing will be checkpointed until this is fixed,\n'
      + '  so anything the simulation does from here is lost on the next restart.\n'
      + `  DATABASE_URL is ${process.env.DATABASE_URL ? 'set' : 'unset (using the local default)'}.`,
    );
    return null;
  }
}

// Write the whole world. Truncate-and-rewrite, in migrate.js's
// transaction — see the header.
async function checkpoint(worldState, { log = console } = {}) {
  if (degraded) return null;   // never started from a good state; do not overwrite one
  const tables = await db.query(
    "SELECT string_agg(tablename, ', ') AS t FROM pg_tables WHERE schemaname='public'");
  await db.query(`TRUNCATE ${tables.rows[0].t} CASCADE`);
  const summary = await migrateWorldStateToPostgres(worldState);
  lastCheckpointTick = worldState.tick;
  return summary;
}

// Call after each tick. Checkpoints when enough ticks have passed.
//
// Deliberately does NOT throw on a failed checkpoint: the caller is an
// HTTP route handler, and failing `POST /api/tick` because the archive
// is unavailable would make the simulation unusable rather than merely
// unsaved. It reports every failure instead — a server that has quietly
// stopped saving is indistinguishable from one that is saving, which is
// the whole reason this is loud.
async function maybeCheckpoint(worldState, { log = console } = {}) {
  if (!loaded || degraded) return null;
  if (lastCheckpointTick !== null
      && worldState.tick - lastCheckpointTick < CHECKPOINT_EVERY_TICKS) {
    return null;
  }
  try {
    return await checkpoint(worldState, { log });
  } catch (err) {
    log.error(`VACON-C: CHECKPOINT FAILED at tick ${worldState.tick} — ${err.message}. `
      + 'The simulation is running and is NOT being saved.');
    return null;
  }
}

// For tests and for a clean shutdown.
function state() {
  return { loaded, degraded, lastCheckpointTick, everyTicks: CHECKPOINT_EVERY_TICKS };
}

function reset() {
  loaded = false;
  degraded = null;
  lastCheckpointTick = null;
}

module.exports = {
  CHECKPOINT_EVERY_TICKS,
  loadAtBoot,
  checkpoint,
  maybeCheckpoint,
  state,
  reset,
};
