// Universal World Layer — Wikidata and Wikimedia Commons import.
//
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md §8, which
// names Wikidata as "genuinely valuable: real, structured historical
// entities, people, organizations, and locations, free and open".
//
// ---------------------------------------------------------------------
// The picture half, and why it is a cost item rather than a nicety
// ---------------------------------------------------------------------
// §7 prices Tier 1 as "real, paid human work" — an artist modelling the
// Cathedral Basilica or the Old Courthouse. **Reference gathering is
// part of what that money buys**, and it is the part a dataset can do
// for free: a Wikidata entity carries a P18 image claim pointing at a
// freely licensed Wikimedia Commons photograph of the actual building.
// At the hero rate on file ($350-$800 a location) across ~1,200 hero
// locations, the reference-gathering slice is not a rounding error.
//
// **Wikimedia Commons is not named in any document on file.** It is
// added here under `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`
// — "actively check whether better tools exist... flag directly with
// reasoning" — and this paragraph is the flag rather than a quiet
// substitution. Wikidata was already named and Commons is the image
// store it points into, so this is following an existing thread rather
// than opening a new one.
//
// ---------------------------------------------------------------------
// Licensing: per FILE, not per collection, and it matters
// ---------------------------------------------------------------------
// Wikidata itself is CC0 — no conditions at all, the cleanest licence
// of any source in `sources.js`. **Commons is not.** Each file carries
// its own: CC0, CC-BY, CC-BY-SA or public domain, and the share-alike
// and attribution ones bind the shipped product, not the build. So
// every image imported here carries ITS OWN licence string, and
// `unlicensedImages` counts the ones that arrived without one. An
// image with no stated licence is not a free image; it is an unknown,
// and shipping it as if it were free is how a licence problem is found
// by somebody else.
//
// NETWORK CONSTRAINT, checked directly on 18 Sep 2026: both
// `query.wikidata.org` and `commons.wikimedia.org` return 403 CONNECT
// at this environment's agent proxy. The fetch functions throw with
// that reason; the transforms are the real, tested part.

'use strict';

const { generateLocation, setLocationData, getLocation } = require('../locations');

//: Licences Commons files actually carry, and whether using one puts a
//: condition on the shipped product. **This is the field that decides
//: whether a picture is free or merely free-to-download.**
const IMAGE_LICENCES = {
  cc0: { attribution: false, shareAlike: false },
  'public-domain': { attribution: false, shareAlike: false },
  'cc-by': { attribution: true, shareAlike: false },
  'cc-by-sa': { attribution: true, shareAlike: true },
};

//: Wikidata heritage-status claims → a significance score on the
//: engine's 0-100 scale, anchored to the same ladder
//: `unescoImport` and `nrhpImport` use so all three sources land
//: comparably. Sourced ordering, interpretive spacing — as in
//: `nrhpImport`, and said the same way.
const STATUS_SIGNIFICANCE = {
  'world-heritage-site': 100,
  'national-historic-landmark': 90,
  'national-heritage': 80,
  'state-heritage': 60,
  'local-heritage': 40,
};

function licenceOf(image) {
  const key = typeof image?.licence === 'string' ? image.licence.trim().toLowerCase() : null;
  return key && IMAGE_LICENCES[key] ? key : null;
}

// What a picture obliges you to do. Null for an image whose licence is
// missing or unrecognised — see the header: unknown is not free.
function obligationsFor(image) {
  const key = licenceOf(image);
  return key === null ? null : { licence: key, ...IMAGE_LICENCES[key] };
}

function significanceFor(record) {
  const status = typeof record?.heritageStatus === 'string'
    ? record.heritageStatus.trim().toLowerCase()
    : null;
  return status && STATUS_SIGNIFICANCE[status] !== undefined
    ? STATUS_SIGNIFICANCE[status]
    : null;
}

// Import Wikidata entities as locations.
//
// A record is a flattened SPARQL binding: `{ qid, name, category, lat,
// lng, heritageStatus, inception, area, image: { file, url, licence,
// author } }`. `category` must already be a Key category — Wikidata's
// `instance of` taxonomy is enormous and mapping it belongs in the
// SPARQL query, where a person can see and adjust it, not buried here.
function importWikidataEntities(worldLayer, records, options = {}) {
  const { defaultTier = 'regional' } = options;
  if (!Array.isArray(records)) {
    throw new Error('importWikidataEntities requires an array of entity records');
  }

  const imported = [];
  const skipped = [];
  for (const record of records) {
    const name = record?.name ?? null;
    if (!name) {
      skipped.push({ record, reason: 'no name' });
      continue;
    }
    if (!record?.category) {
      skipped.push({
        name,
        reason: 'no Key category — map Wikidata\'s "instance of" in the SPARQL query, '
          + 'where it is visible, rather than here',
      });
      continue;
    }
    const lat = typeof record.lat === 'number' ? record.lat : null;
    const lng = typeof record.lng === 'number' ? record.lng : null;
    if (lat === null || lng === null) {
      skipped.push({ name, reason: 'no coordinates' });
      continue;
    }

    const significance = significanceFor(record);
    const location = generateLocation(worldLayer, {
      name, lat, lng, tier: record.tier ?? defaultTier,
    });
    setLocationData(worldLayer, location.id, 'landmarkData', {
      category: record.category,
      area: record.area ?? null,
      source: 'wikidata',
      qid: record.qid ?? null,
      inception: record.inception ?? null,
      ...(significance === null ? {} : { historicalImportance: significance }),
    });
    if (record.image) attachImage(worldLayer, location.id, record.image);
    imported.push(location);
  }
  return { imported, skipped };
}

// Attach a reference picture to a location already in the layer.
//
// Separate from the entity import because the two arrive separately in
// practice: you import a region's landmarks from NRHP or Overture, then
// go looking for pictures of them. A location imported from ANY source
// can take an image.
function attachImage(worldLayer, locationId, image) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`attachImage: no location with id ${locationId}`);
  if (!image?.url && !image?.file) {
    throw new Error('attachImage requires an image with a url or a Commons file name');
  }

  const existing = location.landmarkData ?? {};
  const obligations = obligationsFor(image);
  setLocationData(worldLayer, locationId, 'landmarkData', {
    ...existing,
    image: {
      file: image.file ?? null,
      url: image.url ?? null,
      author: image.author ?? null,
      // **The licence as given, kept even when unrecognised.** Dropping
      // an unknown licence would make an unknown look like an absence,
      // and `describeImages` needs to count them.
      licence: image.licence ?? null,
      obligations,
    },
  });
  return location;
}

// ---------------------------------------------------------------------
// describeImages — the licence position, countable
// ---------------------------------------------------------------------
// Three numbers somebody shipping this needs and could not get before:
// how many locations have reference art, how many of those oblige
// attribution, and how many carry a licence nobody can identify.
function describeImages(worldLayer) {
  const withImage = (worldLayer.locations || []).filter((l) => l.landmarkData?.image);
  const unlicensed = withImage.filter((l) => l.landmarkData.image.obligations === null);
  const attribution = withImage.filter((l) => l.landmarkData.image.obligations?.attribution);
  const shareAlike = withImage.filter((l) => l.landmarkData.image.obligations?.shareAlike);
  return {
    locations: (worldLayer.locations || []).length,
    withImage: withImage.length,
    // Not free — unknown. The distinction this whole file insists on.
    unlicensedImages: unlicensed.map((l) => l.name),
    requiringAttribution: attribution.length,
    requiringShareAlike: shareAlike.length,
  };
}

function fetchWikidataEntities() {
  throw new Error(
    'fetchWikidataEntities is not implemented: query.wikidata.org is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). '
    + 'The intended path is a SPARQL query selecting ?item ?itemLabel ?coord ?image with an '
    + 'instance-of filter and a wikibase:around service call for the region, then mapping '
    + 'instance-of to Key categories IN THE QUERY. Pass the bindings to '
    + 'importWikidataEntities(worldLayer, records).',
  );
}

function fetchCommonsImages() {
  throw new Error(
    'fetchCommonsImages is not implemented: commons.wikimedia.org is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). '
    + 'The intended path is the Commons API imageinfo endpoint with '
    + 'iiprop=url|extmetadata, which returns the per-file licence — pass each result to '
    + 'attachImage(worldLayer, locationId, image) with that licence, never a collection-wide '
    + 'assumption.',
  );
}

module.exports = {
  IMAGE_LICENCES,
  STATUS_SIGNIFICANCE,
  licenceOf,
  obligationsFor,
  significanceFor,
  importWikidataEntities,
  attachImage,
  describeImages,
  fetchWikidataEntities,
  fetchCommonsImages,
};
