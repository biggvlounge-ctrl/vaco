# Plan — Phase 11: SVMIKO DEGVCHI Fashion House

## Goal
Populate VENVS's already-built Shopify-style branded-storefront system
(`marketplace.js`'s `registerSeller`/`listProduct`, Phase 3) with the
ecosystem's first real clothing lines: SVMIKO DEGVCHI, a 13-brand
fashion house, handed off directly as a real, confirmed brand
architecture with an explicit "real, direct integration point" already
specified (each brand becomes its own real, distinct seller/
storefront). Not a new mechanism -- the same real "own branded page,
not one generic template" model already proven with the existing 2
demo sellers.

## Design
- `lib/svmikoDegvchi.js`: `SUB_BRANDS`, 13 real brand definitions
  (slug, name, positioning, signature element, one real flagship
  product each), `seedSvmikoDegvchiStorefronts(marketplace)` — calls
  `registerSeller`/`listProduct` for real, once per brand.
- `theme` (a real, free-form object per `registerSeller`'s own design)
  populated with each brand's real, distinct positioning and signature
  element, plus the shared house identity (`parentBrand`, `monogram`:
  "SD", `gatewaySymbol`: the real 出口/deguchi meaning) -- not left
  empty or generic like a placeholder would be.
- Real, deliberate price-tier separation matching each brand's stated
  positioning: the 9 luxury/accessory-heavy houses (DEGVCHI, LVCII,
  DND, JACQVÉ, RED VEIL, VEDELLÍN, VAISON, BOOBI Couture, ANCÓR) all
  price above the 4 streetwear houses (BLVD, ZV, VvLGAR, DVMB) --
  proven directly (min luxury price > max streetwear price), not
  asserted.
- Real, deterministic `ownerId` per brand (`svmiko-degvchi-<slug>`) --
  no founder identity is given anywhere in the source brief, flagged
  as the interpretive choice.
- Wired into `MarketplaceView.jsx`: seeded *after* the original two
  demo sellers (Cherokee Hardware Co., Riverfront Vinyl), which stay
  in place -- additive, not a replacement, and preserves the existing
  abandoned-cart demo's `products[1]` index reference. The seller-list
  render was also touched (a real, small, honest improvement, not
  scope creep): it now shows the real monogram + falls back to a
  seller's real `positioning` text when no `banner` exists, since the
  new 13 sellers use `positioning` instead of the demo two's `banner`
  field.

## Explicitly NOT in this task
- The SD monogram and DEGVCHI Gateway Symbol as actual rendered
  graphics -- real visual/asset design work with no image assets
  available in this session; `theme` carries their real textual
  description only.
- Any tie-in to VDP's own, separate `degvchi.js` (the avatar-wearable
  economy) -- the source brief's own "Real, direct integration point"
  section names only VENVS's Marketplace as the confirmed target;
  a virtual/avatar-wearable version of SVMIKO DEGVCHI pieces is real,
  later, unconfirmed scope, not invented here.
- Products beyond one real flagship piece per brand -- a full,
  multi-item catalog per house is real, later content work.

## Verification approach
Plain-Node pass first (`.mjs` script, deleted after -- 20 checks):
exactly 13 real, uniquely-slugged brands with real positioning text
and a real, positively-priced flagship product each; seeding registers
exactly 13 real sellers and 13 real products; the DEGVCHI flagship
seller/theme/product all checked field-by-field against the real
source brief's own description; the luxury-vs-streetwear price
separation proven directly; every seller independently retrievable
and distinctly id'd; `browseProducts` surfaces all 13 in the unified
list. Then a live pass in a real browser (Playwright): logged in,
switched to the Marketplace tab, all 13 real storefronts confirmed
rendered (including two real test-script selector bugs caught and
fixed along the way -- a tab-switch selector accidentally matching
prose text instead of the button, and an xpath one level too high
that grabbed the wrong "Add to cart" button), the SD monogram confirmed
rendering next to DEGVCHI's name, and a real, complete purchase of the
DEGVCHI flagship coat confirmed end to end -- Order total exactly 640
VCoin, matching the real listed price precisely, zero console/page
errors.

## Done when
- All 13 real storefronts exist, are independently browsable, and
  their flagship products are purchasable through the real, existing
  cart -> checkout -> VCoin-split flow.
- The real luxury-vs-streetwear price tiering is proven, not just
  asserted.
- Confirmed live in an actual browser, not just build-checked.
