# Tasks — Phase 3: VOID Integration

- [x] Create `lib/voidServices.js`: `VOID_SERVICE_TYPES`,
      `VOID_SERVICE_TO_VERTICAL`, `requestVoidService`,
      `getVoidServiceRequest`, `listVoidServiceRequests`.
- [x] Extend `createVacayStore()` with `voidServiceRequests`/
      `nextVoidServiceRequestId`.
- [x] Wire `server.js`: real injected `requestVoidJob` (live HTTP call
      to VOID's own `/api/job`), 3 new endpoints
      (`POST /api/bookings/:id/void-services`,
      `GET /api/void-services/:id`,
      `GET /api/bookings/:id/void-services`), `voidServiceTypes` added
      to the health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 16 checks): transportation/cleaning map to their real,
      distinct VOID verticals; the real, distinct requester per
      service type (guest vs. host); quantity/unitPrice pass through
      exactly; the real VOID job id is stored; rejections for an
      unknown booking, an invalid service type, non-positive quantity,
      and a missing `voidRequestFn`; listing scoped per-booking and
      rejects an unknown booking.
- [x] Verify live with VOID (8793), VACAY (8803), and the V3 mock
      (8791) all running independently: a real transportation request
      and a real cleaning request placed against a real booking, both
      confirmed as real, live jobs on VOID's own server via its own
      `/api/job/:id` endpoint (correct vertical, correct requester,
      not a stubbed response).
- [x] Shut down all three servers cleanly; confirmed via follow-up
      port check.
- [x] Commit as its own change.

## Next
VOID Hourly for sightseeing (Experiences tab), VPLAN itinerary
generation, cancellation/refunds, the real host-cancellation-guarantee/
photo-verification differentiation opportunities, and Flights+Stays
bundling -- all still deferred.
