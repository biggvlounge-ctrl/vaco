// Universal World Layer — CDC/NCHS drug overdose mortality import.
//
// **A second real excess-mortality signal, for the same multiplier
// `cdcImport.js` already feeds — not a new one.**
//
// ---------------------------------------------------------------------
// Why this folds into the existing mechanism rather than inventing one
// ---------------------------------------------------------------------
// `vacon-c/server/crime.js` is explicit that no drug mechanism exists
// in this engine at all — its own `CATEGORIES.drug` entry says "no
// substance, contraband or trade in one exists... a drug offence has
// no object" — and `mortality.js`'s `DEATH_CAUSES` has no "overdose"
// entry either. Building either of those from this importer would be
// designing a new game mechanic under the name of a data import, which
// is a decision for whoever owns this engine's scope, not something a
// pack reader gets to introduce as a side effect.
//
// What DOES already exist, and generically: `mortality.diseasePressure`
// multiplies a city's baseline mortality pressure by every active
// condition's `mortalityMultiplier`, and `populationPacks.
// healthBaselineFor` already supplies a real, place-level baseline
// from CDC PLACES chronic-disease prevalence. A county's real overdose
// death rate is the same KIND of fact — excess mortality a place
// genuinely carries — at a different real source and a different real
// grain (NCHS mortality statistics, county-level, not CDC PLACES'
// tract-level prevalence model). So it is a SECOND real input to the
// same multiplier, not a new mechanism: `populationPacks.js` reads it
// as `overdoseBaseline`, independent of and compounding with
// `healthBaseline`.
//
// ---------------------------------------------------------------------
// The ordinary reference is flagged, same posture as cdcImport's own
// ---------------------------------------------------------------------
// NCHS reports a real published rate — deaths per 100,000 per year —
// and this importer centres it on a reference "ordinary" rate the same
// way `cdcImport.ORDINARY_CHRONIC_PREVALENCE` centres chronic-disease
// prevalence. **That reference is flagged interpretive, not verified
// against the current year's actual national figure** — this
// environment has no live network access to confirm one, same as
// every other source in this registry, and a caller with a better
// reference should pass its own via `options.ordinary`.
//
// ---------------------------------------------------------------------
// §9 applies exactly as it does everywhere else in this registry
// ---------------------------------------------------------------------
// A death rate is a fact about a PLACE, aggregated over everyone who
// died there of this cause in a year — never a fact about any one
// person's substance use. Nothing here produces a per-person
// attribute, and `containsIndividualAttributes: false` says so.
//
// NETWORK CONSTRAINT, checked directly: `wonder.cdc.gov` is outside
// this environment's outbound proxy allowlist (403 CONNECT).
// `fetchOverdoseRates` throws with that reason; the transform is the
// tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: **Flagged interpretive.** NCHS publishes a real age-adjusted rate;
//: this is the baseline that reads as "ordinary" rather than elevated,
//: chosen against the rough order of recent published national
//: figures and not independently re-verified this session (the
//: network constraint above applies to checking this exactly as much
//: as to fetching a county's own rate). A caller with a current,
//: cited national figure should pass it as `options.ordinary`.
const ORDINARY_OVERDOSE_RATE_PER_100K = 30;

//: Same bound `cdcImport.PRESSURE_BOUNDS` uses, for the same reason:
//: an unbounded multiplier on mortality is a way to empty a world by
//: arithmetic, and a published rate is an estimate with real year-to-
//: year volatility.
const PRESSURE_BOUNDS = [0.75, 1.75];

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// Turn a county's overdose death rate into a baseline mortality
// multiplier, centred on 1 for an ordinary county.
//
// **`Number(null)` is 0 and 0 is finite**, so a missing or suppressed
// rate is checked for explicitly before the numeric conversion — NCHS
// suppresses county rates built on small counts, and a suppressed
// rate must not read as a county with no overdose deaths at all.
function toOverdosePressure(ratePer100k, options = {}) {
  const { ordinary = ORDINARY_OVERDOSE_RATE_PER_100K } = options;
  if (ratePer100k === null || ratePer100k === undefined || ratePer100k === '') {
    return { pressure: null, ratePer100k: null };
  }
  const rate = Number(ratePer100k);
  if (!Number.isFinite(rate) || rate < 0) {
    return { pressure: null, ratePer100k: null };
  }
  return {
    pressure: Math.round(clamp(rate / ordinary, ...PRESSURE_BOUNDS) * 1000) / 1000,
    ratePer100k: rate,
  };
}

// Attach a county's real overdose mortality baseline to a location.
//
// `record`: `{ countyFips, countyName, year, ratePer100k }`.
function importOverdoseRates(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importOverdoseRates: no location with id ${locationId}`);
  if (!record.countyFips) {
    throw new Error(
      'importOverdoseRates requires record.countyFips — an unattributed death rate cannot '
      + 'be checked against the published table.',
    );
  }

  const result = toOverdosePressure(record.ratePer100k, record);
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    overdoseMortality: {
      source: 'cdc-overdose',
      licence: 'public-domain',
      countyFips: record.countyFips,
      countyName: record.countyName ?? null,
      year: record.year ?? null,
      ratePer100k: result.ratePer100k,
      // The multiplier `populationPacks.overdoseBaselineFor` reads, in
      // place of the implicit 1 an unmeasured county carries — the
      // same shape `cdcImport`'s `healthPrevalence.baselinePressure`
      // already has.
      baselinePressure: result.pressure,
    },
    // §9. A rate for a PLACE's deaths, never an attribute of a person.
    containsIndividualAttributes: false,
  });
  return location;
}

// ---------------------------------------------------------------------
// describeOverdoseCoverage
// ---------------------------------------------------------------------
function describeOverdoseCoverage(worldLayer) {
  let counties = 0;
  let withRate = 0;
  const rates = [];
  for (const location of worldLayer.locations || []) {
    const data = location.populationData?.overdoseMortality;
    if (data?.source !== 'cdc-overdose') continue;
    counties += 1;
    if (data.baselinePressure !== null) {
      withRate += 1;
      rates.push(data.ratePer100k);
    }
  }
  rates.sort((a, b) => a - b);
  return {
    counties,
    withRate,
    // Suppressed by NCHS for small counts, not lost in transit.
    suppressedOrMissing: counties - withRate,
    medianRatePer100k: rates.length ? rates[Math.floor(rates.length / 2)] : null,
  };
}

function fetchOverdoseRates() {
  throw new Error(
    'fetchOverdoseRates is not implemented: wonder.cdc.gov is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, checked directly). CDC WONDER\'s Underlying '
    + 'Cause of Death module (drug-induced causes) publishes county-level rates with no '
    + 'key. Pass { countyFips, countyName, year, ratePer100k } to '
    + 'importOverdoseRates(worldLayer, locationId, record).',
  );
}

module.exports = {
  ORDINARY_OVERDOSE_RATE_PER_100K,
  PRESSURE_BOUNDS,
  toOverdosePressure,
  importOverdoseRates,
  describeOverdoseCoverage,
  fetchOverdoseRates,
};
