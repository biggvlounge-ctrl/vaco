// server/incomePacks.js
//
// **Real median household income and a real Gini index, for a home
// value band this project chose with no document behind it.**
//
// **Added 30 Oct 2026: `valueRangeFor`'s own optional
// `activityMultiplier`.** `server/nightLightsPacks.js` reads a real
// VIIRS nighttime-light composite (`world-layer/imports/
// earthEngineImport.js`) as a second, independent real signal of the
// same underlying fact income already measures — compounding into
// this centre the same way `populationPacks.overdoseBaselineFor`
// compounds with `healthBaseline` in `mortality.diseasePressure`.
// See `nightLightsPacks.js`'s own header for the full reasoning.
//
// ---------------------------------------------------------------------
// The gap this closes — and the one it closes alongside it
// ---------------------------------------------------------------------
// `worldgen.js` draws every home's `value` from `random.range(4000,
// 60000, 'value', ...)` — a flat band, identical in every community in
// every city, with no citation. `world-layer/imports/censusImport.js`
// has written real ACS `medianHouseholdIncome` and `incomeQuantiles`
// onto `economicData` since this session's first round, and **neither
// had a VACON-C reader at all** — found while building this, the same
// shape as the twenty-seventh standing rule: a real import sitting
// unread next to ones that already had a join.
//
// A real Gini index (ACS table B19083) is the second real input: it is
// what decides how WIDE a real income distribution is, independent of
// its centre, and is exactly the number a home-value SPREAD needs that
// a flat band cannot express.
//
// ---------------------------------------------------------------------
// Why this scales a band rather than replacing it with quantiles directly
// ---------------------------------------------------------------------
// `incomeQuantiles` are a real distribution ACS publishes, but a home's
// `value` is a PROPERTY fact, not a HOUSEHOLD income fact — the two
// correlate but are not the same number, and there is no published
// ratio between them this project could cite. So the real inputs scale
// the EXISTING invented band's shape (its centre and its spread)
// rather than being read as a value directly, which keeps the honest
// line between "a real number" and "an invented relationship between
// two real numbers" where CLAUDE.md's own practice draws it.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as a tract
// ---------------------------------------------------------------------
// A tract has no name an auto-generated community can be matched to.
// Counties/tracts are assigned by POSITION — standing rule 8 (§88).

'use strict';

const SOURCES = ['us-census-acs', 'sample'];

//: A real Gini index is 0 (perfect equality) to 1 (perfect
//: inequality). ACS publishes values in roughly the 0.3-0.55 range for
//: U.S. tracts; the full 0..1 range is validated rather than that
//: narrower band, because a real tract outside the typical range is
//: still a real tract, not a data error.
const GINI_BOUNDS = [0, 1];

//: The invented band's own centre and half-width, in dollars —
//: `worldgen.js`'s `random.range(4000, 60000, ...)`, duplicated here
//: so a real income can scale it proportionally rather than this
//: module inventing a second relationship between income and value.
const INVENTED_VALUE_RANGE = [4000, 60000];

//: How much a tract's Gini WIDENS the invented range's own spread,
//: relative to a flagged "ordinary" Gini — 0.4 is in the middle of
//: ACS's typical published range. **Flagged interpretive**, same
//: posture as `cdcImport.ORDINARY_CHRONIC_PREVALENCE`: a reference
//: point, not a claim, and a caller with a better figure should pass
//: its own.
const ORDINARY_GINI = 0.4;

//: The reference median household income a tract's own real figure is
//: scaled AGAINST to move the invented band's centre. **Flagged
//: interpretive, not independently re-verified this session** — this
//: environment has no live network access to confirm a current
//: figure, same constraint as every rate in this registry. Chosen
//: against the rough order of recent published U.S. median household
//: income; a caller with a current, cited figure should pass its own.
const ORDINARY_MEDIAN_INCOME = 70000;

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
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
    if (tract.medianHouseholdIncome !== undefined && tract.medianHouseholdIncome !== null
      && !isPositiveNumber(tract.medianHouseholdIncome)) {
      problems.push(`${where}: medianHouseholdIncome must be a positive number`);
    }
    if (tract.giniIndex !== undefined && tract.giniIndex !== null) {
      const value = Number(tract.giniIndex);
      if (!Number.isFinite(value) || value < GINI_BOUNDS[0] || value > GINI_BOUNDS[1]) {
        problems.push(`${where}: giniIndex must be between ${GINI_BOUNDS[0]} and ${GINI_BOUNDS[1]}`);
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`income pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.incomePack ?? null;
}

// The tract for a community at this position, cycling if there are
// fewer tracts than communities. Null when there is no pack.
function tractFor(pack, position) {
  if (!pack || !Array.isArray(pack.tracts) || pack.tracts.length === 0) return null;
  const index = ((position % pack.tracts.length) + pack.tracts.length) % pack.tracts.length;
  return pack.tracts[index];
}

// A real [low, high] home-value range for this tract — the invented
// band, re-centred on real median income and re-spread by real
// inequality — or null when the tract has neither figure and no real
// `activityMultiplier` was supplied either. `worldgen.js` draws within
// this range exactly as it draws within the invented one.
//
// `options.activityMultiplier` is `nightLightsPacks.activityMultiplierFor`'s
// own real, bounded figure — a SECOND, independent real signal that
// further scales the centre, the same "compound, don't replace" shape
// `populationPacks.overdoseBaselineFor` already takes compounding with
// `healthBaseline` in `mortality.diseasePressure`. Defaults to 1 (no
// change) so every existing call site is unaffected.
//
// `options.landCoverMultiplier` is `landCoverPacks.homeValueMultiplierFor`'s
// own real, bounded nudge — a THIRD, independent real signal, same
// compounding shape, same default of 1. Added 30 Oct 2026.
function valueRangeFor(tract, options = {}) {
  const { activityMultiplier = 1, landCoverMultiplier = 1 } = options;
  const income = Number(tract?.medianHouseholdIncome);
  const gini = Number(tract?.giniIndex);
  const hasIncome = Number.isFinite(income) && income > 0;
  const hasGini = Number.isFinite(gini) && gini >= GINI_BOUNDS[0] && gini <= GINI_BOUNDS[1];
  const hasActivity = Number.isFinite(activityMultiplier) && activityMultiplier !== 1;
  const hasLandCover = Number.isFinite(landCoverMultiplier) && landCoverMultiplier !== 1;
  if (!hasIncome && !hasGini && !hasActivity && !hasLandCover) return null;

  const [inventedLow, inventedHigh] = INVENTED_VALUE_RANGE;
  const inventedCentre = (inventedLow + inventedHigh) / 2;
  const inventedHalfWidth = (inventedHigh - inventedLow) / 2;

  // Real income moves the centre, proportionally to how the invented
  // band's own centre related to its bounds — there is no cited
  // income-to-value ratio, so the invented band's own shape is what
  // real income scales rather than this module inventing a second one.
  const incomeCentre = hasIncome ? inventedCentre * (income / ORDINARY_MEDIAN_INCOME) : inventedCentre;
  // Two real, independent further signals compound onto that centre —
  // the same way a second disease baseline compounds rather than
  // replaces. 1 when neither was supplied, so this is a no-op.
  const centre = incomeCentre
    * (Number.isFinite(activityMultiplier) ? activityMultiplier : 1)
    * (Number.isFinite(landCoverMultiplier) ? landCoverMultiplier : 1);
  // Real inequality widens or narrows the spread around that centre,
  // relative to the flagged ordinary reference.
  const halfWidth = hasGini ? inventedHalfWidth * (gini / ORDINARY_GINI) : inventedHalfWidth;

  const low = Math.max(1, Math.round(centre - halfWidth));
  const high = Math.max(low + 1, Math.round(centre + halfWidth));
  return [low, high];
}

module.exports = {
  SOURCES,
  GINI_BOUNDS,
  INVENTED_VALUE_RANGE,
  ORDINARY_GINI,
  ORDINARY_MEDIAN_INCOME,
  validatePack,
  assertPack,
  packFor,
  tractFor,
  valueRangeFor,
};
