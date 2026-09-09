# Plan — Phase 2 (fifth slice): Double-Booking Guard

## Goal
Section 10's own first, named requirement: "The system prevents double
booking." Section 10 as a whole calls for a "serious scheduling
engine" understanding travel time, setup time, security setup, venue
availability, host availability, guest arrival windows, duration,
buffers, and event transitions -- explicitly flagged elsewhere in this
codebase (`lib/experiences.js`'s own header) as real, substantial,
deferred engineering ("this should eventually become an intelligent
scheduling system"). This slice builds only the one real invariant
Section 10 names outright: a host cannot have two active experiences
with overlapping time windows.

## Design
- `findDoubleBooking(store, hostId, scheduledAt, durationMinutes)` in
  `lib/experiences.js`: a real, standard interval-overlap check
  (`aStart < bEnd && bStart < aEnd`), not an approximation, against
  the host's own other experiences in an active status (`open`/`full`
  only -- a cancelled or completed experience doesn't block a new
  booking in that slot, since it's no longer really occupying the
  host's time).
- Applies regardless of experience format -- a host can't run a
  physical meet-greet and a digital conversation at the same real
  moment either, so digital/physical/hybrid are all checked against
  each other, not siloed.
- `createExperience` now rejects a conflicting booking with a real
  error naming the specific conflicting experience (id + title), not
  a generic rejection.

## Explicitly NOT in this task
Travel time, setup/security setup time, buffers between events, venue
availability, guest arrival windows -- all real, substantial, and
still deferred, per the module's own standing scoping note.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 9
checks): exact-same-slot rejected with the real conflicting
experience named in the error; a partially overlapping slot rejected
regardless of format; back-to-back scheduling (new experience starts
exactly when the prior one ends) correctly allowed, not treated as
overlap; a different host allowed the exact same time window; a
cancelled experience and a completed experience both confirmed to no
longer block a new booking in their old slot; a new, longer experience
that fully contains an existing shorter one also rejected (not just
partial-overlap cases). Then a live pass: a real overlapping booking
attempt against the actual running server confirmed rejected with the
real conflict message, and the existing MVP booking flow re-run on an
unrelated experience to confirm no regression.

## Done when
- The overlap check is proven correct against exact-match, partial-
  overlap, containment, back-to-back (non-overlap), and different-host
  cases.
- Cancelled/completed experiences are confirmed to free their slot.
- The existing MVP flow is unaffected.
