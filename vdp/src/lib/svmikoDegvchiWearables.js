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
// Real, deliberate scope: one virtual wearable per sub-brand (13
// total), matching each brand's real described identity to one of
// `degvchi.js`'s own three real categories (clothing/cosmetics/
// accessories) -- `clothing` for the 10 brands built around garments,
// `accessories` for the 3 built around hardware/jewelry/emblems
// (Devil in Details' chains, VAISON's own geometric logo mark, ANCÓR's
// own signature anchor emblem). No SVMIKO DEGVCHI brand's real
// description centers on cosmetics specifically, so `cosmetics` is
// honestly unused here, not forced.
//
// Real, deliberately DIFFERENT pricing scale from VENVS's own physical
// flagship prices ($32-$640): virtual avatar-wearable economies price
// far lower in every real comparable (Roblox's own real items), so
// this is not the same price divided by a constant, it's a real,
// independently-reasoned virtual price scale -- while still
// preserving the same real luxury-vs-streetwear tier separation
// VENVS's own line proved (every luxury-house virtual piece prices
// above every streetwear-house virtual piece).
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
  { slug: 'degvchi', name: 'DEGVCHI Virtual Kimono-Sleeve Coat', category: 'clothing', price: 42 },
  { slug: 'lvcii', name: 'LVCII Virtual Structured Blazer', category: 'clothing', price: 32 },
  { slug: 'devil-in-details', name: 'DND Virtual Chain Wallet', category: 'accessories', price: 26 },
  { slug: 'boobi-couture', name: 'BOOBI Couture Virtual Corset Gown', category: 'clothing', price: 35 },
  { slug: 'boulevard', name: 'BLVD Virtual Gallery Hoodie', category: 'clothing', price: 14 },
  { slug: 'jacqve', name: 'JACQVÉ Virtual Silk Wrap Blouse', category: 'clothing', price: 24 },
  { slug: 'zv', name: 'ZV Virtual Essential Crewneck', category: 'clothing', price: 9 },
  { slug: 'red-veil', name: 'RED VEIL Virtual No. 33 Trench Coat', category: 'clothing', price: 38 },
  { slug: 'vedellin', name: 'VEDELLÍN Virtual Leather Field Jacket', category: 'clothing', price: 36 },
  { slug: 'vvlgar', name: 'VvLGAR Virtual Distressed Denim Jacket', category: 'clothing', price: 16 },
  { slug: 'vaison', name: '△AISON Virtual Hourglass Pendant', category: 'accessories', price: 28 },
  { slug: 'ancor', name: 'ANCÓR Virtual Anchor Pin', category: 'accessories', price: 22 },
  { slug: 'dvmb', name: 'DVMB Virtual Basic Tee', category: 'clothing', price: 6 },
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
