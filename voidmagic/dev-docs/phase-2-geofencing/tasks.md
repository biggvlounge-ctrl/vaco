# Tasks — Phase 2 (eighth slice): Geofencing

- [x] Add optional `geofence` field + validation to
      `experiences.js`'s `createExperience`.
- [x] Add `arrivedAt: null` to the booking shape in `bookings.js`.
- [x] Create `lib/geofencing.js`: `haversineMeters`,
      `isWithinGeofence`, `verifyArrival`.
- [x] Wire `server.js`: `POST /api/bookings/:id/verify-arrival`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- part of the shared 27-check run with Media above, one
      test-authoring bug caught and fixed, see below): distance-zero
      for identical points; real ~111.19km value for 1 degree of
      longitude at the equator; no-geofence-configured throws;
      geofence field round-trips; in/out-of-radius both classified
      correctly; arrival rejected out-of-zone (leaving `arrivedAt`
      null) and accepted in-zone; malformed geofence rejected at
      creation.
- [x] Verify live with `voidmagic/server.js` and `venvs-mock-backend`
      running independently: a real geofenced experience, a rejected
      far-away arrival attempt, an accepted in-zone attempt, all
      confirmed against the actual running server.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change (combined with Media).

## Bug fixed during verification
The verification script itself scheduled two experiences for the same
host with overlapping time windows (a real double-booking, correctly
caught by Phase 2's own double-booking guard from an earlier slice) --
not a Geofencing bug, a test-authoring mistake. Fixed by spacing the
two experiences' `scheduledAt` values far enough apart.

## Next
Real credential-activation and alerting infrastructure for the VIP/
security geofencing examples, if ever prioritized -- genuinely
separate, later work needing live infrastructure this phase doesn't
build.
