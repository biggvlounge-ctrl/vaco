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
// Balance, transfer, settle, cashout and the VASH side are all here.
// What is NOT here is idempotency: `lib/idempotency.js` replays a stored
// response for a repeated `Idempotency-Key`, and it reads the store
// directly. Until that is row-backed too, V3 cannot run on this alone —
// see `lib/idempotencyPg.js`.

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

-- Additive, and idempotent, so an existing table gains them rather than
-- needing to be dropped. A cashout has no payee, so to_user_id cannot
-- stay NOT NULL; settlement_id groups the legs of one atomic settle;
-- metadata carries the two fields only a cashout has (vashCredited,
-- rate) rather than two mostly-null columns on every transfer.
--
-- No backticks anywhere in this string: it is a JS template literal, and
-- a backtick in a SQL comment ends it. That is what the first version
-- did, and the file stopped parsing.
ALTER TABLE vaco.v3_transactions ALTER COLUMN to_user_id DROP NOT NULL;
ALTER TABLE vaco.v3_transactions ADD COLUMN IF NOT EXISTS settlement_id BIGINT;
ALTER TABLE vaco.v3_transactions ADD COLUMN IF NOT EXISTS metadata JSONB;
CREATE SEQUENCE IF NOT EXISTS vaco.v3_settlement_id_seq;
`;

const STARTING_VCOIN_BALANCE = 1000;
const VCOIN = 'vcoin';
const VASH = 'vash';
const VCOIN_TO_VASH_RATE = 0.01;

// **Opening balances differ by currency, and getting this wrong would
// hand everybody 1000 VASH.** `lib/vcoin.js` auto-grants 1000 VCoin on
// first touch; `lib/vash.js` returns `store.vashBalances[userId] || 0`,
// which opens at nothing. One table holds both, so the opening balance
// is a property of the currency rather than of the table.
const OPENING_BALANCE = { [VCOIN]: STARTING_VCOIN_BALANCE, [VASH]: 0 };

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
    [userId, currency, OPENING_BALANCE[currency] ?? 0],
  );
}

// Locks every named account in one order, so two operations touching an
// overlapping set cannot take their locks in opposite orders. Sorting is
// the entire mechanism; the lock is what makes the order matter.
//
// `settle` is why this takes a list rather than a pair: a settlement
// legitimately touches three or four accounts, and two settlements
// sharing two of them is exactly the shape that deadlocks.
async function lockAccounts(client, userIds, currency = VCOIN) {
  const unique = [...new Set(userIds)].sort();
  for (const id of unique) await ensureAccount(client, id, currency);
  await client.query(
    `SELECT user_id FROM vaco.v3_balances
      WHERE currency = $1 AND user_id = ANY($2::text[])
      ORDER BY user_id
        FOR UPDATE`,
    [currency, unique],
  );
  return unique;
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

/**
 * Atomic multi-leg settlement. Every leg moves or none does.
 *
 * **The refusal is the interesting half.** `lib/vcoin.js` goes to
 * deliberate trouble to validate without writing — its own comment
 * explains that calling `getBalance` during validation would auto-grant
 * an account to a payee who is about to be refused, so a rejected
 * settlement would leave new accounts behind. Here the whole thing runs
 * inside one SQL transaction, so a `ROLLBACK` undoes the account
 * creation too and the property holds for free rather than by care.
 */
async function settle(pool, options = {}) {
  const { legs, reason = null } = options;

  if (!Array.isArray(legs) || legs.length === 0) {
    throw new Error("'legs' must be a non-empty array of { fromUserId, toUserId, amount }.");
  }

  // Shape validation before a connection is taken, word for word what
  // lib/vcoin.js reports, including the `legs[i]:` prefix.
  legs.forEach((leg, i) => {
    const { fromUserId, toUserId, amount } = leg || {};
    const at = `legs[${i}]`;
    if (!fromUserId || !toUserId) throw new Error(`${at}: 'fromUserId' and 'toUserId' are required.`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${at}: 'amount' must be a positive number.`);
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const touched = legs.flatMap((l) => [l.fromUserId, l.toUserId]);
    await lockAccounts(client, touched);

    // Balances are read once, under the locks, and the legs are checked
    // against a running total — a payer can legitimately fund a later
    // leg with what an earlier one paid them, which is the same
    // arithmetic lib/vcoin.js does with its `running` Map.
    const held = await client.query(
      `SELECT user_id, amount FROM vaco.v3_balances
        WHERE currency = $1 AND user_id = ANY($2::text[])`,
      [VCOIN, [...new Set(touched)]],
    );
    const running = new Map(held.rows.map((r) => [r.user_id, num(r.amount)]));

    legs.forEach((leg, i) => {
      const from = running.get(leg.fromUserId);
      if (from < leg.amount) {
        throw new Error(`legs[${i}]: Insufficient VCoin balance. Nothing in this settlement was applied.`);
      }
      running.set(leg.fromUserId, round(from - leg.amount));
      running.set(leg.toUserId, round(running.get(leg.toUserId) + leg.amount));
    });

    const settlementId = num(
      (await client.query("SELECT nextval('vaco.v3_settlement_id_seq') AS id")).rows[0].id,
    );

    const transactions = [];
    for (const leg of legs) {
      await client.query(
        `UPDATE vaco.v3_balances SET amount = amount - $3
          WHERE user_id = $1 AND currency = $2`,
        [leg.fromUserId, VCOIN, leg.amount],
      );
      await client.query(
        `UPDATE vaco.v3_balances SET amount = amount + $3
          WHERE user_id = $1 AND currency = $2`,
        [leg.toUserId, VCOIN, leg.amount],
      );
      const row = await client.query(
        `INSERT INTO vaco.v3_transactions
           (from_user_id, to_user_id, amount, reason, type, settlement_id, metadata)
         VALUES ($1, $2, $3, $4, 'transfer', $5, $6)
         RETURNING id, created_at`,
        [leg.fromUserId, leg.toUserId, leg.amount, leg.reason ?? null, settlementId,
          JSON.stringify({ settlementReason: reason })],
      );
      transactions.push({
        id: num(row.rows[0].id),
        fromUserId: leg.fromUserId,
        toUserId: leg.toUserId,
        amount: leg.amount,
        reason: leg.reason ?? null,
        timestamp: row.rows[0].created_at.getTime(),
        type: 'transfer',
        settlementId,
        settlementReason: reason,
      });
    }

    await client.query('COMMIT');

    const balances = {};
    for (const [userId, amount] of running) balances[userId] = amount;
    return { settlementId, reason, transactions, balances };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getVashBalance(pool, userId) {
  const found = await pool.query(
    'SELECT amount FROM vaco.v3_balances WHERE user_id = $1 AND currency = $2',
    [userId, VASH],
  );
  // Unlike VCoin, an unseen VASH account is 0 and is NOT created by
  // reading. `lib/vash.js` returns `store.vashBalances[userId] || 0`
  // with no assignment, and a read that silently opens an account is a
  // write nobody asked for.
  return found.rowCount > 0 ? num(found.rows[0].amount) : 0;
}

/**
 * Convert VCoin into VASH at the fixed rate. Debit, credit and ledger
 * row in one transaction, across two currencies.
 */
async function cashout(pool, options = {}) {
  const { userId, vcoinAmount } = options;

  if (!userId) throw new Error("'userId' is required.");
  if (!Number.isFinite(vcoinAmount) || vcoinAmount <= 0) {
    throw new Error("'vcoinAmount' must be a positive number.");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Both currencies for one user. Locked in a fixed currency order so
    // a cashout and a transfer touching the same person agree.
    await lockAccounts(client, [userId], VCOIN);
    await lockAccounts(client, [userId], VASH);

    const debited = await client.query(
      `UPDATE vaco.v3_balances SET amount = amount - $3
        WHERE user_id = $1 AND currency = $2 AND amount >= $3
        RETURNING amount`,
      [userId, VCOIN, vcoinAmount],
    );
    if (debited.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient VCoin balance for cashout.');
    }

    const vashAmount = round(vcoinAmount * VCOIN_TO_VASH_RATE);
    const credited = await client.query(
      `UPDATE vaco.v3_balances SET amount = amount + $3
        WHERE user_id = $1 AND currency = $2
        RETURNING amount`,
      [userId, VASH, vashAmount],
    );

    await client.query(
      `INSERT INTO vaco.v3_transactions
         (from_user_id, to_user_id, amount, reason, type, metadata)
       VALUES ($1, NULL, $2, 'vash cashout', 'cashout', $3)`,
      [userId, vcoinAmount, JSON.stringify({ vashCredited: vashAmount, rate: VCOIN_TO_VASH_RATE })],
    );

    await client.query('COMMIT');

    return {
      userId,
      vcoinDeducted: vcoinAmount,
      vashCredited: vashAmount,
      rate: VCOIN_TO_VASH_RATE,
      newVcoinBalance: round(num(debited.rows[0].amount)),
      newVashBalance: round(num(credited.rows[0].amount)),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SCHEMA,
  STARTING_VCOIN_BALANCE,
  VCOIN_TO_VASH_RATE,
  ensureSchema,
  getBalance,
  getVashBalance,
  transfer,
  settle,
  cashout,
  getTransactionHistory,
  reconcile,
};
