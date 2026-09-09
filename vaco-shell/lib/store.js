// VACO — the shell's store.
//
// The shell had none until now, and did not need one: a launcher that
// reads a static registry and proxies sessions to Shield holds no
// state of its own. The App Store and the Merch Store are the first
// features that do, and both hold state that outliving a restart is
// the whole point of — what a user owns, and what has been ordered.
//
// `createShellStore` is exported separately from the persistent one so
// tests can run the same modules against a plain object with no file
// on disk. That is the pattern every other app here uses.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPersistentStore } from './persistence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createShellStore() {
  return {
    // App Store — commerce over the registry. A listing points at a
    // registry app by id; the registry stays the source of truth for
    // what an app IS.
    listings: [],
    entitlements: [],

    // VACO Merch — one storefront across every app brand.
    merchProducts: [],
    merchOrders: [],
    nextMerchOrderId: 1,
  };
}

export function createPersistentShellStore() {
  return createPersistentStore(
    path.join(__dirname, '..', 'data', 'store.json'),
    createShellStore,
  );
}
