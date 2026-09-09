# Plan — Phase 1: Core Booking Loop

## Goal
The smallest real slice of VACAY's Airbnb-model stays platform:
Listing creation → a real Booking with the 15.5% flat fee genuinely
enforced through V3 → real host settlement at stay completion. VOID
transportation/cleaning integration, VOID Hourly, VPLAN itinerary
generation, and the separate Experience entity are all explicitly
deferred, per the proposal confirmed before writing any code.

## Design
- `Listing { id, hostId, type: 'stay', pricePerNight, status }` — a
  real, flagged resolution of an inconsistency in the source doc:
  `Listing.type` names "experience" as an option, but the same doc
  separately defines a distinct `Experience` entity AND a separate API
  endpoint ("separate from stays, same host model") — the API map
  itself treats stays and experiences as two different real flows.
  This phase scopes `Listing` to stays only; `Experience` is real,
  separate, deferred work.
- `Booking { id, listingId, guestId, checkIn, checkOut, nights,
  feePercent: 15.5, totalPrice, hostPayout, platformFee, status }` —
  real escrow-then-settle shape, the same "one source, real dual
  payout" mechanism VOID MAGIC's own `bookings.js` already
  established: the guest is charged the full stay total at booking
  time, the host is paid (host share + platform fee, summing exactly
  to what was charged) only at `completeStay` — mirroring Airbnb's
  real payout timing (paid out after checkin, not at booking).
  `feePercent` is the real, literal 15.5% given directly in the source
  doc, not an interpretive borrowed rate like some other apps' fees
  this session.
- A real, structural answer to `VACAY_COMPARABLES.md`'s #3 named
  industry-wide failure pattern ("double-bookings from calendar sync
  failures"): a real interval-overlap guard against the same listing's
  other active bookings, the same real pattern VOID MAGIC's own
  double-booking guard already established for hosts' schedules.
  Failure patterns #1 (host cancellations) and #2 (misrepresented
  properties) are real, separate, deferred design opportunities, not
  addressed in this phase.

## Explicitly NOT in this task
- The `Experience` entity/booking flow (separate host model per the
  doc's own API map).
- VOID ground-transport/cleaning integration and VOID Hourly for
  sightseeing — real, later cross-app work; "VACAY's own brief" cited
  by `VOID_MASTER_FREEZE.md` as already documenting this doesn't
  actually exist anywhere in this session, flagged directly rather
  than invented.
- VPLAN itinerary generation — doesn't exist as code anywhere yet,
  same standing gap already flagged in CVNVO's own docs.
- Cancellation/refunds, a host-cancellation guarantee, photo/condition
  verification — real, evidence-based differentiation opportunities
  named in the comparables doc, not built in this phase.
- A "Flights" tab — only implied via the Expedia-bundling discussion,
  never given a real data model anywhere, not invented here.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 29
checks, one real test bug caught and fixed mid-verification — see
below): listing validation; booking rejects an unknown listing and a
zero-length stay; real nights/totalPrice/feePercent computed correctly;
guest charged the real total at booking, escrow receives it; the
double-booking guard proven against an exact-overlap case (with the
real conflicting booking named in the error) while back-to-back
scheduling and a different listing on the same dates are both
correctly allowed; insufficient funds throws and leaves no booking
behind; `completeStay` proven to pay the real 15.5%/84.5% split
summing exactly to `totalPrice`, reject a second completion, and a
real, later, non-overlapping booking on the same listing still
succeeds after an earlier one completes. Then a live pass: a real
listing, a real 4-night booking, a real rejected overlap, and real
completion settlement, all confirmed against the actual running server
and the real V3 mock ledger — escrow returned to precisely its
starting balance.

## Done when
- The full listing → booking → completion loop works with real V3
  settlement, verified live.
- The double-booking guard is proven correct against overlap,
  back-to-back, and different-listing cases.
