# Tasks — Phase 1: VOID Station Network + Network Density Metric

- [x] Create `lib/geo.js`: `haversineDistanceKm`.
- [x] Create `lib/store.js`: `createVoidStore`.
- [x] Create `lib/stations.js`: `STATION_TYPES`, `registerStation`,
      `getStation`, `getStationsByRegion`.
- [x] Create `lib/networkDensity.js`: `DEFAULT_MAX_RELAY_RANGE_KM`,
      `computeNetworkDensity`.
- [x] Scaffold `server.js`, `package.json`, `.env.example`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 14 checks, all passed clean on first run):
      - `registerStation` rejects a bare `"hub"` stationType, missing
        `regionId`, invalid `bayCount` (zero and non-integer both
        checked), and missing `lat`/`lng`.
      - Valid `port` and `hub-and-port` (with double bays + relay)
        registrations succeed with correct defaults.
      - `computeNetworkDensity`: 0 stations returns
        `activeMidpointCount: 0`, `null` distance, `0` routing options
        (no divide-by-zero); exactly 1 station returns `null` distance
        correctly; 2 real St. Louis-area stations produce a real,
        hand-verified average distance (~11.2km, matching the
        Cahokia-Mounds/Gateway-Arch distance already hand-verified in
        `hvntz` Phase 3); a tighter `maxRelayRangeKm` override
        correctly excludes a pair that the default range included; a
        non-positive `maxRelayRangeKm` throws; adding a third station
        genuinely changes `routingOptionsAvailable` (not cached).
      - `getStationsByRegion` scopes correctly with no cross-region
        leakage.
- [x] Verify live with `void/server.js` running alone:
      - A bare `"hub"` registration correctly rejected via the real
        HTTP API.
      - Two real stations registered in a `downtown-stl` region;
        density recomputed live to `activeMidpointCount: 2`,
        `averageInterMidpointDistance: 5.39`, `routingOptionsAvailable: 1`.
      - A third station added; density recomputed live to
        `activeMidpointCount: 3`, `averageInterMidpointDistance: 3.59`
        (shrinking), `routingOptionsAvailable: 3` (growing) — a real,
        live confirmation of the source doc's own "network density
        benefits everyone already in the network" claim, not just
        trusted from the doc's prose.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`
      that the port no longer accepted connections.
- [x] Commit as its own change.

## Next
Phase 2: the flagship algorithmic piece — Multi-Stop Drone Routing
(TSP-D/VRP-D), the one system the source doc explicitly flags as
"ready for Claude Code" with real published algorithms as a starting
reference.
