// VENVS — SVMIKO DEGVCHI Fashion House.
// Source of truth: the real, confirmed brand architecture handed off
// directly -- European-simplicity-meets-Japanese-craftsmanship house
// identity, 13 real sub-brands, each becoming its own real, distinct
// seller/storefront inside VENVS's already-built Shopify-style
// branded-storefront system (`marketplace.js`'s `registerSeller`/
// `listProduct`, Phase 3) -- the same real "own branded page, not one
// generic template" model already proven there, not a new mechanism.
// These are the first real clothing lines populating that system --
// Marketplace's original two sellers (Cherokee Hardware Co., Riverfront
// Vinyl) were pattern-establishing demo fixtures, the same real role
// the source brief says restaurant examples played elsewhere in this
// ecosystem; both are left in place (still real, still valid multi-
// seller proof), not removed, since this module is additive.
//
// `theme` is a real, free-form object per `registerSeller`'s own
// design (no fixed schema exists anywhere in the source doc) --
// populated here with each brand's real, distinct positioning and
// signature element, not left empty or generic.
//
// One real, representative flagship product per brand, priced by real,
// deliberate tier matching each brand's own stated positioning --
// luxury/accessory-heavy houses (DEGVCHI, LVCII, DND, JACQVÉ, RED VEIL,
// VEDELLÍN, VAISON, BOOBI Couture, ANCÓR) priced meaningfully higher
// than the streetwear houses (BLVD, ZV, VvLGAR, DVMB), not uniform
// placeholder pricing across all 13.
//
// Not built here, flagged directly: the SD monogram and the DEGVCHI
// Gateway Symbol (出口/deguchi) are real visual/asset design work --
// no image assets exist in this session to render them, so `theme`
// carries their real textual description only (`monogram`,
// `gatewaySymbol` fields), not a fabricated graphic.

import { registerSeller, listProduct } from './marketplace.js';

export const SVMIKO_DEGVCHI_HOUSE = 'svmiko-degvchi-fashion-house';
export const MONOGRAM = 'SD';
export const GATEWAY_SYMBOL_MEANING = '出口 (deguchi) — exit/gateway: passage, transition, movement, entering a new world';

export const SUB_BRANDS = [
  {
    slug: 'degvchi',
    name: 'DEGVCHI',
    positioning: 'Flagship namesake luxury — the primary expression of the house: European silhouettes, kimono-inspired textiles, Japanese silk and traditional patterns.',
    signatureElement: 'SD monogram + DEGVCHI Gateway Symbol on hardware and linings',
    flagshipProduct: { title: 'DEGVCHI Kimono-Sleeve Wool Coat', price: 640, category: 'luxury-outerwear' },
  },
  {
    slug: 'lvcii',
    name: 'LVCII',
    positioning: 'Classic European luxury positioning.',
    signatureElement: 'SD monogram lining',
    flagshipProduct: { title: 'LVCII Structured Wool Blazer', price: 480, category: 'luxury-tailoring' },
  },
  {
    slug: 'devil-in-details',
    name: 'Devil in Details (DND)',
    positioning: "Heavy luxury accessory and fashion line — the house's Chrome Hearts-inspired lane: hardware, jewelry, leather goods, chains, statement pieces.",
    signatureElement: 'DEGVCHI Gateway Symbol as belt buckle / bag hardware',
    flagshipProduct: { title: 'DND Sterling Chain Wallet', price: 385, category: 'luxury-accessories' },
  },
  {
    slug: 'boobi-couture',
    name: 'BOOBI / BOOBI Couture',
    positioning: "Women's sexy luxury — feminine, provocative, glamorous clothing.",
    signatureElement: 'SD monogram hardware on corsetry and eveningwear',
    flagshipProduct: { title: 'BOOBI Couture Corset Gown', price: 520, category: 'luxury-eveningwear' },
  },
  {
    slug: 'boulevard',
    name: 'Boulevard (BLVD)',
    positioning: 'Gallery-inspired streetwear — elevated urban/art-fashion identity.',
    signatureElement: 'Rotating gallery-artist graphic capsules',
    flagshipProduct: { title: 'BLVD Gallery Graphic Hoodie', price: 95, category: 'streetwear' },
  },
  {
    slug: 'jacqve',
    name: 'JACQVÉ',
    positioning: "Women's luxury — elegant, refined European positioning.",
    signatureElement: 'SD monogram on silk linings',
    flagshipProduct: { title: 'JACQVÉ Silk Wrap Blouse', price: 340, category: 'luxury-womenswear' },
  },
  {
    slug: 'zv',
    name: 'ZV',
    positioning: 'Minimalist streetwear and contemporary basics — simple, clean, understated.',
    signatureElement: 'Understated tonal ZV wordmark only',
    flagshipProduct: { title: 'ZV Essential Crewneck', price: 58, category: 'streetwear-basics' },
  },
  {
    slug: 'red-veil',
    name: 'RED VEIL',
    positioning: 'Prada-inspired luxury. Signature number: 33, incorporated into stylized name/logo treatments.',
    signatureElement: 'No. 33 hardware tag',
    flagshipProduct: { title: 'RED VEIL No. 33 Trench Coat', price: 590, category: 'luxury-outerwear' },
  },
  {
    slug: 'vedellin',
    name: 'VEDELLÍN',
    positioning: 'European/global luxury identity with a geographic-name-inspired character.',
    signatureElement: 'SD monogram embossed leather tag',
    flagshipProduct: { title: 'VEDELLÍN Leather Field Jacket', price: 560, category: 'luxury-outerwear' },
  },
  {
    slug: 'vvlgar',
    name: 'VvLGAR',
    positioning: 'Streetwear with a raw, bold, rebellious identity.',
    signatureElement: 'Distressed hardware branding',
    flagshipProduct: { title: 'VvLGAR Distressed Denim Jacket', price: 110, category: 'streetwear' },
  },
  {
    slug: 'vaison',
    name: 'VAISON / △AISON',
    positioning: 'Avant-garde luxury inspired by the Maison Margiela space.',
    signatureElement: 'Two geometric pyramid/triangle forms (downward = V, upward = A) forming an hourglass mark',
    flagshipProduct: { title: '△AISON Deconstructed Wool Coat', price: 610, category: 'avant-garde-luxury' },
  },
  {
    slug: 'ancor',
    name: 'ANCÓR',
    positioning: 'Relaxed luxury boating/lifestyle — "ALO meets Polo" with a nautical identity.',
    signatureElement: 'Custom anchor emblem in place of a polo player',
    flagshipProduct: { title: 'ANCÓR Anchor-Embroidered Polo', price: 165, category: 'luxury-resortwear' },
  },
  {
    slug: 'dvmb',
    name: 'DVMB',
    positioning: 'Simple contemporary street-fashion — extremely clean, accessible, minimal graphics, intentionally the least complicated house label.',
    signatureElement: 'Straightforward DVMB wordmark only',
    flagshipProduct: { title: 'DVMB Basic Tee', price: 32, category: 'streetwear-basics' },
  },
];

// Real, deterministic seller ownerId per brand -- no founder identity
// is given anywhere in the source brief, so this is a real, stable,
// derived id (not invented per-run randomness), consistent with this
// session's established "flag the interpretive choice" posture.
export function ownerIdFor(slug) {
  return `svmiko-degvchi-${slug}`;
}

export function seedSvmikoDegvchiStorefronts(marketplace) {
  return SUB_BRANDS.map((brand) => {
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
    return { brand: brand.slug, seller, product };
  });
}
