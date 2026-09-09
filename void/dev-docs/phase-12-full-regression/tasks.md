# Tasks — Phase 12: Full cross-phase regression (Phases 1–11)

- [x] Write one comprehensive regression script exercising all eleven
      phases against a single shared `createVoidStore()` (throwaway
      `.cjs`, deleted after — 8 checks, all passed after fixing one
      test-script bug):
      - Phase 1/2: a temperature-controlled station and a real drone
        route coexist correctly on the shared store.
      - Phase 8: a gig driver and VOID DSP registered; a real
        marketplace job driven through a genuine
        report-failed → early-retry-rejected (implicitly, via the
        real 24-hour gate already proven in Phase 8's own tests) →
        successful-retry → completion cycle, with the resulting real
        payout confirmed on the ledger.
      - Phase 9: the `foodDelivery` vertical's real, tighter delivery
        window proven to actually change `decideAirVsGround`'s real
        decision (forces air), not just exist unused; a transparent-
        kitchen stream registered and confirmed.
      - Phase 10: a moving job and a real estate media job both
        confirmed to produce marketplace job ids distinct from each
        other and from the earlier courier/food jobs — no collisions
        across four different job-creation entry points writing into
        the same collection.
      - Phase 11: a hub-originated shipment resolved to real
        fulfillment; a locker explicitly linked to the real Phase 1
        station (`stationId`); the full Locker-to-Door lifecycle
        (deposit → request → assign → retrieve with the real access
        code → complete) run to completion on the shared store, with
        the freed compartment independently re-checked.
      - Final sanity: every top-level store collection
        (`stations`, `droneRoutes`, `jobs`, `gigDrivers`, `voidDSPs`,
        `kitchenStreams`, `movingJobs`, `realEstateMediaJobs`,
        `hubOriginatedShipments`, `voidLockers`,
        `lockerToDoorRequests`) holds exactly the expected count.
      - One test-script bug found and fixed (not an app bug): an
        assertion read a `LockerToDoorRequest` object's `.status`
        *after* `completeLockerToDoorDelivery` had already mutated
        that same object reference to `'delivered'` — the app was
        correct, the test's assumption about when to read the value
        was wrong. Fixed by capturing the status immediately after
        retrieval, before the completion call.
- [x] Live smoke pass: `void/server.js` started fresh with all eleven
      phases' modules wired together, confirmed a clean startup and a
      complete, correct `/api/health` response covering every phase.
- [x] Shut down cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Final delivery: zip the complete `void/` project (now 11 phases, 168
plain-Node checks) and re-deliver the consolidated
`vaco-repo-complete.zip`. Then begin VOKEN from scratch.
