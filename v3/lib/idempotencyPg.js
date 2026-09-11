// Idempotency keys in rows, so two V3 containers cannot both execute
// the same request.
//
// **The in-memory version is correct for one process and unsafe for
// two, and not in the way the rest of the store is.** `lib/idempotency.js`
// checks whether a key exists, and if it does not, lets the handler run
// and records the result afterwards. In one process nothing can
// interleave between the check and the record, because Node is
// single-threaded and the handler is synchronous up to the response.
//
// Across two containers that gap is wide open. Both receive a retry of
// the same charge, both find no record, both execute, and the caller is
// billed twice — which is the exact failure idempotency keys exist to
// prevent. The store being shared does not help: the record is written
// after the work, so there is nothing to find during it.
//
// ---------------------------------------------------------------------
// CLAIM FIRST, THEN WORK
//
// The fix is to write the key *before* running the handler:
//
//   INSERT INTO vaco.v3_idempotency (key, ...) VALUES (...)
//   ON CONFLICT (key) DO NOTHING
//
// Exactly one caller inserts the row; every other one gets zero rows
// and knows somebody else owns this key. Postgres decides, once, for
// all containers.
//
// That introduces a state the in-memory version never had: a key that
// is claimed but not finished. Three outcomes, all of them honest:
//
//   finished   -> replay the stored response, as before
//   in flight  -> 409, because the answer does not exist yet and
//                 inventing one would be worse than saying so
//   failed     -> the claim is deleted, so a retry after a genuine
//                 failure can still succeed. That matches the existing
//                 rule that only 2xx results are recorded: a failed
//                 request is not a completed operation.
//
// ---------------------------------------------------------------------
// WHAT IS PRESERVED EXACTLY
//
//   * the 422 on a reused key with a different body, same wording
//   * `idempotentReplay: true` added to a replayed body
//   * only 2xx results are recorded
//   * the retention window and the expiry sweep

const crypto = require('crypto');

const MS_PER_HOUR = 60 * 60 * 1000;

const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS vaco;
CREATE TABLE IF NOT EXISTS vaco.v3_idempotency (
  key         TEXT PRIMARY KEY,
  route       TEXT        NOT NULL,
  fingerprint TEXT        NOT NULL,
  -- NULL until the handler finishes. A row with a null status is a
  -- claim, not a result, and that distinction is the whole mechanism.
  status      INT,
  body        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS v3_idempotency_expires_idx ON vaco.v3_idempotency (expires_at);
`;

async function ensureSchema(pool) {
  await pool.query(SCHEMA);
}

// The same fingerprint the in-memory version computes, so a key issued
// against one backend means the same thing against the other.
function fingerprint(routeName, body) {
  return crypto.createHash('sha256')
    .update(`${routeName}:${JSON.stringify(body)}`)
    .digest('hex');
}

async function sweepExpired(pool) {
  const gone = await pool.query('DELETE FROM vaco.v3_idempotency WHERE expires_at <= now()');
  return gone.rowCount;
}

/**
 * Express middleware. Mount ahead of a handler whose work must happen
 * at most once per Idempotency-Key.
 */
function idempotent(pool, routeName, { retentionHours = 24 } = {}) {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key) return next();

    const print = fingerprint(routeName, req.body || {});
    const expiresAt = new Date(Date.now() + retentionHours * MS_PER_HOUR);

    let claimed;
    try {
      await sweepExpired(pool);
      claimed = await pool.query(
        `INSERT INTO vaco.v3_idempotency (key, route, fingerprint, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [key, routeName, print, expiresAt],
      );
    } catch (err) {
      return res.status(503).json({ error: `idempotency: store unavailable (${err.message})` });
    }

    if (claimed.rowCount === 0) {
      // Somebody else owns this key. Which of the three cases it is
      // depends on what they have written so far.
      const existing = (await pool.query(
        'SELECT route, fingerprint, status, body FROM vaco.v3_idempotency WHERE key = $1',
        [key],
      )).rows[0];

      // Raced with an expiry sweep between the insert and this read.
      // Rare, and retrying is the honest answer rather than guessing.
      if (!existing) {
        return res.status(409).json({
          error: `Idempotency-Key "${key}" changed state mid-request. Retry.`,
        });
      }

      if (existing.fingerprint !== print) {
        return res.status(422).json({
          error: `Idempotency-Key "${key}" was already used for a different request on ${existing.route}. `
            + 'Reusing a key with a changed body is a caller bug -- use a new key.',
        });
      }

      if (existing.status === null) {
        return res.status(409).json({
          error: `Idempotency-Key "${key}" is already in flight on another request. `
            + 'Retry once it completes; the answer does not exist yet.',
        });
      }

      return res.status(existing.status).json({ ...existing.body, idempotentReplay: true });
    }

    // We own the key. Record the result, or release the claim.
    const originalJson = res.json.bind(res);
    let settled = false;

    res.json = (body) => {
      if (settled) return originalJson(body);
      settled = true;

      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const finish = ok
        ? pool.query(
          'UPDATE vaco.v3_idempotency SET status = $2, body = $3 WHERE key = $1',
          [key, res.statusCode, JSON.stringify(body)],
        )
        // Not a completed operation, so the key must not be held. A
        // caller retrying after a real failure has to be able to
        // succeed, which is the existing rule about recording only 2xx.
        : pool.query('DELETE FROM vaco.v3_idempotency WHERE key = $1', [key]);

      finish.then(
        () => originalJson(body),
        (err) => {
          // The work happened; only the bookkeeping failed. Saying 200
          // would promise a replay this key can no longer deliver.
          res.status(500);
          originalJson({
            error: `idempotency: the operation completed but its key could not be recorded (${err.message}). `
              + 'Do not retry with the same key.',
          });
        },
      );
      return res;
    };

    // A handler that never calls res.json (an error bubbling to
    // Express) would otherwise leave the key claimed forever.
    res.on('finish', () => {
      if (settled) return;
      settled = true;
      pool.query('DELETE FROM vaco.v3_idempotency WHERE key = $1', [key]).catch(() => {});
    });

    return next();
  };
}

async function describeIdempotency(pool) {
  const counts = await pool.query(
    `SELECT count(*)::int AS stored,
            count(*) FILTER (WHERE status IS NULL)::int AS in_flight
       FROM vaco.v3_idempotency`,
  );
  return {
    enabled: true,
    backend: 'postgres',
    storedKeys: counts.rows[0].stored,
    inFlight: counts.rows[0].in_flight,
  };
}

module.exports = { SCHEMA, ensureSchema, fingerprint, idempotent, sweepExpired, describeIdempotency };
