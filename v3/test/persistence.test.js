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

// ---------------------------------------------------------------------------
// The reactive walk, and two ways it used to end the process
// ---------------------------------------------------------------------------
//
// Both were found by a live crash in this app — the canonical ledger —
// while seeding demo content, not by reading the code:
//
//   RangeError: Maximum call stack size exceeded
//       at Object.set (lib/persistence.js:55:20)
//       at Object.set (lib/persistence.js:55:20)      ... and so on
//
// V3 answered a settlement with an HTML 500 stack page, and the calling
// app reported it as "Unexpected token '<', \"<!DOCTYPE \"... is not
// valid JSON" — a parse error standing in for a crashed ledger.
//
// `lib/persistence.js` is the shared durability layer: the same file
// runs in 28 apps. A stack overflow in it takes the process with it.

test('making an already-reactive value reactive again does not recurse', () => {
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ rows: [], index: {} }));
  store.rows.push({ id: 1, tags: ['a'] });

  // `reactive` walks children with `value[key] = reactive(value[key])`.
  // When `value` is itself a proxy that assignment fires its own `set`
  // trap, which calls `reactive` again, which assigns again. Nothing
  // stopped it.
  const row = store.rows[0];
  assert.doesNotThrow(() => { store.index.byId = row; });
  assert.doesNotThrow(() => { store.index.again = store.index.byId; });

  let nested = {};
  for (let i = 0; i < 50; i += 1) nested = { child: nested };
  assert.doesNotThrow(() => { store.index.deep = nested; });
  assert.doesNotThrow(() => { store.index.deepAgain = store.index.deep; });

  assert.equal(store.index.byId.id, 1, 'the value did not survive being stored');
});

test('one object stored in two places is fine, and stays one object', () => {
  // A shape that appears twice is not a cycle. JSON repeats it, which
  // serializes correctly, so it must not be refused — the cycle check
  // below has to be narrower than "have I seen this before".
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ index: {} }));
  const shared = { n: 1 };

  assert.doesNotThrow(() => { store.index.a = shared; store.index.b = shared; });
  commit(store);

  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(onDisk.index.a, { n: 1 });
  assert.deepEqual(onDisk.index.b, { n: 1 });
});

test('a value that references itself is refused, not accepted and then lost', () => {
  // **Three possible behaviours, and only one is usable.** Overflow the
  // stack (what it did); accept the value and fail at flush with
  // "Converting circular structure to JSON", writing nothing (what the
  // first version of the fix did — a silent loss on the debounced
  // path); or refuse at the assignment, naming the problem.
  const file = tempStorePath();
  const store = createPersistentStore(file, () => ({ rows: [], index: {} }));
  store.rows.push({ id: 1 });

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => { store.index.cyc = cyclic; },
    /reference back to itself/,
    'a cyclic value was accepted; it cannot be written as JSON, so the store would '
    + 'either crash or silently stop persisting',
  );

  const a = {};
  const b = {};
  a.b = b;
  b.a = a;
  assert.throws(() => { store.index.pair = a; }, /reference back to itself/);

  // And the store is still usable and still writes — a refused value
  // must not damage what was already there.
  assert.doesNotThrow(() => commit(store));
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(onDisk.rows.length, 1);
});
