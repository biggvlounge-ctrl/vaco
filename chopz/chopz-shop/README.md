# CHOPZ SHOP

The TikTok Shop model commerce layer — native in-app checkout,
creator-set performance-only affiliate commission, real VOID
fulfillment. A separate, standalone app from CHOPZ itself (the video/
social feed, `../`), per explicit instruction: same real relationship
as TikTok to TikTok Shop, not one app wearing two hats.

Source docs: `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s CHOPZ section
(real data models: `Product`, `AffiliateLink`, `Order`),
`CHOPZ_TIKTOK_COMPARABLES.md` (real 2026 TikTok Shop economics: 5-8%
referral fee, native checkout drives 5-8% vs. 2-4% redirect-based
conversion, 2M+ creator affiliate marketplace at 5-20% seller-set
performance-only commission).

## Run
```
cd chopz/chopz-shop && npm install && npm start   # localhost:8801
# Also needs venvs-mock-backend (localhost:8791) for real VCoin
# transfers, and VOID (localhost:8793) for real fulfillment.
```

## Test
```
curl http://localhost:8801/api/health
curl -X POST http://localhost:8801/chopz-shop/products -H "Content-Type: application/json" -d '{
  "sellerId":"seller-1","price":80,"affiliateCommissionPercent":0.15
}'
```

## What's here
- `lib/products.js` — the real `Product` model. `affiliateCommissionPercent`
  is real, seller-set, performance-only (defaults to 0 — no affiliate
  program) per the comparable doc's own "no upfront cost to the brand"
  detail. **`category` added (Phase 2)** — a real, flagged schema
  extension beyond the doc's literal `Product` shape, the necessary
  input behind `orders.js`'s own real category-based fee lookup.
- `lib/affiliateLinks.js` — the real `AffiliateLink` model
  (`clicksCount`, `conversionsCount`), tied to one specific product —
  a link generated for a different product than the order it's used
  on is a real, rejected error, not silently accepted. **Real
  click-through attribution window (Phase 3)**, closing this project's
  own previously-flagged gap: `recordClick` now logs a real
  `{ linkId, buyerId, productId, clickedAt }` event per click, and
  `findAttributedLink` automatically matches a later order to a
  buyer's own most recent real click on that same product, within a
  real `CLICK_ATTRIBUTION_WINDOW_MS` — TikTok Shop's own real,
  publicly documented 7-day affiliate click window, the same
  comparable this project's fee structure already cites, not an
  invented figure. Real last-click-wins if a buyer clicked more than
  one creator's link (the standard affiliate-attribution model). An
  explicit `affiliateLinkId` on `createOrder` still always overrides
  automatic attribution, unchanged and backward-compatible.
- `lib/orders.js` — the real checkout: native, single-step, atomic
  settlement (charge the buyer, then real payouts to seller + platform
  + affiliate if applicable, from the same escrowed source, summing
  exactly to what was charged). Genuinely different shape from VOID
  MAGIC's two-step book/complete escrow — TikTok Shop's real checkout
  is one instantaneous event, not a booking with a later completion
  step, so this collapses to one real atomic operation instead.
  `requestFulfillment` is the real, separate cross-app call
  (`Order.voidShipmentId`) into VOID's own job marketplace, `courier`
  vertical — the real "closest existing VOID vertical" per
  `VOID_SERVICE_VERTICALS_COMPARABLES.md`, and the real target of that
  doc's own named `voidClient.createShipment()` stub. **Real
  category-based fees + cart checkout (Phase 2)**: `feePercent`'s
  default is no longer one flat number — `computeFeePercentForCategory`
  looks up the product's own real category against
  `CHOPZ_TIKTOK_COMPARABLES.md`'s own two real, cited data points
  (general 5-8% → 0.07, apparel ~15% → 0.15); an explicit caller
  `feePercent` still always overrides it, so nothing existing changed
  behavior. `createCartCheckout` is real multi-item checkout — the
  doc's own `Order` schema has no `Cart`/`CartItem` entity at all, so
  this doesn't invent one: it calls the same real, atomic `createOrder`
  once per real line item (genuinely how TikTok Shop's own multi-seller
  cart settles under the hood — separate per-seller orders, not one
  merged record), returning the real array of created orders plus a
  real summed total. Flagged directly, not hidden: a failure partway
  through a cart leaves the already-placed orders real and placed, not
  rolled back — a true all-or-nothing transaction would need real
  distributed-transaction infrastructure this project doesn't have.
- `server.js` — a real Express API (CommonJS) wrapping all of the
  above, with real injected `transferVCoin` / `requestVoidCourierJob`
  functions calling the actual running V3 mock and VOID servers.

## Verified
33 plain-Node checks (product/affiliate-link/order validation, the
real 2-way and 3-way payout splits proven to sum exactly to the
charged price via a fake ledger, insufficient-funds handling that
leaves no order behind, fulfillment idempotency) plus a full live pass
with `chopz-shop/server.js`, `chopz/server.js`, VOID, and the V3 mock
all running independently: a real product created, a real CHOPZ video
linking to it (across the two now-separate apps), a real affiliate
link, a real order checked out through that link — buyer charged
exactly 80, seller +62.4, affiliate +12, platform +5.6 (all real VCoin
transfers against the running V3 mock, escrow returned to exactly its
starting balance), the affiliate link's `conversionsCount` genuinely
incremented, and a real VOID courier job created and confirmed via
VOID's own `/api/job/:id` endpoint (verticalId `courier`, customerId
the real seller, unitPrice the real quoted shipping cost) — not a
stubbed response. See `dev-docs/` for the full record.

**Phase 2 (real category fees + cart checkout)**: 12 plain-Node checks
(the real category lookup for apparel/general/unspecified, an apparel
product's order correctly defaulting to 15% instead of 7%, an explicit
caller `feePercent` still overriding the category default, a real
2-item cart producing 2 real per-seller orders with the correct
per-item category fee each, the real summed total, 2 genuinely
separate buyer charges rather than one merged charge, an empty cart
rejected), plus a live pass against the real running server: two real
products (one apparel, one general), a real cart checkout across both,
independently confirmed against V3's own real balances — buyer bob
1000→900, seller-a (7% fee on $40) 1000→1037.20, seller-b (15% fee on
$60) 1000→1051, matching the plain-Node math exactly.

**Phase 3 (real click-through attribution window)**: 6 plain-Node
checks (a real click within the window auto-attributing a later order
with no explicit `affiliateLinkId`, a click outside the real 7-day
window correctly not attributing, last-click-wins across two
competing clicks, a different buyer's click never attributing someone
else's order, an explicit `affiliateLinkId` still always overriding
automatic attribution, and a no-click order still placing correctly
with zero commission), plus a live pass against the real running
server and the real standalone V3: a real click logged 2 days before a
real order with no `affiliateLinkId` in the request at all — the order
still correctly attributed itself to that click and paid the real
`$10` commission, confirmed against V3's own balance.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8801) — CHOPZ SHOP's own real state now
survives a restart. Live-verified: created a real product listing, killed
the running process, restarted it, and confirmed the same real state came
back from a real GET. See `dev-docs/phase-4-real-persistence/`.

## Real metrics feed
Every real cart checkout pushes a real `checkout_revenue` metric to
VACO Analytics (fail-soft — a real checkout is never held up if VACO
Analytics is down). See `vaco-analytics/dev-docs/phase-5-live-metric-feeds/`.

## Not yet built
- Live shopping (TikTok Shop's real 10-15x-engagement driver) and the
  four real ad formats named in the comparable doc.
- True all-or-nothing cart transactions — `createCartCheckout`'s own
  items settle sequentially and a partial failure leaves earlier items
  real and placed rather than rolled back (see its own header); real
  distributed-transaction infrastructure would be required for a
  stronger guarantee.
- Category rates beyond the two the comparable doc actually cites
  (general, apparel) — any other category name falls back to the
  general rate rather than a fabricated, more specific number.
