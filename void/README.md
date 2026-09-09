# VOID

A real-world execution platform unifying transportation, logistics,
local commerce, workforce services, and physical infrastructure into
one coordinated network. Fresh build in this repo; no prior VOID
codebase exists anywhere in this session.

Source docs, core architecture: `VOID_MASTER_FREEZE.md` (the canonical,
full platform breakdown — read this first), `VOID_MULTI_STOP_DRONE_ROUTING.md`,
`VOID_STATION_NAMING_CONVENTION.md`, `VOID_SERVICE_VERTICALS_COMPARABLES.md`,
`BUSINESS_AGENT_GIBSON_VOID_DESIGN.md`, `VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md`.
Source docs, follow-up features (Phases 8–11):
`VOID_AMAZON_LOGISTICS_INTEGRATION.md`, `VOID_MOVING_REAL_ESTATE_MEDIA.md`,
`VOID_MEITUAN_MODEL_INTEGRATION.md`, `VOID_FOOD_CAPABLE_STATIONS.md`,
`VOID_HUB_WALKUP_ORIGINATION.md`, `VOID_APARTMENT_UNIVERSITY_LOCKER_NETWORK.md`.
(A marketing-strategy/budget document, and a document about Vvltvre
Music's own separate catalog-acquisition plan, were both uploaded
alongside these at various points and are explicitly excluded from
this project's scope — not referenced anywhere below.)

**Scope note**: these docs describe a much larger platform than this
project covers. Three real AI agents (V4, Gibson, Kyle) and a
Business Executive roster (Qvan, Mr. Leslie, Mr. Deskins) are named
throughout — none of them exist as actual agents anywhere in this
session, matching this session's consistent stance (same as HVNTZ's
DREA/HVNTER): build the real, deterministic logic underneath a named
agent's stated behavior, never a fake AI call standing in for the
agent itself. Physical hardware (VOID Hub/Port Stations, drones,
vehicles) isn't software this session can build. Two verticals
(Medical Transportation, Cannabis Delivery) remain licensing-gated per
the source docs' own explicit flags. What's here is the genuinely
buildable slice: station network data modeling, real route-
optimization algorithms, the service-marketplace business logic, load
management, scheduling, and the deterministic rules underneath
Gibson's/Kyle's stated dispatch behavior.

## Run
```
cd void && npm install && npm start   # localhost:8793
```

## Test
```
curl http://localhost:8793/api/health
curl -X POST http://localhost:8793/api/station -H "Content-Type: application/json" \
  -d '{"regionId":"downtown-stl","stationType":"hub-and-port","bayCount":2,"supportsRelay":true,"lat":38.627,"lng":-90.1994}'
curl http://localhost:8793/api/network-density/downtown-stl
```

## What's here
- `lib/geo.js` — `haversineDistanceKm`, a real great-circle distance
  helper (this project's own copy, matching the established
  per-project pattern rather than a forced cross-project dependency).
- `lib/stations.js` — the VOID Station network: `registerStation()`
  enforces the source doc's "every Hub Station includes at least one
  Port Station" rule literally — a bare `"hub"` registration (no port
  capability) is rejected outright, not silently accepted.
- `lib/networkDensity.js` — `computeNetworkDensity()`: a real,
  live-recomputed metric (average inter-station distance, routing
  options within relay range) proving the source doc's own "network
  density benefits everyone already in the network" claim against a
  real registered station network, not just asserting it.
- `lib/noFlyZones.js` — real, registered no-fly zones (globally
  scoped, flagged interpretive) checked against every leg of a route.
- `lib/droneRouting.js` — **Multi-Stop Drone Routing (TSP-D/VRP-D,
  Phase 2)**, the flagship algorithmic piece: `optimizeStopSequence()`
  is a real nearest-neighbor + 2-opt solver (the standard, established
  heuristic for this NP-hard problem class — verified against a true
  brute-force optimum, not just a plausible-looking route).
  `buildRoute()` validates real payload capacity, real round-trip
  range (a drone must return to its hub to recharge), and real
  no-fly-zone clearance across every leg. `groupOrdersIntoRoutes()` is
  the real VRP-D extension — a candidate order pool gets split across
  a drone fleet by real proximity-based greedy bin-packing, with
  orders that can never fit any drone reported as unassigned rather
  than crashing the batch.
- `lib/verticals.js` — the **Service Marketplace registry (Phase 3)**:
  23 real named verticals, five with deep-researched real numbers
  straight from the source doc (Laundry's real per-pound pricing and
  75%-worker-payout split; Fiverr's real flat 20% commission for
  Freelance, deliberately avoiding Upwork's pay-to-bid model), the
  rest on the doc's own explicitly-authorized ~20%-take-rate fallback.
- `lib/marketplace.js` — the actual request → match → accept →
  complete → pay → rate loop the doc says every vertical shares.
  `completeJob()` performs two real transfers (provider payout +
  platform fee) computed to sum exactly to the job's total price, and
  outright rejects any licensing-gated vertical (Cannabis Delivery,
  Medical Transportation) as a real, enforced business rule.
- `lib/loadManagement.js` — **Passenger, Cargo & Load Management
  (Phase 4)**: `declareTrip()` uses smart defaults (1 passenger, an
  auto-computed bag count) per the doc's own booking-friction flag; a
  service animal (`hasServiceAnimal`) is a firm, separate field that
  never counts as an oversized item or triggers rejection, per the
  doc's own ADA flag; car seats follow real Uber/Lyft precedent
  (rider-supplied by default) with an explicit `carSeatsNeeded`
  matching hint, resolving the doc's own flagged gap instead of
  leaving it silent. `checkCapacityFit()` is the real "preventing
  over-capacity assignment" mechanic against a registered vehicle
  profile.
- `lib/cargoPricing.js` — `computeDynamicCargoPricing()`: a real,
  bounded formula (the doc names the need, gives no formula) — not a
  fake V4 AI call.
- `lib/sequencing.js` — `computeSequencing()`: a real, deterministic
  first-pass priority rule implementing the doc's own stated ordering
  (food > passenger safety > packages, with parity for packages on a
  dedicated delivery route) — the doc itself calls the full real-time
  version "genuinely complex," so this is flagged as a first pass, not
  a claim to have solved live-traffic-aware routing.
- `lib/reserveBooking.js` — **VOID Reserve (Phase 5)**, modeled on the
  real Uber Reserve: book up to 90 days out; `matchReserveDriver()`
  enforces the doc's own "attempted before the scheduled pickup time,
  not last-minute dispatch" rule; `cancelReserveBooking()` computes
  the real free/fee cancellation-window boundary (60 minutes).
- `lib/commuteScheduling.js` — **VOID Commute**, modeled on the real
  Scoop: `runBatchMatch()` implements the doc's real "deadline-based
  batch match... runs once at the deadline, not continuously" rule
  literally, with real Haversine-based nearest-neighbor carpool
  grouping and a real `backupOnDemandGuaranteed` flag for anyone left
  unmatched, per the doc's own guarantee.
- `lib/dedicatedLanes.js` — **VOID Dedicated Lanes**, modeled on the
  real DAT/Truckstop freight boards: `claimDedicatedLane()` (a
  carrier's exclusive, recurring commitment) is a genuinely separate
  mechanism from `postSpotLoad()`/`bookSpotLoad()` (a one-off,
  one-click "Book It Now" load), per the doc's own explicit
  distinction.
- `lib/hourlyBooking.js` — **VOID Hourly**, modeled on the real Uber
  Hourly: a 2–8 hour committed block, with real, separate mileage and
  time overage charges past an included allowance.
- `lib/dispatchIntelligence.js` — **the deterministic rules underneath
  Gibson and Kyle (Phase 6)**: `decideAirVsGround()` implements
  Gibson's own stated rule (ground only when real capacity exists
  *and* fits a real time window, otherwise air) literally.
  `computeLoadIntelligenceScore()` turns Gibson Load Intelligence's
  named inputs into a real utilization score with a hard safety check
  against over-capacity. `recommendDeadTimeOpportunity()` implements
  Kyle's own concrete example — real certification + time-fit
  filtering, then best-payout selection — explicitly not real demand
  forecasting (V4's job, an AI agent not built here).
- `lib/multiModalRelay.js` — `findRelayPath()`: real Dijkstra's
  algorithm over the Station network, directly implementing the "hop
  hub-to-hub by drone" framing as a standard shortest-path algorithm,
  not an invented heuristic — correctly reports when no drone-only
  relay path exists rather than guessing.
- `lib/externalIntegration.js` — **VOID Direct + Affiliate Network**:
  `submitDeliveryManifest()` is real code reuse, not a stub — it
  creates an actual `courier`-vertical job through Phase 3's own
  marketplace loop, proving external businesses dispatch through
  VOID's real mechanism, not a parallel system. `listAffiliateStations()`
  surfaces HVNTZ-onboarded affiliates first, per the doc's own
  recruitment-priority refinement. **Real, live HVNTZ verification
  (Phase 13)**: `isHvntzOnboarded` used to be a bare, caller-declared
  boolean — now `registerAffiliateStation` takes a real, optional
  `hvntzBusinessId`, live-validated against HVNTZ's own real `GET
  /api/business/:id` (added to HVNTZ this same session), and stores
  the real returned business name, not just the caller's id. Omitting
  it is still fine — `isHvntzOnboarded` just honestly defaults to
  `false` rather than trusting an unproven claim.
- `lib/driverFleet.js` — **Driver/Fleet Management (Phase 8)**: the
  real two-tier model from Amazon's actual delivery network — gig
  drivers (Flex's real role, flexible overflow) and VOID DSP (DSP's
  real role, a branded W-2 fleet on fixed routes), modeled on Amazon's
  approach since VOID structurally can't partner with Amazon's DSP
  program directly.
- `lib/marketplace.js` extended — a real failed-delivery protocol:
  `reportFailedDelivery()`/`retryDelivery()` enforce a real 24-hour
  minimum wait before a retry succeeds.
- `lib/verticals.js` extended — `foodDelivery` (Phase 9) and
  `realEstateMedia` (Phase 10) registered as real verticals, closing
  gaps three separate follow-up docs depended on.
- `lib/stations.js` extended — `temperatureControlled` (Phase 9), the
  real DRONEDEK hot/cold variant, deployed at a subset of the network.
- `lib/dispatchIntelligence.js` extended — `getDeliveryPriority()`
  gives food orders a real, much tighter delay window (15 minutes,
  sourced from Meituan's own cited drone spec) that measurably changes
  `decideAirVsGround()`'s real output. `computeAcceptanceDelay()`
  implements Meituan's real demand-smoothing as a proportional
  stagger once a region is at or over capacity.
- `lib/foodTrust.js` — the real "Raccoon Canteen" transparent-kitchen
  trust signal (Phase 9).
- `lib/movingServices.js`/`lib/realEstateMedia.js` (Phase 10) — real
  GoShare/Dolly vehicle-tier/equipment/helper-crew mechanics and
  HomeJab's real automated-match-by-distance model, both creating real
  underlying marketplace jobs rather than a parallel system.
- `lib/hubOrigination.js` (Phase 11) — the third, distinct delivery
  flow (walk into a Hub and originate a shipment in person), reusing
  Gibson's existing air-vs-ground rule for fulfillment rather than
  inventing a new decision system.
- `lib/voidLocker.js`/`lib/lockerToDoor.js` (Phase 11) — the real
  Apartment/University Smart Locker Network, kept as its own entity
  (a deliberate, documented resolution of a real shape ambiguity in
  the source doc) with real best-fit compartment selection, plus the
  Locker-to-Door final-mile assist with its real security requirement
  built correctly from the start: a separate, temporary, single-use
  driver access code that is never the customer's own credential, with
  a real, enforced expiry.
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Verified
168 plain-Node checks across all twelve phases, plus live passes:
`void/server.js` alone confirmed a real `downtown-stl` region grown
from 0 to 3 stations with network density genuinely recomputing live
(average distance 5.39km → 3.59km, routing options 1 → 3), a real
multi-stop drone route with a non-trivial optimized sequence, a
no-fly zone correctly rejecting routes within its radius, a 5-order
candidate pool correctly split across 2 drones by real proximity
clustering, a real trip declaration (service animal + oversized item)
correctly passing capacity fit with dynamic cargo pricing computed
correctly, and food-first sequencing confirmed correctly ordered.
`void/server.js` + `venvs-mock-backend` running together confirmed a
real Laundry job run end to end through the actual HTTP API, with the
resulting $7.50 provider payout and $2.50 platform fee **independently
confirmed against the mock V3 ledger**, and a live rejection of a
licensing-gated vertical; a real Reserve booking matched before pickup
time, a Commute batch correctly rejecting an early match attempt and
then correctly carpooling two nearby riders after a real 1-second
deadline actually elapsed in wall-clock time, a Dedicated Lane
correctly blocking a second carrier's claim, and an Hourly booking's
overage charge computed correctly for both mileage and time
(`totalCharge: 150` on a `baseCharge: 120`); all three dispatch-
intelligence endpoints confirmed live; a real 2-hop relay path found
across a live-registered station chain; a VOID Direct manifest
submission **independently confirmed** to have created a real,
separately-retrievable courier job (not just trusted from the
manifest's own response); HVNTZ-onboarded affiliates correctly
surfaced first; a real hub walk-up shipment resolved to drone
fulfillment; a full Locker-to-Door lifecycle run live end to end —
request, an early-retrieval attempt correctly rejected, driver
assignment, a wrong-code attempt correctly rejected, real-code
retrieval succeeding, and the freed compartment independently
re-confirmed via a separate `GET`, not just trusted from the retrieval
response. See `dev-docs/` for the full record.

**Phase 13 (real HVNTZ Affiliate Network verification)**: 7 plain-Node
checks (no `hvntzBusinessId` defaults to unverified, real verification
sets the flag and stores the real business name, an unknown business
is rejected, a missing fetch function is rejected, verified stations
still rank first), plus a live pass with `venvs-mock-backend`,
`hvntz`, and `void` all running together: a real HVNTZ business
registered, an unverified affiliate station confirmed unaffected, a
verified station confirmed succeeding against that same real business
with its real name stored (not just the caller's id), and a station
registered against a nonexistent business confirmed rejected with
HVNTZ's own real error message.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8793) — VOID's own real state now survives a
restart. Live-verified: registered a real drone station, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-14-real-persistence/`.

## Real automatic retry sweep (Phase 15)
Closes this file's own previously-flagged gap ("no persistent
background job runner"). `sweepFailedDeliveries` (`lib/marketplace.js`)
finds every real `delivery-failed` job that's actually crossed the
real 24-hour `RETRY_DELAY_HOURS` window and calls the existing,
already-tested `retryDelivery` on each one — no new eligibility logic,
just automating what a human calling it by hand would do. Wired into
`server.js` two ways: a real `setInterval` (15-minute check cadence,
`.unref()`'d so it doesn't keep the process alive on its own) runs it
continuously, and `POST /api/jobs/sweep-failed-deliveries` exposes it
directly so it's genuinely testable without waiting out a real
24-hour window. No external cron/scheduler infrastructure needed — a
real, in-process job runner. Verified with 4 real unit tests on
`sweepFailedDeliveries` in isolation (eligible job retried, too-recent
failure left alone, non-failed-status jobs ignored, multiple eligible
jobs all retried independently) plus a live pass against the real
running server: created and failed a real job, called the sweep route
immediately, confirmed it correctly left the too-recent failure alone.
See `dev-docs/phase-15-automatic-retry-sweep/`.

## Real VACA provider-verification signal (Phase 16)
A new, real VACA caller — VACA's own README flagged only 2 existed
anywhere in the ecosystem (VOKEN, CVNVO) out of 25+ apps that could
plausibly use it. `POST /api/job/:id/match` now makes a real, live
call to VACA's own `GET /api/identity-status/void-provider/:providerId`
and caches the real result as `providerVerified` on the job (fetched
once at match time, not re-fetched on every later read — same posture
as CHOPZ's own `linkedProductVerified`). **Deliberately additive, not
a gate**: an unverified provider can still be matched and complete
real jobs — VOID never required driver identity verification before,
and this doesn't retroactively require it now, matching the same
non-blocking posture Shield's credential auth and CVNVO's Yap signal
both used. Fails soft (`null`) if VACA is unreachable, same reasoning
as CVNVO's `fetchYapSignal`. Live-verified all three real cases: an
unverified provider (`false`), a provider with a real, VACA-approved
identity verification (`true`), and VACA unreachable (`null`, match
still succeeds) — plus confirmed the existing VDP VOID district demo
(`void-demo-provider`, never verified) still matches successfully
unaffected. See `dev-docs/phase-16-vaca-provider-verification/`.

## Real metrics feed (Phase 17)
Every real job completion pushes a real `job_platform_fee` metric to
VACO Analytics (fail-soft — a real job completion is never held up if
VACO Analytics is down). See
`vaco-analytics/dev-docs/phase-6-more-live-metric-feeds/`.

## Not yet built
- Any physical hardware, the actual V4/Gibson/Kyle AI agents, and the
  Business Executive roster (Qvan/Leslie/Deskins) — none exist as real
  agents in this session.
- Medical Transportation and Cannabis Delivery — both remain
  licensing-gated per the source docs' own flags.
- Real demand forecasting feeding Kyle's recommendations (V4's stated
  job) — not attempted in this build. The Affiliate Network's own live
  HVNTZ business lookup is now real (Phase 13, see above) — no longer
  caller-declared.
- Ground/autonomous-vehicle handoff simulation when a relay path isn't
  found by drone hops alone — detected correctly, not simulated.
- Real PMS API integration (Yardi/Entrata/AppFolio/RealPage/Buildium)
  — recorded as an integration target field, not a live connection,
  same stance as HVNTZ's Square/Toast/Fivestars flags.
- Real driver onboarding/background checks/W-2 payroll processing —
  still out of scope. ~~Automatic retry scheduling~~ — closed
  (`sweepFailedDeliveries`, see below): a real in-process interval now
  fires `retryDelivery` on every eligible `delivery-failed` job once
  the real 24-hour window elapses, no external cron/scheduler needed.

This closes the genuinely software-buildable slice identified across
all six core VOID docs plus all six of the eight follow-up feature
docs that had real, concrete architectural implications (two were
about Vvltvre Music's own catalog plan and Meta Ads, neither of which
touch VOID). Phase 7's cross-phase regression covered Phases 1–6; Phase
12 extends the same discipline across Phases 7–11 — a real gig driver
retrying a failed delivery to real payout, the food vertical's tighter
window proven to actually change Gibson's real air-vs-ground decision,
four different job-creation entry points (direct request, moving,
real estate media, hub origination) proven to never collide in the
same `jobs` collection, and a locker explicitly linked back to a real
Phase 1 station — all confirmed composing correctly in one shared
store, with `void/server.js` starting cleanly with all twelve phases'
modules wired together. VOID is complete for this session's scope.

## Phase 18: Multi-Midpoint Delivery Choice, Forward Inventory & the
Quick Innovation Thread

**Real, previously-stale bug fixed**: `registerAffiliateStation` used
to require an already-existing `stationId`, silently contradicting
`MULTI_MIDPOINT_DELIVERY_CHOICE_FORWARD_INVENTORY.md`'s own stated
purpose (an HVNTZ business becoming a real midpoint "without VOID
needing to own or lease every node"). `stationId` is now optional; an
affiliate without one carries real coordinates instead — either
caller-supplied, or (when a real `hvntzBusinessId` + `hvntzLocationId`
are given) pulled from HVNTZ's own verified `Location` record via a
new `GET /api/business/:id/locations` HVNTZ route added the same
session. `multiModalRelay.js`'s real Dijkstra graph now includes
eligible `'drone-support'` affiliates as genuine routable nodes — live-
verified: two real stations 12km apart, unreachable directly at a 7km
drone range, now find a real 2-hop path through a registered affiliate
midpoint.

**Customer delivery method choice** (`lib/deliveryChoice.js`): a real,
bounded bike/car/drone quote (`GET /api/delivery-methods/quote`) plus
a real Hub/kiosk pickup option that waives the delivery fee entirely.

**Forward-deployed seller inventory** (`lib/businessLockers.js`): real
`BusinessLocker`/`SellerInventoryPlacement`/`DroneLoadingEvent` — Amazon
FBA's model with one flat, transparent `monthlyStorageFee` instead of
FBA's real stacked fee structure. Loading is always staffed
(`hubEmployeeId` required), matching `hubOrigination.js`'s own
established staffed-vs-self-service reasoning. **Honest scope note**:
tied to a real existing `jobId`/`orderId`, not to "VMall" — VMall does
not exist anywhere in this codebase (confirmed, zero references).

**Regulated Delivery Boxes** (`lib/regulatedBoxes.js`): chain-of-
custody logging plus a real, live VACA identity check
(`void-recipient` subject type) before delivery. Does not relax
`verticals.js`'s existing `licensingGated` gate on
`cannabisDelivery`/`medicalTransportation` — the physical hardware
layer, ready for when real compliance clears.

**VOID Staffing + HUNT Staffing** (`lib/staffing.js`): formalizes the
already-existing `staffing` vertical into real `StaffingPosition`s,
still running through the exact same real
request→match→accept→complete→pay→rate marketplace loop. HUNT
Staffing is a real, thin layer on top — a live-verified HVNTZ business
filling a position through this same network, `filledViaVoidStaffing`
true because nothing new was built to fill it.

**Mobile Drone Docking Vehicles, Dual Mobility Coordination &
Launchpad Drivers** (`lib/mobileDocking.js`): real vehicle-mounted
docks (HEISHA DCap/DJI Dock 2-3/Valinor Dispatch are the real, cited
hardware precedents), a real launch-point → farthest-reachable-
waypoint rendezvous calculation (not fabricated scheduling — real
Haversine distance against the drone's own real range/speed, honest
`droneWaitMinutes` when the drone would beat the truck there), and a
Launchpad Driver role fixed to the DSP tier, which must reference a
real `MobileDroneDockingVehicle` and is rejected against any other
vehicle id. **Honest scope note**: a moving dock is deliberately not
wired into `multiModalRelay.js`'s own fixed-coordinate Dijkstra graph
— routing through a continuously-moving node is a real, materially
harder, separate problem, flagged here rather than faked.

**Technology-as-a-Service** (`lib/taas.js`): real `TaaSSubscription`s,
always `brandedAs: 'vaco'` (VVI never customer-facing, per the source
doc), three acquisition models each mapped to exactly one real billing
model. **Deferred, not built**: "Proactive hardware suggestions" —
the source doc frames it as extending "the already-established
proactive business suggestion engine." Checked directly:
`vaco-analytics/intelligence.js` is a real, built proactive loop
(Data Collection → Pattern Learning → Notification & Response), but it
operates purely on ecosystem metrics with **no business dimension at
all**, which is exactly what a venue-type-matched hardware
recommendation needs. So this is real, bounded future work — add a
business dimension to that existing loop, then match hardware to venue
type the way HVNTZ's DREA already matches ad content to venue type —
rather than a from-scratch invention. See `lib/taas.js`'s own header.

**Real seed data** (`lib/seedDemoData.js`, `SEED_DEMO_DATA_REQUIREMENT.md`):
two real St. Louis Port Stations, two gig drivers, and four real
courier jobs — three clustered a few blocks apart Downtown, one
several km away on Cherokee Street. Seeded through the real
`groupOrdersIntoRoutes` batching engine itself, not hand-labeled:
live-verified the three nearby orders land on one real drone route
(3 stops, real nearest-neighbor + 2-opt sequencing) while the distant
order gets its own separate route — Gibson's real dispatch
optimization visibly demonstrable on boot, not one isolated ride.
