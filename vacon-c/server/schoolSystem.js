// server/schoolSystem.js
//
// By direct instruction, continuing "the next five": school system
// depth -- grade/middle/high, private/religious (Christian/Jewish),
// performing-arts, and a real college/community-college inventory.
//
// ---------------------------------------------------------------------
// The real gap
// ---------------------------------------------------------------------
// `landmarks.js`'s own `school` and `university` categories have
// always been flat: one undifferentiated building each, with a real
// per-capita national rate (`REPEATABLE_DENSITY_PER_1K`) but no real
// internal structure. A real `school` building is not generically "a
// school" -- it is an elementary, middle, or secondary school, public
// or private, and a private one is disproportionately likely to carry
// a real religious affiliation. A real `university` is not generically
// "a university" either -- a majority of real degree-granting
// institutions are 4-year, and the rest are the real institution type
// everybody actually calls a community college.
//
// ---------------------------------------------------------------------
// `private-school` is the one new landmark category; everything else
// is a real ATTRIBUTE on an existing property
// ---------------------------------------------------------------------
// `landmarks.REPEATABLE_DENSITY_PER_1K.school`'s own comment already
// says its real NCES count (99,297) is PUBLIC schools only -- a
// private school is a real, separate population that count never
// covered, so it gets its own real, cited density entry
// (`'private-school'`) rather than a flag on the public count. Grade/
// middle/high level, religious affiliation, and the performing-arts
// flag are all real ATTRIBUTES this file writes onto whichever
// `school`/`private-school`/`university` properties a world already
// has -- never a second landmark category for each combination, which
// would multiply `CREW_BY_CATEGORY`/`KEY_BUILDING_TYPES` by a dozen
// entries all sharing the same real crew and operator shape.
//
// ---------------------------------------------------------------------
// The real, cited shares
// ---------------------------------------------------------------------
// - **School level** (public schools): NCES Digest of Education
//   Statistics, Table 216.30 (2021 edition), 2019-20 percentage
//   distribution -- elementary 53.1%, middle 16.5%, secondary/high
//   23.9%, other/ungraded 5.0% (sums to 98.5% as reported; normalized
//   here to sum to 1.0 for the draw, same shares otherwise). Reused
//   for private schools too -- no separate private-only level
//   breakdown was found, and public attendance patterns are the
//   closest real reference at hand.
// - **Private-school religious affiliation**: NCES Private School
//   Universe Survey, 2017-18 -- 28,141 private schools, 72.4% with a
//   religious orientation, 24.7% Roman Catholic. AVI CHAI Foundation's
//   own census of US Jewish day schools (Schick, 2013-14: 861 schools;
//   later reporting put the figure a little over 900) is a real,
//   independent count PSS's own "other religious" bucket does not
//   break out on its own -- carved out of that bucket the same way
//   `islamicSectPacks.js` already uses a separate Pew survey for a
//   sub-split its main religion source does not carry. ~900/28,141 is
//   the real Jewish share used here. **Not found, and not guessed**: a
//   PSS line item specifically for Jewish schools, or a specifically
//   "Christian" share distinct from "other religious" -- PSS's own
//   "other religious" bucket is overwhelmingly Christian denominations
//   but also carries other non-Catholic, non-Jewish faiths, and this
//   file reports it honestly as `other_religious` rather than
//   relabelling it `christian`.
// - **Performing arts**: **flagged interpretive.** No national census
//   of performing/visual-arts magnet high schools was found with the
//   tools at hand -- a small, declared, interpretive rate on secondary
//   schools, the same posture `COMMISSARY_CATALOG`'s own prices hold
//   in `penitentiary.js`.
// - **Institution type** (university properties): the cleanest real
//   split found is IPEDS/NSB Science & Engineering Indicators,
//   2015-16 degree-granting institutions -- 1,579 at the 2-year level,
//   3,004 at the 4-year level, out of 4,583 total (~34.5%/~65.5%).
//   `'community-college'` is the real, common name for the 2-year
//   case; this file uses it directly rather than the more technical
//   IPEDS phrasing.
//
// ---------------------------------------------------------------------
// In-memory only, the same declared posture this file's own siblings
// already hold
// ---------------------------------------------------------------------
// `property.schoolLevel`, `.religiousAffiliation`, `.performingArts`
// and `.institutionType` are real but have no column in
// `VACANCY_POSTGRESQL_SCHEMA.sql` -- the identical known, stated
// limitation `city.healthBaseline`/`worldState.familyTerritory`
// already carry. A world rebuilt from Postgres loses them, same as a
// world with `config.schoolSystemDepth` off.
'use strict';

const { seededDraw } = require('./seeded.js');

// NCES Digest of Education Statistics, Table 216.30 (2021 ed.),
// 2019-20 public-school level distribution, normalized to sum to 1.0.
const SCHOOL_LEVEL_BOUNDARIES = [
  ['elementary', 0.539],
  ['middle', 0.7065],
  ['secondary', 0.9491],
  ['other', 1],
];

// NCES PSS 2017-18 (Catholic/other-religious/nonsectarian) crossed
// with the AVI CHAI Foundation's own Jewish day-school census (see
// this file's own header for both).
const RELIGIOUS_AFFILIATION_BOUNDARIES = [
  ['catholic', 0.247],
  ['jewish', 0.279],
  ['other_religious', 0.724],
  ['nonsectarian', 1],
];

// Flagged interpretive -- see this file's own header.
const PERFORMING_ARTS_SECONDARY_RATE = 0.02;

// IPEDS/NSB 2015-16 degree-granting institutions: 1,579 of 4,583 were
// 2-year ("community college" in common usage).
const COMMUNITY_COLLEGE_SHARE = 1579 / 4583;

function drawFromBoundaries(boundaries, draw) {
  for (const [label, upperBound] of boundaries) {
    if (draw < upperBound) return label;
  }
  return boundaries[boundaries.length - 1][0];
}

function assignSchoolLevel(worldState, index) {
  const draw = seededDraw([worldState.seed ?? 'world', 'school-level', index]);
  return drawFromBoundaries(SCHOOL_LEVEL_BOUNDARIES, draw);
}

function assignReligiousAffiliation(worldState, index) {
  const draw = seededDraw([worldState.seed ?? 'world', 'private-school-affiliation', index]);
  return drawFromBoundaries(RELIGIOUS_AFFILIATION_BOUNDARIES, draw);
}

function isPerformingArts(worldState, index) {
  const draw = seededDraw([worldState.seed ?? 'world', 'performing-arts', index]);
  return draw < PERFORMING_ARTS_SECONDARY_RATE;
}

function assignInstitutionType(worldState, index) {
  const draw = seededDraw([worldState.seed ?? 'world', 'institution-type', index]);
  return draw < COMMUNITY_COLLEGE_SHARE ? 'community-college' : 'four-year';
}

// One real, idempotent pass: every real `school`/`private-school`
// property with no real level yet gets one (plus a real religious
// affiliation for the private ones, plus a real, flagged-interpretive
// chance of being a performing-arts secondary school), and every real
// `university` property with no real institution type yet gets one.
// Seeded on real POSITION within this pass's own filtered list, never
// on `property.id` -- standing rule 8.
function assignSchoolDepth(worldState) {
  const schools = (worldState.properties || []).filter(
    (p) => (p.landmark_category === 'school' || p.landmark_category === 'private-school')
      && p.schoolLevel == null,
  );
  schools.forEach((property, index) => {
    property.schoolLevel = assignSchoolLevel(worldState, index);
    if (property.landmark_category === 'private-school') {
      property.religiousAffiliation = assignReligiousAffiliation(worldState, index);
    }
    if (property.schoolLevel === 'secondary' && isPerformingArts(worldState, index)) {
      property.performingArts = true;
    }
  });

  const universities = (worldState.properties || []).filter(
    (p) => p.landmark_category === 'university' && p.institutionType == null,
  );
  universities.forEach((property, index) => {
    property.institutionType = assignInstitutionType(worldState, index);
  });
}

function schoolsOf(worldState, cityId) {
  return (worldState.properties || []).filter(
    (p) => p.city_id === cityId
      && (p.landmark_category === 'school' || p.landmark_category === 'private-school'),
  );
}

function universitiesOf(worldState, cityId) {
  return (worldState.properties || []).filter(
    (p) => p.city_id === cityId && p.landmark_category === 'university',
  );
}

// A real, computed-never-stored city rollup -- "college/community-
// college inventory" and its K-12 counterpart, read fresh every call.
function schoolSystemInventory(worldState, cityId) {
  const schools = schoolsOf(worldState, cityId);
  const universities = universitiesOf(worldState, cityId);

  const byLevel = {};
  for (const s of schools) {
    const key = s.schoolLevel ?? 'unknown';
    byLevel[key] = (byLevel[key] ?? 0) + 1;
  }
  const byReligiousAffiliation = {};
  for (const s of schools) {
    if (s.landmark_category !== 'private-school') continue;
    const key = s.religiousAffiliation ?? 'unknown';
    byReligiousAffiliation[key] = (byReligiousAffiliation[key] ?? 0) + 1;
  }
  const byInstitutionType = {};
  for (const u of universities) {
    const key = u.institutionType ?? 'unknown';
    byInstitutionType[key] = (byInstitutionType[key] ?? 0) + 1;
  }

  return {
    totalSchools: schools.length,
    publicSchools: schools.filter((s) => s.landmark_category === 'school').length,
    privateSchools: schools.filter((s) => s.landmark_category === 'private-school').length,
    performingArtsSchools: schools.filter((s) => s.performingArts === true).length,
    byLevel,
    byReligiousAffiliation,
    totalUniversities: universities.length,
    byInstitutionType,
  };
}

module.exports = {
  SCHOOL_LEVEL_BOUNDARIES,
  RELIGIOUS_AFFILIATION_BOUNDARIES,
  PERFORMING_ARTS_SECONDARY_RATE,
  COMMUNITY_COLLEGE_SHARE,
  assignSchoolLevel,
  assignReligiousAffiliation,
  isPerformingArts,
  assignInstitutionType,
  assignSchoolDepth,
  schoolsOf,
  universitiesOf,
  schoolSystemInventory,
};
