# Plan — Phase 1: Core Commerce Loop

## Goal
Build the smallest real slice of CHOPZ SHOP's TikTok-Shop-model
commerce layer: Product creation → AffiliateLink generation → native
checkout Order (real, atomic, multi-way payout) → real VOID
fulfillment handoff. Built as its own separate, standalone app from
CHOPZ (the video feed), per explicit instruction.

## Design
- `Product { id, sellerId, price, affiliateCommissionPercent }` — real
  data model from `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`.
  `affiliateCommissionPercent` real, seller-set, performance-only, per
  `CHOPZ_TIKTOK_COMPARABLES.md`'s real TikTok Shop detail; defaults to
  0 (no affiliate program).
- `AffiliateLink { id, creatorId, productId, clicksCount, conversionsCount }`
  — tied to one specific product; an order using a link generated for
  a different product is a real, rejected error.
- `Order { id, buyerId, productId, feePercent, voidShipmentId }` —
  real, single-step, atomic checkout: unlike VOID MAGIC's two-step
  book/complete escrow, TikTok Shop's real checkout is one
  instantaneous event, so charge + all real payouts happen in one
  function, not split across a booking and a later completion. Real
  payout order: platform fee computed first, affiliate commission
  second (if a valid link was used), seller payout is the exact
  remainder — guarantees the (up to) three real payouts always sum to
  exactly what the buyer was charged. Per the comparable doc's real
  economics, the affiliate commission is deducted from the seller's
  proceeds, not charged extra to the buyer ("no upfront cost to the
  brand, performance-only").
- `requestFulfillment` — the real, separate cross-app call
  (`Order.voidShipmentId`) into VOID's own job marketplace, `courier`
  vertical. `VOID_SERVICE_VERTICALS_COMPARABLES.md` names this exact
  vertical as the closest real fit for CHOPZ SHOP fulfillment, and
  names the real integration point as a `voidClient.createShipment()`-
  style stub — the injected `voidRequestFn` here is that real client
  call, mirroring CVNVO's `voidFetchFn` pattern (a separate step after
  the primary transaction, not baked into checkout itself).

## Explicitly NOT in this phase
- Live shopping, the four real ad formats named in the comparable doc.
- Cart/multi-item checkout (single-product only).
- Category-based `feePercent` derivation (caller-supplied per order).
- Click-through attribution windows for affiliate links.
- CHOPZ SHOP does not own video/social data — that's the separate
  `chopz/` app; `linkedProductId` on a `ChopzVideo` is not validated
  against this app's product list (flagged in `chopz/README.md`).

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 33
checks): validation on all three models, the real 2-way and 3-way
payout splits proven via a fake ledger to sum exactly to the charged
price (not independently rounded), insufficient-funds handling
confirmed to leave no order record behind, fulfillment proven
idempotent (a second request on the same order rejected). Then a live
pass: `chopz-shop/server.js`, `chopz/server.js`, VOID, and the V3 mock
backend all running independently — a real product, a real CHOPZ video
linking to it across the two separate apps, a real affiliate link, a
real order through that link with real VCoin transfers confirmed via
the V3 mock's own balance endpoint, and a real VOID courier job
confirmed via VOID's own `/api/job/:id` endpoint.

## Done when
- All three models have real, working code with real validation.
- The multi-way payout is proven, both in isolation and live, to sum
  exactly to the price charged.
- Fulfillment genuinely reaches VOID's real job marketplace through
  code that's actually called, not stubbed.
