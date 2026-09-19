// Universal World Layer — Natural Earth boundary import.
//
// **The top of the boundary hierarchy, and the only one with no
// conditions attached at all.**
//
// ---------------------------------------------------------------------
// What it is and why it sits above Overture Divisions
// ---------------------------------------------------------------------
// Natural Earth is public domain — not permissive, not attribution-
// required, *public domain*, stated by its maintainers as "no permission
// needed". It publishes country, state/province and populated-place
// boundaries at three generalisations (1:10m, 1:50m, 1:110m) as
// shapefiles and GeoJSON, with no API, no key and no rate limit.
//
// `overtureDivisions` already fills `geographyData.boundaries` and is
// wired, so this is not filling an empty slot. It is the coarse end of
// the same hierarchy, and the two are complementary rather than
// redundant:
//
//   Natural Earth   country and first-order admin, generalised for
//                   display, tiny files, no conditions
//   Overture        every administrative level down to a
//                   neighbourhood, full precision, CDLA-Permissive
//
// A world that needs to know which COUNTRY a region is in, or to draw a
// map at all, wants the first. A world placing a landmark in a named
// neighbourhood wants the second. Wiring this one costs almost nothing
// and removes the case where the only boundary source carries a licence.
//
// ---------------------------------------------------------------------
// Scale is a first-class field, not a detail
// ---------------------------------------------------------------------
// The same feature exists at all three generalisations with different
// geometry, and a consumer that mixes them gets coastlines that do not
// line up. `SCALES` is the enumeration and **an unrecognised scale is
// refused** rather than defaulted — the same rule `hifldImport` applies
// to layers, for the same reason.
//
// NETWORK CONSTRAINT, checked directly: `naturalearthdata.com` is
// outside this environment's outbound proxy allowlist (403 CONNECT).
// `fetchNaturalEarth` throws with that reason; the transform is the
// tested part.

'use strict';

const { generateLocation, setLocationData, getLocation } = require('../locations');

//: Natural Earth's three published generalisations, coarse to fine.
//: `metresPerPixel` is the scale denominator's own meaning — it is what
//: decides whether two datasets can be drawn together.
const SCALES = {
  '110m': { denominator: 110000000, use: 'whole-world overview' },
  '50m': { denominator: 50000000, use: 'continental and country maps' },
  '10m': { denominator: 10000000, use: 'the finest Natural Earth publishes' },
};

const SCALE_NAMES = Object.keys(SCALES);

//: Natural Earth feature types → what the world layer calls them.
//: Deliberately short: this source is boundaries and populated places,
//: and pretending it carries more would be inventing coverage.
const FEATURE_TYPES = {
  admin0: { level: 'country', tier: 'regional' },
  admin1: { level: 'state-province', tier: 'regional' },
  populated_places: { level: 'settlement', tier: 'regional' },
};

const FEATURE_TYPE_NAMES = Object.keys(FEATURE_TYPES);

function scaleFor(scale) {
  return SCALES[scale] ?? null;
}

// Import Natural Earth features.
//
// `featureType` is a key of `FEATURE_TYPES`; `scale` a key of `SCALES`.
// `records` are the shapefile's attribute rows, flattened:
// `{ name, lat, lng, iso_a2, adm0_name, pop_max }`.
//
// **A boundary is attached to a location, not stored as geometry.** The
// world layer models places, not polygons — `locations.js` has no
// geometry field and adding one to carry a coastline would be inventing
// a shape nothing reads. What transfers is the naming and nesting: this
// place is called X, it sits inside Y, at this generalisation.
function importNaturalEarth(worldLayer, featureType, scale, records) {
  const definition = FEATURE_TYPES[featureType];
  if (!definition) {
    throw new Error(
      `importNaturalEarth: "${featureType}" is not a mapped feature type. `
      + `Known: ${FEATURE_TYPE_NAMES.join(', ')}.`,
    );
  }
  if (!scaleFor(scale)) {
    throw new Error(
      `importNaturalEarth: "${scale}" is not a Natural Earth scale. `
      + `Known: ${SCALE_NAMES.join(', ')}. The same feature exists at all three with `
      + 'different geometry, so mixing them silently produces boundaries that do not meet.',
    );
  }
  if (!Array.isArray(records)) {
    throw new Error('importNaturalEarth requires an array of feature records');
  }

  const imported = [];
  const skipped = [];
  for (const record of records) {
    const name = record?.name ?? record?.NAME ?? record?.ADMIN ?? null;
    const lat = Number(record?.lat ?? record?.LATITUDE ?? record?.latitude);
    const lng = Number(record?.lng ?? record?.LONGITUDE ?? record?.longitude);
    if (!name) {
      skipped.push({ record, reason: 'no name' });
      continue;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped.push({ name, reason: 'no usable coordinates' });
      continue;
    }

    const location = generateLocation(worldLayer, { name, lat, lng, tier: definition.tier });
    const existing = location.geographyData ?? {};
    setLocationData(worldLayer, location.id, 'geographyData', {
      ...existing,
      source: 'natural-earth',
      // **Public domain, and worth carrying on the row.** Every other
      // boundary source in the registry has conditions; a consumer
      // deciding what it may ship should not have to look them up.
      licence: 'public-domain',
      scale,
      boundaryLevel: definition.level,
      // The nesting, which is the part that actually transfers.
      containedBy: record?.adm0_name ?? record?.ADM0NAME ?? null,
      iso: record?.iso_a2 ?? record?.ISO_A2 ?? null,
      // Natural Earth's own population figure for a populated place.
      // Kept as published and never used to size a generated town —
      // that is `census`'s job and this is a map label.
      populationReported: Number.isFinite(Number(record?.pop_max))
        ? Number(record.pop_max)
        : null,
    });
    imported.push(location);
  }
  return { imported, skipped };
}

// Attach a boundary to a location that already exists — the normal case
// once Overture or NRHP has placed something and only the country or
// state it sits in is missing.
function attachBoundary(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`attachBoundary: no location with id ${locationId}`);
  if (!record.scale || !scaleFor(record.scale)) {
    throw new Error(
      'attachBoundary requires a known record.scale — see importNaturalEarth on why '
      + 'generalisation cannot be guessed.',
    );
  }
  const existing = location.geographyData ?? {};
  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    source: 'natural-earth',
    licence: 'public-domain',
    scale: record.scale,
    boundaryLevel: record.boundaryLevel ?? null,
    containedBy: record.containedBy ?? null,
    iso: record.iso ?? null,
  });
  return location;
}

function describeBoundaryCoverage(worldLayer) {
  const byLevel = {};
  let withBoundary = 0;
  for (const location of worldLayer.locations || []) {
    const data = location.geographyData;
    if (data?.source !== 'natural-earth') continue;
    withBoundary += 1;
    const level = data.boundaryLevel ?? 'unknown';
    byLevel[level] = (byLevel[level] ?? 0) + 1;
  }
  return {
    withBoundary,
    byLevel,
    total: (worldLayer.locations || []).length,
    // Locations with no boundary at all. Stated rather than left to a
    // subtraction, because "not yet imported" and "outside any boundary
    // we hold" look identical in a count.
    withoutBoundary: (worldLayer.locations || []).length - withBoundary,
  };
}

function fetchNaturalEarth() {
  throw new Error(
    'fetchNaturalEarth is not implemented: naturalearthdata.com is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly). Natural Earth '
    + 'needs no API — each theme is a direct shapefile or GeoJSON download at one of three '
    + `scales (${SCALE_NAMES.join(', ')}). Download the theme you want, read its attribute `
    + 'rows, and pass them to importNaturalEarth(worldLayer, featureType, scale, records). '
    + `Known feature types: ${FEATURE_TYPE_NAMES.join(', ')}.`,
  );
}

module.exports = {
  SCALES,
  SCALE_NAMES,
  FEATURE_TYPES,
  FEATURE_TYPE_NAMES,
  scaleFor,
  importNaturalEarth,
  attachBoundary,
  describeBoundaryCoverage,
  fetchNaturalEarth,
};
