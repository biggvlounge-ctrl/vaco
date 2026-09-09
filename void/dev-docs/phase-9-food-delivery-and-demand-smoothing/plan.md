# Plan — Phase 9: Food Delivery vertical, Food-Capable Stations, Transparent-Kitchen Trust, Demand Smoothing

## Goal
Three follow-up docs (Meituan, Food-Capable Stations, and implicitly
the Amazon doc's food-adjacent framing) all assumed a "food delivery"
concept existed in the Service Marketplace. It didn't. This phase
resolves that gap once, closing all three dependent features at the
same time, plus builds Meituan's other real, named addition:
system-wide demand smoothing.

## Design
- `lib/verticals.js`: `foodDelivery` registered as a real 24th
  vertical (`per-job`, 20% take rate, free pickup/delivery) — named
  repeatedly in `VOID_MASTER_FREEZE.md`'s Logistics section but never
  given a Service Marketplace entry until now.
- `lib/stations.js`: `temperatureControlled: boolean` (default
  `false`) added to `VoidStation`, per `VOID_FOOD_CAPABLE_STATIONS.md`'s
  real DRONEDEK "hot and cold section" variant — deployed at a subset
  of the existing network, not a separate food-only one.
- `lib/dispatchIntelligence.js` extended: `getDeliveryPriority(orderType)`
  gives food a real, much tighter window (`FOOD_MAX_ACCEPTABLE_DELAY_MINUTES = 15`,
  sourced directly from the Meituan doc's own real cited drone spec —
  "delivers within a 3 km radius in 15 minutes" — not invented) versus
  general packages' existing 48-hour default. This isn't a separate
  decision system: passing food's real window into the existing
  `decideAirVsGround()` naturally biases the outcome toward air for
  food, without needing a third decision function.
  `computeAcceptanceDelay()` implements Meituan's real "demand
  smoothing" — staggering acceptance once a region is at or over its
  real concurrent-job capacity — as a real, flagged, proportional
  scheme (`STAGGER_INTERVAL_MINUTES = 5`, no doc-given formula). Order
  *batching* (grouping nearby orders) already exists as real code in
  `droneRouting.js`'s `groupOrdersIntoRoutes` — this is the separate,
  system-wide acceptance-timing half Meituan's model adds.
- `lib/foodTrust.js`: `registerKitchenStream`/`getKitchenTrustStatus` —
  the real "Raccoon Canteen" transparent-kitchen trust signal, kept
  self-contained within VOID rather than a live cross-service call
  into HVNTZ (a separate process/store in this session) — flagged as
  the natural next integration step, not attempted here.
- `server.js`: 4 new endpoints.

## Explicitly NOT in this task
- No live cross-service call to HVNTZ for kitchen-trust display —
  `foodTrust.js` is VOID's own record, not wired to HVNTZ's actual
  business-trust system running in a separate process.
- No automatic, system-wide job-count tracking feeding
  `computeAcceptanceDelay` in real time — it's a pure function taking
  caller-supplied counts, matching this session's established stance
  against inventing a background scheduler.

## Verification approach
Plain-Node pass first (throwaway `.cjs`, deleted after — 14 checks).
The most important check isn't a unit in isolation: it confirms that
feeding food's real 15-minute window into the *existing*
`decideAirVsGround()` genuinely changes its outcome (forces air for a
1-hour ground ETA, allows ground for a 12-minute one) — proving the
food-priority rule is real integration, not a parallel system nobody
calls. Then a live pass: `void/server.js` running alone — the new
vertical, a temperature-controlled station, a kitchen stream, and
demand smoothing at peak load all confirmed through the actual HTTP
API.

## Done when
- `foodDelivery` is a real, usable vertical through `requestJob`.
- `registerStation` accepts and validates `temperatureControlled`.
- `getDeliveryPriority` gives food a real, much tighter window than
  general packages, and that window measurably changes
  `decideAirVsGround`'s real output.
- `computeAcceptanceDelay` returns zero delay under capacity and a
  real, increasing stagger over it.
- `foodTrust.js` round-trips correctly and updates in place on
  re-registration (no duplicate records).
- Live: all of the above confirmed through the real HTTP API.
