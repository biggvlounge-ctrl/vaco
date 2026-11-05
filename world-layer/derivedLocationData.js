// Universal World Layer — deriving a Location's populationData/
// economicData from the real NPCs and businesses already at it.
// Closes this project's own flagged "Not yet built" gap: a Location's
// `populationData`/`economicData` slices and `getNPCsAtLocation()`/
// `getBusinessesAtLocation()` were previously separate, manually-
// reconciled things — nothing ever read one to compute the other.
//
// Every number here is a real aggregate over real stored NPC/business
// records, never a fabricated estimate. `demographics` has no fixed
// schema anywhere in this codebase (checked directly: every real
// caller only ever sets `{ age }`), so only `age` is aggregated from
// it — bucketing by an invented field this project doesn't actually
// use would be exactly the kind of fabrication the rest of this
// project is careful to avoid (see e.g. routing.js's own refusal to
// invent a per-vehicle fuel range).

const { getLocation, setLocationData } = require('./locations');
const { getNPCsAtLocation } = require('./npcGenesis');
const { getBusinessesAtLocation } = require('./commerce');

function tally(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) ?? 'unspecified';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function deriveLocationPopulationData(worldLayer, locationId) {
  if (!getLocation(worldLayer, locationId)) {
    throw new Error(`deriveLocationPopulationData: no location with id ${locationId}`);
  }
  const npcs = getNPCsAtLocation(worldLayer, locationId);

  const ages = npcs
    .map((n) => n.demographics && n.demographics.age)
    .filter((age) => typeof age === 'number');

  return {
    totalPopulation: npcs.length,
    byOccupation: tally(npcs, (n) => n.occupation),
    byEconomicRole: tally(npcs, (n) => n.economicRole),
    byMigrationStatus: tally(npcs, (n) => n.migrationStatus),
    averageAge: ages.length > 0
      ? Math.round((ages.reduce((sum, age) => sum + age, 0) / ages.length) * 10) / 10
      : null,
  };
}

function deriveLocationEconomicData(worldLayer, locationId) {
  if (!getLocation(worldLayer, locationId)) {
    throw new Error(`deriveLocationEconomicData: no location with id ${locationId}`);
  }
  const businesses = getBusinessesAtLocation(worldLayer, locationId);

  return {
    businessCount: businesses.length,
    totalEconomicValue: Math.round(
      businesses.reduce((sum, b) => sum + b.economicValue, 0) * 100,
    ) / 100,
    totalEmployment: businesses.reduce((sum, b) => sum + b.employees.length, 0),
    byIndustry: tally(businesses, (b) => b.industry),
    bySecurityRequirement: tally(businesses, (b) => b.securityRequirement),
  };
}

// Computes both slices and actually writes them back via the real
// `setLocationData()`, rather than leaving this a read with no
// write-back path — a `Location`'s own `populationData`/`economicData`
// otherwise stay `null` forever even once real NPCs/businesses exist.
function syncLocationDataFromNPCs(worldLayer, locationId) {
  const populationData = deriveLocationPopulationData(worldLayer, locationId);
  const economicData = deriveLocationEconomicData(worldLayer, locationId);
  setLocationData(worldLayer, locationId, 'populationData', populationData);
  setLocationData(worldLayer, locationId, 'economicData', economicData);
  return { populationData, economicData };
}

module.exports = {
  deriveLocationPopulationData,
  deriveLocationEconomicData,
  syncLocationDataFromNPCs,
};
