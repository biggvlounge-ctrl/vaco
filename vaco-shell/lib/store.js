// VACO — the shell's store.
//
// The shell had none until now, and did not need one: a launcher that
// reads a static registry and proxies sessions to Shield holds no
// state of its own. The App Store and the Merch Store are the first
// features that do, and both hold state that outliving a restart is
// the whole point of — what a user owns, and what has been ordered.
//
// `createShellStore` is the plain factory, run against a plain object
// with no file on disk in tests. `server.js` builds the real,
// persistent one through `lib/storeBackend.js`'s `attachStore` now —
// whichever backend DATABASE_URL selects — rather than through a
// second, file-only wrapper here.

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
