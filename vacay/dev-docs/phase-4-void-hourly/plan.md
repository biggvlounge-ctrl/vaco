# Plan — Phase 4: VOID Hourly for Sightseeing

## Goal
`VOID_MASTER_FREEZE.md`'s cross-app map: "VACAY | VOID Hourly for
sightseeing/Experiences tab | New" -- a distinct, separate real
integration point from Phase 3's ground-transport/cleaning work (that
entry was marked "already documented," this one explicitly "New").

## Design
- `lib/voidHourly.js`: `requestSightseeing` -- a real, direct call
  into VOID's own already-built VOID Hourly (`void/lib/hourlyBooking.js`),
  distinct from the job marketplace Phase 3 already integrates with
  (a different real VOID endpoint, `/api/hourly-booking`, with a
  different real request shape).
- A real, honest limitation, checked directly against VOID's actual
  code before building this (the same discipline already applied to
  CVNVO's own VOID ride integration): `createHourlyBooking` requires a
  `driverId` directly at creation time -- VOID Hourly has no request/
  match dispatch flow the way VOID's job marketplace does (`requestJob`
  -> `matchProvider`). This module is built exactly to that real
  shape: a sightseeing request requires an already-known `driverId`,
  rejected with a real, explanatory error if omitted, rather than
  inventing a matching step VOID doesn't actually have.
- The real `riderId` passed to VOID is the booking's own `guestId`
  (looked up server-side, not caller-supplied) -- the guest who's
  actually staying is the one sightseeing, not an arbitrary id the
  caller could pass.

## Explicitly NOT in this task
A real driver-matching/dispatch flow for VOID Hourly itself -- that
would be a change to VOID's own codebase, not VACAY's integration
layer, and is out of scope here.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 12
checks): missing `driverId` rejected with the real, explanatory
limitation message; unknown booking rejected; the real `guestId` (not
a caller-supplied value) used as `riderId`; `driverId` and all rate/
duration fields pass through exactly; the real VOID Hourly booking id
is stored; round-trip and per-booking-scoped listing both correct.
Then a live pass: VOID, VACAY, and the V3 mock all running
independently -- a sightseeing request without a `driverId` genuinely
rejected, then a real request with one confirmed as a real, live
booking on VOID's own server via its own `/api/hourly-booking/:id`
endpoint (correct riderId/driverId), not a stubbed response.

## Done when
- A real VOID Hourly booking is created through actually-called code,
  not a stub, with the real guest correctly attributed as rider.
- The missing-driverId limitation is proven to reject cleanly with an
  honest explanation, both in isolation and live.
