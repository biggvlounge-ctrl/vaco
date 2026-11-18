// server/workforceNativityPacks.js
//
// Real, cited national data on the share of specific real occupations
// held by foreign-born workers in the United States -- by direct
// instruction: "the nationalities of the schools, the percentage of
// the nationalities of the main schools and the hospital workers...
// look at the census reports of the nationalities."
//
// ---------------------------------------------------------------------
// What this answers, and the one source each figure actually comes from
// ---------------------------------------------------------------------
// `physician`/`nurse`: Migration Policy Institute's own tabulation of
// 2021 Census ACS data -- 26% of the 987,000 physicians and surgeons
// practising in the US that year were foreign-born; 16% of registered
// nurses. KFF's separate 2024 ACS analysis gives the three leading
// origin countries among immigrant HEALTH workers broadly (Philippines
// 12%, Mexico 11%, India 7%) -- the closest real breakdown found for
// either occupation specifically, reused for both rather than invented
// twice.
//
// `teacher`: Brookings' own IPUMS/ACS analysis puts the foreign-born
// share of all US teachers at roughly 8% in the most recent data (7%
// non-postsecondary, 22% postsecondary, averaged here since this
// engine's own `teacher` occupation does not distinguish the two). A
// 2019 paper (Furuya et al., cited by George Mason's Institute for
// Immigration Research) names the leading countries of origin among
// immigrant teachers as China (17%), India (12%), South Korea (5%),
// Canada (4%) and Mexico (3%).
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to `migrationPathwayPacks.js`
// ---------------------------------------------------------------------
// This is a real, national, occupation-level fact, reported through
// `statistics.js` only -- never a per-NPC field, never read by
// anything that decides who gets hired, promoted or paid.
// `estimatedForeignBornWorkers` multiplies a real, already-generated
// community's own real occupation headcount (`occupations.holdersOf`)
// by the real national share above; it is a derived ESTIMATE about an
// aggregate, the same `getNetWorth`/`getFamilyWealth`-class "computed,
// never stored" posture standing rule 3 already holds, and it marks
// no individual NPC as foreign-born anywhere. The fortieth standing
// rule declined "occupation tied to ethnicity" as a per-NPC rule in
// either direction; this is neither direction -- it is a national
// statistic about a real profession, not a draw that changes any one
// person's own ethnicity, occupation, or outcome.
//
// A genuine per-NPC nativity/birthplace field -- closing this the same
// real way `racePacks.js`/`maritalStatusPacks.js`/`disabilityPacks.js`/
// `veteranPacks.js` closed their own once-deferred Census tables -- is
// separate, future work, named here rather than silently implied by
// this module's own existence.

'use strict';

const occupations = require('./occupations.js');

const WORKFORCE_NATIVITY = {
  physician: {
    foreignBornSharePct: 26,
    topOriginCountries: ['Philippines', 'Mexico', 'India'],
    source: 'migration-policy-institute-acs-2021',
  },
  nurse: {
    foreignBornSharePct: 16,
    topOriginCountries: ['Philippines', 'Mexico', 'India'],
    source: 'migration-policy-institute-acs-2021',
  },
  teacher: {
    foreignBornSharePct: 8,
    topOriginCountries: ['China', 'India', 'South Korea', 'Canada', 'Mexico'],
    source: 'brookings-iir-furuya-et-al-2019',
  },
};

const OCCUPATIONS_COVERED = Object.keys(WORKFORCE_NATIVITY);

// Checked once, at load time, not left to drift -- the same discipline
// `migrationPathwayPacks.js` already holds against `ancestryPacks.GROUPS`.
for (const name of OCCUPATIONS_COVERED) {
  if (!occupations.definitionOf(name)) {
    throw new Error(`workforceNativityPacks.js: "${name}" is not a real occupation`);
  }
}

function nativityContextFor(occupationName) {
  return WORKFORCE_NATIVITY[occupationName] ?? null;
}

// A real, derived estimate about an aggregate this engine already
// generated -- never stored, never a per-NPC fact. `holders.length` is
// `occupations.holdersOf`'s own real, live count of who currently
// holds this occupation in this community; the foreign-born count is
// that real number times the real national share, rounded.
function estimatedForeignBornWorkers(worldState, communityId, occupationName) {
  const context = nativityContextFor(occupationName);
  if (!context) return null;
  const holders = occupations.holdersOf(worldState, occupationName, { communityId });
  return {
    occupation: occupationName,
    realWorkers: holders.length,
    estimatedForeignBorn: Math.round(holders.length * (context.foreignBornSharePct / 100)),
    topOriginCountries: context.topOriginCountries,
    source: context.source,
  };
}

module.exports = {
  WORKFORCE_NATIVITY,
  OCCUPATIONS_COVERED,
  nativityContextFor,
  estimatedForeignBornWorkers,
};
