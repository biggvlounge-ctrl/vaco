# Tasks — Phase 2 (fourth slice): Creator Analytics

- [x] Create `lib/creatorAnalytics.js`: `getCreatorAnalytics(store, hostId)`
      computing 12 real metrics plus a `notComputable` list naming the
      6 that genuinely aren't derivable from this codebase's data.
- [x] Wire `server.js`: `GET /api/creators/:hostId/analytics`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 18 checks, one real test bug caught and fixed mid-
      verification -- see below): zeroed stats for a host with no
      data; `attendanceRate` null rather than 0 when uncomputable; a
      real multi-booking, multi-experience, one-no-show, one-repeat-
      customer scenario proven correct metric-by-metric, including
      `creatorEarnings` matching the real settlement formula exactly;
      isolation between hosts confirmed.
- [x] Verify live with VOID MAGIC, VOID, and the V3 mock all running
      independently: the same real scenario run against the actual
      server, confirmed to match the plain-Node results exactly
      (grossRevenue 200, creatorEarnings 169, attendanceRate 0.5,
      repeatCustomerCount 1, real event service usage counts).
- [x] Shut down all three servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Bug fixed during verification
The verification script itself (not the real module) asserted
`staffing === 2` after requesting one `security` service twice and one
`staffing` service once -- a test-authoring mistake, not a code bug.
Fixed the assertion to `staffing === 1`; the real `eventServiceUsage`
counts were correct throughout.

## Next
Customer profiles, Advanced scheduling, Geofencing, Media -- the rest
of Phase 2, each its own real, later slice.
