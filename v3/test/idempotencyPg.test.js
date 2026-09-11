// Idempotency keys in rows — and the case the in-memory version cannot
// handle: two containers receiving the same retry at once.
//
// Driven through a real Express app against a real Postgres, because
// the mechanism is an INSERT racing another INSERT and neither a stub
// database nor a direct function call can exhibit that.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const http = require('node:http');

const express = require('express');
const idem = require('../lib/idempotencyPg');

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
  if (!Pool) { SKIP = 'the pg package is not installed'; return; }
  pool = new Pool({ connectionString: URL_, max: 8 });
  try {
    await pool.query('SELECT 1');
    await idem.ensureSchema(pool);
  } catch (err) {
    SKIP = `no Postgres at ${URL_.replace(/:[^:@]*@/, ':***@')} (${err.message})`;
    await pool.end().catch(() => {});
    pool = null;
  }
});
test.after(async () => { if (pool) await pool.end(); });

let seq = 0;
const freshKey = () => `k-${process.pid}-${Date.now()}-${seq += 1}`;

// A real server, so the middleware runs in the place it actually runs.
// `calls` counts how many times the handler body executed, which is the
// only number that matters here.
function serve({ delayMs = 0, fail = false } = {}) {
  const state = { calls: 0 };
  const app = express();
  app.use(express.json());
  app.post('/charge', idem.idempotent(pool, 'charge'), async (req, res) => {
    state.calls += 1;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (fail) return res.status(400).json({ error: 'declined' });
    return res.status(201).json({ charged: req.body.amount });
  });
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => resolve({
      state,
      port: server.address().port,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

async function post(port, body, key) {
  const res = await fetch(`http://127.0.0.1:${port}/charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('a repeated key replays the first answer without re-running the work', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const s = await serve();
  try {
    const key = freshKey();
    const first = await post(s.port, { amount: 100 }, key);
    const second = await post(s.port, { amount: 100 }, key);

    assert.strictEqual(first.status, 201);
    assert.strictEqual(second.status, 201);
    assert.strictEqual(second.body.charged, 100);
    assert.strictEqual(second.body.idempotentReplay, true);
    assert.strictEqual(s.state.calls, 1, 'the handler ran twice for one idempotency key');
  } finally { await s.close(); }
});

test('a reused key with a different body is refused, not replayed', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const s = await serve();
  try {
    const key = freshKey();
    await post(s.port, { amount: 100 }, key);
    const changed = await post(s.port, { amount: 999 }, key);
    assert.strictEqual(changed.status, 422);
    assert.match(changed.body.error, /already used for a different request/);
    assert.strictEqual(s.state.calls, 1);
  } finally { await s.close(); }
});

test('no key means no idempotency — every request runs', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const s = await serve();
  try {
    await post(s.port, { amount: 1 });
    await post(s.port, { amount: 1 });
    assert.strictEqual(s.state.calls, 2);
  } finally { await s.close(); }
});

test('a failed request does not hold its key', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // Only completed operations are recorded. A caller retrying after a
  // genuine failure must be able to succeed.
  const failing = await serve({ fail: true });
  const key = freshKey();
  try {
    const declined = await post(failing.port, { amount: 5 }, key);
    assert.strictEqual(declined.status, 400);
  } finally { await failing.close(); }

  const working = await serve();
  try {
    const retried = await post(working.port, { amount: 5 }, key);
    assert.strictEqual(retried.status, 201, 'the failed attempt kept its key and blocked the retry');
    assert.strictEqual(working.state.calls, 1);
  } finally { await working.close(); }
});

// -- The reason this exists ----------------------------------------------

test('two servers receiving the same key at once execute it once', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  // Two independent Express apps on two ports sharing one database —
  // which is two V3 containers behind a load balancer. Both receive the
  // same retry simultaneously.
  //
  // The in-memory version cannot survive this at all: each process has
  // its own record list, so both find nothing, both charge, and the
  // caller pays twice. Here the key is claimed by an INSERT before any
  // work happens, so exactly one of them owns it.
  //
  // **What this test does and does not prove — stated because I checked.**
  //
  // It proves the observable contract: one execution across two servers,
  // and every other caller told something true rather than guessed at.
  //
  // It does NOT distinguish claim-first from check-then-act. Replacing
  // the atomic `INSERT ... ON CONFLICT DO NOTHING` with a SELECT
  // followed by an INSERT — the shape that is genuinely racy — still
  // passes, at two requests and at twelve, with and without the expiry
  // sweep that might have serialised them. Measured directly by counting
  // handler calls under both, not inferred from the test going green.
  //
  // The reason is that the window is microseconds wide: the first claim
  // completes long before the others arrive, so they read a row that is
  // already there. Reproducing it would need two OS processes started at
  // the same instant, or a fault injected between the select and the
  // insert, and a test that only fails with a deliberate delay spliced
  // into the implementation is testing the delay.
  //
  // So the safety here rests on the INSERT being one statement, which is
  // a property of Postgres rather than of this test. That is worth being
  // explicit about: an untested guarantee stated as a tested one is the
  // thing this repo keeps finding in its own tools.
  const a = await serve({ delayMs: 150 });
  const b = await serve({ delayMs: 150 });
  try {
    const key = freshKey();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => post(i % 2 === 0 ? a.port : b.port, { amount: 250 }, key)),
    );

    const total = a.state.calls + b.state.calls;
    assert.strictEqual(total, 1,
      `the handler ran ${total} times across two servers for one idempotency key — the caller was charged ${total} times`);

    // Exactly one did the work. Every other one must have been told
    // something true: in flight, or the finished answer.
    const created = results.filter((r) => r.status === 201 && !r.body.idempotentReplay);
    assert.strictEqual(created.length, 1, 'more than one request was told it had done the work');
    for (const r of results) {
      assert.ok([201, 409].includes(r.status), `unexpected status ${r.status}: ${JSON.stringify(r.body)}`);
      if (r.status === 409) assert.match(r.body.error, /already in flight|changed state/);
    }
  } finally { await a.close(); await b.close(); }
});

test('once the first finishes, the second gets the real answer', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const a = await serve();
  const b = await serve();
  try {
    const key = freshKey();
    const first = await post(a.port, { amount: 77 }, key);
    assert.strictEqual(first.status, 201);

    // Now the other container sees a completed key, not an in-flight one.
    const second = await post(b.port, { amount: 77 }, key);
    assert.strictEqual(second.status, 201);
    assert.strictEqual(second.body.charged, 77);
    assert.strictEqual(second.body.idempotentReplay, true);
    assert.strictEqual(b.state.calls, 0, 'the second container re-ran work the first had already done');
  } finally { await a.close(); await b.close(); }
});

test('expired keys are swept and stop replaying', { skip: SKIP }, async (t) => {
  if (SKIP) return t.skip(SKIP);
  const s = await serve();
  try {
    const key = freshKey();
    await post(s.port, { amount: 10 }, key);
    // Expire it by hand rather than waiting 24 hours.
    await pool.query("UPDATE vaco.v3_idempotency SET expires_at = now() - interval '1 minute' WHERE key = $1", [key]);

    const after = await post(s.port, { amount: 10 }, key);
    assert.strictEqual(after.status, 201);
    assert.notStrictEqual(after.body.idempotentReplay, true, 'an expired key still replayed');
    assert.strictEqual(s.state.calls, 2, 'an expired key should let the work run again');
  } finally { await s.close(); }
});
