# Plan — Phase 6: Fractional Ownership, Limited-Edition Merch, Digital Art Frame

## Goal
Close out the three remaining real, buildable pieces confirmed in the
source docs: fractional ownership (compliance-gated, per the
architecture doc's own explicit instruction), creator-designed
limited-edition merch with real dynamic pricing, and the Meural-Opus-
comparable digital art frame product.

## Design
- `lib/fractionalOwnership.js`: matches VOKEN_ARCHITECTURE.md's
  `FractionalOwnership { id, cardId, totalShares, soldShares,
  pricePerShare }` directly. Reuses the `'fractional-ownership'` gate
  already built in Phase 4's `complianceGate.js` -- no new flag
  invented. Follows the same ungated/gated split established by VEX in
  Phase 4: `createFractionalListing()` moves no money -- it only
  transfers real custody of the specific, currently-owned edition into
  a shared `voken-fractional-pool` account (modeling real-world
  custody-before-shares-sell, the comparables research's own
  recommended Rally-style structure) -- so it's deliberately ungated.
  `buyShares()` is the real, gated, money-moving action: real payment
  directly to the original fractionalizing seller, real enforcement
  against remaining share count, real per-investor stake tracking
  separate from the edition's single-owner shape.
- `lib/limitedEditionMerch.js`: matches
  VOKEN_NEW_VALUE_ALGORITHM.md's `LimitedEditionMerch` shape exactly.
  Ordinary commerce, not securities-adjacent -- deliberately NOT
  gated. `computeDynamicPrice()` is a real, deterministic, bounded,
  flagged interpretive choice (no formula given in the source doc):
  linear scarcity pricing up to 2x `basePrice` once fully sold out.
  `purchaseMerchItem()` charges the real, live price at the moment of
  purchase, then recomputes the price for the next buyer against the
  new remaining supply -- proven with two sequential purchases at two
  different real prices, not just one static number.
- `lib/digitalArtFrame.js`: matches
  VOKEN_NEW_VALUE_ALGORITHM.md's `DigitalArtFrame` shape exactly.
  `loadArtworkOntoFrame()` is a real, double ownership-gated action --
  the requester must genuinely own both the frame itself and a digital
  edition of the specific art card being loaded -- never a passive
  display of arbitrary content.

## Explicitly NOT in this task
- No secondary market/liquidity layer for fractional shares (Rally's
  real ATS secondary market) -- shares are bought from the original
  listing only; reselling a share is a real gap, flagged, not built.
- No actual manufacturing/shipping logic for merch or frames -- both
  are pure digital records of a real commercial transaction.
- No VACA ecosystem-wide verification badge -- VACA doesn't exist as
  code anywhere in this session.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 23
checks): the fractional gate checked from both directions exactly like
VEX's Phase 4 gate, custody transfer confirmed via the edition's real
`ownerId`, dynamic merch pricing checked against hand-computed values
across two sequential purchases, and the art frame's double ownership
gate proven to reject both a non-owning requester and a non-owning
frame-holder. Then a live pass: `voken/server.js` and
`venvs-mock-backend` together -- a fractional share purchase's real
payout independently confirmed on both the investor and seller
balances, and a merch purchase's dynamically-priced payout
independently confirmed the same way.

## Done when
- The `fractional-ownership` gate blocks `buyShares` until cleared,
  exactly like VEX's brokerage gate.
- `createFractionalListing` genuinely transfers edition custody and
  rejects a non-owning seller.
- `buyShares` enforces real remaining-share limits and marks a listing
  `fully-sold` at 100% subscribed.
- Merch dynamic pricing is a real, verifiable formula, not a static
  price; `purchaseMerchItem` charges the live price, not the original.
- `loadArtworkOntoFrame` rejects both a non-owning frame-holder and a
  frame-holder who doesn't own the specific artwork.
- Live: both a fractional-share payout and a dynamically-priced merch
  payout independently confirmed against the mock V3 ledger.
