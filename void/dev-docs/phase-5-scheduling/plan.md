# Plan — Phase 5: Scheduling engine (Reserve, Commute, Dedicated Lanes, Hourly)

## Goal
`VOID_MASTER_FREEZE.md`'s own framing: "one underlying scheduling
engine, four surfaces" — VOID Reserve for rides, VOID Commute for
recurring carpool, VOID Dedicated Lanes for recurring freight/business,
plus VOID Hourly's time-block pricing. Each surface is explicitly
modeled on a real, named comparable (Uber Reserve, Scoop, DAT/
Truckstop, Uber Hourly) with a specific real mechanic, not a vague
"scheduling feature" — this phase builds each mechanic as real,
distinct code.

## Design
- `lib/reserveBooking.js` (Uber Reserve): `MAX_ADVANCE_BOOKING_DAYS = 90`,
  `FREE_CANCELLATION_WINDOW_MINUTES = 60`, both real numbers from the
  doc. `matchReserveDriver()` enforces the doc's own "attempted before
  the scheduled pickup time, not last-minute dispatch" framing by
  rejecting a match attempt at or after pickup time.
  `cancelReserveBooking()` computes the real fee-window boundary.
- `lib/commuteScheduling.js` (Scoop): `openCommuteBatch()`/
  `submitCommuteRequest()`/`runBatchMatch()` implement the doc's real
  "deadline-based batch match... runs once at the deadline, not
  continuously" mechanic literally — `runBatchMatch` rejects running
  before the deadline, and `submitCommuteRequest` rejects a submission
  after it. Real nearest-neighbor grouping (reusing `geo.js`'s
  Haversine helper) up to `MAX_CARPOOL_SIZE = 3` (flagged, interpretive
  — no doc-specified group size) within `CARPOOL_PROXIMITY_KM = 5`
  (flagged, interpretive). Anyone left without a real match gets
  `backupOnDemandGuaranteed: true` — the doc's own "backup on-demand
  ride guarantee," implemented as a real flag on the response rather
  than left as prose.
- `lib/dedicatedLanes.js` (DAT/Truckstop): two genuinely separate real
  mechanisms per the doc's own explicit distinction — `createDedicatedLane`/
  `claimDedicatedLane` (one carrier committed exclusively to a
  recurring origin-destination lane at a time) vs. `postSpotLoad`/
  `bookSpotLoad` (a one-off, one-click "Book It Now" spot-market load,
  no recurring commitment).
- `lib/hourlyBooking.js` (Uber Hourly): `MIN_BLOCK_HOURS = 2`,
  `MAX_BLOCK_HOURS = 8` (real numbers from the doc). The doc's "flat
  hourly rate plus per-mile/per-minute overage past an included
  allowance" is implemented as two real, separate overage checks — a
  per-block mileage allowance (`DEFAULT_INCLUDED_MILES_PER_HOUR = 20`,
  flagged interpretive — no doc-given number) and real time overage
  past the committed block hours, each charged at its own real rate.
- `server.js`: 17 new endpoints across the four surfaces.

## Explicitly NOT in this task
- No background scheduler that automatically attempts Reserve matching
  as pickup time approaches, or automatically triggers a Commute
  batch's `runBatchMatch` at its deadline — both are exposed as real,
  callable operations with the real timing rules enforced, not a
  cron-style background process (this session has no persistent
  background job runner).
- No real driver-toggle/vertical-filter integration for Reserve
  matching — `matchReserveDriver` takes an explicit `driverId`.
- No actual on-demand dispatch triggered by
  `backupOnDemandGuaranteed` — the flag is real and correct, but
  wiring it to an actual on-demand ride request is a follow-on
  integration, not built here.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 18
checks, all passed clean on first run, using a fixed reference
timestamp for deterministic time-window testing rather than
`Date.now()`). Then a live pass: `void/server.js` running alone — a
real Reserve booking matched before pickup time, a real Commute batch
that correctly rejects an early match attempt and then correctly
groups two nearby riders after its deadline passes (using a real
1-second deadline and an actual `sleep`, not a mocked clock), a
Dedicated Lane correctly blocking a second carrier's claim, a Spot
Load booked one-click, and an Hourly booking's overage charge computed
correctly for both mileage and time.

## Done when
- `createReserveBooking` rejects a past `pickupTime` and one beyond 90
  days; `matchReserveDriver` rejects matching at or after pickup time;
  `cancelReserveBooking` correctly distinguishes free vs. fee-applying
  cancellations at the 60-minute boundary.
- `runBatchMatch` rejects running before its deadline;
  `submitCommuteRequest` rejects both a late submission and one after
  the batch has already matched; real proximity-based grouping
  produces correct carpool groups and correctly flags an unmatched
  rider with the backup guarantee.
- `claimDedicatedLane` is exclusive (a second claim on a committed lane
  is rejected) and `releaseDedicatedLane` correctly reopens it;
  `bookSpotLoad` is one-click and rejects a second booking attempt.
- `createHourlyBooking` rejects `blockHours` outside 2–8;
  `computeHourlyCharge` correctly charges only the base rate within
  allowance, and correctly computes both mileage and time overage
  together when both are exceeded.
- Live: all four surfaces confirmed through the real HTTP API,
  including a real deadline passing in wall-clock time for the Commute
  batch match, matching the plain-Node pass.
