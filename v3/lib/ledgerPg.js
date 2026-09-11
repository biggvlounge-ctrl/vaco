// V3's ledger as rows, so two instances can both write to it.
//
// **What this is for, and why the document store was not enough.**
//
// `shared/persistencePg.js` moved 28 apps off the filesystem and made
// divergence loud: the whole store is one JSONB document, every write
// is conditional on the version it read, and a second writer is refused
// with a 409 instead of silently overwriting. That is a real
// improvement and it is still one writer. Two V3 containers would spend
// their time refusing each other.
//
// The fix is not a better locking scheme on the document. It is to stop
// having a document. A balance is a row, a transfer is one SQL
// transaction, and Postgres arbitrates — which is what it is for.
//
// ---------------------------------------------------------------------
// WHAT ACTUALLY MAKES THIS SAFE, measured rather than asserted
//
// Two mechanisms here look like they do the same job. They do not, and
// an earlier revision of this comment named the wrong one as the load
// bearing part. Each was tested by removing it:
//
//   1. `SELECT ... WHERE user_id = ANY(...) ORDER BY user_id FOR UPDATE`
//      Takes both row locks up front in an order both sides of a
//      transfer agree on. **This is what makes concurrent transfers
//      correct**, and it is also what stops A->B and B->A deadlocking.
//
//   2. `UPDATE ... WHERE ... AND amount >= $3`
//      The debit and the sufficiency check as one statement.
//
// What removing each one does, run against a real database:
//
//   no lock, conditional debit  -> concurrent spending is still correct,
//                                  but bidirectional transfers deadlock
//                                  (failed 2 runs in 3 — a load-dependent
//                                  flake, the worst kind)
//   no lock, naive read-then-write -> "20 of 20 transfers succeeded" out
//                                  of an account holding enough for 10.
//                                  A 1000 VCoin double-spend, no error.
//   lock, either debit          -> correct, every run
//
// So the lock is the mechanism and the conditional debit is a second
// line — worth keeping, because a future edit that drops or reorders
// the lock fails closed with "Insufficient VCoin balance." instead of
// silently minting money.
//
// The in-memory ledger can do neither, and not because it is
// JavaScript: `getBalance` then compare then assign is three steps, and
// a second process interleaving between the read and the write sees a
// balance that is already spent. In one process that never happens
// because Node is single-threaded, which is exactly why the file
// backend is safe for one container and unsafe for two.
//
// ---------------------------------------------------------------------
// WHAT IS PRESERVED EXACTLY
//
// Every number and every error string below matches `lib/vcoin.js`,
// because dozens of tests across this ecosystem assert against them:
//
//   * STARTING_VCOIN_BALANCE = 1000 on first touch of an unseen account
//   * two-decimal rounding, the same `Math.round(n * 100) / 100`
//   * "Insufficient VCoin balance."
//   * "'amount' must be a positive number."
//   * "'fromUserId' and 'toUserId' are required."
//
// The auto-grant is the subtle one. In memory it is a read that
// mutates: `getBalance` inserts 1000 for an unknown user. Here it is
// `INSERT ... ON CONFLICT DO NOTHING`, which is the same intent and is
// safe to race — two processes touching a new account at once produce
// one row of 1000, not two rows or 2000.
//
// ---------------------------------------------------------------------
// SCOPE, STATED PLAINLY
//
// This is VCoin transfer and balance. `settle`, `cashout` and the VASH
// side are not here yet; they are the same shape of work and they are
// not done. Nothing in this file is wired into `server.js` — V3 still
// runs on the document store. This exists to prove the pattern and to
// be the worked example the remaining decomposition follows.

const SCHEMA = `
CREATE SCHEMA IF NOT EXISTS vaco;

CREATE TABLE IF NOT EXISTS vaco.v3_balances (
  user_id  TEXT    NOT NULL,
  currency TEXT    NOT NULL,
  -- NUMERIC, never double precision. A ledger in floating point
  -- accumulates error that no amount of rounding on the way out
  -- removes, and this column is the reason the rounding below is a
  -- presentation concern rather than a correctness one.
  amount   NUMERIC(20, 2) NOT NULL,
  PRIMARY KEY (user_id, currency),
  CONSTRAINT v3_balances_non_negative CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS vaco.v3_transactions (
  id           BIGSERIAL PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id   TEXT NOT NULL,
  amount       NUMERIC(20, 2) NOT NULL,
  reason       TEXT,
  type         TEXT NOT NULL DEFAULT 'transfer',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v3_transactions_from_idx ON vaco.v3_transactions (from_user_id);
CREATE INDEX IF NOT EXISTS v3_transactions_to_idx   ON vaco.v3_transactions (to_user_id);
`;

const STARTING_VCOIN_BALANCE = 1000;
const VCOIN = 'vcoin';

// Postgres returns NUMERIC as a string, deliberately — it will not
// silently narrow an exact decimal into a float. Every read goes
// through here, because a missed conversion does not throw: it produces
// a balance that compares wrong and concatenates instead of adding.
// The same class of bug that made every restored VACON-C entity carry
// `traits: {}` for a week.
function num(value) {
  return value === null || value === undefined ? null : Number(value);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

async function ensureSchema(pool) {
  await pool.query(SCHEMA);
}

// The auto-grant, as an insert that is safe to race.
async function ensureAccount(client, userId, currency = VCOIN) {
  await client.query(
    `INSERT INTO vaco.v3_balances (user_id, currency, amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, currency) DO NOTHING`,
    [userId, currency, STARTING_VCOIN_BALANCE],
  );
}

async function getBalance(pool, userId, currency = VCOIN) {
  const found = await pool.query(
    'SELECT amount FROM vaco.v3_balances WHERE user_id = $1 AND currency = $2',
    [userId, currency],
  );
  if (found.rowCount > 0) return num(found.rows[0].amount);

  // Unseen account: grant and return, matching the in-memory read that
  // also writes. Done in its own statement rather than lazily, so two
  // readers racing on a new account agree on 1000.
  await ensureAccount(pool, userId, currency);
  const created = await pool.query(
    'SELECT amount FROM vaco.v3_balances WHERE user_id = $1 AND currency = $2',
    [userId, currency],
  );
  return num(created.rows[0].amount);
}

/**
 * Move VCoin between two accounts. One SQL transaction: both balances
 * and the ledger row land together or none of them do.
 */
async function transfer(pool, options = {}) {
  const { fromUserId, toUserId, amount, reason = null } = options;

  // Validation before touching a connection, and word for word what
  // lib/vcoin.js says. `Number.isFinite` rather than `typeof`, because
  // `typeof NaN === 'number'` is true and `NaN <= 0` is false, so NaN
  // walks through the obvious guard and poisons every later sum.
  if (!fromUserId || !toUserId) throw new Error("'fromUserId' and 'toUserId' are required.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("'amount' must be a positive number.");
  if (fromUserId === toUserId) throw new Error("'fromUserId' and 'toUserId' must differ.");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Both accounts exist before either is touched.
    for (const id of [fromUserId, toUserId].sort()) {
      await ensureAccount(client, id);
    }

    // **Lock both rows here, in id order, before either is written.**
    //
    // An earlier version sorted only the `ensureAccount` calls and
    // claimed that prevented deadlock. It did not, and the comment
    // saying so was wrong for the usual reason — it described an
    // intention rather than the code. The writes below take their locks
    // in from/to order, so A->B locks A then B while a simultaneous
    // B->A locks B then A, and Postgres kills one of them:
    //
    //     a deadlock was reported: deadlock detected
    //
    // The test caught it as a flake — two runs in three — which is how
    // this would have behaved in production: rare, load-dependent, and
    // a 500 on a transfer that should have succeeded.
    //
    // `FOR UPDATE` with an ORDER BY takes both locks up front in an
    // order both sides agree on, so by the time the writes run there is
    // nothing left to contend for. The ordering is the fix; the lock is
    // just what makes the ordering matter.
    await client.query(
      `SELECT user_id FROM vaco.v3_balances
        WHERE currency = $1 AND user_id = ANY($2::text[])
        ORDER BY user_id
          FOR UPDATE`,
      [VCOIN, [fromUserId, toUserId]],
    );

    // The debit and the sufficiency check as one statement. Not the
    // primary safety mechanism -- the FOR UPDATE above is -- but a
    // second line that fails closed if a future edit drops it.
    const debited = await client.query(
      `UPDATE vaco.v3_balances
          SET amount = amount - $3
        WHERE user_id = $1 AND currency = $2 AND amount >= $3
        RETURNING amount`,
      [fromUserId, VCOIN, amount],
    );
    if (debited.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient VCoin balance.');
    }

    const credited = await client.query(
      `UPDATE vaco.v3_balances
          SET amount = amount + $3
        WHERE user_id = $1 AND currency = $2
        RETURNING amount`,
      [toUserId, VCOIN, amount],
    );

    const recorded = await client.query(
      `INSERT INTO vaco.v3_transactions (from_user_id, to_user_id, amount, reason, type)
       VALUES ($1, $2, $3, $4, 'transfer')
       RETURNING id, from_user_id, to_user_id, amount, reason, type, created_at`,
      [fromUserId, toUserId, amount, reason],
    );

    await client.query('COMMIT');

    const row = recorded.rows[0];
    return {
      transaction: {
        id: num(row.id),
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        amount: num(row.amount),
        reason: row.reason,
        type: row.type,
        timestamp: row.created_at.getTime(),
      },
      fromBalance: round(num(debited.rows[0].amount)),
      toBalance: round(num(credited.rows[0].amount)),
    };
  } catch (err) {
    // ROLLBACK may itself fail if the connection died; the original
    // error is the one worth reporting, so this must not mask it.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getTransactionHistory(pool, userId, { limit = 50 } = {}) {
  const rows = await pool.query(
    `SELECT id, from_user_id, to_user_id, amount, reason, type, created_at
       FROM vaco.v3_transactions
      WHERE from_user_id = $1 OR to_user_id = $1
      ORDER BY id DESC
      LIMIT $2`,
    [userId, limit],
  );
  return rows.rows.map((row) => ({
    id: num(row.id),
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amount: num(row.amount),
    reason: row.reason,
    type: row.type,
    timestamp: row.created_at.getTime(),
  }));
}

/**
 * Every VCoin in the ledger, and whether the transaction log explains
 * how it got there. The in-memory `reconcile` answers the same
 * question; this one can answer it while the ledger is being written to.
 */
async function reconcile(pool) {
  const totals = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS accounts
       FROM vaco.v3_balances WHERE currency = $1`,
    [VCOIN],
  );
  const moved = await pool.query(
    'SELECT COUNT(*) AS transactions FROM vaco.v3_transactions',
  );
  const accounts = num(totals.rows[0].accounts);
  return {
    accounts,
    totalVCoin: round(num(totals.rows[0].total)),
    transactions: num(moved.rows[0].transactions),
    // A transfer moves value without creating it, so the total must be
    // the number of accounts times the opening grant. Anything else
    // means something minted or burned outside `transfer`.
    expectedTotal: accounts * STARTING_VCOIN_BALANCE,
  };
}

module.exports = {
  SCHEMA,
  STARTING_VCOIN_BALANCE,
  ensureSchema,
  getBalance,
  transfer,
  getTransactionHistory,
  reconcile,
};
