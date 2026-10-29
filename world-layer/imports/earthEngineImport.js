// Universal World Layer — Google Earth Engine import (VIIRS nighttime
// lights).
//
// Earth Engine is Google's cloud geospatial analysis platform, not a
// dataset of its own — it hosts a catalog of satellite imagery and
// derived products (Landsat, Sentinel, MODIS, and others) and lets a
// caller run analysis over any of it via a Python/JS/REST API. The
// real, distinct product pulled through it here is NOAA/NASA's VIIRS
// Day/Night Band (DNB) monthly cloud-free composite — global
// nighttime-light radiance, no gaps, no national boundary.
//
// ---------------------------------------------------------------------
// Why nighttime lights, and why this is a real economic signal rather
// than a picture
// ---------------------------------------------------------------------
// Nighttime light radiance is one of the most-cited proxies for local
// economic activity in development economics, specifically because it
// is measured identically everywhere on Earth regardless of whether a
// government publishes a census or a labour survey (Henderson,
// Storeygard & Weil, "Measuring Economic Growth from Outer Space",
// American Economic Review, 2012; Chen & Nordhaus, "Using Luminosity
// Data as a Proxy for Economic Statistics", PNAS, 2011). `censusImport.js`
// and `blsImport.js` already give this registry real economic data —
// for the United States only. This is the one source here that could
// genuinely answer the same question anywhere on Earth, the same
// "global tier" framing `openweatherImport.js` and `earthenvImport.js`
// already use against their own U.S.-only counterparts.
//
// **No current VACON-C consumer** — `economicData.nightLights` has no
// reader anywhere in `vacon-c/server/`, the same declared-choice
// category as `usgsImport.js`'s elevation import before `terrainType`
// existed, and `earthenvImport.js`'s land cover. Built as a real,
// tested transform; wiring it into an actual economic mechanic is a
// future round with its own calibration question (how a radiance
// figure should move a generated economy), the same caution this
// registry's own history holds for every real multiplier that feeds a
// calibrated mechanism rather than reporting a plain fact.
//
// ---------------------------------------------------------------------
// This source's real gap is NOT the network block every other source
// in this registry hits — checked directly, and the difference
// matters
// ---------------------------------------------------------------------
// `earthengine.googleapis.com` is reachable from this environment —
// confirmed directly: a request to a real Earth Engine REST endpoint
// returns a genuine HTTP 401 from Google's own API gateway ("Request
// is missing required authentication credential... CREDENTIALS_MISSING"),
// not a 403 CONNECT from this environment's agent proxy. The proxy's
// own status endpoint confirms no rejection was logged for this host,
// unlike `earthenv.org` and `glad.umd.edu`, both of which are. So the
// real blocker here is authentication, not network policy: Earth
// Engine requires a registered Earth Engine Cloud Project (free for
// noncommercial/research use; Google's November 2024 policy change
// requires a billed, paid Google Cloud project for commercial use),
// and this environment has none — `gcloud auth list` reports no
// credentialed accounts and no `GOOGLE_APPLICATION_CREDENTIALS` is
// set. `fetchViirsNightLights` throws naming that gap specifically,
// rather than the proxy-block message every other `fetch*` stub in
// this registry carries, because repeating that message here would
// misreport which real obstacle is actually in the way.

'use strict';

const { setLocationData, getLocation } = require('../locations');

// **Interpretive activity bands, stated as such.** No single
// universally-agreed radiance threshold separates "dark", "dim",
// "lit" and "bright" in the literature — studies commonly bin by
// quantile within their own study area rather than a fixed global
// cutoff. These are round, stated numbers in the DNB's own published
// units (nanoWatts/cm²/sr), chosen for legibility rather than derived
// from any one paper's specific breakpoints.
const ACTIVITY_BANDS = [
  { max: 0.5, level: 'dark' },
  { max: 5, level: 'dim' },
  { max: 30, level: 'lit' },
  { max: Infinity, level: 'bright' },
];

function classifyActivityLevel(radianceNanoWattsPerCm2Sr) {
  // `Number(null)` is `0`, which would otherwise read as a real "dark"
  // reading rather than an absent one -- the same `Number()` trap
  // `vacon-c/CLAUDE.md` already names elsewhere in this ecosystem.
  if (radianceNanoWattsPerCm2Sr === null || radianceNanoWattsPerCm2Sr === undefined) return null;
  const value = Number(radianceNanoWattsPerCm2Sr);
  if (!Number.isFinite(value)) return null;
  for (const band of ACTIVITY_BANDS) if (value <= band.max) return band.level;
  return ACTIVITY_BANDS[ACTIVITY_BANDS.length - 1].level;
}

// Attach a real VIIRS DNB monthly composite reading to a location.
//
// `record`: `{ radianceNanoWattsPerCm2Sr, compositeYear, compositeMonth }`.
// Composites can read a small negative value after VIIRS' own
// stray-light correction — a real property of the product, not a
// sign of bad data, so this does not clamp at zero the way a count
// would.
function importNightLights(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importNightLights: no location with id ${locationId}`);

  // Same `Number(null)` trap as `classifyActivityLevel` -- rejected
  // explicitly before coercion.
  const rawRadiance = record.radianceNanoWattsPerCm2Sr;
  const radiance = Number(rawRadiance);
  if (rawRadiance === null || rawRadiance === undefined || !Number.isFinite(radiance)) {
    throw new Error('importNightLights requires a finite record.radianceNanoWattsPerCm2Sr');
  }
  if (!Number.isInteger(record.compositeYear) || !Number.isInteger(record.compositeMonth)) {
    throw new Error('importNightLights requires an integer record.compositeYear and record.compositeMonth');
  }
  if (record.compositeMonth < 1 || record.compositeMonth > 12) {
    throw new Error(`importNightLights: compositeMonth ${record.compositeMonth} is not 1-12`);
  }

  const existing = location.economicData ?? {};
  setLocationData(worldLayer, locationId, 'economicData', {
    ...existing,
    nightLights: {
      source: 'viirs-dnb-via-earth-engine',
      radianceNanoWattsPerCm2Sr: Math.round(radiance * 1000) / 1000,
      compositeYear: record.compositeYear,
      compositeMonth: record.compositeMonth,
      activityLevel: classifyActivityLevel(radiance),
    },
  });
  return location;
}

function describeNightLightsCoverage(worldLayer) {
  const byLevel = {};
  let withData = 0;
  for (const location of worldLayer.locations || []) {
    const lights = location.economicData?.nightLights;
    if (lights?.source !== 'viirs-dnb-via-earth-engine') continue;
    withData += 1;
    byLevel[lights.activityLevel] = (byLevel[lights.activityLevel] ?? 0) + 1;
  }
  return {
    withData,
    byLevel,
    total: (worldLayer.locations || []).length,
  };
}

function fetchViirsNightLights() {
  throw new Error(
    'fetchViirsNightLights is not implemented: unlike every other source in this registry, '
    + 'the real obstacle is NOT a proxy block — earthengine.googleapis.com is reachable from '
    + 'this environment (confirmed directly: a real Earth Engine REST call returns a genuine '
    + '401 UNAUTHENTICATED from Google\'s own API, with no rejection logged at the agent '
    + 'proxy). The real gap is credentials: this environment has no registered Earth Engine '
    + 'Cloud Project (`gcloud auth list` reports no credentialed accounts, no '
    + 'GOOGLE_APPLICATION_CREDENTIALS is set). With a project registered, the real call is '
    + "`ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG').filterDate(...).mean()."
    + 'reduceRegion(...)` via the Python or JS client, or the equivalent REST endpoint. Pass '
    + '{ radianceNanoWattsPerCm2Sr, compositeYear, compositeMonth } to '
    + 'importNightLights(worldLayer, locationId, record).',
  );
}

module.exports = {
  ACTIVITY_BANDS,
  classifyActivityLevel,
  importNightLights,
  describeNightLightsCoverage,
  fetchViirsNightLights,
};
