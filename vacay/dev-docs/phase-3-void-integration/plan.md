# Plan — Phase 3: VOID Integration

## Goal
`VOID_MASTER_FREEZE.md`'s own cross-app integration map names this
connection outright: "VACAY | Ground transportation, cleaning/
maintenance for stays/rentals." That doc cites "VACAY's own brief" as
already documenting the detail -- no such document exists anywhere in
this session (flagged since Phase 1's own README), so this phase
builds a real, defensible interpretation grounded in VOID's actual,
already-built vertical list, not an invented one.

## Design
- `lib/voidServices.js`: real cross-app calls into VOID's own job
  marketplace, the same pattern already established twice this session
  (CHOPZ SHOP's `requestVoidCourierJob`, VOID MAGIC's
  `eventServices.js`). Two real, distinct service types:
  `transportation` -> VOID's real `transportation` vertical, requested
  by the GUEST (their own real logistics need during the stay);
  `cleaning` -> VOID's real `cleaningHandyman` vertical, requested by
  the HOST (real-world turnover cleaning is the host's operational
  cost, not the guest's) -- two different real requesters, not the
  same party either way.
- Real payment model: VOID's own job settles its own payout (driver/
  cleaner paid, VOID's own take rate) entirely inside VOID once the
  job completes. VACAY only orchestrates the request, mirroring CHOPZ
  SHOP's `requestFulfillment` exactly -- no local payment duplication.

## Explicitly NOT in this task
VOID Hourly for sightseeing (a distinct, separate real integration
point VOID's own freeze doc names as "New," not "already documented"
like ground transport/cleaning) -- deferred to its own later slice.
VPLAN itinerary generation -- doesn't exist as code anywhere yet.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 16
checks): transportation and cleaning both proven to map to their real,
distinct VOID verticals; the real, distinct requester per service type
confirmed (guest for transportation, host for cleaning); quantity/
unitPrice pass through exactly; the real VOID job id is stored;
rejections for an unknown booking, an invalid service type,
non-positive quantity, and a missing `voidRequestFn`; listing is
scoped per-booking and rejects an unknown booking. Then a live pass:
VOID, VACAY, and the V3 mock all running independently -- a real
transportation request and a real cleaning request placed against a
real booking, both confirmed as real, live jobs on VOID's own server
via its own `/api/job/:id` endpoint (correct vertical, correct
requester), not stubbed responses.

## Done when
- Both service types create real, verifiable jobs on VOID's own server
  through actually-called code, not stubs.
- The guest/host requester split is proven correct, both in isolation
  and live.
