# Tasks — Phase 1: Revenue Stack, Participation, DREA, Ad pricing

- [x] Create `lib/revenueStack.js`: `REVENUE_EVENT_TYPES`,
      `LOCATION_TYPES`, `createHvntzStore`, `registerBusiness`,
      `getBusiness`, `registerLocation`, `getLocation`,
      `recordRevenueEvent`, `getRevenueEvents`, `getFranchiseList`.
- [x] Create `lib/participation.js`: `PARTICIPATION_TYPES`,
      `REFERENCE_FEE_FOR_FULL_SHARE`, `registerLocationParticipation`,
      `getParticipations`.
- [x] Create `lib/drea.js`: `setPlacementRule`, `getPlacementRule`,
      `checkPlacementAllowed`, `flagPlacement`, `getFlag`,
      `resolveFlag`, `getFlagsForVenue`.
- [x] Create `lib/adPricing.js`: `AD_TIERS`, `BASE_PRICES`,
      `calculateAdPrice`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 39 checks):
      - `registerBusiness`/`registerLocation` validation.
      - `recordRevenueEvent` validation (bad event type, bad location,
        insufficient payer balance real-rejected); 4 real events
        across 2 locations correctly sum to the right owner payout
        (43); filtering by location and by event type both correct.
      - Franchise List: 2 distinct location rows (not flattened), each
        with correct summed revenue and correct `activityProduced`
        listing.
      - Participation: invalid type throws; `own-hunt-location` always
        100%/no fee; negative fee on a paid tier throws; exactly 50%
        share at half the reference fee; capped at exactly 100% when
        overpaying; `hub-as-store` throws below the full-share
        threshold, succeeds at exactly the threshold.
      - DREA: category exclusion and specific-seller exclusion both
        block correctly and independently; a venue with no rule
        defaults to allowed; invalid flag source/resolution both
        throw; a flag can't be resolved twice.
      - Ad pricing: invalid tier throws; zero traffic/revenue yields
        exactly the base price; higher traffic/revenue yields a real
        higher price; a higher tier costs more at identical traffic/
        revenue; every tier requires a QR code.
- [x] Create `server.js`: real Express API (CommonJS) wrapping all
      four modules, with `recordRevenueEvent`'s `transferFn` wired to
      a real `fetch` call against V3's `/api/vcoin/transfer` contract.
- [x] Create `package.json`, `.env.example`, `.gitignore`.
- [x] `npm install`; verify live with both `hvntz/server.js` and
      `venvs-mock-backend` running together:
      - Health check reports the correct counts (14 event types, 3
        location types, 4 ad tiers).
      - Registered a real business and a real screen location.
      - Recorded a real `screen-ad` revenue event via the HTTP API;
        **independently confirmed via a direct `curl` to the mock V3
        ledger** (not HVNTZ's own response) that `gym-owner`'s real
        balance increased by exactly the amount earned (1000 → 1012.5).
      - Franchise List endpoint correctly reflects the real event.
      - Placement rule set via the API correctly blocks a matching
        excluded category and correctly allows a non-excluded one.
- [x] Shut down both servers cleanly; confirmed via follow-up `curl`
      that neither port accepted connections.
- [x] Commit as its own change.

## Next
The remaining revenue-stream types (`cvnvo-placement`,
`community-thread`, `package-pickup`, `void-rideshare-hotspot`,
`full-service-delivery`, etc.) can already be recorded and paid out
through `recordRevenueEvent` generically, but none has dedicated
business logic of its own yet (e.g. `CVNVOPlacementTier`'s algorithm-
visibility-boost mechanic, `HuntsLocalNeighborProgram`'s matching).
Digital Twin auto-scaling (`DigitalTwinAutoScale`, reading from
`FranchiseListEntry`/`LocationParticipation` to compute a VDP tier) is
a real, concrete next step connecting this project back to VENVS's
Digital Twin Level system — not built here. No drone routing,
hardware, or physical infrastructure — all explicitly out of scope for
this session, not oversights.
