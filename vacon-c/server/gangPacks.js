// server/gangPacks.js
//
// **A real, if dated, gang count and membership rate, for two
// constants this project chose with no document behind either.**
//
// ---------------------------------------------------------------------
// Read `world-layer/imports/nygsImport.js`'s header before this one
// ---------------------------------------------------------------------
// That file explains at length why this is the one source in the
// registry that is not current: OJJDP's National Youth Gang Survey
// ran 1996-2012, was then discontinued, and every figure it published
// is self-reported by police agencies rather than measured. This
// reader does not make that data any newer. `staleness` and `year`
// travel with every jurisdiction a pack carries, and a world built
// from one should say so wherever that world's own provenance is
// shown.
//
// ---------------------------------------------------------------------
// What this closes
// ---------------------------------------------------------------------
// `worldgen.js` draws `factionsPerCity` (2) and `gangMembershipRate`
// (0.06) flat, identically, in every city in every world, neither
// flagged as measured. A real jurisdiction's gang count and member
// rate are real numbers standing in for invented ones — same shape as
// every other pack here, with the staleness named rather than hidden.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a tract
// ---------------------------------------------------------------------
// A jurisdiction has no name an auto-generated city can be matched to.
// Jurisdictions are assigned by POSITION against the city's own index
// in the generation loop — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['ojjdp-nygs', 'sample'];

//: `world-layer/imports/nygsImport.js`'s own `MEMBERSHIP_RATE_BOUNDS`.
const MEMBERSHIP_RATE_BOUNDS = [0, 0.1];

//: `world-layer/imports/nygsImport.js`'s own `LAST_SURVEY_YEAR` — the
//: survey was discontinued after this wave, and a pack claiming a
//: later year is refused rather than silently believed.
const LAST_SURVEY_YEAR = 2012;

function isNonNegativeInteger(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && Math.floor(n) === n;
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
  if (!Array.isArray(pack.jurisdictions) || pack.jurisdictions.length === 0) {
    problems.push('pack.jurisdictions must be a non-empty array');
    return problems;
  }

  pack.jurisdictions.forEach((j, i) => {
    const where = `jurisdictions[${i}]${j?.jurisdictionName ? ` (${j.jurisdictionName})` : ''}`;
    if (!j?.jurisdictionName) problems.push(`${where}: jurisdictionName is required`);
    if (j.year !== undefined && j.year !== null) {
      const year = Number(j.year);
      if (!Number.isFinite(year) || year > LAST_SURVEY_YEAR) {
        problems.push(`${where}: year must not be after ${LAST_SURVEY_YEAR} — no NYGS wave exists after it`);
      }
    }
    if (j.gangCount !== undefined && j.gangCount !== null && !isNonNegativeInteger(j.gangCount)) {
      problems.push(`${where}: gangCount must be a non-negative integer`);
    }
    if (j.membershipRate !== undefined && j.membershipRate !== null) {
      const rate = Number(j.membershipRate);
      if (!Number.isFinite(rate) || rate < MEMBERSHIP_RATE_BOUNDS[0] || rate > MEMBERSHIP_RATE_BOUNDS[1]) {
        problems.push(`${where}: membershipRate must be between ${MEMBERSHIP_RATE_BOUNDS[0]} `
          + `and ${MEMBERSHIP_RATE_BOUNDS[1]}`);
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`gang pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.gangPack ?? null;
}

// The jurisdiction for a city at this position, cycling if there are
// fewer jurisdictions than cities. Null when there is no pack.
function jurisdictionFor(pack, position) {
  if (!pack || !Array.isArray(pack.jurisdictions) || pack.jurisdictions.length === 0) return null;
  const index = ((position % pack.jurisdictions.length) + pack.jurisdictions.length) % pack.jurisdictions.length;
  return pack.jurisdictions[index];
}

// A real gang count for this jurisdiction, or null — the caller's own
// `factionsPerCity` is the fallback, not this module's.
function gangCountFor(jurisdiction) {
  const value = Number(jurisdiction?.gangCount);
  return Number.isFinite(value) ? value : null;
}

// A real membership rate for this jurisdiction, or null — the caller's
// own `gangMembershipRate` is the fallback, not this module's.
function membershipRateFor(jurisdiction) {
  const value = Number(jurisdiction?.membershipRate);
  return Number.isFinite(value) ? value : null;
}

module.exports = {
  SOURCES,
  MEMBERSHIP_RATE_BOUNDS,
  LAST_SURVEY_YEAR,
  validatePack,
  assertPack,
  packFor,
  jurisdictionFor,
  gangCountFor,
  membershipRateFor,
};
