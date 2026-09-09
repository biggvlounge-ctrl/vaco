# Cvltvre Extraction Audit — and the VADO question

**Date:** 2026-08-26 · **Method:** measured against the repository.
Every file path, route, and dependency below was read at audit time.

**Why this document exists.** The Ecosystem Acceleration Directive asks
to expand the parent ecosystem from 16 to 18, adding **CVLTVRE** as
parent #17 and **VADO / The Art District** as parent #18, and requires a
Cvltvre Extraction Audit before restructuring. It also requires that
*"the exact current repository definitions of VULCAN / VOKEN / VACA must
be verified before implementation so that naming and responsibilities
remain consistent with the actual VACO architecture."*

That verification was performed first. It changes the shape of the work,
so it comes before the audit itself.

---

## Part 0 — Verification findings

> **A note on "VULCAN".** The directive named "VULCAN / VOKEN" as though
> both existed. `grep -rl "VULCAN"` across this repository returns
> nothing but two binary false positives inside `vex-business/.venv/`.
> That was raised, and **confirmed by the founder as a typo for VOKEN**.
> It is recorded here only so the same check is not run twice; it is not
> an open item, and nothing below depends on it.

### Finding 1 — Cvltvre is not new. It is VOKEN's shipped product

**CVLTVRE is already the real, customer-facing brand name for VOKEN's
entire Cvltvre Card product.** It is not a doc comment — it is a live
module, `voken/lib/brand.js`, deliberately built as a queryable source
of truth so the name cannot drift between files:

```js
const BRAND_NAME = 'CVLTVRE';
const POWERED_BY = 'VOKEN';
```

Its own header states the relationship precisely:

> CVLTVRE, the real, customer-facing brand name for this project's
> entire Cvltvre Card product (cards, packs, trading, VEX, VADO,
> fractional ownership, merch, art frames). VOKEN itself stays the
> technical/project name — the same relationship V3 already has to
> VCoin/VASH.

Evidence across the repo: `voken/dev-docs/phase-9-cvltvre-brand/`,
`voken/dev-docs/phase-1-culture-card-and-value-algorithm/`,
`voken/VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md`,
`voken/public/index.html`, `voken/README.md`, `vdp/README.md`,
`dev-docs/COMPANY_TREE.md`, `dev-docs/MASTER_COMPANY_REGISTER.md`,
`dev-docs/REVENUE_ENTITY_INVENTORY.md`, `vulture-music/public/index.html`,
`cvnvo/public/index.html`, `vaco-shell/lib/seedStore.js`. Task #24 in the
task list — *"Brand VOKEN's card product as CVLTVRE"* — is completed.

### Finding 2 — VADO is not new either. It is VOKEN's art surface

VADO was built in `voken/dev-docs/phase-5-vado-auctions-and-art/` and is
live today: four auction mechanics (instant, English, Dutch with
`DUTCH_DECAY_PER_MINUTE = 0.01` floored at the seller's reserve, and
offer), `lib/artCultureCard.js`, `lib/vadoExplore.js`,
`lib/galleryAccounts.js`, `lib/digitalArtFrame.js`. It has a VDP
district (`vdp/src/components/VadoView.jsx`, 87 lines) and a
restructuring doc (`voken/VEX_VADO_RESTRUCTURING.md`). Task #23 —
*"Make VOKEN canonical for VEX/VADO"* — is completed.

`dev-docs/COMPANY_TREE.md` already records both, under parent #2:

```
### 2. VOKEN — collectibles
- **VOKEN** — Cvltvre Cards, auctions, fractional shares, resale
- *CVLTVRE* — the consumer brand VOKEN's card product ships under
- *VADO* — the auction/marketplace identity inside VOKEN
```

### What this means

Promoting CVLTVRE and VADO to parents #17 and #18 is **not a greenfield
build. It is an extraction of working, shipped, money-moving code.**
That is a materially different and riskier task than creating two new
apps, and the directive's own instruction — audit before restructuring —
is exactly right.

The rest of this document is that audit.

---

## Part 1 — Where Cvltvre currently lives

**One app: `voken/`.** Port 8794. 65 routes. 27 lib modules,
2,683 lines. One test file (`complianceGate.test.js`). Registered in
`vaco-shell/lib/registry.js` as `parent: 'VOKEN'`, bundle
*Commerce & Marketplace*.

### Module inventory, classified

| Module | Lines | Belongs to |
|---|---:|---|
| `cardTypes.js` | 23 | **Core** — categories, rarity tiers, tokenization types, formats |
| `cultureCards.js` | 174 | **Core** — mint, editions, serials, ownership transfer, provenance |
| `valueAlgorithm.js` | 177 | **Core** — the value score |
| `cardEngagement.js` | 47 | **Core** — engagement events feeding value |
| `store.js` | 45 | **Core** — one store, all 30 top-level fields |
| `persistence.js` | 177 | **Core** — shared runtime, not domain |
| `shieldAuth.js` | 53 | **Core** — shared runtime, not domain |
| `platformAccount.js` | 11 | **Core** — the VOKEN platform account |
| `complianceGate.js` | 50 | **Core** — gates that refuse |
| `cardPacks.js` | 142 | **Cvltvre** — pack tiers, opening, odds |
| `provablyFair.js` | 62 | **Cvltvre** — pack/raffle fairness |
| `raffles.js` | 73 | **Cvltvre** — raffle entry and draw |
| `trading.js` | 119 | **Cvltvre** — card-for-card trades |
| `cultureCardApplication.js` | 103 | **Cvltvre** — apply to be carded |
| `establishedCreatorAssessment.js` | 79 | **Cvltvre** — creator tiering |
| `creatorDigitalProfile.js` | 52 | **Cvltvre** — creator profile |
| `exploreVoken.js` | 38 | **Cvltvre** — explore surface |
| `referralGrowth.js` | 183 | **Cvltvre** — referrals and spins |
| `brand.js` | 26 | **Cvltvre** — CVLTVRE identity |
| `auctions.js` | 213 | **VADO** — four auction mechanics |
| `artCultureCard.js` | 79 | **VADO** — art cards |
| `vadoExplore.js` | 40 | **VADO** — art explore |
| `galleryAccounts.js` | 37 | **VADO** — gallery accounts and holdings |
| `digitalArtFrame.js` | 55 | **VADO** — art frames |
| `fractionalOwnership.js` | 362 | **Contested** — see below |
| `limitedEditionMerch.js` | 92 | **Contested** — see below |
| `seedDemoData.js` | 171 | Fixtures |

Rough split: **Core ≈ 580 lines, Cvltvre ≈ 877, VADO ≈ 424, contested
≈ 454.**

### Routes, by surface

**VADO (14 routes)** — all in `voken/server.js`:

```
POST /api/auction                        POST /api/art-card
GET  /api/auction/:id                    GET  /api/art-card/:cardId
GET  /api/auctions/open                  POST /api/art-card/:cardId/for-sale
GET  /api/auction/:id/dutch-price        POST /api/art-card/:cardId/view
POST /api/auction/:id/bid                GET  /api/vado/explore
POST /api/auction/:id/end                POST /api/gallery-account
POST /api/auction/:id/accept-offer       GET  /api/gallery-account/:id
                                         GET  /api/gallery-account/:userId/holdings
POST /api/art-frame                      GET  /api/art-frame/:id
POST /api/art-frame/:id/load
```

**Cvltvre (~42 routes)** — cards, editions, transfers, value scores,
pack tiers, raffles, trades, applications, engagement, explore,
creator profiles, referrals, spins, brand.

**Contested (9 routes)** — the `/api/fractional/*` family and
`/api/merch/*`.

**Shared (2)** — `/api/health`, `/api/compliance-gate/*`.

---

## Part 2 — The coupling, measured

This is the finding that determines whether the split is safe. It was
read from the source, not inferred.

### Every VADO module depends on the Cvltvre card engine

```
artCultureCard.js      → cultureCards.mintCultureCard, getCultureCard
auctions.js            → cultureCards.getCultureCard, transferEditionOwnership
digitalArtFrame.js     → cultureCards.getCultureCard
vadoExplore.js         → artCultureCard, cardEngagement, valueAlgorithm
fractionalOwnership.js → cultureCards.getCultureCard, transferEditionOwnership
                       → complianceGate.isComplianceCleared
```

The dependency runs **one way — VADO depends on Cvltvre, Cvltvre does
not depend on VADO.** That is the good news, and it is the only reason
this split is tractable at all.

### An art card *is* a Cvltvre Card

`artCultureCard.js` does not model a separate asset. It calls
`mintCultureCard(store, { category: 'art', ... })` and layers a linked
`artCultureCards` record keyed by `cardId` — the same "own entity linked
by id" pattern VOID uses for lockers against stations. Its header says
so explicitly and explains that the reuse is the point: it inherits the
card-#1-to-subject guarantee and the mint-transparency mechanics for
free.

**So VADO is not a sibling product to Cvltvre. It is a category of it.**

### Money and ownership move together, in one process

`voken/lib/auctions.js`, the settle path:

```js
async function settle(store, auction, buyerId, price, transferFn) {
  await transferFn(buyerId, auction.sellerId, price,
    `voken_vado_${auction.auctionType}:${auction.cardId}`);
  transferEditionOwnership(store, {
    cardId: auction.cardId, editionNumber: auction.editionNumber,
    format: auction.format,
    fromOwnerId: auction.sellerId, toOwnerId: buyerId,
  });
  auction.status = 'sold';
  ...
}
```

The VCoin transfer and the edition ownership change happen back to back
against **the same in-process store**. `fractionalOwnership.js` does the
same thing for shares.

**This is the crux.** Split VADO into its own service and that pair
becomes a network hop: VADO takes the buyer's money, then calls VOKEN
over HTTP to move the edition. If that second call fails, the buyer has
paid and owns nothing, and there is no reversal endpoint in V3 by design
— *a correction is another transfer*, and someone has to notice first.

Today that failure mode does not exist, because both lines run in one
process with no I/O between them.

### One store, thirty fields, no seam

`createVokenStore()` returns a single flat object. VADO's
`artCultureCards`, `galleryAccounts`, `auctions`, and `digitalArtFrames`
sit alongside Cvltvre's `cultureCards`, `cardPacks`, `raffles`, and
`trades` — and `artCultureCards` records are *keyed into* the
`cultureCards` array by `cardId`. There is no schema boundary to cut
along. Splitting the store means either duplicating card records into
both services or making every VADO read a cross-service call.

### Two modules genuinely belong to both

- **`fractionalOwnership.js` (362 lines, the largest module)** — the
  primary and secondary market for fractional shares. It reaches into
  `cultureCards` for ownership transfer *and* `complianceGate` for
  clearance. It applies to art cards and to non-art cards equally.
- **`limitedEditionMerch.js` (92 lines)** — merch on cards, again
  category-agnostic.

Neither is a Cvltvre feature or a VADO feature. Both are **card-economy
features** that apply to any card. Assigning them to one side of a split
would be arbitrary, and whichever side loses them would need HTTP access
to them.

---

## Part 3 — Dependencies on the rest of VACO

| Dependency | How | Effect on a split |
|---|---|---|
| **V3 / VCoin** | `transferFn` injected into `openPack`, `settle`, `buyShares`, `buySecondaryShares`, `purchaseMerchItem` | Neutral — already an injected client, works from any service |
| **Shield** | `voken/lib/shieldAuth.js`, with `optionalOwnAccount('fromOwnerId')` and `optionalOwnAccount('buyerId')` chained on transfer and pack-open | Neutral, **but see the §5 warning below** |
| **VACA** | not referenced in `voken/lib/` | None |
| **V4** | not referenced | None |
| **VSAFE** | not referenced | None |
| **VDP** | `VadoView.jsx` (87 lines), `VexView.jsx` (101 lines) | Would need repointing — this was done once before for VEX (task #95) |
| **vaco-shell** | one `registry.js` row, `parent: 'VOKEN'` | Would become two or three rows |
| **VEX** | already extracted to standalone `vex/` (tasks #92, #95) | **This is the precedent — see Part 5** |
| **vaco-analytics** | VOKEN feeds metrics (task #59) | Feed would need splitting or duplicating |
| **Media** | art card images, art frames | No media pipeline exists yet (§9 of the Acceleration Matrix) |
| **External** | none | None |

**One warning that applies to any restructuring here.** VOKEN's
`shieldAuth.js` carries the ecosystem-wide identity gap documented in
`vxllage/lib/shieldAuth.js` and in §5 of the Acceleration Matrix:
`requireSession()` proves a session is valid but not that it belongs to
the acting account, except where `optionalOwnAccount` is chained. VOKEN
chains it on two routes. **Splitting this app into two or three services
copies that gap into each of them.** Fix the gap before the split, not
after — otherwise the restructure multiplies it, exactly as
copy-per-app already multiplied it to 29.

---

## Part 4 — Money flows that cross the proposed boundary

Every one of these is real, live, and settles in VCoin through V3:

| Flow | Module | Crosses the boundary? |
|---|---|---|
| Pack purchase → platform account | `cardPacks.js` | No — pure Cvltvre |
| Raffle entry → draw | `raffles.js` | No — pure Cvltvre |
| Card-for-card trade | `trading.js` | No — pure Cvltvre |
| **Auction settle → seller, + edition ownership** | `auctions.js` | **Yes — money in VADO, ownership in Cvltvre** |
| **Fractional share buy → seller, + share ledger** | `fractionalOwnership.js` | **Yes — module is contested** |
| **Secondary share buy → seller** | `fractionalOwnership.js` | **Yes** |
| Merch purchase → seller | `limitedEditionMerch.js` | **Yes — module is contested** |
| Referral spin rewards | `referralGrowth.js` | No — pure Cvltvre |

**Four of eight money flows cross the proposed line.** Each one becomes
a distributed transaction the moment the split happens.

And there is a compounding fact: **VOKEN has one test file**
(`complianceGate.test.js`). None of these eight money flows has a test
asserting conservation. VOKEN is not on the completion audit's untested
list only because it has *a* suite — but its money is uncovered.

**Restructuring untested money code is the single riskiest operation
available in this repository.**

---

## Part 5 — The precedent: how VEX was extracted

VACO has done this exact operation before, and it worked:

1. Task #92 — extract VEX brokerage out of VOKEN into standalone `vex/`
2. Task #95 — repoint VDP's `VexView`/`vexMarket` from VOKEN to `vex/`
3. Task #96 — fix `vaco-shell` registry: drop the stale VEX line, add
   the `vex-trading` entry
4. Task #97 — live-verify the whole restructure, update docs, commit
5. `voken/dev-docs/phase-16-vex-extracted-to-standalone-app/` records it
6. `venvs/dev-docs/phase-12-vex-vado-removed/` records the earlier
   removal from VENVS

**The difference that matters.** VEX is a brokerage — its domain is
orders and compliance, and it did not need to reach into
`cultureCards.js` to settle a trade. VADO does, on every single sale.
The VEX extraction cut along a real seam. A VADO extraction would cut
through one.

---

## Part 6 — Recommendation

### Cvltvre → Parent #17: **YES, and it is mostly renaming**

Promote **CVLTVRE (CVLTVRE)** to a Core Parent with `voken/` as its
primary app. This is a low-risk, high-clarity change because it matches
what the code already says: `brand.js` already declares CVLTVRE as the
customer-facing name for the whole product, exactly as VCoin/VASH is
the customer-facing name for V3.

**No code moves. No routes change. No money path is touched.** What
changes:

- `dev-docs/COMPANY_TREE.md` — CVLTVRE becomes parent #17; VOKEN becomes
  the technical app inside it, the same way V3 sits inside its parent
- `vaco-shell/lib/registry.js` — `parent: 'CVLTVRE'`, name shown as
  CVLTVRE
- `dev-docs/MASTER_COMPANY_REGISTER.md` and
  `REVENUE_ENTITY_INVENTORY.md` — updated entity rows
- `voken/README.md` — states the parent relationship

**Effort:** hours. **Risk:** documentation drift only.

### VADO → Parent #18: **YES as a parent, NO as a separate service**

The Art District is a real, coherent product identity and deserves
parent status. It already has its own explore surface, its own auction
mechanics, its own gallery accounts, its own VDP district, and its own
customer story.

**But do not extract it into a standalone app.** The reasons, ranked:

1. **Auction settlement would become a distributed transaction.** Money
   moves in one service and edition ownership in another, with no
   reversal endpoint in V3 and no compensating-transaction machinery
   anywhere in the repo. A buyer who pays and receives nothing is the
   worst failure mode in the ecosystem, and the current code cannot
   produce it.
2. **An art card *is* a Cvltvre Card.** Splitting the service does not
   split the data — `artCultureCards` is a satellite table keyed into
   `cultureCards`.
3. **`fractionalOwnership.js` and `limitedEditionMerch.js` cannot be
   assigned.** They are card-economy features, not Cvltvre or VADO
   features. 454 lines with no natural home.
4. **VOKEN's money paths have no tests.** Restructuring untested money
   code inverts the correct order of operations.
5. **The split would copy the §5 auth gap** into every new service.

**What to do instead — a parent identity over a shared runtime:**

```
CVLTVRE (parent #17)          VADO / The Art District (parent #18)
  └── voken/  (CVLTVRE)         └── voken/  (the same runtime)
        cardPacks                     auctions
        raffles                       artCultureCard
        trading                       vadoExplore
        applications                  galleryAccounts
        referralGrowth                digitalArtFrame
        ── shared card economy ──
        cultureCards · valueAlgorithm · fractionalOwnership
        limitedEditionMerch · complianceGate · platformAccount
```

Two parents in the register, two brands to customers, two VDP districts,
two `registry.js` rows pointing at the same runtime with different route
prefixes — and **one process where money and ownership still move
together.**

This is not a compromise for convenience. Two brands over one runtime is
already an established VACO pattern: CVLTVRE over VOKEN, VCoin/VASH over
V3, Vvltvre Touring & Tix over VOID MAGIC. The register models identity;
the runtime models correctness. They do not have to agree.

### If a physical split is required anyway

Should the split be mandated for organisational reasons, do it in this
order and not another:

1. **Test VOKEN's money paths first.** All eight flows, asserting
   conservation and refusal, in the style already established by
   `chopz-shop/test/money.test.js` and
   `vulture-studios/test/financing.test.js`. Nothing else starts until
   this is green.
2. **Fix the Shield actor gap** in `voken/lib/shieldAuth.js`
   (Acceleration Matrix §5) so the split does not multiply it.
3. **Extract Core first, not VADO.** Make `cultureCards`, `cardTypes`,
   `valueAlgorithm`, `complianceGate`, `fractionalOwnership`, and
   `limitedEditionMerch` a shared package under workspaces (Acceleration
   Matrix §1). Both services then `require` the same card engine
   in-process, and the auction settle path stays atomic.
4. **Only then split the HTTP surfaces**, keeping the store shared.
5. **Repoint VDP and the registry**, following the VEX precedent
   (tasks #95–#97).
6. **Live-verify**, as task #97 did.

**Never** put a network call between `transferFn(...)` and
`transferEditionOwnership(...)`.

---

## Part 7 — What is now recommended, and in what order

| # | Action | Risk | Effort |
|---|---|---|---|
| 1 | Write VOKEN money tests — all eight flows | Low | Days |
| 2 | Fix VOKEN's Shield actor gap | Low | Hours |
| 3 | Promote CVLTVRE to parent #17 (register + docs only) | Very low | Hours |
| 4 | Promote VADO to parent #18 (register + docs only) | Very low | Hours |
| 5 | Extract the shared card economy into a package | Moderate | Weeks |
| 6 | Reconsider a physical VADO service — **only after 1–5** | High | Weeks |

Items 3 and 4 deliver the directive's parent expansion, 16 → 18, this
week. Items 1 and 2 are worth doing regardless of whether the split ever
happens — VOKEN moves real VCoin through eight untested paths today, and
that is true under every possible org chart.

---

## Appendix — the one name still undefined

**VVI**, the grandparent entity above VACO, appears in exactly two
places in this repository — one line in `void/lib/taas.js` (which fixes
every TaaS subscription to `brandedAs: 'vaco'` as a constant, precisely
so a client cannot mis-brand to VVI) and a matching line in
`void/README.md`. Both cite `QUICK_INNOVATION_THREAD.md` §5 as the
source, and **that document is not in the repository.**

So what VVI actually is — what it holds, what it does, whether it is the
intended holding company for the eighteen parents below it — is not
recorded anywhere readable here. This is already flagged in
`dev-docs/COMPANY_TREE.md`.

It does not block the Cvltvre or VADO promotions. It is simply the one
document a corporate attorney would ask for first, and it does not
exist.
