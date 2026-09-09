# Tasks — Phase 2: Digital Twin, Neighbor Program, CVNVO placement

- [x] Create `lib/digitalTwin.js`: `computeDigitalTwinLevel` and its 4
      threshold constants.
- [x] Create `lib/neighborProgram.js`: `haversineDistanceKm`,
      `optInToNeighborProgram`, `optOutOfNeighborProgram`,
      `getNeighborProgram`, `findNearbyNeighbors`,
      `recordNeighborTrade`.
- [x] Create `lib/cvnvoPlacement.js`: `PACKAGE_TIERS`,
      `VISIBILITY_BOOST_BY_TIER`, `setCvnvoPlacement`,
      `getCvnvoPlacement`.
- [x] Extend `createHvntzStore()` (in `revenueStack.js`) with
      `neighborPrograms`/`cvnvoPlacements`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 21 checks, all passed clean on first run):
      - Digital Twin: Level 1 at zero activity; still Level 1 at 1
        location; promotes to Level 2 at exactly the 2-location
        threshold, correctly without streaming/BI unlocked; promotes
        to Level 3 at exactly the 3-location threshold, correctly
        with both unlocked; `hub-as-store` participation alone (1
        location) independently reaches Level 3; the revenue
        threshold alone (200) independently reaches Level 3 too —
        all three paths checked separately, not just one.
      - Neighbor Program: negative radius throws; real Haversine
        distance between real St. Louis coordinates (~0.85km,
        hand-verified in range); a close business is found as a
        neighbor, a far one (~9km) is correctly excluded; searching
        with an unregistered business throws; a trade records
        correctly on the initiator's side and — checked directly on
        the *partner's* own record, not assumed — the reciprocal
        entry with swapped incentives landed automatically; trading
        with a non-opted-in partner throws; opting out removes a
        business both from being found by others and from searching
        itself.
      - CVNVO: invalid tier throws; premium yields a real higher boost
        than basic; re-setting the same business updates in place
        (no duplicate record).
- [x] Wire `server.js`: 8 new endpoints (`/api/digital-twin/:id`,
      `/api/neighbor-program/opt-in`, `/opt-out/:id`, `/:id`,
      `/:id/nearby`, `/trade`, `/api/cvnvo-placement`,
      `/api/cvnvo-placement/:id`).
- [x] Verify live with both `hvntz/server.js` and `venvs-mock-backend`
      running together:
      - A real business grown from 0 to 3 locations through actual
        API calls shows Digital Twin level genuinely recomputing live
        (1 → 3), not a cached value.
      - Two real businesses opted into the neighbor program at real
        coordinates; `/nearby` correctly found the ~0.85km-distant one;
        a real trade recorded through the API reciprocated correctly
        on the partner's side, confirmed via a separate `GET`.
      - CVNVO placement set and confirmed via the live API.
- [x] Shut down both servers cleanly; confirmed via follow-up `curl`
      that neither port accepted connections.
- [x] Commit as its own change.

## Next
HVNTZ Explore Page (location + attention-based ranking) and wiring
Digital Twin level to an actual `venvs` CHOPZ business (once that
system exists there) are the clearest next steps, not started here.
