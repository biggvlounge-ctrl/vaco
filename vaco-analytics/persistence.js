// Real, minimal file persistence for an in-memory store object -- ESM
// variant of the same module duplicated (CommonJS) across every other
// app in this ecosystem; see any of those apps' own `lib/persistence.js`
// header for the full rationale. Loads store.json on startup if
// present (shallow-merged over a fresh default, so a store shape that
// grows a new top-level field in a later session doesn't crash on an
// older persisted file); after that, every real mutation anywhere in
// the store tree is caught via a recursive Proxy and debounce-flushed
// to disk -- no call site in `metricsStore.js`/`intelligence.js` had
// to change to opt in.

import fs from "node:fs";
import path from "node:path";

function reactive(value, onChange) {
  if (value === null || typeof value !== "object") return value;
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
    const raw = fs.readFileSync(filePath, "utf8");
    const loaded = JSON.parse(raw);
    return { ...fresh, ...loaded };
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
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
    if (typeof timer.unref === "function") timer.unref();
  }
  store = reactive(initial, scheduleSave);

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    writeStore(filePath, store);
  }
  process.on("SIGTERM", () => { flush(); process.exit(0); });
  process.on("SIGINT", () => { flush(); process.exit(0); });

  return store;
}
