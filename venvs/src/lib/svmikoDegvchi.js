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
// **`flagshipProducts` is an array, not a single object**, because
// VvLGARI's own real positioning (given directly, 22 Oct 2026: "that
// will be our cologne, sunglasses, brand... sunglasses, cologne,
// perfume, and handbag for men and women accessories") needs more than
// one product under one storefront, while every other brand only ever
// needed one. Rather than give VvLGARI a different shape from the
// other eleven, every brand's single flagship item was wrapped into a
// one-element array so `seedSvmikoDegvchiStorefronts` has one real loop
// instead of a special case. VvLGARI's positioning is no longer "to be
// established" -- it is now defined directly, so it is no longer
// skipped at seeding (see that function's own comment, still kept for
// the real case of a future brand with no product yet). Exact product
// names and prices below are this module's own reasonable derivation
// from the stated focus (cologne/perfume/sunglasses/handbags for men
// and women), same "flagged, interpretive" posture already held for
// the other eleven brands' flagship products and for payout-account
// ids -- not specified verbatim in the handoff itself.
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
    flagshipProducts: [
      { title: 'DEGVCHI Heritage-Weave Bomber Jacket', price: 420, category: 'luxury-streetwear' },
    ],
  },
  {
    slug: 'lvcii',
    name: 'LVCII',
    positioning: 'Modern everyday luxury.',
    signatureElement: 'Designer handkerchief collections',
    flagshipProducts: [
      { title: 'LVCII Signature Handkerchief Collection', price: 180, category: 'luxury-accessories' },
    ],
  },
  {
    slug: 'stone-bones',
    name: 'STONE BONES',
    // The house's own real comparable, given directly: Chrome Hearts --
    // gothic/sculptural luxury hardware worn as jewelry-grade accessory
    // rather than plain trim. The material is the deliberate point of
    // difference, given directly in a later correction: where Chrome
    // Hearts' hardware is chrome/sterling silver, STONE BONES' own is
    // cast to look like stone and concrete -- a material treatment the
    // house itself claims has never been done before in this kind of
    // hardware. This is the brand that replaced Devil in Details (DND);
    // see this file's own header for the rename.
    positioning: "Dark/sculptural luxury -- the house's own answer to "
      + 'Chrome Hearts, but in stone and concrete rather than chrome.',
    signatureElement: 'Stone-and-concrete-cast hardware, not chrome or silver',
    flagshipProducts: [
      { title: 'STONE BONES Concrete-Cast Hardware Jacket', price: 520, category: 'luxury-outerwear' },
    ],
  },
  {
    slug: 'boulevard-xchange',
    name: 'BOULÉVARD XCHANGE',
    positioning: 'Luxury streetwear.',
    signatureElement: 'Cultural exchange',
    flagshipProducts: [
      { title: 'BOULÉVARD XCHANGE Cultural Capsule Hoodie', price: 165, category: 'luxury-streetwear' },
    ],
  },
  {
    slug: 'jacqve',
    name: 'JACQVÉ',
    positioning: "Women's handbags & footwear.",
    signatureElement: 'Detachable jewelry',
    flagshipProducts: [
      { title: 'JACQVÉ Detachable-Jewelry Tote', price: 480, category: 'luxury-handbags' },
    ],
  },
  {
    slug: 'zv',
    name: 'ZV',
    positioning: 'Minimalist streetwear.',
    signatureElement: 'Silhouette',
    flagshipProducts: [
      { title: 'ZV Signature-Silhouette Tee', price: 58, category: 'streetwear-basics' },
    ],
  },
  {
    slug: 'rojo-velo',
    name: 'ROJO VELO',
    positioning: 'Modern European luxury.',
    signatureElement: 'Signature accent / fashion-forward construction',
    flagshipProducts: [
      { title: 'ROJO VELO Accent-Seam Trench Coat', price: 560, category: 'luxury-outerwear' },
    ],
  },
  {
    slug: 'vedellin',
    name: 'VEDELLÍN',
    positioning: 'Global exotic luxury.',
    signatureElement: 'Extraordinary materials',
    flagshipProducts: [
      { title: 'VEDELLÍN Rare-Material Field Jacket', price: 640, category: 'luxury-outerwear' },
    ],
  },
  {
    slug: 'vaison',
    name: 'VAISON / △AISON',
    positioning: 'Avant-garde luxury.',
    signatureElement: 'Transformation',
    flagshipProducts: [
      { title: '△AISON Transformable Deconstructed Coat', price: 610, category: 'avant-garde-luxury' },
    ],
  },
  {
    slug: 'ancor',
    name: 'ANCÓR',
    positioning: 'Luxury leisure/yachting.',
    signatureElement: 'Material blending',
    flagshipProducts: [
      { title: 'ANCÓR Blended-Material Yacht Jacket', price: 310, category: 'luxury-resortwear' },
    ],
  },
  {
    slug: 'seven-even',
    name: '7EVEN',
    positioning: 'Luxury athletic/everyday.',
    signatureElement: 'Perfecting everyday clothing',
    flagshipProducts: [
      { title: '7EVEN Perfected Everyday Track Jacket', price: 145, category: 'luxury-athleisure' },
    ],
  },
  {
    slug: 'vvlgari',
    name: 'VvLGARI',
    // The name is a deliberate play on "vulgar" -- given directly as
    // the word's real, older sense (bold, out-of-the-box, unlike
    // anything else), not profanity. That reading is the brand's
    // design ethos, not just its name's etymology, so it belongs in
    // `positioning` rather than only a comment.
    positioning: "Luxury accessories, vulgar in its true sense -- bold, "
      + "out-of-the-box, unlike anything else: cologne, perfume, "
      + 'sunglasses, and handbags for men and women.',
    signatureElement: "Fragrance and eyewear as the house's focus, not clothing",
    // Real positioning as given directly, 22 Oct 2026 -- cologne,
    // perfume, sunglasses, and a handbag for each of men and women.
    // Five items, not one, is why `flagshipProducts` is an array at
    // all; see this file's own header.
    flagshipProducts: [
      { title: 'VvLGARI Pour Homme Eau de Parfum', price: 160, category: 'luxury-fragrance-men' },
      { title: 'VvLGARI Pour Femme Eau de Parfum', price: 170, category: 'luxury-fragrance-women' },
      { title: 'VvLGARI Aviator Sunglasses', price: 290, category: 'luxury-eyewear' },
      { title: "VvLGARI Women's Structured Leather Tote", price: 640, category: 'luxury-handbags-women' },
      { title: "VvLGARI Men's Leather Weekender Bag", price: 580, category: 'luxury-handbags-men' },
    ],
  },
];

// Real, deterministic seller ownerId per brand -- no founder identity
// is given anywhere in the source brief, so this is a real, stable,
// derived id (not invented per-run randomness), consistent with this
// session's established "flag the interpretive choice" posture.
export function ownerIdFor(slug) {
  return `svmiko-degvchi-${slug}`;
}

// Every brand in `SUB_BRANDS` is real identity; not every brand is
// guaranteed to have a real product -- today all twelve do, but the
// skip stays real rather than removed, for the same reason a brand
// might arrive again with its positioning still "to be established."
// Opening a storefront with nothing to sell is a worse state than not
// opening one at all (the existing test suite's own standing rule: "a
// seeded storefront with no stock is an empty shop") -- so a brand
// with an empty or missing `flagshipProducts` is skipped here rather
// than seeded empty, and the real reason is returned alongside the
// ones that were seeded. Every product in a brand's `flagshipProducts`
// array is listed under that brand's one real storefront/seller --
// one seller per brand, however many products it carries.
export function seedSvmikoDegvchiStorefronts(marketplace) {
  const seeded = [];
  const skipped = [];
  for (const brand of SUB_BRANDS) {
    if (!brand.flagshipProducts || brand.flagshipProducts.length === 0) {
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
    const products = brand.flagshipProducts.map((flagshipProduct) => listProduct(marketplace, {
      sellerId: seller.id,
      title: flagshipProduct.title,
      price: flagshipProduct.price,
      category: flagshipProduct.category,
    }));
    seeded.push({ brand: brand.slug, seller, products });
  }
  seeded.skipped = skipped;
  return seeded;
}
