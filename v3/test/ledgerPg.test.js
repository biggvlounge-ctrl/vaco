// V3's ledger as rows — and specifically, two writers at once.
//
// **The whole point of this file is the concurrency tests.** The rest
// check that the SQL version says exactly what the in-memory version
// says, because dozens of tests across this ecosystem assert against
// those numbers and strings. But the reason the row-level ledger exists
// is the case neither earlier backend survives:
//
//   the file store  — two processes read 1000, both spend 800, both
//                     write. Last writer wins. 1600 spent from an
//                     account that had 1000, no error anywhere.
//   the document store — the second writer is refused with a 409. Safe,
//                     and it means two containers cannot both serve.
//   this            — both writers proceed, Postgres serialises them on
//                     the row, and the second one correctly finds the
//                     money gone.
//
// Run against a real Postgres. A stub cannot exhibit row locking, so a
// test against one would be a test of the stub. Skips with a reason
// when no database is reachable rather than passing on nothing.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ledger = require('../lib/ledgerPg');

const URL_ = process.env.DATABASE_URL
  || 'postgres://vacancy:vacancy_dev@localhost:5432/vacancy';

let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch {
  try {
    ({ Pool } = require(path.join(__dirname, '..', '..', 'vacon-c', 'node_modules', 'pg')));
  } catch { Pool = null; }
}

let pool = null;
let SKIP = false;

test.before(async () => {
  if (!Pool) { SKIP = 'the pg package is not installed — run ./install-ecosystem.sh'; return; }
  pool = new Pool({ connectionString: URL_, max: 8 });
  try {
    await pool.query('SELECT 1');
    await ledger.ensureSchema(pool);
  } catch (err) {
    SKIP = `no Postgres at ${URL_.replace(/:[^:@]*@/, ':***@')} (${err.message})`;
    await pool.end().catch(() => {});
    pool = null;
  }
});

test.after(async () => { if (pool) await pool.end(); });

let seq = 0;
// Unique per test so runs never collide, and so a failed run leaves
// evidence rather than poisoning the next one.
const who = (name) => `t${process.pid}-${Date.now()}-${seq += 1}-${name}`;

const skip = () => SKIP;

// -- Parity with the in-memory ledger -------------------------------------

test('an unseen account opens at 1000', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const a = who('new');
  assert.strictEqual(await ledger.getBalance(pool, a), 1000);
});

test('a transfer moves the money and records it', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const [a, b] = [who('from'), who('to')];

  const result = await ledger.transfer(pool, { fromUserId: a, toUserId: b, amount: 250, reason: 'test' });

  assert.strictEqual(result.fromBalance, 750);
  assert.strictEqual(result.toBalance, 1250);
  assert.strictEqual(result.transaction.amount, 250);
  assert.strictEqual(result.transaction.type, 'transfer');
  assert.strictEqual(await ledger.getBalance(pool, a), 750);
  assert.strictEqual(await ledger.getBalance(pool, b), 1250);
});

test('the rejection messages match lib/vcoin.js word for word', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const [a, b] = [who('a'), who('b')];

  await assert.rejects(
    () => ledger.transfer(pool, { fromUserId: a, toUserId: b, amount: 5000 }),
    /Insufficient VCoin balance\./,
  );
  for (const bad of [0, -1, NaN, Infinity, '10', undefined]) {
    await assert.rejects(
      () => ledger.transfer(pool, { fromUserId: a, toUserId: b, amount: bad }),
      /'amount' must be a positive number\./,
      `accepted ${JSON.stringify(bad)} as an amount`,
    );
  }
  await assert.rejects(
    () => ledger.transfer(pool, { toUserId: b, amount: 10 }),
    /'fromUserId' and 'toUserId' are required\./,
  );
});

test('a refused transfer moves nothing at all', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const [a, b] = [who('a'), who('b')];
  await ledger.getBalance(pool, a);
  await ledger.getBalance(pool, b);

  await assert.rejects(() => ledger.transfer(pool, { fromUserId: a, toUserId: b, amount: 5000 }));

  assert.strictEqual(await ledger.getBalance(pool, a), 1000, 'the payer was debited by a failed transfer');
  assert.strictEqual(await ledger.getBalance(pool, b), 1000, 'the payee was credited by a failed transfer');
  const history = await ledger.getTransactionHistory(pool, a);
  assert.strictEqual(history.length, 0, 'a failed transfer left a ledger row behind');
});

test('NUMERIC comes back as a number, not a string', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // Postgres returns NUMERIC as a string so it never silently narrows
  // an exact decimal to a float. A missed conversion does not throw —
  // it concatenates. `"1000" - 250` is 750 but `"1000" + 250` is
  // "1000250", and only one of those appears in a ledger.
  const [a, b] = [who('a'), who('b')];
  const r = await ledger.transfer(pool, { fromUserId: a, toUserId: b, amount: 10.5 });
  assert.strictEqual(typeof r.fromBalance, 'number');
  assert.strictEqual(typeof r.toBalance, 'number');
  assert.strictEqual(typeof r.transaction.amount, 'number');
  assert.strictEqual(r.fromBalance, 989.5);
  assert.strictEqual(r.toBalance, 1010.5);
});

// -- The reason this exists ----------------------------------------------

test('two concurrent writers cannot both spend the same money', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);

  // One account with 1000. Two transfers of 800 issued at the same
  // moment on different connections — which is exactly two containers
  // of V3 serving two requests.
  //
  // On the file backend both read 1000, both see 800 <= 1000, both
  // write, and the account ends at 200 having paid out 1600. On the
  // document backend the second is refused with a conflict. Here both
  // are allowed to try and Postgres decides.
  const payer = who('payer');
  const [x, y] = [who('x'), who('y')];
  await ledger.getBalance(pool, payer);

  const results = await Promise.allSettled([
    ledger.transfer(pool, { fromUserId: payer, toUserId: x, amount: 800 }),
    ledger.transfer(pool, { fromUserId: payer, toUserId: y, amount: 800 }),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  assert.strictEqual(ok.length, 1, 'both transfers succeeded — the account paid out 1600 of its 1000');
  assert.strictEqual(failed.length, 1);
  assert.match(failed[0].reason.message, /Insufficient VCoin balance\./);

  assert.strictEqual(await ledger.getBalance(pool, payer), 200,
    'the payer balance does not reflect exactly one transfer');

  // And the loser left nothing behind.
  const history = await ledger.getTransactionHistory(pool, payer);
  assert.strictEqual(history.length, 1, 'the refused transfer still wrote a ledger row');
});

test('twenty concurrent transfers out of one account conserve the money', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // The same property under real contention rather than a pair. 20
  // writers, 100 each, against an account holding 1000: ten must
  // succeed and ten must fail, and no combination of interleavings may
  // produce a different total.
  const payer = who('payer');
  const payee = who('payee');
  await ledger.getBalance(pool, payer);
  await ledger.getBalance(pool, payee);

  const attempts = Array.from({ length: 20 }, () => ledger.transfer(pool, {
    fromUserId: payer, toUserId: payee, amount: 100,
  }));
  const results = await Promise.allSettled(attempts);
  const ok = results.filter((r) => r.status === 'fulfilled').length;

  assert.strictEqual(ok, 10, `${ok} of 20 transfers succeeded; exactly 10 fit in the balance`);
  assert.strictEqual(await ledger.getBalance(pool, payer), 0);
  assert.strictEqual(await ledger.getBalance(pool, payee), 2000);

  // Conservation: nothing minted, nothing burned.
  assert.strictEqual(
    (await ledger.getBalance(pool, payer)) + (await ledger.getBalance(pool, payee)),
    2000,
    'VCoin was created or destroyed by concurrent transfers',
  );
});

test('transfers in both directions between one pair do not deadlock', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // A -> B and B -> A at the same instant. Taking row locks in
  // whichever order the arguments arrive is the textbook way to
  // deadlock; `transfer` sorts the account ids before touching either,
  // so both sides lock in the same order.
  const [a, b] = [who('a'), who('b')];
  await ledger.getBalance(pool, a);
  await ledger.getBalance(pool, b);

  const results = await Promise.allSettled([
    ledger.transfer(pool, { fromUserId: a, toUserId: b, amount: 100 }),
    ledger.transfer(pool, { fromUserId: b, toUserId: a, amount: 100 }),
  ]);

  const deadlocked = results.filter(
    (r) => r.status === 'rejected' && /deadlock/i.test(r.reason.message),
  );
  assert.strictEqual(deadlocked.length, 0,
    `a deadlock was reported: ${deadlocked.map((d) => d.reason.message).join('; ')}`);
  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 2);
  assert.strictEqual(await ledger.getBalance(pool, a), 1000, 'the round trip did not net to zero');
  assert.strictEqual(await ledger.getBalance(pool, b), 1000);
});

test('the database itself refuses a negative balance', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // The CHECK constraint is a second line, not the first — `transfer`'s
  // conditional debit is what normally prevents this. It exists so that
  // a future code path written without that WHERE clause fails loudly
  // at the database rather than quietly producing a negative ledger.
  const a = who('a');
  await ledger.getBalance(pool, a);
  await assert.rejects(
    () => pool.query(
      'UPDATE vaco.v3_balances SET amount = -1 WHERE user_id = $1 AND currency = $2',
      [a, 'vcoin'],
    ),
    /v3_balances_non_negative|violates check constraint/i,
    'the database accepted a negative balance',
  );
});

// -- settle ---------------------------------------------------------------

test('a settlement moves every leg together', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const [payer, x, y] = [who('payer'), who('x'), who('y')];

  const result = await ledger.settle(pool, {
    reason: 'job complete',
    legs: [
      { fromUserId: payer, toUserId: x, amount: 300, reason: 'worker' },
      { fromUserId: payer, toUserId: y, amount: 100, reason: 'platform fee' },
    ],
  });

  assert.strictEqual(result.transactions.length, 2);
  assert.strictEqual(result.reason, 'job complete');
  assert.ok(Number.isFinite(result.settlementId));
  assert.strictEqual(result.transactions[0].settlementId, result.settlementId,
    'both legs must carry the same settlementId or they cannot be read as one settlement');
  assert.strictEqual(result.transactions[1].settlementId, result.settlementId);

  assert.strictEqual(await ledger.getBalance(pool, payer), 600);
  assert.strictEqual(await ledger.getBalance(pool, x), 1300);
  assert.strictEqual(await ledger.getBalance(pool, y), 1100);
});

test('a refused leg leaves NOTHING applied, including new accounts', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // The property lib/vcoin.js takes deliberate care to preserve: a
  // refused settlement must not even auto-grant an account to a payee
  // it was about to pay. Here ROLLBACK gives it for free — but only if
  // the account creation is genuinely inside the transaction, which is
  // what this checks.
  const payer = who('payer');
  const [ok, doomed] = [who('ok'), who('doomed')];
  await ledger.getBalance(pool, payer);

  await assert.rejects(
    () => ledger.settle(pool, {
      legs: [
        { fromUserId: payer, toUserId: ok, amount: 100 },
        { fromUserId: payer, toUserId: doomed, amount: 5000 },
      ],
    }),
    /legs\[1\]: Insufficient VCoin balance\. Nothing in this settlement was applied\./,
  );

  assert.strictEqual(await ledger.getBalance(pool, payer), 1000, 'the first leg was applied anyway');

  const rows = await pool.query(
    'SELECT count(*)::int AS n FROM vaco.v3_balances WHERE user_id = ANY($1::text[])',
    [[ok, doomed]],
  );
  assert.strictEqual(rows.rows[0].n, 0,
    'a refused settlement created accounts for its payees — a rollback that did not roll back');
});

test('a later leg can spend what an earlier leg paid in', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // Same arithmetic as lib/vcoin.js's running Map: the middle account
  // starts with 1000, receives 1000, and pays out 1500.
  const [a, b, c] = [who('a'), who('b'), who('c')];
  const result = await ledger.settle(pool, {
    legs: [
      { fromUserId: a, toUserId: b, amount: 1000 },
      { fromUserId: b, toUserId: c, amount: 1500 },
    ],
  });
  assert.strictEqual(result.transactions.length, 2);
  assert.strictEqual(await ledger.getBalance(pool, a), 0);
  assert.strictEqual(await ledger.getBalance(pool, b), 500);
  assert.strictEqual(await ledger.getBalance(pool, c), 2500);
});

test('concurrent settlements out of one account cannot overdraw it', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const payer = who('payer');
  await ledger.getBalance(pool, payer);

  const attempts = Array.from({ length: 6 }, (_, i) => ledger.settle(pool, {
    legs: [{ fromUserId: payer, toUserId: who(`p${i}`), amount: 400 }],
  }));
  const results = await Promise.allSettled(attempts);
  const ok = results.filter((r) => r.status === 'fulfilled').length;

  assert.strictEqual(ok, 2, `${ok} settlements of 400 succeeded against a balance of 1000`);
  assert.strictEqual(await ledger.getBalance(pool, payer), 200);
});

// -- cashout --------------------------------------------------------------

test('an unseen VASH account is 0 and reading it creates nothing', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // VCoin opens at 1000 on first touch; VASH opens at 0 and is not
  // created by a read. Getting that wrong would hand everybody 1000 VASH.
  const a = who('a');
  assert.strictEqual(await ledger.getVashBalance(pool, a), 0);
  const rows = await pool.query(
    "SELECT count(*)::int AS n FROM vaco.v3_balances WHERE user_id = $1 AND currency = 'vash'",
    [a],
  );
  assert.strictEqual(rows.rows[0].n, 0, 'reading a VASH balance opened an account');
});

test('a cashout moves value across both currencies at once', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const a = who('a');
  const result = await ledger.cashout(pool, { userId: a, vcoinAmount: 500 });

  assert.strictEqual(result.vcoinDeducted, 500);
  assert.strictEqual(result.vashCredited, 5);       // 500 * 0.01
  assert.strictEqual(result.rate, 0.01);
  assert.strictEqual(result.newVcoinBalance, 500);
  assert.strictEqual(result.newVashBalance, 5);
  assert.strictEqual(await ledger.getBalance(pool, a), 500);
  assert.strictEqual(await ledger.getVashBalance(pool, a), 5);
});

test('a cashout beyond the balance moves neither currency', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const a = who('a');
  await ledger.getBalance(pool, a);
  await assert.rejects(
    () => ledger.cashout(pool, { userId: a, vcoinAmount: 5000 }),
    /Insufficient VCoin balance for cashout\./,
  );
  assert.strictEqual(await ledger.getBalance(pool, a), 1000);
  assert.strictEqual(await ledger.getVashBalance(pool, a), 0, 'a refused cashout credited VASH');
});

test('concurrent cashouts cannot mint VASH out of one balance', { skip: skip() }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const a = who('a');
  await ledger.getBalance(pool, a);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => ledger.cashout(pool, { userId: a, vcoinAmount: 400 })),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  assert.strictEqual(ok, 2, `${ok} cashouts of 400 succeeded against 1000`);
  assert.strictEqual(await ledger.getBalance(pool, a), 200);
  assert.strictEqual(await ledger.getVashBalance(pool, a), 8, 'VASH credited does not match VCoin debited');
});
