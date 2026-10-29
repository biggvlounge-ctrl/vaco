// Universal World Layer — EarthEnv import.
//
// EarthEnv (earthenv.org) publishes global environmental raster
// layers from peer-reviewed academic work. Two are real and distinct
// from everything else already wired in this registry:
//
//   EarthEnv-DEM90    global elevation at ~90m (3 arc-second),
//                     merging SRTM, ASTER GDEM and other sources to
//                     fill the gaps any one of them has on its own
//                     (Robinson, Regetz & Guralnick, "EarthEnv-DEM90:
//                     A nearly-global, void-free, multi-scale smoothed
//                     digital elevation model...", ISPRS Journal of
//                     Photogrammetry and Remote Sensing, 2014).
//   Consensus Land Cover   global land cover at 1km, 12 classes,
//                     built by combining four existing global land-
//                     cover products into one consensus classification
//                     (Tuanmu & Jetz, "A global, bias-corrected 1-km
//                     Consensus Land-Cover product...", Global Ecology
//                     and Biogeography, 2014).
//
// ---------------------------------------------------------------------
// Why this, alongside `usgsImport.js`
// ---------------------------------------------------------------------
// `usgsImport.js`'s own header is explicit that 3DEP is "seamless
// elevation for the whole United States" — real, free, and precise
// (1-10m), but bounded to one country. EarthEnv-DEM90 is coarser
// (~90m) and genuinely global, the same "USGS covers the U.S.
// prototype region; this is for the global tier" framing
// `openweatherImport.js` already uses against NOAA. **Deliberately
// NOT folded into the same `sources.js` field as `usgs`** — see that
// file's own note on why: unwiring either source independently has to
// still move the coverage measurement, and merging their entries
// would make `usgs` stop being able to fail that check on its own.
//
// Consensus Land Cover has no USGS, Overture or any other analogue in
// this registry at all — nothing wired here names a land-cover class
// anywhere.
//
// ---------------------------------------------------------------------
// Real, declared absence of a VACON-C consumer — same category as
// `usgsImport.js`'s own elevation import before `terrainType` existed
// to receive it
// ---------------------------------------------------------------------
// Elevation re-uses `usgsImport.classifyTerrain` and writes the same
// `locations.terrainType` field 3DEP writes, so a world with no U.S.
// coverage (or one built for a non-U.S. region, once that is a thing
// this engine does) still gets a real terrain classification rather
// than none.
//
// Land cover has no equivalent field anywhere in `locations.js` or in
// `vacon-c/server/` — checked directly (`grep -rn "forest\|landCover\|
// vegetation" vacon-c/server/*.js` returns nothing). This is a real,
// tested transform with no current VACON-C consumer, the same
// declared choice `vacon-c/CLAUDE.md`'s own thirtieth standing rule
// already made explicit for `usgsImport.js`: "wiring real data into a
// field nothing reads is the eleventh rule read backwards." Built so
// a future terrain/vegetation mechanic has a real source ready, not
// hidden as finished integration.
//
// NETWORK CONSTRAINT, checked directly against this environment's
// agent proxy status endpoint rather than assumed: `earthenv.org`
// returns a 403 CONNECT rejection ("gateway answered 403 to CONNECT
// (policy denial or upstream failure)"), the same block every other
// source host in this registry hits. `fetchEarthenvElevation` and
// `fetchEarthenvLandCover` throw with that reason; the transforms
// below are the real, tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');
const { classifyTerrain } = require('./usgsImport');

// EarthEnv-DEM90's own resolution. A separate list from 3DEP's,
// because the two products are not interchangeable at the same
// nominal number — EarthEnv publishes one resolution, not a family.
const EARTHENV_DEM_RESOLUTION_METRES = 90;

// Tuanmu & Jetz's own twelve consensus classes, named as published.
// A caller passing anything else is refused rather than guessed into
// the nearest-sounding one.
const LAND_COVER_CLASSES = [
  'evergreen-needleleaf-forest',
  'evergreen-broadleaf-forest',
  'deciduous-needleleaf-forest',
  'deciduous-broadleaf-forest',
  'mixed-forest',
  'shrubland',
  'herbaceous-vegetation',
  'cultivated-and-managed',
  'regularly-flooded-vegetation',
  'urban-and-built-up',
  'snow-and-ice',
  'barren',
];

// Elevation — the global-tier analogue of `usgsImport.importElevation`,
// re-using its own terrain classifier rather than re-deriving one.
//
// `record`: `{ elevationMetres, sample }`. **Never overwrites a real
// USGS terrainType that is already there** — 3DEP's 1-10m U.S.
// coverage is strictly finer than this 90m global layer, and silently
// replacing a precise measurement with a coarser one for the one
// country that has the precise one would be a real regression, not an
// enrichment.
function importEarthenvElevation(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importEarthenvElevation: no location with id ${locationId}`);

  // `Number(null)` is `0`, a real finite number -- the exact trap
  // `vacon-c/CLAUDE.md`'s own corollary on `Number()` already names
  // elsewhere in this ecosystem, so `null`/`undefined` are rejected
  // explicitly before coercion rather than read as "sea level".
  const rawMetres = record.elevationMetres;
  const metres = Number(rawMetres);
  if (rawMetres === null || rawMetres === undefined || !Number.isFinite(metres)) {
    throw new Error(
      'importEarthenvElevation requires a finite record.elevationMetres. EarthEnv-DEM90 '
      + 'carries a no-data value outside its coverage, and Number(null) is 0 — recording sea '
      + 'level for a point nobody measured is worse than recording nothing.',
    );
  }

  const shape = classifyTerrain(metres, record.sample);
  const existing = location.geographyData ?? {};
  const alreadyHasFinerData = existing.source === 'usgs-3dep';
  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    ...(alreadyHasFinerData
      ? {}
      : {
        source: 'earthenv-dem90',
        licence: 'free-for-research-use-citation-requested',
        elevationMetres: Math.round(metres * 10) / 10,
        resolution: EARTHENV_DEM_RESOLUTION_METRES,
        terrain: shape?.terrain ?? null,
        terrainPosition: shape?.position ?? null,
        reliefMetres: shape?.reliefMetres ?? null,
      }),
    // A real global coverage fact, even where the finer U.S. layer
    // already won the primary fields above — the two sources are not
    // mutually exclusive, only one is primary at a given point.
    earthenvElevationMetres: Math.round(metres * 10) / 10,
  });

  if (shape !== null && !alreadyHasFinerData) {
    location.terrainType = shape.terrain;
  }
  return location;
}

// Land cover — a real, tested transform with no current VACON-C
// consumer. See this file's own header for why that is a declared
// choice, not an oversight.
function importEarthenvLandCover(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importEarthenvLandCover: no location with id ${locationId}`);

  const { classKey } = record;
  if (!LAND_COVER_CLASSES.includes(classKey)) {
    throw new Error(
      `importEarthenvLandCover: "${classKey}" is not one of the twelve published Consensus `
      + `Land-Cover classes (${LAND_COVER_CLASSES.join(', ')})`,
    );
  }

  const existing = location.geographyData ?? {};
  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    landCoverClass: classKey,
    landCoverSource: 'earthenv-consensus-land-cover',
    // Tuanmu & Jetz publish a per-pixel agreement score across the
    // four input products this consensus was built from — real
    // confidence information, kept honestly null where a caller does
    // not supply it rather than assumed perfect agreement.
    landCoverAgreement: typeof record.agreement === 'number' ? record.agreement : null,
  });
  return location;
}

function describeEarthenvCoverage(worldLayer) {
  let withElevation = 0;
  let withLandCover = 0;
  const byLandCoverClass = {};
  for (const location of worldLayer.locations || []) {
    const data = location.geographyData;
    if (!data) continue;
    if (data.earthenvElevationMetres !== undefined) withElevation += 1;
    if (data.landCoverSource === 'earthenv-consensus-land-cover') {
      withLandCover += 1;
      byLandCoverClass[data.landCoverClass] = (byLandCoverClass[data.landCoverClass] ?? 0) + 1;
    }
  }
  return {
    withElevation,
    withLandCover,
    byLandCoverClass,
    total: (worldLayer.locations || []).length,
  };
}

function fetchEarthenvElevation() {
  throw new Error(
    'fetchEarthenvElevation is not implemented: earthenv.org is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, confirmed directly against the agent proxy\'s '
    + 'own status endpoint). EarthEnv-DEM90 is a direct GeoTIFF download, no key, no rate '
    + `limit. Pass { elevationMetres, sample } to importEarthenvElevation(worldLayer, `
    + 'locationId, record).',
  );
}

function fetchEarthenvLandCover() {
  throw new Error(
    'fetchEarthenvLandCover is not implemented: earthenv.org is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, confirmed directly against the agent proxy\'s '
    + 'own status endpoint). Consensus Land Cover is a direct GeoTIFF download, no key, no '
    + `rate limit. Pass { classKey, agreement } to importEarthenvLandCover(worldLayer, `
    + `locationId, record). Classes: ${LAND_COVER_CLASSES.join(', ')}.`,
  );
}

module.exports = {
  LAND_COVER_CLASSES,
  EARTHENV_DEM_RESOLUTION_METRES,
  importEarthenvElevation,
  importEarthenvLandCover,
  describeEarthenvCoverage,
  fetchEarthenvElevation,
  fetchEarthenvLandCover,
};
