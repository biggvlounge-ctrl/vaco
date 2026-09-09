# Plan — Phase 1: Merchant-of-Record Flights

## Goal
Build VACAY's Expedia-comparable division: flight inventory and
booking, using Expedia's real merchant-of-record economic model —
closing `../vacay/VACAY_COMPARABLES.md`'s own explicitly-flagged gap.

## Design
The real, defining decision: this is NOT a host-fee model (Stays/
Experiences/Auto) and NOT a lead-fee model (Homes). VACAY Flights
itself is the seller of record — it charges the passenger the full
retail price, then pays the airline (a real external supplier,
represented by a deterministic synthetic account) its own separate net
rate, keeping the spread as margin. `retailPrice >= netRate` is
enforced structurally at listing time, a real business-sanity
constraint.

Settlement is a single atomic action, not escrow-then-settle-later —
correct because a ticket is issued instantly, the same real
justification CHOPZ SHOP's own atomic checkout already used for an
identical reason (an instantaneous real-world event, not a future one
to wait for).

Seat availability uses the real capacity-decrement shape Experiences
already established, not a date-overlap guard — correct here since
many passengers can hold seats on the same flight, unlike a stay or
rental car.

## Explicitly NOT in this task
Any UI. Cancellation/refunds/change fees. Multi-leg itineraries.
Dynamic/real-time pricing.

## Verification approach
Plain-Node pass (16 checks): capacity tracking, the margin math proven
via the actual transfer-call arguments (not just stored fields),
sell-out behavior, discount math and its own netRate floor guard. Then
a live pass, described in Phase 2's own plan (the live pass exercises
both flight-only booking and the cross-app bundle together).

## Done when
The merchant-of-record margin split (passenger charge, airline
payout, platform margin) is proven correct against real transfer
calls, and seat capacity genuinely gates booking.
