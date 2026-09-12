# Go-live dossier — pricing, compliance, cost, and who builds what

**Date:** 2026-09-12 · Covers all 36 apps.

**Read this first.** This document mixes two kinds of statement and
they are marked throughout:

| Mark | Means |
|---|---|
| **[MEASURED]** | Read out of this repository by a command. Re-runnable. If it is wrong, the code is wrong. |
| **[ESTIMATE]** | My judgement. Not from any source document, not verified, and the ranges are wide on purpose. Treat as a starting point for quotes, never as a budget. |

Nothing in the **[ESTIMATE]** sections has been checked against a real
vendor, a real lawyer, or a real payroll. **The single largest cost
driver in this document is a decision you have not made yet** — whether
VAGO and VEX ever handle real money. That one choice moves the total by
roughly an order of magnitude, and it is called out where it bites.

---

## 1. Pricing — the complete list

### 1a. App Store listings **[MEASURED]**

Source: `vaco-shell/lib/seedStore.js`, held by
`scripts/test/store-pricing.test.mjs`. Every one of the 36 apps has a
pricing decision; none is priced by fallthrough.

**Paid — 4 apps**

| App | Price | Model |
|---|---:|---|
| Vex Trading | 60 VC | monthly |
| VENVM | 40 VC | monthly |
| VACON-C | 30 VC | one-time |
| VACO Analytics | 25 VC | monthly |

**Free — 32 apps**, in two groups with the reason recorded:

- **`transacts` (21)** — earns inside itself, so the store already
  takes a cut and charging admission would charge twice:
  VDP, VENVS, HVNTZ, DREAMS, VOID, VOID MAGIC, VOKEN, CVLTVRE, VADO,
  VAGO, VXLLAGE, CVNVO, YAP, CHOPZ, CHOPZ SHOP, VACAY, Vvltvre Music,
  Vvltvre Flix, Vvltvre Pods, Vvltvre Studios, Vavlt Stvdios.
- **`infrastructure` (11)** — a service other apps call, not
  merchandise: V3, VACA, Shield, VACON, VSAFE, V4 Proxy, V4 Search,
  VACO Audit, VACO Operator, VACO Media, VACO Notify.

### 1b. The real pricing model — take rates **[MEASURED]**

The 21 free apps are not free products. They are products whose price
is a percentage, and these are the rates actually in the code:

| Where | Rate | Constant |
|---|---:|---|
| App Store purchase | **15%** | `vaco-shell` `DEFAULT_STORE_TAKE_RATE` |
| Merch | **20%** | `vaco-shell` `DEFAULT_MERCH_TAKE_RATE` |
| Vvltvre Music — manager commission | **17.5%** | `DEFAULT_COMMISSION_PERCENT` |
| Vvltvre Music — label share | **50%** | `DEFAULT_LABEL_SHARE_PERCENT` |
| VOID MAGIC bookings | **15.5%** | `PLATFORM_TAKE_RATE` |
| CHOPZ — apparel | **15%** | `APPAREL_FEE_PERCENT` |
| CHOPZ — general | **7%** | `DEFAULT_FEE_PERCENT` |
| VACAY | **12%** | `PLATFORM_TAKE_RATE` |
| Vvltvre Pods | **10%** | `PLATFORM_TAKE_PERCENT` |
| VAGO — prediction trading fee | **7%**, probability-weighted | `TRADING_FEE_RATE` |
| VAGO — Originals house edge | **1%** (99% RTP) | `ORIGINALS_RTP` |
| VOID — late cancellation | **50%** | `DEFAULT_LATE_CANCELLATION_FEE_RATE` |
| DREAMS — screen owner keeps | **70%** | `SCREEN_OWNER_SHARE` |
| Vavlt Stvdios — creator keeps | **80%** | `CREATOR_SPLIT_PERCENT` |
| V3 — VCoin → VASH | **0.01** | `VCOIN_TO_VASH_RATE` |

**Two of these deserve a second look before launch [ESTIMATE]:** the
VAGO 7% prediction fee is high against Kalshi's real published fees,
and the V3 VCoin→VASH rate is marked *"inferred, not specified
anywhere"* in the code itself — it is a placeholder that has never been
priced deliberately.

### 1c. Merch **[MEASURED]**

11 seeded products, retail 18–52 VC, **margins 54–63%**. Sized against
Printify-style economics (a shirt costing ~$9–13 against $25–30
retail). Zero inventory — nothing manufactured until an order exists.

### 1d. What has never been decided **[ESTIMATE]**

- **VCoin's relationship to a real currency.** Everything above is
  priced in VCoin. Nothing anywhere states what a VCoin is worth in
  money, and until that exists none of these prices is a price.
- **Whether the subscriptions are per-seat or per-account.**
- **Whether first-party apps really pay the 15% store rate to
  themselves.** Today they do, and it nets out inside VEGA, but that
  makes every revenue report circular.

---

## 2. Compliance

### 2a. What the code already gates **[MEASURED]**

16 of the 36 apps raise a regulated topic in their own documentation.
The live gates:

| App | Gate | State |
|---|---|---|
| VAGO | Real-money gambling | **Out of scope entirely.** VCoin/Gold Coin only. Real-money settlement code is not to be written without counsel, licence, and age/geo/KYC/AML first. |
| VAGO | Iowa sports betting | Pending a real state licence decision |
| VAGO | Financial-market predictions (stocks, rates) | Parked as securities-adjacent |
| VEX (in VOKEN) | `placeTradeOrder` | Held pending broker-dealer review — **not cleared to move money** |
| VOID | `cannabisDelivery`, `medicalTransportation` | Licensing-gated. **Must not be relaxed.** |
| VOID MAGIC | Geofence | In place |
| CVNVO / YAP | Moderation, safety reporting | YAP recorded as the highest-liability item in the ecosystem |
| VENVM | Likeness consent | **Throws, does not warn** |
| VXLLAGE | `isVisibleToOthersAtVenue: false` | Deliberate default, stays |
| Vvltvre Flix / Studios / Music | Content licensing | Licence terms modelled; no real rights acquired |
| VACO Operator | Two-person rule, audit-before-authorization | Live |

**Everything settles in VCoin or Gold Coin. No real-money path exists
anywhere in the repository.** That is the single most important
compliance fact here, and it is what keeps the list below hypothetical.

### 2b. What it costs **[ESTIMATE — the widest ranges in this document]**

Two scenarios, because the gap between them is the whole decision:

**Scenario A — stays play-money (VCoin/Gold Coin only).**

| Item | Range (USD/yr) |
|---|---:|
| Privacy counsel — GDPR/CCPA, a dating app and a safety app hold sensitive data | $15k–40k |
| Terms, privacy policy, sweepstakes/AMOE review for VAGO's Gold Coin model | $10k–30k |
| Content moderation staffing (see §2c) | $60k–200k |
| Trademark filings across the brand portfolio | $10k–35k |
| **Total** | **~$95k–305k** |

**Scenario B — VAGO and/or VEX go real-money.** This is a different
company, not a feature.

| Item | Range (USD) |
|---|---:|
| Gaming counsel, per jurisdiction | $50k–150k each |
| Gaming licence, per state | $50k–500k+ each, plus bonds |
| Broker-dealer registration (VEX) — FINRA member firm | $150k–500k setup, then ongoing |
| Money transmitter licences (if VCoin cashes out) | $100k–1M+ across states |
| KYC/AML programme — vendor, officer, ongoing | $75k–250k/yr |
| Age/geo verification vendor | $15k–60k/yr |
| **Realistic floor for one state, one vertical** | **~$400k–1M in year one** |

**My recommendation [ESTIMATE]:** do not go to Scenario B to launch.
The play-money ecosystem is a complete, demonstrable product. Real
money is a second company you start once the first one has users.

### 2c. Content review is a human process **[MEASURED as a standing rule]**

This repo's standing rule is explicit and I have not tried to automate
around it. What that means in headcount **[ESTIMATE]**:

- CVNVO, YAP, VXLLAGE, CHOPZ and DREAMS all need a human queue.
- At demo scale: **0 FTE** — no real users.
- At first real users: **1 part-time reviewer**, ~$25–45k.
- At scale: **3–5 FTE plus a lead**, $180k–400k, and a vendor
  (Hive, Sift, or similar) for the first-pass filter at $2–10k/mo.

**YAP has no moderation queue today** — nothing reviews a report before
it counts against a subject. That is the single highest-liability gap
in the ecosystem and it is a build, not a hire.

---

## 3. Licences

### 3a. Software licences you already depend on **[MEASURED]**

Everything in the runtime is permissive (MIT/Apache/BSD): Node 22,
Express, `pg`, Vite. **No copyleft obligation anywhere in the
dependency tree that would force disclosure.**

Two that need a real decision:

- **LiveKit** (the SFU, in Compose, never started) — Apache 2.0
  self-hosted, or LiveKit Cloud at roughly $0.30–0.50/GB egress
  **[ESTIMATE]**.
- **PostgreSQL** — PostgreSQL Licence, permissive. Managed hosting is
  the cost, not the licence.

### 3b. Content and rights licences **[MEASURED as modelled, not held]**

Vvltvre Flix, Studios and Music model licence terms — `licenseFee`,
`licenseExpiresAt`, `licenseNonExclusiveTitle`. **No real rights to any
real content have been acquired.** Every catalogue is fixture data.
Acquiring even a small real catalogue is a negotiation per title and
the largest single unknown in the media group **[ESTIMATE]**.

### 3c. Business registrations **[ESTIMATE]**

Entity formation, registered agent, and annual filings across the
company tree: **$5k–25k/yr** depending on how many of the entities in
`dev-docs/CORPORATE_STRUCTURE.md` are actually incorporated rather than
being organisational fiction. **Decide which entities are real before
paying to register 20 of them.**

---

## 4. Development — what is left, and who should do it

### 4a. What is genuinely done **[MEASURED]**

| | |
|---|---|
| Apps | 36 (34 backends, 2 Vite frontends) |
| Automated tests | **1609**, green |
| Structural criteria met | **100%** of 260 |
| Backends on Postgres | 29 of 34 |
| Apps with a UI | 31 of 36, **all 31 on the shared design system** |
| Mutating routes accounted for | 520 (469 guarded, 51 declared open with a reason) |
| Full-stack memory | 0.82–0.86 GB across 38 processes |
| Backup → destroy → restore → restart | Drilled end to end, passed |

**100% of structural criteria means nothing structural is missing. It
does not mean the products are finished** — the report says so itself.

### 4b. What is actually left **[MEASURED gaps, ESTIMATE effort]**

| Work | Why it matters | Effort |
|---|---|---|
| **Media vendor decision + integration** | Six surfaces cannot do their core thing: Flix can't play, Pods can't stream, Vault can't show a feed, CHOPZ can't play video, VENVM can't generate, DREAMS has no display | 1 senior eng, 6–10 weeks after the decision |
| **14 untested money modules** | Today a risk-free money pump was found in one of them. Same condition holds in 14 more, incl. casino cash-out and the store purchase split | 1 eng, 3–5 weeks |
| **YAP moderation queue** | Highest-liability gap; reports count against people with no review | 1 eng, 2–3 weeks |
| **Off-host backups** | Database disk and backup disk are currently the same disk | 1 eng, 3–5 days |
| **Docker build test + TLS + domain** | 36 build contexts never build-tested; nginx terminates plain HTTP | 1 DevOps, 1–2 weeks |
| **126 untested routes in the VOID group** | cvnvo 59, hvntz 40, dreams 22, yap 5 | 1–2 eng, 6–8 weeks |

### 4c. Who should build it **[ESTIMATE]**

**Do not hire 10 people.** The codebase has unusually strong internal
conventions — shared modules synced across 203 copies, a house style
for comments that explain *why*, tests that must be watched failing
before they are trusted. A large team would dilute that faster than it
would add throughput.

| Role | Count | Why this one |
|---|---:|---|
| **Senior full-stack (Node/Express)** | 2 | The money modules and the untested routes. Must be someone who writes the failing test first. |
| **Media/streaming engineer** | 1 | HLS/CDN/LiveKit. The six blocked surfaces are one person's job, not a team's. |
| **DevOps/SRE** | 1 (or fractional) | Docker, TLS, backups, monitoring. Could be 0.5 FTE or a contractor. |
| **Trust & Safety lead** | 1 | Owns the moderation queues and the human process. Not an engineer. |
| **Product designer** | 0.5 | §5 below. The design system exists; this is applying it, not building it. |

**~5 people.** At US senior rates **[ESTIMATE]** that is roughly
$700k–1.1M/yr fully loaded; offshore or mixed, $250k–450k.

**Where [ESTIMATE]:** this codebase is documentation-heavy and
convention-heavy, which suits a **small co-located or heavily-overlapping
remote team** far better than a distributed contractor pool. My
recommendation is 2–3 in one timezone with real overlap, not 6 across
five timezones. The repo's conventions are learnable from the code
itself — the comments genuinely explain the reasoning — which lowers
onboarding cost more than most codebases.

**Who not to use:** an agency that bills by feature. Almost every
defect found in this repo lately was found by *driving the thing and
measuring*, not by building the next item on a list.

---

## 5. Making it feel like apps and games, not a monorepo

### 5a. What already helps **[MEASURED]**

- All 31 UIs share one design system.
- The App Store groups 26 products across 7 sections, with a second
  view by constellation (■ ✕ ○ ▲ ◇) so it never reads as a flat wall.
- Demo content seeds at boot, so nothing opens empty.
- VDP is a walkable world embedding 11+ other apps as districts.

### 5b. What would move it most **[ESTIMATE]**

1. **VDP is the answer to "make it feel like a game" and it is already
   built.** It is a world you walk around in that embeds VOID, HVNTZ,
   CVNVO, VACAY, Vvltvre, Vault, VOKEN, VADO, VEX, VENVM and Analytics
   as districts. Lead with VDP, not with the launcher. Biggest
   perceived change for the least work.
2. **One onboarding, once.** Right now a user meets 26 products. Give
   them three: a world (VDP), a feed (VXLLAGE or CHOPZ), and a wallet
   (V3). Everything else should be discovered from inside those.
3. **Make VCoin visible everywhere.** A shared wallet balance in the
   masthead of every app is the thing that makes 36 apps feel like one
   ecosystem rather than 36 tabs.
4. **Progression.** Games feel like games because state accumulates.
   VACON-C, VDP and VAGO all have progression; nothing surfaces it
   across apps. A single "what you've done across VACO" view would do
   more than any individual app feature.
5. **Native shells last.** Wrapping in React Native or Capacitor is
   real work and buys less than items 1–4. Do it when there are users.

---

## 6. Marketing **[ESTIMATE — this is the section I am least able to ground]**

I have no market data, no audience, and no budget from you, so this is
structural advice only.

- **Lead with one product, not 36.** "36 apps" reads as unfocused to
  everyone except an investor who already believes you. VDP or VAGO
  are the two that demo in 30 seconds.
- **The ledger is the actual story.** Real VCoin moving between 29 apps
  through one auditable ledger, with settlement atomicity and an
  append-only decision record, is genuinely unusual. Most "super-app"
  pitches cannot show that. It is a better story than any single app.
- **The prediction market is timely.** Polymarket and Kalshi have made
  the format legible to a mainstream audience this year.
- **Budget [ESTIMATE]:** a credible soft launch is $25k–75k (brand,
  landing, a short film of VDP, seeded community). Paid acquisition
  before retention is proven is money set on fire — and retention
  cannot be proven while six media surfaces cannot play anything.
- **Sequence:** fix media → prove retention on one app → then market.

---

## 7. The honest gaps, collected

**[MEASURED]** — every one of these is stated elsewhere in the repo and
none is hidden:

1. **Real-time media** blocks six surfaces. Vendor decision, not effort.
2. **Docker has never been build-tested** — 36 build contexts.
3. **Backups are same-host only.** The database disk and its backup
   disk are the same disk.
4. **No TLS, no domain.** nginx terminates plain HTTP on :80.
5. **The LiveKit SFU has never been started.** No audio has crossed it.
6. **`.replit` and `replit.nix` have never run on a real container.**
7. **14 money-moving modules have no test.** One of the tested-by-
   accident ones contained a risk-free money pump found on 12 Sep.
8. **YAP has no moderation queue.**
9. **VCoin has no stated value in any real currency.**
10. **A guard being present is not a guard being right** — the route
    audit says so in its own output.

---

## 8. If I had to pick the order

**[ESTIMATE]**

| # | Do this | Because |
|---|---|---|
| 1 | Test the 14 money modules | A live money bug was found in this class today |
| 2 | Decide the media vendor | Unblocks six products; nothing else unblocks six |
| 3 | Off-host backups | Cheapest real risk reduction in the list |
| 4 | YAP moderation queue | Highest liability, and it is a build |
| 5 | Docker build + TLS + domain | Required before anyone outside sees it |
| 6 | Price VCoin against something real | Every number in §1 is meaningless until this exists |
| 7 | VDP-first onboarding | Biggest perceived quality gain per hour |
| 8 | Compliance counsel, Scenario A only | Cheap, and it scopes everything else |

Real money (Scenario B) is deliberately absent from that list.
