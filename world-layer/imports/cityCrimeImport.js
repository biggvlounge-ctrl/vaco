// Universal World Layer — LA/Chicago open crime-data incident import.
//
// **A real sub-city hot-spot signal, and a two-city exception to how
// every other source in this registry is scoped. Read this header
// before using it.**
//
// ---------------------------------------------------------------------
// Why two specific cities, when every other pack here is national
// ---------------------------------------------------------------------
// Asked directly for an LA/Chicago gang-territory map, the honest
// answer was no such thing exists as public structured data — see
// `nygsImport.js`'s header and CLAUDE.md's thirty-third standing rule.
// What DOES exist, for those two cities specifically (and not as a
// nationally generalizable source the way Census, HUD or FBI NIBRS
// are) is real, geocoded, incident-level open crime data: LAPD via
// data.lacity.org, Chicago PD via data.cityofchicago.org. Both publish
// offense type, date and a sub-city area (LAPD reporting
// district/area, CPD community area/beat).
//
// Every other importer in this registry picks one source that covers
// the whole country at a consistent grain. This one does not — it is
// two cities' own open-data portals, named explicitly rather than
// generalized into a false national claim. A world generated for any
// city other than Los Angeles or Chicago gets no pack and is
// unaffected, exactly like every other source here with no coverage.
//
// ---------------------------------------------------------------------
// What this closes, and what it deliberately does not touch
// ---------------------------------------------------------------------
// `vacon-c/server/crime.js#runDeprivationCrime` draws property/theft
// risk from `BASE_DEPRIVATION_RISK` (0.0006), a flagged-interpretive
// constant with no real hot-spot variation by place — every community
// in every city carries the same flat risk regardless of where it
// sits. A real area's property-crime rate, read relative to its own
// city's mean (see `vacon-c/server/crimeHotspotPacks.js`), gives that
// constant real sub-city variation where real data exists.
//
// **Deliberately NOT touched: violent crime / `keys.resolveAggression`.**
// That mechanism's escalation floor and rate were calibrated through
// four measured, written-down attempts (CLAUDE.md's seventeenth
// standing rule) against this engine's own internal distributions.
// Grafting an external real-world weight onto a system calibrated
// without accounting for one would risk re-breaking exactly the
// balance that rule's four attempts fixed. This importer and its
// VACON-C-side reader apply only to the deprivation/property pressure,
// which is already flagged as chosen rather than measured.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as everywhere else in this registry
// ---------------------------------------------------------------------
// A rate for a PLACE's recorded incidents, never an attribute of any
// one person. Nothing here produces a per-person fact, and nothing
// reads an NPC's own identity to apply it — only which community they
// live in.
//
// NETWORK CONSTRAINT, checked directly: both data.lacity.org and
// data.cityofchicago.org are outside this environment's outbound
// proxy allowlist (403 CONNECT). `fetchAreaIncidents` throws with
// that reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: The two cities this importer covers, named rather than left open —
//: a pack claiming a third city is refused on the VACON-C side rather
//: than silently accepted as if the source generalized.
const CITIES = ['los-angeles', 'chicago'];

//: A sanity ceiling on a real per-capita rate (per 1,000 residents,
//: annual), not a claim about any real area's actual rate — it exists
//: to catch a units mistake, not to narrow real variation. Dense,
//: high-crime reporting districts in both cities can run well into the
//: tens per 1,000; 200 is a generous ceiling above that.
const RATE_BOUNDS = [0, 200];

function isRealCount(value) {
  // **`Number(null)` is 0 and 0 is finite**, so missing is checked
  // first — an area with no reported figure is not an area with zero
  // incidents.
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

// Turn a real incident count and population into a per-1,000 rate.
// Returns null when the population figure is missing — a rate against
// an unknown base is not a rate, it is an invented denominator.
function toRatePerCapita(incidentCount, population) {
  const count = isRealCount(incidentCount);
  const pop = Number(population);
  if (count === null || !Number.isFinite(pop) || pop <= 0) return null;
  const rate = (count / pop) * 1000;
  return rate >= RATE_BOUNDS[0] && rate <= RATE_BOUNDS[1] ? Math.round(rate * 1000) / 1000 : null;
}

// Attach a sub-city area's real violent/property incident rates to a
// location.
//
// `record`: `{ city, areaName, year, violentCount, propertyCount,
// population }`. `city` must be one of `CITIES`.
function importAreaIncidents(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importAreaIncidents: no location with id ${locationId}`);
  if (!CITIES.includes(record.city)) {
    throw new Error(`importAreaIncidents requires record.city to be one of: ${CITIES.join(', ')}`);
  }
  if (!record.areaName) {
    throw new Error(
      'importAreaIncidents requires record.areaName — an unattributed incident count cannot '
      + 'be checked against the published table.',
    );
  }

  const source = record.city === 'los-angeles' ? 'la-open-data' : 'chicago-open-data';
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    crimeHotspot: {
      source,
      city: record.city,
      areaName: record.areaName,
      year: record.year ?? null,
      violentRatePer1k: toRatePerCapita(record.violentCount, record.population),
      propertyRatePer1k: toRatePerCapita(record.propertyCount, record.population),
    },
    containsIndividualAttributes: false,
  });
  return location;
}

function describeCrimeHotspotCoverage(worldLayer) {
  let areas = 0;
  let withRate = 0;
  const byCity = {};
  for (const location of worldLayer.locations || []) {
    const data = location.populationData?.crimeHotspot;
    if (!data || !['la-open-data', 'chicago-open-data'].includes(data.source)) continue;
    areas += 1;
    byCity[data.city] = (byCity[data.city] ?? 0) + 1;
    if (data.propertyRatePer1k !== null || data.violentRatePer1k !== null) withRate += 1;
  }
  return { areas, withRate, withoutRate: areas - withRate, byCity };
}

function fetchAreaIncidents() {
  throw new Error(
    'fetchAreaIncidents is not implemented: data.lacity.org and data.cityofchicago.org are '
    + 'outside this environment\'s outbound proxy allowlist (403 CONNECT, checked directly). '
    + 'Both publish incident-level open crime data with no key. Pass { city, areaName, year, '
    + 'violentCount, propertyCount, population } to importAreaIncidents(worldLayer, '
    + 'locationId, record).',
  );
}

module.exports = {
  CITIES,
  RATE_BOUNDS,
  toRatePerCapita,
  importAreaIncidents,
  describeCrimeHotspotCoverage,
  fetchAreaIncidents,
};
