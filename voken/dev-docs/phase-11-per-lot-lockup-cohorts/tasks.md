# Tasks — Phase 11: real per-share-lot lockup cohort tracking

- [x] Re-read `fractionalOwnership.js`'s own header and grep the whole
      project for external callers touching shareholder internals
      (none found).
- [x] `store.js` — add `nextFractionalLotId` counter.
- [x] `fractionalOwnership.js` — real per-lot helpers (`totalShares`,
      `isUnlocked`, `sellableShareCount`, `drawFromUnlockedLots`).
- [x] `buyShares` — always opens a brand-new lot, never re-locks an
      existing one.
- [x] `getFractionalHoldings` — real per-lot detail exposed alongside
      aggregate totals; `now` made a real, testable parameter.
- [x] `createSecondaryListing` — real per-lot sellable check, FIFO
      draw across unlocked lots, `lotAllocations` recorded.
- [x] `cancelSecondaryListing` — releases the exact real lot(s) from
      `lotAllocations`.
- [x] `buySecondaryShares` — debits the exact real lot(s), cleans up
      any lot fully sold to zero, opens the buyer a real new
      `lockedUntil: null` lot.
- [x] 6 plain-Node checks — all passing.
- [x] Live pass: real V3 + VOKEN started (post-cutover defaults), a
      real two-lot position built, holdings/rejection/success/purchase
      all confirmed against V3's own balance.
- [x] Shut down all test servers.
- [x] Update `voken/README.md` — the fractional ownership bullet in
      "What's here", a new "Verified" paragraph, and the resolved item
      removed from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
No further real gaps flagged in this module -- a real registered
ATS/order-book matching engine remains the one other named "Not yet
built" item, unrelated to lot tracking.
