# CLAUDE.md — VOID (VACO Ecosystem)

Orientation brief for Claude Code.

> **Why this file exists.** `VOID_MASTER_FREEZE.md` opens by saying it
> is "the canonical source document VOID's CLAUDE.md brief was
> summarized from" — but no such brief existed in this repo. VOID is
> the largest app in the ecosystem (33 `lib/` modules, 18 dev-doc
> phases) and had no orientation file at all. Written now from the
> real, verified code, not from memory.

## Source-of-truth precedence

1. **The code** — always wins on what is actually built.
2. **`VOID_MASTER_FREEZE.md`** — canonical on *intended scope*. Its own
   framing: "Where this document and the brief disagree on scope, this
   document wins; the brief describes build status, this describes
   intended scope."
3. **`README.md`** — the phase-by-phase build record.
4. **This file** — orientation and the map to the rest.

Other real source docs in this directory:
`VOID_SERVICE_VERTICALS_COMPARABLES.md`,
`VOID_STATION_NAMING_CONVENTION.md`,
`VOID_AMAZON_LOGISTICS_INTEGRATION.md`,
`VOID_APARTMENT_UNIVERSITY_LOCKER_NETWORK.md`,
`VOID_FOOD_CAPABLE_STATIONS.md`, `VOID_HUB_WALKUP_ORIGINATION.md`,
`VOID_MEITUAN_MODEL_INTEGRATION.md`,
`VOID_MOVING_REAL_ESTATE_MEDIA.md`,
`VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md` (costing, not code).

## What VOID is

An AI-powered real-world execution platform: transportation,
logistics, local commerce, workforce services, rentals, and physical
infrastructure under one account. Within the ecosystem VOID is the
**shared logistics/transport layer other apps call into** — the same
role V3 plays for money, Shield for identity, DREAMS for ads.

## Run it

```
npm install && npm start      # http://localhost:8793
curl localhost:8793/api/health
```

Boots with real seed data (`lib/seedDemoData.js`) when the store is
empty: two St. Louis Port Stations, gig drivers, and four courier jobs
that genuinely batch through the real routing engine.

## Where things live

- **Network/infrastructure** — `stations.js` (Hub/Port; note
  `STATION_TYPES` is `['port','hub-and-port']`, a bare hub is rejected
  by design), `networkDensity.js`, `noFlyZones.js`,
  `multiModalRelay.js` (real Dijkstra hub-to-hub relay, includes
  eligible affiliate midpoints), `geo.js`.
- **Dispatch ("Gibson")** — `dispatchIntelligence.js` (air-vs-ground,
  load intelligence, dead-time/"Kyle" suggestions, food priority,
  demand smoothing), `droneRouting.js` (real TSP-D/VRP-D:
  nearest-neighbour + 2-opt), `sequencing.js`.
- **Marketplace core** — `marketplace.js` (the one shared
  request→match→accept→complete→pay→rate loop every vertical runs
  through), `verticals.js` (25 registered verticals).
- **Scheduling, four surfaces on one engine** — `reserveBooking.js`
  (90-day advance, 60-min free cancellation), `commuteScheduling.js`
  (batch match + real backup on-demand guarantee),
  `dedicatedLanes.js` (lanes + spot loads), `hourlyBooking.js`.
- **Load/pricing** — `loadManagement.js`, `cargoPricing.js`.
- **Verticals with real mechanics** — `movingServices.js`,
  `realEstateMedia.js`, `foodTrust.js` (transparent kitchen).
- **Lockers & hubs** — `voidLocker.js`, `lockerToDoor.js`,
  `hubOrigination.js`, `businessLockers.js` (forward-deployed seller
  inventory).
- **Drivers** — `driverFleet.js` (gig + DSP tiers),
  `mobileDocking.js` (mobile drone docks, Launchpad Drivers).
- **Cross-app** — `externalIntegration.js` (VOID Direct + Affiliate
  Network), `staffing.js`, `regulatedBoxes.js`, `taas.js`,
  `deliveryChoice.js`.
- **Persistence** — `store.js` + `persistence.js` (Proxy-based
  auto-flush to `data/store.json`).

## Standing rules

1. **One marketplace loop.** Every vertical runs through
   `marketplace.js`'s `requestJob` → … → `rateJob`. Moving, real
   estate media, hub origination, and staffing all create real jobs
   through it. Do not build a second, parallel job system — Phase 12's
   regression specifically proved four entry points never collide in
   the same `jobs` collection.
2. **Licensing gates are real.** `cannabisDelivery` and
   `medicalTransportation` are `licensingGated: true`, and
   `requestJob` refuses them outright. `regulatedBoxes.js` builds the
   physical chain-of-custody layer but deliberately does **not**
   relax that gate. Don't.
3. **Interpretive constants get named and flagged**, never buried
   inline — see `cargoPricing.js`, `STAGGER_INTERVAL_MINUTES`,
   `DEFAULT_AVERAGE_TRAVEL_SPEED_KMH`. Follow that pattern.
4. **Cross-app calls are injected**, not hard-wired — a `transferFn`,
   `hvntzFetchFn`, `voidRequestFn`, etc. Keeps modules runnable in
   plain Node with no live network.
5. **Fail soft on signals, hard on money.** VACA verification and
   analytics pushes fail soft (`null`, never block a real job); real
   payouts and capacity checks throw.

## Genuinely not built (don't assume otherwise)

- **The AI agents themselves.** V4, Gibson, and Kyle do not exist as
  real agents anywhere. `dispatchIntelligence.js` implements the
  deterministic *rules* their stated behavior describes, and says so
  in its own header. Demand forecasting feeding those rules is also
  not built.
- **Any physical hardware** — drones, docks, stations, screens. See
  `VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md`, which treats hardware as
  an entirely separate budget line from software.
- **Real PMS integration** (Yardi/Entrata/AppFolio/RealPage/Buildium)
  — a recorded integration target field, not a live connection.
- **Driver onboarding, background checks, W-2 payroll.**
- **Ground/autonomous handoff simulation** when a drone relay path
  isn't found — correctly *detected*, not simulated.
- **`'rideshare-style'` fulfillment** — named in
  `VOID_HUB_WALKUP_ORIGINATION.md` but not distinguishable from
  `'driver'` by any real rule here, so never emitted.
- **Proactive hardware suggestions** (TaaS) — depends on a proactive
  business suggestion engine that exists only in planning docs.

## Decisions on the three questions `VOID_MASTER_FREEZE.md` raised

Master Freeze flags three items as needing an explicit call. All three
were **decided by the founder** and are recorded here as settled — do
not reopen them or "fix" the code to match the document.

1. **Kyle stays scoped to the dead-time suggestion mechanic.** Master
   Freeze describes Kyle as a full third AI agent; that is *not* being
   built now. It is real, separate work, nothing depends on it, and it
   is **a future phase, not a current blocker**. The existing
   `recommendDeadTimeOpportunity` in `dispatchIntelligence.js` is the
   whole of Kyle today, and that is correct.

2. **Cannabis / Medical Transportation stay as standalone verticals in
   code.** Master Freeze categorizes them under Logistics and
   Transportation respectively; `verticals.js` registers them as
   standalone Service Marketplace verticals. Since the licensing gates
   work correctly either way (verified: `requestJob` genuinely refuses
   both), the difference is cosmetic. **Keep as-is; not worth
   touching.**

3. **All four extra verticals stay, including `courier`.**
   `notaryLegal`, `autoRepairDetailing`, `wasteRemoval`, and `courier`
   are absent from Master Freeze's Service Marketplace list but real in
   `verticals.js` (from `VOID_SERVICE_VERTICALS_COMPARABLES.md`).
   `courier` is load-bearing — CHOPZ SHOP, VENVS Marketplace, hub
   origination, seed data, and VOID Direct all create real `courier`
   jobs. Removing it to match the document would break real, working
   cross-app fulfillment in three apps.

   **Standing rule from this decision**: on the vertical list
   specifically, `VOID_MASTER_FREEZE.md` is **non-exhaustive, not
   authoritative**. It is incomplete here rather than in conflict.
   This is a deliberate, narrow exception to the precedence order at
   the top of this file, and applies to the vertical list only — Master
   Freeze remains canonical on scope everywhere else.
