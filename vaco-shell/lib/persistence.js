// VACO — file persistence for the shell store.
//
// **An ESM port of `v3/lib/persistence.js`, not a new design.** That
// file is the ecosystem's persistence layer and 24 apps run on it; the
// only reason this copy exists is that they are CommonJS and
// `vaco-shell` is `"type": "module"`. Behaviour is deliberately
// identical — recursive Proxy, 200ms debounce, tmp-then-rename write,
// synchronous flush on SIGTERM/SIGINT, and the same `commit`/`durable`
// pair. If that file changes, this one should change with it.
//
// **Why the shell needs durability at all**, when its sibling ESM app
// (`v4-proxy`) deliberately went without: V4 holds call sessions, which
// are meaningless after a restart. The shell now holds *entitlements
// and orders*. A purchase that moved real VCoin through V3 and then
// vanished on restart is the worst failure this store can produce —
// the money is gone from the ledger and the thing it bought is not.
// That is exactly the case `commit` was written for.

import fs from 'node:fs';
import path from 'node:path';

const FLUSHERS = new WeakMap();

function reactive(value, onChange) {
  if (value === null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) {
    value[key] = reactive(value[key], onChange);
  }
  return new Proxy(value, {
    set(target, prop, next) {
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

export function createPersistentStore(filePath, createDefault, { debounceMs = 200 } = {}) {
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

export function commit(store) {
  const flush = FLUSHERS.get(store);
  if (!flush) return false;
  flush();
  return true;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function durable(store) {
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
