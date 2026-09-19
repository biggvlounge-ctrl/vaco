// Universal World Layer — FBI Crime Data Explorer import.
//
// **The outside reference CLAUDE.md's seventeenth standing rule says
// cost this project four wrong thresholds in a row.**
//
// ---------------------------------------------------------------------
// Why this one is different from the rest of the registry
// ---------------------------------------------------------------------
// Every other importer here fills a field. This one calibrates a
// CONSTANT, and the constant is currently wrong by a measured factor of
// about two and a half.
//
// `vacon-c/server/crime.js` sets `DANGER_REFERENCE_PER_1K = 40` — the
// incidents per thousand residents per year at which an area reads as
// maximally dangerous — and flags it interpretive, correctly, because
// no document set one. Measured on a generated world at 600 ticks, the
// per-area annual rates came out **108, 140, 154 and 167 per 1,000**,
// with the fifth area at zero. Every populated area is two to four
// times over the reference, so `communities.crime` reads 100 in every
// area where anything at all has happened and 0 where nothing has.
// The field has two reachable values.
//
// The seventeenth rule's own closing note says the right reference is
// usually inside the model, and warns that reaching for a real-world
// crime rate "imports a society with a functioning state, while every
// area in a generated world here measures as contested". **Both halves
// of that stay true and this importer is built for the half it does not
// cover**: the rule is about where to set a FLOOR for who escalates,
// and this is about what a DISPLAYED 0-100 scale is anchored to. A
// player reading "crime: 100" in four neighbourhoods out of five is not
// being told about a society, they are being told the scale is broken.
//
// ---------------------------------------------------------------------
// What it publishes, and the one honest way to use it
// ---------------------------------------------------------------------
// The FBI's Crime Data Explorer publishes offence counts and rates per
// 100,000 population, per agency, state and nation, annually, under
// UCR summary and NIBRS. It is a U.S. Government Work.
//
// **Per 100,000 is converted to per 1,000 here and nowhere else**, so
// there is exactly one place the factor of a hundred can be wrong.
//
// NETWORK CONSTRAINT, checked directly: `api.usa.gov` and `cde.ucr.cjis.gov`
// are outside this environment's outbound proxy allowlist (403 CONNECT).
// `fetchCrimeData` throws with that reason; the transform is tested.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: NIBRS/UCR offence groups → `crime.CATEGORIES`. The engine has eight
//: categories and generates five of them; `drug` is mapped even though
//: `crime.js` records it as ungenerated, because a reference rate for a
//: category the engine cannot produce is still the right shape to hold
//: — and the alternative, dropping it, would make the published total
//: disagree with the sum of its parts.
const OFFENCE_MAP = {
  'aggravated-assault': 'violent',
  robbery: 'violent',
  homicide: 'violent',
  'simple-assault': 'violent',
  burglary: 'property',
  arson: 'property',
  vandalism: 'property',
  'larceny-theft': 'theft',
  'motor-vehicle-theft': 'theft',
  'weapons-offense': 'gun',
  fraud: 'fraud',
  embezzlement: 'fraud',
  'drug-offense': 'drug',
  'rape': 'sex_offense',
  'sexual-assault': 'sex_offense',
};

const OFFENCE_NAMES = Object.keys(OFFENCE_MAP);

//: The engine's categories this map can reach. `domestic` is absent and
//: that is a real gap rather than an oversight: UCR does not publish a
//: domestic-violence offence class — domestic incidents appear under
//: assault, which is already mapped to `violent`. Folding it in would
//: double-count, and inventing a share would be worse.
const UNREACHED_CATEGORIES = {
  domestic: 'UCR publishes no domestic class — these appear under assault, already mapped '
    + 'to violent. Splitting them would need a share nobody publishes.',
};

const PER_100K = 100000;
const PER_1K = 1000;

// Convert the FBI's published rate to the engine's unit.
//
// **The only place the factor of a hundred lives.**
function per1kFrom100k(ratePer100k) {
  // **`Number(null)` is 0 and 0 is finite.** The first version of this
  // guarded with `Number.isFinite(Number(x))` alone and returned a rate
  // of zero for a figure nobody reported — which, in a function whose
  // output is about to calibrate a constant, would have quietly pulled
  // the reference down for every suppressed offence. CLAUDE.md's own
  // corollary, and its own test caught it.
  if (ratePer100k === null || ratePer100k === undefined || ratePer100k === '') return null;
  const rate = Number(ratePer100k);
  if (!Number.isFinite(rate)) return null;
  return Math.round((rate / PER_100K) * PER_1K * 1000) / 1000;
}

function categoryFor(offence) {
  return OFFENCE_MAP[offence] ?? null;
}

// Turn published offence rates into a per-category reference table.
//
// `rows`: `[{ offence, ratePer100k }]`. Returns rates per 1,000 per
// year per engine category, plus the total — which is the number
// `DANGER_REFERENCE_PER_1K` is trying to be.
function toReferenceRates(rows) {
  if (!Array.isArray(rows)) throw new Error('toReferenceRates requires an array of offence rows');

  const byCategory = {};
  const unmapped = [];
  let total = 0;

  for (const row of rows) {
    const category = categoryFor(row?.offence);
    const rate = per1kFrom100k(row?.ratePer100k);
    if (rate === null) continue;
    if (category === null) {
      // A real published offence this engine has no category for.
      // Counted into the total anyway — a society's crime rate does
      // not shrink because a model cannot represent part of it — and
      // named, so the gap is visible.
      unmapped.push({ offence: row?.offence ?? null, ratePer1k: rate });
      total += rate;
      continue;
    }
    byCategory[category] = Math.round(((byCategory[category] ?? 0) + rate) * 1000) / 1000;
    total += rate;
  }

  return {
    byCategory,
    unmappedOffences: unmapped,
    totalPer1k: Math.round(total * 1000) / 1000,
    // **The share of a real crime rate this engine can represent.** Not
    // an error — the model's scope, stated, the same way
    // `blsImport.toEmploymentShape` reports `modelledShare`.
    modelledShare: total === 0
      ? null
      : Math.round((Object.values(byCategory).reduce((a, b) => a + b, 0) / total) * 1000) / 1000,
    unreachedCategories: UNREACHED_CATEGORIES,
  };
}

// Attach a jurisdiction's crime reference to a location.
function importCrimeRates(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importCrimeRates: no location with id ${locationId}`);
  if (!record.ori && !record.stateAbbr) {
    throw new Error(
      'importCrimeRates requires record.ori (an agency identifier) or record.stateAbbr — '
      + 'an unattributed crime rate cannot be checked, and this one is going to be used to '
      + 'calibrate a constant.',
    );
  }

  const reference = toReferenceRates(record.rows ?? []);
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    crimeReference: {
      source: 'fbi-cde',
      licence: 'public-domain',
      ori: record.ori ?? null,
      stateAbbr: record.stateAbbr ?? null,
      agencyName: record.agencyName ?? null,
      year: record.year ?? null,
      ratesPer1k: reference.byCategory,
      totalPer1k: reference.totalPer1k,
      modelledShare: reference.modelledShare,
      unmappedOffences: reference.unmappedOffences,
    },
    // §9 again, and it matters more here than anywhere else in the
    // registry: this is a rate for a PLACE and never an attribute of a
    // person. `crime.js`'s own header says it "reads the environment,
    // never the person", and nothing imported here gives it a new thing
    // to read about anybody.
    containsIndividualAttributes: false,
  });
  return location;
}

// ---------------------------------------------------------------------
// describeCalibration — what the engine's constant would become
// ---------------------------------------------------------------------
// **Reports; does not set.** Changing `crime.DANGER_REFERENCE_PER_1K`
// from this repository would be reaching across the app boundary that
// `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md` exists to keep — world-layer
// publishes data, VACON-C decides what to do with it.
//
// `currentReference` is passed in rather than imported for the same
// reason, so this file never has to know what the engine's constant is
// today.
function describeCalibration(worldLayer, currentReference = null) {
  const references = [];
  for (const location of worldLayer.locations || []) {
    const reference = location.populationData?.crimeReference;
    if (reference?.source === 'fbi-cde') references.push(reference);
  }
  if (references.length === 0) {
    return { places: 0, medianTotalPer1k: null, currentReference, ratio: null };
  }

  const totals = references.map((r) => r.totalPer1k).filter(Number.isFinite).sort((a, b) => a - b);
  const median = totals.length === 0
    ? null
    : totals[Math.floor(totals.length / 2)];

  return {
    places: references.length,
    medianTotalPer1k: median,
    lowestTotalPer1k: totals[0] ?? null,
    highestTotalPer1k: totals[totals.length - 1] ?? null,
    currentReference,
    // How far the engine's constant sits from real published rates.
    // Above 1 means the engine calls a place maximally dangerous at a
    // rate real jurisdictions exceed routinely.
    ratio: currentReference && median
      ? Math.round((median / currentReference) * 100) / 100
      : null,
    note: 'Reported, not applied. VACON-C owns its own constant; this says what the '
      + 'published rates are so the choice is made against something.',
  };
}

function fetchCrimeData() {
  throw new Error(
    'fetchCrimeData is not implemented: cde.ucr.cjis.gov and api.usa.gov are outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly). The Crime '
    + 'Data Explorer API needs a free api.data.gov key; the annual summary tables at '
    + 'cde.ucr.cjis.gov need none. Pass { ori | stateAbbr, year, rows: [{ offence, '
    + `ratePer100k }] } to importCrimeRates(worldLayer, locationId, record). Known offences: ${OFFENCE_NAMES.join(', ')}.`,
  );
}

module.exports = {
  OFFENCE_MAP,
  OFFENCE_NAMES,
  UNREACHED_CATEGORIES,
  per1kFrom100k,
  categoryFor,
  toReferenceRates,
  importCrimeRates,
  describeCalibration,
  fetchCrimeData,
};
