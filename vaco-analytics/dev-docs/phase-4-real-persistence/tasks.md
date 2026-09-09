# Tasks — Phase 4: real persistence

- [x] Wire `lib/persistence.js` into `server.js`: `create*Store()`
      -> `createPersistentStore(path.join(__dirname, 'data',
      'store.json'), create*Store)`.
- [x] `node --check server.js` -- confirmed no syntax error from the
      wiring change.
- [x] Booted the real app (port 8790), confirmed `/api/health`
      still returns 200.
- [x] Ingested a real metric event.
- [x] Confirmed the real mutation landed in `data/store.json` on
      disk.
- [x] Killed the running process, restarted it fresh, confirmed the
      same real state came back via a real GET -- actual
      restart-survival, checked directly.
- [x] Cleaned up the test-run `data/` directory afterward (runtime
      state, gitignored, not meant to ship).

## Next
Nothing further planned for this specific piece -- the same generic
module is now wired into every real app in this ecosystem that holds
meaningful mutable state (VACON-C already had its own real Postgres
layer from an earlier phase; v4-proxy/v4-search/vaco-shell hold no
meaningful accumulating state of their own to persist).
