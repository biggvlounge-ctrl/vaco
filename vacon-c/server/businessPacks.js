// server/businessPacks.js
//
// **Real named retail businesses, imported per region —
// `landmarkPacks.js`'s sibling for the ten retail types rather than
// the twenty-four hero ones.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `worldgen.js` places retail shops per area by drawing WITHOUT
// replacement from `landmarks.RETAIL_CATEGORIES` — a real, working
// mechanism, but every shop it places is anonymous and its category is
// the only real thing about it. `world-layer/imports/overtureImport.js`
// already turns real Overture Places records into exactly this: a
// real business name and a real category (mapped onto the same ten
// retail types), with a real area. It writes onto `landmarkData` —
// the same field `landmarks.js`'s own hero places use — but
// `exportRegion.js`'s own `KEY_CATEGORIES` only covers the hero
// vocabulary, so a retail import is never actually exported. This is
// the other half.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as `landmarkPacks.js`: no app imports `world-layer/` across
// a directory boundary (`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`). A
// pack arrives as plain JSON.
//
// ---------------------------------------------------------------------
// Matched to a community BY NAME, exactly like a landmark
// ---------------------------------------------------------------------
// Overture gives a real locality/neighbourhood name for each place —
// `landmarkPacks.byArea` groups on it, and `worldgen.js` matches it
// against a community's own `name`. Retail reuses that same match
// rather than inventing a second one: a pack's businesses are grouped
// by area, and the shop-placement loop looks up its own area's real
// businesses before falling back to the random draw.

'use strict';

const landmarks = require('./landmarks.js');

const SOURCES = ['overture-places', 'sample'];

// ---------------------------------------------------------------------
// validate — a pack is refused, never partly used
// ---------------------------------------------------------------------
function validatePack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['a pack must be an object'];
  if (!pack.region) problems.push('pack.region is required — a pack is per-region by definition');
  if (!SOURCES.includes(pack.source)) {
    problems.push(`pack.source must be one of: ${SOURCES.join(', ')}`);
  }
  if (!Array.isArray(pack.businesses) || pack.businesses.length === 0) {
    problems.push('pack.businesses must be a non-empty array');
    return problems;
  }

  pack.businesses.forEach((business, i) => {
    const where = `businesses[${i}]${business?.name ? ` (${business.name})` : ''}`;
    if (!business?.name) problems.push(`${where}: name is required`);
    if (!landmarks.RETAIL_CATEGORIES.includes(business?.category)) {
      problems.push(`${where}: "${business?.category}" is not a retail category`);
    }
    const hasLat = business?.lat !== undefined && business?.lat !== null;
    const hasLng = business?.lng !== undefined && business?.lng !== null;
    if (hasLat !== hasLng) problems.push(`${where}: lat and lng must be given together`);
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`business pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.businessPack ?? null;
}

// Group a pack's businesses by the area they belong to — same shape
// as `landmarkPacks.byArea`.
function byArea(pack) {
  const out = new Map();
  for (const business of pack.businesses) {
    const key = business.area ?? null;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(business);
  }
  return out;
}

// The real businesses for a named area, or an empty array when the
// pack has none for it — the caller's own random draw is the
// fallback, not this module's.
function businessesForArea(pack, areaName) {
  if (!pack) return [];
  return byArea(pack).get(areaName) ?? [];
}

module.exports = {
  SOURCES,
  validatePack,
  assertPack,
  packFor,
  byArea,
  businessesForArea,
};
