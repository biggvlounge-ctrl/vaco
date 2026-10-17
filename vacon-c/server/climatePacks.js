// server/climatePacks.js
//
// **A real Köppen-Geiger climate key, for a column two files already
// refused to invent one for.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `migration.js#generateRegion` accepts `climateKey`, has never been
// passed one by any caller, and says exactly why it does not invent
// one: "`geography_key` and `climate_key` are free TEXT with no
// enumeration anywhere in the package, so a caller supplies them or
// they stay null. Inventing a climate vocabulary here would be the
// mistake the weather table is still open for." `barter.js` lists
// `regions.climate_key` as a price modifier it cannot model for the
// same reason. `world-layer/imports/noaaImport.js` already classifies
// real NOAA climate normals into the real, published Köppen-Geiger
// vocabulary — the caller both files were waiting for.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as the other pack readers: no app imports `world-layer/`
// across a directory boundary (`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`).
//
// ---------------------------------------------------------------------
// One climate per region, because this engine generates one region per world
// ---------------------------------------------------------------------
// `worldgen.js` calls `migration.generateRegion` exactly once per
// world. A pack therefore carries one real climate, not a list to
// cycle through by position — there is nothing to cycle. A future
// world with several regions would need several packs, not a richer
// one; that is a real, later scope question, not solved here by
// guessing which city gets which climate.
//
// **Scoped to the region's `climate_key` only — not
// `environment.climateForLatitude`'s own per-city value.** That
// function's output already feeds live weather mechanics; overriding
// it with a different vocabulary (Köppen letters are not the same
// classification `environment.js` invented) risks a downstream reader
// expecting its own enum. `regions.climate_key` is "written by
// nothing" today — confirmed directly in `barter.js` — so there is
// nothing live to break there.

'use strict';

const SOURCES = ['noaa-climate-normals', 'sample'];

//: `world-layer/imports/noaaImport.js`'s own `KOPPEN_GROUPS` keys —
//: duplicated for the same deployment reason every other pack reader
//: duplicates its source vocabulary, and cross-checked by test.
const KOPPEN_GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function isPositiveNumber(value) {
  return Number.isFinite(Number(value));
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
  if (typeof pack.climateKey !== 'string' || pack.climateKey.length === 0) {
    problems.push('pack.climateKey must be a non-empty Köppen-Geiger code');
  } else if (!KOPPEN_GROUP_LETTERS.includes(pack.climateKey[0])) {
    problems.push(`pack.climateKey: "${pack.climateKey}" does not start with a real Köppen group letter `
      + `(${KOPPEN_GROUP_LETTERS.join(', ')})`);
  }
  if (pack.measures !== undefined && pack.measures !== null) {
    for (const field of ['annualMeanC', 'annualPrecipitationMm', 'coldestMonthC', 'warmestMonthC']) {
      if (pack.measures[field] !== undefined && !isPositiveNumber(pack.measures[field]) && pack.measures[field] !== 0) {
        // `coldestMonthC` and `annualMeanC` are routinely negative or
        // zero, so this only refuses a genuinely non-numeric value.
        if (!Number.isFinite(Number(pack.measures[field]))) {
          problems.push(`pack.measures.${field} must be a real number`);
        }
      }
    }
  }
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`climate pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.climatePack ?? null;
}

// The real climate key this pack carries, or null with no pack.
function climateKeyFor(pack) {
  return pack?.climateKey ?? null;
}

module.exports = {
  SOURCES,
  KOPPEN_GROUP_LETTERS,
  validatePack,
  assertPack,
  packFor,
  climateKeyFor,
};
