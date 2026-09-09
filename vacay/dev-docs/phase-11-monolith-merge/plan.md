# Plan — Phase 11: Monolith Merge

## Goal
Per explicit instruction — "one big app with different apps inside,"
directly reversing the previous phase's standalone-app split. Merge
`vacay`, `vacay-experiences`, `vacay-auto`, `vacay-homes`, and
`vacay-flights` into one codebase, one server, one port, while keeping
each section's own real, isolated logic and store namespace — the
"different apps inside" part is about internal separation of concerns,
not five separate deployable processes.

Also folds in two new real Auto sub-businesses named directly by the
user: CarGurus (buy/sell used cars) and VACAY's own owned-fleet rental
(traditional Hertz/Enterprise-style, distinct from Turo's peer model).

## Design
- Each section gets its own `lib/<section>/` folder and its own nested
  slice of one consolidated `store` object (`lib/store.js`). No
  section's own function signatures changed — every `lib/*.js` file
  still just takes "a store" with its own expected fields; only what
  object gets passed in changed (a nested slice instead of a whole
  separate store).
- Each section gets its own `routes.js` (a real Express Router),
  mounted in `server.js` at its own prefix (`/api/bookings`,
  `/api/home`, `/api/auto`, `/api/flights`).
- The `/api/flights/bundles` feature becomes a real in-process call
  (the Flights router is handed the Bookings section's own
  `createBooking` function directly) instead of a cross-app HTTP
  call — still not a true distributed transaction, but a smaller
  failure window (no network hop, no possibility of the two "sides"
  disagreeing about reachability).
- `carListings.js`: CarGurus' real signature feature, a price-rating
  algorithm (`great-price`→`overpriced`) comparing a listing against a
  caller-supplied market-average reference (honestly not computed from
  real aggregated data, which doesn't exist here). Real monetization:
  a flat seller listing fee, distinct from Turo's owner-earn split and
  Homes' lead fee.
- `fleetRentals.js`: VACAY's own owned-fleet rental. The real,
  defining contrast with Turo: no peer owner, so completion pays
  VACAY's own revenue account the full price in one transfer, not a
  split.

## Explicitly NOT in this task
Real distributed-transaction safety for the bundle feature (still not
solved, just smaller in scope now). CarGurus' own real market-data
computation. Any UI.

## Verification approach
Every section's own original plain-Node test suite re-run against the
merged code (no lib-level logic changed, so this is a regression
check, not new testing) plus new tests for the two new Auto
sub-features. Then a full live pass: one running server, all four
section route prefixes exercised over real HTTP, including a real
`/api/flights/bundles` call and the two new Auto features, all
confirmed against the real, independently running V3 mock ledger.

## Done when
- The merged server boots and every section's routes work correctly
  under their new mount prefixes.
- Every pre-merge test still passes against the merged code.
- The two new Auto sub-features are proven correct against a real
  ledger, not just unit-tested in isolation.
- The now-fully-absorbed standalone project directories are removed,
  with their historical dev-docs preserved (moved, not deleted).
