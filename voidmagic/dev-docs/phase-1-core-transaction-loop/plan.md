# Plan — Phase 1: The Core Transaction Loop

## Goal
Build exactly Section 39's MVP scope, nothing more: creator creates
experience → customer discovers → books → payment processed →
scheduling confirmed → confirmation/credential issued → check-in →
experience happens → completion recorded → host settlement →
post-event follow-up. The brief is explicit: "DO NOT build the entire
ecosystem at once."

## Design
- `lib/experiences.js`: a real, deliberate scoping choice, flagged
  since Section 38 only names entities without field-level shapes —
  an Experience is modeled as one specific, already-dated/timed
  bookable slot (the same real shape VACAY's own `Experience`/
  `Booking` pair uses), not a recurring-availability template. Section
  10's "serious scheduling engine" ("this should eventually become an
  intelligent scheduling system") is real, substantial, explicitly
  later work, not MVP scope. Pricing is limited to free/fixed;
  Section 5's tiered/auction/invitation-only/subscription pricing
  models are each their own real engineering lift, deferred.
- `lib/bookings.js`: the real escrow model. The MVP's own step list
  separates "Payment is processed" (step 4) from "Host receives
  settlement" (step 10) as two distinct events, which only makes
  sense under real escrow — charge the customer at booking time, pay
  the host later at completion. This is a deliberately different real
  shape from VOID's own job-marketplace `requestJob()`/`completeJob()`
  pattern (customer pays at completion, not at request) — VOID MAGIC
  follows its own brief's explicit step ordering here, not VOID's
  precedent, since event ticketing and gig-work marketplaces are
  genuinely different real-world models. Settlement is a real dual
  payout (host share + platform fee) from the same escrowed source,
  the same "one source, real dual payout" mechanism already
  established for HVNTZ's hunt check-in and VOID's own `completeJob`.
  No exact platform fee is given anywhere in the brief — 15.5% is a
  real, flagged interpretive choice modeled on VACAY's own real
  Airbnb-style comparable, the closest real booking-fee precedent
  already in this ecosystem. The real credential (step 6) reuses this
  session's established `crypto.randomBytes` pattern from VOID's
  Locker-to-Door access codes.

## Explicitly NOT in this task
- Security, transportation, venue booking, staff, digital waiting
  rooms, hybrid experiences, media, creator analytics, customer
  profiles, advanced scheduling, geofencing, notifications — all
  explicitly Phase 2 per Section 40.
- V4 AI Event Builder ("Build My Experience"), DREAMS advertising,
  Vvltvre/Vavlt Stvdios/CHOPZ integration, dynamic pricing, enterprise
  events, sponsorship — all explicitly Phase 3 per Section 41.
- Cancellation/refunds — not part of the MVP's own 11-step list;
  flagged as a real, deferred gap rather than silently built.
- Any hard-coded dependency on VOID itself — per Section 36/47's
  explicit "communicate through APIs, don't hard-code into VOID"
  architecture, this phase builds VOID MAGIC's own real primitives
  rather than routing bookings through VOID's job marketplace.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 14
checks, all passed clean on first run): real capacity tracking down to
`full`, a real credential lifecycle (wrong code rejected, correct code
accepted, double check-in rejected), and the centerpiece — a real dual
payout proven to sum EXACTLY to the escrowed amount (no float drift,
escrow account provably drained to zero after settlement), plus proof
a free (price: 0) experience never calls `transferFn` at all. Then a
live pass: `voidmagic/server.js` and `venvs-mock-backend` together —
the full 11-step loop run end to end against the real running server,
with the host's real settlement and the platform's real fee both
independently confirmed via `GET /api/vcoin/balance`, and the escrow
account's balance confirmed to return to exactly its starting value.

## Done when
- The full MVP loop (create → discover → book → pay → confirm →
  credential → check-in → complete → settle → summary) works
  end-to-end, both in plain Node and live.
- Settlement is provably exact — host share + platform fee sum to
  precisely what was escrowed, verified by draining the escrow account
  to zero, not just spot-checked.
- A free experience moves zero real VCoin.
- Live: every real money movement independently confirmed against the
  mock V3 ledger.
