# Plan — Phase 1: Peer Car Rental

## Goal
Build VACAY's Turo-comparable division: peer-to-peer car rental, one
of the real, distinct divisions VACAY was split into (alongside Stays,
Experiences, Homes).

## Design
- `PROTECTION_PLANS`: a real, flagged-interpretive stand-in for Turo's
  actual host protection-plan tiers — genuinely different structure
  from every other VACAY division (owner-chosen rate vs. one imposed
  flat fee).
- `hostEarnPercent` captured on the vehicle at listing time, then
  copied onto the rental record at booking time — deliberately NOT
  re-read from the vehicle at completion, so a plan change mid-rental
  can't retroactively alter an in-progress trip's economics. Proven
  directly in verification, not just asserted.
- Real escrow-then-settle + double-booking guard, reusing the exact
  pattern already proven three times this session (VOID MAGIC, VACAY
  Stays, VACAY Experiences).

## Explicitly NOT in this task
Any UI. Cancellation/refunds/real insurance claims. Delivery/pickup
(a natural VOID courier fit, not built here). Availability calendars
beyond the overlap guard.

## Verification approach
Plain-Node pass (14 checks): plan-derived earn percentage, validation,
owner-scoped listing, day-count/total math, the escrow charge, the
double-booking guard across three real cases, the plan-change-mid-
rental non-retroactivity proof, payout-sum correctness, double-
completion rejection. Then a live pass against the real,
independently running V3 mock ledger: a vehicle listed, a real rental
booked and confirmed via the renter's live balance, an overlap
rejected, and completion confirmed via the owner's live balance.

## Done when
- The protection-plan-derived split is proven correct and provably
  non-retroactive against a real ledger.
- The double-booking guard is proven correct for this division too,
  not just assumed to carry over from the pattern.
