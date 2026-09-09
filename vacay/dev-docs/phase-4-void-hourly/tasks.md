# Tasks — Phase 4: VOID Hourly for Sightseeing

- [x] Create `lib/voidHourly.js`: `requestSightseeing`,
      `getSightseeingRequest`, `listSightseeingRequests`.
- [x] Extend `createVacayStore()` with `sightseeingRequests`/
      `nextSightseeingRequestId`.
- [x] Wire `server.js`: real injected `requestVoidHourlyBooking` (live
      HTTP call to VOID's own `/api/hourly-booking`), 3 new endpoints
      (`POST /api/bookings/:id/sightseeing`,
      `GET /api/sightseeing/:id`,
      `GET /api/bookings/:id/sightseeing`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 12 checks): missing `driverId` rejected with the real
      explanatory limitation message; unknown booking rejected; the
      real `guestId` (not caller-supplied) used as `riderId`;
      `driverId`/rate/duration fields pass through exactly; the real
      VOID Hourly booking id is stored; round-trip and per-booking
      scoping both correct.
- [x] Verify live with VOID (8793), VACAY (8803), and the V3 mock
      (8791) all running independently: a sightseeing request without
      a `driverId` genuinely rejected, then a real request confirmed
      as a real, live booking on VOID's own server via its own
      `/api/hourly-booking/:id` endpoint (correct riderId/driverId),
      not a stubbed response.
- [x] Shut down all three servers cleanly; confirmed via follow-up
      port check.
- [x] Commit as its own change.

## Next
Cancellation/refunds, the real host-cancellation-guarantee/photo-
verification differentiation opportunities named in the comparables
doc, Flights+Stays bundling, and VPLAN itinerary generation (once
VPLAN exists as real code somewhere) -- all still deferred.
