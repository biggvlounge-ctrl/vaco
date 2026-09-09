# Tasks — Phase 2 (first slice): VOID Event Services

- [x] Create `lib/eventServices.js`: `EVENT_SERVICE_TYPES`,
      `EVENT_SERVICE_TO_VOID_VERTICAL`, `requestEventService`,
      `getEventServiceRequest`, `listEventServiceRequests`.
- [x] Extend `createVoidMagicStore()` with `eventServiceRequests`/
      `nextEventServiceRequestId`.
- [x] Wire `server.js`: real injected `requestVoidJob` (live HTTP call
      to VOID's own `/api/job`), 3 new endpoints
      (`POST /api/experiences/:id/event-services`,
      `GET /api/event-services/:id`,
      `GET /api/experiences/:id/event-services`), `eventServiceTypes`
      added to the health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 22 checks): all five service types map to their real,
      distinct VOID verticals; the host (not the attendee) is the real
      customerId; quantity/unitPrice pass through exactly; the real
      VOID job id is stored; rejections for an unknown experience, an
      invalid service type, non-positive quantity, and a missing
      `voidRequestFn`; listing is scoped per-experience and rejects an
      unknown experience.
- [x] Verify live with VOID (8793), VOID MAGIC (8797), and the V3 mock
      (8791) all running independently: a real experience created, a
      real security request and a real staffing request placed against
      it, both confirmed as real, live jobs on VOID's own server via
      its own `/api/job/:id` endpoint (correct vertical, correct host
      as customerId, not a stubbed response). The existing MVP booking
      flow (experience -> booking) re-run and reconfirmed unaffected.
- [x] Shut down all three servers cleanly; confirmed via follow-up
      port check.
- [x] Commit as its own change.

## Next
Digital waiting rooms, Hybrid experiences, Media, Creator analytics,
Customer profiles, Advanced scheduling, Geofencing, Notifications --
the rest of Phase 2, each its own real, later slice.
