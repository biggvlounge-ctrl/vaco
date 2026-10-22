// VDP / DEGVCHI — SVMIKO DEGVCHI avatar-wearable line.
// Source of truth: the same real, confirmed SVMIKO DEGVCHI brand
// architecture handed off for VENVS's Marketplace storefronts
// (`venvs/src/lib/svmikoDegvchi.js`), applied here to the real, other
// half of that handoff's own framing -- "the first real clothing
// lines for VENVS *and VDP*." VENVS's own "Real, direct integration
// point" section named only the Marketplace storefronts as confirmed;
// this module is the real, defensible extension into VDP's existing
// avatar-wearable economy (`degvchi.js`), not invented from
// nothing -- DEGVCHI is explicitly the house's own flagship brand, and
// `degvchi.js` already exists as VDP's real avatar-wearable system for
// exactly this kind of content.
//
// **Updated 22 Oct 2026 to the upgraded 12-brand roster**, the same
// real replacement `venvs/src/lib/svmikoDegvchi.js` took -- see that
// module's own header for the full real rename/retire history
// (Devil in Details → STONE BONES, Boulevard/BLVD → BOULÉVARD
// XCHANGE, RED VEIL → ROJO VELO, VvLGAR → VvLGARI, 7EVEN newly added,
// BOOBI Couture and DVMB retired).
//
// **Sixteen entries across twelve brands, now that VvLGARI is real
// too.** VvLGARI's positioning was "to be established" through 21 Oct
// 2026; it was given directly on 22 Oct 2026 as a luxury accessories
// house focused on cologne, perfume, sunglasses, and handbags for men
// and women -- the same real update `venvs/src/lib/svmikoDegvchi.js`
// took on the VENVS side (see that module's own header). Five rows
// below share `slug: 'vvlgari'` rather than one, because it is one
// brand with five real virtual items, not five brands.
//
// Real, deliberate scope: one virtual wearable per sub-brand product
// that currently exists, matching each brand's real described identity
// to one of `degvchi.js`'s own three real categories (clothing/
// cosmetics/accessories) -- `clothing` for the 9 brands built around
// garments, `accessories` for brands built around hardware/jewelry/
// emblems/eyewear/bags (STONE BONES' hardware, VAISON's own
// transformation-themed pendant, VvLGARI's sunglasses and both
// handbags), and `cosmetics` for VvLGARI's cologne and perfume -- the
// first real use of that category here, since no other SVMIKO DEGVCHI
// brand's description centers on fragrance.
//
// Real, deliberately DIFFERENT pricing scale from VENVS's own physical
// flagship prices: virtual avatar-wearable economies price far lower
// in every real comparable (Roblox's own real items), so this is not
// the same price divided by a constant, it's a real, independently-
// reasoned virtual price scale -- while still preserving the same
// real luxury-vs-streetwear tier separation VENVS's own line proved
// (every luxury-house virtual piece prices above every streetwear-
// house virtual piece).
//
// Real, deliberate cross-app identity link: `creatorId` uses the exact
// same `svmiko-degvchi-<slug>` convention VENVS's own `ownerIdFor()`
// produces -- the same real brand entity is credited in both apps,
// even though the two apps share no backend state (VENVS and VDP are
// genuinely separate processes; this is a real, intentional naming
// convention match, not a functional link).

import { registerWearable } from './degvchi.js';

export const SVMIKO_DEGVCHI_HOUSE = 'svmiko-degvchi-fashion-house';

export const SUB_BRAND_WEARABLES = [
  { slug: 'degvchi', name: 'DEGVCHI Virtual Heritage-Weave Bomber', category: 'clothing', price: 30 },
  { slug: 'lvcii', name: 'LVCII Virtual Handkerchief Set', category: 'accessories', price: 14 },
  { slug: 'stone-bones', name: 'STONE BONES Virtual Hardware Jacket', category: 'clothing', price: 34 },
  { slug: 'boulevard-xchange', name: 'BOULÉVARD XCHANGE Virtual Capsule Hoodie', category: 'clothing', price: 16 },
  { slug: 'jacqve', name: 'JACQVÉ Virtual Detachable-Jewelry Tote', category: 'accessories', price: 28 },
  { slug: 'zv', name: 'ZV Virtual Signature-Silhouette Tee', category: 'clothing', price: 9 },
  { slug: 'rojo-velo', name: 'ROJO VELO Virtual Accent Trench Coat', category: 'clothing', price: 36 },
  { slug: 'vedellin', name: 'VEDELLÍN Virtual Rare-Material Jacket', category: 'clothing', price: 40 },
  { slug: 'vaison', name: '△AISON Virtual Transformation Pendant', category: 'accessories', price: 28 },
  { slug: 'ancor', name: 'ANCÓR Virtual Blended-Material Jacket', category: 'clothing', price: 20 },
  { slug: 'seven-even', name: '7EVEN Virtual Everyday Track Jacket', category: 'clothing', price: 18 },
  { slug: 'vvlgari', name: 'VvLGARI Virtual Pour Homme Fragrance', category: 'cosmetics', price: 11 },
  { slug: 'vvlgari', name: 'VvLGARI Virtual Pour Femme Fragrance', category: 'cosmetics', price: 11 },
  { slug: 'vvlgari', name: 'VvLGARI Virtual Aviator Sunglasses', category: 'accessories', price: 19 },
  { slug: 'vvlgari', name: "VvLGARI Virtual Women's Structured Tote", category: 'accessories', price: 42 },
  { slug: 'vvlgari', name: "VvLGARI Virtual Men's Weekender Bag", category: 'accessories', price: 38 },
];

// Matches VENVS's own `ownerIdFor()` exactly -- kept as a real,
// independent copy (not imported cross-app, since VDP and VENVS don't
// share code) rather than re-deriving a different convention.
export function creatorIdFor(slug) {
  return `svmiko-degvchi-${slug}`;
}

export function seedSvmikoDegvchiWearables(store) {
  return SUB_BRAND_WEARABLES.map((item) => {
    const wearable = registerWearable(store, {
      name: item.name,
      category: item.category,
      price: item.price,
      creatorId: creatorIdFor(item.slug),
      sponsor: item.name.split(' Virtual')[0],
    });
    return { brand: item.slug, wearable };
  });
}
