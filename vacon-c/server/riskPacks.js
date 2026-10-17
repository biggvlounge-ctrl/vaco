// server/riskPacks.js
//
// **A real hazard profile, so two cities in the same climate stop
// having the same disasters.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `environment.js` draws severe weather from `CLIMATES` — a profile
// per climate name, identical for every city that climate draws. Its
// own header says so plainly: "a climate profile is not a hazard
// profile... two temperate river towns, one on a floodplain and one on
// a bluff, get the same storms and the same consequences, because
// nothing anywhere knows the difference." `world-layer/imports/
// femaImport.js` already turns the real FEMA National Risk Index into
// exactly the shape this closes with: a weight per `environment.
// SEVERE` condition, per real U.S. county.
//
// ---------------------------------------------------------------------
// Why this narrows a climate's own weights rather than replacing them
// ---------------------------------------------------------------------
// A climate's weights are architecture: `CLIMATES.arid.storm` is 0
// because a desert does not get coastal flooding however a county's
// real wind or flood rating reads. A real hazard pack only BOOSTS a
// condition the city's own climate already allows some chance of — see
// `environment.drawWeather`'s own header for the exact mechanism.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a tract or a metro
// ---------------------------------------------------------------------
// A county has no name an auto-generated city can be matched to the
// way a landmark's own `area` field matches a real business to a
// neighbourhood. So counties are assigned by POSITION in the pack
// against the city's own index in the generation loop, cycling if
// there are fewer counties than cities — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

//: A pack's own declaration of where its rows came from. Mirrors every
//: other pack reader's `SOURCES`.
const SOURCES = ['fema-nri', 'sample'];

//: `environment.SEVERE`'s own keys — duplicated here for the same
//: deployment reason every other pack duplicates its source
//: vocabulary, and cross-checked by this module's own test so the two
//: cannot drift silently.
const HAZARD_CONDITIONS = ['drought', 'heat', 'freeze', 'storm'];

function isRiskObject(value) {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (!HAZARD_CONDITIONS.includes(key)) return false;
    const weight = Number(value[key]);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) return false;
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
    if (county.hazardRisk !== undefined && county.hazardRisk !== null
      && !isRiskObject(county.hazardRisk)) {
      problems.push(`${where}: hazardRisk must be weights (0..1) keyed on ${HAZARD_CONDITIONS.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`risk pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, because a world with no pack must
// still generate.
function packFor(worldState) {
  return worldState?.riskPack ?? null;
}

// The county for a city at this position, cycling if there are fewer
// counties than cities. Null when there is no pack — the climate's own
// weights are the fallback, not this module's.
function countyFor(pack, position) {
  if (!pack || !Array.isArray(pack.counties) || pack.counties.length === 0) return null;
  const index = ((position % pack.counties.length) + pack.counties.length) % pack.counties.length;
  return pack.counties[index];
}

// A county's real hazard weights, or null when it has none recorded —
// a county the NRI covers but with no modelled hazard above `Very Low`
// reads this way too, same as `riverineFlooding`'s own "not every
// county has every risk" shape.
function riskFor(county) {
  if (!county?.hazardRisk || Object.keys(county.hazardRisk).length === 0) return null;
  return county.hazardRisk;
}

module.exports = {
  SOURCES,
  HAZARD_CONDITIONS,
  validatePack,
  assertPack,
  packFor,
  countyFor,
  riskFor,
};
