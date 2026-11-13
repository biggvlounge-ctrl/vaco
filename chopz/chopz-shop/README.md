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
- `lib/dashboards.js` — **undocumented here until 13 Nov 2026, found
  and fixed in a doc-reconciliation pass; the real code and its tests
  (`test/dashboards.test.js`, 7 tests) have existed since this
  project's very first commit.** `creatorDashboard`/`sellerDashboard`
  are real aggregations over `store.orders`/`store.affiliateLinks`
  only — nothing invented, nothing from an outside model: real
  clicks/conversions/commission actually paid per affiliate link (read
  from the order's own recorded `affiliateCommission`, never
  recomputed from a rate that can change after the order settles), and
  a seller's real revenue/platform fees/affiliate share with a
  per-product breakdown. `trendingProducts` ranks real listed products
  by real completed-order count/revenue — explicitly not a
  personalization model; this file's own header says the "AI product
  recommendations" half of the original ask was declined because this
  session's environment has no generative-AI API key configured.
- `server.js` — a real Express API (CommonJS) wrapping all of the
  above, with real injected `transferVCoin` / `requestVoidCourierJob`
  functions calling the actual running V3 mock and VOID servers. Also
  mounts the three open, unguarded read routes `lib/dashboards.js`
  needs: `GET /chopz-shop/dashboards/creator/:creatorId`, `GET
  /chopz-shop/dashboards/seller/:sellerId`, `GET
  /chopz-shop/discovery/trending` (`?limit=`, default 10) — same
  no-actor-guard posture `GET /chopz-shop/products` already takes, a
  creator's or seller's own real numbers not being a secret the way a
  payment credential would be. **Honest gap, named rather than left
  silent**: none of these three routes has a frontend tab in
  `public/index.html` — checked directly, no reference to any of them
  there. Out of scope for this doc-only pass; see
  `dev-docs/RECONCILIATION_TRACKING.md`.

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

**Count correction (13 Nov 2026), checked directly against the real
test files rather than re-citing the numbers above.** The
phase-by-phase counts above (33 baseline / 12 Phase 2 / 6 Phase 3)
do not sum against the real, current test suite — they never did:
`test/money.test.js` has always been one consolidated file (16 tests
today) covering baseline order/payout logic together with the
category-fee, cart-checkout, and click-attribution cases, not three
separate per-phase files. The accurate counts, run directly: 16
(`test/money.test.js`) + 7 (`test/dashboards.test.js`) = 23, matching
this section's own "Full suite: 23/23" line; + 11
(`test/liveShoppingEvents.test.js`) = 34 overall, matching "34/34"
below. The running totals were (and are) correct; only the
baseline/Phase-2/Phase-3 sub-counts above were not, left struck
through rather than silently deleted: ~~33 plain-Node checks~~ /
~~12 plain-Node checks~~ / ~~6 plain-Node checks~~ — the real,
current per-file counts are stated just above instead.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8801) — CHOPZ SHOP's own real state now
survives a restart. Live-verified: created a real product listing, killed
the running process, restarted it, and confirmed the same real state came
back from a real GET. See `dev-docs/phase-4-real-persistence/`.

**Addition (13 Nov 2026), checked directly against `server.js` rather
than assumed from the paragraph above**: this section described the
file-backed path only, but `server.js` no longer builds its store with
`createPersistentStore` directly — it boots through
`lib/storeBackend.js#attachStore`, a later, ecosystem-wide addition.
Without `DATABASE_URL` set, nothing above changes — same file, same
guarantees. With it set, the store instead lives in Postgres via
`lib/persistencePg.js`, behind a gate that holds every request until
the store has actually loaded, and the process exits rather than
serving against a store that never loaded. This real capability
already existed in the code; it was never written down here until now.

## Real metrics feed
Every real cart checkout pushes a real `checkout_revenue` metric to
VACO Analytics (fail-soft — a real checkout is never held up if VACO
Analytics is down). See `vaco-analytics/dev-docs/phase-5-live-metric-feeds/`.

## Live Shopping Events (5 Nov 2026)

Closes this file's own flagged gap: `CHOPZ_TIKTOK_COMPARABLES.md`
names "live shopping" as a real, cited TikTok Shop engagement driver
("10-15x more engagement than static posts; brands running weekly
livestreams see 3-5x higher conversion"), and this README's own
earlier "Implementation status" section had already done the real
analysis — "Vavlt Stvdios has real live channels and CHOPZ SHOP has
real products, so the pieces exist in separate apps; nothing connects
them... that is the obvious next thing here." This is that connection.

`lib/liveShoppingEvents.js` (new): `createLiveShoppingEvent` schedules
a real event under a seller's own real Vavlt Stvdios channel —
verified LIVE via a real cross-app call (`GET /api/channels/:id`),
never trusted on the caller's claim, the same "never trust a bare
claim" discipline `dreams/server.js`'s own `fetchHvntzLocation`
already takes. Every featured product must be real and must actually
belong to that same seller. `goLiveShoppingEvent`/`endLiveShoppingEvent`
carry the event through `scheduled` → `live` → `ended`, gated to the
event's own seller. `getLiveShoppingEventSales` reports real, measured
orders/GMV for the event — never a fabricated engagement-lift
percentage; see "Not yet built" below for exactly what that would
need and doesn't have.

**No new checkout path.** `orders.js#createOrder` gained an optional
`liveShoppingEventId` — the exact same real atomic checkout, just
tagged with which real live event (if any) a purchase came through,
the same attribution shape `affiliateLinkId` already takes. Only
qualifies when the event is genuinely `live` and genuinely features
that exact product; an order with neither check satisfied is refused
before any money moves.

New routes: `POST /chopz-shop/live-shopping-events`, `GET
/chopz-shop/live-shopping-events` (+`:id`), `POST .../:id/go-live`,
`POST .../:id/end` (both seller-gated), `GET .../:id/sales`.

### Verification

`test/liveShoppingEvents.test.js` (new, 11 tests): real channel
ownership verified live (and refused when it belongs to someone
else, or doesn't exist); a seller cannot feature a product they don't
own or schedule with an empty product list; the real
scheduled→live→ended progression refuses to skip or reverse; a real
purchase attributed to a live event through the unchanged checkout;
refused when the event isn't live or doesn't feature that product; an
ordinary order's honest `liveShoppingEventId: null`; real sales
aggregation excluding orders not through the event; and real
sellerId/status filtering. Full suite: 23/23 → 34/34.

Mutation-verified both of the riskiest checks independently:
replacing the channel-ownership comparison with `if (false)` turned
exactly the ownership-refusal test red (10/11 in that file); replacing
the featured-product check in `createOrder` the same way turned
exactly that attribution test red; both restored, 34/34 green across
the full suite.

Live-verified against a real spawned stack (Shield + V3 + Vavlt
Stvdios + this app, no mocks): registered a real Vavlt Stvdios channel
owned by a real seller, created a real product, scheduled a real live
shopping event against that real channel, confirmed a purchase was
refused while the event was still `scheduled`, confirmed a stranger
could not go live on someone else's event (403), went live as the
real seller, completed a real purchase attributed to the event
(real VCoin split three ways, unaffected), confirmed the real sales
aggregate (`orderCount: 1, gmv: 30`), ended the event, and separately
confirmed the channel-ownership check refuses on its own (a seller
claiming someone else's real channel for their own real product was
refused with the real "channel ... is not owned by ..." message).

## Not yet built
- ~~Live shopping...~~ **Done (5 Nov 2026) — see "Live Shopping
  Events" below.** Real Vavlt Stvdios channels and real CHOPZ SHOP
  products are now genuinely connected, closing this file's own
  earlier "Implementation status" analysis of the gap.
- **The four real ad formats named in the comparable doc — checked
  directly, and declined rather than built.** Unlike live shopping,
  this file's own earlier analysis never identified a clear, existing
  cross-app seam for these the way it did for channels+products.
  Building them for real would mean bootstrapping a seller through
  VENVM's real `Brand` → `Campaign` → `Ad` hierarchy
  (`venvm/lib/campaigns.js`/`adDashboard.js`) with no existing
  onboarding path from a CHOPZ SHOP seller into a VENVM brand — a real
  cross-app identity/onboarding design question, not a format-tagging
  one, and the kind of invented bootstrapping flow this session's own
  discipline declines to build unasked. `venvm/lib/adDashboard.js`'s
  own `createAd` already has a free-form `platform` field (which
  social network — "tiktok," not which format); a `format` field could
  be added the same way once that onboarding question is actually
  answered.
- Real, measured engagement/conversion LIFT from a live shopping
  event — `getLiveShoppingEventSales` reports real orders/GMV for a
  real event, honestly, but proving TikTok's own cited "10-15x
  engagement, 3-5x conversion" figures would require a real control
  group (an equivalent non-live sales period) this app has no
  mechanism to define or isolate.
- True all-or-nothing cart transactions — **checked again directly,
  5 Nov 2026, and confirmed this is a deliberate design decision, not
  a forgotten gap**: `createCartCheckout`'s own header and
  `test/money.test.js`'s own "cart items settle sequentially" test
  argue, correctly, that batching every item into one settlement would
  make one seller's shortfall block every other seller's already-valid
  payment in the same cart — worse than the current per-item atomicity,
  not better. Left exactly as is.
- Category rates beyond the two the comparable doc actually cites
  (general, apparel) — any other category name falls back to the
  general rate rather than a fabricated, more specific number.
