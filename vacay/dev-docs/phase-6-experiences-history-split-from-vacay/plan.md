# Plan — Phase 1: Split from VACAY

## Goal
Give Airbnb Experiences its own standalone app, split out of VACAY's
own Stays app, per explicit instruction that VACAY's real divisions
(Airbnb, Airbnb Experiences, Turo, Zillow, Booking.com) should feel
like genuinely separate apps, not one blended process.

## Design
`lib/experiences.js` and `lib/experienceBookings.js` were already
self-contained within VACAY (no real dependency on `listings.js`/
`bookings.js`), so this is a mechanical `git mv`, not a rewrite. The
one real, deliberate change: distinct escrow/platform account names
(`vacay-experiences-escrow`/`-platform`) now that this is a genuinely
separate process with no shared in-memory store with Stays.

## Verification approach
Re-run the original Phase 2 plain-Node suite (7 representative checks)
against the moved code to confirm the move itself introduced no
behavior change. Then a live pass: this app and `../vacay/server.js`
run simultaneously as independent processes against the same shared V3
mock ledger, proving no interference and correct, independent
settlement on each side.

## Done when
The moved app runs standalone, its original behavior is fully
re-verified, and it coexists cleanly with Stays running at the same
time against the same shared ledger.
