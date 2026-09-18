// Universal World Layer — NOAA climate normals import.
//
// Source of truth: UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md §8, which
// names NOAA as "real weather/ocean/coastal data, directly relevant to
// the existing Weather/Climate system".
//
// ---------------------------------------------------------------------
// This closes a column the engine names as unmodellable
// ---------------------------------------------------------------------
// `vacon-c/server/barter.js` lists three §27 price modifiers it cannot
// model, and puts this one first, in its own words:
//
//   climate: '`regions.climate_key` is TEXT written by nothing'
//
// And `vacon-c/server/migration.js#generateRegion` accepts a
// `climateKey`, has never been passed one by any caller, and says
// exactly why it does not invent one:
//
//   "`geography_key` and `climate_key` are free TEXT with no
//   enumeration anywhere in the package, so a caller supplies them or
//   they stay null. Inventing a climate vocabulary here would be the
//   mistake the weather table is still open for."
//
// **That was the right call and this is the caller it was waiting for.**
// The vocabulary is not invented here either — it is Köppen-Geiger, the
// published standard climate classification, and the thresholds below
// are its own, not this project's. NOAA's climate normals supply the
// monthly temperature and precipitation the classification reads.
//
// ---------------------------------------------------------------------
// Why a classification rather than raw numbers
// ---------------------------------------------------------------------
// `regions.climate_key` is a KEY — one TEXT value per region. Raw
// normals are twelve temperatures and twelve precipitation figures, and
// collapsing those to a single string is exactly what Köppen is for. A
// caller that wants the underlying series keeps it; `classify` returns
// both, so nothing is thrown away to produce the key.
//
// NETWORK CONSTRAINT, checked directly on 18 Sep 2026: `api.weather.gov`
// and the NCEI archives are outside this environment's outbound proxy
// allowlist (403 CONNECT). `fetchClimateNormals` throws with that
// reason; `classify` and `importClimateNormals` are the tested part and
// do not care where the numbers came from.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: The Köppen-Geiger main climate groups, with what each letter means.
//: **Published vocabulary, reproduced — not a scheme this project
//: chose.** That is the whole reason `migration.js` was right to refuse
//: to invent one and right to leave the column open for a caller.
const KOPPEN_GROUPS = {
  A: 'tropical',
  B: 'arid',
  C: 'temperate',
  D: 'continental',
  E: 'polar',
};

//: The second and third letters, for the subtypes this classifier
//: actually distinguishes. Köppen defines more; producing a letter the
//: classifier cannot justify from the inputs would be worse than a
//: coarser answer, so the set is deliberately the ones these normals
//: can support.
const KOPPEN_SUBTYPES = {
  f: 'no dry season',
  s: 'dry summer',
  w: 'dry winter',
  m: 'monsoon',
  h: 'hot',
  k: 'cold',
  a: 'hot summer',
  b: 'warm summer',
  c: 'cold summer',
  d: 'very cold winter',
  T: 'tundra',
  F: 'ice cap',
};

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Köppen-Geiger classification from monthly normals.
//
// `temperaturesC` and `precipitationMm` are twelve values each, January
// first. **Both are required and neither is defaulted**: a
// classification from half the year is not a classification, and
// producing a plausible letter from missing data is the failure mode
// this whole file exists to avoid.
//
// The northern/southern hemisphere distinction matters — "summer" is
// April-September above the equator and October-March below — so
// latitude is required too rather than assumed north.
function classify(options = {}) {
  const { temperaturesC, precipitationMm, latitude } = options;
  if (!Array.isArray(temperaturesC) || temperaturesC.length !== 12) {
    throw new Error('classify requires temperaturesC: twelve monthly means, January first');
  }
  if (!Array.isArray(precipitationMm) || precipitationMm.length !== 12) {
    throw new Error('classify requires precipitationMm: twelve monthly totals, January first');
  }
  if (typeof latitude !== 'number') {
    throw new Error('classify requires latitude — "summer" is different either side of the equator');
  }

  const annualT = mean(temperaturesC);
  const annualP = precipitationMm.reduce((a, b) => a + b, 0);
  const coldest = Math.min(...temperaturesC);
  const warmest = Math.max(...temperaturesC);
  const monthsAbove10 = temperaturesC.filter((t) => t >= 10).length;

  // April-September is summer in the north, winter in the south.
  const northern = latitude >= 0;
  const aprSep = precipitationMm.slice(3, 9);
  const octMar = [...precipitationMm.slice(9), ...precipitationMm.slice(0, 3)];
  const summerP = northern ? aprSep : octMar;
  const winterP = northern ? octMar : aprSep;
  const driestSummer = Math.min(...summerP);
  const driestWinter = Math.min(...winterP);
  const wettestSummer = Math.max(...summerP);
  const wettestWinter = Math.max(...winterP);

  // -- B, arid: Köppen's aridity threshold, which depends on WHEN the
  // rain falls. Checked first, because a desert is a desert whatever
  // its temperature.
  const summerShare = summerP.reduce((a, b) => a + b, 0) / (annualP || 1);
  let offset = 140; // rain mostly in summer
  if (summerShare < 0.3) offset = 0; // mostly winter
  else if (summerShare < 0.7) offset = 70; // evenly spread
  const aridThreshold = 20 * annualT + offset;

  if (annualP < aridThreshold) {
    const second = annualP < aridThreshold / 2 ? 'W' : 'S'; // desert or steppe
    const third = annualT >= 18 ? 'h' : 'k';
    return describe(`B${second}${third}`, { annualT, annualP, coldest, warmest });
  }

  // -- E, polar
  if (warmest < 10) {
    const second = warmest > 0 ? 'T' : 'F';
    return describe(`E${second}`, { annualT, annualP, coldest, warmest });
  }

  // -- A, tropical: every month at or above 18°C
  if (coldest >= 18) {
    const driest = Math.min(...precipitationMm);
    if (driest >= 60) return describe('Af', { annualT, annualP, coldest, warmest });
    // Köppen's monsoon test, using its own constant.
    if (driest >= 100 - annualP / 25) return describe('Am', { annualT, annualP, coldest, warmest });
    return describe('Aw', { annualT, annualP, coldest, warmest });
  }

  // -- C and D: temperate versus continental, on the coldest month
  const group = coldest >= -3 ? 'C' : 'D';

  let second = 'f';
  if (driestSummer < 40 && wettestWinter >= 3 * driestSummer) second = 's';
  else if (driestWinter < wettestSummer / 10) second = 'w';

  let third;
  if (warmest >= 22) third = 'a';
  else if (monthsAbove10 >= 4) third = 'b';
  else if (coldest > -38) third = 'c';
  else third = 'd';

  return describe(`${group}${second}${third}`, { annualT, annualP, coldest, warmest });
}

function describe(code, measures) {
  const letters = code.split('');
  return {
    // What goes in `regions.climate_key`. The Köppen code itself, which
    // is a published identifier rather than a label this project made
    // up — the point of the whole exercise.
    climateKey: code,
    group: KOPPEN_GROUPS[letters[0]] ?? null,
    subtypes: letters.slice(1).map((l) => KOPPEN_SUBTYPES[l] ?? null).filter(Boolean),
    // The underlying numbers, kept. A key is a summary and a summary
    // that destroys its inputs cannot be checked.
    measures: {
      annualMeanC: Math.round(measures.annualT * 10) / 10,
      annualPrecipitationMm: Math.round(measures.annualP),
      coldestMonthC: Math.round(measures.coldest * 10) / 10,
      warmestMonthC: Math.round(measures.warmest * 10) / 10,
    },
    source: 'noaa-climate-normals',
  };
}

// Attach a classified climate to a location already in the layer.
//
// Climate is a property of a REGION rather than a building, so this is
// normally called on the division locations `overtureImport
// .importOvertureDivisions` produced — a region or a city, not a
// hardware store.
function importClimateNormals(worldLayer, locationId, normals) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importClimateNormals: no location with id ${locationId}`);

  const classified = classify({
    temperaturesC: normals?.temperaturesC,
    precipitationMm: normals?.precipitationMm,
    latitude: normals?.latitude ?? location.lat,
  });

  const existing = location.geographyData ?? {};
  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    climate: classified,
    stationId: normals?.stationId ?? null,
  });
  return classified;
}

function fetchClimateNormals() {
  throw new Error(
    'fetchClimateNormals is not implemented: api.weather.gov and the NCEI climate archives '
    + 'are outside this environment\'s outbound proxy allowlist (403 CONNECT, checked '
    + 'directly 18 Sep 2026). The intended path is NCEI\'s 1991-2020 Climate Normals — '
    + 'monthly temperature and precipitation per station, U.S. Government Work, public '
    + 'domain. Pass twelve monthly means and totals to '
    + 'importClimateNormals(worldLayer, locationId, normals), or to classify() directly.',
  );
}

module.exports = {
  KOPPEN_GROUPS,
  KOPPEN_SUBTYPES,
  classify,
  importClimateNormals,
  fetchClimateNormals,
};
