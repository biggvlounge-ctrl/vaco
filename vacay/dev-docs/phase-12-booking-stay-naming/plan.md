# Plan — Phase 12: Booking/Stay Naming Correction

## Goal
Direct instruction: "Booking and stay should be the same thing."
Phase 11's merge had renamed `bookings.js` → `reservations.js` inside
the Bookings section purely to avoid a file/word stutter against the
section name — the user's instruction says that stutter is fine
because they're the same concept, so the artificial "reservation"
synonym should not exist.

## Design
- `git mv` `reservations.js` → `bookings.js` and
  `experienceReservations.js` → `experienceBookings.js` back to their
  pre-merge names.
- Fix the two requires that pointed at the intermediate filename
  (`voidServices.js`, `voidHourly.js`, `server.js`).
- Go further than just the filename: move the booking resource from a
  nested `/api/bookings/reservations` path onto the Bookings section's
  own root — `POST /api/bookings` creates one, `GET /api/bookings/:id`
  reads one. The section name and the resource are now literally the
  same word at the same URL level, not two different names layered on
  top of each other.
- This introduces one real routing subtlety: `GET /experiences`
  (list) and the new `GET /:id` (a booking) are both one-segment GET
  routes under the same router, so Express's tie-breaking (first
  registered wins) matters. `/experiences` is registered first.
  Every other route pair in this section has a distinct enough shape
  (different segment count, or a literal in a different position)
  that no such care is needed — checked directly, not assumed.
- The Flights section's own `reservations.js` (a flight booking, a
  genuinely different real concept from a stay booking) was left
  alone — out of scope for this specific instruction.

## Verification approach
Plain-Node re-check (2 checks) that `createBooking`/`bookExperience`
still work from their renamed files. Then a live pass, specifically
targeting the one real risk this change introduces: a real booking
created at the section root, read back, and completed;
`GET /api/bookings/experiences` confirmed to still correctly return
the experience list (not a 404 as though "experiences" were an
invalid booking id) proving the registration-order fix actually works;
and the `/api/flights/bundles` cross-section call re-confirmed correct
against the renamed `createBooking` function.

## Done when
- No file or route path anywhere in the Bookings section uses the word
  "reservation."
- The experiences-vs-booking-id routing ambiguity is proven resolved
  live, not just reasoned about.
