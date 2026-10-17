// server/populationPacks.js
//
// **Real demographic shapes, imported per region — the sibling of
// `landmarkPacks.js`, same reasons, same shape.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `worldgen.js` draws age and adult educational attainment from bands
// this project chose, identical in every community in every city —
// which works against `areaStats.js`, whose entire purpose is to make
// neighbourhoods differ. `world-layer/imports/censusImport.js` already
// turns real U.S. Census Bureau (ACS) tract data into exactly the
// distributions this engine needs — age bands, attainment shares — at
// the one grain that matches a generated community (a tract is a few
// thousand people, roughly a neighbourhood).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as `landmarkPacks.js`: `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`
// says no app imports `world-layer/` across a directory boundary, so a
// pack arrives as plain JSON, assembled by whoever is building this
// world, the same way a landmark pack does. `require('../world-layer')`
// would deploy two apps as one.
//
// ---------------------------------------------------------------------
// One tract per community, assigned by POSITION
// ---------------------------------------------------------------------
// A tract has no name an auto-generated community can be matched to —
// unlike a landmark, which a real import places in a named area. So
// tracts are assigned by their POSITION in the pack against the
// community's position in the generation loop (city index *
// communitiesPerCity + community index within the city), cycling if
// there are fewer tracts than communities. This is standing rule 8
// (§88): seed on position, never on identity, and it is also the
// honest answer here — a real import knows the real order of its own
// tracts and nothing else gives two communities in two different
// cities a principled reason to share one.
//
// §9's clause applies here exactly as it does on the import side: this
// module hands back distributions and real head counts, never a
// per-person attribute, and nothing it returns is readable as a trait.

'use strict';

//: A pack's own declaration of where its rows came from — carried
//: through so a reader can always tell an imported shape from an
//: invented one. Mirrors `landmarkPacks.SOURCES`.
const SOURCES = ['us-census-acs', 'sample'];

//: `demographics.EDUCATION_LEVELS`, duplicated for the same deployment
//: reason `world-layer/exportRegion.js`'s `KEY_CATEGORIES` duplicates
//: `landmarks.js`'s category list — and asserted against the real
//: list by this module's own test, so the two cannot drift silently.
const EDUCATION_LEVELS = ['none', 'basic', 'secondary', 'vocational', 'higher', 'advanced'];

//: `world-layer/imports/censusImport.js`'s own `AGE_BANDS` keys — the
//: engine's two boundaries (`economy.WORKING_AGE` at 16,
//: `statistics.elder_share` at 65), honoured rather than re-chosen.
const AGE_BAND_KEYS = ['child', 'working', 'elder'];

//: The same three bands, as a concrete [low, high] range a within-band
//: draw can land in. `elder`'s true upper bound is unbounded in ACS;
//: 100 is a flagged interpretive cap, matching `worldgen.js`'s own
//: generated-age ceiling before this module existed.
const AGE_BAND_RANGES = { child: [0, 15], working: [16, 64], elder: [65, 100] };

//: `world-layer/imports/cdcImport.js`'s own `PRESSURE_BOUNDS` — a real
//: CDC PLACES tract's health baseline is a multiplier centred on 1 for
//: an ordinary place, bounded there for the same reason that importer
//: bounds it: an unbounded multiplier on mortality is a way to empty a
//: world by arithmetic.
const HEALTH_BASELINE_BOUNDS = [0.75, 1.5];

//: `world-layer/imports/overdoseImport.js`'s own `PRESSURE_BOUNDS` — a
//: SECOND real excess-mortality signal, independent of and compounding
//: with `healthBaseline`. See that importer's header for why this is
//: a second real input to the same multiplier rather than a new
//: mechanism: this engine has no drug/substance mechanic of any kind,
//: and a pack reader does not get to introduce one.
const OVERDOSE_BASELINE_BOUNDS = [0.75, 1.75];

//: `world-layer/imports/hudPitImport.js`'s own `RATE_BOUNDS` — a real
//: per-capita homelessness rate, the opposite condition
//: `worldgen.js`'s `homesPerResident` margin (always above 1) can
//: never express on its own.
const HOMELESSNESS_RATE_BOUNDS = [0, 0.05];

function isShareObject(value, keys) {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) return false;
    const share = Number(value[key]);
    if (!Number.isFinite(share) || share < 0 || share > 1) return false;
  }
  return true;
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
  if (!Array.isArray(pack.tracts) || pack.tracts.length === 0) {
    problems.push('pack.tracts must be a non-empty array');
    return problems;
  }

  pack.tracts.forEach((tract, i) => {
    const where = `tracts[${i}]${tract?.tractId ? ` (${tract.tractId})` : ''}`;
    if (!tract?.tractId) problems.push(`${where}: tractId is required`);
    if (tract.ageBands !== undefined && tract.ageBands !== null
      && !isShareObject(tract.ageBands, AGE_BAND_KEYS)) {
      problems.push(`${where}: ageBands must be shares (0..1) keyed on ${AGE_BAND_KEYS.join(', ')}`);
    }
    if (tract.attainment !== undefined && tract.attainment !== null
      && !isShareObject(tract.attainment, EDUCATION_LEVELS)) {
      problems.push(`${where}: attainment must be shares (0..1) keyed on ${EDUCATION_LEVELS.join(', ')}`);
    }
    if (tract.healthBaseline !== undefined && tract.healthBaseline !== null) {
      const value = Number(tract.healthBaseline);
      if (!Number.isFinite(value) || value < HEALTH_BASELINE_BOUNDS[0] || value > HEALTH_BASELINE_BOUNDS[1]) {
        problems.push(`${where}: healthBaseline must be between ${HEALTH_BASELINE_BOUNDS[0]} and ${HEALTH_BASELINE_BOUNDS[1]}`);
      }
    }
    if (tract.overdoseBaseline !== undefined && tract.overdoseBaseline !== null) {
      const value = Number(tract.overdoseBaseline);
      if (!Number.isFinite(value) || value < OVERDOSE_BASELINE_BOUNDS[0] || value > OVERDOSE_BASELINE_BOUNDS[1]) {
        problems.push(`${where}: overdoseBaseline must be between ${OVERDOSE_BASELINE_BOUNDS[0]} `
          + `and ${OVERDOSE_BASELINE_BOUNDS[1]}`);
      }
    }
    if (tract.homelessnessRate !== undefined && tract.homelessnessRate !== null) {
      const value = Number(tract.homelessnessRate);
      if (!Number.isFinite(value) || value < HOMELESSNESS_RATE_BOUNDS[0] || value > HOMELESSNESS_RATE_BOUNDS[1]) {
        problems.push(`${where}: homelessnessRate must be between ${HOMELESSNESS_RATE_BOUNDS[0]} `
          + `and ${HOMELESSNESS_RATE_BOUNDS[1]}`);
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`population pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, because a world with no pack must
// still generate.
function packFor(worldState) {
  return worldState?.populationPack ?? null;
}

// The tract for a community at this position, cycling if there are
// fewer tracts than communities. Null when there is no pack — the
// caller's own invented bands are the fallback, not this module's.
function tractFor(pack, position) {
  if (!pack || !Array.isArray(pack.tracts) || pack.tracts.length === 0) return null;
  const index = ((position % pack.tracts.length) + pack.tracts.length) % pack.tracts.length;
  return pack.tracts[index];
}

// Cumulative cut points for a weighted pick over ordered keys, built
// from a real share object rather than an invented threshold list.
// `keys` fixes the order (so `edu < cuts[0]` means the lowest rung,
// matching `worldgen.js`'s own ascending threshold shape); any key
// missing from `shares` contributes zero rather than being skipped
// silently.
function cutsFor(shares, keys) {
  let running = 0;
  return keys.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which band/rung a unit draw (0..1) falls into, against real
// cumulative shares. Returns the LAST key if the shares do not sum to
// 1 and the draw lands past the end — real ACS tracts carry rounding
// and suppression, and a share object that sums to 0.97 must still
// resolve every draw to something.
function pick(unit, shares, keys) {
  const cuts = cutsFor(shares, keys);
  const total = cuts[cuts.length - 1];
  if (total <= 0) return null;
  const scaled = unit * total;
  for (let i = 0; i < keys.length; i += 1) {
    if (scaled < cuts[i]) return keys[i];
  }
  return keys[keys.length - 1];
}

// The age band a unit draw falls into, against a tract's real shares,
// or null when the tract has none recorded (ACS suppresses small
// tracts — see `censusImport.js`'s own `describeAcsCoverage`).
function ageBandFor(tract, unit) {
  if (!tract?.ageBands) return null;
  return pick(unit, tract.ageBands, AGE_BAND_KEYS);
}

// The attainment rung a unit draw falls into, against a tract's real
// shares, or null when the tract has none recorded.
function attainmentFor(tract, unit) {
  if (!tract?.attainment) return null;
  return pick(unit, tract.attainment, EDUCATION_LEVELS);
}

// A tract's real CDC PLACES health baseline — a multiplier
// `mortality.diseasePressure` can read in place of the implicit 1 an
// unmeasured city carries — or null when the tract has none recorded.
function healthBaselineFor(tract) {
  const value = Number(tract?.healthBaseline);
  return Number.isFinite(value) ? value : null;
}

// A tract's real CDC/NCHS overdose-mortality baseline — a SECOND,
// independent multiplier `mortality.diseasePressure` compounds with
// `healthBaseline` rather than replacing it. Null when the tract has
// none recorded.
function overdoseBaselineFor(tract) {
  const value = Number(tract?.overdoseBaseline);
  return Number.isFinite(value) ? value : null;
}

// A tract's real HUD Point-in-Time per-capita homelessness rate — the
// opposite condition `worldgen.js`'s `homesPerResident` margin cannot
// express on its own (it is always above 1). Null when the tract has
// none recorded.
function homelessnessRateFor(tract) {
  const value = Number(tract?.homelessnessRate);
  return Number.isFinite(value) ? value : null;
}

module.exports = {
  SOURCES,
  EDUCATION_LEVELS,
  AGE_BAND_KEYS,
  AGE_BAND_RANGES,
  HEALTH_BASELINE_BOUNDS,
  OVERDOSE_BASELINE_BOUNDS,
  HOMELESSNESS_RATE_BOUNDS,
  validatePack,
  assertPack,
  packFor,
  tractFor,
  ageBandFor,
  attainmentFor,
  healthBaselineFor,
  overdoseBaselineFor,
  homelessnessRateFor,
};
