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
everyday clothing), VvLGARI (luxury accessories — cologne, perfume,
sunglasses, and handbags for men and women).

Several brands kept their name but changed positioning/signature
(DEGVCHI, LVCII, JACQVÉ, ZV, VEDELLÍN, VAISON, ANCÓR); some were
renamed (Devil in Details/DND → STONE BONES, Boulevard/BLVD →
BOULÉVARD XCHANGE, RED VEIL → ROJO VELO, VvLGAR → VvLGARI); one is
genuinely new (7EVEN); two from the original roster (BOOBI/BOOBI
Couture, DVMB) are retired.

**Updated again, same day (22 Oct 2026) — VvLGARI is defined.** Its
positioning was given directly: a luxury accessories house focused on
cologne, perfume, sunglasses, and handbags for both men and women. It
is no longer "to be established," and it is the one sub-brand with
more than one real flagship product (five, not one) under its single
storefront. Exact product names/prices are this codebase's own
reasonable derivation from that stated focus, same "flagged,
interpretive" posture already held for the other eleven brands.

**The two name/identity notes behind this update, given directly and
kept here as the real record rather than just in code comments:**

- **VvLGARI is a deliberate play on "vulgar"** — not the profanity
  sense, but the real, older meaning: bold, out-of-the-box, unlike
  anything else. That's the brand's design ethos as much as its name's
  etymology, and it now shapes `positioning` in
  `venvs/src/lib/svmikoDegvchi.js`, not just a comment.
- **STONE BONES is this house's own Chrome Hearts** — gothic/
  sculptural hardware worn as jewelry-grade accessory. A run of
  follow-up corrections gave the brand's own two-word name all of its
  real points of difference: STONE is the material — both a cast
  concrete/stone-look finish AND genuine natural stone and colored-
  gemstone accents (emerald and assorted colored rock among them, not
  one fixed stone or color), rather than Chrome Hearts' chrome/
  sterling silver — and BONES is the shape (the hardware itself —
  buckles, charms, chain links — is cast in bone silhouettes, not
  Chrome Hearts' own crosses and daggers). It is the brand that
  replaced Devil in Details (DND) in the 12-brand upgrade above. The
  natural-stone correction is also why STONE BONES is now the second
  sub-brand (after VvLGARI) with more than one real flagship product:
  its own emerald-inlay bone chain, a standalone jewelry-grade piece
  distinct from its flagship jacket. The comparable, the material, and
  the shape are all a real anchor for any future STONE BONES product,
  not an invented flourish.
- **Every STONE BONES piece is an original design, made in a real
  limited run — given directly as the reason buyers can also trade
  them.** This is now a real mechanic, not just brand copy:
  `listProduct` in `venvs/src/lib/marketplace.js` takes an optional
  `editionSize`, and `checkout` refuses to sell past it, before the
  buyer is ever charged (same posture as the Food District's own
  inventory refusal) — claimed and rolled back with the same
  claim-before-settle discipline the cart-status race fix already
  established, so two concurrent checkouts of the last piece cannot
  both succeed. STONE BONES' own jacket (150 pieces) and chain (75
  pieces) are the first real use of it; the edition sizes themselves
  are this codebase's own flagged, interpretive numbers, not given
  verbatim. Once a piece sells out, "traded" needs no separate
  system: a prior buyer resells it exactly the way any peer reseller
  already can here, through the same `registerSeller`/`listProduct`
  Marketplace mechanism.

Direct integration: all 12 brands are now real, distinct sellers/
storefronts within VENVS's Shopify-style branded storefront system
already built — each brand gets its own customized storefront,
consistent with the "branded-per-seller-within-unified-marketplace"
model already established for VENVS. VvLGARI's storefront lists all
five of its real products under that one seller.

Status: all 12 branded storefronts are open in VENVS's system.

---

**Updated 1 Nov 2026 — the real 16-brand roster, superseding the
12-brand roster above.** Given directly as "the current 16-line
fashion portfolio, with the latest spelling changes included":

1. DEGVCHI
2. LVCII
3. SVRPENTS Stone (renamed from STONE BONES — confirmed directly as a
   rename of the same brand: same storefront, same two real products,
   same positioning, just the new name)
4. BOVLEVARD Xchange (BX) (respelled from BOULÉVARD XCHANGE)
5. JACQVÉ
6. ZV
7. ROJO VELO
8. VEDELLÍN
9. VAISON
10. ANCÓR
11. 7EVEN
12. VvLGARI
13. THRONES AND BONES (genuinely new)
14. MYSTERY AND MASTERY (genuinely new)
15. SA VIOR (genuinely new)
16. VIC VALENCIAGO (genuinely new — the two A's in VALENCIAGO use a
    custom crossbar-free ∧, given directly)

Parent fashion house: SUMIKO DEGVCHI (also respelled from SVMIKO in
the same handoff; kept as SVMIKO in this codebase's own module/file
names and most prose, since nothing has yet renamed the house itself
at the code level — flagged here rather than silently renamed).

**The 4 new brands' real positioning was never sent.** Asked directly
whether real positioning/signature details existed for THRONES AND
BONES, MYSTERY AND MASTERY, SA VIOR, and VIC VALENCIAGO, the answer
was "I'll give you the details" — what arrived next was this exact
name/spelling list, not positioning. `venvs/src/lib/svmikoDegvchi.js`
and `vdp/src/lib/svmikoDegvchiWearables.js` therefore derive each new
brand's positioning/signature product directly from its own name,
flagged as this codebase's own interpretive read (same posture held
for every other invented price/signature detail in this file), open
to a real correction the moment actual positioning is given.

Status: all 16 branded storefronts are open in VENVS's system; the
same 16 brands also have one real virtual wearable each (21 total
real pieces, since SVRPENTS Stone carries 2 and VvLGARI carries 5) in
VDP's own avatar-wearable economy.

---

**Corrected, same session (1 Nov 2026) — the real 17-brand roster.**
Given directly, the same day as the 16-brand list above:

- **VIC VALENCIAGO**: "similar to the Balenciaga brand, luxury,
  simple." The 16-brand update's own name-only guess (avant-garde/
  deconstructed/oversized) is **withdrawn**, replaced with a real,
  restrained minimalist positioning. The custom crossbar-free ∧ in its
  two A's stays — that detail was separately confirmed, not part of
  the withdrawn guess — now used sparingly as one real signature mark
  rather than a loud sculptural motif.
- **SA VIOR**: "like our Christian Dior." The 16-brand update's own
  name-only guess (ecclesiastical/"savior"/halo-ring) is
  **withdrawn**, replaced with a French-couture-inspired positioning
  built from Dior's own real defining signature, the 1947 Bar Suit
  (structured, cinched waist over a sculpted hip).
- **THRONES AND BONES** and **MYSTERY AND MASTERY**: "I have not
  figured out yet." Both real, confirmed brand names, genuinely
  undecided rather than merely unsent — reverted to the same real "to
  be established" placeholder (no flagship product, real-skipped at
  seeding) VvLGARI itself once carried before its own positioning
  existed. The 16-brand update's own name-only guesses for both are
  withdrawn, not kept as an unused fallback.
- **CVLT**: a genuinely new, 17th brand — "we also will add one
  called Cult, C-V-L-T," its own real, confirmed vowel-dropped
  spelling. No positioning given yet either, so it joins THRONES AND
  BONES and MYSTERY AND MASTERY on the same placeholder.

The real roster is now 17 brands. 14 have a real, open storefront in
VENVS (3 real-skipped: THRONES AND BONES, MYSTERY AND MASTERY, CVLT)
and a matching real virtual wearable in VDP's own avatar-wearable
economy (19 real pieces across those same 14 brands, since SVRPENTS
Stone carries 2 and VvLGARI carries 5).

---

**Updated 12 Nov 2026 — the real 20-brand roster.** Given directly as
an updated copy of the clothing lines, with two renames called out
explicitly and one further name change included in the same list:

- **SVRPENTS & STONES** (renamed from SVRPENTS Stone — "using the
  ampersand, with SVRPENTS spelled as established"). Same brand, same
  two real products (the concrete bone-buckle jacket and the
  emerald-inlay bone chain), same positioning — rename only.
- **VITO VAISON** (renamed from VAISON / △AISON — spelled
  letter-by-letter, "V-I-T-O VAISON"). Same brand, same product
  (the Transformable Deconstructed Coat / Transformation Pendant),
  same positioning — rename only.
- **VIC VALENCI** (the updated list's spelling for VIC VALENCIAGO —
  not individually flagged as a rename the way the other two were,
  so a future correction to this one specifically wouldn't be
  surprising). Same real confirmed positioning ("similar to the
  Balenciaga brand, luxury, simple") and product carry over unchanged.
- **VEDELLÍN** was absent from the founder's own typed list this
  round — confirmed directly as an omission, not a retirement, and
  kept unchanged in the real code.
- **BARRAGE**, **ARROGANT ANGEL**, **SANTOS VENDETTA** — three
  genuinely new brands (the 18th-20th), no positioning given yet for
  any of them, joining THRONES AND BONES/MYSTERY AND MASTERY/CVLT on
  the same real "to be established" placeholder.

The real roster is now 20 brands. 14 have a real, open storefront in
VENVS (6 real-skipped: THRONES AND BONES, MYSTERY AND MASTERY, CVLT,
BARRAGE, ARROGANT ANGEL, SANTOS VENDETTA) and a matching real virtual
wearable in VDP's own avatar-wearable economy (19 real pieces across
those same 14 brands, since SVRPENTS & STONES carries 2 and VvLGARI
carries 5 — unchanged from the 17-brand count, since no renamed or
newly-added brand this round carries a real product).

---

## Implementation status (added when this file was placed into the repo)

**Superseded 22 Oct 2026 — read the section above first.** Everything
below this point describes the ORIGINAL 13-brand roster and is kept
as a real historical record, not rewritten to pretend it always said
12. The current, real code (`venvs/src/lib/svmikoDegvchi.js`,
`vdp/src/lib/svmikoDegvchiWearables.js`) now implements the upgraded
roster, with VvLGARI's own positioning defined the same day. The
current real wearable table:

| Brand | Product | Price |
|---|---|---|
| DEGVCHI | Virtual Heritage-Weave Bomber | 30 |
| LVCII | Virtual Handkerchief Set | 14 |
| STONE BONES | Virtual Concrete Bone-Buckle Jacket | 34 |
| STONE BONES | Virtual Emerald-Inlay Bone Chain | 26 |
| BOULÉVARD XCHANGE | Virtual Capsule Hoodie | 16 |
| JACQVÉ | Virtual Detachable-Jewelry Tote | 28 |
| ZV | Virtual Signature-Silhouette Tee | 9 |
| ROJO VELO | Virtual Accent Trench Coat | 36 |
| VEDELLÍN | Virtual Rare-Material Jacket | 40 |
| △AISON (VAISON) | Virtual Transformation Pendant | 28 |
| ANCÓR | Virtual Blended-Material Jacket | 20 |
| 7EVEN | Virtual Everyday Track Jacket | 18 |
| VvLGARI | Virtual Pour Homme Fragrance | 11 |
| VvLGARI | Virtual Pour Femme Fragrance | 11 |
| VvLGARI | Virtual Aviator Sunglasses | 19 |
| VvLGARI | Virtual Women's Structured Tote | 42 |
| VvLGARI | Virtual Men's Weekender Bag | 38 |

Seventeen real entries across twelve brands — VvLGARI carries five
(one per real product its positioning named: cologne, perfume,
sunglasses, and a handbag for each of men and women), STONE BONES
carries two (its flagship jacket and its emerald-inlay bone chain, the
standalone piece the natural-stone correction called for). Flagship-
product titles/prices for the ten renamed-or-repositioned-or-newly-
defined brands besides those two are this codebase's own reasonable
derivation from the positioning/signature table above, not separately
specified in the handoff — the same "flagged, interpretive" posture
the original build already held for payout-account ids.

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
