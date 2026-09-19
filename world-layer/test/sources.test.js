// Every free dataset this project has identified, and what it saves.
//
// ---------------------------------------------------------------------
// Sixteen sources named across the documents, one wired
// ---------------------------------------------------------------------
// `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` §8 names six "to evaluate",
// `AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` names three more,
// `OVERTURE_MAPS_DATASET_UPDATED_COST_SAVINGS.md` names a tenth with six
// themes inside it, and the cost documents name Cesium's terrain and
// buildings. Before this, **UNESCO was the only one with an importer**
// — which is not a criticism of documents that say "evaluate", but it
// did mean the question "what can somebody building a region pull down
// for free today?" had no answer, and the answer turns out to be most
// of a world.
//
// Two more were added from the project's own lost document titles:
// `REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` was about BLS labour
// data, and Census ACS covers the demographics beside it. The documents
// are gone; the data they were about is free and still there.
//
// ---------------------------------------------------------------------
// Why this is a cost test, not a plumbing test
// ---------------------------------------------------------------------
// §7's hierarchy prices Tier 1 as "real, paid human work" and Tier 3 as
// "fully automated". `costModel.estimateBuildCost` prices tiers and knew
// nothing about DATA, so a world with every dataset wired and a world
// with none priced identically — which is why the architecture
// document's own implementation note concedes the 90%/10% automation
// target "is an aspiration with no measurement behind it".
//
// `automationCoverage` is the measurement, and these tests hold it to
// reporting SHARES rather than money. Turning "6 of 7 slices automated"
// into a percentage off would invent the one figure nobody has measured
// — the labour cost per slice.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const sources = require('../sources');
const costModel = require('../costModel');
const { LOCATION_TIERS, createWorldLayer, generateLocation, setLocationData } = require('../locations');
const overture = require('../imports/overtureImport');
const nrhp = require('../imports/nrhpImport');
const wikidata = require('../imports/wikidataImport');
const noaa = require('../imports/noaaImport');
const census = require('../imports/censusImport');
const bls = require('../imports/blsImport');
const gnis = require('../imports/gnisImport');
const hifld = require('../imports/hifldImport');

// ---------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------

test('every source names a licence, an access path and a host', () => {
  // A source with no stated access path is a source nobody can use, and
  // an unnamed licence is a liability discovered by somebody else.
  for (const [key, source] of Object.entries(sources.SOURCES)) {
    assert.ok(source.name, `${key} has no name`);
    assert.ok(source.licence, `${key} has no licence`);
    assert.ok(source.access, `${key} has no access path`);
    assert.ok(source.host, `${key} has no host`);
    assert.ok(source.note, `${key} has no note saying what it is for`);
  }
});

test('every source fills real slices and serves real tiers', () => {
  // Standing rule 6's shape: a source claiming to fill a slice that
  // does not exist fills nothing, forever, and nothing would notice.
  for (const [key, source] of Object.entries(sources.SOURCES)) {
    assert.ok(source.fills.length > 0, `${key} fills nothing`);
    for (const slice of source.fills) {
      assert.ok(sources.WORLD_SLICES.includes(slice), `${key} → slice "${slice}"`);
    }
    assert.ok(source.tiers.length > 0, `${key} serves no tier`);
    for (const tier of source.tiers) {
      assert.ok(LOCATION_TIERS.includes(tier), `${key} → tier "${tier}"`);
    }
  }
});

test('a source claiming to be wired points at a file that exists', () => {
  // The difference between a source we HAVE and one we have READ ABOUT.
  // A `wired` path that does not resolve is the citation-is-not-presence
  // failure this whole repo keeps finding.
  const fs = require('node:fs');
  const path = require('node:path');
  for (const key of sources.wiredSources()) {
    const file = path.join(__dirname, '..', sources.SOURCES[key].wired);
    assert.ok(fs.existsSync(file), `${key} claims ${sources.SOURCES[key].wired}, which is not there`);
  }
});

test('every slice is covered by a source or declared uncoverable', () => {
  // "Nothing covers this" and "we forgot to look" are different facts
  // and only one is a budget line.
  const report = sources.describeSources();
  assert.deepEqual(report.uncoveredSlices, []);
  for (const slice of report.uncoveredByDesign) {
    assert.ok(sources.UNCOVERED_BY_DESIGN[slice], `${slice} is uncovered with no reason given`);
  }
});

test('licences nobody has re-checked are counted, not assumed current', () => {
  // `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`: dataset terms
  // change quietly and must be re-checked at build time rather than
  // trusted from design-phase research. This counts the trust currently
  // being extended.
  const report = sources.describeSources();
  assert.equal(report.licencesUnverified.length, sources.SOURCE_NAMES.length);
  for (const key of report.licencesUnverified) {
    assert.equal(sources.SOURCES[key].licenceCheckedAt, null);
  }
});

test('sources whose conditions reach the shipped product are named', () => {
  // ODbL share-alike and a commercial API are late-discovered costs if
  // nobody writes them down early.
  const report = sources.describeSources();
  assert.ok(report.encumbered.includes('cesiumBuildings'));
  assert.ok(report.encumbered.includes('openstreetmap'));
  assert.ok(report.encumbered.includes('openweather'));
});

// ---------------------------------------------------------------------
// Overture Places — the retail Key locations
// ---------------------------------------------------------------------

test('all ten retail Key location types are reachable from Overture categories', () => {
  // `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md`'s list is closed, so the
  // map must be complete rather than a sample — a store type no
  // category reaches is a store type that never appears in an import.
  const reachable = new Set(Object.values(overture.CATEGORY_MAP));
  for (const type of [
    'hardware-store', 'clothing-store', 'grocery-store', 'pharmacy',
    'sporting-goods-store', 'electronics-store', 'auto-parts-store',
    'bookstore', 'gun-store', 'department-store',
  ]) {
    assert.ok(reachable.has(type), `nothing maps to ${type}`);
  }
});

test('a dotted Overture category matches on its prefix and its leaf', () => {
  assert.equal(overture.categoryFor('hardware').category, 'hardware-store');
  assert.equal(overture.categoryFor('hardware.paint_store').category, 'hardware-store');
  assert.equal(overture.categoryFor('retail.shopping.bookstore').category, 'bookstore');
  assert.equal(overture.categoryFor('health.hospital').category, 'hospital');
});

test('an unrecognised category is skipped and named, never defaulted', () => {
  // Overture carries every business on earth; most are legitimately not
  // Key locations. Defaulting them to `other-distinctive-feature` turns
  // a city into one category with nothing to show it happened.
  assert.equal(overture.categoryFor('eat_and_drink.restaurant.pizza'), null);
  const layer = createWorldLayer();
  const { imported, skipped } = overture.importOverturePlaces(layer, [
    { name: 'Joe\'s Pizza', category: 'eat_and_drink.restaurant.pizza', lat: 1, lng: 2 },
  ]);
  assert.equal(imported.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /not a Key location type/);
});

test('Overture places land as locations with their real names and category', () => {
  const layer = createWorldLayer();
  const { imported } = overture.importOverturePlaces(layer, [
    {
      names: { primary: 'Riverside Hardware' },
      categories: { primary: 'hardware' },
      geometry: { coordinates: [-90.19, 38.62] },
      addresses: [{ locality: 'Downtown' }],
    },
  ]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].name, 'Riverside Hardware');
  assert.equal(imported[0].lat, 38.62);
  assert.equal(imported[0].landmarkData.category, 'hardware-store');
  assert.equal(imported[0].landmarkData.area, 'Downtown');
  // **No significance.** Overture knows a business exists; it does not
  // know what it is worth remembering, and a made-up score here would
  // put an invented number where the consumer expects a sourced one.
  assert.equal(imported[0].landmarkData.historicalImportance, undefined);
});

// ---------------------------------------------------------------------
// NRHP — the source that answers a region
// ---------------------------------------------------------------------

test('NRHP significance comes from the Register’s own published grading', () => {
  // Sourced ordering, interpretive spacing — and anchored below
  // UNESCO's 100 so all the sources land on one scale.
  assert.ok(nrhp.SIGNIFICANCE_BY_LEVEL.national > nrhp.SIGNIFICANCE_BY_LEVEL.state);
  assert.ok(nrhp.SIGNIFICANCE_BY_LEVEL.state > nrhp.SIGNIFICANCE_BY_LEVEL.local);
  assert.ok(nrhp.SIGNIFICANCE_BY_LEVEL['national-historic-landmark'] < 100);
  assert.equal(nrhp.significanceFor({ nationalHistoricLandmark: true }), 90);
  assert.equal(nrhp.significanceFor({ level: 'Local' }), 40);
  // Ungraded is null, not the lowest grade — different facts.
  assert.equal(nrhp.significanceFor({ name: 'X' }), null);
});

test('a listing’s category comes from its function, not its resource type', () => {
  // The Register classifies Building / Structure / Site / District,
  // which is a preservation vocabulary and does not say "this is a
  // library".
  assert.equal(nrhp.categoryFor({ historicFunction: 'Education/Library' }), 'library');
  assert.equal(nrhp.categoryFor({ currentFunction: 'Social/Meeting Hall' }), 'masonic-building');
  assert.equal(nrhp.categoryFor({ historicFunction: 'Agriculture/Farmhouse' }), null);
});

test('a National Historic Landmark is hero tier; an ordinary listing is regional', () => {
  // §7's cost hinge: hero is paid human work, regional is AI-assisted
  // refinement. Decided from the source's own grading rather than here.
  const layer = createWorldLayer();
  const { imported } = nrhp.importNrhpListings(layer, [
    { name: 'Old Courthouse', historicFunction: 'Government/Courthouse', nationalHistoricLandmark: true, lat: 38.62, lng: -90.19 },
    { name: 'Moolah Temple', historicFunction: 'Social/Meeting Hall', level: 'Local', lat: 38.63, lng: -90.23 },
  ]);
  assert.equal(imported[0].tier, 'hero');
  assert.equal(imported[1].tier, 'regional');
  assert.equal(imported[0].landmarkData.historicalImportance, 90);
});

test('a listing with withheld coordinates is flagged rather than placed at a guess', () => {
  // The Register withholds coordinates for archaeological sites, to
  // stop looting. That is deliberate and gets recorded, not papered
  // over with a plausible point.
  const layer = createWorldLayer();
  const { imported } = nrhp.importNrhpListings(layer, [
    { name: 'A Mound Site', historicFunction: 'Landscape/Natural Feature', level: 'State' },
  ]);
  assert.equal(imported[0].landmarkData.coordinatesWithheld, true);
});

test('a farmhouse is skipped with a reason — a listed property is not a hero landmark', () => {
  const layer = createWorldLayer();
  const { imported, skipped } = nrhp.importNrhpListings(layer, [
    { name: 'Smith Farmhouse', historicFunction: 'Agriculture/Farmhouse', lat: 1, lng: 2 },
  ]);
  assert.equal(imported.length, 0);
  assert.match(skipped[0].reason, /not a hero landmark/);
});

// ---------------------------------------------------------------------
// Wikidata and Commons — names and pictures
// ---------------------------------------------------------------------

test('an image carries its OWN licence, because Commons licences per file', () => {
  assert.deepEqual(wikidata.obligationsFor({ licence: 'CC-BY-SA' }), {
    licence: 'cc-by-sa', attribution: true, shareAlike: true,
  });
  assert.deepEqual(wikidata.obligationsFor({ licence: 'CC0' }), {
    licence: 'cc0', attribution: false, shareAlike: false,
  });
});

test('an image with no recognisable licence is unknown, not free', () => {
  // Shipping an unknown as if it were free is how a licence problem
  // becomes somebody else's discovery.
  assert.equal(wikidata.obligationsFor({ licence: 'probably fine' }), null);
  assert.equal(wikidata.obligationsFor({}), null);
});

test('a picture can be attached to a location imported from any source', () => {
  // Pictures arrive separately in practice: import a region's landmarks
  // from NRHP, then go looking for reference art.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Old Courthouse', lat: 38.62, lng: -90.19, tier: 'hero' });
  setLocationData(layer, place.id, 'landmarkData', { category: 'government-building' });

  wikidata.attachImage(layer, place.id, {
    file: 'Old Courthouse StL.jpg', url: 'https://example/x.jpg', licence: 'CC-BY-SA', author: 'A Photographer',
  });
  assert.equal(place.landmarkData.category, 'government-building', 'attaching an image lost the category');
  assert.equal(place.landmarkData.image.obligations.shareAlike, true);
});

test('describeImages reports the licence position, including the unknowns', () => {
  const layer = createWorldLayer();
  const a = generateLocation(layer, { name: 'A', lat: 1, lng: 2, tier: 'hero' });
  const b = generateLocation(layer, { name: 'B', lat: 3, lng: 4, tier: 'hero' });
  wikidata.attachImage(layer, a.id, { url: 'u1', licence: 'CC-BY' });
  wikidata.attachImage(layer, b.id, { url: 'u2', licence: 'unclear' });

  const report = wikidata.describeImages(layer);
  assert.equal(report.withImage, 2);
  assert.equal(report.requiringAttribution, 1);
  assert.deepEqual(report.unlicensedImages, ['B']);
});

// ---------------------------------------------------------------------
// Census ACS — real neighbourhoods, and §9's firewall
// ---------------------------------------------------------------------

test('ACS produces distributions and never a person', () => {
  // §9 permits demographic modelling and FORBIDS demographics
  // determining morality, criminality, intelligence or worth. That is a
  // rule about what may read a distribution, not about where it came
  // from — and real data makes it more pressing, because a measured
  // number carries an authority an invented one does not.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Tract 1021', lat: 38.62, lng: -90.19, tier: 'filler' });
  census.importAcsTract(layer, place.id, {
    tractId: '29510102100',
    population: 4120,
    ageCounts: { '0-15': 800, '16-64': 2700, '65+': 620 },
    attainment: { less_than_high_school: 300, high_school_graduate: 900, bachelors_degree: 700 },
    medianHouseholdIncome: 48200,
  });

  assert.equal(place.populationData.containsIndividualAttributes, false);
  // Shares, not counts — a tract has thousands of people and a
  // generated community has dozens.
  assert.ok(place.populationData.ageBands['0-15'] < 1);
  assert.equal(place.economicData.medianHouseholdIncome, 48200);
});

test('an unattributed statistic is refused', () => {
  // A figure with no tract id cannot be checked against the source, and
  // an uncheckable statistic is indistinguishable from an invented one.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'X', lat: 1, lng: 2, tier: 'filler' });
  assert.throws(() => census.importAcsTract(layer, place.id, { population: 100 }), /tractId/);
});

test('ACS attainment maps onto the engine’s own six levels', () => {
  const demographics = require('../../vacon-c/server/demographics.js');
  for (const level of Object.values(census.ATTAINMENT_MAP)) {
    assert.ok(demographics.EDUCATION_LEVELS.includes(level), `"${level}" is not an education level`);
  }
  // And the rung with no clean equivalent is declared rather than
  // presented as a match.
  assert.ok(census.APPROXIMATE_RUNGS.includes('vocational'));
});

test('an ACS category the map does not know is named, not folded into a neighbour', () => {
  // A silent fold is how a distribution ends up shaped by the mapping
  // rather than by the data.
  const result = census.attainmentDistribution({
    high_school_graduate: 100, doctorate_in_basket_weaving: 50,
  });
  assert.deepEqual(result.unmapped, ['doctorate_in_basket_weaving']);
});

test('suppressed figures are reported as missing, not smoothed to zero', () => {
  // The Census Bureau suppresses figures for small populations to
  // protect privacy. That is a real property of the source, and a null
  // share is not a zero share.
  const layer = createWorldLayer();
  const place = generateLocation(layer, { name: 'Tract 9', lat: 1, lng: 2, tier: 'filler' });
  census.importAcsTract(layer, place.id, { tractId: '29510000900', population: 12 });
  const report = census.describeAcsCoverage(layer);
  assert.equal(report.tracts, 1);
  assert.deepEqual(report.suppressedOrMissing.attainment, ['Tract 9']);
});

// ---------------------------------------------------------------------
// BLS — the lost document's data
// ---------------------------------------------------------------------

test('every engine occupation maps to a SOC group, and none is fictional', () => {
  // **This test caught a real defect.** The first version of the map was
  // written from memory of the occupation list rather than from the
  // list: ten occupations that do not exist (`banker`, `programmer`,
  // `nurse`, `smith`, `miner`...) and seven real ones unmapped. Hence
  // comparing against the actual export rather than against a count.
  const occupations = require('../../vacon-c/server/occupations.js');
  const mapped = Object.keys(bls.SOC_GROUP_BY_OCCUPATION);

  assert.deepEqual(
    occupations.OCCUPATION_NAMES.filter((o) => bls.groupFor(o) === null), [],
    'an occupation with no SOC group can never be informed by real employment data',
  );
  assert.deepEqual(
    mapped.filter((m) => !occupations.OCCUPATION_NAMES.includes(m)), [],
    'the map names an occupation this engine does not have',
  );
});

test('every group used has a published name, and every named group is used', () => {
  const used = new Set(Object.values(bls.SOC_GROUP_BY_OCCUPATION));
  for (const group of used) assert.ok(bls.SOC_GROUP_NAMES[group], `group ${group} has no name`);
  for (const group of Object.keys(bls.SOC_GROUP_NAMES)) {
    assert.ok(used.has(group), `group ${group} is named and nothing maps to it`);
  }
});

test('OES rows become an employment shape, with what the engine cannot model named', () => {
  // A collapsed world has no paralegals. The share of a real labour
  // market this engine cannot represent is a fact about the model worth
  // reporting rather than dropping.
  const shape = bls.toEmploymentShape([
    { socGroup: '47-0000', employment: 5000 },
    { socGroup: '29-0000', employment: 3000 },
    { socGroup: '23-0000', employment: 2000 },
  ]);
  assert.equal(shape.shares['47'], 0.625);
  assert.deepEqual(shape.unmodelledGroups, [{ group: '23', employment: 2000 }]);
  assert.equal(shape.modelledShare, 0.8);
});

test('median and mean wages are both kept, and neither is derived', () => {
  // Wage distributions are strongly skewed; a mean without a median
  // hides exactly what a game economy cares about, and one cannot be
  // computed from the other.
  const table = bls.toWageTable([{ socGroup: '47-0000', medianWage: 48000, meanWage: 53000 }]);
  assert.equal(table['47'].medianWage, 48000);
  assert.equal(table['47'].meanWage, 53000);
  assert.ok(table['47'].occupations.includes('labourer'));
});

test('a labour market attaches to a city without destroying its other economics', () => {
  const layer = createWorldLayer();
  const city = generateLocation(layer, { name: 'St. Louis', lat: 38.62, lng: -90.19, tier: 'regional' });
  setLocationData(layer, city.id, 'economicData', { medianHouseholdIncome: 48200 });
  bls.importOesMetro(layer, city.id, {
    areaCode: '41180', areaName: 'St. Louis, MO-IL', year: 2023,
    rows: [{ socGroup: '47-0000', employment: 5000, medianWage: 48000 }],
  });
  assert.equal(city.economicData.medianHouseholdIncome, 48200, 'the labour market overwrote the income');
  assert.equal(city.economicData.labourMarket.areaCode, '41180');
});

// ---------------------------------------------------------------------
// GNIS — the two categories with no other source at all
// ---------------------------------------------------------------------

test('GNIS reaches cave-system and natural-formation, which nothing else does', () => {
  // UNESCO does not list a local cave, the National Register does not
  // list a bluff, and Overture carries no natural features. Without
  // GNIS these two Key categories can be generated and never named.
  const reachable = new Set(Object.values(gnis.FEATURE_CLASS_MAP));
  assert.ok(reachable.has('cave-system'));
  assert.ok(reachable.has('natural-formation'));
});

test('every GNIS class maps to a real Key category', () => {
  const landmarks = require('../../vacon-c/server/landmarks.js');
  for (const [featureClass, category] of Object.entries(gnis.FEATURE_CLASS_MAP)) {
    assert.ok(landmarks.ALL_CATEGORIES.includes(category), `${featureClass} → "${category}"`);
  }
});

test('a populated place names an AREA rather than becoming a landmark', () => {
  // A town is the landmark pack's `area` field, not a monument to put
  // in it.
  const layer = createWorldLayer();
  const result = gnis.importGnisFeatures(layer, [
    { featureName: 'Kirkwood', featureClass: 'Populated Place', primaryLatitude: 38.58, primaryLongitude: -90.40 },
    { featureName: 'Cliff Cave', featureClass: 'Cave', primaryLatitude: 38.45, primaryLongitude: -90.29 },
  ]);
  assert.deepEqual(result.places, ['Kirkwood']);
  assert.equal(result.imported.length, 1);
  assert.equal(result.imported[0].landmarkData.category, 'cave-system');
});

test('null island is skipped, not placed', () => {
  // GNIS gives 0,0 for features whose coordinates were never captured.
  // A Missouri cave in the Gulf of Guinea is worse than a missing one.
  const layer = createWorldLayer();
  const result = gnis.importGnisFeatures(layer, [
    { featureName: 'Unlocated Cave', featureClass: 'Cave', primaryLatitude: 0, primaryLongitude: 0 },
  ]);
  assert.equal(result.imported.length, 0);
  assert.equal(result.skippedByClass.cave, 1);
});

test('the creeks nobody wants are counted as deliberately skipped', () => {
  // "We chose not to import 40,000 streams" and "the importer lost
  // 40,000 streams" are different facts.
  const layer = createWorldLayer();
  const result = gnis.importGnisFeatures(layer, [
    { featureName: 'Coldwater Creek', featureClass: 'Stream', primaryLatitude: 38.7, primaryLongitude: -90.3 },
    { featureName: 'Some Gully', featureClass: 'Gully', primaryLatitude: 38.7, primaryLongitude: -90.3 },
  ]);
  const report = gnis.describeGnisImport(result);
  assert.equal(report.imported, 0);
  assert.equal(report.bulkSkipped, 2);
});

// ---------------------------------------------------------------------
// HIFLD — the engine's own ten infrastructure types
// ---------------------------------------------------------------------

test('every HIFLD layer maps to a real infrastructure type', () => {
  const infrastructure = require('../../vacon-c/server/infrastructure.js');
  for (const [layer, definition] of Object.entries(hifld.LAYERS)) {
    assert.ok(
      infrastructure.INFRASTRUCTURE_TYPES.includes(definition.infrastructureType),
      `${layer} → "${definition.infrastructureType}"`,
    );
  }
});

test('a layer that is also a Key landmark maps to a real category', () => {
  const landmarks = require('../../vacon-c/server/landmarks.js');
  for (const [layer, definition] of Object.entries(hifld.LAYERS)) {
    if (definition.category === null) continue;
    assert.ok(landmarks.ALL_CATEGORIES.includes(definition.category), `${layer} → ${definition.category}`);
  }
});

test('an unnamed layer is refused rather than guessed from field names', () => {
  // HIFLD is hundreds of layers with different schemas. Inferring which
  // one this is would be how a fire station gets counted as a hospital.
  assert.throws(
    () => hifld.importHifldLayer(createWorldLayer(), 'mystery-layer', []),
    /not a mapped HIFLD layer/,
  );
});

test('a hospital arrives with its real bed count', () => {
  // The number `landmarks.staffingFor` and `control.maintenanceFor`
  // currently size a crew from a band for.
  const layer = createWorldLayer();
  const { imported } = hifld.importHifldLayer(layer, 'hospitals', [
    { name: 'Barnes-Jewish Hospital', lat: 38.637, lng: -90.264, beds: 1266, county: 'St. Louis' },
  ]);
  assert.equal(imported[0].buildingData.capacity, 1266);
  assert.equal(imported[0].buildingData.capacityUnit, 'beds');
  assert.equal(imported[0].landmarkData.category, 'hospital');
  assert.equal(imported[0].tier, 'regional');
});

test('a missing capacity is null, not zero', () => {
  // A hospital with no recorded bed count is not a hospital with no
  // beds, and the difference decides whether a band is still doing the
  // work.
  const layer = createWorldLayer();
  const { imported } = hifld.importHifldLayer(layer, 'hospitals', [
    { name: 'A Clinic', lat: 38.6, lng: -90.2 },
  ]);
  assert.equal(imported[0].buildingData.capacity, null);
  assert.equal(imported[0].buildingData.capacityReported, false);
});

test('pure infrastructure is filler; a landmark somebody could take is regional', () => {
  // §7's tiers: a hospital earns refinement, a pumping station does not.
  const layer = createWorldLayer();
  const { imported } = hifld.importHifldLayer(layer, 'wastewater-treatment', [
    { name: 'Bissell Point Plant', lat: 38.66, lng: -90.19, flowMgd: 150 },
  ]);
  assert.equal(imported[0].tier, 'filler');
  assert.equal(imported[0].landmarkData, null);
});

test('the two infrastructure types HIFLD does not cover are named', () => {
  // Roads are Overture Transportation's job and internet infrastructure
  // is not published as open national data in this form. Stated rather
  // than left as a silent zero.
  const layer = createWorldLayer();
  hifld.importHifldLayer(layer, 'hospitals', [{ name: 'H', lat: 1, lng: 2, beds: 10 }]);
  const report = hifld.describeInfrastructureCoverage(layer);
  assert.ok(report.uncovered.includes('roads'));
  assert.ok(report.uncovered.includes('internet'));
  assert.deepEqual(report.byType.hospitals, { facilities: 1, withCapacity: 1 });
});

// ---------------------------------------------------------------------
// Every fetch is honest about being blocked
// ---------------------------------------------------------------------

test('each fetch says why it cannot run and what to call instead', () => {
  // Checked directly on 18 Sep 2026: every source host returns 403
  // CONNECT at this environment's agent proxy. Per /root/.ccr/README.md
  // that is report-do-not-work-around — so each stub names the block,
  // names the real access path, and names the import function that does
  // the work once records are in hand.
  for (const fetcher of [
    overture.fetchOverturePlaces,
    overture.fetchOvertureDivisions,
    overture.fetchOvertureBuildings,
    nrhp.fetchNrhpListings,
    wikidata.fetchWikidataEntities,
    wikidata.fetchCommonsImages,
    noaa.fetchClimateNormals,
    census.fetchAcsTracts,
    bls.fetchOesData,
    gnis.fetchGnisFile,
    hifld.fetchHifldLayer,
  ]) {
    assert.throws(fetcher, (error) => {
      assert.match(error.message, /not implemented/);
      assert.match(error.message, /proxy allowlist/);
      assert.match(error.message, /import|attachImage|classify/i);
      return true;
    });
  }
});

// ---------------------------------------------------------------------
// Overture Divisions — the neighbourhood names everything hangs on
// ---------------------------------------------------------------------

test('divisions produce the area NAMES a landmark pack matches on', () => {
  // `vacon-c/server/landmarkPacks.js` matches an imported landmark to a
  // neighbourhood by name. Until this, the only source of those names
  // was somebody typing them.
  const layer = createWorldLayer();
  const { byLevel } = overture.importOvertureDivisions(layer, [
    { name: 'Downtown', subtype: 'neighborhood', lat: 38.62, lng: -90.19 },
    { name: 'Central West End', subtype: 'neighborhood', lat: 38.64, lng: -90.26 },
    { name: 'St. Louis', subtype: 'locality', lat: 38.62, lng: -90.19 },
  ]);
  assert.deepEqual(byLevel.community, ['Downtown', 'Central West End']);
  assert.deepEqual(byLevel.city, ['St. Louis']);
});

test('a subtype above what the engine models is skipped, not demoted', () => {
  // Silently treating a country as a neighbourhood would put a state in
  // a list of city blocks.
  const layer = createWorldLayer();
  const { skipped } = overture.importOvertureDivisions(layer, [
    { name: 'United States', subtype: 'country', lat: 39, lng: -98 },
  ]);
  assert.match(skipped[0].reason, /not a level this engine models/);
  assert.equal(overture.divisionLevelFor('country'), null);
});

test('a division with no point still contributes its name', () => {
  // The NAME is the deliverable for a landmark pack; the point is a
  // bonus. Losing the name because a centroid was missing would throw
  // away the useful half.
  const layer = createWorldLayer();
  const { imported, byLevel } = overture.importOvertureDivisions(layer, [
    { name: 'The Hill', subtype: 'neighborhood' },
  ]);
  assert.equal(imported.length, 0);
  assert.deepEqual(byLevel.community, ['The Hill']);
});

// ---------------------------------------------------------------------
// Overture Buildings — what land_size and floors are guessed at
// ---------------------------------------------------------------------

test('buildings carry real measurements, and null where the source is silent', () => {
  // A plausible default is indistinguishable from a measurement, which
  // is the whole reason worldgen's random bands are a problem worth
  // solving rather than a style choice.
  const layer = createWorldLayer();
  const { imported } = overture.importOvertureBuildings(layer, [
    { name: 'Wainwright Building', class: 'office', lat: 38.62, lng: -90.19, footprintArea: 1850, height: 45 },
  ]);
  const data = imported[0].buildingData;
  assert.equal(data.propertyType, 'commercial');
  assert.equal(data.footprintArea, 1850);
  assert.equal(data.heightMetres, 45);
  // Height and floors are different measurements. Deriving one from the
  // other needs an assumed storey height — an invented constant.
  assert.equal(data.numFloors, null);
});

test('an unclassified building does not quietly become a house', () => {
  assert.equal(overture.propertyTypeFor('something_else'), null);
  assert.equal(overture.propertyTypeFor(undefined), null);
  assert.equal(overture.propertyTypeFor('warehouse'), 'industrial');
});

test('an unnamed building is kept — the footprint is the value, not the name', () => {
  const layer = createWorldLayer();
  const { imported } = overture.importOvertureBuildings(layer, [
    { class: 'house', lat: 38.6201, lng: -90.1902, footprintArea: 120 },
  ]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].buildingData.named, false);
  assert.ok(imported[0].name.includes('38.62010'));
});

test('every Overture building class maps to a type the consuming schema defines', () => {
  // `properties.type` is a closed enumeration in
  // VACANCY_POSTGRESQL_SCHEMA.sql. A mapping that produced anything
  // else would fail on insert rather than at import.
  const schemaTypes = [
    'residential', 'commercial', 'industrial', 'government', 'agricultural',
    'mixed', 'farm', 'historical_site', 'digital_property', 'virtual_location',
  ];
  for (const [cls, type] of Object.entries(overture.BUILDING_CLASS_MAP)) {
    assert.ok(schemaTypes.includes(type), `${cls} → "${type}" is not a properties.type`);
  }
});

// ---------------------------------------------------------------------
// NOAA — the column the engine names as unmodellable
// ---------------------------------------------------------------------

test('the climate vocabulary is Köppen, not one this project invented', () => {
  // `migration.generateRegion` refuses to invent a climate vocabulary
  // and says so; `barter.js` lists `regions.climate_key` as the first
  // of three modifiers it cannot model. Köppen-Geiger is the published
  // standard, so the key is an identifier rather than a label.
  assert.equal(noaa.KOPPEN_GROUPS.A, 'tropical');
  assert.equal(noaa.KOPPEN_GROUPS.E, 'polar');
  assert.equal(Object.keys(noaa.KOPPEN_GROUPS).length, 5);
});

test('classification matches the published answer for known places', () => {
  // St. Louis is Cfa, Phoenix is BWh, Singapore is Af. If the
  // classifier disagrees with the literature it is wrong, and this is
  // how that gets caught.
  const stl = noaa.classify({
    temperaturesC: [0.6, 3.1, 8.6, 14.7, 19.8, 24.6, 26.8, 26.0, 21.9, 15.2, 8.6, 2.6],
    precipitationMm: [57, 55, 88, 106, 116, 99, 95, 76, 85, 84, 89, 68],
    latitude: 38.62,
  });
  assert.equal(stl.climateKey, 'Cfa');
  assert.equal(stl.group, 'temperate');

  assert.equal(noaa.classify({
    temperaturesC: [13, 15, 18, 22, 27, 32, 35, 34, 31, 24, 17, 12],
    precipitationMm: [20, 20, 25, 10, 3, 1, 25, 25, 18, 15, 18, 25],
    latitude: 33.4,
  }).climateKey, 'BWh');

  assert.equal(noaa.classify({
    temperaturesC: [26, 27, 27, 28, 28, 28, 28, 28, 28, 27, 27, 26],
    precipitationMm: [240, 160, 160, 180, 170, 160, 160, 175, 170, 195, 255, 290],
    latitude: 1.35,
  }).climateKey, 'Af');
});

test('a classification from half a year is refused, not estimated', () => {
  assert.throws(() => noaa.classify({
    temperaturesC: [1, 2, 3], precipitationMm: [1, 2, 3], latitude: 0,
  }), /twelve monthly means/);
  // And latitude is required rather than assumed north — "summer" is
  // different either side of the equator and the dry-season letters
  // depend on it.
  assert.throws(() => noaa.classify({
    temperaturesC: new Array(12).fill(10), precipitationMm: new Array(12).fill(50),
  }), /requires latitude/);
});

test('the key keeps the numbers it was derived from', () => {
  // A summary that destroys its inputs cannot be checked.
  const result = noaa.classify({
    temperaturesC: new Array(12).fill(15),
    precipitationMm: new Array(12).fill(80),
    latitude: 40,
  });
  assert.equal(result.measures.annualMeanC, 15);
  assert.equal(result.measures.annualPrecipitationMm, 960);
  assert.equal(result.source, 'noaa-climate-normals');
});

test('climate attaches to a region without destroying its other geography', () => {
  const layer = createWorldLayer();
  const { imported } = overture.importOvertureDivisions(layer, [
    { name: 'Greater St. Louis', subtype: 'county', lat: 38.62, lng: -90.19 },
  ], { levels: ['region'] });
  const region = imported[0];

  noaa.importClimateNormals(layer, region.id, {
    temperaturesC: [0.6, 3.1, 8.6, 14.7, 19.8, 24.6, 26.8, 26.0, 21.9, 15.2, 8.6, 2.6],
    precipitationMm: [57, 55, 88, 106, 116, 99, 95, 76, 85, 84, 89, 68],
    stationId: 'GHCND:USW00013994',
  });
  assert.equal(region.geographyData.climate.climateKey, 'Cfa');
  assert.equal(region.geographyData.level, 'region', 'attaching climate lost the division level');
  assert.equal(region.geographyData.stationId, 'GHCND:USW00013994');
});

// ---------------------------------------------------------------------
// The cost measurement
// ---------------------------------------------------------------------

test('automationCoverage reports a share per tier, and names what would close each gap', () => {
  const report = costModel.automationCoverage();
  for (const tier of LOCATION_TIERS) {
    const row = report.byTier[tier];
    assert.ok(row, `no coverage for ${tier}`);
    assert.ok(row.wiredShare >= 0 && row.wiredShare <= 1);
    for (const gap of row.identifiedOnly) {
      assert.ok(gap.wouldClose.length > 0, `${tier}/${gap.slice} is a gap nothing would close`);
      for (const key of gap.wouldClose) assert.ok(sources.SOURCES[key], key);
    }
  }
  // Hero is the tier §7 prices as real paid human work, and it is the
  // one fully covered by free data — which is the finding, not a
  // coincidence: UNESCO, NRHP, Wikidata and Commons all aim there.
  assert.equal(report.byTier.hero.wiredShare, 1);
});

test('automationCoverage reports shares and never money', () => {
  // Turning coverage into a percentage off would invent the one number
  // nobody has measured — labour cost per slice. `estimateBuildCost`
  // already sets the rule: a rate nobody supplied is not a rate of zero.
  const report = costModel.automationCoverage();
  const asText = JSON.stringify(report);
  assert.ok(!/\$/.test(asText), 'automationCoverage quoted a currency figure');
  for (const row of Object.values(report.byTier)) {
    assert.equal(row.cost, undefined);
    assert.equal(row.saving, undefined);
  }
});

test('the hero rate is still a per-unit rate, not a launch invoice', () => {
  // Kept beside the new coverage numbers because it is the most
  // expensive misreading available in these documents: $420K-$960K is
  // full global Tier 1 coverage over the life of the project.
  const [low, high] = costModel.HERO_RATE_ON_FILE.perLocation;
  const { tierTotal, tierScope } = costModel.HERO_RATE_ON_FILE.derivedFrom;
  assert.equal(Math.round(tierTotal[0] / tierScope), low);
  assert.equal(Math.round(tierTotal[1] / tierScope), high);
});

// -- field depth: the coverage number that can still move -----------------

test('every source a field names is a real registry source', () => {
  // The table is a wishlist the moment it can name a dataset nobody
  // registered, licensed or checked the access path for.
  for (const [slice, fields] of Object.entries(sources.SLICE_FIELDS)) {
    for (const entry of fields) {
      assert.ok(Array.isArray(entry.source) && entry.source.length > 0,
        `${slice}.${entry.field} names no source at all`);
      for (const key of entry.source) {
        assert.ok(sources.SOURCES[key],
          `${slice}.${entry.field} names "${key}", which is not in the registry`);
      }
    }
  }
});

test('every field names the engine consumer that wants it', () => {
  // **A field with no consumer is a field nobody asked for.** This is
  // the guard against the table growing into a list of datasets that
  // would be nice to have, which is how a budget line becomes fiction.
  for (const [slice, fields] of Object.entries(sources.SLICE_FIELDS)) {
    for (const entry of fields) {
      assert.ok(typeof entry.consumer === 'string' && entry.consumer.length > 10,
        `${slice}.${entry.field} names no consumer`);
    }
  }
});

test('every slice with a source is broken into fields', () => {
  // Otherwise a slice could be added, counted as covered by the tier
  // report, and never appear in the depth report at all — which is the
  // exact blindness this table was added to remove.
  const priced = sources.WORLD_SLICES.filter((s) => !sources.UNCOVERED_BY_DESIGN[s]);
  for (const slice of priced) {
    assert.ok(sources.SLICE_FIELDS[slice],
      `${slice} is a real slice with no field breakdown, so its gaps are invisible`);
  }
});

test('field depth is below slice coverage, and that is the point', () => {
  // Slice coverage reports 7 of 7 non-design-excluded slices as having
  // a source. If depth ever equals that, either the work is genuinely
  // finished or the table has stopped naming gaps — and the second is
  // far more likely, so this fails loudly either way and somebody
  // re-reads it.
  const depth = sources.fieldDepth();
  assert.ok(depth.fields > 0);
  assert.ok(depth.filled < depth.fields,
    'every field is filled — verify that is true rather than that the table went stale');
  // And the open list is actionable: each one names what would close it.
  for (const open of depth.openFields) {
    assert.ok(open.wouldClose.length > 0, `${open.slice}.${open.field} is open with no way to close it`);
  }
});

test('automationCoverage carries the depth report, not only the tier shares', () => {
  // The tier shares cannot move: ten of the twelve unwired sources fill
  // only slices already marked covered, and the two that would move it
  // fill transportation, which is deferred by policy. A cost report
  // whose headline is pinned needs the number that is not.
  const report = costModel.automationCoverage();
  assert.ok(report.depth, 'automationCoverage lost the field depth report');
  assert.ok(report.depth.depth < 1);
  assert.ok(report.depth.openFields.length > 0);
});
