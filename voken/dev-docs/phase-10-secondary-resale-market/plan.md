# Plan — Phase 10: secondary resale market for fractional shares

## Goal
Close the README's own previously-flagged gap: "A secondary market/
liquidity layer for fractional shares (Rally's real ATS-based resale)
— shares can only be bought from the original listing; reselling a
share isn't built."

## Real investigation before any code
Read `lib/fractionalOwnership.js` in full: `buyShares` is the real,
gated primary purchase (pool custody model, per-investor stake
tracking). No secondary transfer path exists anywhere.

`VOKEN_MASTER_SPEC_PROGRESS.md`'s own comparables research names the
exact real mechanism: "Rally... real (if thin) secondary market via a
registered ATS (PPEX) after a 90-day lockup." This is the real, cited
figure this phase grounds `SECONDARY_LOCKUP_MS` in — not an invented
one.

## Design
This project has no registered ATS and no order-matching engine, so
secondary trades settle as direct, real peer-to-peer transfers — a
shareholder lists a specific share count at a specific price, another
user buys it outright, money moves seller-to-buyer via the same real
`transferFn` pattern as the primary sale. Gated by the same
`'fractional-ownership'` compliance gate (still securities-adjacent).

Lockup tracking, a real, flagged simplification: `lockedUntil` lives
on the whole shareholder record, set to `now + SECONDARY_LOCKUP_MS` on
every primary purchase (`buyShares`), extending/re-locking the entire
position each time. Secondary purchases never set `lockedUntil` for
the buyer — matching the real rule that an ATS-style ownership
transfer isn't a new private-placement purchase, so those shares are
immediately resalable. This is coarser than real per-purchase-lot
cohort tracking (buying more primary shares re-locks shares that had
already cleared their own lockup) but never under-restricts.

`shareholder.listedShares` tracks shares currently tied up in open
secondary listings so a seller can't list more than their real
sellable balance (`shares - listedShares`) across multiple concurrent
listings; cancelling a listing releases the reservation.

## Explicitly NOT in this task
A real registered-ATS-style order book or live price discovery/partial
fills — real peer-to-peer listing-and-buy only. Per-share-lot lockup
cohort tracking — flagged directly as a real, coarser simplification.

## Verification approach
10 plain-Node checks. A live pass against the real running server and
V3 mock: a real card/edition minted, a real fractional listing bought
into, an immediate secondary-listing attempt confirmed rejected with
the real lockup timestamp, then — using the same `now` testability
parameter every other module in this codebase already exposes for
deterministic testing — a listing 91 days out created, confirmed via
the open-listings endpoint, and bought by a second real buyer, with
real peer-to-peer payment and the buyer's shares confirmed
immediately resalable. Plus double-purchase, self-purchase, and
non-seller-cancel all confirmed rejected over real HTTP.

## Done when
A real secondary resale path exists for fractional shares, grounded
in Rally's own real, cited 90-day lockup figure, tested and
live-verified against the actual running server.
