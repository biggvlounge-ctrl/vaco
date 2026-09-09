# How VACO Makes Money — The Complete Revenue Split Model (v1, definitive)

Direct answer to a genuinely important question: yes, this is designed
to be beneficial to **VACO itself**, not just businesses. A smaller
percentage of a much larger, VACO-enabled pool of activity is worth
more than a larger percentage of nothing — same model Uber, DoorDash,
Amazon, and every real platform in this document's comparables uses.
A business that feels exploited leaves; a business that's genuinely
thriving stays, grows, and brings more volume VACO earns from.

**Honest caveat**: most of the fifteen-plus revenue streams built this
session were specified qualitatively without a locked exact
percentage. Below are real, reasoned splits grounded in actual
comparables already researched — **the real starting point, not
numbers cast in stone**. Final rates should be confirmed once real
usage data exists.

## Complete split table

| Stream | VACO's cut | Business's cut | Real comparable basis |
|---|---|---|---|
| Hunt participation (sponsor budgets) | 15-30% | 70-85% | real sponsorship platform standard |
| DREAMS screen ad revenue | 30-50% | 50-70% | real programmatic ad industry standard |
| DREAMS screen DTC commission | 5-15% | 85-95% | TikTok Shop (5-8%) / Amazon referral (8-15%) |
| VOID Station drone usage fee | cost recovery + margin | — | infrastructure fee, not a revenue split |
| VOID Station midpoint/relay fee | cost recovery + margin | — | infrastructure fee, not a revenue split |
| Vavlt Stvdios streaming/tips | 20% | 80% | established creator-revenue-split standard |
| VDP virtual storefront transactions | 5-15% | 85-95% | same marketplace-commission range as DTC |
| Business Locker storage | flat monthly fee to VACO | — | real transparent fee (the FBA differentiation point) |
| HVNTZ discovery placement | free/included | — | drives adoption, monetized indirectly |
| CVNVO date-location placement | real tiered subscription fee | — | business pays for visibility tier |
| Community thread + Village | free/included | — | drives engagement, monetized indirectly |
| Package pickup destination | small per-pickup handling fee | free foot traffic value | Amazon Hub Counter model |
| VOID rideshare hotspot | ~20-25% of ride fare | referral bonus | real standard rideshare take rate |
| Full-service delivery handoff | real delivery fee cut | — | standard VOID delivery economics |
| Neighbor Program trades | free/included | — | community-building, drives stickiness |
| Self-promotion ad rotation | N/A (VACO's own CAC benefit) | real capped compensation | already established capped rotation + payment |

**Why genuinely sustainable, not just generous**: the
infrastructure-fee rows matter most for VACO's own direct margin —
drone/station usage, relay fees, Business Locker storage are real,
direct VACO revenue lines, not shared splits. The "free/included" rows
aren't actually free — they're real adoption drivers making businesses
want to stay on the platform long enough to generate revenue through
paid streams — same logic as Costco's sample stations. The percentage
splits are deliberately positioned **below** extractive comparables
(Amazon FBA's real 35-45% total take) — VACO wins by being genuinely
fairer, driving more real volume than a higher-take, lower-adoption
model would.

## Critical distinction — own product vs. hosting someone else's ad

**Scenario A** — business sells its own product on its own screen
(e.g., VODEGA's own sandwich sells via VODEGA's screen): the business
keeps the large majority (85-95%) — they made the product, they earn
from selling it.

**Scenario B** — a different advertiser's product sells via an ad
shown on this business's screen (e.g., an outside ketchup brand's DTC
ad runs on VODEGA's screen, and a sale happens): a real three-party
split — the actual advertiser/seller keeps the large majority of the
sale; VACO takes its standard platform cut; the hosting business earns
only a small placement/hosting fee, since they didn't make or sell the
product, only provided screen real estate and visibility.

```
DtcSaleAttribution {
  saleId, screenId, hostBusinessId
  productOwnerId: string
  isHostBusinessOwnProduct: boolean
  hostBusinessShare: number  // 85-95% if true, small hosting fee if false
  productOwnerShare: number  // 0 if Scenario A; large majority if Scenario B
  vacoShare: number  // standard platform cut, either scenario
}
```

**Why this matters**: keeps economics honest on both sides — a
business shouldn't earn a large commission on someone else's product
they merely displayed, and an outside advertiser shouldn't have their
real margin eaten by a host business that didn't actually make the
sale happen.

## Per-scan revenue

A simpler, additive, predictable layer **on top of** (not replacing)
everything above: businesses earn a real, guaranteed payment per scan,
regardless of whether that scan converts into an actual sale.

**Confirmed additive**: DTC commission structure stays exactly as
established — businesses still earn their full share when a sale
happens. Per-scan revenue is a genuine second income layer on top.

**Location-based algorithm, not flat rate**: scales using the same
real `LocationDynamicPriceModifier` logic already established —
higher-traffic, higher-value locations earn more per scan than
lower-traffic ones.

```
PerScanRevenue {
  id, screenId, businessId
  scanCount: number
  perScanRate: number  // derived from LocationDynamicPriceModifier's
                          real traffic/revenue scoring, not flat
  totalScanRevenue: number  // scanCount × perScanRate, paid regardless
                               of conversion
}
```

**Why smarter**: gives businesses a real, predictable revenue floor —
earning something from every scan, not only on eventual purchase —
while DTC commission still rewards them further when a sale happens.
Real industry precedent: cost-per-click/cost-per-scan advertising
already works this way, layered underneath conversion-based
commissions.

**Status**: ready for Claude Code — real, reasoned percentage splits
for every revenue stream, grounded in comparables already researched,
with the own-product-vs-hosted-ad distinction made explicit. Recommend
confirming final rates with real usage data once live.

---

## Implementation status (added when this file was placed into the repo)

**Real gap this document exposed, now closed.** HVNTZ's
`recordRevenueEvent` — the engine behind "one onboarding, fourteen
revenue streams" — transferred the **full** `amountEarned` straight to
the business owner. VACO took **zero** on every stream, directly
contradicting this document's opening premise. Meanwhile VOID's own
`marketplace.js` already took a real platform cut on every job, so the
pattern existed in the ecosystem; HVNTZ simply never applied it.

Implemented in `hvntz/lib/revenueStack.js`:

- **`REVENUE_SPLITS`** — the table above, encoded per event type with
  each real min/max range preserved rather than flattened to one
  number.
- **Two real transfers**, summing to `amountEarned` exactly (VACO's
  share rounded first, the business gets the exact remainder — the
  same no-drift pattern VOID's `completeJob` established).
- **Default = the low end of each range**, consistent both with this
  document's stated positioning ("deliberately positioned below
  extractive comparables") and with its own honest caveat that these
  are "the real starting point, not numbers cast in stone."
  Overridable per call via `vacoSharePercent`, which is exactly how
  the recommended "confirm final rates with real usage data" happens
  without a code change.
- **The non-percentage rows take 0% on the event** — infrastructure
  fees (station/relay), the flat monthly locker fee, CVNVO's tiered
  subscription, and the deliberately free/included adoption drivers
  (discovery placement, community thread + Village, neighbor trades)
  are monetized by different mechanisms in this document's own model.
  A fabricated percentage there would misrepresent the model.
- **`full-service-delivery` = 20%**, grounded in "standard VOID
  delivery economics" — VOID's own `courier`, `foodDelivery`, and
  `freightMoving` verticals all really do take 20%.

**Self-promotion ad rotation** is not one of HVNTZ's 14 event types —
it is VACO's own CAC benefit with capped compensation handled by a
separate, already-established mechanism, not a revenue split.

**Not built** (real, named, genuinely absent):
- **`DtcSaleAttribution`** — the Scenario A vs. B three-party split.
  `screen-dtc-sale` currently treats every sale as Scenario A (host
  sells its own product), which is the correct conservative default
  since no `productOwnerId` exists on any real sale record yet.
  Building it needs that field to exist first.
- **`PerScanRevenue`** — no real scan-count telemetry exists to
  compute it from, and `LocationDynamicPriceModifier` (referenced as
  "already established") should be confirmed to exist before anything
  is built on top of it.
