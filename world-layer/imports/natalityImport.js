// Universal World Layer — CDC/NCHS Natality import.
//
// **A real age-specific fertility rate, for a curve
// `vacon-c/server/births.js` labels invented.**
//
// ---------------------------------------------------------------------
// What it closes
// ---------------------------------------------------------------------
// `births.js#fertilityForAge` is a bell curve peaking at age 27 and
// `BASE_ANNUAL_BIRTH_RATE` is 0.14 — both flagged interpretive, both
// chosen rather than measured, in that file's own words: "no document
// gives a fertility curve." The National Center for Health
// Statistics' Natality public-use files report a real age-specific
// fertility rate (ASFR) — live births per 1,000 women, per county,
// per standard five-year age band, annually — which is exactly this
// curve, measured instead of shaped. `statistics.js`'s
// `teenage_birth_rate` is already a real, computed statistic over
// whatever `births.js` generates; this closes the twenty-seventh
// standing rule's loop for it — a real statistic over a generator that
// was not.
//
// It is a U.S. Government Work, published by NCHS as downloadable
// tables: public domain, no key.
//
// ---------------------------------------------------------------------
// A rate, not a share
// ---------------------------------------------------------------------
// Every other demographic source here (`censusImport`, `cdcImport`,
// `religionImport`) produces a SHARE a population is partitioned
// across, summing to (approximately) 1. An age-specific fertility rate
// is not a partition — six age bands do not sum to anything in
// particular, and a real ASFR commonly runs into the tens or low
// hundreds per 1,000 at its peak. This importer carries rates, not
// shares, and `vacon-c/server/natalityPacks.js` validates them as
// such.
//
// ---------------------------------------------------------------------
// §9 applies exactly as it does everywhere else in this registry
// ---------------------------------------------------------------------
// A rate is a fact about a PLACE's births, aggregated over every woman
// in an age band — never a fact about one person's fertility, body or
// choices. This importer produces nothing a consumer could read as a
// per-person attribute, and `containsIndividualAttributes: false` says
// so on every row, same as `censusImport` and `cdcImport`.
//
// NETWORK CONSTRAINT, checked directly: `wonder.cdc.gov` and
// `data.cdc.gov` are outside this environment's outbound proxy
// allowlist (403 CONNECT). `fetchNatalityRates` throws with that
// reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: NCHS's own standard five-year reporting bands for age-specific
//: fertility rate — the same six `vacon-c/server/natalityPacks.js`
//: validates against, duplicated here for the same deployment reason
//: every pair of importer/reader modules in this registry duplicates
//: its vocabulary, and cross-checked by test.
const AGE_BANDS = ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44'];

//: A sanity ceiling on a published rate, not a physiological limit —
//: see `natalityPacks.js`'s own note on why 400 and not 1 (this is a
//: rate per 1,000, not a share).
const RATE_BOUNDS = [0, 400];

function isRealRate(value) {
  // **`Number(null)` is 0 and 0 is finite**, so the missing check has
  // to come first — the same corollary `cdcImport.toHealthPressure`
  // and `fbiImport.per1kFrom100k` both guard against. A suppressed
  // rate reading as 0 births would drag a county's whole curve toward
  // "nobody here has children" rather than "this figure was not
  // published."
  if (value === null || value === undefined || value === '') return false;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= RATE_BOUNDS[0] && rate <= RATE_BOUNDS[1];
}

// Turn NCHS rate rows into a validated rate-per-band object.
//
// `rates` is `{ <band>: <births per 1,000 women in that band> }`.
// **An out-of-range or unrecognised band is named and dropped, never
// silently clamped or folded into its neighbour** — the same rule
// every importer in this registry holds a published figure to.
function toRateShape(rates = {}) {
  const byBand = {};
  const dropped = [];
  for (const [band, value] of Object.entries(rates)) {
    if (!AGE_BANDS.includes(band)) {
      dropped.push({ band, value, reason: 'not an NCHS age band this importer knows' });
      continue;
    }
    if (!isRealRate(value)) {
      dropped.push({ band, value, reason: 'not a usable rate (suppressed, or out of range)' });
      continue;
    }
    byBand[band] = Number(value);
  }
  return { byBand, dropped };
}

// Attach a county's real age-specific fertility rates to a location.
//
// `record`: `{ countyFips, countyName, year, rates: { <band>: <rate
// per 1,000> } }`.
function importNatalityRates(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importNatalityRates: no location with id ${locationId}`);
  if (!record.countyFips) {
    throw new Error(
      'importNatalityRates requires record.countyFips — an unattributed birth rate cannot '
      + 'be checked against the published table.',
    );
  }

  const { byBand, dropped } = toRateShape(record.rates ?? {});
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    natality: {
      source: 'cdc-natality',
      licence: 'public-domain',
      countyFips: record.countyFips,
      countyName: record.countyName ?? null,
      year: record.year ?? null,
      // Real births per 1,000 women, per age band — a rate over the
      // place's women in that band, never a fact about any one of
      // them.
      ratesPerThousand: Object.keys(byBand).length > 0 ? byBand : null,
      droppedBands: dropped,
    },
    // §9. A rate for a PLACE's births, never an attribute of a person.
    containsIndividualAttributes: false,
  });
  return location;
}

// ---------------------------------------------------------------------
// describeNatalityCoverage — how much of the real curve is covered
// ---------------------------------------------------------------------
function describeNatalityCoverage(worldLayer) {
  let counties = 0;
  let withRates = 0;
  const bandCoverage = {};
  for (const band of AGE_BANDS) bandCoverage[band] = 0;

  for (const location of worldLayer.locations || []) {
    const natality = location.populationData?.natality;
    if (natality?.source !== 'cdc-natality') continue;
    counties += 1;
    if (natality.ratesPerThousand) {
      withRates += 1;
      for (const band of Object.keys(natality.ratesPerThousand)) {
        if (band in bandCoverage) bandCoverage[band] += 1;
      }
    }
  }
  return {
    counties,
    withRates,
    withoutRates: counties - withRates,
    bandCoverage,
  };
}

function fetchNatalityRates() {
  throw new Error(
    'fetchNatalityRates is not implemented: wonder.cdc.gov and data.cdc.gov are outside '
    + 'this environment\'s outbound proxy allowlist (403 CONNECT, checked directly). NCHS '
    + 'Natality public-use files are downloadable with no key; CDC WONDER\'s Natality '
    + 'module computes age-specific fertility rate per county with no key either. Pass '
    + `{ countyFips, countyName, year, rates } to importNatalityRates(worldLayer, locationId, record). Bands: ${AGE_BANDS.join(', ')}.`,
  );
}

module.exports = {
  AGE_BANDS,
  RATE_BOUNDS,
  toRateShape,
  importNatalityRates,
  describeNatalityCoverage,
  fetchNatalityRates,
};
