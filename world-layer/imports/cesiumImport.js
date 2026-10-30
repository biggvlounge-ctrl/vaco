// Universal World Layer — Cesium OSM Buildings import.
//
// Cesium OSM Buildings is a real, free, global 3D building dataset —
// ~350 million buildings, streamed as 3D Tiles from a public Cesium
// ion asset, built from OpenStreetMap's own building footprints and
// height/level tags. `sources.js`'s own `cesiumBuildings` entry
// already names the real consumers for this: `worldgen.js`'s
// `landSize` (currently `random.range(600, 12000)`) and `property.js`'s
// floor count / `landmarks.js`'s skyscraper classification — the same
// two fields `overtureImport.importOvertureBuildings` already feeds,
// listed alongside it in `sources.js`'s own `SLICE_FIELDS` as
// alternate sources for the same two facts.
//
// ---------------------------------------------------------------------
// Real, and genuinely redundant with Overture — stated plainly,
// per `sources.js`'s own precedent for exactly this situation
// ---------------------------------------------------------------------
// Overture Buildings is largely sourced FROM OpenStreetMap itself
// (`openstreetmap`'s own `sources.js` note says so directly), so this
// is not a second, independent measurement of the same building —
// it is frequently the same underlying OSM tag, reached a different
// way. `sources.js`'s own header on `licenceReviewOrder` already
// states the general rule: "redundant does not mean worthless... both
// are cheap to keep." Built anyway because it is the one entry in
// this registry explicitly marked `wired: null` with a real, named
// consumer waiting, and because `overtureImport.js`'s own
// `importOvertureBuildings` reuses this exact vocabulary (`BUILDING_CLASS_MAP`/
// `propertyTypeFor`) for the identical reason: OSM's `building=*` tag
// values are the one real source vocabulary underneath both.
//
// ---------------------------------------------------------------------
// A height that renders is not a height that was measured, and this
// file does not let the two blur
// ---------------------------------------------------------------------
// Cesium's own public documentation for this tileset states that a
// building with no real OSM `height` or `building:levels` tag is
// still extruded to a default visual height so the 3D scene has no
// invisible flat buildings — a real, deliberate rendering choice, and
// a real trap for an importer that reads the tile's rendered height
// as a measurement. `importCesiumBuildings` therefore requires the
// caller to say explicitly whether a given building's height came
// from a real OSM tag (`heightIsMeasured: true`) or from that default
// extrusion (`false`) — never inferred from the tile alone, which this
// module cannot inspect from pre-fetched records. An unmeasured height
// is still recorded (useful for a rendered scene), but flagged, never
// presented at the same confidence as a real Overture or Cesium tag
// value.
//
// NETWORK CONSTRAINT, checked directly against this environment's
// agent proxy status endpoint: `api.cesium.com`, `ion.cesium.com` and
// `assets.ion.cesium.com` all return a 403 CONNECT rejection — the
// same block most other source hosts in this registry hit (unlike
// `earthEngineImport.js`'s own host, which is reachable). Separately,
// and checked against `sources.js`'s own `cesiumBuildings` entry: this
// source also requires a real Cesium ion access token, which this
// environment does not have configured, though one CAN be added as a
// network secret / environment variable in this cloud environment's
// own settings. `fetchCesiumBuildings` throws naming both real facts.

'use strict';

const { generateLocation, setLocationData } = require('../locations');
const { propertyTypeFor } = require('./overtureImport');

// Import Cesium OSM Buildings records as filler-tier locations.
//
// `record`: `{ lat, lng, name?, osmBuildingTag?, footprintArea?,
// heightMetres?, heightIsMeasured?, numFloors? }`. `heightIsMeasured`
// defaults to `false` on purpose — see this file's own header — so a
// caller who forgets to check it gets the honest, conservative answer
// rather than a silently-trusted default extrusion.
function importCesiumBuildings(worldLayer, buildingRecords) {
  if (!Array.isArray(buildingRecords)) {
    throw new Error('importCesiumBuildings requires an array of building records');
  }

  const imported = [];
  const skipped = [];
  for (const record of buildingRecords) {
    const lat = typeof record?.lat === 'number' ? record.lat : null;
    const lng = typeof record?.lng === 'number' ? record.lng : null;
    if (lat === null || lng === null) {
      skipped.push({ record, reason: 'no usable coordinates' });
      continue;
    }

    // Most buildings in this tileset have no name, same real property
    // `overtureImport.importOvertureBuildings` already states for the
    // same reason — the footprint is the value, not the name.
    const name = record?.name ?? `building ${lat.toFixed(5)},${lng.toFixed(5)}`;
    const heightIsMeasured = record?.heightIsMeasured === true;

    const location = generateLocation(worldLayer, { name, lat, lng, tier: 'filler' });
    setLocationData(worldLayer, location.id, 'buildingData', {
      source: 'cesium-osm-buildings',
      licence: 'odbl-attribution-required',
      propertyType: propertyTypeFor(record?.osmBuildingTag),
      osmBuildingTag: record?.osmBuildingTag ?? null,
      footprintArea: typeof record?.footprintArea === 'number' ? record.footprintArea : null,
      heightMetres: typeof record?.heightMetres === 'number' ? record.heightMetres : null,
      // Never inferred — real only when the caller states it is, the
      // same "Number(null) is not a real zero" discipline this
      // ecosystem holds everywhere else, applied to a confidence flag
      // instead of a number.
      heightIsMeasured,
      numFloors: typeof record?.numFloors === 'number' ? record.numFloors : null,
      named: Boolean(record?.name),
    });
    imported.push(location);
  }
  return { imported, skipped };
}

function describeCesiumCoverage(worldLayer) {
  let withData = 0;
  let withMeasuredHeight = 0;
  for (const location of worldLayer.locations || []) {
    const data = location.buildingData;
    if (data?.source !== 'cesium-osm-buildings') continue;
    withData += 1;
    if (data.heightIsMeasured) withMeasuredHeight += 1;
  }
  return {
    withData,
    withMeasuredHeight,
    withDefaultExtrusionOnly: withData - withMeasuredHeight,
    total: (worldLayer.locations || []).length,
  };
}

function fetchCesiumBuildings() {
  throw new Error(
    'fetchCesiumBuildings is not implemented: api.cesium.com, ion.cesium.com and '
    + 'assets.ion.cesium.com are all outside this environment\'s outbound proxy allowlist '
    + '(403 CONNECT, confirmed directly against the agent proxy\'s own status endpoint). '
    + 'Separately, this source also requires a real Cesium ion access token, which is not '
    + 'configured here -- one can be added as a network secret / environment variable in '
    + 'this cloud environment\'s own settings. With both in place, the real access path is '
    + "Cesium ion's REST API or the 3D Tiles client against the public \"Cesium OSM "
    + 'Buildings" asset. Pass { lat, lng, osmBuildingTag, footprintArea, heightMetres, '
    + 'heightIsMeasured, numFloors } to importCesiumBuildings(worldLayer, buildingRecords).',
  );
}

module.exports = {
  importCesiumBuildings,
  describeCesiumCoverage,
  fetchCesiumBuildings,
};
