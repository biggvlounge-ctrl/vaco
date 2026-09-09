# Tasks — Phase 8: Driver/Fleet Management + Failed-Delivery Retry

- [x] Create `lib/driverFleet.js`: `DRIVER_TIERS`,
      `DSP_STARTUP_CAPITAL_REQUIRED`, `registerGigDriver`,
      `getGigDriver`, `registerVoidDSP`, `getVoidDSP`,
      `addDriverToDSP`, `addVehicleToDSP`, `assignRouteToDSP`.
- [x] Extend `lib/marketplace.js`: `'delivery-failed'` status,
      `RETRY_DELAY_HOURS`, `reportFailedDelivery`, `retryDelivery`,
      `cancelJob` extended to allow cancellation from
      `delivery-failed`.
- [x] Extend `createVoidStore()` with `gigDrivers`/`voidDSPs`/
      `nextDspId`.
- [x] Wire `server.js`: 8 new endpoints (`POST /api/gig-driver`,
      `GET /api/gig-driver/:driverId`, `POST /api/void-dsp`,
      `GET /api/void-dsp/:id`, `POST /api/void-dsp/:id/driver`,
      `POST /api/void-dsp/:id/vehicle`, `POST /api/void-dsp/:id/route`,
      `POST /api/job/:id/report-failed`, `POST /api/job/:id/retry`).
- [x] Verify pure logic in plain Node (throwaway `.cjs`, deleted after
      — 11 checks, all passed clean on first run):
      - `registerGigDriver` requires `driverId`, records
        `certifiedVerticals` correctly.
      - `registerVoidDSP` rejects capital below $30,000, defaults to
        it, starts with empty fleets.
      - Fleet mutators dedupe correctly and throw for an unknown DSP.
      - `reportFailedDelivery` rejects a job not in `accepted`;
        `retryDelivery` rejects an early retry (10h in) and succeeds
        after the real 24-hour window (25h in), incrementing
        `retryCount`; `completeJob` succeeds normally afterward.
      - `cancelJob` works from `delivery-failed`.
- [x] Verify live with `void/server.js` running alone: a real gig
      driver and DSP (with driver/vehicle/route) registered through
      the HTTP API; a real job driven to `delivery-failed` and an
      early retry correctly rejected with the real remaining-hours
      message.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 9: the food-delivery vertical, food-capable stations, and the
Meituan-style demand-smoothing/batching upgrade — three docs that all
converged on the same missing piece.
