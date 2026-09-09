# VOKEN Master Specification — Progress Document (v1, in progress)

**Status**: Building per the outline provided, adopting the VDAS
(VOKEN Digital Asset Standard) restructuring — Cvltvre Cards becomes one
product line under the broader standard, alongside Vehicle Cards,
Property Cards, Music Cards, Creator Cards, Event Cards, Business Cards,
and Avatar Cards.

**Format note**: this document (and its continuation) will be a
thorough written specification in markdown, with real Mermaid diagrams
for architecture/workflow sections where useful. This is achievable at
full depth. A separate, distinct deliverable — an actual investor-facing
.pptx deck — can be built once the written spec is solid, using the pptx
skill; that's a different kind of output (visual/slide design) than a
written master specification, worth treating as two deliverables, not
one.

**Blocking dependency — RESOLVED.** VOKEN's real CLAUDE.md brief was
found in this conversation's own transcript (before compaction) —
no need to re-send it. Full detail below.

## What VOKEN actually is (from the real brief)

A marketplace where anything with rarity, ownership, or cultural
relevance — vehicles, property, music, art, creator memberships,
digital wearables, business loyalty programs, event moments,
landmarks — becomes a "Cvltvre Card": collectible, tokenized, ownable,
buyable/sellable/tradeable/auctionable/rafflable/giftable/
collectible/displayable/shareable.

## Real component map (from `App.jsx`, ~1,780 lines)

| Component | Role |
|---|---|
| `VokenApp` | Root — owns `screen` (active tab) and `openAsset` (drill-in) |
| `MarketScreen` | Card feed, category filter + sort (heat/price/24h) |
| `AssetDetail` | Hero card header + `ActionBar` + 6-tab body: overview/valuation/provenance/ownership/activity/finance |
| `ActionBar` | Trade/Gift/Raffle/Collect/Display/Share |
| `DropsScreen` | Raffles/Power-Buy pools |
| `WalletScreen` | VASH wallet: VCoin balance, credit line, staking, BNPL |
| `InsightsScreen` | AI heat map, top movers, leaderboard |
| `VaultScreen` | Portfolio value, allocation pie chart, holdings, reputation |
| `CultureCard` | Card-front UI for the market feed grid |

## Real data model — the Cvltvre Card (Asset) shape

```js
{
  id, cat, name, sub,
  rarity,            // one of 7 RARITY tiers
  edition,           // one of 8 EDITIONS types
  tokenization,      // one of 4 TOKENIZATION types — drives Ownership tab logic
  formats,           // subset of ['physical','digital','tokenized','avatar']
  price, change,
  auctionType,       // 'instant' | 'english' | 'dutch' | 'offer'
  currentBid, bidCount, endsIn,
  shares,            // { total, sold, pricePerShare } | null — fractional only
  heat, projected, confidence,   // AI valuation numbers
  fraud,             // always 'clear' in the prototype — no real detection yet
  rental,            // { active, yield } | false
  financing,         // { apr, terms: [months] } | null
  priceHistory,      // 12-point series feeding the price chart
  cert,              // { id, vin, registry, score } — VACA certificate mock
  provenance,        // [{ y: year, e: event }] — ownership timeline
  activity,          // [{ who, what, when }] — bid/offer/sale feed
  creator,           // { name, followers, royalty, perks: [] } | null
}
```

## Real design tokens (worth preserving in the master spec's visual direction)

```
bg-void      #0B0B0F   near-black background
card-stock   #F2EFE6   warm ivory — Cvltvre card face
ink          #17140F   text on card-stock
gold         #C9A227   primary accent / CTA
foil-a/b/c   #7DE8D6 / #C9A9F2 / #F2C879   legendary foil gradient
mythic foil  #FF6B6B → #C9A9F2 → #7DE8D6 → #F2C879
1/1 foil     #EDEAE0 → #C9A227 → #EDEAE0 → #8A8878  (platinum/gold)
display font  'Fraunces', serif — card titles/headers
data font     'JetBrains Mono', monospace — prices/tickers/ledger
body font     'Inter', sans-serif
```

Note: the "mythic foil" and "1/1 foil" gradients confirm VOKEN's real
rarity system extends beyond the simpler Bronze→Icon 7-tier system used
in an earlier, separate Cvltvre Cards implementation inside Vvltvre's
own prototype — the two aren't necessarily the same tier set. **The
exact 10 category names and 7 rarity tier labels used in VOKEN's own
`CATEGORIES`/`RARITY` constants weren't captured in what's recoverable
from this transcript** — worth confirming directly if the master spec
needs those exact labels rather than the count/structure.

## Placeholder category/rarity names (flagged — not confirmed labels)

Since the exact strings weren't recoverable, these are reasonable
placeholders grounded in VOKEN's own description, not confirmed:

**10 categories** (9 explicitly named in VOKEN's own "what VOKEN is"
text + 1 catch-all): Vehicles, Property, Music, Art, Creator
Memberships, Digital Wearables, Business Loyalty, Event Moments,
Landmarks, Collectibles (general catch-all).

**7 rarity tiers**: Common → Uncommon → Rare → Epic → Legendary →
Mythic → 1/1 — inferred from the real design tokens showing distinct
"mythic foil" and "1/1 foil" gradients beyond a base tier system.

Replace both lists with the real labels the moment they're available;
don't treat these as final.

Fractional ownership of real estate, vehicles, and other high-value
physical assets is securities-adjacent in most jurisdictions. No real
money-movement on top of `shares` purchasing, Power Buy pools, or
financing/leasing flows without legal review first — same seriousness
as VAGO's wagering flag.

## What's real vs. mocked in the existing prototype (relevant to Financial Projections honesty)

Real: category filter/sort, tab navigation, bid/offer/share steppers,
financing term selector with computed payment, trade/gift flow (against
hardcoded portfolio), price/allocation charts (real rendering, fake
data). Fully mocked: every dollar figure, every AI score, every VACA
certificate, all provenance/leaderboard data, auth (single implied
user), all escrow/payment processing. This matters for Section 12
(Financial Projections) — any numbers in that section are illustrative
targets, not derived from real usage data, and the spec should say so
plainly rather than imply otherwise.

---

## Competitive Comparables (researched, real 2026 data)

| Feature | Comparable | Real fee/structure data |
|---|---|---|
| Marketplace | eBay, StockX, Whatnot | eBay's Authenticity Guarantee now extends to graded trading cards $250+, partnering directly with PSA — a real model for VOKEN's own verification-embedded-in-marketplace approach |
| Auctions | Sotheby's, Christie's | Buyer's premium tiered and sliding (roughly 20-28% at the low end, dropping to ~10-15% above $6M, varies by house and changes frequently); seller's commission is increasingly negotiated to **0% for desirable lots** — major houses compete for consignments rather than charging them. This is genuinely complex/opaque pricing, worth deliberately choosing simplicity as a differentiator |
| Trading Cards | Topps, Panini, PSA | PSA grading uses tiered per-card fees with bulk-submission discounts (lower per-card rate at 20+ card minimums, value-capped) |
| Collectibles | Goldin, Heritage Auctions | Heritage notably charges 0% seller's commission on most items — a real differentiator worth knowing |
| Vehicle Marketplace | Bring a Trailer, Cars & Bids | BaT: **no seller commission**, flat listing fee ($99 Classic / $429 Plus / $2,500+ White Glove), buyer's premium 5-10% by category with a **capped maximum** ($7,500 cap on 5% categories, $4,000 on 10% categories) — this capped-buyer-fee, free-to-list-seller model is genuinely elegant and worth modeling VOKEN Vehicle Cards on directly |
| Real Estate | Zillow, Pacaso, Roofstock | (Not deep-researched this pass — flagging as open) |
| Fractional Ownership | Rally, Masterworks | Real, meaningfully different models: **Rally** spans 21 categories, $50-250 minimum per position, real (if thin) secondary market via a registered ATS (PPEX) after a 90-day lockup, simpler 1099-B tax treatment. **Masterworks** is concentrated (art only), $500 minimum, a disclosed but heavier fee stack (11% sourcing fee, 1.5% annual dilution, 20% carry), K-1 tax complexity, weaker liquidity. **For VOKEN's own multi-category ambition (vehicles, property, music, Cvltvre cards), Rally's broad-category/low-minimum/real-secondary-market model is the closer structural fit than Masterworks' concentrated approach.** |
| Creator Economy | Patreon, Fanatics Collect | (Already covered in the ecosystem-wide creator revenue-split research — 80/20 anchor applies here too) |
| Live Commerce | Whatnot, TikTok Shop | (Already researched for CHOPZ — same 5-8% referral-fee-range logic applies to any VOKEN live-auction/drop format) |
| Digital Assets | OpenSea (conceptually), Magic Eden | (Not deep-researched this pass — flagging as open) |
| Digital Identity | Roblox, Fortnite | (Already covered via VENVS/avatar research) |
| Payments | Stripe | (Standard; no new research needed) |
| Verification | Entrupy, PSA | PSA's tiered/bulk grading-fee model and eBay's direct PSA-partnership-for-marketplace-verification are the two concrete mechanisms worth adopting — verification as an embedded marketplace service, not a separate errand |

### What this comparables research suggests, concretely
1. **VOKEN's fee structure should favor sellers, not just match industry
   norms** — the two platforms with the best seller economics in this
   research (Bring a Trailer's zero seller commission, Heritage's zero
   commission on most items) are also among the most trusted in their
   categories. A capped buyer's premium + free/flat-fee seller listing
   (BaT's model) is a strong, simple template.
2. **Auction house fee complexity is a real cautionary tale, not just a
   comparable to copy** — Sotheby's and Christie's have changed their fee
   structures multiple times in the past two years (2024 simplification
   attempt, reversal, 2025-2026 restructuring) precisely because opaque,
   frequently-changing fees erode trust. VOKEN's auction fees should be
   simple and stable by design, not evolved reactively.
3. **Rally over Masterworks as the fractional-ownership structural
   model** — broad category access, low minimums, real (even if thin)
   secondary liquidity, and simpler tax treatment (1099-B) all match
   VOKEN's own multi-category ambition better than a concentrated,
   heavier-fee-stack model.

---

## Sections pending VOKEN's actual source content
- Executive Overview (Vision/Mission/Value Prop/Market Opportunity)
- Platform Overview
- Cvltvre Card System (needs real category/tier/tokenization-type detail)
- Universal Tokenization Engine
- Marketplace, Auction System, Raffle System (mechanics likely already
  partly documented — needs the real detail to write accurately)
- Vehicle/Real Estate/Music Marketplaces (feature detail beyond the
  comparables above)
- Creator Economy, Avatar & Venus Integration
- AI Systems, Trust & Verification
- Business API, Revenue Model, Financial Projections

---

## Implementation status (added when this file was placed into the repo)

**The VDAS taxonomy shipped, placeholder labels and all — which is
exactly the risk this document flagged, and it has now materialized.**

`voken/lib/cardTypes.js` contains this document's provisional lists
verbatim:

```js
const CATEGORIES = ['vehicles', 'property', 'music', 'art',
  'creatorMemberships', 'digitalWearables', 'businessLoyalty',
  'eventMoments', 'landmarks', 'collectibles'];
const RARITY_TIERS = ['common', 'uncommon', 'rare', 'epic',
  'legendary', 'mythic', '1-of-1'];
```

…under a comment reading "Replace both lists the moment the real ones
are available." That comment is still there, and the real ones are
still not available.

This is worth calling out rather than leaving as a footnote. The
document was careful: it labelled these "placeholder category/rarity
names — flagged, not confirmed labels" and said to replace them the
moment real ones exist. What happened instead is the ordinary thing —
provisional values became load-bearing because nothing else was
available to build against. Cards now exist under these categories,
the value algorithm weights against these rarity tiers, and every day
that passes makes renaming them more expensive. **This is the single
most time-sensitive open item in VOKEN**, and it is a naming decision
rather than an engineering one, so it cannot be resolved from inside
the code.

**Also real**: `TOKENIZATION_TYPES` (physical/digital/tokenized/avatar)
matches this document exactly, and the digital-first, physical-optional
posture is implemented as described.

**The prototype component map does not exist here.** VokenApp,
MarketScreen, AssetDetail, ActionBar, DropsScreen, WalletScreen,
InsightsScreen, VaultScreen, CultureCard — none are in this
repository. There is no `App.jsx` in `voken/`, and no `.jsx` file of
any kind. VOKEN is a server-side Express service; its visible surface
is VDP's district. The ~1,780-line prototype is real work that lives
somewhere else.

**"What's real vs. mocked" has largely inverted since this was
written.** Several things listed as fully mocked are now real:

| Listed as mocked | Now |
|---|---|
| All escrow/payment processing | **Real** — settles through V3; pack opening actually charges the buyer |
| VACA certificate (mock) | **Real** — VOKEN queries `GET /api/authenticity-grade/voken-card/:id` rather than trusting a caller-supplied grade |
| Auth | **Real** — Shield sessions |
| Every AI score | **Partially real** — `valueAlgorithm.js` computes from real scarcity, authenticity, and rookie inputs |

Still mocked or absent: `fraud` (this document is candid that it is
"always 'clear' in prototype — no real detection yet", and that remains
true — no fraud detection exists in `voken/lib/`), `rental`, and
`financing`. Those three have no counterpart in the backend at all.

**The compliance flag was honored.** "No real money-movement on
shares/Power Buy/financing without legal review first" is enforced by
`lib/complianceGate.js`, whose `fractional-ownership` gate defaults
closed. A second gate, `influencer-culture-card-rewards`, was added
alongside it and is also held pending review.

**The comparables research is the most actionable unbuilt part.** Three
recommendations, none implemented, and they are genuinely good:

1. **Bring a Trailer's capped buyer's premium** for Vehicle Cards —
   flat listing fee, 5-10% buyer's premium with a hard cap. Elegant,
   and directly adoptable.
2. **Fees simple and stable by design.** The observation that
   Sotheby's and Christie's changed fee structures repeatedly in two
   years and eroded trust doing it is the strongest argument in this
   document. VOKEN's fees today are category-based and stable; the
   recommendation is to keep it that way deliberately rather than by
   accident.
3. **Rally over Masterworks** as the fractional-ownership structural
   model — multi-category with low minimums fits VOKEN's ambition
   better than a concentrated, heavy-fee model. Worth noting Rally's
   real secondary market runs through a *registered ATS* after a
   90-day lockup, which is the concrete form the compliance gate above
   would eventually have to take.

**Sections still pending** — Executive Overview through Financial
Projections — remain pending. Nothing in this repo supplies them.
