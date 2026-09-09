# Tasks — Phase 6: Dispatch Intelligence, Multi-Modal Relay, VOID Direct, Affiliate Network

- [x] Create `lib/dispatchIntelligence.js`:
      `DEFAULT_ACCEPTABLE_WINDOW_HOURS`, `decideAirVsGround`,
      `computeLoadIntelligenceScore`, `recommendDeadTimeOpportunity`.
- [x] Create `lib/multiModalRelay.js`: `buildStationGraph`,
      `findRelayPath` (real Dijkstra's algorithm).
- [x] Create `lib/externalIntegration.js`: `AFFILIATE_ROLES`,
      `registerExternalBusiness`, `getExternalBusinessByApiKey`,
      `submitDeliveryManifest`, `getManifestStatus`,
      `registerAffiliateStation`, `listAffiliateStations`.
- [x] Extend `createVoidStore()` (in `store.js`) with
      `externalBusinesses`/`nextExternalBusinessId`/`deliveryManifests`/
      `nextManifestId`/`affiliateStations`.
- [x] Wire `server.js`: 9 new endpoints (`POST /api/dispatch/air-vs-ground`,
      `POST /api/dispatch/load-intelligence`,
      `POST /api/dispatch/dead-time-recommendation`,
      `GET /api/relay-path`, `POST /api/external-business`,
      `POST /api/void-direct/manifest`,
      `GET /api/void-direct/manifest/:id`,
      `POST /api/affiliate-station`, `GET /api/affiliate-stations`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 20 checks, all passed clean on first run):
      - `decideAirVsGround`: ground chosen only when capacity exists
        and fits the window; air chosen when no capacity exists, and
        separately when capacity exists but misses the window
        (checked as two distinct cases with distinct reasons);
        invalid inputs rejected.
      - `computeLoadIntelligenceScore`: correct utilization (50% on a
        2/4-seat, 6/12-cargo case) and leftover-capacity numbers;
        rejects `passengerCount` exceeding `seatingCapacity` as a
        real safety constraint, not just a scoring edge case; correctly
        reports `hasCapacityForMoreWork: false` when fully utilized.
      - `recommendDeadTimeOpportunity`: correctly filters out both an
        opportunity outside the driver's certification and one that
        doesn't fit the time window, then picks the best-paying
        opportunity among what's left; returns `null` when nothing
        fits.
      - `findRelayPath`: on a real constructed 4-station chain (~5km
        spacing) plus one isolated station (~90km away), correctly
        finds the true 3-hop path (`[1,2,3,4]`, ~15km total, hand-
        verified) with a 6km max leg range, correctly finds a direct
        1-hop path when in range, correctly reports `found: false` for
        the isolated station, and rejects a station outside the given
        region.
      - `submitDeliveryManifest`: rejects an invalid `apiKey`; on
        success, creates a real `courier`-vertical job through the
        actual marketplace `requestJob()` — confirmed by looking up
        the job directly in `store.jobs`, not just trusting the
        manifest response.
      - `getManifestStatus` reflects the real underlying job status and
        throws for an unknown manifest.
      - `registerAffiliateStation` rejects an invalid role;
        `listAffiliateStations` correctly surfaces an HVNTZ-onboarded
        affiliate ahead of a non-onboarded one.
- [x] Verify live with `void/server.js` running alone:
      - All three dispatch-intelligence endpoints confirmed via the
        real HTTP API, matching the plain-Node results exactly.
      - A real 3-station chain registered; `GET /api/relay-path`
        correctly found the 2-hop path (`[1,2,3]`, 10.01km) through
        the actual API.
      - A real external business registered with a generated API key;
        an invalid-key manifest submission correctly rejected; a valid
        submission created manifest id 1 with `jobId: 1`; `GET /api/void-direct/manifest/1`
        correctly reflected `jobStatus: "requested"`; **independently
        confirmed** by fetching `GET /api/job/1` directly — a real,
        distinct courier job with `verticalId: "courier"`,
        `totalPrice: 12`, `customerId: "external-business:1"`, not
        just trusted from the manifest endpoint's own response.
      - Affiliate stations registered and correctly ordered with the
        HVNTZ-onboarded one first via the real API.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`
      that the port no longer accepted connections.
- [x] Commit as its own change.

## Next
This closes the genuinely software-buildable slice identified across
all six VOID source docs. Next: a full cross-phase regression
exercising all six phases together against one shared store (mirroring
HVNTZ's own Phase 4 regression and VENVS's Phase 7), then final
delivery.
