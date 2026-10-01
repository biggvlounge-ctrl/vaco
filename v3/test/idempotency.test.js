// V3 -- idempotency for the money routes, in-memory version.
//
// This file had no test coverage at all before now -- only the
// Postgres-backed sibling (`idempotencyPg.js`, which exists for a
// cross-container race this version does not need to handle) had a
// test file. That gap is exactly how `fingerprint`'s own bug (see
// `lib/idempotency.js`'s header) went unnoticed: `JSON.stringify(body,
// Object.keys(body).sort())` silently dropped every leg's own fields
// out of a settle request's fingerprint, so two settlements with the
// same route and reason but genuinely different amounts/recipients
// fingerprinted identically -- a reused key replayed the FIRST
// settlement's result instead of hitting the 422 "different request"
// guard this file's own header promises.
//
// No subprocess, no database: the in-memory version has no race a
// direct Express app in this same process cannot exhibit (that is
// `idempotencyPg.test.js`'s own stated reason for spawning one).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createV3Store } = require('../lib/store');
const idem = require('../lib/idempotency');

let nextKey = 1;
function freshKey() { return `test-key-${nextKey++}`; }

// A tiny app standing in for a real settle/transfer route: it records
// every call and echoes the body back, so a test can both assert on
// the HTTP response and on how many times the handler actually ran.
function buildApp(store) {
  const app = express();
  app.use(express.json());
  app.set('v3Store', store);
  const calls = [];
  app.post('/api/pretend-settle', idem.idempotent('pretend-settle'), (req, res) => {
    calls.push(req.body);
    res.status(201).json({ ok: true, echoed: req.body });
  });
  app.post('/api/pretend-fail', idem.idempotent('pretend-fail'), (req, res) => {
    calls.push(req.body);
    res.status(400).json({ error: 'deliberate failure' });
  });
  return { app, calls };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function post(port, path, body, key) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// -- stableStringify / fingerprint -------------------------------------

test('stableStringify captures nested object content, not just top-level keys', () => {
  // The exact bug: the old fingerprint used an array replacer, which
  // JSON.stringify applies at every nesting level -- so a settle
  // request's own legs (nested objects) were stripped to `{}` each,
  // and two different payouts fingerprinted the same.
  const a = idem.stableStringify({ legs: [{ fromUserId: 'a', toUserId: 'b', amount: 100 }], reason: 'x' });
  const b = idem.stableStringify({ legs: [{ fromUserId: 'a', toUserId: 'b', amount: 99999 }], reason: 'x' });
  assert.notStrictEqual(a, b, 'two different leg amounts stringified identically');
  assert.match(a, /100/);
  assert.match(b, /99999/);
});

test('stableStringify is order-independent at every nesting level', () => {
  const a = idem.stableStringify({ b: 2, a: { y: 2, x: 1 } });
  const b = idem.stableStringify({ a: { x: 1, y: 2 }, b: 2 });
  assert.strictEqual(a, b, 'logically identical bodies with reordered keys fingerprinted differently');
});

test('fingerprint actually differs for two settlements with different leg amounts', () => {
  // The direct regression for the bug found auditing
  // hvntz/lib/revenueShareAgreements.js#distributeRevenue, which reuses
  // one Idempotency-Key per AGREEMENT (not per distribution) and relies
  // entirely on this fingerprint mismatch to refuse a genuinely
  // different second settlement rather than silently replaying the
  // first one's result.
  const first = idem.fingerprint('settle', { legs: [{ fromUserId: 'a', toUserId: 'b', amount: 100 }], reason: 'r' });
  const second = idem.fingerprint('settle', { legs: [{ fromUserId: 'a', toUserId: 'b', amount: 50 }], reason: 'r' });
  assert.notStrictEqual(first, second,
    'two settlements that pay different amounts fingerprinted the same -- a reused key would silently replay the wrong one');
});

// -- the middleware, end to end -----------------------------------------

test('a repeated key replays the first answer without re-running the work', async () => {
  const store = createV3Store();
  const { app, calls } = buildApp(store);
  const server = await listen(app);
  try {
    const key = freshKey();
    const first = await post(server.address().port, '/api/pretend-settle', { amount: 100 }, key);
    const second = await post(server.address().port, '/api/pretend-settle', { amount: 100 }, key);

    assert.strictEqual(first.status, 201);
    assert.strictEqual(second.status, 201);
    assert.strictEqual(second.body.idempotentReplay, true);
    assert.strictEqual(calls.length, 1, 'the handler ran twice for one idempotency key');
  } finally {
    server.close();
  }
});

test('a reused key with a different body is refused, not replayed — the bug this file closes', async () => {
  const store = createV3Store();
  const { app, calls } = buildApp(store);
  const server = await listen(app);
  try {
    const key = freshKey();
    await post(server.address().port, '/api/pretend-settle', {
      legs: [{ fromUserId: 'a', toUserId: 'b', amount: 100 }], reason: 'r',
    }, key);
    const changed = await post(server.address().port, '/api/pretend-settle', {
      legs: [{ fromUserId: 'a', toUserId: 'b', amount: 99999 }], reason: 'r',
    }, key);

    assert.strictEqual(changed.status, 422,
      `a reused key with genuinely different leg amounts was not refused (got ${changed.status}) -- `
      + 'this is exactly the silent-replay bug the fingerprint fix closes');
    assert.match(changed.body.error, /already used for a different request/);
    assert.strictEqual(calls.length, 1);
  } finally {
    server.close();
  }
});

test('no key means no idempotency — every request runs', async () => {
  const store = createV3Store();
  const { app, calls } = buildApp(store);
  const server = await listen(app);
  try {
    await post(server.address().port, '/api/pretend-settle', { amount: 1 });
    await post(server.address().port, '/api/pretend-settle', { amount: 1 });
    assert.strictEqual(calls.length, 2);
  } finally {
    server.close();
  }
});

test('a failed request does not hold its key — a retry after genuine failure can still succeed', async () => {
  const store = createV3Store();
  const { app, calls } = buildApp(store);
  const server = await listen(app);
  try {
    const key = freshKey();
    const failed = await post(server.address().port, '/api/pretend-fail', { amount: 1 }, key);
    assert.strictEqual(failed.status, 400);

    // Re-tried on the SUCCEEDING route with the same key -- a failure
    // must not have claimed the key, so this second attempt runs for
    // real rather than being refused or replayed.
    const retried = await post(server.address().port, '/api/pretend-settle', { amount: 1 }, key);
    assert.strictEqual(retried.status, 201);
    assert.strictEqual(retried.body.idempotentReplay, undefined, 'a failed attempt still replayed on retry');
    assert.strictEqual(calls.length, 2, 'both the failed attempt and the real retry should have run the handler');
  } finally {
    server.close();
  }
});

test('expired keys are swept and stop replaying', async () => {
  const store = createV3Store();
  const { app, calls } = buildApp(store);
  const server = await listen(app);
  try {
    const key = freshKey();
    const now = Date.now();
    await post(server.address().port, '/api/pretend-settle', { amount: 1 }, key);
    // Back-date the stored record past its own retention window rather
    // than waiting a real 24 hours.
    const record = store.idempotencyRecords.find((r) => r.key === key);
    record.expiresAt = now - 1000;

    const after = await post(server.address().port, '/api/pretend-settle', { amount: 1 }, key);
    assert.strictEqual(after.status, 201);
    assert.strictEqual(after.body.idempotentReplay, undefined, 'an expired key still replayed');
    assert.strictEqual(calls.length, 2);
  } finally {
    server.close();
  }
});
