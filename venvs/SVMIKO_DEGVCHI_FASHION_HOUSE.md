# SVMIKO DEGVCHI — Fashion House

SVMIKO DEGVCHI is the fashion house — European simplicity and luxury
combined with Japanese-inspired craftsmanship and heritage. Japanese
influence is especially strong in kimono-inspired textiles, Japanese
silk, rich textile textures, traditional patterns, specialized trims,
embroidery, and accessories. Clothing remains primarily clean and
European in silhouette, while Japanese influence becomes more
pronounced in trims, materials, and accessories.

VENVS is the fashion district/commerce platform where all SVMIKO
DEGVCHI brands are presented, marketed, and sold — the first real
clothing lines for VENVS and VDP.

Signature symbols: SD (primary two-letter monogram). DEGVCHI Gateway
Symbol (inspired by 出口/deguchi, "exit/gateway" — passage, transition,
movement, entering a new world; applications: belt chains, buckles,
bag hardware, clasps, wallets, jewelry, charms, zippers, buttons,
embroidery, limited-edition pieces).

**Updated 22 Oct 2026 — the upgraded 12-brand roster, replacing the
original 13.** The 12 brands: DEGVCHI (Japanese luxury streetwear,
Japanese heritage materials), LVCII (modern everyday luxury, designer
handkerchief collections), STONE BONES (dark/sculptural luxury, heavy
details + precious hardware), BOULÉVARD XCHANGE (luxury streetwear,
cultural exchange), JACQVÉ (women's handbags & footwear, detachable
jewelry), ZV (minimalist streetwear, silhouette), ROJO VELO (modern
European luxury, signature accent/fashion-forward construction),
VEDELLÍN (global exotic luxury, extraordinary materials), VAISON
(avant-garde luxury, transformation), ANCÓR (luxury leisure/yachting,
material blending), 7EVEN (luxury athletic/everyday, perfecting
everyday clothing), VvLGARI (restored — positioning to define,
signature to be established).

Several brands kept their name but changed positioning/signature
(DEGVCHI, LVCII, JACQVÉ, ZV, VEDELLÍN, VAISON, ANCÓR); some were
renamed (Devil in Details/DND → STONE BONES, Boulevard/BLVD →
BOULÉVARD XCHANGE, RED VEIL → ROJO VELO, VvLGAR → VvLGARI); one is
genuinely new (7EVEN); two from the original roster (BOOBI/BOOBI
Couture, DVMB) are retired. VvLGARI is real identity with no real
product yet — its positioning is explicitly "to be established" in
this handoff, not something this codebase invents on its own.

Direct integration: each of the 11 brands with a defined product
becomes a real, distinct seller/storefront within VENVS's Shopify-
style branded storefront system already built — each brand gets its
own customized storefront, consistent with the "branded-per-seller-
within-unified-marketplace" model already established for VENVS.
VvLGARI's storefront opens once its own real product is defined.

Status: populating VENVS's branded storefront system now.

---

## Implementation status (added when this file was placed into the repo)

**Superseded 22 Oct 2026 — read the section above first.** Everything
below this point describes the ORIGINAL 13-brand roster and is kept
as a real historical record, not rewritten to pretend it always said
12. The current, real code (`venvs/src/lib/svmikoDegvchi.js`,
`vdp/src/lib/svmikoDegvchiWearables.js`) now implements the upgraded
roster. The current real wearable table:

| Brand | Product | Price |
|---|---|---|
| DEGVCHI | Virtual Heritage-Weave Bomber | 30 |
| LVCII | Virtual Handkerchief Set | 14 |
| STONE BONES | Virtual Hardware Jacket | 34 |
| BOULÉVARD XCHANGE | Virtual Capsule Hoodie | 16 |
| JACQVÉ | Virtual Detachable-Jewelry Tote | 28 |
| ZV | Virtual Signature-Silhouette Tee | 9 |
| ROJO VELO | Virtual Accent Trench Coat | 36 |
| VEDELLÍN | Virtual Rare-Material Jacket | 40 |
| △AISON (VAISON) | Virtual Transformation Pendant | 28 |
| ANCÓR | Virtual Blended-Material Jacket | 20 |
| 7EVEN | Virtual Everyday Track Jacket | 18 |
| VvLGARI | *(none yet — positioning to be established)* | — |

Eleven real entries plus one real brand identity with no product yet.
Flagship-product titles/prices for the ten renamed-or-repositioned
brands are this codebase's own reasonable derivation from the new
positioning/signature table above, not separately specified in the
handoff — the same "flagged, interpretive" posture the original
build already held for payout-account ids.

### Original build record (13-brand roster, through 21 Oct 2026)

**Built, and all thirteen brands are real in code** — which makes this
one of the few documents in the corpus that shipped complete rather
than partially.

`vdp/src/lib/svmikoDegvchiWearables.js` holds `SUB_BRAND_WEARABLES`
with a real entry per brand, each carrying a slug, a product name, a
category, and a real price:

| Brand | Product | Price |
|---|---|---|
| DEGVCHI | Virtual Kimono-Sleeve Coat | 42 |
| LVCII | Virtual Structured Blazer | 32 |
| Devil in Details (DND) | Virtual Chain Wallet | 26 |
| BOOBI Couture | Virtual Corset Gown | 35 |
| Boulevard (BLVD) | Virtual Gallery Hoodie | 14 |
| JACQVÉ | Virtual Silk Wrap Blouse | 24 |
| ZV | Virtual Essential Crewneck | 9 |
| RED VEIL | Virtual No. 33 Trench Coat | 38 |
| VEDELLÍN | Virtual Leather Field Jacket | 36 |
| VvLGAR | Virtual Distressed Denim Jacket | 16 |
| △AISON | Virtual Hourglass Pendant | 28 |
| ANCÓR | Virtual Anchor Pin | 22 |
| DVMB | Virtual Basic Tee | 6 |

Thirteen brands, thirteen entries. `SVMIKO_DEGVCHI_HOUSE` is a real
constant, and `venvs/src/lib/svmikoDegvchi.js` exists on the VENVS
side.

**The design intent survived into the product names**, which is
unusual and worth noting: DEGVCHI's flagship piece is a *kimono-sleeve*
coat (the Japanese-influence-in-silhouette-and-trim principle),
△AISON's is an *hourglass* pendant (the two-triangle logo rendered as
an object), RED VEIL's carries *No. 33*, and ANCÓR's is an *anchor*
pin. Someone implementing this read the brand identities rather than
generating thirteen generic garments.

**Pricing encodes the brand hierarchy correctly.** DEGVCHI at 42 and
RED VEIL at 38 sit at the top; DVMB at 6 and ZV at 9 at the bottom.
That matches the document's own positioning — flagship luxury versus
"simple contemporary streetwear." The ladder is real, not arbitrary.

**One divergence from the document, and it is a reasonable one.**
This document places the brands in **VENVS** as commerce storefronts.
The code implements them primarily in **VDP** as *virtual wearables* —
items an avatar wears in the walkable world — with a VENVS-side module
alongside. Those are different products from the same brand identities:
one is a shop, the other is what you put on your character.

Both are legitimate readings of "the first real clothing lines for
VENVS and VDP," which the document says explicitly. What is worth
being precise about is that the **avatar layer** is the one that got
built out to thirteen SKUs; the **thirteen branded storefronts** this
document's integration section describes are not thirteen separate
VENVS sellers today.

**Genuinely unbuilt**: physical goods. Every price above buys a virtual
item. Real apparel manufacturing is a separate concern and, per
`vaco-shell/VACO_MERCH_STORE.md`, would run through a print-on-demand
provider rather than anything in this repo.
