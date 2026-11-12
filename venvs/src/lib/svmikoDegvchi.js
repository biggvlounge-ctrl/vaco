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
//
// **Updated 1 Nov 2026 to the real 16-brand roster**, given directly
// as "the current 16-line fashion portfolio, with the latest spelling
// changes included": two of the existing twelve are respelled/renamed
// in place (STONE BONES → SVRPENTS Stone -- confirmed directly as a
// rename, not a new entity: same storefront, same two real products,
// same positioning, just the new name; BOULÉVARD XCHANGE → BOVLEVARD
// Xchange (BX)), and four are genuinely new (THRONES AND BONES,
// MYSTERY AND MASTERY, SA VIOR, VIC VALENCIAGO -- the latter's two A's
// using a custom crossbar-free ∧, carried here as its own Unicode
// glyph in `name` since no image asset exists for it). Per the same
// rename precedent this file's own header already set for Devil in
// Details → STONE BONES, a renamed brand's `slug` moves with it (the
// payout account is derived from the slug, and the point of a rename
// is that it IS the same brand continuing under a new name) rather
// than staying frozen on the old spelling.
//
// **Updated again, same session (1 Nov 2026) — real positioning given
// for 2 of the 4 new brands, a 17th brand added, 2 still open.**
// VIC VALENCIAGO is confirmed directly: "similar to the Balenciaga
// brand, luxury, simple" -- sleek minimalism, not the sculptural/
// oversized avant-garde reading this file originally derived from the
// name alone (replaced below). SA VIOR is confirmed directly: "like
// our Christian Dior" -- French-couture-inspired structured elegance,
// replacing this file's own original ecclesiastical/"savior" reading
// (also replaced below; the name itself stays SA VIOR, only the
// positioning it was read from the name is wrong). THRONES AND BONES
// and MYSTERY AND MASTERY are confirmed directly as genuinely
// undecided -- "I have not figured out yet" -- so both are reverted
// to the same real "positioning to be established" placeholder
// VvLGARI itself once carried (`flagshipProducts: []`, skipped at
// seeding by `seedSvmikoDegvchiStorefronts`'s own existing skip path,
// not force-fed an invented identity a second time). CVLT (its own
// real, confirmed vowel-dropped spelling of "CULT") is a genuinely
// new, 17th brand with no positioning given yet either, so it joins
// them on the same placeholder.
//
// **Updated 12 Nov 2026 to the real 20-brand roster.** Three renames,
// per direct instruction, each carrying its slug forward (same
// precedent this header already set: a rename is the same brand
// continuing under a new name, not a new entity) -- SVRPENTS Stone ->
// **SVRPENTS & STONES** ("using the ampersand, with SVRPENTS spelled
// as established"), VAISON / △AISON -> **VITO VAISON** (spelled
// letter-by-letter, "V-I-T-O VAISON"), and VIC VALENCIAGO -> **VIC
// VALENCI** (given as part of the same updated list but not
// individually flagged as a rename the way the other two were -- a
// future correction to this one specifically wouldn't be surprising).
// All three keep their real products/positioning exactly as before;
// only the name/slug moved. VEDELLÍN was absent from the founder's
// own typed list this round -- confirmed directly as an omission, not
// a retirement, and kept unchanged. Three genuinely new brands join
// on the same honest "to be established" placeholder THRONES AND
// BONES/MYSTERY AND MASTERY/CVLT already use: **BARRAGE**,
// **ARROGANT ANGEL**, **SANTOS VENDETTA** -- no positioning given yet
// for any of the three.

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
    slug: 'svrpents-stones',
    name: 'SVRPENTS & STONES',
    // Renamed from STONE BONES, 1 Nov 2026 -- confirmed directly as a
    // rename of the existing brand (same storefront, same two real
    // products, same positioning), not a new entity, so everything
    // below carries over unchanged except the name/slug themselves.
    // The house's own real comparable, given directly: Chrome Hearts --
    // gothic/sculptural luxury hardware worn as jewelry-grade accessory
    // rather than plain trim. The brand's own two-word name carries
    // three real points of difference, given directly across four
    // corrections, not just a label: STONE is the material -- both a
    // cast concrete/stone-look finish AND genuine natural stone and
    // colored-gemstone accents (emerald and assorted colored rock
    // among them, not one fixed stone or color) -- and BONES is the
    // shape (the hardware itself -- buckles, charms, chain links -- is
    // cast in bone silhouettes, not Chrome Hearts' own crosses and
    // daggers). This is the brand that replaced Devil in Details
    // (DND); see this file's own header for the rename.
    //
    // **Every piece is an original design, made in a real limited
    // run -- given directly as the reason buyers can also trade them
    // afterward.** `editionSize` below is this module's own real,
    // flagged-interpretive number (not given verbatim); the mechanism
    // itself is real: `seedSvmikoDegvchiStorefronts` passes it through
    // to `listProduct`, and `checkout` in `marketplace.js` refuses to
    // sell past it. A sold-out piece's only path to a new owner from
    // then on is exactly what "traded" means here -- a prior buyer
    // reselling it peer to peer through this same Marketplace, the
    // same `registerSeller`/`listProduct` mechanism any reseller uses,
    // nothing SVRPENTS Stone-specific.
    positioning: "Dark/sculptural luxury -- the house's own answer to "
      + 'Chrome Hearts: bone-shaped hardware, cast in stone and '
      + 'concrete and accented with genuine natural stones and colored '
      + 'gemstones (emerald among them), rather than chrome. Every '
      + 'piece is an original design, made in a limited run so it can '
      + 'also be traded.',
    signatureElement: 'Bone-shaped hardware (buckles, charms, chain links) -- cast in stone/concrete, accented with real natural stones and colored gemstones -- not chrome or silver; every piece an original, limited-run design',
    flagshipProducts: [
      { title: 'SVRPENTS & STONES Concrete Bone-Buckle Jacket', price: 520, category: 'luxury-outerwear', editionSize: 150 },
      { title: 'SVRPENTS & STONES Emerald-Inlay Bone Chain', price: 380, category: 'luxury-accessories', editionSize: 75 },
    ],
  },
  {
    slug: 'bovlevard-xchange',
    name: 'BOVLEVARD Xchange (BX)',
    positioning: 'Luxury streetwear.',
    signatureElement: 'Cultural exchange',
    flagshipProducts: [
      { title: 'BOVLEVARD Xchange Cultural Capsule Hoodie', price: 165, category: 'luxury-streetwear' },
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
    slug: 'vito-vaison',
    name: 'VITO VAISON',
    positioning: 'Avant-garde luxury.',
    signatureElement: 'Transformation',
    flagshipProducts: [
      { title: 'VITO VAISON Transformable Deconstructed Coat', price: 610, category: 'avant-garde-luxury' },
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
  {
    slug: 'thrones-and-bones',
    name: 'THRONES AND BONES',
    // Confirmed directly (1 Nov 2026): "I have not figured out yet."
    // A prior version of this file guessed a regal/bone-white
    // positioning from the name alone; that guess is withdrawn, not
    // kept as a fallback, now that the real answer is "undecided"
    // rather than "unsent" -- the same real "to be established"
    // placeholder VvLGARI itself once carried, see this file's own
    // header.
    positioning: 'Positioning to be established.',
    signatureElement: 'To be established',
    // No flagship product yet -- see `seedSvmikoDegvchiStorefronts`'s
    // own skip path, the same real mechanism VvLGARI's own
    // placeholder once used.
    flagshipProducts: [],
  },
  {
    slug: 'mystery-and-mastery',
    name: 'MYSTERY AND MASTERY',
    // Confirmed directly (1 Nov 2026): "I have not figured out yet."
    // Same withdrawal as THRONES AND BONES immediately above -- a
    // prior guessed positioning is removed, not kept as a fallback.
    positioning: 'Positioning to be established.',
    signatureElement: 'To be established',
    flagshipProducts: [],
  },
  {
    slug: 'sa-vior',
    name: 'SA VIOR',
    // Real positioning confirmed directly (1 Nov 2026): "like our
    // Christian Dior" -- replacing a prior, withdrawn ecclesiastical/
    // "savior" reading of the name that turned out wrong. Dior's own
    // real defining signature, the 1947 "Bar Suit": a structured,
    // cinched-waist jacket built over a sculpted hip, the real
    // comparable this brand's own flagship piece is built from.
    positioning: "French-couture-inspired luxury -- the house's own "
      + 'answer to Christian Dior: structured, feminine silhouettes, a '
      + 'cinched waist over a sculpted hip, and refined luxury fabrics.',
    signatureElement: "Structured, cinched-waist tailoring over a sculpted hip -- the house's own Bar-Suit-inspired silhouette",
    flagshipProducts: [
      { title: 'SA VIOR Structured Bar-Silhouette Jacket', price: 540, category: 'luxury-outerwear' },
    ],
  },
  {
    slug: 'vic-valenci',
    name: 'VIC VALENCI',
    // Real positioning confirmed directly (1 Nov 2026): "similar to
    // the Balenciaga brand, luxury, simple" -- replacing a prior,
    // withdrawn avant-garde/deconstructed/oversized reading of the
    // name that turned out wrong; the real signature is restraint,
    // not sculptural excess. The two A's in VALENCIAGO use a custom
    // crossbar-free ∧ (confirmed directly, 1 Nov 2026), carried here
    // as its own Unicode glyph in `name` (U+2227, LOGICAL AND) since
    // no image asset exists for the real custom typographic mark.
    positioning: "Luxury, simple -- the house's own echo of Balenciaga's "
      + 'own sleek minimalism: precise, restrained tailoring over '
      + 'ornament, with the custom crossbar-free ∧ wordmark used '
      + 'sparingly as its one real signature mark.',
    signatureElement: 'Custom crossbar-free ∧ wordmark, used sparingly as a single embossed mark on otherwise restrained, minimalist tailoring',
    flagshipProducts: [
      { title: 'VIC VALENCI ∧-Mark Minimalist Wool Coat', price: 650, category: 'luxury-outerwear' },
    ],
  },
  {
    // A genuinely new, 17th brand, given directly (1 Nov 2026): "We
    // also will add one called Cult, C-V-L-T" -- its own real,
    // confirmed vowel-dropped spelling, same house convention as
    // SVMIKO/SVRPENTS/BOVLEVARD. No positioning given yet.
    slug: 'cvlt',
    name: 'CVLT',
    positioning: 'Positioning to be established.',
    signatureElement: 'To be established',
    flagshipProducts: [],
  },
  {
    // Genuinely new, 18th brand, given directly (12 Nov 2026) as part
    // of the updated 20-brand roster. No positioning given yet --
    // same real "to be established" placeholder as CVLT/THRONES AND
    // BONES/MYSTERY AND MASTERY.
    slug: 'barrage',
    name: 'BARRAGE',
    positioning: 'Positioning to be established.',
    signatureElement: 'To be established',
    flagshipProducts: [],
  },
  {
    // Genuinely new, 19th brand, given directly (12 Nov 2026).
    slug: 'arrogant-angel',
    name: 'ARROGANT ANGEL',
    positioning: 'Positioning to be established.',
    signatureElement: 'To be established',
    flagshipProducts: [],
  },
  {
    // Genuinely new, 20th brand, given directly (12 Nov 2026).
    slug: 'santos-vendetta',
    name: 'SANTOS VENDETTA',
    positioning: 'Positioning to be established.',
    signatureElement: 'To be established',
    flagshipProducts: [],
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
// guaranteed to have a real product -- today 14 of the 20 do (THRONES
// AND BONES, MYSTERY AND MASTERY, CVLT, BARRAGE, ARROGANT ANGEL, and
// SANTOS VENDETTA are genuinely undecided/not-yet-positioned and
// real-skipped), but the
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
      // Most brands don't specify one -- `listProduct`'s own default
      // (`null`, unlimited) applies to them unchanged. STONE BONES is
      // the real first user of this field; see its own entry above.
      editionSize: flagshipProduct.editionSize ?? null,
    }));
    seeded.push({ brand: brand.slug, seller, products });
  }
  seeded.skipped = skipped;
  return seeded;
}
