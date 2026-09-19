// Universal World Layer — USGS 3DEP elevation import.
//
// **The one physical fact about a place that the engine asks for and
// nothing has ever supplied.**
//
// ---------------------------------------------------------------------
// What it closes
// ---------------------------------------------------------------------
// `locations.generateLocation` takes a `terrainType` and every caller
// in this repository passes `null`. `vacon-c/server/geo.js` models
// distance and terrain, and a generated world draws its terrain from
// nothing at all — so every place in every world is equally flat, and
// two neighbourhoods separated by a bluff are as close as two on the
// same street.
//
// 3DEP publishes seamless elevation for the whole United States at 1, 3
// and 10 metre resolution as a U.S. Government Work: public domain, no
// key, no rate limit. It is the cheapest possible fix for a field that
// has been accepted-and-never-written since the world layer was built.
//
// ---------------------------------------------------------------------
// Elevation is a number; terrain is a judgement, and it is made here
// once and openly
// ---------------------------------------------------------------------
// A consumer wants "is this a valley or a ridge", not "is this 142.7
// metres". That classification needs the SURROUNDING elevations, not
// the point's own — 142 metres is a mountain in Florida and a ditch in
// Colorado — so `classifyTerrain` takes a sample's relief and relative
// position rather than an absolute height.
//
// **The thresholds are stated as interpretive and centred on the sample
// rather than on a global scale**, which is CLAUDE.md's twelfth rule:
// a classification centred on an absolute would recalibrate every world
// built anywhere other than where the numbers were chosen.
//
// NETWORK CONSTRAINT, checked directly: `usgs.gov` is outside this
// environment's outbound proxy allowlist (403 CONNECT). `fetchElevation`
// throws with that reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: 3DEP's published resolutions, in metres per cell. A consumer mixing
//: them gets relief that changes with the dataset rather than with the
//: ground, so the resolution is carried on the row.
const RESOLUTIONS = [1, 3, 10, 30];

//: How much a sample has to rise and fall before it is called
//: something. **Relief, not height** — the span between the lowest and
//: highest point in the sample, in metres.
//:
//: Flagged interpretive. No document sets these, and they are chosen
//: against what the words mean on the ground rather than against a
//: scale: under ten metres of relief is flat by any reading, and two
//: hundred metres across a neighbourhood is genuinely steep. A world
//: whose sample is all within a few metres classifies as `flat`, which
//: is the honest answer for a floodplain.
const RELIEF_BANDS = [
  { max: 10, terrain: 'flat' },
  { max: 60, terrain: 'rolling' },
  { max: 200, terrain: 'hilly' },
  { max: Infinity, terrain: 'mountainous' },
];

//: Where a point sits within its own sample's range, which is what
//: separates a summit from the valley below it at the same relief.
const POSITION_BANDS = [
  { max: 0.25, position: 'valley' },
  { max: 0.75, position: 'slope' },
  { max: Infinity, position: 'ridge' },
];

function bandFor(bands, value, key) {
  for (const band of bands) if (value <= band.max) return band[key];
  return bands[bands.length - 1][key];
}

// Classify terrain from a sample of elevations around a point.
//
// `elevations` are metres, the point's own included. Returns null for a
// sample too small to say anything — **one reading is a height, not a
// terrain**, and returning `flat` for it would be the `Number(null)`
// corollary in a new place: unknown relief reported as no relief.
function classifyTerrain(elevationMetres, elevations) {
  if (!Array.isArray(elevations) || elevations.length < 3) return null;
  const usable = elevations.map(Number).filter(Number.isFinite);
  if (usable.length < 3) return null;

  const low = Math.min(...usable);
  const high = Math.max(...usable);
  const relief = high - low;
  const point = Number(elevationMetres);
  if (!Number.isFinite(point)) return null;

  // Where the point sits in its own sample, 0 at the lowest and 1 at
  // the highest. A sample with no relief has no position within it, so
  // it is the middle by definition rather than by a divide-by-zero.
  const position = relief === 0 ? 0.5 : (point - low) / relief;

  return {
    terrain: bandFor(RELIEF_BANDS, relief, 'terrain'),
    position: bandFor(POSITION_BANDS, position, 'position'),
    reliefMetres: Math.round(relief * 10) / 10,
    lowestMetres: Math.round(low * 10) / 10,
    highestMetres: Math.round(high * 10) / 10,
  };
}

// Attach elevation to a location.
//
// `record`: `{ elevationMetres, sample, resolution }` — `sample` is the
// surrounding elevations that make a terrain classification possible,
// and is optional. Without it the elevation is still recorded and
// `terrain` is null, which is the honest split: the height is measured,
// the shape is not.
function importElevation(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importElevation: no location with id ${locationId}`);

  const metres = Number(record.elevationMetres);
  if (!Number.isFinite(metres)) {
    throw new Error(
      'importElevation requires a finite record.elevationMetres. 3DEP returns a no-data '
      + 'value outside its coverage, and Number(null) is 0 — recording sea level for a '
      + 'point nobody measured is worse than recording nothing.',
    );
  }
  if (record.resolution !== undefined && !RESOLUTIONS.includes(Number(record.resolution))) {
    throw new Error(
      `importElevation: ${record.resolution} is not a 3DEP resolution `
      + `(${RESOLUTIONS.join(', ')} metres). Relief measured at different resolutions is not `
      + 'comparable, so the resolution cannot be guessed.',
    );
  }

  const shape = classifyTerrain(metres, record.sample);
  const existing = location.geographyData ?? {};
  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    source: 'usgs-3dep',
    licence: 'public-domain',
    elevationMetres: Math.round(metres * 10) / 10,
    resolution: record.resolution ?? null,
    terrain: shape?.terrain ?? null,
    terrainPosition: shape?.position ?? null,
    reliefMetres: shape?.reliefMetres ?? null,
  });

  // **`locations.terrainType` is the field that was accepted and never
  // written.** Setting it is the whole point of this importer, and it
  // stays null where the sample could not support a classification.
  if (shape !== null) location.terrainType = shape.terrain;
  return location;
}

function describeElevationCoverage(worldLayer) {
  const byTerrain = {};
  let withElevation = 0;
  let withTerrain = 0;
  for (const location of worldLayer.locations || []) {
    const data = location.geographyData;
    if (data?.source !== 'usgs-3dep') continue;
    withElevation += 1;
    if (data.terrain) {
      withTerrain += 1;
      byTerrain[data.terrain] = (byTerrain[data.terrain] ?? 0) + 1;
    }
  }
  return {
    withElevation,
    // **Separated on purpose.** A height with no sample around it is
    // half the import, and counting it as terrain coverage would be the
    // twentieth rule — a number vouching for something it does not
    // establish.
    withTerrain,
    heightOnly: withElevation - withTerrain,
    byTerrain,
    total: (worldLayer.locations || []).length,
  };
}

function fetchElevation() {
  throw new Error(
    'fetchElevation is not implemented: usgs.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly). 3DEP is reachable two ways with no '
    + 'key: the National Map point query service for single coordinates, or a seamless '
    + 'GeoTIFF download for a region, which is what you want for a sample. Pass '
    + '{ elevationMetres, sample, resolution } to importElevation(worldLayer, locationId, '
    + `record). Resolutions: ${RESOLUTIONS.join(', ')} metres.`,
  );
}

module.exports = {
  RESOLUTIONS,
  RELIEF_BANDS,
  POSITION_BANDS,
  classifyTerrain,
  importElevation,
  describeElevationCoverage,
  fetchElevation,
};
