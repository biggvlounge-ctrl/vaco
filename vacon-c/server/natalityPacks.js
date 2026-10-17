// server/natalityPacks.js
//
// **A real age-specific fertility rate, for a curve `births.js` itself
// flags as invented.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `births.js#fertilityForAge` is a bell curve — peak at 27, floor at
// 15, ceiling at 45 — and its own header says plainly: "Flagged
// interpretive. No document gives a fertility curve." `BASE_ANNUAL_
// BIRTH_RATE` (0.14) is the same kind of number, chosen and then
// measured against a crude-birth-rate target rather than against a
// real age-specific one. CDC/NCHS Natality publishes a real age-
// specific fertility rate (ASFR) — births per 1,000 women, per county,
// per standard five-year age band — which is exactly this curve,
// measured rather than shaped.
//
// `teenage_birth_rate` (`statistics.js`) is already a real, computed
// statistic over whatever `births.js` generates. This closes the loop
// the twenty-seventh rule's whole thesis is about: the statistic was
// real and the generator feeding it was not.
//
// ---------------------------------------------------------------------
// A rate, not a share — and the shape that follows from that
// ---------------------------------------------------------------------
// Every other demographic pack in this project (`populationPacks.js`,
// `religionPacks.js`) reads a SHARE, bounded 0..1, that a population
// is partitioned across. A fertility rate is not a partition — several
// age bands do not sum to 1, and a real ASFR can run well past 100 per
// 1,000 at its peak. So this module validates a bounded RATE per band
// instead of a share, and there is no `pick`-style weighted draw: a
// bearer's age bins directly to the one band that contains it.
//
// ---------------------------------------------------------------------
// Resolved once per community, read every tick
// ---------------------------------------------------------------------
// Unlike a tract's age/attainment shares (read once, at the moment an
// NPC is generated), a bearer's age changes every tick `runBirths`
// runs. So `worldgen.js` resolves the real county ONCE, at generation,
// and stores the result on the community (`community.fertilityRates`)
// — the same "known, stated limitation: in-memory only" posture as
// `city.healthBaseline` and `city.hazardRisk`, for the same reason:
// `communities` has no such column in
// `VACANCY_POSTGRESQL_SCHEMA.sql`. `births.js` then reads it directly,
// every tick, with this module's `annualRateFor`.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as a tract
// ---------------------------------------------------------------------
// A county has no name an auto-generated community can be matched to.
// Counties are assigned by POSITION in the pack against the
// community's own index in the generation loop — standing rule 8
// (§88) — cycling if there are fewer counties than communities.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['cdc-natality', 'sample'];

//: NCHS's own standard five-year reporting bands for age-specific
//: fertility rate. `births.js`'s own `FERTILITY_MIN_AGE` (15) and
//: `FERTILITY_MAX_AGE` (45) bound the same range these bands cover.
const AGE_BANDS = ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44'];

//: [low, high) for each band, for binning a bearer's real age.
const AGE_BAND_RANGES = {
  '15-19': [15, 20],
  '20-24': [20, 25],
  '25-29': [25, 30],
  '30-34': [30, 35],
  '35-39': [35, 40],
  '40-44': [40, 45],
};

//: A sanity ceiling on a published rate, not a real physiological
//: limit. Real ASFRs have run above 250 per 1,000 for some populations
//: in some eras; this is wide enough to admit any real figure and
//: narrow enough to catch a typo (a share of 0.14 entered where a rate
//: of 140 was meant, for instance).
const RATE_BOUNDS = [0, 400];

function isRateObject(value) {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (!AGE_BANDS.includes(key)) return false;
    const rate = Number(value[key]);
    if (!Number.isFinite(rate) || rate < RATE_BOUNDS[0] || rate > RATE_BOUNDS[1]) return false;
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
  if (!Array.isArray(pack.counties) || pack.counties.length === 0) {
    problems.push('pack.counties must be a non-empty array');
    return problems;
  }

  pack.counties.forEach((county, i) => {
    const where = `counties[${i}]${county?.countyFips ? ` (${county.countyFips})` : ''}`;
    if (!county?.countyFips) problems.push(`${where}: countyFips is required`);
    if (!county?.ratesPerThousand || !isRateObject(county.ratesPerThousand)) {
      problems.push(`${where}: ratesPerThousand must be rates (${RATE_BOUNDS[0]}..${RATE_BOUNDS[1]}) `
        + `keyed on ${AGE_BANDS.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`natality pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, because a world with no pack must
// still generate.
function packFor(worldState) {
  return worldState?.natalityPack ?? null;
}

// The county for a community at this position, cycling if there are
// fewer counties than communities. Null when there is no pack.
function countyFor(pack, position) {
  if (!pack || !Array.isArray(pack.counties) || pack.counties.length === 0) return null;
  const index = ((position % pack.counties.length) + pack.counties.length) % pack.counties.length;
  return pack.counties[index];
}

// A county's real rates, or null — what `worldgen.js` stores on the
// community it resolves, and `births.js` reads from there every tick.
function ratesFor(county) {
  return county?.ratesPerThousand ?? null;
}

// The real annual probability (0..1) of a bearer of this age giving
// birth this year, against real rates — or null when there is none for
// this age or no rates at all. `BASE_ANNUAL_BIRTH_RATE *
// fertilityForAge(age)` is the fallback, not this module's.
function annualRateFor(rates, age) {
  if (!rates || !Number.isFinite(Number(age))) return null;
  const years = Number(age);
  const band = AGE_BANDS.find((b) => years >= AGE_BAND_RANGES[b][0] && years < AGE_BAND_RANGES[b][1]);
  if (!band) return null;
  const rate = Number(rates[band]);
  return Number.isFinite(rate) ? Math.round((rate / 1000) * 1000000) / 1000000 : null;
}

module.exports = {
  SOURCES,
  AGE_BANDS,
  AGE_BAND_RANGES,
  RATE_BOUNDS,
  validatePack,
  assertPack,
  packFor,
  countyFor,
  ratesFor,
  annualRateFor,
};
