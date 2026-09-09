# Plan — Phase 5: cancellation + refunds across every section

## Goal
Close this project's own previously-flagged, whole-app gap:
"Cancellation/refunds across any section." Part of a broader
ecosystem-wide sweep to close every genuinely codeable remaining gap,
confirmed with the user before starting.

## Real investigation before any code
Re-read all five booking flows (`bookings/bookings.js` Stays,
`bookings/experienceBookings.js` Experiences, `auto/rentals.js` Turo,
`auto/fleetRentals.js` Fleet, `flights/reservations.js` Flights) to
find their exact real escrow/settlement shapes, and re-read VOID
MAGIC's own already-shipped `cancelBooking` (this session's first real
cancellation build) as the reference pattern to reuse rather than
reinvent.

## Design
Four of the five sections (Stays, Experiences, Turo, Fleet) share one
real shape, directly reusing VOID MAGIC's own established
`CANCELLATION_CUTOFF_HOURS = 24` pattern: a full refund if cancelled
at least 24 hours before the relevant start time (check-in /
`scheduledAt` / `startDate`), a late cancellation settling to the
host/owner/fleet exactly like that section's own `complete*` function
already does (same escrowed source, same split, summing to the full
original charge) rather than inventing a third split -- the real
justification is identical across all four: the host/owner held
reserved capacity through the cutoff that couldn't be resold.
Experience cancellation additionally frees the real capacity slot back
regardless of refund eligibility, since a cancelled seat is genuinely
available again either way.

Flights is genuinely different and gets its own real rule, not a
forced fit of the same shape: since `bookFlight` already settles
instantly (no future "trip completion" to wait for -- see that file's
own header), there's no "before start" cutoff that makes sense. Instead
this uses a real, actual, federally-mandated US rule: the DOT's "24-Hour
Rule" (14 CFR 259.5), a full refund if cancelled within 24 hours of the
BOOKING itself. Since the airline and platform already received their
shares at booking time, the refund is sourced back from those two
accounts directly, not from the (already-empty-for-this-booking) escrow
account. Outside that window, cancellation is real and non-refundable --
this project's Flight entity has no fare-class refundability modeled at
all, so nothing is invented to fill that gap rather than honestly
leaving it non-refundable.

## Explicitly NOT in this task
Fare-class-specific refund policies for flights (basic economy vs.
flexible) -- undocumented, not invented. Partial/prorated refunds for
a stay cancelled mid-trip -- no section anywhere in this project
models a stay being cancelled after check-in. Any UI.

## Verification approach
8 plain-Node checks spanning all five booking types' real refund/
late-settlement/capacity-freeing/seat-freeing behavior. A live pass
against the real running server and the real standalone V3 (post
ecosystem-cutover): a real Stays booking's full charge refunded on
early cancellation, and a real flight booking's full charge refunded
under the real DOT 24-hour rule, both independently confirmed against
V3's own balance.

## Done when
Every one of VACAY's five booking flows has a real, tested,
live-verified cancellation path, and the README's own "Not yet built"
list no longer names this gap.
