# Tasks — Phase 5: Scheduling engine

- [x] Create `lib/reserveBooking.js`: `MAX_ADVANCE_BOOKING_DAYS`,
      `FREE_CANCELLATION_WINDOW_MINUTES`, `createReserveBooking`,
      `getReserveBooking`, `matchReserveDriver`, `cancelReserveBooking`.
- [x] Create `lib/commuteScheduling.js`: `WINDOWS`, `MAX_CARPOOL_SIZE`,
      `CARPOOL_PROXIMITY_KM`, `openCommuteBatch`, `getCommuteBatch`,
      `submitCommuteRequest`, `runBatchMatch`.
- [x] Create `lib/dedicatedLanes.js`: `RECURRENCE_SCHEDULES`,
      `createDedicatedLane`, `getDedicatedLane`, `claimDedicatedLane`,
      `releaseDedicatedLane`, `postSpotLoad`, `getSpotLoad`,
      `bookSpotLoad`.
- [x] Create `lib/hourlyBooking.js`: `MIN_BLOCK_HOURS`,
      `MAX_BLOCK_HOURS`, `DEFAULT_INCLUDED_MILES_PER_HOUR`,
      `createHourlyBooking`, `getHourlyBooking`, `addHourlyStop`,
      `computeHourlyCharge`.
- [x] Extend `createVoidStore()` (in `store.js`) with
      `reserveBookings`/`commuteBatches`/`dedicatedLanes`/`spotLoads`/
      `hourlyBookings` and their `next*Id` counters.
- [x] Wire `server.js`: 17 new endpoints across the four surfaces.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 18 checks, all passed clean on first run using a
      fixed reference timestamp for deterministic window testing):
      - Reserve: rejects a past pickupTime and one beyond 90 days;
        `matchReserveDriver` succeeds before pickup time and rejects
        at/after it; cancellation correctly free at 120 minutes out
        and fee-applying at 30 minutes out (straddling the real
        60-minute boundary).
      - Commute: a late submission rejected; `runBatchMatch` rejected
        before the deadline; after the deadline, two riders ~0.1km
        apart correctly grouped into one carpool, a third rider ~300km
        away correctly left unmatched with
        `backupOnDemandGuaranteed: true`; a submission after matching
        correctly rejected.
      - Dedicated Lanes: invalid `recurrenceSchedule` rejected; a
        second carrier's claim on an already-committed lane rejected;
        `releaseDedicatedLane` correctly reopens the lane for a new
        claim; `bookSpotLoad` one-click accepts and rejects a second
        booking attempt on the same load.
      - Hourly: `blockHours` outside 2–8 rejected on both ends; stops
        recorded correctly; charge within allowance is base-rate only;
        charge with both mileage overage (15mi over @ $1/mi = $15) and
        time overage (30min over @ $0.5/min = $15) computed correctly
        together (total $150 on a $120 base).
- [x] Verify live with `void/server.js` running alone:
      - A real Reserve booking created and matched before pickup time
        through the actual HTTP API.
      - A real Commute batch with a 1-second deadline: a match attempt
        immediately after opening correctly rejected
        ("cannot run before the batch deadline"); after a real
        wall-clock `sleep` past the deadline, two riders ~0.1km apart
        correctly grouped into one carpool.
      - A Dedicated Lane claimed by one carrier, a second carrier's
        claim correctly rejected.
      - A Spot Load posted and booked one-click.
      - An Hourly booking with a stop added and a charge computed
        live — `baseCharge: 120`, `overageMiles: 15`,
        `mileageOverageCharge: 15`, `overageMinutes: 30`,
        `timeOverageCharge: 15`, `totalCharge: 150` — exactly matching
        the plain-Node pass.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`
      that the port no longer accepted connections.
- [x] Commit as its own change.

## Next
The deterministic rule-layer underneath Gibson's dispatch behavior
(air-vs-ground decision rule, load intelligence scoring) and Kyle's
dead-time suggestions — the last named-agent-adjacent pieces that are
genuinely deterministic logic, not a fake AI call.
