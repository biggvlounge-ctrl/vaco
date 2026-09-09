# Tasks — Phase 9: Food Delivery, Food-Capable Stations, Transparent-Kitchen Trust, Demand Smoothing

- [x] Register `foodDelivery` vertical in `lib/verticals.js`.
- [x] Add `temperatureControlled` to `registerStation` in
      `lib/stations.js`.
- [x] Extend `lib/dispatchIntelligence.js`: `ORDER_TYPES`,
      `FOOD_MAX_ACCEPTABLE_DELAY_MINUTES`, `getDeliveryPriority`,
      `STAGGER_INTERVAL_MINUTES`, `computeAcceptanceDelay`.
- [x] Create `lib/foodTrust.js`: `registerKitchenStream`,
      `getKitchenTrustStatus`.
- [x] Extend `createVoidStore()` with `kitchenStreams`.
- [x] Wire `server.js`: 4 new endpoints
      (`GET /api/dispatch/delivery-priority/:orderType`,
      `POST /api/dispatch/acceptance-delay`,
      `POST /api/kitchen-stream`, `GET /api/kitchen-stream/:businessId`).
- [x] Verify pure logic in plain Node (throwaway `.cjs`, deleted after
      — 14 checks, all passed clean on first run):
      - `foodDelivery` is real and usable end to end via `requestJob`
        (24 total verticals).
      - `registerStation` accepts/validates `temperatureControlled`.
      - `getDeliveryPriority('food')` returns 15 minutes, well under
        the general-package default; rejects an invalid `orderType`.
      - Feeding food's real window into `decideAirVsGround` genuinely
        changes the outcome: a 60-minute ground ETA is forced to air, a
        12-minute one is still allowed to go ground — real integration
        proof, not a parallel, uncalled system.
      - `computeAcceptanceDelay` returns 0 under capacity, a real,
        proportionally increasing stagger over it (5 min at 1-over, 20
        min at 4-over), rejects invalid inputs.
      - `foodTrust.js` round-trips correctly and updates in place on
        re-registration (no duplicate record).
- [x] Verify live with `void/server.js` running alone: food priority
      window, a temperature-controlled station, a real `foodDelivery`
      job, a kitchen stream, and demand smoothing at peak load (15/10
      → 30-minute delay) all confirmed through the real HTTP API,
      matching the plain-Node pass exactly.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 10: the Moving Services and Real Estate Media verticals.
