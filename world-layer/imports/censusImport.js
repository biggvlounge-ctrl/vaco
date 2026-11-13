// Universal World Layer — U.S. Census Bureau (ACS) import.
//
// The American Community Survey publishes real demographic and economic
// distributions for every census tract in the United States, annually,
// as a U.S. Government Work — public domain, no conditions.
//
// ---------------------------------------------------------------------
// A tract is a neighbourhood, which is the grain that was missing
// ---------------------------------------------------------------------
// VACON-C generates age structure, household size, educational
// attainment and income from bands this project chose. They are honest
// guesses and they are identical everywhere, which is the real problem:
// `vacon-c/server/areaStats.js` exists to make neighbourhoods differ,
// and drawing every one of them from the same distribution works
// against it.
//
// ACS is published per tract — roughly a neighbourhood, a few thousand
// people — so it is the one source here whose grain matches what the
// engine calls a community.
//
// ---------------------------------------------------------------------
// §9's firewall applies to imported data exactly as it does to
// generated data, and importing does not soften it
// ---------------------------------------------------------------------
// `VACANCY_CONSOLIDATED_MASTER_SPEC.md` §9 permits demographic
// modelling and **forbids demographics determining morality,
// criminality, intelligence or worth.** That is a rule about what may
// READ a distribution, not about where the distribution came from —
// and real data makes it more important rather than less, because a
// measured number carries an authority an invented one does not.
//
// So this importer deliberately produces **distributions only**: age
// bands, household sizes, attainment shares, income quantiles. It
// produces no per-person attribute and nothing that could be read as a
// trait. `vacon-c/server/crime.js` already takes the corresponding care
// on the generated side — its header records that it "reads the
// environment, never the person" — and nothing here gives it a new
// thing to read.
//
// NETWORK CONSTRAINT, checked directly on 18 Sep 2026: `api.census.gov`
// is outside this environment's outbound proxy allowlist (403 CONNECT),
// as is every other source host. `fetchAcsTracts` throws with that
// reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: ACS educational-attainment groupings → `demographics.EDUCATION_LEVELS`.
//: The engine's six levels are its own vocabulary and ACS publishes a
//: different one, so this is a stated mapping rather than a coincidence.
//:
//: **`vocational` has no clean ACS equivalent and is not faked.** ACS
//: separates "some college, no degree" and "associate's degree", and
//: neither is what this engine means by a trade qualification. The
//: associate's share maps here as the closest available and the
//: mismatch is recorded on the result rather than buried, because a
//: caller comparing engine attainment to real attainment needs to know
//: which rung is approximate.
const ATTAINMENT_MAP = {
  less_than_high_school: 'none',
  high_school_graduate: 'basic',
  some_college: 'secondary',
  associates_degree: 'vocational',
  bachelors_degree: 'higher',
  graduate_or_professional: 'advanced',
};

const APPROXIMATE_RUNGS = ['vocational'];

//: ACS age brackets → the bands the engine's statistics report on.
//: `statistics.elder_share` filters at 65 and `economy.WORKING_AGE` is
//: 16, so those two boundaries are the engine's own and are honoured
//: rather than re-chosen.
const AGE_BANDS = [
  { key: 'child', from: 0, to: 15 },
  { key: 'working', from: 16, to: 64 },
  { key: 'elder', from: 65, to: null },
];

//: ACS table B02001's own seven race categories, duplicated here for
//: the cross-boundary reason the header gives, and cross-checked by
//: `vacon-c/server/racePacks.js`'s own test against this copy.
const RACE_CATEGORIES = [
  'white', 'black-or-african-american', 'american-indian-or-alaska-native',
  'asian', 'native-hawaiian-or-pacific-islander', 'some-other-race', 'two-or-more-races',
];

//: ACS table B12001's own five marital-status categories for
//: population 15+, duplicated for the same reason, cross-checked by
//: `vacon-c/server/maritalStatusPacks.js`'s own test.
const MARITAL_STATUS_CATEGORIES = ['never-married', 'now-married', 'separated', 'widowed', 'divorced'];

//: ACS table B05001's own five nativity/citizenship-status categories
//: (the sixth row, total population, is the universe, not a
//: category), duplicated for the same reason, cross-checked by
//: `vacon-c/server/nativityPacks.js`'s own test. CLAUDE.md's thirty-
//: third standing rule approved this source; see `nativityPacks.js`'s
//: header for why nativity and citizenship status are one real table
//: and one new field rather than two, and why year-of-entry (a real,
//: separate table, B05005) is not built this round.
const NATIVITY_CATEGORIES = [
  'us-born', 'born-in-territory', 'born-abroad-american-parent',
  'naturalized-citizen', 'non-citizen',
];

function shareOf(counts, total) {
  if (!total) return null;
  return Math.round((counts / total) * 10000) / 10000;
}

// Turn ACS counts into shares.
//
// **Shares, not counts, and that is the point.** A tract has ~4,000
// people and a generated community has ~30; copying counts across would
// be nonsense, while a distribution transfers cleanly at any
// population. The engine then draws its own people against a real
// shape.
function toDistribution(counts = {}) {
  const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
  if (total === 0) return null;
  const out = {};
  for (const [key, value] of Object.entries(counts)) {
    out[key] = shareOf(Number(value) || 0, total);
  }
  return out;
}

// Map ACS attainment counts onto the engine's six levels.
function attainmentDistribution(acsCounts = {}) {
  const mapped = {};
  const unmapped = [];
  for (const [acsKey, value] of Object.entries(acsCounts)) {
    const level = ATTAINMENT_MAP[acsKey];
    if (!level) {
      // Named, not folded into the nearest rung — a silent fold is how
      // a distribution ends up shaped by the mapping rather than by the
      // data.
      unmapped.push(acsKey);
      continue;
    }
    mapped[level] = (mapped[level] ?? 0) + (Number(value) || 0);
  }
  const distribution = toDistribution(mapped);
  return distribution === null ? null : { distribution, unmapped, approximate: APPROXIMATE_RUNGS };
}

// Import one ACS tract onto a location already in the layer — normally
// a community produced by `overtureImport.importOvertureDivisions`.
//
// `record` is a flattened ACS row: `{ tractId, population, ageCounts,
// householdSizes, attainment, medianHouseholdIncome, incomeQuantiles }`.
function importAcsTract(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importAcsTract: no location with id ${locationId}`);
  if (!record.tractId) {
    throw new Error('importAcsTract requires record.tractId — an unattributed statistic cannot be checked');
  }

  const attainment = record.attainment ? attainmentDistribution(record.attainment) : null;

  // **Four more real shapes, added 30 Oct 2026, same posture as every
  // one above: a distribution over a PLACE, never a per-person fact.**
  // `record.raceCounts` (table B02001) and `record.maritalStatusCounts`
  // (table B12001, population 15+) are multi-category, so they go
  // through the same `toDistribution` this file already uses for age
  // and household size. `record.disabilityCounts` (table B18101) and
  // `record.veteranCounts` (table B21001, civilian population 18+) are
  // each a single real share — "with a disability" / "veteran" against
  // their own table's own total — computed with `shareOf` the same way
  // `giniIndex` below is a single real number rather than a
  // distribution.
  const raceShares = record.raceCounts ? toDistribution(record.raceCounts) : null;
  const maritalStatusShares = record.maritalStatusCounts ? toDistribution(record.maritalStatusCounts) : null;
  const disabilityShare = record.disabilityCounts
    ? shareOf(
      Number(record.disabilityCounts.withDisability) || 0,
      (Number(record.disabilityCounts.withDisability) || 0)
        + (Number(record.disabilityCounts.withoutDisability) || 0),
    )
    : null;
  const veteranShare = record.veteranCounts
    ? shareOf(
      Number(record.veteranCounts.veteran) || 0,
      (Number(record.veteranCounts.veteran) || 0) + (Number(record.veteranCounts.nonveteran) || 0),
    )
    : null;

  // **A fifth real shape, added this round, same posture as the four
  // above.** `record.nativityCounts` (table B05001) is multi-category,
  // so it goes through the same `toDistribution` the race and marital-
  // status shares above use.
  const nativityShares = record.nativityCounts ? toDistribution(record.nativityCounts) : null;

  setLocationData(worldLayer, locationId, 'populationData', {
    source: 'us-census-acs',
    tractId: record.tractId,
    // The real head count for the tract, kept for reference. The engine
    // does not have to use it — a generated community is far smaller —
    // but a share with no idea of the population behind it cannot be
    // weighted against another tract.
    population: Number(record.population) || null,
    ageBands: record.ageCounts ? toDistribution(record.ageCounts) : null,
    householdSizes: record.householdSizes ? toDistribution(record.householdSizes) : null,
    attainment,
    raceShares,
    maritalStatusShares,
    disabilityShare,
    veteranShare,
    nativityShares,
    // **No per-person anything.** See the §9 note in the header: this
    // produces shapes, never people, and nothing here is readable as a
    // trait.
    containsIndividualAttributes: false,
  });

  const existingEconomic = location.economicData ?? {};
  // **`giniIndex` (ACS table B19083) — real, and sat next to
  // `medianHouseholdIncome`/`incomeQuantiles` with no reader on either
  // side for the life of this importer.** All three are written and
  // none had a VACON-C consumer until `incomePacks.js`.
  const gini = Number(record.giniIndex);
  setLocationData(worldLayer, locationId, 'economicData', {
    ...existingEconomic,
    source: 'us-census-acs',
    medianHouseholdIncome: Number(record.medianHouseholdIncome) || null,
    incomeQuantiles: record.incomeQuantiles ?? null,
    giniIndex: Number.isFinite(gini) && gini >= 0 && gini <= 1 ? gini : null,
  });

  return location;
}

// ---------------------------------------------------------------------
// describeAcsCoverage — what a region actually got
// ---------------------------------------------------------------------
// A tract import is partial by nature: ACS suppresses figures for small
// populations to protect privacy, so some tracts come back with gaps.
// That is a real property of the source and it is reported rather than
// smoothed, because a null share and a zero share are different facts.
function describeAcsCoverage(worldLayer) {
  const withAcs = (worldLayer.locations || [])
    .filter((l) => l.populationData?.source === 'us-census-acs');
  const missing = {
    ageBands: [], householdSizes: [], attainment: [], income: [],
    race: [], maritalStatus: [], disability: [], veteranStatus: [], nativity: [],
  };
  for (const location of withAcs) {
    if (!location.populationData.ageBands) missing.ageBands.push(location.name);
    if (!location.populationData.householdSizes) missing.householdSizes.push(location.name);
    if (!location.populationData.attainment) missing.attainment.push(location.name);
    if (!location.economicData?.medianHouseholdIncome) missing.income.push(location.name);
    if (!location.populationData.raceShares) missing.race.push(location.name);
    if (!location.populationData.maritalStatusShares) missing.maritalStatus.push(location.name);
    if (location.populationData.disabilityShare == null) missing.disability.push(location.name);
    if (location.populationData.veteranShare == null) missing.veteranStatus.push(location.name);
    if (!location.populationData.nativityShares) missing.nativity.push(location.name);
  }
  return {
    tracts: withAcs.length,
    // Suppressed by the Census Bureau for small populations, not lost
    // in transit. Naming them separately keeps the distinction.
    suppressedOrMissing: missing,
    approximateRungs: APPROXIMATE_RUNGS,
  };
}

function fetchAcsTracts() {
  throw new Error(
    'fetchAcsTracts is not implemented: api.census.gov is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). The intended '
    + 'path is the Census Data API — `/data/2022/acs/acs5?get=GROUP(B01001)&for=tract:*&in='
    + 'state:29` and the corresponding tables for household size (B11016), educational '
    + 'attainment (B15003), income (B19013), race (B02001), marital status (B12001, '
    + 'population 15+), disability status (B18101), veteran status (B21001, civilian '
    + 'population 18+) and nativity/citizenship status (B05001) — which needs a free API '
    + 'key. Pass the rows to importAcsTract(worldLayer, locationId, record).',
  );
}

module.exports = {
  ATTAINMENT_MAP,
  APPROXIMATE_RUNGS,
  AGE_BANDS,
  RACE_CATEGORIES,
  MARITAL_STATUS_CATEGORIES,
  NATIVITY_CATEGORIES,
  toDistribution,
  attainmentDistribution,
  importAcsTract,
  describeAcsCoverage,
  fetchAcsTracts,
};
