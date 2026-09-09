# Plan — Phase 2 (first slice): VOID Event Services

## Goal
Phase 2 per Section 40 is broad (Security, Transportation, Venue
booking, Staff, Digital waiting rooms, Hybrid experiences, Media,
Creator analytics, Customer profiles, Advanced scheduling,
Geofencing, Notifications) -- per this session's standing scope
discipline, this is the first real slice only: Section 8's VOID Event
Services (Security, Transport, Space, Staffing, Fulfillment), the
piece Section 47 names as the defining architectural principle
("direct app-to-app relationships" -- VOID MAGIC calls VOID's own
APIs directly, not through a V4 message bus) and the one with the most
real, already-built infrastructure to connect to (VOID's own 18+
vertical job marketplace).

## Design
- `lib/eventServices.js`: one real `EventServiceRequest` model across
  all five service types, mirroring VOID's own "one loop for many
  types" design rather than building five separate real models (SS38
  names `SecurityAssignment`/`StaffAssignment`/`Transportation`
  separately but gives no field shapes -- flagged as an interpretive
  simplification).
- Real, interpretive vertical mapping (VOID MAGIC's brief never names
  VOID's vertical ids): security -> `security`, transport ->
  `transportation`, space -> `eventPlanning` (VOID has no dedicated
  venue vertical; event planning is the closest real fit), staffing ->
  `staffing`, fulfillment -> `courier` (the same real vertical CHOPZ
  SHOP already uses).
- Real payment model: the host is the real customerId on VOID's job
  (event organizers pay for security/staff/venue/transport, not
  attendees) -- payment itself happens entirely inside VOID's own
  `completeJob` once the job is completed; VOID MAGIC only
  orchestrates the request, mirroring CHOPZ SHOP's `requestFulfillment`
  pattern exactly (a separate step, an injected `voidRequestFn`, no
  local payment duplication).

## Explicitly NOT in this phase
Digital waiting rooms, Hybrid experiences, Media, Creator analytics,
Customer profiles, Advanced scheduling, Geofencing, Notifications --
all real, separate Phase 2 pieces, deferred to their own later slices
per this session's standing "one real slice at a time" discipline.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 22
checks): every one of the five service types proven to map to its
real, distinct VOID vertical; the host (not the attendee) confirmed as
the real customerId passed to VOID; quantity/unitPrice passed through
exactly; rejections for an unknown experience, an invalid service
type, non-positive quantity, and a missing `voidRequestFn`; listing
proven scoped per-experience, not global. Then a live pass: VOID,
VOID MAGIC, and the V3 mock all running independently -- a real
experience created, real security and staffing requests placed against
it, and both confirmed as real, live jobs on VOID's own server via its
own `/api/job/:id` endpoint (correct vertical, correct host as
customerId) -- not a stubbed response. The existing MVP booking flow
(experience -> booking -> check-in -> completion) reconfirmed
unaffected by this phase's changes.

## Done when
- All five event service types create real, verifiable jobs on VOID's
  own server through actually-called code, not stubs.
- The existing Phase 1 MVP loop still passes.
