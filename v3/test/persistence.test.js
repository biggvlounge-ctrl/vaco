// V3 -- durability of acknowledged writes.
//
// The bug these cover was demonstrated, not theorized. A cashout was
// issued against a running server, the server answered 201 with new
// balances, the process was killed inside the 200ms debounce window,
// and on restart the operation was gone -- VCoin back to 1000, VASH
// back to 0, while the caller had been told it succeeded.
//
// These tests read the persisted file straight off disk without
// waiting for any timer, so "did it actually commit" is answered by
// the filesystem rather than by a sleep.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createPersistentStore, commit, durable } = require('../lib/persistence');

function tempStorePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3-persist-'));
  return path.join(dir, 'store.json');
}

function readPersisted(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('an uncommitted mutation is NOT on disk yet -- the gap is real', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ vcoinBalances: { alice: 1000 } }));
  store.vcoinBalances.alice = 500;
  // Debounced, so nothing has been written. The file does not exist at
  // all yet, which is exactly the window the kill -9 landed in.
  assert.strictEqual(fs.existsSync(file), false);
});

test('commit() forces the mutation to disk immediately', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ vcoinBalances: { alice: 1000 } }));
  store.vcoinBalances.alice = 500;

  assert.strictEqual(commit(store), true);
  assert.strictEqual(readPersisted(file).vcoinBalances.alice, 500);
});

test('a committed store reloads with the committed values', () => {
  const file = tempStorePath();
  const createDefault = () => ({ vcoinBalances: { alice: 1000 }, vashBalances: {} });

  const store = createPersistentStore(file, createDefault);
  store.vcoinBalances.alice = 500;
  store.vashBalances.alice = 5;
  commit(store);

  // Simulates the restart after kill -9: build a fresh store from the
  // same file and confirm both sides of the cashout survived together.
  const reloaded = createPersistentStore(file, createDefault);
  assert.strictEqual(reloaded.vcoinBalances.alice, 500);
  assert.strictEqual(reloaded.vashBalances.alice, 5);
});

test('commit() on a plain non-persistent store is a quiet no-op', () => {
  // Tests and --no-persist runs build stores this way. Committing one
  // should not throw.
  assert.strictEqual(commit({ vcoinBalances: {} }), false);
});

// -- the durable() middleware -----------------------------------------

function fakeRes(statusCode) {
  const res = { statusCode, sent: null };
  res.json = (body) => { res.sent = body; return res; };
  return res;
}

test('durable() commits before a 2xx response is sent', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ vcoinBalances: { alice: 1000 } }));
  const res = fakeRes(201);

  durable(store)({ method: 'POST' }, res, () => {});
  store.vcoinBalances.alice = 500;
  res.json({ ok: true });

  // Written at response time, not on a timer.
  assert.strictEqual(readPersisted(file).vcoinBalances.alice, 500);
});

test('durable() does not commit on an error response', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ vcoinBalances: { alice: 1000 } }));
  const res = fakeRes(400);

  durable(store)({ method: 'POST' }, res, () => {});
  res.json({ error: 'insufficient balance' });

  // A rejected request changed nothing worth forcing to disk.
  assert.strictEqual(fs.existsSync(file), false);
});

test('durable() passes the handler response through unchanged', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({}));
  const res = fakeRes(200);

  durable(store)({ method: 'POST' }, res, () => {});
  res.json({ userId: 'alice', vashCredited: 5 });

  assert.deepStrictEqual(res.sent, { userId: 'alice', vashCredited: 5 });
});

test('durable() ignores GET -- a read changed nothing', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ vcoinBalances: { alice: 1000 } }));
  const res = fakeRes(200);
  let calledNext = false;

  durable(store)({ method: 'GET' }, res, () => { calledNext = true; });
  res.json({ balance: 1000 });

  assert.ok(calledNext);
  assert.strictEqual(fs.existsSync(file), false);
});

test('durable() commits on every mutating method, not just POST', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const file = tempStorePath();
    const store = createPersistentStore(file, () => ({ n: 0 }));
    const res = fakeRes(200);
    durable(store)({ method }, res, () => {});
    store.n = 1;
    res.json({ ok: true });
    assert.strictEqual(readPersisted(file).n, 1, `${method} should commit`);
  }
});
