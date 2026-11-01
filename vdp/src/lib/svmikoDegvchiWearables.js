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
// brand with five real virtual items, not five brands. The name
// itself is a deliberate play on "vulgar" in its real, older sense --
// bold, out-of-the-box, unlike anything else -- not profanity; that
// reading is this brand's design ethos.
//
// STONE BONES's own real comparable, given the same day: Chrome
// Hearts -- gothic/sculptural hardware worn as jewelry-grade accessory.
// The brand's own two-word name carries three real points of
// difference, given directly across three follow-up corrections:
// STONE is the material -- both a cast concrete/stone-look finish AND
// genuine natural stone/gemstone inlay (emerald and assorted rock
// among them, not chrome/sterling silver like Chrome Hearts) -- and
// BONES is the shape (the hardware -- buckles, charms, chain links --
// is cast in bone silhouettes, not Chrome Hearts' own crosses and
// daggers). STONE BONES is the one brand with two real virtual items
// below, not one: the jacket stays `clothing` (the hardware is a
// detail on it, same as VENVS's own flagship piece), and the new
// emerald-inlay bone chain is `accessories` -- the real, standalone
// jewelry-grade piece the natural-stone correction calls for.
//
// Real, deliberate scope: one virtual wearable per sub-brand product
// that currently exists, matching each brand's real described identity
// to one of `degvchi.js`'s own three real categories (clothing/
// cosmetics/accessories) -- `clothing` for the 10 brands built around
// garments (STONE BONES' concrete bone-buckle jacket among them),
// `accessories` for brands built around jewelry/emblems/eyewear/bags
// (STONE BONES' own emerald-inlay bone chain, VAISON's own
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
//
// **Updated 1 Nov 2026 to the real 16-brand roster, then corrected
// the same session** -- the same real update `venvs/src/lib/
// svmikoDegvchi.js` took (see that module's own header for the full
// real rename/positioning/correction record). STONE BONES -> SVRPENTS
// Stone and BOULÉVARD XCHANGE -> BOVLEVARD Xchange (BX) are renamed in
// place, slug moving with the rename per this file's own precedent
// (Devil in Details -> STONE BONES already did the same). SA VIOR and
// VIC VALENCIAGO each get one real virtual wearable matching their
// real, confirmed positioning (Christian Dior and Balenciaga echoes,
// respectively), at the same ~15.5x physical-to-virtual price ratio
// this file's own existing rows already hold. THRONES AND BONES and
// MYSTERY AND MASTERY (confirmed directly as genuinely undecided --
// "I have not figured out yet") and the house's 17th brand, CVLT (no
// positioning given at all), carry no row here at all -- same real
// absence-means-nothing-to-sell-yet convention this list already
// held for VvLGARI before its own positioning existed, not three rows
// with an invented identity.

import { registerWearable } from './degvchi.js';

export const SVMIKO_DEGVCHI_HOUSE = 'svmiko-degvchi-fashion-house';

export const SUB_BRAND_WEARABLES = [
  { slug: 'degvchi', name: 'DEGVCHI Virtual Heritage-Weave Bomber', category: 'clothing', price: 30 },
  { slug: 'lvcii', name: 'LVCII Virtual Handkerchief Set', category: 'accessories', price: 14 },
  { slug: 'svrpents-stone', name: 'SVRPENTS Stone Virtual Concrete Bone-Buckle Jacket', category: 'clothing', price: 34 },
  { slug: 'svrpents-stone', name: 'SVRPENTS Stone Virtual Emerald-Inlay Bone Chain', category: 'accessories', price: 26 },
  { slug: 'bovlevard-xchange', name: 'BOVLEVARD Xchange Virtual Capsule Hoodie', category: 'clothing', price: 16 },
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
  { slug: 'sa-vior', name: 'SA VIOR Virtual Structured Bar-Silhouette Jacket', category: 'clothing', price: 35 },
  { slug: 'vic-valenciago', name: 'VIC VALENCIAGO Virtual ∧-Mark Minimalist Wool Coat', category: 'clothing', price: 42 },
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
