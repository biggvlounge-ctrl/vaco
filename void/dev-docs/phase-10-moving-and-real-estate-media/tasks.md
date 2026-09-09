# Tasks — Phase 10: Moving Services + Real Estate Media

- [x] Create `lib/movingServices.js`: `VEHICLE_TIERS`,
      `EQUIPMENT_OPTIONS`, `createMovingJob`, `getMovingJob`,
      `assignMovingDriver`, `addMovingHelper`.
- [x] Create `lib/realEstateMedia.js`: `REAL_ESTATE_SERVICES`,
      `POST_PRODUCTION_MODES`, `createRealEstateMediaJob`,
      `getRealEstateMediaJob`, `assignNearestProvider`.
- [x] Register `realEstateMedia` vertical in `lib/verticals.js`.
- [x] Extend `createVoidStore()` with `movingJobs`/`nextMovingJobId`/
      `realEstateMediaJobs`/`nextRealEstateMediaJobId`.
- [x] Wire `server.js`: 7 new endpoints.
- [x] Verify pure logic in plain Node (throwaway `.cjs`, deleted after
      — 9 checks, all passed clean on first run):
      - `createMovingJob` rejects invalid vehicle tier, equipment, and
        negative helper count; creates a real underlying
        `freightMoving` job with the correct price.
      - `assignMovingDriver`/`addMovingHelper` build the crew
        correctly, rejecting a helper add once `helpersRequested` is
        met.
      - `createRealEstateMediaJob` rejects an empty services list, an
        invalid service, and an invalid post-production mode; creates
        a real underlying `realEstateMedia` job.
      - `assignNearestProvider` picks the true geometric nearest of
        two providers (not list order) and rejects an empty provider
        list.
      - `getMovingJob`/`getRealEstateMediaJob` return `null`, not throw,
        for unknown ids.
- [x] Verify live with `void/server.js` running alone: a real moving
      job and real estate media job both created real, distinct,
      independently-retrievable marketplace jobs
      (`freightMoving`/`realEstateMedia`); the proximity matcher
      correctly picked a live-supplied near provider (0.34km) over a
      far one (~280km) through the actual HTTP API.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 11: Hub Walk-Up Origination and the Apartment/University Locker
Network (including Locker-to-Door) — the two remaining follow-up docs.
