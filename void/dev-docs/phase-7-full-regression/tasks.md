# Tasks — Phase 7: Full cross-phase regression

- [x] Write one comprehensive regression script exercising all six
      phases against a single shared `createVoidStore()` in a
      connected, realistic scenario (throwaway `.cjs`, deleted after
      — 16 checks, all passed after fixing one test-script bug):
      - Phase 1: a real 3-station network in one region, network
        density reflecting the real registered stations.
      - Phase 2: a real multi-stop drone route built using Phase 1's
        actual station coordinates as delivery stops; a real VRP-D
        grouping call correctly split two payload-exceeding orders
        into 2 separate routes, both within range (fixed one
        test-script bug: an order placed too far from origin correctly
        triggered the app's real unassigned-order handling instead of
        the test's wrong assumption that both orders would each form
        their own route).
      - Phase 4: a real vehicle capacity profile and trip declaration
        registered for the same region's ground fleet; capacity fit
        and dynamic cargo pricing both correct on the shared store;
        sequencing still correct alongside everything else registered.
      - Phase 3: a real marketplace job requested, matched, accepted,
        completed with a correct real payout on the shared ledger, and
        rated.
      - Phase 5: all four scheduling surfaces (Reserve match +
        cancellation-fee window, Commute batch match, Dedicated Lane +
        Spot Load, Hourly charge computation) all correct on the same
        shared store.
      - Phase 6: Gibson's air-vs-ground and load-intelligence rules,
        Kyle's dead-time recommendation, a real relay path found across
        the *same* Phase 1 stations already in the store, a VOID Direct
        manifest creating a *second* marketplace job confirmed to have
        a distinct id from the earlier Phase 3 job (no collision), and
        affiliate stations correctly referencing the real Phase 1
        station IDs and sorting correctly.
      - Final sanity check: every top-level store collection
        (`stations`, `droneRoutes`, `jobs`, `tripDeclarations`,
        `reserveBookings`, `commuteBatches`, `dedicatedLanes`,
        `spotLoads`, `hourlyBookings`, `externalBusinesses`,
        `deliveryManifests`, `affiliateStations`) holds exactly the
        expected count — no cross-module interference, no leaked or
        duplicated records.
- [x] Live smoke pass: `void/server.js` started fresh (all six phases'
      modules wired together) confirmed a clean startup with no
      import/wiring errors, and `/api/health` correctly reflected data
      from every phase in one response.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`
      that the port no longer accepted connections.
- [x] Commit as its own change.

## Next
Final delivery: zip the complete `void/` project and re-deliver the
consolidated `vaco-repo-complete.zip` including it, matching this
session's established delivery pattern (GitHub push is blocked by a
403 GitHub App permission error — the user unzips locally and uploads
via GitHub Desktop).
