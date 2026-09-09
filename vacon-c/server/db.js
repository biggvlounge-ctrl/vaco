// server/db.js
//
// Real Postgres connection layer — locked Day 1 step 9 ("stand up
// Postgres, migrate off in-memory WorldState, keep /api/* identical").
// Named/placed per the architecture doc's own file-ownership note
// (Section 8): "db.js (new)".
//
// Scope of what this file actually does, stated plainly: it connects
// to a real, running Postgres instance and exposes a query() helper —
// that connection is genuinely tested (see
// dev-docs/phase-9-postgres/tasks.md for the verification). It does
// NOT convert every WorldState-reading function in engine.js/
// economy.js/keys.js/tick.js to query Postgres directly instead —
// that's a much larger rewrite (every one of those functions is
// currently synchronous and array-based; Postgres access is
// necessarily async) and is explicitly flagged as NOT done in this
// pass, not silently skipped. What IS done and tested: standing up a
// real Postgres instance, loading the literal schema unmodified, and
// migrateWorldStateToPostgres() (server/migrate.js) — a real, tested,
// one-way export of the current in-memory WorldState into it, proving
// every table this project's WorldState arrays have been shaped to
// mirror since step 2 actually accepts that data unmodified.

'use strict';

const { Pool } = require('pg');

// Connection config — no hosted Postgres URL exists anywhere in the
// handoff package (nothing to invent there), so this defaults to the
// local instance this session stood up itself. Override via
// DATABASE_URL for a real deployment.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://vacancy:vacancy_dev@localhost:5432/vacancy',
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withClient,
  close,
};
