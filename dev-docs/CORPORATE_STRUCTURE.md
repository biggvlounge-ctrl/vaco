# Corporate Structure — VVI, VEGA, VEDA

The holding structure as stated by the founder, mapped against what is
actually built in this repo.

**Source:** founder handoff, this session. Recorded here because the
document VVI comes from (`QUICK_INNOVATION_THREAD.md`) is not in
the repo, so this file is currently the only written record of the
structure.

---

## The shape

```
                        VVI — Vertical Vision, Inc.
                              (grandparent)
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
               VEGA                                  VEDA
        the vehicle system              real estate · investment · stock
                 │                                     │
        ┌────────┴────────┐                            │
        │                 │                            │
  Vehicle Shell     all the apps                       │
   (app store)        inside it                        │
                                                       │
        ┌───────────────┬──────────────┬───────────────┴──┬──────────────┐
        │               │              │                  │              │
      VEDA            VEDA           VEDA              SVMIKO          VAZAN
  REAL ESTATE         FOOD        INVESTMENT           DEGVCHI     (supplements
     GROUP            GROUP          GROUP            (clothing)    & skincare)
     (VRG)              │              │              13 houses          │
        │               │              │                                 │
    property ·      10 food       investment ·                    supplement &
  physical assets    brands     stock · capital                  skincare co's
        │
     DREAMS
   revenue only —
  operates in VEGA
```

---

## VVI — Vertical Vision, Inc.

The grandparent. Never customer-facing — every product ships branded
**VACO**.

That rule is already enforced in code rather than merely stated:
`void/lib/taas.js` fixes every TaaS subscription to
`brandedAs: 'vaco'` as a constant, not a caller-settable field,
specifically so a client cannot accidentally mis-brand upward.

**The name is settled: VVI.** It stands for *Vertical Vision, Inc.*

A transcription of "VVX" appeared briefly in an earlier draft of this
document and was wrong. **VVI** is canonical, and it is what the code
has always said — `void/lib/taas.js` and `void/README.md`, both citing
`QUICK_INNOVATION_THREAD.md` §5. Code and structure agree; nothing
needs renaming.

---

## VEGA — the vehicle system

The technology side. Holds the **Vehicle Shell** — the app store — and
every app inside it.

**What "vehicle" means here:** the shell is the vehicle that carries
the apps. `vaco-shell` is that shell today: a launcher with a 31-app
registry, bundles, session auth, and SSO across the ecosystem. Turning
it into a real app store is the open build (listing, entitlements,
pricing, revenue share back through V3).

Everything in the company tree's **16 parent groups** and the
**10 systems** sits under VEGA:

- The 16 parent groups — VOID, VOKEN, Vvltvre, VACON-C, V4, V3, CVNVO,
  HVNTZ, CHOPZ, VACAY, VAGO, Vault, Vex, VXLLAGE, VENVS, VDP
- The systems — VACO Shell, V4 Search, VACO Analytics, Shield, V3,
  VACA, VSAFE, VACON, VOID, VDP

**Note the one crossing:** DREAMS **operates** here — an HVNTZ sub-app
inside VEGA, sharing the ecosystem's infrastructure — while its
**revenue is attributed to VRG** under VEDA. Operations on one side,
economics on the other, by design.

That is exactly the kind of arrangement an attorney needs stated
explicitly rather than inferred from a registry, and it needs a written
intercompany agreement behind it. See the DREAMS section under VEDA.

---

## VEDA — real estate, investment, and the physical businesses

The other side of the grandparent. The three functions the founder
named — real estate, investment, stock — are now **three named
operating groups**, plus the two brand houses.

| Group | Holds |
|---|---|
| **VEDA Real Estate Group (VRG)** | Property, physical assets |
| **VEDA Food Group** | The ten food brands |
| **VEDA Investment Group** | Investment, stock, capital deployment |
| **SVMIKO DEGVCHI** | 13 fashion houses |
| **VAZAN** | Supplements & skincare |

*Following VRG's pattern, the other two would abbreviate to VFG and
VIG. Not asserted — the founder gave VRG explicitly and the other two
by name only.*

**Why the split into three rather than one VEDA operating company:**
real estate, food service, and investment want different capital
structures, different insurance, and different regulators. An
investment arm holding securities has SEC-adjacent obligations a
restaurant group does not. Separating them at the group level means
none of the three inherits the others' compliance surface.

### DREAMS — the screen network

Lives under VEDA rather than VEGA, and the logic holds: DREAMS is a
**physical asset business**. Screens are installed real property in
real locations, and the financing behaves like real estate — capital
deployed into physical placements that generate recurring revenue.
That is a VEDA-shaped business, not a software-shaped one.

**The comparables are already researched** in
`dreams/DREAMS_DOOH_COMPARABLES.md`, and they split exactly along this
line:

| Layer | Companies |
|---|---|
| **Media owners** — own the physical screens | **Lamar**, **Clear Channel Outdoor**, **OUTFRONT Media**, **JCDecaux** |
| **Technology** — sell software into other people's networks | Vistar Media, Broadsign, Place Exchange, Hivestack |

**The media-owner side is the VEDA comparable set.** Lamar and OUTFRONT
are structured as **REITs** — real estate investment trusts — because
outdoor advertising *is* a real estate business. That is a genuinely
strong signal that putting DREAMS under a real estate holding company
is the right instinct, and it is worth raising with counsel
specifically: the REIT structure exists for exactly this asset class.

The gap that document names still stands: DREAMS is currently the
technology layer without the media layer — it models screens but owns
none. HVNTZ businesses and VOID stations are the ecosystem's real
physical footprint, and they are the path to the media-owner position.

### VEDA Real Estate Group (VRG)

Property and physical assets. The real estate holding function.

### DREAMS — operates in VEGA, revenue to VRG

**Founder decision, and it resolves the earlier open question cleanly:**

> DREAMS **functions with the apps**. Its **revenue goes to VRG**.

Operationally DREAMS stays where it already is — an HVNTZ sub-app
inside the VEGA ecosystem, sharing dispatch, analytics, and V3
settlement like every other app. Economically the screens are real
property, and what they earn belongs to the real estate group that
owns them.

**This is how the comparables are actually structured.** Lamar and
OUTFRONT are **REITs**, and REIT rules do not merely permit this split
— they largely require it:

- A REIT must derive most of its income from **passive real-estate
  sources** — rents and similar — not from actively operating a
  business.
- Active operations are conducted through a **taxable REIT subsidiary
  (TRS)** or an external manager, which operates the business while
  the REIT holds the asset and receives the rent.

So "the asset earns for the owner, someone else operates it" is not a
workaround. It is the standard shape of the industry VRG would be
entering, and adopting it now means the structure is already REIT-ready
if that route is taken later.

**What this requires in practice:**

1. **An intercompany agreement** between the operating entity (DREAMS,
   under VEGA) and the asset owner (VRG). Written, with real terms —
   who owns the screens, who maintains them, what the operator is paid.
2. **Transfer pricing** that would survive scrutiny. An operator
   working for nothing, or an asset owner taking 100% while another
   entity bears the costs, is the kind of arrangement that gets
   recharacterised.
3. **Clarity on who owns the hardware.** VRG holding title to the
   screens is what makes the revenue attribution follow naturally. If
   HVNTZ businesses or VOID stations own the physical screens instead,
   the arrangement needs restating.

**The gap that still stands:** DREAMS today models screens but owns
none — it is the technology layer without the media layer. The
revenue-to-VRG arrangement describes where money goes once screens
exist. HVNTZ businesses and VOID stations are the ecosystem's real
physical footprint and the path to actually holding that estate.

### VEDA Investment Group

The investment and stock function. Capital deployment across the
group, and the natural home for anything holding securities.

**Note the boundary with VEX.** VEX is consumer brokerage under VEGA
and gated pending broker-dealer registration. VEDA Investment Group is
the house investing its own capital. Those are genuinely different
regulated activities — one is a broker-dealer serving customers, the
other is principal investment — and conflating them in one entity
would be a mistake worth avoiding early.

Nothing in code corresponds to this group yet. It is a corporate
function rather than an app.

### SVMIKO DEGVCHI — the fashion house

The parent house for clothing. **Real and already built**:
`venvs/src/lib/svmikoDegvchi.js`, with **13 sub-brands**, each a
distinct storefront in VENVS's branded-seller system, plus virtual
wearables in VDP.

| | | |
|---|---|---|
| **DEGVCHI** | **LVCII** | **Devil in Details (DND)** |
| **BOOBI / BOOBI Couture** | **Boulevard (BLVD)** | **JACQVÉ** |
| **ZV** | **RED VEIL** | **VEDELLÍN** |
| **VvLGAR** | **VAISON / △AISON** | **ANCÓR** |
| **DVMB** | | |

House identity: European simplicity meeting Japanese craftsmanship.
Luxury and accessory houses are priced deliberately above the
streetwear houses — not uniform placeholder pricing.

*This corrects an earlier note of mine.* I recorded that "an owned
clothing label does not exist anywhere in code." That was wrong —
SVMIKO DEGVCHI and its thirteen houses are real and have been for
several build phases. What is genuinely not built is the **VACO Merch
Store** (`vaco-shell/VACO_MERCH_STORE.md`), which is a different thing
and says so in its own status section.

**Still not built:** the SD monogram and the DEGVCHI Gateway Symbol
(出口 / *deguchi*) are real visual design work with no assets in the
repo.

### VEDA Food Group — the food companies

Holds the **ten food brands**, real in `vdp/src/lib/foodDistrict.js`:

**VIVE** (coffee) · **VIXENS** (vegan) · **VORDABELLO'S** (Italian) ·
**VODEGA** (sandwiches) · **VFRESH** (grocery) · **TACO TOWN** ·
**BIG JACK'S** · **NETTY'S** · **WEDGE** · **Chicken Spot** (name TBD)

All ten are food service or grocery. One regulatory regime, one
insurance profile, one operating playbook.

### VAZAN — supplements & skincare, its own parent company

**Founder decision: VAZAN is pulled out of the food group and becomes a
parent company in its own right under VEDA, with supplement and
skincare companies built beneath it.**

The reason it does not belong in a food subsidiary is regulatory, and
the separation is clean:

| | VEDA Food Group | VAZAN |
|---|---|---|
| **Regulator** | Local health departments, FDA food safety | **FDA** (dietary supplements), **FTC** (advertising claims) |
| **The rule that governs** | Food safety, handling, permits | **Structure-function claims** and labeling — what a product may say it does |
| **Cosmetics** | n/a | Separate regime again; skincare is not regulated as a supplement |
| **Manufacturing** | Kitchens, health inspection | **cGMP** for dietary supplements — a different compliance regime entirely |
| **Liability** | Foodborne illness, premises | **Product liability**, adverse-event reporting |
| **Insurance** | General liability, premises | Product liability, and materially more expensive |

Supplements and cosmetics are also the categories where **marketing
claims are the legal exposure**. "Supports immune health" is a
structure-function claim with rules attached; "cures" or "treats" turns
a supplement into an unapproved drug. That risk lives in copy, not in
the kitchen, and it is not a risk the food brands carry at all.

Keeping VAZAN inside the food group would have meant one entity carrying
two unrelated regulatory regimes, and an FDA action against a
supplement reaching ten restaurants that had nothing to do with it.

**In code today**, VAZAN is one of eleven entries in
`vdp/src/lib/foodDistrict.js`, categorised `wellness` — the only
non-food category among the eleven. The code already knew it was
different; the structure now matches.

*Note: the food district in VDP can keep rendering all eleven
storefronts. Corporate ownership and district geography are different
questions, the same way DREAMS is an HVNTZ sub-app but a VEDA
business.*

---

## Why this structure is sound

The split is not arbitrary — it separates two genuinely different
businesses:

| | VEGA | VEDA |
|---|---|---|
| **Assets** | Software, IP | Real property, inventory, screens |
| **Costs** | Engineering | Capital deployment, COGS, leases |
| **Workers** | Employees + contractors | W-2 employees, physical premises |
| **Liability** | Data, platform, classification | Premises, food safety, product |
| **Comparables** | Alphabet | Lamar / OUTFRONT (REITs), LVMH |
| **Financing** | Venture equity | Asset-backed, REIT structures |

Those two profiles want different capital, different insurance, and
different entity forms. Putting them under one roof is what forces a
compromise on both.

---

## Open items for counsel

1. ~~VVI or VVX~~ — **settled: VVI**, *Vertical Vision, Inc.* Matches
   the code. No action.
2. **REIT structure for VRG.** Lamar and OUTFRONT are the precedent,
   the asset class matches, and the operate-here / earn-there split
   just adopted is already the shape REIT rules require (passive
   income to the REIT, active operations through a TRS or manager).
3. **The DREAMS intercompany agreement** — operating entity under
   VEGA, asset owner VRG. Needs real terms and defensible transfer
   pricing, plus a decision on who holds title to the screens.
4. ~~VAZAN's placement~~ — **settled: its own parent company under
   VEDA**, separate from VEDA FOODS. Supplement and skincare companies
   build beneath it. Needs its own FDA/FTC counsel, not the food
   brands'.
5. ~~DREAMS' placement~~ — **settled: operates in VEGA, revenue to
   VRG.** See item 3 for what it requires.
6. **The S-Corp constraint still governs everything here.** An S-Corp
   cannot have a corporate shareholder. VVI owning VEGA and VEDA means
   **none of the three can be an S-Corp.** This structure requires
   C-Corps (or LLCs) throughout, and that is not a preference — it is
   the eligibility rule.

**Not legal or tax advice.** This is the structure as stated, mapped to
what exists in code, so the conversation with counsel starts from
facts.
