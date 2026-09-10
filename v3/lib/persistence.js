// Real, minimal file persistence for an in-memory store object. Loads
// store.json on startup if present (shallow-merged over a fresh
// default, so a store shape that grows a new top-level field in a
// later session doesn't crash trying to load an older persisted
// file); after that, every real mutation anywhere in the store tree
// (a top-level field set, a nested array push/splice, a deep object
// field set) is caught via a recursive Proxy and debounce-flushed to
// disk -- no call site in any lib/*.js file has to change to opt in.

// **Durability, and a correction to what this file used to imply.**
//
// The debounce below is correct for ordinary state, and the atomicity
// people worry about is already handled: every mutation path in this
// repo is synchronous, Node is single-threaded, and `writeStore` does
// write-to-temp-then-rename. A crash cannot land between two lines of
// a transfer, and a half-written JSON file cannot be observed.
//
// What the debounce *does* cost is durability of acknowledged writes,
// and that was demonstrated rather than reasoned about. A cashout was
// issued, the server answered 201 with the new balances, the process
// was killed inside the 200ms window, and on restart the whole
// operation was gone -- VCoin back to 1000, VASH back to 0. Balances
// were consistent, which is the saving grace; nothing was created or
// destroyed. But the caller had been told it happened.
//
// `commit(store)` is the fix: flush synchronously *before* answering,
// on the routes where a lost-but-acknowledged write actually matters.
// It is deliberately not the default -- forcing a disk write on every
// mutation would make analytics ingestion and feed writes pay for a
// guarantee they do not need. Money pays for it; signals do not. Same
// "fail soft on signals, hard on money" line the rest of the repo
// draws.
//
// Scope, stated honestly: this closes process death (kill -9, OOM,
// container restart), which is the realistic case here. It does not
// claim to survive sudden power loss -- that needs an fsync of the
// file and its directory, and `renameSync` alone does not give it.

const fs = require('fs');
const path = require('path');

// Maps a live store back to its own flush function. A WeakMap rather
// than a field on the store itself, so `commit` can be added without
// changing the shape of a store that 26 apps already construct, and
// without a stray enumerable key showing up in the persisted JSON.
const FLUSHERS = new WeakMap();

// Every proxy this has ever produced. Two bugs need it, and both were
// found by a crash in V3 -- the canonical ledger -- rather than by
// reading this code:
//
//   RangeError: Maximum call stack size exceeded
//       at Object.set (lib/persistence.js:55:20)
//       at Object.set (lib/persistence.js:55:20)     ... and so on
//
// **Re-wrapping a live proxy re-enters its own trap.** `reactive`
// walks children with `value[key] = reactive(value[key])`. When
// `value` is already a proxy that assignment fires its own `set`
// trap, which calls `reactive` again, which walks and assigns again.
// Nothing stops it. The ledger answered a settlement with an HTML 500
// stack page.
//
// **A cyclic object walks forever.** `o.self = o` recurses until the
// stack ends, for the same reason and by a different route.
//
// Both are fixed by remembering: a value that is already reactive is
// returned as-is, and a value being made reactive registers its proxy
// BEFORE its children are walked, so a child pointing back at its
// parent finds the finished proxy instead of starting again.
const REACTIVE = new WeakSet();

function reactive(value, onChange, seen) {
  if (value === null || typeof value !== 'object') return value;

  // Already reactive: hand it back untouched. Wrapping a proxy in a
  // proxy is what produced the infinite `set` chain above, and it was
  // never useful even when it terminated -- two layers of trap firing
  // onChange twice for one mutation.
  if (REACTIVE.has(value)) return value;

  const visited = seen || { proxies: new WeakMap(), ancestors: new Set() };

  // **Order matters here, and getting it wrong made the check useless.**
  // The cycle test must come BEFORE the already-seen test. With the
  // seen-test first, a cycle finds the proxy its own ancestor already
  // registered, returns it, and is accepted silently -- which is
  // exactly what happened on the first attempt at this fix.
  //
  // A cycle is refused rather than accepted.
  //
  // The first version of this fix made cycles stop crashing, which
  // turned a loud failure into a quiet one: the assignment appeared to
  // succeed, and then `JSON.stringify` threw "Converting circular
  // structure to JSON" at flush time and the store silently never
  // reached disk. On the debounced path that failure is asynchronous
  // and nobody sees it.
  //
  // A store that cannot be serialized cannot be persisted, so the
  // value is rejected at the line that assigns it, naming what is
  // wrong. That is the only one of the three behaviours -- crash,
  // silent data loss, clear refusal -- that a caller can act on.
  if (visited.ancestors.has(value)) {
    throw new TypeError(
      'persistence: refusing to store a value that contains a reference back to itself. '
      + 'The store is written as JSON, so a cycle cannot be persisted -- it would either '
      + 'overflow the stack here or fail at flush time and silently lose the write.',
    );
  }

  // Seen elsewhere in this walk but not an ancestor: an ordinary shape,
  // one object referenced from two places. It serializes fine -- JSON
  // simply repeats it -- so hand back the same proxy.
  if (visited.proxies.has(value)) return visited.proxies.get(value);

  const proxy = new Proxy(value, {
    set(target, prop, next) {
      // `target` is the raw object, so this assignment does not
      // re-enter this trap. `next` may be anything, including
      // something already reactive, which the guard above now handles.
      target[prop] = reactive(next, onChange);
      onChange();
      return true;
    },
    deleteProperty(target, prop) {
      delete target[prop];
      onChange();
      return true;
    },
  });

  // Registered before the walk, not after: a cycle reaching back here
  // must find this proxy rather than begin a second one.
  REACTIVE.add(proxy);
  visited.proxies.set(value, proxy);

  // On the ancestor stack while its children are walked, off it after.
  // Membership means "this object is an ancestor of the one being
  // walked right now", which is what makes it a cycle rather than a
  // shape that merely appears twice.
  visited.ancestors.add(value);
  try {
    for (const key of Object.keys(value)) {
      value[key] = reactive(value[key], onChange, visited);
    }
  } finally {
    visited.ancestors.delete(value);
  }
  return proxy;
}

function loadOrCreate(filePath, createDefault) {
  const fresh = createDefault();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const loaded = JSON.parse(raw);
    return { ...fresh, ...loaded };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return fresh;
  }
}

function writeStore(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store));
  fs.renameSync(tmpPath, filePath);
}

// Real, deliberately short debounce -- flushes at most once per
// 200ms of mutation activity rather than on every single push/set,
// while still surviving anything but a hard `kill -9`: SIGTERM/SIGINT
// are both handled with a synchronous final flush before exit.
function createPersistentStore(filePath, createDefault, { debounceMs = 200 } = {}) {
  const initial = loadOrCreate(filePath, createDefault);
  let timer = null;
  let store;
  function scheduleSave() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      writeStore(filePath, store);
    }, debounceMs);
    if (typeof timer.unref === 'function') timer.unref();
  }
  store = reactive(initial, scheduleSave);

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    writeStore(filePath, store);
  }
  process.on('SIGTERM', () => { flush(); process.exit(0); });
  process.on('SIGINT', () => { flush(); process.exit(0); });

  FLUSHERS.set(store, flush);
  return store;
}

// Forces a store to disk right now, cancelling any pending debounce.
// Call it after a money mutation and before responding.
//
// Returns true if it actually wrote, false if this store has no
// persistence attached. That false is a real case, not a defensive
// nicety: several apps build a plain in-memory store in tests and in
// `--no-persist` runs, and a commit there should be a quiet no-op
// rather than a crash. Callers that need to know can check.
function commit(store) {
  const flush = FLUSHERS.get(store);
  if (!flush) return false;
  flush();
  return true;
}

// Express middleware: commit before the response goes out. Mounted
// app-wide with `app.use(durable(store))`, right after the store is
// built and before the routes.
//
// Wrapping `res.json` rather than asking each handler to remember a
// call is the point -- a durability guarantee that depends on every
// future handler author remembering it is not a guarantee.
//
// **Why app-wide instead of only the money routes**, which was the
// first instinct. Picking the routes by hand meant auditing 63
// candidates across 16 servers, several of which only *looked* like
// money (`POST /api/unfollow` matched a value keyword on a nearby
// line). One missed route is a silent hole, and every route added
// later is another chance to miss. So the cost was measured instead
// of assumed: the largest live store in the repo is 10.4 KB, and a
// full write at that size is under 0.13 ms. At ~1000 records / 114 KB
// it is 0.55 ms. That is cheap enough that being exhaustive beats
// being clever.
//
//: Flagged interpretive, and the number that matters if this is ever
//: revisited: cost scales with total store size, not with the size of
//: the change. Measured on this machine at 10k records / 1.1 MB it is
//: ~4.9 ms, and at 50k / 6 MB it is ~30 ms. Somewhere past a megabyte
//: per store, this should become append-only or move to SQLite
//: (`node:sqlite` is in Node 22's standard library, no package
//: needed). Below that, whole-file writes are the simpler correct
//: thing.
//
// Only mutating methods commit -- a GET changed nothing. Only 2xx
// commits -- a rejected request changed nothing worth forcing to disk.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function durable(store) {
  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) return next();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) commit(store);
      return originalJson(body);
    };
    return next();
  };
}

module.exports = { createPersistentStore, commit, durable };
