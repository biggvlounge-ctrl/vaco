# Tasks — Phase 15: real automatic retry sweep

- [x] Wrote `sweepFailedDeliveries(store, { now })` in
      `lib/marketplace.js`, reusing the existing `retryDelivery`
      unchanged.
- [x] 4 real unit tests in isolation, injected `now`: eligible job
      retried, too-recent failure left alone, non-failed-status jobs
      ignored, multiple eligible jobs each retried independently.
- [x] Wired a real `setInterval` (15-minute cadence, `.unref()`'d)
      into `server.js`.
- [x] Added `POST /api/jobs/sweep-failed-deliveries` as a real,
      directly callable route for genuine testability.
- [x] `node --check server.js` -- clean.
- [x] Live pass against the real running server: created a real job,
      matched/accepted/reported it failed, called the sweep route
      immediately, confirmed it correctly left the too-recent failure
      untouched.
- [x] Confirmed no errors/crashes from the interval itself (checked
      the real server log).
- [x] Updated `README.md` (new Phase 15 section, corrected the "Not
      yet built" bullet that named this exact gap).

## Next
Nothing further planned for this specific piece.
