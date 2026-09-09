# Plan — Phase 10: Moving Services + Real Estate Media

## Goal
Resolves the two verticals from `VOID_MOVING_REAL_ESTATE_MEDIA.md`,
building each the way earlier analysis concluded it should be built:
Moving Services as a real enrichment of the existing `freightMoving`
vertical (never actually a separate thing, just under-specified since
Phase 3), and Real Estate Media as a genuinely new, distinct vertical.

## Design
- `lib/movingServices.js`: `createMovingJob()` creates a real
  underlying marketplace job (`requestJob`, `verticalId:
  'freightMoving'`), then wraps it with the real GoShare/Dolly data
  model — vehicle tier, real bookable equipment, and a helper crew
  capped at what was actually requested (`addMovingHelper` rejects
  once the crew is full).
- `lib/realEstateMedia.js`: `realEstateMedia` registered as its own
  vertical (distinct from generic `photography`). `assignNearestProvider()`
  is the real HomeJab mechanic — automated match by real distance
  (reusing `geo.js`'s Haversine helper), not bidding — proven against
  a two-provider case where the geometrically nearer one is picked
  over one that happens to be listed first.
- `server.js`: 7 new endpoints.

## Explicitly NOT in this task
- No real driver-vehicle-capability matching engine (filtering the gig/
  DSP pool by actual vehicle tier and equipment on hand) — `assignMovingDriver`
  takes an explicit `driverId`, same pattern as every other assignment
  function in this project.
- No centralized post-production pipeline itself — `postProductionHandled`
  is a real, validated field, not an implemented media-processing system.

## Verification approach
Plain-Node pass first (throwaway `.cjs`, deleted after — 9 checks).
Then a live pass: `void/server.js` running alone — a real moving job
and a real real-estate media job both confirmed to have created
distinct, independently-retrievable marketplace jobs
(`GET /api/job/1`, `GET /api/job/2`), and the proximity matcher
confirmed to pick the geometrically nearer of two live-supplied
providers, not the first one in the request body.

## Done when
- `createMovingJob` rejects invalid vehicle tier/equipment/helper
  count and creates a real, correctly-priced `freightMoving` job.
- `addMovingHelper` caps at `helpersRequested`.
- `createRealEstateMediaJob` rejects invalid services/post-production
  mode/missing coordinates and creates a real, distinct
  `realEstateMedia` job.
- `assignNearestProvider` picks the true nearest provider by distance,
  not list order, and rejects an empty provider list.
- Live: both job types and the proximity match confirmed through the
  real HTTP API, with the underlying marketplace jobs independently
  verified.
