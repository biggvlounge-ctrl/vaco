# Plan — Phase 2: real category-based fees + cart checkout

## Goal
Close two real, already-named gaps in the README's own "Not yet
built" list: category-based `feePercent` (currently a flat, caller-
supplied default) and cart/multi-item checkout (single-product only).

## Real investigation before any code
Read `CHOPZ_TIKTOK_COMPARABLES.md` directly for the real, cited fee
data rather than inventing category rates: "Referral/commission fee:
5-8% depending on category (apparel runs higher, ~15%)." Exactly two
real data points exist — general and apparel — so the fix only
implements those two, falling back to the general rate for anything
else rather than fabricating more specific numbers for categories the
doc never mentions.

Read `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s own `Order` schema
directly before designing cart checkout: one product per order, no
`Cart`/`CartItem` entity anywhere. Confirmed a real cart checkout
doesn't need a new entity to match this — it's the existing, already-
atomic `createOrder`, called once per real line item. Also confirmed
this matches real TikTok Shop behavior: a multi-seller cart checkout
settles as separate per-seller orders under the hood, not one merged
record.

## Design
`products.js` gains an optional `category` field — a real, flagged
schema extension beyond the doc's literal `Product` shape, the
necessary input for the fee lookup. `orders.js` gains
`computeFeePercentForCategory` (apparel → 0.15, everything else →
0.07) and uses it as `createOrder`'s real default when the caller
doesn't supply an explicit `feePercent` — an explicit value still
always wins, so no existing behavior changed.

`createCartCheckout(store, {buyerId, items, transferFn})` loops over
real line items, calling `createOrder` once per item (sequentially,
not in parallel, so one item's failure can't race another's payout),
returning the real array of created orders plus a real summed total.
Flagged directly: a failure partway through leaves earlier items real
and placed, not rolled back — true all-or-nothing would need real
distributed-transaction infrastructure this project doesn't have.

## Explicitly NOT in this task
Category rates beyond the two the doc actually cites. A rollback
mechanism for partial cart failures.

## Verification approach
12 plain-Node checks. A live pass against the real running server: two
real products (one apparel, one general), a real 2-item cart checkout,
independently confirmed against V3's own real balances for both
sellers, matching the plain-Node math exactly.

## Done when
Both README-flagged gaps are closed with real, tested code, grounded
in the comparable doc's own real numbers, not invented ones.
