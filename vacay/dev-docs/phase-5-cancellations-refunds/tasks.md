# Tasks — Phase 5: cancellation + refunds across every section

- [x] Re-read all five booking flows and VOID MAGIC's own
      `cancelBooking` as the reference pattern.
- [x] `bookings/bookings.js` — `cancelBooking` (24h-before-checkIn
      cutoff, late cancellation settles to host like `completeStay`).
- [x] `bookings/experienceBookings.js` — `cancelExperienceBooking`
      (24h-before-`scheduledAt` cutoff, late cancellation settles to
      host, capacity freed back either way).
- [x] `auto/rentals.js` — `cancelRental` (24h-before-`startDate`
      cutoff, late cancellation settles to owner via `hostEarnPercent`).
- [x] `auto/fleetRentals.js` — `cancelFleetRental` (same cutoff, late
      cancellation settles the full price to VACAY's own fleet
      revenue account, no split).
- [x] `flights/reservations.js` — `cancelFlightBooking` (the real DOT
      24-hour-from-booking rule; refund sourced from the airline/
      platform accounts directly; seat restored only on a real refund).
- [x] `bookings/routes.js`, `auto/routes.js`, `flights/routes.js` —
      5 new `POST .../:id/cancel` routes wired.
- [x] 8 plain-Node checks — all passing.
- [x] Live pass: real V3 + VACAY started (post-cutover defaults), a
      real Stays booking's full refund and a real flight's full DOT-rule
      refund both independently confirmed against V3's own balance.
- [x] Shut down all test servers.
- [x] Update `vacay/README.md` — new Phase 5 bullets across "What's
      here" for all three affected sections, a new "Verified"
      paragraph, and the resolved item removed from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
Fare-class-specific flight refund policies and mid-trip partial stay
refunds remain real, separate, undocumented features -- not attempted
here.
