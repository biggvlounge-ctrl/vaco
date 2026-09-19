// Universal World Layer — OpenWeather import.
//
// ***THE ONLY SOURCE IN THIS REGISTRY THAT COSTS MONEY PER CALL.***
//
// ---------------------------------------------------------------------
// Read this before wiring it to anything
// ---------------------------------------------------------------------
// Every other importer here is public domain or permissively licensed
// and free at any volume. OpenWeather is a commercial API with a free
// tier and per-call pricing beyond it. That makes it the one source
// where **using it is a recurring cost rather than a one-off import**,
// which is the exact opposite of what the rest of this directory is
// for: `COST_REDUCTION_THROUGH_DATA.md` exists to bring a build cost
// down, and a per-call dependency in a tick loop pushes an operating
// cost up forever.
//
// So this importer is built and deliberately fenced:
//
//   - `noaaImport` covers the U.S. prototype region for free, from
//     published climate normals, and is the source to prefer.
//   - This one exists for the case NOAA cannot serve: a world set
//     somewhere NOAA does not publish, which is anywhere outside the
//     United States.
//   - `COST_WARNING` is written onto every row, the same way
//     `religionImport` carries its licence warning, because a comment
//     in this file does not travel with the data.
//   - `estimateCalls` exists so the bill can be worked out BEFORE a
//     region is imported rather than discovered after.
//
// ---------------------------------------------------------------------
// Normals, not weather
// ---------------------------------------------------------------------
// `vacon-c/server/environment.js` runs its own weather from `CLIMATES`
// — a per-climate profile of how often each of six weathers is drawn.
// It does not want today's temperature in a real city, and feeding it
// live observations would replace a working simulation with a data
// feed.
//
// What it wants is the CLIMATE: which of `temperate`, `arid`,
// `coastal`, `continental` a place behaves like. That is a property of
// long-run averages, so this importer reads OpenWeather's climatic
// aggregations and classifies, exactly as `noaaImport` does — and it
// reuses `noaaImport`'s Köppen-Geiger classifier rather than writing a
// second opinion, because two files disagreeing about what makes a
// place arid is the third standing rule.
//
// NETWORK CONSTRAINT, checked directly: `api.openweathermap.org` is
// outside this environment's outbound proxy allowlist (403 CONNECT).
// It would also need a key.

'use strict';

const { setLocationData, getLocation } = require('../locations');
const { classify } = require('./noaaImport');

//: Carried on every row this importer writes.
const COST_WARNING = 'OpenWeather is a COMMERCIAL API with per-call pricing beyond its free '
  + 'tier. It is the only paid source in this registry. Prefer noaaImport for any U.S. '
  + 'region — it is free, public domain, and covers the prototype area. Use this only where '
  + 'NOAA does not publish, and budget the calls first with estimateCalls().';

//: OpenWeather's free tier, as published at the time of writing.
//: **Held as data and flagged as needing re-checking**, exactly like
//: `sources.js`'s `licenceCheckedAt: null` — a pricing page changes
//: quietly and a number typed into a comment never does.
const PRICING = {
  freeCallsPerDay: 1000,
  checkedAt: null,
  note: 'Re-check before relying on this. Tiers and limits change and this figure is not '
    + 'verified from the vendor at runtime.',
};

// How many API calls importing a region would take, and whether that
// fits the free tier.
//
// **One call per location, per aggregation requested.** Stated as
// arithmetic rather than assumed, because the difference between "a
// hundred locations" and "a hundred locations times twelve monthly
// aggregations" is the difference between free and not.
function estimateCalls(locationCount, aggregationsPerLocation = 1) {
  const locations = Number(locationCount);
  const per = Number(aggregationsPerLocation);
  if (!Number.isFinite(locations) || locations < 0) {
    throw new Error('estimateCalls requires a non-negative location count');
  }
  if (!Number.isFinite(per) || per < 1) {
    throw new Error('estimateCalls requires at least one aggregation per location');
  }
  const calls = Math.ceil(locations * per);
  return {
    calls,
    freeCallsPerDay: PRICING.freeCallsPerDay,
    withinFreeTier: calls <= PRICING.freeCallsPerDay,
    // Days of free-tier quota this import would consume, so a large
    // region reads as "four days of quota" rather than as a number.
    freeTierDays: Math.ceil(calls / PRICING.freeCallsPerDay),
    costWarning: COST_WARNING,
    pricingVerified: PRICING.checkedAt !== null,
  };
}

// Attach a climate classification from OpenWeather aggregations.
//
// `record`: `{ temperaturesC: [12], precipitationMm: [12], latitude }`
// — the same inputs `noaaImport.classify` takes, spelled the same way,
// because it is the same question and there is one classifier.
function importClimate(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importClimate: no location with id ${locationId}`);

  const existing = location.geographyData ?? {};
  // **Refuse to overwrite a free source with a paid one.** If NOAA has
  // already classified this place, the paid call was wasted and the
  // right response is to say so rather than to quietly spend it again.
  //
  // The check reads `climate.source`, which is where `noaaImport` puts
  // it. The first version read `geographyData.source` — a field NOAA
  // never writes — so the guard could never fire and the expensive
  // overwrite it exists to stop would have happened silently. Standing
  // rule 6 in a guard rather than a signal, and its own test caught it.
  if (existing.climate?.source === 'noaa-climate-normals') {
    throw new Error(
      `importClimate: location ${locationId} already carries a NOAA classification, which `
      + 'is free and public domain. Overwriting it with a paid source spends money to '
      + 'replace a better-licensed answer. Drop the NOAA data deliberately first if that '
      + 'is really what you want.',
    );
  }

  const classification = classify({
    temperaturesC: record.temperaturesC,
    precipitationMm: record.precipitationMm,
    latitude: record.latitude ?? location.lat,
  });

  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    source: 'openweather',
    // Not a licence in the open-data sense — a commercial terms of use.
    licence: 'commercial-per-call',
    costWarning: COST_WARNING,
    // **The same SHAPE `noaaImport` writes**, nested under `climate`,
    // not a flat set of fields beside it. Two files answering the same
    // question in two shapes is the third standing rule, and a consumer
    // should never have to know which source classified a place —
    // only that the `source` inside says which one did.
    climate: { ...classification, source: 'openweather' },
    classifiedFrom: 'openweather-aggregations',
  });
  return location;
}

function describeCost(worldLayer) {
  let paidLocations = 0;
  for (const location of worldLayer.locations || []) {
    if (location.geographyData?.source === 'openweather') paidLocations += 1;
  }
  return {
    paidLocations,
    ...estimateCalls(paidLocations),
    // The free alternative, named in the report rather than only in a
    // comment, so a cost review sees the option next to the bill.
    freeAlternative: 'noaaImport (U.S. only, public domain, climate normals)',
  };
}

function fetchOpenWeather() {
  throw new Error(
    'fetchOpenWeather is not implemented, and for two reasons rather than one. '
    + 'api.openweathermap.org is outside this environment\'s outbound proxy allowlist '
    + '(403 CONNECT, checked directly), AND it requires a paid API key — this is the only '
    + 'source in the registry that costs money per call. Use noaaImport for any U.S. '
    + 'region. If a non-U.S. region genuinely needs this, call estimateCalls() first and '
    + 'pass { monthlyTempC, monthlyPrecipMm, lat } to importClimate(worldLayer, '
    + 'locationId, record).',
  );
}

module.exports = {
  COST_WARNING,
  PRICING,
  estimateCalls,
  importClimate,
  describeCost,
  fetchOpenWeather,
};
