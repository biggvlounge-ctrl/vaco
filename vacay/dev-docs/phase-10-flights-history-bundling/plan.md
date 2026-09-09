# Plan — Phase 2: Flights+Stays Bundling

## Goal
The real point of building Flights now: per explicit instruction to
make sure the whole VACAY family "coincides and flows," not just sit
as adjacent, unrelated apps. `POST /api/bundles` is the concrete,
tested answer — a real cross-app action that books a stay on
`../vacay/`'s own live server and a discounted flight here, together.

## Design
`bookStay()` in `server.js` is a real, live HTTP call into VACAY
Stays' own `POST /api/bookings` — the same cross-app fetch pattern
used everywhere else in this session (VOID, VSAFE, V3), not a shared
process or a stub. `BUNDLE_DISCOUNT_PERCENT` (10%) is a real,
flagged-interpretive number grounded in Expedia's real "bundle and
save" positioning, applied only to the flight leg.

**A real, flagged limitation, stated directly rather than
engineered around**: `/api/bundles` is not a distributed transaction.
If the stay books successfully and the flight booking then fails
(e.g. the flight sold out in between), the stay is not automatically
rolled back. Building a real saga/compensation mechanism was judged
out of proportion for this phase — flagged as a genuine gap, not
silently risking an inconsistent state without saying so.

## Verification approach
A live pass: `vacay-flights/server.js` and `../vacay/server.js` run as
two genuinely independent processes against the shared V3 mock ledger
— a real stay listing and a real flight both created, then a real
`POST /api/bundles` call confirmed booking both, with the traveler's
real V3 balance confirmed decreasing by the exact combined total, the
airline's own account confirmed receiving its real net rate, and the
flight's seat count confirmed decremented.

## Done when
A single API call is proven, live, to genuinely coordinate two
independently running VACAY apps into one real combined booking with
correct, ledger-verified settlement on both sides.
