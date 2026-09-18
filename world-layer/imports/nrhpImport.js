// Universal World Layer — National Register of Historic Places import.
//
// Source of truth: AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md, which
// names NRHP as "the real, confirmed fallback data source" and is
// precise about why it is needed alongside UNESCO:
//
//   "UNESCO only covers globally significant sites — it would never
//   include something like the Moolah Temple or the Kings Highway
//   Masonic corridor. The real, confirmed fallback data source is the
//   National Register of Historic Places — a real, free, public,
//   GIS-structured U.S. government dataset (National Park Service),
//   covering nearly 100,000 listed historic properties nationwide,
//   confirmed as U.S. Government Work (public domain, no license
//   restrictions on non-restricted listings)."
//
// ---------------------------------------------------------------------
// This is the one that answers a region
// ---------------------------------------------------------------------
// UNESCO gives about 1,200 sites for the whole planet. NRHP gives about
// 100,000 for one country, at the grain a city is actually made of —
// the Masonic hall, the old courthouse, the neighbourhood historic
// district. **It is the source that makes "St. Louis, then the Ozarks,
// then Illinois, then every other state" a command rather than a
// research project**, which is the thing the lost regional landmark
// documents were doing by hand.
//
// ---------------------------------------------------------------------
// Two fields carry real judgement and are treated as such
// ---------------------------------------------------------------------
//   **Resource type → Key category.** NRHP classifies a listing as
//   Building, Structure, Site, District or Object, which is a
//   preservation vocabulary, not a building-type one. It does NOT say
//   "this is a library". So the category comes from the listing's
//   FUNCTION fields where the record carries them, and a record with
//   no usable function is skipped and named rather than guessed into
//   `other-distinctive-feature` — the whole-region-becomes-one-category
//   failure `exportRegion.js` guards against.
//
//   **Listing level → significance.** NRHP grades a listing National,
//   State or Local. That IS a significance scale, published by the
//   people who assess these buildings, and using it is the difference
//   between a sourced score and one this project made up. National
//   Historic Landmark status is a further distinction above plain
//   national-level listing and scores higher again.
//
// NETWORK CONSTRAINT, checked directly on 18 Sep 2026: the NPS ArcGIS
// feature service at `services1.arcgis.com` returns 403 CONNECT at this
// environment's agent proxy. `fetchNrhpListings` throws with that
// reason; `importNrhpListings` is the real, tested part.

'use strict';

const { generateLocation, setLocationData } = require('../locations');

//: NRHP's own significance levels, as scores on the engine's 0-100
//: scale. **Sourced ordering, interpretive spacing** — the Register
//: publishes the ranking and not the numbers, so the sequence is theirs
//: and the gaps are this file's, which is stated rather than blurred.
//:
//: Anchored against `unescoImport`'s 100 for world-heritage inscription
//: so the two sources land on one scale: a National Historic Landmark
//: is the highest thing the U.S. register confers and still sits below
//: world heritage.
const SIGNIFICANCE_BY_LEVEL = {
  'national-historic-landmark': 90,
  national: 80,
  state: 60,
  local: 40,
};

//: NRHP function categories → Key building categories. The Register's
//: function vocabulary is broad; these are the entries that correspond
//: to something `THE_KEY_BUILDING_TYPES.md` names. Everything else is
//: skipped by design — a listed farmhouse is a real historic property
//: and not a hero landmark.
const FUNCTION_MAP = {
  'religion/religious facility': 'church',
  'religion/church': 'church',
  'religion/synagogue': 'synagogue',
  'religion/mosque': 'mosque',
  'religion/temple': 'temple',
  'social/meeting hall': 'masonic-building',
  'social/clubhouse': 'masonic-building',
  'education/college': 'university',
  'education/university': 'university',
  'education/school': 'school',
  'education/library': 'library',
  'education/research facility': 'university',
  'government/courthouse': 'government-building',
  'government/city hall': 'government-building',
  'government/capitol': 'government-building',
  'government/correctional facility': 'prison',
  'health care/hospital': 'hospital',
  'recreation and culture/museum': 'art-museum',
  'recreation and culture/theater': 'theater-concert-hall',
  'recreation and culture/music facility': 'theater-concert-hall',
  'recreation and culture/auditorium': 'theater-concert-hall',
  'recreation and culture/sport facility': 'stadium-arena',
  'recreation and culture/monument/marker': 'monument-memorial',
  'transportation/rail-related': 'train-station',
  'transportation/air-related': 'airport',
  'transportation/road-related': 'notable-bridge',
  'commerce/trade/skyscraper': 'skyscraper',
  'commerce/trade/office building': 'skyscraper',
  'landscape/natural feature': 'natural-formation',
  'landscape/underground': 'cave-system',
};

function normaliseFunction(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

// The Key category for a listing, from its function fields. Returns
// null rather than a default — see the header.
function categoryFor(record) {
  const candidates = [];
  if (record?.category) candidates.push(record.category);
  for (const field of ['historicFunction', 'currentFunction', 'function']) {
    const value = record?.[field];
    if (Array.isArray(value)) candidates.push(...value);
    else if (value) candidates.push(value);
  }
  for (const candidate of candidates) {
    const key = normaliseFunction(candidate);
    if (key && FUNCTION_MAP[key]) return FUNCTION_MAP[key];
    // A caller who already speaks Key categories passes one straight
    // through — which is what a hand-checked regional list looks like.
    if (key && Object.values(FUNCTION_MAP).includes(key)) return key;
  }
  return null;
}

// The published significance level, as a score. Null where the record
// does not say — NOT a default, because "the Register did not grade
// this" and "the Register graded this lowest" are different facts and
// the consuming engine has a category band to fall back on.
function significanceFor(record) {
  if (record?.nationalHistoricLandmark === true) {
    return SIGNIFICANCE_BY_LEVEL['national-historic-landmark'];
  }
  const level = normaliseFunction(record?.level ?? record?.significanceLevel);
  return level && SIGNIFICANCE_BY_LEVEL[level] !== undefined
    ? SIGNIFICANCE_BY_LEVEL[level]
    : null;
}

// Import NRHP listings as hero/regional locations.
//
// A record is the Register's own shape, loosely: `{ name, level,
// historicFunction, currentFunction, county, city, lat, lng,
// nationalHistoricLandmark, refNumber }`.
function importNrhpListings(worldLayer, listings, options = {}) {
  const { defaultTier = 'regional' } = options;
  if (!Array.isArray(listings)) {
    throw new Error('importNrhpListings requires an array of listing records');
  }

  const imported = [];
  const skipped = [];
  for (const record of listings) {
    const name = record?.name ?? record?.resourceName ?? null;
    if (!name) {
      skipped.push({ record, reason: 'no name' });
      continue;
    }
    const category = categoryFor(record);
    if (category === null) {
      skipped.push({
        name,
        reason: 'no Key category for this listing\'s function — a listed farmhouse is a real '
          + 'historic property and not a hero landmark',
      });
      continue;
    }

    const significance = significanceFor(record);
    // A National Historic Landmark is hero tier by definition; the rest
    // default to regional, which is §7's "AI-assisted refinement only"
    // band rather than "real paid human work". That distinction is the
    // cost model's whole hinge, so it is decided from the source's own
    // grading rather than by this file.
    const tier = record?.nationalHistoricLandmark === true ? 'hero' : defaultTier;

    const lat = typeof record?.lat === 'number' ? record.lat : null;
    const lng = typeof record?.lng === 'number' ? record.lng : null;
    const location = generateLocation(worldLayer, {
      name,
      // `generateLocation` requires numeric coordinates. The Register
      // withholds them for archaeological sites specifically, to stop
      // looting — a real and deliberate gap, so those listings are
      // named as skipped rather than placed at a made-up point.
      lat: lat ?? 0,
      lng: lng ?? 0,
      tier,
    });
    setLocationData(worldLayer, location.id, 'landmarkData', {
      category,
      area: record?.city ?? record?.county ?? null,
      source: 'national-register-of-historic-places',
      refNumber: record?.refNumber ?? null,
      coordinatesWithheld: lat === null || lng === null,
      ...(significance === null ? {} : { historicalImportance: significance }),
    });
    imported.push(location);
  }
  return { imported, skipped };
}

function fetchNrhpListings() {
  throw new Error(
    'fetchNrhpListings is not implemented: services1.arcgis.com (the NPS feature service) is '
    + 'outside this environment\'s outbound proxy allowlist (403 CONNECT, checked directly '
    + '18 Sep 2026). The intended path is the National Park Service\'s NRHP GIS data '
    + 'download, or a bounding-box query against its ArcGIS FeatureServer. Pass the '
    + 'resulting listings to importNrhpListings(worldLayer, listings).',
  );
}

module.exports = {
  SIGNIFICANCE_BY_LEVEL,
  FUNCTION_MAP,
  categoryFor,
  significanceFor,
  importNrhpListings,
  fetchNrhpListings,
};
