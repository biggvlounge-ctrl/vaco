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

// ---------------------------------------------------------------------
// The self-report/law-enforcement gap — a real, independent, academic
// finding, carried as a documented caveat rather than a replacement
// ---------------------------------------------------------------------
//: Pyrooz, D.C. & Sweeten, G. (2015), "Gang Membership Between Ages 5
//: and 17 Years in the United States," Journal of Adolescent Health —
//: a national self-report estimate from the NLSY97 cohort (youths born
//: 1980-84, surveyed across 9 waves), combined with 2010 Census
//: population figures. **Not a per-jurisdiction source and not usable
//: as one**: it reports a NATIONAL prevalence curve by age with no
//: geography at all, the opposite grain from NYGS's per-jurisdiction,
//: law-enforcement-reported counts. It exists here as a documented
//: SECOND, INDEPENDENT measurement of the same thing, not a pack
//: `jurisdictionFor` can read — there is nothing to assign by position.
//:
//: The finding itself is the reason it is worth carrying: self-report
//: prevalence (2.0% overall, ages 5-17) implies roughly 1,059,000 youth
//: gang members nationally in 2010 — more than three times the ~300,000
//: law-enforcement-based estimate contemporary to it. The authors
//: attribute the gap to police records favouring older, more
//: criminally-involved youth, which is exactly the population NYGS
//: surveys police departments about. **Every real NYGS-derived
//: membership rate this module reads is therefore likely a floor, not
//: a point estimate** — named here so that caveat travels with the
//: number rather than being implied and lost.
const SELF_REPORT_REFERENCE = {
  source: 'pyrooz-sweeten-2015-nlsy97',
  citation: 'Pyrooz & Sweeten (2015), Journal of Adolescent Health, '
    + 'NLSY97 cohort + 2010 Census population',
  ageRange: [5, 17],
  overallPrevalence: 0.02,
  peakAge: 14,
  peakPrevalence: 0.05,
  nationalEstimate2010: 1059000,
  // The contemporary NYGS-era law-enforcement estimate the authors
  // compare their figure against — not this module's own jurisdiction
  // data, which is dated separately per pack.
  lawEnforcementComparatorEstimate: 300000,
};

// How many times higher the real self-report estimate ran versus the
// contemporary law-enforcement one — the ratio the caveat is built on,
// computed rather than retyped so the two cannot drift apart.
function selfReportUndercountFactor() {
  return Math.round(
    (SELF_REPORT_REFERENCE.nationalEstimate2010 / SELF_REPORT_REFERENCE.lawEnforcementComparatorEstimate) * 10,
  ) / 10;
}

// A real NYGS membership rate, read alongside the independent
// self-report finding above — never averaged or blended with it (the
// two are different grains measuring different-aged populations), just
// reported side by side so the caveat is visible wherever the real
// rate is. Null input returns null, not a fabricated figure.
function describeUndercountCaveat(jurisdiction) {
  const realRate = membershipRateFor(jurisdiction);
  if (realRate === null) return null;
  return {
    jurisdictionName: jurisdiction?.jurisdictionName ?? null,
    nygsMembershipRate: realRate,
    selfReportReference: SELF_REPORT_REFERENCE,
    undercountFactor: selfReportUndercountFactor(),
    note: 'The NYGS rate above is law-enforcement-reported and dated to this jurisdiction\'s '
      + 'survey year. Pyrooz & Sweeten\'s independent, national self-report estimate ran '
      + `${selfReportUndercountFactor()}x higher than the law-enforcement estimate `
      + 'contemporary to it, concentrated at younger teen ages NYGS respondents are least '
      + 'likely to report on. Treat the rate above as a floor.',
  };
}

module.exports = {
  SOURCES,
  MEMBERSHIP_RATE_BOUNDS,
  LAST_SURVEY_YEAR,
  SELF_REPORT_REFERENCE,
  validatePack,
  assertPack,
  packFor,
  jurisdictionFor,
  gangCountFor,
  membershipRateFor,
  selfReportUndercountFactor,
  describeUndercountCaveat,
};
