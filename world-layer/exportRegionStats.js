// Universal World Layer — export a region's real population, labour,
// and infrastructure statistics as packs.
//
// `exportRegion.js`'s sibling for the three non-landmark importers:
// `imports/censusImport.js` (ACS), `imports/blsImport.js` (OES), and
// `imports/hifldImport.js` already write real distributions and real
// capacities onto this layer's own `Location` records. Nothing reads
// them back out into a shape a game engine can consume — this is that
// reader, exactly as `exportRegion.js` is the reader for
// `landmarkData`.
//
// ---------------------------------------------------------------------
// Why this is three packs and not one
// ---------------------------------------------------------------------
// Population, labour, and infrastructure are three different real
// datasets at three different grains (a Census tract, a BLS metro, a
// HIFLD facility) consumed by three different parts of the engine
// (`populationPacks.js`, `labourPacks.js`, `infrastructurePacks.js`).
// Bundling them into one pack would make a caller who only has one of
// the three datasets unable to export anything at all.
//
// ---------------------------------------------------------------------
// Why this is a file and not an import
// ---------------------------------------------------------------------
// Same rule `exportRegion.js`'s header states: no app imports
// `world-layer/` across a directory boundary
// (`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`). These produce plain JSON
// packs; the consuming engine's own reader module validates and reads
// them, and neither app requires the other.

'use strict';

// A region's real ACS tracts, as a population pack
// `vacon-c/server/populationPacks.js` can read.
//
// `region` is required for the same reason every exporter here
// requires one: a pack with no region is not a per-region import.
function exportPopulationPack(worldLayer, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportPopulationPack requires options.region — a pack is per-region by definition');
  }

  const tracts = [];
  for (const location of worldLayer.locations || []) {
    const data = location.populationData;
    // **Either real import counts — not just ACS.** `importPlacesTract`
    // (CDC) nests its own data under `healthPrevalence` without
    // necessarily being the import that set the top-level `source`,
    // so gating on `source === 'us-census-acs'` alone would silently
    // drop a tract's real health baseline on a location CDC covered
    // but ACS did not.
    const hasAcs = data?.source === 'us-census-acs';
    const hasHealth = Number.isFinite(Number(data?.healthPrevalence?.baselinePressure));
    if (!data || (!hasAcs && !hasHealth)) continue;
    const tract = { tractId: data.tractId ?? data.healthPrevalence?.tractId };
    if (data.ageBands) tract.ageBands = data.ageBands;
    if (data.attainment?.distribution) tract.attainment = data.attainment.distribution;
    if (hasHealth) tract.healthBaseline = Number(data.healthPrevalence.baselinePressure);
    tracts.push(tract);
  }

  return { region, source, tracts };
}

// A region's real OES metros, as a labour pack
// `vacon-c/server/labourPacks.js` can read.
function exportLabourPack(worldLayer, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportLabourPack requires options.region — a pack is per-region by definition');
  }

  const metros = [];
  for (const location of worldLayer.locations || []) {
    const market = location.economicData?.labourMarket;
    if (!market || market.source !== 'us-bls-oes') continue;
    const metro = { areaCode: market.areaCode };
    if (market.areaName) metro.areaName = market.areaName;
    if (market.employmentShares) metro.employmentShares = market.employmentShares;
    if (market.wages) {
      metro.wages = {};
      for (const [group, wage] of Object.entries(market.wages)) {
        metro.wages[group] = { medianWage: wage.medianWage, meanWage: wage.meanWage };
      }
    }
    metros.push(metro);
  }

  return { region, source, metros };
}

// A region's real HIFLD facilities, as an infrastructure pack
// `vacon-c/server/infrastructurePacks.js` can read.
//
// Only facilities with a real, reported capacity are included — a
// facility HIFLD could not report a capacity for carries nothing this
// pack's consumer could use in place of its own invented band.
function exportInfrastructurePack(worldLayer, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportInfrastructurePack requires options.region — a pack is per-region by definition');
  }

  const facilitiesByType = {};
  for (const location of worldLayer.locations || []) {
    const data = location.buildingData;
    if (!data || data.source !== 'hifld-open' || !data.capacityReported) continue;
    const type = data.infrastructureType;
    if (!facilitiesByType[type]) facilitiesByType[type] = [];
    facilitiesByType[type].push(data.capacity);
  }

  return { region, source, facilitiesByType };
}

//: `vacon-c/server/landmarks.js`'s own `RETAIL_CATEGORIES` — ten
//: types, duplicated for the same deployment reason `exportRegion.js`'s
//: `KEY_CATEGORIES` duplicates the hero list, and cross-checked by
//: that consumer's own test the same way.
const RETAIL_CATEGORIES = [
  'hardware-store', 'clothing-store', 'grocery-store', 'pharmacy',
  'sporting-goods-store', 'electronics-store', 'auto-parts-store',
  'bookstore', 'gun-store', 'department-store',
];

// A region's real Overture Places retail businesses, as a business
// pack `vacon-c/server/businessPacks.js` can read.
//
// `importOverturePlaces` writes retail businesses onto the same
// `landmarkData` field the hero importers use, which is why
// `exportRegion.js`'s own `KEY_CATEGORIES` filter never finds them —
// that list is the hero vocabulary only. This is the other half,
// filtered to the ten retail types instead.
function exportBusinessPack(worldLayer, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportBusinessPack requires options.region — a pack is per-region by definition');
  }

  const businesses = [];
  for (const location of worldLayer.locations || []) {
    const data = location.landmarkData;
    if (!data || !RETAIL_CATEGORIES.includes(data.category)) continue;
    const entry = { name: location.name, category: data.category };
    if (data.area) entry.area = data.area;
    if (typeof location.lat === 'number' && typeof location.lng === 'number') {
      entry.lat = location.lat;
      entry.lng = location.lng;
    }
    businesses.push(entry);
  }

  return { region, source, businesses };
}

//: `vacon-c/server/climatePacks.js`'s own `KOPPEN_GROUP_LETTERS` —
//: duplicated and cross-checked by that consumer's test.
const KOPPEN_GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// A region's real NOAA-derived climate, as a climate pack
// `vacon-c/server/climatePacks.js` can read. One climate per region —
// `locationId` names which location in the layer carries it (normally
// the region/city division `importClimateNormals` was called on).
function exportClimatePack(worldLayer, locationId, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportClimatePack requires options.region — a pack is per-region by definition');
  }
  const location = (worldLayer.locations || []).find((l) => l.id === locationId);
  const climate = location?.geographyData?.climate;
  if (!climate?.climateKey) {
    throw new Error(`exportClimatePack: location ${locationId} has no real climate classification on it`);
  }

  return {
    region, source, climateKey: climate.climateKey, measures: climate.measures ?? null,
  };
}

//: `vacon-c/server/riskPacks.js`'s own `HAZARD_CONDITIONS` — duplicated
//: and cross-checked by that consumer's test.
const HAZARD_CONDITIONS = ['drought', 'heat', 'freeze', 'storm'];

// A region's real FEMA National Risk Index counties, as a risk pack
// `vacon-c/server/riskPacks.js` can read.
//
// Only a county with at least one modelled hazard above zero is
// included — a county the NRI covers with every modelled hazard at
// `Very Low` carries nothing a consumer could use in place of its
// climate's own baseline weights.
function exportRiskPack(worldLayer, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportRiskPack requires options.region — a pack is per-region by definition');
  }

  const counties = [];
  for (const location of worldLayer.locations || []) {
    const data = location.geographyData;
    if (!data || data.source !== 'fema-nri') continue;
    const hazardRisk = {};
    for (const [condition, weight] of Object.entries(data.hazardRisk ?? {})) {
      if (HAZARD_CONDITIONS.includes(condition) && Number(weight) > 0) hazardRisk[condition] = weight;
    }
    if (Object.keys(hazardRisk).length === 0) continue;
    counties.push({ countyFips: data.countyFips, countyName: data.countyName ?? null, hazardRisk });
  }

  return { region, source, counties };
}

// A region's real U.S. Religion Census counties, as a religion pack
// `vacon-c/server/religionPacks.js` can read.
//
// **This is the one export in this file for a source `sources.js`
// records as licence-encumbered rather than public domain.** The
// warning travels with every county row, same as the importer carries
// it on every location — see that module's own header, and
// `religionPacks.js`'s, for why this pack exists at all.
function exportReligionPack(worldLayer, options = {}) {
  const { region, source = 'sample' } = options;
  if (!region) {
    throw new Error('exportReligionPack requires options.region — a pack is per-region by definition');
  }

  const counties = [];
  for (const location of worldLayer.locations || []) {
    const religion = location.populationData?.religion;
    if (!religion || religion.source !== 'us-religion-census' || !religion.shares) continue;
    counties.push({
      countyFips: religion.countyFips, countyName: religion.countyName ?? null, shares: religion.shares,
    });
  }

  return { region, source, counties };
}

module.exports = {
  RETAIL_CATEGORIES,
  KOPPEN_GROUP_LETTERS,
  HAZARD_CONDITIONS,
  exportPopulationPack,
  exportLabourPack,
  exportInfrastructurePack,
  exportBusinessPack,
  exportClimatePack,
  exportRiskPack,
  exportReligionPack,
};
