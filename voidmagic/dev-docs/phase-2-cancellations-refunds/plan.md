# Plan — Phase 2 (ninth slice): cancellations/refunds

## Goal
Close the README's own previously-flagged gap: no cancellation or
refund path exists anywhere in `lib/bookings.js`, despite the brief
naming a real "Refund policy" field (SS29) and listing refunds as a
real line item in the event financial model (SS27).

## Real investigation before any code
Read `lib/bookings.js` in full first: the real escrow model already in
place (`bookExperience` charges the customer into
`VOID_MAGIC_ESCROW_ACCOUNT` immediately; `completeExperience` is the
only point money leaves escrow, as a real dual payout — host share +
platform fee via `PLATFORM_TAKE_RATE`). This means a pre-completion
cancellation is a comparatively simple reversal, not a clawback.

Grepped `VOID_MAGIC_MASTER_BUILD_BRIEF.md` for `-i "cancel|refund"`
and `-i "cancellation|cutoff|no-show|reschedul"`. Found: SS16 (refunds
route through V3, same as every other settlement here), SS27 (refunds
named in the financial model, no rate given), SS29 ("Refund policy"
shown on the experience page, no policy specified), SS41 (no-shows
tracked as an analytics metric, not a policy). No cancellation window
or refund percentage is cited anywhere in the source doc.

## Design
Real, flagged interpretive choice, same discipline as
`PLATFORM_TAKE_RATE` itself (which cites VACAY's own real 15.5%
Airbnb-style comparable): ground the cancellation window in Airbnb
Experiences' own real, well-known, publicly documented policy — full
refund if cancelled at least 24 hours before the experience starts, no
refund after that cutoff. `CANCELLATION_CUTOFF_HOURS = 24`.

`cancelBooking(store, {bookingId, transferFn, now})`:
- Rejects an already-cancelled or already-completed booking.
- `refundEligible = hoursUntilStart >= CANCELLATION_CUTOFF_HOURS`.
- Refund-eligible: full `pricePaid` reversed from escrow to the
  customer.
- Not eligible: no refund. Instead the escrowed amount settles exactly
  like `completeExperience` — host share + platform fee, same
  `PLATFORM_TAKE_RATE` split, from the same escrowed source. Real
  justification, not arbitrary: the host held reserved capacity
  through the cutoff that could no longer be resold, the same real
  economic position as a completed booking — and this reuses the
  existing real split instead of inventing a third one.
- Either way, the experience's slot is released
  (`remainingCapacity += 1`, `full` → `open`).
- `lib/notifications.js` gains one real, flagged 15th type,
  `booking-cancellation` — none of the brief's own 14 named types
  (SS33) fit a cancellation notice.

## Explicitly NOT in this task
Host-initiated cancellation of an entire experience (only the MVP's
own step list names customer-initiated booking cancellation; the
brief has no host-cancels-experience step). A configurable per-host or
per-experience refund policy — the brief's own "Refund policy" field
is displayed per experience but the doc gives no host-configuration
mechanism, so this stays a fixed, platform-wide policy for now.

## Verification approach
9 plain-Node checks. A live pass against the real running server and
V3 mock: one real booking cancelled well before the cutoff (full
refund, slot reopened), a separate real booking cancelled inside the
cutoff (no refund, real host+platform settlement matching
`completeExperience`'s own split, escrow returned to its starting
balance), plus double-cancel and unknown-booking rejections confirmed
over real HTTP.

## Done when
A real cancellation/refund path exists, grounded in a real, named,
flagged comparable (not a fabricated number), tested and live-verified
against the actual running server.
