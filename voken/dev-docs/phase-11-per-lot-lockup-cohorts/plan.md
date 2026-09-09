# Plan — Phase 11: real per-share-lot lockup cohort tracking

## Goal
Close `fractionalOwnership.js`'s own previously-flagged simplification:
"the 90-day lockup is tracked at whole-shareholder-position
granularity, not per-purchase-lot." Part of a broader ecosystem sweep,
confirmed with the user before starting.

## Real investigation before any code
Re-read the file's own header and `buyShares`/`createSecondaryListing`:
the existing shape stored one `lockedUntil` per shareholder, re-set on
every purchase -- meaning a shareholder who bought more shares would
re-lock shares they'd already held past the 90-day window, an honestly
flagged but real over-restriction. Grepped `server.js` and every other
lib file for any external code touching `shareholder.shares`/
`.lockedUntil`/`.listedShares` directly -- none found, confirming the
internal shape could be redesigned without touching any other file's
contract.

## Design
Each shareholder now holds `lots: [{ id, shares, listedShares,
lockedUntil, purchasedAt }]` instead of a single flat position.
`buyShares` always pushes a brand-new lot with its own `lockedUntil`,
never touching an existing lot. `createSecondaryListing` computes real
sellable shares as the sum of only unlocked lots' own remainder, and
draws from the oldest unlocked lot(s) first (real brokerage FIFO
convention), recording exactly which lot(s) and how many shares in
`lotAllocations` on the secondary listing record. `cancelSecondaryListing`
and `buySecondaryShares` both use that same `lotAllocations` record to
release/debit the correct specific lot rather than a shareholder-level
total. A secondary purchase opens the buyer a real, brand-new,
`lockedUntil: null` lot -- unchanged behavior, just re-expressed in the
new per-lot shape. `getFractionalHoldings` now exposes the real
per-lot detail (each lot's own lock state) alongside the aggregate
totals, since surfacing that detail is the actual point of the gap
being closed.

## Explicitly NOT in this task
Any change to the real 90-day `SECONDARY_LOCKUP_MS` figure itself, or
to the primary purchase/compliance-gate flow. Partial-lot secondary
listings that span a locked and unlocked lot in one request (real
per-lot tracking means only unlocked lots are ever drawn from, by
design -- a request can't "borrow" from a locked lot no matter how it's
split).

## Verification approach
6 plain-Node checks (independent lot tracking, per-lot sellable
totals, over-limit rejection against the real per-lot total rather
than the position total, FIFO draw across two lots, lot-accurate
cancellation release, and post-sale lot cleanup). A live pass against
the real running server and the real standalone V3 (post
ecosystem-cutover): a real two-lot position built at two different
`now` values, holdings confirmed showing the correct real per-lot
sellable total (not the position total), a listing beyond that total
rejected while exactly that total succeeds, and a real secondary
purchase confirmed against V3's own balance with the correct lot-level
before/after state.

## Done when
Lockup is genuinely tracked per purchase lot, confirmed by both
isolated and live tests, and the README's own "Not yet built" list no
longer names this simplification.
