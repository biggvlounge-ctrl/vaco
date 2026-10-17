// Universal World Layer — HUD Point-in-Time homelessness count import.
//
// **A real deficit, for a mechanism that only ever generates a
// surplus.**
//
// ---------------------------------------------------------------------
// What it closes
// ---------------------------------------------------------------------
// `vacon-c/server/worldgen.js` builds every community's homes from
// `config.homesPerResident` (1.15) — MORE homes than residents, always,
// everywhere. Its own comment says why: "Homes are generated to house
// everybody with a margin, which is what produces a non-zero vacancy
// rate without inventing one." That is a real, working mechanism for
// VACANCY. It cannot produce HOMELESSNESS, because 1.15 never drops
// below 1 — no generated world has ever had fewer homes than
// residents, which is the real opposite condition this margin cannot
// express.
//
// HUD's annual Point-in-Time count — one night, every Continuum of
// Care (CoC) area in the country, sheltered and unsheltered counted
// separately — is a U.S. Government Work, published as downloadable
// tables with no key. It is exactly the real deficit this margin needs
// in the places it is real.
//
// ---------------------------------------------------------------------
// A rate, read against the SAME tract/community grain as income and
// natality
// ---------------------------------------------------------------------
// A CoC is usually a county or a group of counties — the same rough
// grain every other per-county pack in this registry already reads
// at. This importer produces a real per-capita homelessness rate; the
// VACON-C side (`populationPacks.homelessnessRateFor`) is what turns
// that into a margin below 1.0 where the real rate is high enough to
// matter, never inventing the conversion ratio without flagging it.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as everywhere else in this registry
// ---------------------------------------------------------------------
// A rate for a PLACE's unhoused population on one night, never an
// attribute of any one person. Nothing here produces a per-person
// fact.
//
// NETWORK CONSTRAINT, checked directly: `hudexchange.info` is outside
// this environment's outbound proxy allowlist (403 CONNECT).
// `fetchPitCounts` throws with that reason; the transform is the
// tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: A sanity ceiling on a real per-capita rate, not a claim about any
//: real CoC's actual rate. Even the highest-rate U.S. CoCs run well
//: under this; it exists to catch a units mistake (a percentage
//: entered as a fraction, for instance), not to narrow real variation.
const RATE_BOUNDS = [0, 0.05];

function isRealCount(value) {
  // **`Number(null)` is 0 and 0 is finite**, so missing is checked
  // first — a CoC HUD could not get a usable count from is not a CoC
  // with zero homeless people.
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

// Turn a CoC's real counts into a per-capita rate.
//
// `sheltered`/`unsheltered`/`population` are the night's real counts.
// Returns null when the population figure is missing — a rate against
// an unknown base is not a rate, it is an invented denominator.
function toHomelessnessRate(sheltered, unsheltered, population) {
  const shelteredCount = isRealCount(sheltered);
  const unshelteredCount = isRealCount(unsheltered);
  const pop = Number(population);
  if (!Number.isFinite(pop) || pop <= 0) return { rate: null, total: null };
  if (shelteredCount === null && unshelteredCount === null) return { rate: null, total: null };
  const total = (shelteredCount ?? 0) + (unshelteredCount ?? 0);
  const rate = total / pop;
  return {
    rate: rate >= RATE_BOUNDS[0] && rate <= RATE_BOUNDS[1] ? Math.round(rate * 1000000) / 1000000 : null,
    total,
  };
}

// Attach a CoC's real Point-in-Time count to a location.
//
// `record`: `{ cocCode, cocName, year, shelteredCount, unshelteredCount,
// population }`.
function importPitCount(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importPitCount: no location with id ${locationId}`);
  if (!record.cocCode) {
    throw new Error(
      'importPitCount requires record.cocCode — an unattributed count cannot be checked '
      + 'against the published table.',
    );
  }

  const { rate, total } = toHomelessnessRate(
    record.shelteredCount, record.unshelteredCount, record.population,
  );
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    homelessness: {
      source: 'hud-pit',
      licence: 'public-domain',
      cocCode: record.cocCode,
      cocName: record.cocName ?? null,
      year: record.year ?? null,
      shelteredCount: isRealCount(record.shelteredCount),
      unshelteredCount: isRealCount(record.unshelteredCount),
      totalCount: total,
      // The real per-capita rate `populationPacks.homelessnessRateFor`
      // reads in place of the implicit 0 the invented 1.15 margin
      // always produces.
      ratePerCapita: rate,
    },
    containsIndividualAttributes: false,
  });
  return location;
}

function describePitCoverage(worldLayer) {
  let cocs = 0;
  let withRate = 0;
  const rates = [];
  for (const location of worldLayer.locations || []) {
    const data = location.populationData?.homelessness;
    if (data?.source !== 'hud-pit') continue;
    cocs += 1;
    if (data.ratePerCapita !== null) {
      withRate += 1;
      rates.push(data.ratePerCapita);
    }
  }
  rates.sort((a, b) => a - b);
  return {
    cocs,
    withRate,
    withoutRate: cocs - withRate,
    medianRatePerCapita: rates.length ? rates[Math.floor(rates.length / 2)] : null,
  };
}

function fetchPitCounts() {
  throw new Error(
    'fetchPitCounts is not implemented: hudexchange.info is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, checked directly). HUD publishes the annual '
    + 'PIT count as downloadable tables per CoC, no key. Pass { cocCode, cocName, year, '
    + 'shelteredCount, unshelteredCount, population } to importPitCount(worldLayer, '
    + 'locationId, record).',
  );
}

module.exports = {
  RATE_BOUNDS,
  toHomelessnessRate,
  importPitCount,
  describePitCoverage,
  fetchPitCounts,
};
