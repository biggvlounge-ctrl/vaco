// VENVS — SVMIKO DEGVCHI Fashion House.
// Source of truth: `SVMIKO_DEGVCHI_FASHION_HOUSE.md`, updated 22 Oct
// 2026 with a direct, upgraded 12-brand roster replacing the original
// 13 -- several brands kept their name but changed positioning and
// signature (DEGVCHI, LVCII, JACQVÉ, ZV, VEDELLÍN, VAISON, ANCÓR all
// carry real, different identities now), some were renamed (Devil in
// Details → STONE BONES, Boulevard/BLVD → BOULÉVARD XCHANGE, RED VEIL
// → ROJO VELO, VvLGAR → VvLGARI), one is genuinely new (7EVEN), and
// three from the original roster (BOOBI/BOOBI Couture, DVMB) are
// retired -- not in the new handoff, not kept as unlisted legacy
// stock. This file is a full replacement, not an additive patch.
//
// `theme` is a real, free-form object per `registerSeller`'s own
// design (no fixed schema exists anywhere in the source doc) --
// populated here with each brand's real, distinct positioning and
// signature element, not left empty or generic.
//
// **One real, representative flagship product per brand, EXCEPT
// VvLGARI.** The handoff itself states VvLGARI's positioning as
// "Restored — positioning to define" and its signature as "To be
// established" -- an explicit, direct instruction not to invent one.
// `flagshipProduct: null` is that instruction taken literally rather
// than worked around; `seedSvmikoDegvchiStorefronts` skips opening a
// storefront for any brand with no real product rather than seeding
// an empty shop (see that function's own comment). Every other
// brand's flagship product/price below is this module's own
// reasonable derivation from its NEW positioning and signature, same
// "flagged, interpretive" posture `ownerIdFor`'s own comment already
// holds for payout-account ids -- not specified in the handoff table
// itself, which named identity and signature only.
//
// Not built here, flagged directly (unchanged from the original):
// the SD monogram and the DEGVCHI Gateway Symbol (出口/deguchi) are
// real visual/asset design work -- no image assets exist in this
// session to render them, so `theme` carries their real textual
// description only, not a fabricated graphic.

import { registerSeller, listProduct } from './marketplace.js';

export const SVMIKO_DEGVCHI_HOUSE = 'svmiko-degvchi-fashion-house';
export const MONOGRAM = 'SD';
export const GATEWAY_SYMBOL_MEANING = '出口 (deguchi) — exit/gateway: passage, transition, movement, entering a new world';

export const SUB_BRANDS = [
  {
    slug: 'degvchi',
    name: 'DEGVCHI',
    positioning: 'Japanese luxury streetwear.',
    signatureElement: 'Japanese heritage materials',
    flagshipProduct: { title: 'DEGVCHI Heritage-Weave Bomber Jacket', price: 420, category: 'luxury-streetwear' },
  },
  {
    slug: 'lvcii',
    name: 'LVCII',
    positioning: 'Modern everyday luxury.',
    signatureElement: 'Designer handkerchief collections',
    flagshipProduct: { title: 'LVCII Signature Handkerchief Collection', price: 180, category: 'luxury-accessories' },
  },
  {
    slug: 'stone-bones',
    name: 'STONE BONES',
    positioning: 'Dark/sculptural luxury.',
    signatureElement: 'Heavy details + precious hardware',
    flagshipProduct: { title: 'STONE BONES Sculpted-Hardware Jacket', price: 520, category: 'luxury-outerwear' },
  },
  {
    slug: 'boulevard-xchange',
    name: 'BOULÉVARD XCHANGE',
    positioning: 'Luxury streetwear.',
    signatureElement: 'Cultural exchange',
    flagshipProduct: { title: 'BOULÉVARD XCHANGE Cultural Capsule Hoodie', price: 165, category: 'luxury-streetwear' },
  },
  {
    slug: 'jacqve',
    name: 'JACQVÉ',
    positioning: "Women's handbags & footwear.",
    signatureElement: 'Detachable jewelry',
    flagshipProduct: { title: 'JACQVÉ Detachable-Jewelry Tote', price: 480, category: 'luxury-handbags' },
  },
  {
    slug: 'zv',
    name: 'ZV',
    positioning: 'Minimalist streetwear.',
    signatureElement: 'Silhouette',
    flagshipProduct: { title: 'ZV Signature-Silhouette Tee', price: 58, category: 'streetwear-basics' },
  },
  {
    slug: 'rojo-velo',
    name: 'ROJO VELO',
    positioning: 'Modern European luxury.',
    signatureElement: 'Signature accent / fashion-forward construction',
    flagshipProduct: { title: 'ROJO VELO Accent-Seam Trench Coat', price: 560, category: 'luxury-outerwear' },
  },
  {
    slug: 'vedellin',
    name: 'VEDELLÍN',
    positioning: 'Global exotic luxury.',
    signatureElement: 'Extraordinary materials',
    flagshipProduct: { title: 'VEDELLÍN Rare-Material Field Jacket', price: 640, category: 'luxury-outerwear' },
  },
  {
    slug: 'vaison',
    name: 'VAISON / △AISON',
    positioning: 'Avant-garde luxury.',
    signatureElement: 'Transformation',
    flagshipProduct: { title: '△AISON Transformable Deconstructed Coat', price: 610, category: 'avant-garde-luxury' },
  },
  {
    slug: 'ancor',
    name: 'ANCÓR',
    positioning: 'Luxury leisure/yachting.',
    signatureElement: 'Material blending',
    flagshipProduct: { title: 'ANCÓR Blended-Material Yacht Jacket', price: 310, category: 'luxury-resortwear' },
  },
  {
    slug: 'seven-even',
    name: '7EVEN',
    positioning: 'Luxury athletic/everyday.',
    signatureElement: 'Perfecting everyday clothing',
    flagshipProduct: { title: '7EVEN Perfected Everyday Track Jacket', price: 145, category: 'luxury-athleisure' },
  },
  {
    slug: 'vvlgari',
    name: 'VvLGARI',
    positioning: 'Restored — positioning to define.',
    signatureElement: 'To be established',
    // No flagship product -- see this file's own header on why that
    // is deliberate, not an omission.
    flagshipProduct: null,
  },
];

// Real, deterministic seller ownerId per brand -- no founder identity
// is given anywhere in the source brief, so this is a real, stable,
// derived id (not invented per-run randomness), consistent with this
// session's established "flag the interpretive choice" posture.
export function ownerIdFor(slug) {
  return `svmiko-degvchi-${slug}`;
}

// Every brand in `SUB_BRANDS` is real identity; not every brand has a
// real product yet. Opening a storefront with nothing to sell is a
// worse state than not opening one at all (the existing test suite's
// own standing rule: "a seeded storefront with no stock is an empty
// shop") -- so a brand with `flagshipProduct: null` (today, only
// VvLGARI) is skipped here rather than seeded empty, and the real
// reason is returned alongside the ones that were.
export function seedSvmikoDegvchiStorefronts(marketplace) {
  const seeded = [];
  const skipped = [];
  for (const brand of SUB_BRANDS) {
    if (!brand.flagshipProduct) {
      skipped.push({ brand: brand.slug, reason: 'no flagship product defined yet' });
      continue;
    }
    const seller = registerSeller(marketplace, {
      name: brand.name,
      ownerId: ownerIdFor(brand.slug),
      theme: {
        parentBrand: SVMIKO_DEGVCHI_HOUSE,
        monogram: MONOGRAM,
        gatewaySymbol: GATEWAY_SYMBOL_MEANING,
        positioning: brand.positioning,
        signatureElement: brand.signatureElement,
      },
    });
    const product = listProduct(marketplace, {
      sellerId: seller.id,
      title: brand.flagshipProduct.title,
      price: brand.flagshipProduct.price,
      category: brand.flagshipProduct.category,
    });
    seeded.push({ brand: brand.slug, seller, product });
  }
  seeded.skipped = skipped;
  return seeded;
}
