# Tasks — Phase 4: Passenger, Cargo & Load Management

- [x] Create `lib/loadManagement.js`: `DEFAULT_BAGS_PER_PASSENGER`,
      `declareTrip`, `getTripDeclaration`,
      `registerVehicleCapacityProfile`, `getVehicleCapacityProfile`,
      `checkCapacityFit`.
- [x] Create `lib/cargoPricing.js`: `BASE_OVERSIZED_ITEM_FEE`,
      `WEIGHT_SURCHARGE_PER_LB_OVER_50`, `MAX_CARGO_FEE`,
      `computeDynamicCargoPricing`.
- [x] Create `lib/sequencing.js`: `STOP_TYPES`, `PRIORITY_BY_TYPE`,
      `computeSequencing`.
- [x] Extend `createVoidStore()` (in `store.js`) with
      `tripDeclarations`/`vehicleProfiles`.
- [x] Wire `server.js`: 6 new endpoints (`POST /api/trip-declaration`,
      `GET /api/trip-declaration/:tripId`,
      `POST /api/vehicle-capacity-profile`,
      `GET /api/vehicle-capacity-profile/:vehicleId`,
      `GET /api/capacity-fit/:tripId`, `GET /api/cargo-pricing/:tripId`,
      `POST /api/sequencing`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 21 checks, all passed clean on first run):
      - `declareTrip`: smart defaults (passengerCount 1, bagsIncluded
        computed); rejects mismatched adult+child counts, missing
        tripId/vehicleId, non-positive passengerCount, negative
        carSeatsNeeded, an oversizedItem missing type/sizeCubicFt, a
        package missing category/sizeCubicFt/weightLbs; a service
        animal is never added to oversizedItems and never causes
        rejection.
      - `registerVehicleCapacityProfile` rejects non-positive
        seatingCapacity/cargoCapacityCubicFt.
      - `checkCapacityFit`: passes a real trip within profile; fails
        with a specific reason for over-seating, over-cargo-volume,
        and a single item exceeding maxPackageSizeCubicFt
        (recommending a larger vehicle) — each checked independently;
        throws for an unknown trip or a trip whose vehicle has no
        registered profile.
      - `computeDynamicCargoPricing`: computes a real fee (2 oversized
        items + 70lb package → itemFee 10, weightFee 2, totalFee 12,
        hand-verified); caps correctly at `MAX_CARGO_FEE` under a
        30-item overload case; rejects a non-declaration input.
      - `computeSequencing`: orders food > passenger > package by
        default; gives packages parity with passengers on a dedicated
        delivery route (food still sequenced first); rejects an
        invalid stop type and an empty stop list.
- [x] Verify live with `void/server.js` running alone:
      - A real vehicle capacity profile registered; a trip declared
        with a service animal + an oversized item + a 60lb package;
        capacity fit correctly returned `fits: true`; dynamic cargo
        pricing correctly returned `totalFee: 6` (itemFee 5 + weightFee
        1 for 10lbs over the 50lb threshold), matching hand
        computation.
      - The sequencing endpoint correctly returned food-first ordering
        for a mixed food/passenger/package stop list.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`
      that the port no longer accepted connections.
- [x] Commit as its own change.

## Next
Scheduling engine (VOID Reserve, Commute, Dedicated Lanes, Hourly) —
one underlying scheduling engine, four real-world-comparable surfaces,
per `VOID_MASTER_FREEZE.md`'s own framing.
