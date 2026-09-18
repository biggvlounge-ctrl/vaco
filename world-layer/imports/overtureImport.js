// Universal World Layer — Overture Maps Places import.
//
// Source of truth: OVERTURE_MAPS_DATASET_UPDATED_COST_SAVINGS.md —
// "real business/POI and administrative boundary data", CDLA-Permissive
// v2, 3.7-4.2 billion features, with the Places theme feeding "directly
// into the existing Retail Key Location system".
//
// ---------------------------------------------------------------------
// This is the cost claim, made checkable
// ---------------------------------------------------------------------
// That document credits Overture with "roughly 10-15% further reduction
// specifically on the content-population portion" of the regional and
// world figures. **Nothing in the repository could have produced that
// number or checked it**, because no importer existed — the saving was
// reasoning about a source, not a measurement of one.
//
// It is a reasonable claim and this is what makes it real: every one of
// `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md`'s ten store types maps onto an
// Overture Places category, so a region's hardware stores, pharmacies
// and groceries come down as real named businesses at real addresses
// instead of being drawn from a band. `costModel.automationCoverage`
// counts what that covers.
//
// ---------------------------------------------------------------------
// The mapping is the whole file, and it goes one way on purpose
// ---------------------------------------------------------------------
// Overture's category taxonomy is large and ours is ten. A many-to-one
// map is honest; the reverse would be inventing categories Overture
// does not have. **A place whose category we do not recognise is
// skipped and named**, never defaulted — the same rule
// `exportRegion.js` follows, and for the same reason: a silent default
// turns a whole city into one category with nothing to show it
// happened.
//
// NETWORK CONSTRAINT, checked directly on 18 Sep 2026 rather than
// assumed: `overturemaps.org` returns 403 CONNECT at this environment's
// agent proxy, as do every other source host. `fetchOverturePlaces`
// below therefore throws, exactly as `unescoImport.fetchUnescoSites`
// does and for the same reason. `importOverturePlaces` — the real,
// tested part — does not care where the records came from.

'use strict';

const { generateLocation, setLocationData } = require('../locations');

// Overture Places categories → the retail Key location types in
// `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md`. Overture's primary category
// strings are dotted paths; the left side here is matched against the
// primary category and its prefixes, so `hardware.paint_store` finds
// `hardware`.
//
// **Ten types in, ten types out.** The document's list is closed, so
// this map is complete rather than a sample — and the test asserts
// every one of the ten is reachable, because a store type no category
// maps to is a store type that never appears in an imported region.
const CATEGORY_MAP = {
  hardware: 'hardware-store',
  home_improvement: 'hardware-store',
  clothing_store: 'clothing-store',
  fashion: 'clothing-store',
  grocery_store: 'grocery-store',
  supermarket: 'grocery-store',
  pharmacy: 'pharmacy',
  drugstore: 'pharmacy',
  sporting_goods: 'sporting-goods-store',
  outdoor_sports: 'sporting-goods-store',
  electronics: 'electronics-store',
  computers: 'electronics-store',
  auto_parts: 'auto-parts-store',
  car_parts: 'auto-parts-store',
  bookstore: 'bookstore',
  books: 'bookstore',
  gun_shop: 'gun-store',
  firearms: 'gun-store',
  department_store: 'department-store',
  shopping_center: 'department-store',
};

// Hero-tier categories Overture also carries. Kept separate from the
// retail map because they land in a different tier and a different part
// of the cost model — §7 prices hero work and does not price filler.
const HERO_CATEGORY_MAP = {
  hospital: 'hospital',
  university: 'university',
  college: 'university',
  school: 'school',
  library: 'library',
  museum: 'art-museum',
  art_museum: 'art-museum',
  zoo: 'zoo-aquarium',
  aquarium: 'zoo-aquarium',
  stadium: 'stadium-arena',
  arena: 'stadium-arena',
  airport: 'airport',
  train_station: 'train-station',
  church: 'church',
  mosque: 'mosque',
  synagogue: 'synagogue',
  temple: 'temple',
  theatre: 'theater-concert-hall',
  performing_arts: 'theater-concert-hall',
  prison: 'prison',
};

// Overture gives a dotted primary category. Try the whole string, then
// progressively shorter prefixes, so a taxonomy that grows deeper does
// not stop matching.
function categoryFor(primary) {
  if (typeof primary !== 'string' || primary.length === 0) return null;
  const parts = primary.split('.');
  for (let i = parts.length; i > 0; i -= 1) {
    const candidate = parts.slice(0, i).join('.');
    if (HERO_CATEGORY_MAP[candidate]) return { category: HERO_CATEGORY_MAP[candidate], tier: 'regional' };
    if (CATEGORY_MAP[candidate]) return { category: CATEGORY_MAP[candidate], tier: 'filler' };
  }
  // And the last segment on its own, since Overture's leaves are the
  // specific part: `eat_and_drink.restaurant.pizza` → `pizza`.
  const leaf = parts[parts.length - 1];
  if (HERO_CATEGORY_MAP[leaf]) return { category: HERO_CATEGORY_MAP[leaf], tier: 'regional' };
  if (CATEGORY_MAP[leaf]) return { category: CATEGORY_MAP[leaf], tier: 'filler' };
  return null;
}

// Import Overture Places records as locations.
//
// A record is Overture's own shape, flattened: `{ names: { primary },
// categories: { primary }, geometry: { coordinates: [lng, lat] },
// addresses: [{ locality, region }] }`. The importer accepts either
// that or an already-flattened `{ name, category, lat, lng, area }`,
// because a caller who has run the CLI and a caller who has run a
// GeoParquet query hold slightly different objects and neither should
// have to reshape by hand.
function importOverturePlaces(worldLayer, placeRecords, options = {}) {
  const { tiers = ['regional', 'filler'] } = options;
  if (!Array.isArray(placeRecords)) {
    throw new Error('importOverturePlaces requires an array of place records');
  }

  const imported = [];
  const skipped = [];
  for (const record of placeRecords) {
    const name = record?.names?.primary ?? record?.name ?? null;
    const primary = record?.categories?.primary ?? record?.category ?? null;
    const coords = record?.geometry?.coordinates ?? null;
    const lng = record?.lng ?? (Array.isArray(coords) ? coords[0] : null);
    const lat = record?.lat ?? (Array.isArray(coords) ? coords[1] : null);
    const area = record?.area ?? record?.addresses?.[0]?.locality ?? null;

    if (!name) {
      skipped.push({ record, reason: 'no name' });
      continue;
    }
    const match = categoryFor(primary);
    if (match === null) {
      // Overture carries every kind of business on earth and we model
      // ten store types and twenty-four landmarks. Most places are
      // legitimately not either, so this is the common path, not an
      // error — but it is counted, so a region that imported 40,000
      // rows and placed 300 says so.
      skipped.push({ name, category: primary, reason: 'category is not a Key location type' });
      continue;
    }
    if (!tiers.includes(match.tier)) {
      skipped.push({ name, category: primary, reason: `tier ${match.tier} not requested` });
      continue;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      skipped.push({ name, reason: 'no usable coordinates' });
      continue;
    }

    const location = generateLocation(worldLayer, { name, lat, lng, tier: match.tier });
    setLocationData(worldLayer, location.id, 'landmarkData', {
      category: match.category,
      area,
      source: 'overture-places',
      // No significance. **Overture knows a business exists; it does
      // not know what it is worth remembering**, and inventing a score
      // here would put a made-up number where `landmarkPacks` expects a
      // sourced one. The consuming engine falls back to the category's
      // own band, which is the honest answer.
    });
    setLocationData(worldLayer, location.id, 'businessData', {
      overtureCategory: primary,
      confidence: record?.confidence ?? null,
    });
    imported.push(location);
  }
  return { imported, skipped };
}

function fetchOverturePlaces() {
  throw new Error(
    'fetchOverturePlaces is not implemented: overturemaps.org is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). Overture is '
    + 'distributed as GeoParquet rather than a REST API in any case — the intended path is '
    + 'the `overturemaps` CLI (`overturemaps download --bbox=... -f geojson --type=place`) '
    + 'or a DuckDB query against the public S3/Azure buckets. Pass the resulting records to '
    + 'importOverturePlaces(worldLayer, placeRecords).',
  );
}

module.exports = {
  CATEGORY_MAP,
  HERO_CATEGORY_MAP,
  categoryFor,
  importOverturePlaces,
  fetchOverturePlaces,
};
