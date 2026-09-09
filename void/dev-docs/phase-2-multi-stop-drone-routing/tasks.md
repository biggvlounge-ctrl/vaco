# Tasks — Phase 2: Multi-Stop Drone Routing (TSP-D / VRP-D)

- [x] Create `lib/noFlyZones.js`: `registerNoFlyZone`, `getNoFlyZones`.
- [x] Create `lib/droneRouting.js`: `OPTIMIZATION_MODES`,
      `routeDistanceKm`, `optimizeStopSequence` (nearest-neighbor +
      2-opt), `buildRoute`, `getRoute`, `groupOrdersIntoRoutes`.
- [x] Extend `createVoidStore()` (in `store.js`) with
      `noFlyZones`/`nextNoFlyZoneId`/`droneRoutes`/`nextRouteId`.
- [x] Wire `server.js`: 5 new endpoints (`POST /api/no-fly-zone`,
      `GET /api/no-fly-zones`, `POST /api/drone-route`,
      `GET /api/drone-route/:id`, `POST /api/drone-route/group`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 16 checks, all passed after fixing one
      test-script arithmetic bug, no real app bugs found):
      - `optimizeStopSequence` matched the **true brute-force optimal**
        (checked against all 120 permutations of a real scattered
        5-stop case), not just a plausible-looking route.
      - `optimizeStopSequence` handles 0 and 1 stops without error.
      - `buildRoute`: rejects missing `droneId`/`originHubId`, empty
        `stops`, invalid `optimizedFor`, non-positive
        `maxPayloadCapacity`/`maxRangeKm`, and a stop missing
        `orderId`/`deliveryLocation`/`payloadWeight`; rejects payload
        over capacity; rejects a route over range; succeeds and builds
        a real, valid route with correct `sequenceIndex` assignment.
      - `buildRoute` correctly rejects a route passing within a
        registered no-fly zone, and correctly succeeds when the route
        avoids one.
      - `groupOrdersIntoRoutes`: correctly splits a payload-heavy
        candidate pool across 2 drones with 0 unassigned when
        capacity/order count divide evenly; correctly reports orders
        unassigned once the drone fleet runs out; correctly marks a
        single order that alone exceeds capacity, or alone exceeds
        range, as unassigned rather than crashing.
      - One test-script bug found and fixed (not an app bug): the
        first grouping test used 5 orders × 6 payload against 2 drones
        of 15 capacity each — arithmetically impossible to fit all 5
        (2 drones can carry 2 full orders each = 12, not 3 = 18 > 15),
        so the app correctly reported 1 unassigned; the test's own
        expectation was wrong, fixed by using 5 orders × 5 payload
        (which divides evenly: 3+2 across the two drones).
- [x] Verify live with `void/server.js` running alone:
      - A real 3-stop route built through the actual HTTP API —
        optimizer picked a real, non-trivial sequence
        (`o3 → o1 → o2`), `estimatedRangeUsed: 10.14`km.
      - A no-fly zone registered ~0.9km from the origin hub correctly
        rejected every subsequent route from that hub — confirmed this
        is real, correct behavior (the zone's 3km radius genuinely
        engulfs the launch point), not a bug, by restarting with a
        clean store and re-confirming clean routes build successfully
        without it.
      - A 5-order candidate pool correctly split across 2 drones via
        `POST /api/drone-route/group` by real proximity clustering (3
        nearby orders to one drone, 2 nearby orders to the other), 0
        unassigned; both resulting routes independently confirmed
        retrievable via `GET /api/drone-route/:id`.
      - One process-lifecycle issue hit during this pass (environment
        note, not an app bug): an earlier restart attempt returned a
        non-zero exit code from the harness before completing, leaving
        the *previous* server process still bound to the port; the
        "fresh" store observed afterward was actually the old process's
        accumulated state (the earlier no-fly zone). Resolved by
        killing the exact PID and confirming the port was genuinely
        closed (curl connection-refused) before restarting — the
        grouping test was then re-run and passed cleanly against a
        verified-empty store.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`
      that the port no longer accepted connections.
- [x] Commit as its own change.

## Next
Phase 3: Service Marketplace / Verticals engine — the request → match
→ accept → complete → pay → rate loop applied across the 18+ named
verticals, using the real per-vertical pricing units and take rates
from `VOID_SERVICE_VERTICALS_COMPARABLES.md`.
