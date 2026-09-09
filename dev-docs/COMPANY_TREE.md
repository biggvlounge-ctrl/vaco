# Company Tree — 18 Parents, Every Sub-App, Every System

The full hierarchy, read from `vaco-shell/lib/registry.js` (the
authoritative registry) and `start-ecosystem.sh` (the authoritative
service manifest).

**Structured as companies**, per the instruction: every parent, every
sub-app, and every system — including the ones I previously argued
should stay cost centers. That argument is revisited honestly at the
end, because the Google comparison defeats most of it.

---

## VVI — the grandparent company

**Real, and thinly documented.** VVI sits above VACO as the grandparent
entity. Everything customer-facing is branded VACO; VVI never appears
to a customer.

Enforced in code, not just asserted — `void/lib/taas.js` fixes every
TaaS subscription to `brandedAs: 'vaco'` as a constant rather than a
caller-settable field, specifically so a client cannot accidentally
mis-brand to VVI.

```
VVI                    grandparent — never customer-facing
 └── VACO              the customer-facing brand
      ├── 18 parent groups
      ├── 10 systems
      └── 11 owned brands
```

**The honest limitation:** VVI appears in exactly two places in this
repo — that one line in `taas.js` and a matching line in
`void/README.md`. Both cite `QUICK_INNOVATION_THREAD.md` §5 as the
source, and **that document is not in the repo**. So what VVI actually
is — what it holds, what it does, whether it is the intended holding
company for the structure below — is not recorded anywhere I can read.

That matters for structuring: if VVI is meant to be the top of the
entity tree, its definition is the one document a corporate attorney
would ask for first, and it does not exist here.

---

## The 18 parent groups

### 1. VOID — logistics & services
- **VOID** — 25 service verticals, drone/ground routing, stations
- **VOID MAGIC** — meet & greets, ticketing, media orders

### 2. VOKEN — the card engine
- **VOKEN** — minting, editions, provenance, value scores, packs,
  raffles, trades, fractional shares
- **VEX** — the brokerage, extracted out of VOKEN (tasks #92, #95)

Grouped with CVLTVRE and VADO as the **VOKEN square** — see
`dev-docs/VACO_CONSTELLATIONS.md`.

### 3. Vvltvre — media (the largest group)
- **Vvltvre Music / Distribution** — releases, royalties, label deals, beats
- **Vvltvre Flix** — subscription video
- **Vvltvre Pods** — podcasts
- **Vvltvre Studios** — fund-and-produce financing
- **VENVM** — AI production pipeline
- *Vvltvre Touring & Tix* — the commercial identity VOID MAGIC sits under

### 4. VACON-C — agents & safety
- **VACON** — the operating network, 14 agents
- **VSAFE** — shared safety layer, 6 consuming apps
- **VACON-C** — civ-sim engine *(paused)*

### 5. V4 — the Google-equivalent systems group
- **V4 Agent Proxy** — holds the Anthropic key, twin profiles, surfaces *(Gemini)*
- **V4 Search** — cross-app search *(Google Search)*
- **V4 Maps** — the shared map layer: places, nearby, bounds, crossings,
  foot traffic, routing *(Google Maps)*

**V4 is where the Google-equivalent characteristics belong.** Maps sits
here, not under VOID — VOID *consumes* the map layer for dispatch the
same way CVNVO consumes it for proximity and DREAMS for foot traffic.
Four VACON agent prompts already said so; the layer is now built.

### 6. V3 — money & identity
- **V3** — the VCoin/VASH ledger. 18 apps settle through it
- **VACA** — identity & authenticity attestation

### 7. CVNVO — dating
- **CVNVO** — matching, 11 dating formats
- **YAP** — green/red flag reviews *(highest liability item in the ecosystem)*

### 8. HVNTZ — local business network
- **HVNTZ** — 14 revenue streams from one location
- **DREAMS** — the ad/screen network

### 9. CHOPZ — short-form video & commerce
- **CHOPZ** — the feed
- **CHOPZ SHOP** — native checkout, category fees, affiliate splits

### 10. VACAY — travel
- **VACAY** — Stays, Experiences, Auto, Homes, Flights *(five businesses in one service)*

### 11. VAGO — gaming
- **VAGO** — prediction markets, sportsbook, esports, casino, fantasy, Gold Coin, AMOE

### 12. Vault — streaming
- **Vavlt Stvdios** — multi-channel live, 8-screen sessions, VOD

### 13. Vex — trading
- **Vex Trading** — the parent shell
- **VEX** — consumer brokerage *(gated pending broker-dealer registration)*
- **Vex Business** — internal futures research platform, own Python stack

### 14. VXLLAGE — social
- **VXLLAGE** — feed, threads, villages, avatar cosmetics

### 15. VENVS — marketplace
- **VENVS** — marketplace, shop, publishing

### 16. VDP — the walkable world
- **VDP** — 22 districts
- **The Food District** — 11 owned brands (see the revenue inventory)

### 17. CVLTVRE — the Cvltvre Card product
- **CVLTVRE** — the real, customer-facing brand. Packs, raffles,
  trades, applications, creator tiering, referrals
- Declared in code, not just here: `voken/lib/brand.js` exists
  specifically so the name cannot drift between files — the same
  relationship V3 already has to VCoin/VASH

### 18. VADO — The Art District
- **VADO** — four auction mechanics (instant, English, Dutch with a
  reserve floor, offer), art cards, gallery accounts, digital art
  frames, its own explore surface
- Has had a VDP district (`VadoView.jsx`) since before this promotion

**Neither #17 nor #18 is a new build.** Both were already shipped
inside `voken/` with live routes, dev-docs and a VDP district; the
promotion records what a customer sees. **All three of VOKEN, CVLTVRE
and VADO run in one process on 8794**, and that is deliberate: VADO's
auction settle path moves VCoin and edition ownership back to back
against the same in-process store, so a service split would put a
network hop between a payment and the thing it paid for — and V3 has no
reversal endpoint by design. Full reasoning:
`dev-docs/CVLTVRE_AND_VADO_EXTRACTION_AUDIT.md`.

---

## The systems — and why I was wrong to call them cost centers

The registry's own comment says `vaco-analytics`, `shield`, and
`v3-shield` "aren't products of their own — no parent/bundle." My
earlier revenue inventory took the same line and put them in a
no-revenue tier.

**The Google comparison defeats that argument**, and it is worth
stating plainly rather than defending the earlier position. Alphabet's
"infrastructure" is not infrastructure — Maps, Analytics, Pay, and
Cloud Identity are products with customers, pricing, and in several
cases businesses larger than the thing they were built to support.

Every system below has a direct equivalent that is a real business at
Google:

| System | Google equivalent | What makes it a business |
|---|---|---|
| **VACO Shell** | Google Play | App store: listing fees, revenue share, subscriptions |
| **V4 Search Layer** | Google Search | Search across apps; the ad surface sits here |
| **VACO Analytics** | Google Analytics | Metrics as a licensed product, not just internal telemetry |
| **Shield** | Google Sign-In / Cloud Identity | SSO and auth licensed to third parties |
| **V3** | Google Pay / Wallet | Payment rails. **Already earns** on the VCoin→VASH spread |
| **VACA** | — (identity attestation) | Per-verification pricing is the standard model |
| **VSAFE** | — (no direct equivalent) | Safety-as-a-service, licensable B2B on its own |
| **VACON + V4 Proxy** | Google AI / Gemini | The agent layer, metered per invocation |
| **V4 Maps** | Google Maps | The shared map layer — places, nearby, crossings, foot traffic, routing |
| **VOID** | Google Maps *logistics half* | Consumes V4 Maps; owns dispatch, drones, stations |
| **VDP** | Google Earth / Street View | The walkable world; districts and storefronts are inventory |

**The honest correction:** I called these "cost centers by design." The
accurate statement is that they are cost centers **by current
configuration** — none has a price attached yet. That is a decision,
not a property. Alphabet's history is the counter-example, and it is
the right one to reason from.

Where the earlier caution still holds is narrower and worth keeping:
a system with **no external customers** and **no price** generates
filing and tax overhead with nothing to offset it. The trigger for
forming its entity is *the first external customer*, not the
architecture diagram.

---

## The count

| | |
|---|---|
| Parent groups | **16** |
| Named businesses across those groups | **~30** |
| Systems with a Google-scale equivalent | **10** |
| Owned food & wellness brands | **11** |
| Merch / apparel lines | 2 real, 1 documented-not-built |

**Roughly 50 nameable businesses.** That is the real number, and it is
why the structure question matters more than it first appeared.

---

## Two gaps found while building this

Both are real and neither was on any list:

1. **`vaco-shell` is absent from its own registry.** The launcher lists
   31 apps and does not list itself. Harmless while it is only a
   launcher — but the moment it becomes the App Store, it is a business
   that does not appear in its own catalogue.

2. **`vex` is absent from the registry.** Only `vex-trading` (the
   parent shell) is listed. The consumer brokerage — the entity that
   would actually hold the broker-dealer registration — is not in the
   catalogue at all.

Neither breaks anything today. Both would be confusing to a lawyer
working from the registry as a source of truth, which is exactly what
is about to happen.

---

## What this means for structuring

Three arms, as the revenue inventory argued, but the systems arm is
larger than I first credited:

1. **Technology / platform** — the 18 parent groups' software
   businesses, sharing V3, Shield, VACON.
2. **Systems / infrastructure** — the ten above. Cost centers today,
   licensable products the moment any of them takes an external
   customer. **This is the arm most likely to be undervalued in an
   early structuring conversation**, because it looks like plumbing
   until it has a price list.
3. **Brands / operating** — the 11 food and wellness brands plus
   apparel. Physical, insurable, employee-bearing, and the strongest
   case for genuine separation.
4. **Regulated** — VEX, VAGO, V3's money-transmission question, YAP,
   and VOID's licensing-gated verticals.

**Still not legal or tax advice.** The S-Corp constraint in the revenue
inventory applies to all of this, and it applies harder the more
entities are involved: an S-Corp cannot have a corporate shareholder,
so no holding company can own one.
