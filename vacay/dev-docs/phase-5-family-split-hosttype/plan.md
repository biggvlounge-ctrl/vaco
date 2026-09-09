# Plan — Phase 5: Family Split + hostType

## Goal
Per explicit instruction: split VACAY into its real, distinct
divisions matching Airbnb, Turo, Zillow, and Booking.com — sharing the
same V3/Shield identity but genuinely separate apps, "should feel like
different apps on the inside." Same real pattern already established
for CHOPZ/CHOPZ SHOP and VENVS/VDP.

## Design
- **Experiences → `../vacay-experiences/`**: a mechanical split, same
  as CHOPZ SHOP's own split out of CHOPZ. `lib/experiences.js` and
  `lib/experienceBookings.js` were already fully self-contained (no
  dependency on `listings.js`/`bookings.js`), so this is a real,
  clean, low-risk move — `git mv`'d, logic unchanged, only the escrow/
  platform account names changed (`vacay-experiences-escrow`/
  `-platform`, genuinely distinct now that they're separate processes,
  not a shared in-memory store).
- **Booking.com → NOT a separate app**, a deliberate recommendation
  confirmed with the user first: Booking.com's real booking
  transaction is mechanically identical to Airbnb's (book for nights,
  pay, property gets paid) — the real differentiator is inventory type
  (hotels/professional vs. individual hosts), not a different economic
  model. Building a fully separate app would mean re-implementing
  `bookings.js`'s exact same escrow-then-settle shape for no real
  structural reason. `hostType: 'individual' | 'professional'` on
  `Listing` instead, proven to flow through the exact same
  `createBooking`/`completeStay` with identical settlement math.
- **Turo → `../vacay-auto/`, Zillow → `../vacay-homes/`**: genuinely
  new real divisions, built as their own separate phases/tasks (see
  each project's own dev-docs).

## Explicitly NOT in this task
Any different real behavior attached to `hostType` beyond the field
itself (verification requirements, search ranking, insurance) — real
Booking.com's professional inventory does differ in more ways than
just ownership; none of that is modeled.

## Verification approach
Plain-Node pass (6 checks) proving `hostType` validation and, most
importantly, that a professional listing's booking/settlement math is
byte-for-byte identical to an individual listing's, using the exact
same functions. `vacay-experiences`' own moved logic re-verified
standalone (7 checks) to confirm the move didn't change behavior. Then
a live pass: `vacay/server.js` and `vacay-experiences/server.js` run
as two genuinely independent processes against the same shared V3 mock
ledger — a professional stay booked/settled on one, an experience
booked/settled on the other, both confirmed via the ledger's own real
balances.

## Done when
- `vacay-experiences` runs standalone with its own store/ports/escrow
  accounts and its original behavior fully re-verified.
- A professional-hostType booking is proven to settle identically to
  an individual one, against a real ledger, not just asserted.
- Both apps run simultaneously without interfering with each other.
