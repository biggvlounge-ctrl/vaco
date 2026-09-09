# Revenue & Entity Inventory

Every app, sub-app, and system in the ecosystem, sorted by whether it
**earns revenue** — the input a corporate structuring conversation
actually needs.

Everything below is read out of the code: real take rates, real fee
constants, real settlement paths. Nothing is aspirational.

**One caveat, stated first because it matters.** This is a factual
inventory of what earns money and how. It is **not** legal or tax
advice, and the entity-type question at the end has consequences that
need a corporate attorney and a CPA before anything is filed. Read the
"Before filing anything" section — the S-Corp question in particular
has a trap in it.

---

## Tier 1 — Earns revenue directly (a defined take rate in code)

These have a rate constant, a settlement path through V3, and a real
payout. If anything becomes an entity, it is these.

| # | Business | Rate in code | Mechanism |
|---|---|---|---|
| 1 | **VOID** | 20–25% by vertical | 25 service verticals, per-job take. `verticals.js` |
| 2 | **VOID MAGIC** | **15.5%** | Meet & greets, media orders, ticketing. `PLATFORM_TAKE_RATE` |
| 3 | **VOKEN** | Varies | Cvltvre Cards, packs, auctions, fractional shares, resale, merch |
| 4 | **VAGO** | Varies | Prediction markets, sportsbook, esports, casino, fantasy |
| 5 | **HVNTZ** | Per event | **14 revenue streams** from one location. `revenueStack.js` |
| 6 | **DREAMS** | Per impression | Screen ads, traffic-based dynamic pricing |
| 7 | **CHOPZ SHOP** | **15%** apparel, 7% default | Category fees + affiliate splits |
| 8 | **VACAY** | Per booking | Stays, Experiences, Auto, Homes, Flights |
| 9 | **Vavlt Stvdios** | **20%** (creator keeps 80%) | Tips, subscriptions, locked tiers, 8-screen sessions |
| 10 | **Vvltvre Music** | Flat fee + **17.5%** mgmt | Distribution fees, royalty splits, label deals, beats |
| 11 | **Vvltvre Pods** | **10%** | Show subscriptions |
| 12 | **Vvltvre Flix** | Subscription | Three tiers, licensed + original titles |
| 13 | **Vvltvre Studios** | Revenue share | Fund-and-produce financing, project investment |
| 14 | **VXLLAGE** | Per item | Avatar cosmetics, village boosts |
| 15 | **CVNVO** | Per item | Date tokens (20 VCoin), gift dating, blind-date tokens |
| 16 | **VENVS** | Per sale | Marketplace, shop, publishing |
| 17 | **VEX** | **7%** trading fee | Brokerage — **gated, cannot operate yet** |
| 18 | **V3** | Conversion spread | VCoin→VASH at 0.01. **The ledger everything settles through** |

**18 platform businesses** — plus the owned brands below, which are a
different kind of business entirely.

---

## Tier 1b — Owned brands: restaurants, food, wellness, apparel

**A separate category, and the distinction matters more than any other
line in this document.**

Everything in Tier 1 is a *platform* business: it takes a percentage of
somebody else's transaction. It holds no inventory, occupies no
premises, and its workers are contractors.

An owned brand is the opposite. It carries **inventory and cost of
goods**, often **physical premises**, and **real W-2 employees** rather
than gig providers. Its liabilities are entirely different — and
mixing an operating restaurant into the same entity as a software
platform is the classic reason people form subsidiaries in the first
place.

### The eleven brands (real, in `vdp/src/lib/foodDistrict.js`)

Ten food brands under **VEDA Food Group**, plus **VAZAN**, which is now
its own parent company under VEDA — a different regulatory regime
entirely.

| Brand | Concept |
|---|---|
| **VIVE** | Coffee & fresh-pressed beverages |
| **VIXENS** | Vegan restaurant |
| **VORDABELLO'S** | Upscale chef-made Italian, fast |
| **VODEGA** | Full-variety sandwich shop, hot & cold |
| **VFRESH** | Fresh produce & grocery goods |
| **TACO TOWN** | — |
| **BIG JACK'S** | — |
| **NETTY'S** | — |
| **WEDGE** | — |
| **Chicken Spot** | Name still TBD |
| **VAZAN** | **Supplements & skincare** — now its own parent company under VEDA, not part of VEDA FOODS. See `CORPORATE_STRUCTURE.md`. |

*A correction to an earlier note in this repo: a previous pass recorded
a discrepancy of "8 tenants in code vs 9 in the doc." That was wrong.
There are **eleven** in code, VORDABELLO'S among them. The question is
closed.*

### Apparel

- **CHOPZ SHOP apparel** at a **15% category fee** is a *marketplace*
  line, already counted in Tier 1 — it sells other people's clothing.
- **VOKEN / CVLTVRE limited-edition merch** is a real branded product
  line inside VOKEN.
- **VACO Merch Store** (`vaco-shell/VACO_MERCH_STORE.md`) is
  **documented but not built**. Its own status section says so plainly.

**Correction — an owned clothing house DOES exist, and I said otherwise.**
**SVMIKO DEGVCHI** is real and built: `venvs/src/lib/svmikoDegvchi.js`,
**13 sub-brands**, each a distinct storefront in VENVS's branded-seller
system, plus virtual wearables in VDP. DEGVCHI, LVCII, DND, BOOBI
Couture, BLVD, JACQVÉ, ZV, RED VEIL, VEDELLÍN, VvLGAR, VAISON, ANCÓR,
DVMB.

It sits under **VEDA** in the corporate structure — see
`dev-docs/CORPORATE_STRUCTURE.md`. What is genuinely not built is the
**VACO Merch Store**, which is a different thing.

### Why these change the structuring answer

Each of these carries exposure the software side does not:

| Exposure | Applies to |
|---|---|
| **Food safety, health inspection, permits** | All ten food brands |
| **Premises liability, leases, build-out** | Any physical location |
| **W-2 employment** — wage & hour, scheduling law, workers' comp | All of them. Genuinely different from the contractor question in the compliance register, and it does not go away with a classification argument. |
| **Liquor licensing** | Any brand that serves alcohol |
| **FDA / FTC — supplements and cosmetics** | **VAZAN specifically.** Supplements are regulated for labeling and structure-function claims; skincare is a separate cosmetic regime. This is the highest-regulation item in the entire brand list and it is easy to miss because it sits in a food district. |
| **Product liability, textile labeling, country-of-origin** | Apparel |

**Practical read:** operating businesses with premises, inventory, and
employees are a *stronger* case for separate entities than the software
platforms are — the liability is physical, insurable, and traditionally
ring-fenced. A restaurant group is commonly its own entity, sometimes
one per location.

That points at a structure with roughly three arms rather than one
flat list:

1. **Technology / platform** — the software businesses, sharing V3,
   Shield, and the rest of the infrastructure.
2. **Brands / operating** — the food, wellness, and apparel businesses.
   Physical, insurable, employee-bearing.
3. **Regulated** — VEX, VAGO, V3's money-transmission question, and
   the licensing-gated VOID verticals.

Revised count: **18 platform businesses + 11 owned food/wellness brands
+ merch lines**, against 7 monetizable and 6 infrastructure.

## Tier 2 — Monetizable, not yet monetized

Built and running, no revenue mechanism in code today. Each is a real
future line.

| Business | The obvious model |
|---|---|
| **VACO Shell** | **App Store** — see below. Currently a launcher with a 31-app registry and bundles, no fees. |
| **VENVM** | AI production pipeline. Would bill per job; no cost or fee capture exists yet. |
| **VDP** | The walkable world. Districts, storefronts, land — all monetizable, none monetized. |
| **VACA** | Identity attestation. Per-verification pricing is the standard model. |
| **VSAFE** | Safety layer. Could be a B2B licensed product on its own. |
| **YAP** | Reviews. **Do not monetize before legal review** — see the compliance register. |
| **Vex Business** | Internal research tool today. Real SaaS product if externalized. |

## Tier 3 — Infrastructure (no revenue, and shouldn't have)

These exist so the 18 above don't each build their own. They are cost
centers by design.

`shield` (auth) · `vacon` + `v4-proxy` + `v4-search` (agents) ·
`vaco-analytics` · `world-layer` · `vacon-c` (paused)

**Making these separate entities creates filing and tax overhead with
no revenue to justify it.** They're the natural contents of a single
operating or IP-holding company.

---

## What this means for structure

### The count

**18 revenue businesses + 7 monetizable + 6 infrastructure = 31.**

Making all 31 separate corporations means 31 sets of: state filings,
registered agents, annual reports, separate books, separate bank
accounts, separate tax returns, and **intercompany agreements for every
cross-app flow** — and this ecosystem is built on cross-app flows.
Eighteen apps settle through V3. That is 18 intercompany money
movements that would each need a written agreement and transfer
pricing.

That is real recurring cost and real ongoing administration, and it is
the main argument against maximal separation.

### The three structures actually worth pricing with your attorney

**A. Single C-Corp, divisions inside.** Cheapest and simplest. One tax
return, no intercompany agreements, one cap table. Loses per-business
liability isolation, and you cannot sell one business without carving
it out.

**B. Holding company + subsidiaries for the regulated ones only.** The
middle path most operators land on. A parent owns the IP and the shared
infrastructure; separate entities only where the risk genuinely
justifies one — **VEX** (broker-dealer), **VAGO** (gaming), **V3**
(possible money transmission), **YAP** (defamation exposure), and the
licensing-gated VOID verticals. Everything else stays inside the
parent.

**C. Holding company + an entity per revenue business.** Maximum
isolation and maximum overhead. Defensible if you intend to sell or
raise against individual businesses.

My read of your own compliance register: **B** matches the actual risk
distribution. The exposures are concentrated in five places, not spread
across eighteen.

### Before filing anything — the S-Corp trap

You said "corporation or S-Corp." Those aren't alternatives — an S-Corp
is a *tax election* a corporation makes, and it carries restrictions
that matter here:

- **100 shareholders maximum.**
- **One class of stock only.**
- **US citizens and residents only** as shareholders.
- **No corporate or partnership shareholders** — which means **a
  holding company cannot own an S-Corp subsidiary**, and that alone
  rules out structures B and C in S-Corp form.
- **Venture investors require preferred stock**, which is a second
  class. Taking institutional money terminates the election.

The reason nearly every startup that intends to raise is a **Delaware
C-Corp** is these constraints. S-Corp election is genuinely better for
a profitable, closely-held business distributing cash to a small number
of US owners — a real situation, just a different one.

**This is exactly the decision to bring a corporate attorney and a CPA
into**, and it is cheap to get right at the start and expensive to
unwind later.

---

## Sequencing note

You do not need 31 entities to begin. The compliance register argues
for launching low-regulation verticals first to build the provider
pool; the same logic applies here. Form the parent and the two or three
entities the regulated businesses require, and add entities as
businesses actually reach revenue.

Filing an entity for a business with no customers costs money every
year and protects nothing.
