// Exporting a region's real population, labour, and infrastructure
// statistics — `exportRegion.test.js`'s sibling for the three
// non-landmark importers.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation, setLocationData } = require('../locations');
const { importAcsTract } = require('../imports/censusImport');
const { importOesMetro } = require('../imports/blsImport');
const { importHifldLayer } = require('../imports/hifldImport');
const { importOverturePlaces } = require('../imports/overtureImport');
const { importPlacesTract } = require('../imports/cdcImport');
const { importOverdoseRates } = require('../imports/overdoseImport');
const { importClimateNormals } = require('../imports/noaaImport');
const { importRiskIndex } = require('../imports/femaImport');
const { importReligionCensus } = require('../imports/religionImport');
const { importProvider } = require('../imports/cmsImport');
const { importInstitution } = require('../imports/ncesImport');
const { importNatalityRates } = require('../imports/natalityImport');
const { importPitCount } = require('../imports/hudPitImport');
const { importNygsJurisdiction } = require('../imports/nygsImport');
const { importCountyReturns } = require('../imports/electionImport');
const { importAreaIncidents } = require('../imports/cityCrimeImport');
const {
  exportPopulationPack, exportLabourPack, exportInfrastructurePack,
  exportBusinessPack, exportClimatePack, exportRiskPack, exportReligionPack,
  exportNatalityPack,
  exportIncomePack,
  exportGangPack,
  exportPoliticalPack,
  exportCrimeHotspotPack,
} = require('../exportRegionStats');

test('exportPopulationPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportPopulationPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportPopulationPack carries a real ACS tract\'s age bands and attainment', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 1234', lat: 38.6, lng: -90.2, tier: 'filler' });
  importAcsTract(layer, location.id, {
    tractId: '29510123400',
    population: 4200,
    ageCounts: { child: 800, working: 2700, elder: 700 },
    attainment: {
      less_than_high_school: 400, high_school_graduate: 1200,
      some_college: 900, associates_degree: 300, bachelors_degree: 900, graduate_or_professional: 300,
    },
  });

  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.region, 'St. Louis, Missouri');
  assert.equal(pack.tracts.length, 1);
  assert.equal(pack.tracts[0].tractId, '29510123400');
  assert.ok(pack.tracts[0].ageBands.working > 0.5);
  assert.ok(pack.tracts[0].attainment.basic > 0);
});

test('exportPopulationPack skips a location with no real ACS import', () => {
  const layer = createWorldLayer();
  generateLocation(layer, { name: 'Unimported Tract', lat: 1, lng: 2, tier: 'filler' });
  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.tracts, []);
});

test('exportLabourPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportLabourPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportLabourPack carries a real OES metro\'s employment shares and wages', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'St. Louis MSA', lat: 38.6, lng: -90.2, tier: 'hero' });
  importOesMetro(layer, location.id, {
    areaCode: '41180', areaName: 'St. Louis, MO-IL', year: 2024,
    rows: [
      { socGroup: '17', employment: 20000, medianWage: 85000, meanWage: 90000 },
      { socGroup: '35', employment: 30000, medianWage: 28000, meanWage: 30000 },
    ],
  });

  const pack = exportLabourPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.metros.length, 1);
  assert.equal(pack.metros[0].areaCode, '41180');
  assert.equal(pack.metros[0].employmentShares['17'], 0.4);
  assert.equal(pack.metros[0].wages['17'].medianWage, 85000);
});

test('exportInfrastructurePack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportInfrastructurePack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportInfrastructurePack carries real HIFLD capacities, grouped by engine type', () => {
  const layer = createWorldLayer();
  const { imported } = importHifldLayer(layer, 'hospitals', [
    { name: 'Barnes-Jewish Hospital', lat: 38.63, lng: -90.26, beds: 1328 },
    { name: 'Mercy Hospital St. Louis', lat: 38.65, lng: -90.35, beds: 974 },
  ]);
  assert.equal(imported.length, 2);

  const pack = exportInfrastructurePack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.facilitiesByType.hospitals.sort((a, b) => b - a), [1328, 974]);
});

test('exportInfrastructurePack excludes a facility HIFLD reported no capacity for', () => {
  const layer = createWorldLayer();
  importHifldLayer(layer, 'fire-stations', [
    { name: 'Engine House 1', lat: 38.6, lng: -90.2 },
  ]);
  const pack = exportInfrastructurePack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.facilitiesByType, {});
});

test('exportInfrastructurePack carries a real CMS-refreshed bed count, not just HIFLD\'s', () => {
  // `cmsImport.preferByDate` decides the winner at import time — this
  // proves the exporter does not then drop it for arriving under a
  // different source string, the exact bug `exportPopulationPack` had.
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Barnes-Jewish Hospital', lat: 38.63, lng: -90.26, tier: 'hero' });
  importProvider(layer, location.id, {
    ccn: '260001', providerType: 'short-term-hospital', beds: 1250, collectedAt: '2026-01-01',
  });
  const pack = exportInfrastructurePack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.facilitiesByType.hospitals, [1250]);
});

test('exportInfrastructurePack carries a real NCES school enrolment as capacity', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Lincoln Elementary', lat: 38.6, lng: -90.2, tier: 'filler' });
  importInstitution(layer, location.id, 'ccd', { enrolment: 420, teachers: 28, gradeSpan: 'KG-05' });
  const pack = exportInfrastructurePack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.facilitiesByType.schools, [420]);
});

test('exportInfrastructurePack blends HIFLD, CMS and NCES facilities of different types together', () => {
  const layer = createWorldLayer();
  const { imported } = importHifldLayer(layer, 'hospitals', [
    { name: 'Mercy Hospital St. Louis', lat: 38.65, lng: -90.35, beds: 974 },
  ]);
  assert.equal(imported.length, 1);
  const school = generateLocation(layer, { name: 'Central High', lat: 38.6, lng: -90.2, tier: 'filler' });
  importInstitution(layer, school.id, 'ccd', { enrolment: 900, teachers: 60, gradeSpan: '09-12' });

  const pack = exportInfrastructurePack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.facilitiesByType.hospitals, [974]);
  assert.deepEqual(pack.facilitiesByType.schools, [900]);
});

// ---------------------------------------------------------------------
// exportPopulationPack carries a CDC-only tract's health baseline, not
// just an ACS one — the bug this header's own comment records: gating
// inclusion on `source === 'us-census-acs'` alone silently dropped a
// tract CDC covered but ACS did not.
// ---------------------------------------------------------------------

test('exportPopulationPack carries a real CDC health baseline even with no ACS coverage on the same tract', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 9999', lat: 38.6, lng: -90.2, tier: 'filler' });
  importPlacesTract(layer, location.id, {
    tractId: '29510199900',
    prevalences: { DIABETES: 10, OBESITY: 30 },
  });

  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.tracts.length, 1);
  assert.equal(pack.tracts[0].tractId, '29510199900');
  assert.ok(Number.isFinite(pack.tracts[0].healthBaseline));
  // No ACS import ran on this location, so there is no real age/attainment
  // to carry — only what CDC actually measured.
  assert.equal(pack.tracts[0].ageBands, undefined);
});

test('exportPopulationPack carries both a real ACS tract\'s shares and its CDC health baseline together', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 1235', lat: 38.6, lng: -90.2, tier: 'filler' });
  importAcsTract(layer, location.id, {
    tractId: '29510123500',
    population: 4200,
    ageCounts: { child: 800, working: 2700, elder: 700 },
    attainment: {
      less_than_high_school: 400, high_school_graduate: 1200,
      some_college: 900, associates_degree: 300, bachelors_degree: 900, graduate_or_professional: 300,
    },
  });
  importPlacesTract(layer, location.id, { tractId: '29510123500', prevalences: { DIABETES: 9 } });

  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.tracts.length, 1);
  assert.ok(pack.tracts[0].ageBands.working > 0.5);
  assert.ok(Number.isFinite(pack.tracts[0].healthBaseline));
});

test('exportPopulationPack carries a real overdose-mortality baseline even with no ACS or CDC coverage', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 9998', lat: 38.6, lng: -90.2, tier: 'filler' });
  importOverdoseRates(layer, location.id, { countyFips: '29510', ratePer100k: 45 });

  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.tracts.length, 1);
  assert.equal(pack.tracts[0].overdoseBaseline, 1.5);
  assert.equal(pack.tracts[0].healthBaseline, undefined);
});

test('exportPopulationPack carries a real CDC health baseline AND a real overdose baseline together, independently', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 9997', lat: 38.6, lng: -90.2, tier: 'filler' });
  importPlacesTract(layer, location.id, { tractId: '29510999700', prevalences: { DIABETES: 12 } });
  importOverdoseRates(layer, location.id, { countyFips: '29510', ratePer100k: 45 });

  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.tracts.length, 1);
  assert.ok(Number.isFinite(pack.tracts[0].healthBaseline));
  assert.equal(pack.tracts[0].overdoseBaseline, 1.5);
});

// ---------------------------------------------------------------------
// exportBusinessPack
// ---------------------------------------------------------------------

test('exportBusinessPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportBusinessPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportBusinessPack carries a real Overture retail business, named and categorized', () => {
  const layer = createWorldLayer();
  const { imported } = importOverturePlaces(layer, [
    {
      names: { primary: 'Old Town Hardware' },
      categories: { primary: 'hardware' },
      geometry: { coordinates: [-90.2, 38.6] },
      addresses: [{ locality: 'Old Town' }],
    },
  ]);
  assert.equal(imported.length, 1);

  const pack = exportBusinessPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.businesses.length, 1);
  assert.equal(pack.businesses[0].name, 'Old Town Hardware');
  assert.equal(pack.businesses[0].category, 'hardware-store');
  assert.equal(pack.businesses[0].area, 'Old Town');
});

test('exportBusinessPack excludes a hero-tier landmark — that is the other exporter\'s vocabulary', () => {
  const layer = createWorldLayer();
  importOverturePlaces(layer, [
    {
      names: { primary: 'City Museum' },
      categories: { primary: 'museum' },
      geometry: { coordinates: [-90.2, 38.6] },
    },
  ], { tiers: ['regional'] });
  const pack = exportBusinessPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.businesses, []);
});

// ---------------------------------------------------------------------
// exportClimatePack
// ---------------------------------------------------------------------

test('exportClimatePack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportClimatePack(createWorldLayer(), 1, {}), /requires options\.region/);
});

test('exportClimatePack carries a real NOAA-classified Köppen key for the named location', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'St. Louis', lat: 38.6, lng: -90.2, tier: 'hero' });
  importClimateNormals(layer, location.id, {
    temperaturesC: [0.1, 2.3, 7.5, 13.6, 19.2, 24.3, 26.8, 25.7, 21.5, 14.8, 7.6, 1.8],
    precipitationMm: [55, 58, 86, 97, 114, 112, 107, 87, 79, 83, 94, 70],
    latitude: 38.6,
  });

  const pack = exportClimatePack(layer, location.id, { region: 'St. Louis, Missouri' });
  assert.equal(pack.climateKey[0], 'C');
  assert.ok(Number.isFinite(pack.measures.annualMeanC));
});

test('exportClimatePack refuses a location with no real climate classification on it', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Unclassified', lat: 38.6, lng: -90.2, tier: 'hero' });
  assert.throws(
    () => exportClimatePack(layer, location.id, { region: 'St. Louis, Missouri' }),
    /no real climate classification/,
  );
});

// ---------------------------------------------------------------------
// exportRiskPack
// ---------------------------------------------------------------------

test('exportRiskPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportRiskPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportRiskPack carries a real NRI county\'s modelled hazard weights', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'St. Louis County', lat: 38.6, lng: -90.2, tier: 'hero' });
  importRiskIndex(layer, location.id, {
    countyFips: '29189',
    countyName: 'St. Louis County, Missouri',
    ratings: { hurricane: 'Very High', drought: 'Very Low', wildfire: 'Relatively High' },
  });

  const pack = exportRiskPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.counties.length, 1);
  assert.equal(pack.counties[0].countyFips, '29189');
  assert.equal(pack.counties[0].hazardRisk.storm, 1);
  // `drought` rated Very Low (weight 0) is excluded — it carries
  // nothing a consumer could use, same as excluding it entirely.
  assert.equal(pack.counties[0].hazardRisk.drought, undefined);
  // `wildfire` is a real NRI hazard this engine has no mechanism for —
  // it must not leak into the pack under any `environment.SEVERE` key.
  assert.deepEqual(Object.keys(pack.counties[0].hazardRisk), ['storm']);
});

test('exportRiskPack excludes a county whose every modelled hazard is Very Low', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Quiet County', lat: 38.6, lng: -90.2, tier: 'hero' });
  importRiskIndex(layer, location.id, { countyFips: '00000', ratings: { drought: 'Very Low' } });
  const pack = exportRiskPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.counties, []);
});

// ---------------------------------------------------------------------
// exportReligionPack
// ---------------------------------------------------------------------

test('exportReligionPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportReligionPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportReligionPack carries a real county\'s religious composition', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'St. Louis County', lat: 38.6, lng: -90.2, tier: 'hero' });
  importReligionCensus(layer, location.id, {
    countyFips: '29189',
    countyName: 'St. Louis County, Missouri',
    population: 1000000,
    adherents: { catholic: 300000, evangelicalProtestant: 200000 },
  });

  const pack = exportReligionPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.counties.length, 1);
  assert.equal(pack.counties[0].countyFips, '29189');
  assert.ok(pack.counties[0].shares.catholic > 0);
  assert.ok(pack.counties[0].shares.unaffiliated > 0);
});

test('exportReligionPack excludes a county with no real population figure to compute shares from', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Unmeasured County', lat: 38.6, lng: -90.2, tier: 'hero' });
  importReligionCensus(layer, location.id, { countyFips: '00000', adherents: { catholic: 100 } });
  const pack = exportReligionPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.counties, []);
});

// ---------------------------------------------------------------------
// exportNatalityPack
// ---------------------------------------------------------------------

test('exportNatalityPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportNatalityPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportNatalityPack carries a real county\'s age-specific fertility rates', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'St. Louis County', lat: 38.6, lng: -90.2, tier: 'hero' });
  importNatalityRates(layer, location.id, {
    countyFips: '29189', countyName: 'St. Louis County, Missouri', year: 2022,
    rates: { '15-19': 14.2, '20-24': 61.8, '25-29': 98.3 },
  });

  const pack = exportNatalityPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.counties.length, 1);
  assert.equal(pack.counties[0].countyFips, '29189');
  assert.equal(pack.counties[0].ratesPerThousand['25-29'], 98.3);
});

test('exportNatalityPack excludes a county with no usable rate at all', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Unmeasured County', lat: 38.6, lng: -90.2, tier: 'hero' });
  importNatalityRates(layer, location.id, { countyFips: '00000', rates: { '10-14': 0.1 } });
  const pack = exportNatalityPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.counties, []);
});

// ---------------------------------------------------------------------
// exportIncomePack
// ---------------------------------------------------------------------

test('exportIncomePack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportIncomePack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportIncomePack carries a real tract\'s median income and Gini index — both sat unread before this', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 1236', lat: 38.6, lng: -90.2, tier: 'filler' });
  importAcsTract(layer, location.id, {
    tractId: '29510123600', medianHouseholdIncome: 85000, giniIndex: 0.44,
  });
  const pack = exportIncomePack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.tracts.length, 1);
  assert.equal(pack.tracts[0].medianHouseholdIncome, 85000);
  assert.equal(pack.tracts[0].giniIndex, 0.44);
});

test('exportIncomePack excludes a tract with neither real figure', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Tract 1237', lat: 38.6, lng: -90.2, tier: 'filler' });
  importAcsTract(layer, location.id, { tractId: '29510123700' });
  const pack = exportIncomePack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.tracts, []);
});

// ---------------------------------------------------------------------
// exportPopulationPack also carries a real HUD homelessness rate
// ---------------------------------------------------------------------

test('exportPopulationPack carries a real HUD homelessness rate even with no ACS/CDC/overdose coverage', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'CoC Area 2', lat: 38.6, lng: -90.2, tier: 'filler' });
  importPitCount(layer, location.id, { cocCode: 'MO-500', shelteredCount: 1200, unshelteredCount: 300, population: 300000 });
  const pack = exportPopulationPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.tracts.length, 1);
  assert.equal(pack.tracts[0].homelessnessRate, 0.005);
});

// ---------------------------------------------------------------------
// exportGangPack
// ---------------------------------------------------------------------

test('exportGangPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportGangPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportGangPack carries a real, dated jurisdiction\'s gang count and membership rate', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Jurisdiction A', lat: 38.6, lng: -90.2, tier: 'filler' });
  importNygsJurisdiction(layer, location.id, {
    jurisdictionName: 'Testville PD', year: 2012, gangCount: 5, memberCount: 400, population: 100000,
  });
  const pack = exportGangPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.jurisdictions.length, 1);
  assert.equal(pack.jurisdictions[0].gangCount, 5);
  assert.equal(pack.jurisdictions[0].membershipRate, 0.004);
  assert.equal(pack.jurisdictions[0].year, 2012);
});

test('exportGangPack excludes a jurisdiction with neither real figure', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Jurisdiction B', lat: 38.6, lng: -90.2, tier: 'filler' });
  importNygsJurisdiction(layer, location.id, { jurisdictionName: 'Nowhere PD', year: 2012 });
  const pack = exportGangPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.jurisdictions, []);
});

// ---------------------------------------------------------------------
// exportPoliticalPack
// ---------------------------------------------------------------------

test('exportPoliticalPack is per-region, and refuses to be otherwise', () => {
  assert.throws(() => exportPoliticalPack(createWorldLayer(), {}), /requires options\.region/);
});

test('exportPoliticalPack carries a real county\'s two-party Democratic vote share', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'County A', lat: 38.6, lng: -90.2, tier: 'filler' });
  importCountyReturns(layer, location.id, {
    countyFips: '29510', year: 2020, democraticVotes: 180000, republicanVotes: 40000,
  });
  const pack = exportPoliticalPack(layer, { region: 'St. Louis, Missouri' });
  assert.equal(pack.counties.length, 1);
  assert.equal(pack.counties[0].democraticShare, 0.818182);
  assert.equal(pack.counties[0].year, 2020);
});

test('exportPoliticalPack excludes a county with no usable share', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'County B', lat: 38.6, lng: -90.2, tier: 'filler' });
  importCountyReturns(layer, location.id, { countyFips: '29999', year: 2020, democraticVotes: null });
  const pack = exportPoliticalPack(layer, { region: 'St. Louis, Missouri' });
  assert.deepEqual(pack.counties, []);
});

// ---------------------------------------------------------------------
// exportCrimeHotspotPack
// ---------------------------------------------------------------------

test('exportCrimeHotspotPack is per-region and per-city, and refuses to be otherwise', () => {
  assert.throws(
    () => exportCrimeHotspotPack(createWorldLayer(), { city: 'chicago' }),
    /requires options\.region/,
  );
  assert.throws(
    () => exportCrimeHotspotPack(createWorldLayer(), { region: 'Chicago, Illinois' }),
    /requires options\.city/,
  );
});

test('exportCrimeHotspotPack carries a real area\'s rates, scoped to one city', () => {
  const layer = createWorldLayer();
  const laArea = generateLocation(layer, { name: 'Rampart', lat: 34.0, lng: -118.2, tier: 'filler' });
  const chiArea = generateLocation(layer, { name: 'Englewood', lat: 41.8, lng: -87.6, tier: 'filler' });
  importAreaIncidents(layer, laArea.id, {
    city: 'los-angeles', areaName: 'Rampart', violentCount: 300, propertyCount: 900, population: 30000,
  });
  importAreaIncidents(layer, chiArea.id, {
    city: 'chicago', areaName: 'Englewood', propertyCount: 500, population: 25000,
  });
  const pack = exportCrimeHotspotPack(layer, { region: 'Los Angeles, California', city: 'los-angeles' });
  assert.equal(pack.areas.length, 1);
  assert.equal(pack.areas[0].areaName, 'Rampart');
  assert.equal(pack.areas[0].propertyRatePer1k, 30);
});

test('exportCrimeHotspotPack excludes an area with neither real rate', () => {
  const layer = createWorldLayer();
  const location = generateLocation(layer, { name: 'Nowhere', lat: 34.0, lng: -118.2, tier: 'filler' });
  importAreaIncidents(layer, location.id, { city: 'los-angeles', areaName: 'Nowhere', population: null });
  const pack = exportCrimeHotspotPack(layer, { region: 'Los Angeles, California', city: 'los-angeles' });
  assert.deepEqual(pack.areas, []);
});
