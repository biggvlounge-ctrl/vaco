// Universal World Layer — USGS Geographic Names Information System.
//
// **The naming problem, solved for a whole country, from a flat file.**
//
// ---------------------------------------------------------------------
// Why this one is worth more than its size suggests
// ---------------------------------------------------------------------
// Two of the Key's categories have no other source in the registry at
// all. UNESCO does not list a local cave; the National Register does not
// list a bluff; Overture does not carry natural features. `cave-system`
// and `natural-formation` could be generated and never named.
//
// GNIS names every summit, valley, cave, stream, bluff, church, school,
// hospital, cemetery and populated place in the United States — about
// 2.3 million of them — each with a feature class and coordinates. It is
// a U.S. Government Work, distributed as a pipe-delimited file with no
// API key and no rate limit, which makes it the cheapest fix available
// for the anonymous-landmark problem.
//
// ---------------------------------------------------------------------
// Feature class is a real taxonomy and it is used as one
// ---------------------------------------------------------------------
// GNIS classifies by FEATURE CLASS — Summit, Valley, Church, School,
// Hospital, Populated Place — which is close to what the Key asks and
// not identical to it. The map below is stated, one-way, and **a class
// it does not know is skipped and named**, never defaulted to
// `other-distinctive-feature`, for the reason every importer here
// repeats: a silent default turns a region into one category with
// nothing to show it happened.
//
// **Scale is the thing to be careful about.** A single U.S. state holds
// tens of thousands of GNIS features and most are streams and gullies.
// `importGnisFeatures` therefore takes the classes it is asked for
// rather than everything, and `describeGnisImport` reports how much was
// left behind — because an importer that silently placed 40,000 creeks
// as landmarks would be worse than one that placed none.
//
// NETWORK CONSTRAINT, checked directly: `usgs.gov` is outside this
// environment's outbound proxy allowlist (403 CONNECT). `fetchGnisFile`
// throws with that reason; the transform is the tested part.

'use strict';

const { generateLocation, setLocationData } = require('../locations');

//: GNIS feature classes → Key categories. Only classes that correspond
//: to something `THE_KEY_BUILDING_TYPES.md` names, which is deliberately
//: a small fraction of the ~60 GNIS defines.
const FEATURE_CLASS_MAP = {
  // The two categories with no other source anywhere in the registry.
  cave: 'cave-system',
  summit: 'natural-formation',
  valley: 'natural-formation',
  ridge: 'natural-formation',
  cliff: 'natural-formation',
  arch: 'natural-formation',
  island: 'natural-formation',
  falls: 'natural-formation',
  // Built features GNIS also carries. NRHP and Overture describe these
  // better where they have them; GNIS reaches the ones they miss.
  church: 'church',
  school: 'school',
  hospital: 'hospital',
  bridge: 'notable-bridge',
  // Was `other-distinctive-feature` until `park` became a real Key
  // category (26 Sep 2026, `THE_KEY_BUILDING_TYPES.md`'s implementation
  // note) — GNIS already carried this class, nothing to import twice.
  park: 'park',
  museum: 'art-museum',
  tower: 'skyscraper',
  airport: 'airport',
};

//: Classes that are places rather than landmarks — they name an AREA,
//: which is what a landmark pack's `area` field wants, not a thing to
//: stand in it. Kept separate so a town does not arrive as a monument.
const PLACE_CLASSES = ['populated place', 'civil', 'locale'];

//: Classes GNIS is full of and a world does not want one row of.
//: **Named rather than silently dropped**, because "we chose not to
//: import 40,000 creeks" and "the importer lost 40,000 creeks" are
//: different facts.
const BULK_CLASSES = ['stream', 'gut', 'spring', 'well', 'gully', 'flat', 'bend', 'basin'];

function normalise(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function categoryFor(featureClass) {
  const key = normalise(featureClass);
  return key && FEATURE_CLASS_MAP[key] ? FEATURE_CLASS_MAP[key] : null;
}

function isPlace(featureClass) {
  return PLACE_CLASSES.includes(normalise(featureClass));
}

// Import GNIS features.
//
// A record is a GNIS row, loosely: `{ featureId, featureName,
// featureClass, primaryLatitude, primaryLongitude, countyName,
// stateAlpha }`. The importer accepts the file's own column names or
// flattened equivalents.
//
// Returns locations, the place NAMES it found (usable as a landmark
// pack's `areas`), and a per-class tally of what it skipped.
function importGnisFeatures(worldLayer, records, options = {}) {
  const { classes = null } = options;
  if (!Array.isArray(records)) {
    throw new Error('importGnisFeatures requires an array of GNIS records');
  }

  const imported = [];
  const places = [];
  const skippedByClass = {};
  const tally = (featureClass) => {
    const key = normalise(featureClass) ?? 'unclassified';
    skippedByClass[key] = (skippedByClass[key] ?? 0) + 1;
  };

  for (const record of records) {
    const name = record?.featureName ?? record?.name ?? null;
    const featureClass = record?.featureClass ?? record?.class ?? null;
    const lat = Number(record?.primaryLatitude ?? record?.lat);
    const lng = Number(record?.primaryLongitude ?? record?.lng);

    if (!name) {
      tally(featureClass);
      continue;
    }
    // A place names an AREA. That is the landmark pack's `area` field,
    // not a thing to put in it.
    if (isPlace(featureClass)) {
      places.push(name);
      continue;
    }
    const category = categoryFor(featureClass);
    if (category === null) {
      tally(featureClass);
      continue;
    }
    if (classes !== null && !classes.includes(normalise(featureClass))) {
      tally(featureClass);
      continue;
    }
    // GNIS gives 0,0 for features whose coordinates were never
    // captured. **That is null island, not the Gulf of Guinea**, and
    // placing a Missouri cave there would be worse than skipping it.
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      tally(featureClass);
      continue;
    }

    const location = generateLocation(worldLayer, { name, lat, lng, tier: 'regional' });
    setLocationData(worldLayer, location.id, 'landmarkData', {
      category,
      area: record?.countyName ?? record?.county ?? null,
      source: 'usgs-gnis',
      featureId: record?.featureId ?? null,
      featureClass: normalise(featureClass),
      // **No significance.** GNIS knows a bluff is called something; it
      // has no opinion on whether it is worth remembering, and a made-up
      // score would put an invented number where the consumer expects a
      // sourced one. The category's own band is the honest fallback.
    });
    imported.push(location);
  }

  return { imported, places, skippedByClass };
}

// ---------------------------------------------------------------------
// describeGnisImport — what was left behind, and on purpose
// ---------------------------------------------------------------------
function describeGnisImport(result) {
  const skipped = Object.entries(result?.skippedByClass ?? {});
  const total = skipped.reduce((a, [, n]) => a + n, 0);
  return {
    imported: result?.imported?.length ?? 0,
    places: result?.places?.length ?? 0,
    skipped: total,
    // The classes a world genuinely does not want one row of. Separated
    // from the rest so "deliberately not imported" is visible next to
    // "not recognised".
    bulkSkipped: skipped
      .filter(([cls]) => BULK_CLASSES.includes(cls))
      .reduce((a, [, n]) => a + n, 0),
    byClass: Object.fromEntries(skipped.sort((a, b) => b[1] - a[1])),
  };
}

function fetchGnisFile() {
  throw new Error(
    'fetchGnisFile is not implemented: usgs.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly). GNIS needs no API — it is a '
    + 'pipe-delimited download (the Domestic Names national file, or a per-state extract) '
    + 'from the USGS Board on Geographic Names. Parse the rows and pass them to '
    + 'importGnisFeatures(worldLayer, records, { classes }).',
  );
}

module.exports = {
  FEATURE_CLASS_MAP,
  PLACE_CLASSES,
  BULK_CLASSES,
  categoryFor,
  isPlace,
  importGnisFeatures,
  describeGnisImport,
  fetchGnisFile,
};
