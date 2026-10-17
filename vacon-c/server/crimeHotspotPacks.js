// server/crimeHotspotPacks.js
//
// **A real sub-city area's property-crime rate, relative to its own
// city's mean — a two-city exception, and scoped to one existing
// mechanism on purpose.**
//
// ---------------------------------------------------------------------
// Read `world-layer/imports/cityCrimeImport.js`'s header before this one
// ---------------------------------------------------------------------
// That file explains why Los Angeles and Chicago are the one real,
// public, geocoded source of sub-city incident data this registry
// has — and why that makes this the one pack reader here that is a
// two-city exception rather than a national source. A world generated
// for any other city gets no pack and is unaffected.
//
// ---------------------------------------------------------------------
// Self-normalizing, not pinned to an external "ordinary" constant
// ---------------------------------------------------------------------
// Every other real multiplier in this registry (`healthBaseline`,
// `overdoseBaseline`) is centred on an EXTERNAL flagged-interpretive
// reference (CDC's own national baseline is implicitly 1). There is
// no equivalent "ordinary U.S. property-crime rate" constant worth
// inventing here — the seventeenth standing rule's lesson applied a
// second time: "the right reference is usually inside the model."
// `weightFor` centres each area against the MEAN of its own pack's
// areas, so the weight is 1 for an area at its city's own average and
// moves only with real variation WITHIN that city, never against an
// invented national figure.
//
// ---------------------------------------------------------------------
// What this closes, and what it deliberately does not touch
// ---------------------------------------------------------------------
// `crime.js#runDeprivationCrime` draws property/theft risk from
// `BASE_DEPRIVATION_RISK` (0.0006), flat and identical in every
// community in every city. A real area's relative weight gives that
// flagged-interpretive constant real sub-city variation where real
// data exists.
//
// **Deliberately NOT touched: violent crime.** `keys.resolveAggression`
// was calibrated through four measured attempts (CLAUDE.md's
// seventeenth standing rule) against this engine's own internal
// distributions. This reader is wired only into the deprivation/
// property pressure, never into that separately calibrated mechanism.
//
// ---------------------------------------------------------------------
// Matched to a COMMUNITY by POSITION, not a city
// ---------------------------------------------------------------------
// Every other real multiplier in this registry (`healthBaseline`,
// `hazardRisk`) is assigned per CITY, because their sources are
// county-grain. This one is sub-city grain by construction — an LAPD
// reporting district or a CPD community area is smaller than a city —
// so it is assigned by the COMMUNITY's own position in the generation
// loop (§88), the same grain `populationPacks.js` tracts use.
//
// §9 applies here exactly as on the import side: an area's rate is a
// fact about the PLACE, never about any one generated citizen —
// nothing here reads an NPC's own identity to apply this weight, only
// which community they live in.

'use strict';

const SOURCES = ['la-open-data', 'chicago-open-data', 'sample'];

//: `world-layer/imports/cityCrimeImport.js`'s own `CITIES`.
const CITIES = ['los-angeles', 'chicago'];

//: `world-layer/imports/cityCrimeImport.js`'s own `RATE_BOUNDS`.
const RATE_BOUNDS = [0, 200];

//: A sanity ceiling on the relative weight this module derives, not a
//: claim about any real area's actual spread — it exists to catch a
//: mean computed from too few areas (one tiny outlier dominating),
//: not to narrow real variation.
const WEIGHT_BOUNDS = [0.2, 5];

function isRealRate(value) {
  if (value === null || value === undefined || value === '') return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= RATE_BOUNDS[0] && rate <= RATE_BOUNDS[1] ? rate : null;
}

// ---------------------------------------------------------------------
// validate — a pack is refused, never partly used
// ---------------------------------------------------------------------
function validatePack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['a pack must be an object'];
  if (!pack.region) problems.push('pack.region is required — a pack is per-region by definition');
  if (!SOURCES.includes(pack.source)) {
    problems.push(`pack.source must be one of: ${SOURCES.join(', ')}`);
  }
  if (!CITIES.includes(pack.city)) {
    problems.push(`pack.city must be one of: ${CITIES.join(', ')} — a pack covers one city`);
  }
  if (!Array.isArray(pack.areas) || pack.areas.length === 0) {
    problems.push('pack.areas must be a non-empty array');
    return problems;
  }

  pack.areas.forEach((a, i) => {
    const where = `areas[${i}]${a?.areaName ? ` (${a.areaName})` : ''}`;
    if (!a?.areaName) problems.push(`${where}: areaName is required`);
    for (const field of ['violentRatePer1k', 'propertyRatePer1k']) {
      if (a[field] === undefined || a[field] === null) continue;
      const value = Number(a[field]);
      if (!Number.isFinite(value) || value < RATE_BOUNDS[0] || value > RATE_BOUNDS[1]) {
        problems.push(`${where}: ${field} must be between ${RATE_BOUNDS[0]} and ${RATE_BOUNDS[1]}`);
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`crime hot-spot pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.crimeHotspotPack ?? null;
}

// The area for a community at this position, cycling if there are
// fewer areas than communities. Null when there is no pack.
function areaFor(pack, position) {
  if (!pack || !Array.isArray(pack.areas) || pack.areas.length === 0) return null;
  const index = ((position % pack.areas.length) + pack.areas.length) % pack.areas.length;
  return pack.areas[index];
}

// The pack's own mean property-crime rate across its real-rated areas
// — the self-normalizing reference `propertyWeightFor` divides by,
// never an external invented constant. Null when no area in the pack
// has a real rate.
function meanPropertyRate(pack) {
  if (!pack || !Array.isArray(pack.areas)) return null;
  const rates = pack.areas.map((a) => isRealRate(a?.propertyRatePer1k)).filter((r) => r !== null);
  if (rates.length === 0) return null;
  return rates.reduce((sum, r) => sum + r, 0) / rates.length;
}

// A real area's property-crime rate relative to its own pack's mean —
// 1 at the mean, bounded against a mean computed from too thin a
// sample. Null when the area or the pack's mean is unavailable, which
// is the caller's cue to use its own flat default instead.
function propertyWeightFor(pack, area) {
  const rate = isRealRate(area?.propertyRatePer1k);
  const mean = meanPropertyRate(pack);
  if (rate === null || mean === null || mean <= 0) return null;
  const weight = rate / mean;
  const bounded = Math.min(WEIGHT_BOUNDS[1], Math.max(WEIGHT_BOUNDS[0], weight));
  return Math.round(bounded * 1000) / 1000;
}

module.exports = {
  SOURCES,
  CITIES,
  RATE_BOUNDS,
  WEIGHT_BOUNDS,
  validatePack,
  assertPack,
  packFor,
  areaFor,
  meanPropertyRate,
  propertyWeightFor,
};
