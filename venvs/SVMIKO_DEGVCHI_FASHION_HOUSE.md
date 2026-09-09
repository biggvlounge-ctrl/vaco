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

The 13 brands: DEGVCHI (flagship namesake luxury), LVCII (classic
European luxury), Devil in Details/DND (Chrome Hearts-inspired heavy
accessory/hardware/leather luxury), BOOBI/BOOBI Couture (women's sexy
luxury), Boulevard/BLVD (gallery-inspired streetwear), JACQVÉ (women's
refined European luxury), ZV (minimalist streetwear/basics), RED VEIL
(Prada-inspired luxury, signature number 33), VEDELLÍN (European/
global luxury, geographic-name identity), VvLGAR (raw bold rebellious
streetwear), VAISON/△AISON (Margiela-inspired avant-garde, two
triangle logo forming an hourglass V/A), ANCÓR (ALO-meets-Polo boating/
lifestyle, custom anchor symbol instead of a polo player), DVMB
(simple contemporary streetwear — basic tees, hoodies, minimal
graphics).

Direct integration: each of the 13 brands becomes a real, distinct
seller/storefront within VENVS's Shopify-style branded storefront
system already built — each brand gets its own customized storefront,
consistent with the "branded-per-seller-within-unified-marketplace"
model already established for VENVS.

Status: ready to populate VENVS's branded storefront system at launch.

---

## Implementation status (added when this file was placed into the repo)

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
