# Tasks — Phase 1: Core Booking Loop

- [x] Create `lib/store.js`: `createVacayStore()`.
- [x] Create `lib/listings.js`: `LISTING_TYPES`, `createListing`,
      `getListing` (scoped to `type: 'stay'` only, per the real
      resolution of the source doc's Listing/Experience
      inconsistency).
- [x] Create `lib/bookings.js`: `VACAY_ESCROW_ACCOUNT`, `FEE_PERCENT`
      (15.5, real/literal), `createBooking` (real double-booking
      guard, real escrow charge), `getBooking`, `completeStay` (real
      dual payout).
- [x] Wire `server.js`: 5 endpoints (`/api/listings`,
      `/api/bookings`, `/api/bookings/:id`,
      `/api/bookings/:id/complete`), real injected `transferVCoin`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 29 checks):
      - Listing validation (missing hostId, non-positive
        pricePerNight); defaults to `type: 'stay'`/`status: 'active'`.
      - Booking rejects an unknown listing and a zero-length stay;
        real nights/totalPrice/feePercent computed correctly; guest
        charged the real total at booking time, escrow receives it;
        `hostPayout`/`platformFee` null before completion.
      - The double-booking guard rejects an exact-overlap booking
        (naming the real conflicting booking in the error) while
        back-to-back scheduling and a different listing on the same
        dates are both correctly allowed.
      - Insufficient funds throws and leaves no booking recorded.
      - `completeStay` pays the real 15.5%/84.5% split summing exactly
        to `totalPrice`, rejects a second completion, and a real,
        later, non-overlapping booking on the same listing still
        succeeds after an earlier one completes.
- [x] Verify live with `vacay/server.js` and `venvs-mock-backend`
      running independently: a real listing, a real 4-night $600
      booking, a real rejected overlapping-date booking attempt, and
      real completion settlement — host received exactly $507,
      platform kept exactly $93, escrow returned to precisely its
      starting balance.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Bug fixed during verification
The verification script itself only seeded `guest-1`'s balance in its
fake ledger, then reused `guest-2`/`guest-3`/etc. for later real
booking attempts — a test-authoring mistake, not a code bug. Fixed by
seeding all five test guest ids up front.

## Next
The separate `Experience` entity and its own booking flow, VOID
ground-transport/cleaning integration (once VACAY's own missing brief
is provided or a live judgment call is made on VOID's real job shape,
the same discipline already applied to CVNVO's VOID ride integration),
VOID Hourly for sightseeing, VPLAN itinerary generation (once VPLAN
exists as real code somewhere), cancellation/refunds, and the real
host-cancellation-guarantee/photo-verification differentiation
opportunities named in the comparables doc.
