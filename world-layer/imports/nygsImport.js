// Universal World Layer — OJJDP National Youth Gang Survey (NYGS)
// import.
//
// **Read this before using this file. It is the one source in this
// registry that is not current, and the gap matters more than it does
// anywhere else here.**
//
// ---------------------------------------------------------------------
// What this actually is, named precisely
// ---------------------------------------------------------------------
// There is no current, structured, public, numeric gang database at
// the quality of Census, BLS, CDC or even FBI's own UCR crime data.
// What was checked, directly, before writing this file:
//
//   FBI National Gang Intelligence Center — publishes a periodic
//     "National Gang Report," a narrative/qualitative document with
//     national and regional estimates. Not a structured per-jurisdiction
//     dataset. Last known public edition is from around 2015.
//   GangNET — the actual law-enforcement gang-intelligence system.
//     Real, but restricted to law enforcement under CJIS rules. No
//     public access, no API, no key opens it. A fundamentally
//     different category from every other source in this registry,
//     all of which are public domain by design.
//   State/local systems (CalGang, etc.) — same restriction, and
//     CalGang specifically has documented, audited accuracy problems
//     (minors and deceased people listed) that led California courts
//     and legislature to restrict its use further.
//   OJJDP's National Youth Gang Survey (NYGS) — the one real,
//     legitimate, structured option, and what this file imports.
//
// ---------------------------------------------------------------------
// What NYGS is, and what it is not
// ---------------------------------------------------------------------
// The NYGS was an annual survey of law-enforcement agencies, run by
// the Office of Juvenile Justice and Delinquency Prevention (OJJDP),
// 1996-2012. Agencies self-reported whether gangs were active in their
// jurisdiction and, where they could, an estimated gang count and
// member count. It is real, numeric, and jurisdiction-level — and it
// is:
//
//   - FROZEN at 2012. The program was discontinued; there is no later
//     wave. Every number this importer can carry is now over a decade
//     old.
//   - SELF-REPORTED, not measured. An agency's estimate reflects that
//     agency's own methodology and willingness to report, not a
//     census. Non-response was common and is not corrected for here.
//   - ORGANIZATION-LEVEL. A count of gangs and an estimate of total
//     membership, never a named individual or group. There is nothing
//     in NYGS's own public tables that identifies a specific gang by
//     name with a sourced membership count — this importer does not
//     invent one.
//
// `year` is carried on every row this importer writes, and
// `describeGangCoverage` reports how stale the import's own data is,
// specifically so staleness cannot be lost between here and a build.
//
// ---------------------------------------------------------------------
// What this closes, in the engine's own terms
// ---------------------------------------------------------------------
// `vacon-c/server/worldgen.js` draws `factionsPerCity` (2, flat) and
// `gangMembershipRate` (0.06, flat) identically in every city in every
// world, both flagged nowhere as measured. A real, if dated,
// jurisdiction-level gang count and membership rate is a real number
// standing in for an invented one — the same shape as every other
// pack in this registry, with the staleness named rather than hidden.
//
// NETWORK CONSTRAINT, checked directly: the NYGS archive (held at
// ICPSR/NIJ) is outside this environment's outbound proxy allowlist
// (403 CONNECT). `fetchNygsData` throws with that reason; the
// transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: A sanity ceiling on a real membership rate, not a claim about any
//: real jurisdiction's actual rate — wide enough to admit genuine
//: outliers, narrow enough to catch a units mistake.
const MEMBERSHIP_RATE_BOUNDS = [0, 0.1];

//: The last year OJJDP ran this survey. Carried as a named constant so
//: a caller importing a record with a LATER year is told plainly that
//: no such wave exists, rather than silently accepting a fabricated
//: one.
const LAST_SURVEY_YEAR = 2012;

function isRealCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

// Turn a jurisdiction's real counts into a membership rate.
//
// Returns null where the population figure is missing — a rate
// against an unknown base is an invented denominator, not a rate.
function toMembershipRate(memberCount, population) {
  const members = isRealCount(memberCount);
  const pop = Number(population);
  if (members === null || !Number.isFinite(pop) || pop <= 0) return null;
  const rate = members / pop;
  return rate >= MEMBERSHIP_RATE_BOUNDS[0] && rate <= MEMBERSHIP_RATE_BOUNDS[1]
    ? Math.round(rate * 1000000) / 1000000
    : null;
}

// Attach a jurisdiction's real, dated NYGS figures to a location.
//
// `record`: `{ jurisdictionName, year, gangCount, memberCount,
// population }`. `year` cannot be later than `LAST_SURVEY_YEAR` — no
// wave exists after 2012, and accepting a later year would let a
// caller assert a survey that was never run.
function importNygsJurisdiction(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importNygsJurisdiction: no location with id ${locationId}`);
  if (!record.jurisdictionName) {
    throw new Error(
      'importNygsJurisdiction requires record.jurisdictionName — an unattributed estimate '
      + 'cannot be checked against the published survey.',
    );
  }
  const year = Number(record.year);
  if (!Number.isFinite(year) || year > LAST_SURVEY_YEAR) {
    throw new Error(
      `importNygsJurisdiction: ${record.year} is not a real NYGS wave — the survey ran `
      + `through ${LAST_SURVEY_YEAR} and was then discontinued. A later year cannot be `
      + 'asserted from a survey that does not exist.',
    );
  }

  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    gangActivity: {
      source: 'ojjdp-nygs',
      licence: 'public-domain',
      // **Carried on every row, not just in this file's header.** A
      // consumer reading the data directly, without this comment,
      // still sees exactly how old and how measured it is.
      staleness: `self-reported survey, last wave ${LAST_SURVEY_YEAR}; discontinued program, `
        + 'not current data',
      jurisdictionName: record.jurisdictionName,
      year,
      gangCount: isRealCount(record.gangCount),
      memberCount: isRealCount(record.memberCount),
      membershipRate: toMembershipRate(record.memberCount, record.population),
    },
    containsIndividualAttributes: false,
  });
  return location;
}

// ---------------------------------------------------------------------
// describeGangCoverage — how much, and how old
// ---------------------------------------------------------------------
function describeGangCoverage(worldLayer) {
  let jurisdictions = 0;
  let withRate = 0;
  const years = [];
  for (const location of worldLayer.locations || []) {
    const data = location.populationData?.gangActivity;
    if (data?.source !== 'ojjdp-nygs') continue;
    jurisdictions += 1;
    if (data.membershipRate !== null) withRate += 1;
    if (Number.isFinite(data.year)) years.push(data.year);
  }
  return {
    jurisdictions,
    withRate,
    withoutRate: jurisdictions - withRate,
    // The honest headline: how long ago the newest row in THIS import
    // is from, measured against the current year this runs in, not
    // asserted as "recent."
    newestYear: years.length ? Math.max(...years) : null,
    lastRealSurveyYear: LAST_SURVEY_YEAR,
  };
}

function fetchNygsData() {
  throw new Error(
    'fetchNygsData is not implemented: the NYGS archive (ICPSR/NIJ) is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly). READ THE '
    + 'HEADER FIRST: this survey was discontinued after 2012 and every figure it can supply '
    + 'is now over a decade old, self-reported by police agencies rather than measured. Pass '
    + '{ jurisdictionName, year, gangCount, memberCount, population } to '
    + 'importNygsJurisdiction(worldLayer, locationId, record).',
  );
}

module.exports = {
  MEMBERSHIP_RATE_BOUNDS,
  LAST_SURVEY_YEAR,
  toMembershipRate,
  importNygsJurisdiction,
  describeGangCoverage,
  fetchNygsData,
};
