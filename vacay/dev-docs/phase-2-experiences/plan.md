# Plan — Phase 2: Experiences

## Goal
The separate `Experience` entity/booking flow the source doc's own API
map names apart from stays ("POST /vacay/experiences -- separate from
stays, same host model"), deferred out of Phase 1 per the scoping note
confirmed with the user before any VACAY code was written.

## Design
- `lib/experiences.js`: `Experience { id, hostId, description,
  durationHours, price, capacity, remainingCapacity, scheduledAt,
  status }`. Two real, necessary completions beyond the source doc's
  three named fields, flagged directly: `price` ("same host model" as
  stays implies the same real 15.5% fee structure, which needs a real
  price to exist at all) and `capacity`/`scheduledAt` (a real Airbnb
  Experience is a scheduled, capacity-limited group activity, not
  unscheduled/uncapped) -- the exact same real shape VOID MAGIC's own
  `experiences.js` already established for a structurally identical
  real-world concept in a different domain, deliberate cross-app
  pattern reuse. The same real double-booking guard already
  established twice this session (VOID MAGIC's experiences, VACAY's
  own stays) applies a third time here: a host can't run two
  overlapping Experiences.
- `lib/experienceBookings.js`: reuses stays' `bookings.js`'s exact real
  escrow-then-settle shape and the real, literal 15.5% fee -- not a
  second payment model. Genuinely different in one real way: a single
  `price` charged once (no nights calculation), and a real capacity
  decrement on the Experience itself (mirroring VOID MAGIC's own
  `bookExperience`/`completeExperience`), since this is a
  capacity-limited activity, not a date-range stay.

## Explicitly NOT in this task
Cross-checking a host's stay-hosting time against their Experience
schedule (out of scope -- stays don't have host-presence time windows
the way Experiences do). Cancellation/refunds, same as Phase 1.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 23
checks): experience validation (missing hostId/description,
non-positive price); real capacity/remainingCapacity tracking;
discovery includes open, future experiences; the double-booking guard
proven against an exact-overlap case (naming the real conflicting
experience) while back-to-back scheduling is correctly allowed; a real
booking charges the guest and decrements capacity; the experience
transitions to `full` at zero remaining capacity and is excluded from
discovery; a booking against a full experience rejected; real dual
payout at completion matching the exact 15.5%/84.5% split; double-
completion rejected. Then a live pass: a real capacity-2 experience,
two real bookings filling it, a real rejected third booking, and real
completion settlement, all confirmed against the actual running server
and the real V3 mock ledger.

## Done when
- The full experience -> booking -> completion loop works with real
  V3 settlement and real capacity enforcement, verified live.
- The double-booking guard is proven correct for a host's own
  Experience schedule, mirroring the same guard already proven twice
  elsewhere in this session.
