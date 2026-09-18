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

// ---------------------------------------------------------------------
// Divisions — the neighbourhood names everything else hangs on
// ---------------------------------------------------------------------
// **This is the theme that makes a per-region import land in the right
// place.** `vacon-c/server/landmarkPacks.js` matches an imported
// landmark to a neighbourhood BY NAME — `byArea` groups on the pack's
// `area` field and `worldgen` looks for a community whose name matches.
// Those names have to come from somewhere, and until now the only
// source was somebody typing them.
//
// Overture Divisions carries real administrative boundaries at every
// level from country down to neighbourhood, so a region import produces
// its own area list instead of needing one supplied alongside.
//
// Divisions are AREAS, not points, and the world layer stores locations
// with a single lat/lng. So a division is imported at its
// representative point — which Overture ships as part of the record —
// rather than by inventing a centroid from a polygon this file would
// have to parse.

//: Overture's `subtype` values, coarsest first. The engine's own
//: hierarchy is region → city → community (`vacon-c/server/geo.js`), so
//: only the three that correspond are mapped; a continent and a country
//: are above anything VACON-C models.
const DIVISION_SUBTYPES = {
  region: 'region',
  county: 'region',
  locality: 'city',
  localadmin: 'city',
  neighborhood: 'community',
  macrohood: 'community',
  borough: 'community',
};

function divisionLevelFor(subtype) {
  const key = typeof subtype === 'string' ? subtype.trim().toLowerCase() : null;
  return key && DIVISION_SUBTYPES[key] ? DIVISION_SUBTYPES[key] : null;
}

// Import Overture Divisions as the area vocabulary for a region.
//
// Returns the area NAMES grouped by level as well as the locations,
// because the names are the deliverable: a landmark pack needs
// `areas: ['Downtown', 'Forest Park', ...]` and that list is exactly
// this.
function importOvertureDivisions(worldLayer, divisionRecords, options = {}) {
  const { levels = ['city', 'community'] } = options;
  if (!Array.isArray(divisionRecords)) {
    throw new Error('importOvertureDivisions requires an array of division records');
  }

  const imported = [];
  const skipped = [];
  const byLevel = { region: [], city: [], community: [] };

  for (const record of divisionRecords) {
    const name = record?.names?.primary ?? record?.name ?? null;
    const level = divisionLevelFor(record?.subtype);
    if (!name) {
      skipped.push({ record, reason: 'no name' });
      continue;
    }
    if (level === null) {
      // A continent or a country is above anything this engine models,
      // and an unrecognised subtype is not silently demoted to the
      // smallest level — that would put a state in a list of
      // neighbourhoods.
      skipped.push({ name, subtype: record?.subtype, reason: 'subtype is not a level this engine models' });
      continue;
    }
    if (!levels.includes(level)) {
      skipped.push({ name, reason: `level ${level} not requested` });
      continue;
    }

    byLevel[level].push(name);

    // A division is an area; the layer stores points. Overture ships a
    // representative point on the record, so it is used rather than
    // derived — deriving a centroid would mean parsing geometry this
    // file has no business parsing.
    const point = record?.representativePoint ?? record?.geometry?.coordinates ?? null;
    const lng = record?.lng ?? (Array.isArray(point) ? point[0] : null);
    const lat = record?.lat ?? (Array.isArray(point) ? point[1] : null);
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      // Kept in `byLevel` regardless — **the NAME is usable even when
      // the point is not**, and the name is what a landmark pack needs.
      skipped.push({ name, reason: 'no representative point; name still collected' });
      continue;
    }

    const location = generateLocation(worldLayer, { name, lat, lng, tier: 'filler' });
    setLocationData(worldLayer, location.id, 'geographyData', {
      level,
      subtype: record.subtype,
      source: 'overture-divisions',
      parent: record?.parentDivisionId ?? null,
    });
    imported.push(location);
  }

  return { imported, skipped, byLevel };
}

// ---------------------------------------------------------------------
// Buildings — what land_size and floors are currently drawn at random
// ---------------------------------------------------------------------
// `vacon-c/server/worldgen.js` draws a landmark's `land_size` from
// `random.range(600, 12000)` and its `floors` from the category's form
// band. Both are honest guesses in the absence of data. Overture
// Buildings carries the real footprint area, height and level count for
// global building stock.
//
// **Filler tier, and that is the point.** §7 prices filler as "fully
// automated" — houses, stores, offices, generic buildings — and filler
// is the overwhelming bulk of a city by count. A source that describes
// it completely is a source that keeps it out of the tiers that cost
// money.

//: Overture building classes → `properties.type` in the consuming
//: engine's schema enumeration. Anything unmapped stays null rather
//: than becoming `residential`, which would quietly make every
//: unclassified building a house.
const BUILDING_CLASS_MAP = {
  residential: 'residential',
  house: 'residential',
  apartments: 'residential',
  commercial: 'commercial',
  retail: 'commercial',
  office: 'commercial',
  industrial: 'industrial',
  warehouse: 'industrial',
  civic: 'government',
  government: 'government',
  school: 'government',
  hospital: 'government',
  religious: 'historical_site',
  agricultural: 'agricultural',
  barn: 'agricultural',
  farm: 'farm',
};

function propertyTypeFor(buildingClass) {
  const key = typeof buildingClass === 'string' ? buildingClass.trim().toLowerCase() : null;
  return key && BUILDING_CLASS_MAP[key] ? BUILDING_CLASS_MAP[key] : null;
}

// Import Overture Buildings as filler-tier locations carrying real
// footprint data.
//
// **Height and levels are different measurements and both are kept.**
// Overture gives `height` in metres and `numFloors` where a source
// knew it; deriving one from the other needs an assumed storey height,
// which is exactly the kind of invented constant this project keeps
// finding. A building with a height and no floor count reports that.
function importOvertureBuildings(worldLayer, buildingRecords) {
  if (!Array.isArray(buildingRecords)) {
    throw new Error('importOvertureBuildings requires an array of building records');
  }

  const imported = [];
  const skipped = [];
  for (const record of buildingRecords) {
    const coords = record?.geometry?.coordinates ?? null;
    const lng = record?.lng ?? (Array.isArray(coords) ? coords[0] : null);
    const lat = record?.lat ?? (Array.isArray(coords) ? coords[1] : null);
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      skipped.push({ record, reason: 'no usable coordinates' });
      continue;
    }

    // **Most buildings have no name and that is not a defect.**
    // `generateLocation` requires one, so an unnamed building gets a
    // stable synthetic label rather than being dropped — the footprint
    // is the value here, not the name.
    const name = record?.names?.primary ?? record?.name
      ?? `building ${lat.toFixed(5)},${lng.toFixed(5)}`;

    const location = generateLocation(worldLayer, { name, lat, lng, tier: 'filler' });
    setLocationData(worldLayer, location.id, 'buildingData', {
      source: 'overture-buildings',
      propertyType: propertyTypeFor(record?.class ?? record?.subtype),
      overtureClass: record?.class ?? null,
      // Real measurements, kept as they arrive. Null where the source
      // does not say — never a plausible default, which would be
      // indistinguishable from a measurement.
      footprintArea: typeof record?.footprintArea === 'number' ? record.footprintArea : null,
      heightMetres: typeof record?.height === 'number' ? record.height : null,
      numFloors: typeof record?.numFloors === 'number' ? record.numFloors : null,
      named: Boolean(record?.names?.primary ?? record?.name),
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

function fetchOvertureDivisions() {
  throw new Error(
    'fetchOvertureDivisions is not implemented: overturemaps.org is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). '
    + 'Use `overturemaps download --bbox=... -f geojson --type=division_area`, or a DuckDB '
    + 'query against the public buckets, and pass the records to '
    + 'importOvertureDivisions(worldLayer, divisionRecords).',
  );
}

function fetchOvertureBuildings() {
  throw new Error(
    'fetchOvertureBuildings is not implemented: overturemaps.org is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). '
    + 'Use `overturemaps download --bbox=... -f geojson --type=building` and pass the '
    + 'records to importOvertureBuildings(worldLayer, buildingRecords). Note this theme is '
    + 'large — a city is hundreds of thousands of footprints, so bound the bbox.',
  );
}

module.exports = {
  CATEGORY_MAP,
  HERO_CATEGORY_MAP,
  DIVISION_SUBTYPES,
  BUILDING_CLASS_MAP,
  categoryFor,
  divisionLevelFor,
  propertyTypeFor,
  importOverturePlaces,
  importOvertureDivisions,
  importOvertureBuildings,
  fetchOverturePlaces,
  fetchOvertureDivisions,
  fetchOvertureBuildings,
};
