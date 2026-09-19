// The ten importers wired in one pass, and what each one has to prove.
//
// ---------------------------------------------------------------------
// What these tests are for, and what they cannot be for
// ---------------------------------------------------------------------
// Every source here is blocked at this environment's proxy, so none of
// these transforms has ever seen a real record. That is exactly why the
// transform is the tested half: a `fetch*` that throws is trivially
// correct, and the mapping is where a fire station gets counted as a
// hospital.
//
// So each importer is held to the same four things, which are the four
// ways this repository has actually been burned:
//
//   1. an unrecognised input is NAMED, never defaulted — a silent
//      default turns a region into one category with nothing to show
//      it happened;
//   2. unknown is not zero — `Number(null)` is 0 and 0 is finite, so a
//      suppressed figure must not read as a measured absence;
//   3. an ordinary case comes out unchanged — CLAUDE.md's twelfth
//      rule, first clause: a modifier centred off the average
//      recalibrates every world that reads it;
//   4. the thing it claims to fill is a thing the ENGINE actually has.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const naturalEarth = require('../imports/naturalEarthImport');
const usgs = require('../imports/usgsImport');
const fema = require('../imports/femaImport');
const fbi = require('../imports/fbiImport');
const cdc = require('../imports/cdcImport');
const religion = require('../imports/religionImport');
const nces = require('../imports/ncesImport');
const cms = require('../imports/cmsImport');
const openweather = require('../imports/openweatherImport');
const transport = require('../imports/overtureTransportationImport');

function place(worldLayer, name = 'Test Place') {
  return generateLocation(worldLayer, { name, lat: 38.63, lng: -90.2, tier: 'regional' });
}

// ---------------------------------------------------------------------
// Natural Earth
// ---------------------------------------------------------------------

test('natural earth refuses an unnamed scale rather than guessing one', () => {
  // The same feature exists at three generalisations with different
  // geometry. Mixing them produces boundaries that do not meet, and
  // that failure is invisible in a count.
  const w = createWorldLayer();
  assert.throws(
    () => naturalEarth.importNaturalEarth(w, 'admin1', '1m', [{ name: 'X', lat: 1, lng: 1 }]),
    /not a Natural Earth scale/,
  );
  assert.throws(
    () => naturalEarth.importNaturalEarth(w, 'admin7', '10m', []),
    /not a mapped feature type/,
  );
});

test('natural earth carries public domain on the row, not just in a comment', () => {
  // Every other boundary source in the registry has conditions. A
  // consumer deciding what it may ship should not have to go and look
  // this up.
  const w = createWorldLayer();
  const { imported } = naturalEarth.importNaturalEarth(w, 'admin1', '10m', [
    { name: 'Missouri', lat: 38.5, lng: -92.5, adm0_name: 'United States of America', iso_a2: 'US' },
  ]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].geographyData.licence, 'public-domain');
  assert.equal(imported[0].geographyData.containedBy, 'United States of America');
});

test('a natural earth record with no coordinates is skipped and named', () => {
  const w = createWorldLayer();
  const { imported, skipped } = naturalEarth.importNaturalEarth(w, 'populated_places', '10m', [
    { name: 'Nowhere' },
    { lat: 1, lng: 1 },
  ]);
  assert.equal(imported.length, 0);
  assert.equal(skipped.length, 2);
  assert.ok(skipped.some((s) => s.reason === 'no usable coordinates'));
  assert.ok(skipped.some((s) => s.reason === 'no name'));
});

// ---------------------------------------------------------------------
// USGS 3DEP
// ---------------------------------------------------------------------

test('one elevation reading is a height, not a terrain', () => {
  // Returning `flat` for a single sample would be the Number(null)
  // corollary in a new place: unknown relief reported as no relief.
  assert.equal(usgs.classifyTerrain(142, [142]), null);
  assert.equal(usgs.classifyTerrain(142, []), null);
  assert.equal(usgs.classifyTerrain(142, undefined), null);
});

test('terrain is classified from relief, and position separates a ridge from a valley', () => {
  const flat = usgs.classifyTerrain(100, [98, 100, 102, 99]);
  assert.equal(flat.terrain, 'flat');

  // Same relief, opposite ends of it.
  const sample = [100, 150, 200, 250, 300];
  assert.equal(usgs.classifyTerrain(105, sample).position, 'valley');
  assert.equal(usgs.classifyTerrain(295, sample).position, 'ridge');
  assert.equal(usgs.classifyTerrain(200, sample).terrain, 'hilly');

  const mountains = usgs.classifyTerrain(1200, [800, 1000, 1200, 1500, 1600]);
  assert.equal(mountains.terrain, 'mountainous');
});

test('usgs refuses a missing elevation rather than recording sea level', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => usgs.importElevation(w, p.id, {}), /finite record.elevationMetres/);
  assert.throws(
    () => usgs.importElevation(w, p.id, { elevationMetres: 100, resolution: 7 }),
    /not a 3DEP resolution/,
  );
});

test('usgs writes locations.terrainType, the field every caller has passed null', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.equal(p.terrainType, null);
  usgs.importElevation(w, p.id, { elevationMetres: 180, sample: [100, 150, 180, 220, 260], resolution: 10 });
  assert.equal(p.terrainType, 'hilly');
  assert.equal(p.geographyData.elevationMetres, 180);
});

test('usgs coverage separates a height from a terrain', () => {
  const w = createWorldLayer();
  const a = place(w, 'With sample');
  const b = place(w, 'Height only');
  usgs.importElevation(w, a.id, { elevationMetres: 180, sample: [100, 180, 260] });
  usgs.importElevation(w, b.id, { elevationMetres: 180 });
  const report = usgs.describeElevationCoverage(w);
  assert.equal(report.withElevation, 2);
  assert.equal(report.withTerrain, 1);
  assert.equal(report.heightOnly, 1);
});

// ---------------------------------------------------------------------
// FEMA National Risk Index
// ---------------------------------------------------------------------

test('fema maps only hazards the engine runs, and names the rest', () => {
  // environment.SEVERE has four entries. A map dense enough to cover
  // all eighteen NRI hazards would be inventing most of itself.
  for (const condition of Object.values(fema.HAZARD_MAP)) {
    assert.ok(['drought', 'heat', 'freeze', 'storm'].includes(condition),
      `${condition} is not an environment.SEVERE condition`);
  }
  assert.ok(fema.UNMODELLED_NAMES.includes('wildfire'));
  for (const [hazard, reason] of Object.entries(fema.UNMODELLED_HAZARDS)) {
    assert.ok(reason.length > 10, `${hazard} is unmodelled with no reason given`);
  }
});

test('fema takes the worst flood hazard, not the average of them', () => {
  // A place that floods from rivers AND the coast AND hurricanes is at
  // the risk of its worst one. Averaging would let extra hazards make
  // a place look safer.
  const profile = fema.toRiskProfile({
    riverineFlooding: 'Very High',
    coastalFlooding: 'Very Low',
    hurricane: 'Relatively Low',
  });
  assert.equal(profile.byCondition.storm, 1);
  assert.equal(profile.sourceHazards.storm.length, 3);
});

test('fema names a material unmodelled risk rather than reading it as safe', () => {
  const w = createWorldLayer();
  const p = place(w);
  fema.importRiskIndex(w, p.id, {
    countyFips: '29510',
    ratings: { wildfire: 'Very High', drought: 'Relatively Low' },
  });
  const report = fema.describeHazardCoverage(w);
  assert.equal(report.materialUnmodelledRisks, 1);
  assert.equal(report.unmodelledByHazard.wildfire, 1);
  // And a low rating for an unmodelled hazard is not counted as a gap.
  const w2 = createWorldLayer();
  const p2 = place(w2);
  fema.importRiskIndex(w2, p2.id, { countyFips: '1', ratings: { wildfire: 'Very Low' } });
  assert.equal(fema.describeHazardCoverage(w2).materialUnmodelledRisks, 0);
});

test('fema refuses an unattributed risk score', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => fema.importRiskIndex(w, p.id, { ratings: {} }), /countyFips/);
});

// ---------------------------------------------------------------------
// FBI Crime Data Explorer
// ---------------------------------------------------------------------

test('the factor of a hundred lives in exactly one place', () => {
  assert.equal(fbi.per1kFrom100k(4000), 40);
  assert.equal(fbi.per1kFrom100k(100000), 1000);
  assert.equal(fbi.per1kFrom100k(0), 0);
  // Unknown is not zero.
  assert.equal(fbi.per1kFrom100k(null), null);
  assert.equal(fbi.per1kFrom100k(undefined), null);
  assert.equal(fbi.per1kFrom100k('not a number'), null);
});

test('every fbi offence maps to a category crime.js actually has', () => {
  const engineCategories = [
    'violent', 'property', 'drug', 'theft', 'gun', 'fraud', 'domestic', 'sex_offense',
  ];
  for (const [offence, category] of Object.entries(fbi.OFFENCE_MAP)) {
    assert.ok(engineCategories.includes(category), `${offence} maps to "${category}"`);
  }
  // domestic is deliberately unreachable and says why.
  assert.ok(fbi.UNREACHED_CATEGORIES.domestic);
});

test('an unmapped offence still counts into the total and is named', () => {
  // A society's crime rate does not shrink because a model cannot
  // represent part of it.
  const result = fbi.toReferenceRates([
    { offence: 'larceny-theft', ratePer100k: 2000 },
    { offence: 'loitering', ratePer100k: 1000 },
  ]);
  assert.equal(result.byCategory.theft, 20);
  assert.equal(result.totalPer1k, 30);
  assert.equal(result.unmappedOffences.length, 1);
  assert.equal(result.modelledShare, 0.667);
});

test('fbi calibration reports what the constant would become and never sets it', () => {
  // world-layer publishes data; VACON-C decides what to do with it.
  // Reaching across that boundary is what the per-app Docker build
  // context exists to prevent.
  const w = createWorldLayer();
  const p = place(w);
  fbi.importCrimeRates(w, p.id, {
    ori: 'MO0951100',
    rows: [{ offence: 'larceny-theft', ratePer100k: 8000 }],
  });
  const calibration = fbi.describeCalibration(w, 40);
  assert.equal(calibration.places, 1);
  assert.equal(calibration.medianTotalPer1k, 80);
  assert.equal(calibration.ratio, 2);
  assert.ok(/not applied/i.test(calibration.note));
});

test('fbi refuses an unattributed crime rate, because it calibrates a constant', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => fbi.importCrimeRates(w, p.id, { rows: [] }), /ori.*stateAbbr|stateAbbr/);
});

// ---------------------------------------------------------------------
// CDC PLACES
// ---------------------------------------------------------------------

test('an ordinary place comes out at exactly 1', () => {
  // CLAUDE.md's twelfth rule, first clause. A multiplier centred off
  // the average recalibrates every world that reads it, and that is
  // invisible because everything still looks wired.
  const ordinary = {};
  for (const id of ['CHD', 'STROKE', 'CANCER', 'COPD', 'DIABETES']) {
    ordinary[id] = cdc.ORDINARY_CHRONIC_PREVALENCE;
  }
  assert.equal(cdc.toHealthPressure(ordinary).pressure, 1);
});

test('a suppressed measure is ignored, not read as a place with none of it', () => {
  const result = cdc.toHealthPressure({ CHD: null, DIABETES: 10 });
  assert.equal(result.pressure, 1);
  assert.ok(result.ignored.some((i) => i.measure === 'CHD' && /suppressed/.test(i.reason)));
});

test('a place with no usable measure has no pressure, not an average one', () => {
  const result = cdc.toHealthPressure({ CHD: null, STROKE: undefined });
  assert.equal(result.pressure, null,
    'returning 1 would say the place had been measured and found ordinary');
});

test('cdc keeps access separate from illness', () => {
  // A place where people cannot see a doctor is not a place where
  // people are sicker.
  const result = cdc.toHealthPressure({ ACCESS2: 40, DIABETES: 10 });
  assert.equal(result.pressure, 1, 'insurance coverage moved a mortality multiplier');
  const w = createWorldLayer();
  const p = place(w);
  cdc.importPlacesTract(w, p.id, { tractId: '29510106', prevalences: { ACCESS2: 40, DIABETES: 10 } });
  assert.equal(p.populationData.healthPrevalence.access.ACCESS2, 40);
});

test('cdc produces shares for a place and never an attribute of a person', () => {
  // §9 permits demographic modelling and forbids demographics
  // determining morality, criminality, intelligence or worth.
  const w = createWorldLayer();
  const p = place(w);
  cdc.importPlacesTract(w, p.id, { tractId: '29510106', prevalences: { DIABETES: 12 } });
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('cdc pressure is bounded, so a health import cannot empty a world', () => {
  const extreme = {};
  for (const id of ['CHD', 'STROKE', 'CANCER', 'COPD', 'DIABETES']) extreme[id] = 100;
  const result = cdc.toHealthPressure(extreme);
  assert.equal(result.pressure, cdc.PRESSURE_BOUNDS[1]);
});

// ---------------------------------------------------------------------
// U.S. Religion Census
// ---------------------------------------------------------------------

test('unaffiliated is its own value, not missing data and not a belief', () => {
  const result = religion.toDistribution({ catholic: 200, judaism: 50 }, 1000);
  assert.equal(result.shares.catholic, 0.2);
  assert.equal(result.shares.jewish, 0.05);
  assert.equal(result.shares[religion.UNAFFILIATED], 0.75);
});

test('no population figure means no shares, not shares of the adherents', () => {
  // Normalising against adherents alone would report a county as 100%
  // religious, which is the opposite of what the source says.
  const result = religion.toDistribution({ catholic: 200 }, null);
  assert.equal(result.shares, null);
  assert.equal(result.adherents.catholic, 200);
});

test('an unrecognised body lands in other AND is named', () => {
  const result = religion.toDistribution({ someNewMovement: 100 }, 1000);
  assert.equal(result.shares.other, 0.1);
  assert.equal(result.unrecognised.length, 1);
  assert.equal(result.unrecognised[0].body, 'someNewMovement');
});

test('the licence warning travels on the data, not only in the file', () => {
  // This is the one encumbered source in the registry. A comment does
  // not travel with the world model into whatever reads it next.
  const w = createWorldLayer();
  const p = place(w);
  religion.importReligionCensus(w, p.id, {
    countyFips: '29510', population: 1000, adherents: { catholic: 300 },
  });
  assert.ok(/NOT public domain/i.test(p.populationData.religion.licenceWarning));
  assert.equal(p.populationData.religion.licence, 'academic-archive-restricted');
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('adherents exceeding a stale population figure cannot go negative', () => {
  const result = religion.toDistribution({ catholic: 1200 }, 1000);
  assert.equal(result.shares[religion.UNAFFILIATED], 0,
    'a negative share is arithmetic leaking into the model');
});

// ---------------------------------------------------------------------
// NCES
// ---------------------------------------------------------------------

test('a school with no reported teachers has no ratio, not a ratio of zero', () => {
  assert.equal(nces.pupilTeacherRatio(400, 20), 20);
  assert.equal(nces.pupilTeacherRatio(400, 0), null);
  assert.equal(nces.pupilTeacherRatio(400, null), null);
  assert.equal(nces.pupilTeacherRatio(0, 20), null);
});

test('nces refuses an unnamed collection', () => {
  // CCD and IPEDS have different schemas and different meanings for
  // enrolment. Guessing is how a primary school becomes a university.
  const w = createWorldLayer();
  assert.throws(() => nces.importNces(w, 'ccd2', []), /not an NCES collection/);
});

test('a grade span maps to the rungs a school actually serves', () => {
  assert.deepEqual(nces.levelsFor('09-12'), ['secondary']);
  assert.deepEqual(nces.levelsFor('KG-05'), ['primary']);
  assert.deepEqual(nces.levelsFor('KG-12'), ['primary', 'secondary']);
  // Unrecognised is null, never the whole ladder.
  assert.equal(nces.levelsFor('05-09'), null);
  assert.equal(nces.levelsFor(undefined), null);
});

test('nces coverage separates the head count from the ratio', () => {
  // A school placed with an enrolment and no staff figure still leaves
  // the ratio to a band, which is the number this import exists for.
  const w = createWorldLayer();
  const a = place(w, 'Full');
  const b = place(w, 'Enrolment only');
  nces.importInstitution(w, a.id, 'ccd', { ncessch: '1', enrolment: 400, teachers: 20, gradeSpan: '09-12' });
  nces.importInstitution(w, b.id, 'ccd', { ncessch: '2', enrolment: 300 });
  const report = nces.describeSchoolCoverage(w);
  assert.equal(report.schools, 2);
  assert.equal(report.withRatio, 1);
  assert.equal(report.withoutRatio, 1);
  assert.equal(report.medianRatio, 20);
});

// ---------------------------------------------------------------------
// CMS Provider of Services
// ---------------------------------------------------------------------

test('a dated bed count beats an undated one, whoever wrote it', () => {
  // Neither source is declared the winner — the same resolution
  // control.js uses for the two columns that say who is in a building.
  const dated = { capacity: 200, collectedAt: '2026-06-30' };
  const undated = { capacity: 500, collectedAt: null };
  assert.equal(cms.preferByDate(undated, dated), dated);
  assert.equal(cms.preferByDate(dated, undated), dated, 'an undated figure replaced a dated one');
});

test('two undated figures keep the existing one, so import order does not decide', () => {
  const a = { capacity: 200, collectedAt: null };
  const b = { capacity: 500, collectedAt: null };
  assert.equal(cms.preferByDate(a, b), a);
});

test('a later quarter refreshes a bed count and the change stays visible', () => {
  const w = createWorldLayer();
  const p = place(w, 'General Hospital');
  cms.importProvider(w, p.id, {
    ccn: '260001', providerType: 'short-term-hospital', beds: 400, collectedAt: '2025-03-31',
  });
  assert.equal(p.buildingData.capacity, 400);
  cms.importProvider(w, p.id, {
    ccn: '260001', providerType: 'short-term-hospital', beds: 250, collectedAt: '2026-06-30',
  });
  assert.equal(p.buildingData.capacity, 250);
  assert.equal(p.buildingData.capacitySupersededFrom.capacity, 400,
    'a bed count halving between quarters is a real event somebody may want to see');
  assert.equal(cms.describeProviderCoverage(w).refreshed, 1);
});

test('cms refuses a facility type it does not model, and says which it does', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(
    () => cms.importProvider(w, p.id, { ccn: '1', providerType: 'hospice', beds: 10 }),
    /not a provider type this importer maps/,
  );
  assert.throws(
    () => cms.importProvider(w, p.id, { providerType: 'short-term-hospital' }),
    /record.ccn/,
  );
});

// ---------------------------------------------------------------------
// OpenWeather — the one that costs money
// ---------------------------------------------------------------------

test('the cost warning is on the data and the bill can be worked out first', () => {
  const estimate = openweather.estimateCalls(100, 12);
  assert.equal(estimate.calls, 1200);
  assert.equal(estimate.withinFreeTier, false);
  assert.equal(estimate.freeTierDays, 2);
  assert.ok(/COMMERCIAL/i.test(estimate.costWarning));
  // And the pricing figure is flagged as unverified, like every licence
  // in sources.js — a pricing page changes quietly too.
  assert.equal(estimate.pricingVerified, false);
});

test('openweather refuses to overwrite a free NOAA classification', () => {
  // Spending money to replace a better-licensed answer is not a
  // trade-off, it is a mistake, and it should be loud.
  const w = createWorldLayer();
  const p = place(w);
  const noaa = require('../imports/noaaImport');
  noaa.importClimateNormals(w, p.id, {
    temperaturesC: [0, 2, 8, 14, 19, 24, 26, 26, 22, 15, 8, 2],
    precipitationMm: [60, 60, 90, 100, 110, 100, 90, 80, 80, 80, 90, 70],
    latitude: 38.6,
  });
  assert.throws(
    () => openweather.importClimate(w, p.id, {
      temperaturesC: [0, 2, 8, 14, 19, 24, 26, 26, 22, 15, 8, 2],
      precipitationMm: [60, 60, 90, 100, 110, 100, 90, 80, 80, 80, 90, 70],
      latitude: 38.6,
    }),
    /already carries a NOAA classification/,
  );
});

test('openweather uses the same classifier as NOAA, not a second opinion', () => {
  // Two files disagreeing about what makes a place arid is the third
  // standing rule.
  const w = createWorldLayer();
  const p = place(w);
  openweather.importClimate(w, p.id, {
    temperaturesC: [0, 2, 8, 14, 19, 24, 26, 26, 22, 15, 8, 2],
    precipitationMm: [60, 60, 90, 100, 110, 100, 90, 80, 80, 80, 90, 70],
    latitude: 38.6,
  });
  assert.equal(p.geographyData.climate.climateKey, 'Cfa', 'St. Louis is Cfa in the literature');
  assert.equal(p.geographyData.climate.source, 'openweather');
  assert.equal(p.geographyData.licence, 'commercial-per-call');
  assert.ok(openweather.describeCost(w).paidLocations === 1);
});

// ---------------------------------------------------------------------
// Overture Transportation — deferred by VACON-C policy
// ---------------------------------------------------------------------

test('the deferral is on every row, not only in the header', () => {
  // A consumer that appears later must not mistake this for
  // sanctioned engine scope.
  const w = createWorldLayer();
  const p = place(w);
  transport.importSegments(w, p.id, [
    { subtype: 'road', class: 'residential', lengthMetres: 200, connectorIds: ['a'] },
  ]);
  assert.ok(/defers Transportation by policy/i.test(p.transportationData.deferredBy));
  assert.ok(/defers Transportation by policy/i.test(transport.describeTransportCoverage(w).deferredBy));
});

test('connectivity is the best road touching a place, not the count of them', () => {
  // A place on a motorway is well connected whether or not it also has
  // forty service roads. Averaging would let a car park dilute a trunk
  // road.
  const many = [
    { subtype: 'road', class: 'service', lengthMetres: 50 },
    { subtype: 'road', class: 'service', lengthMetres: 50 },
    { subtype: 'road', class: 'motorway', lengthMetres: 900 },
  ];
  const result = transport.toConnectivity(many);
  assert.equal(result.bestClass, 'motorway');
  assert.equal(result.connectivity, 1);
  assert.equal(result.totalLengthMetres, 1000);
});

test('a place with no recognised road is unsurveyed, not unreachable', () => {
  const result = transport.toConnectivity([{ subtype: 'road', class: 'hovercraft-lane' }]);
  assert.equal(result.bestClass, null);
  assert.equal(result.connectivity, null, 'a connectivity of 0 would say the place is cut off');
  assert.equal(result.unrecognised.length, 1);
});

test('junctions are deduplicated across segments', () => {
  const result = transport.toConnectivity([
    { subtype: 'road', class: 'primary', connectorIds: ['a', 'b'] },
    { subtype: 'road', class: 'primary', connectorIds: ['b', 'c'] },
  ]);
  assert.equal(result.junctions, 3);
});

// ---------------------------------------------------------------------
// All ten, held to the same shape
// ---------------------------------------------------------------------

test('every new importer has a fetch that throws naming the block', () => {
  // The shape imports/unescoImport.js established: a real tested
  // transform, plus a fetch that says why it cannot run and what the
  // genuine access path is. A fetch that returned null would look like
  // a source with no data rather than a network that is blocked.
  const fetchers = [
    ['naturalEarth', naturalEarth.fetchNaturalEarth],
    ['usgs', usgs.fetchElevation],
    ['fema', fema.fetchRiskIndex],
    ['fbi', fbi.fetchCrimeData],
    ['cdc', cdc.fetchPlaces],
    ['religion', religion.fetchReligionCensus],
    ['nces', nces.fetchNces],
    ['cms', cms.fetchPos],
    ['openweather', openweather.fetchOpenWeather],
    ['transport', transport.fetchTransportation],
  ];
  assert.equal(fetchers.length, 10);
  for (const [name, fetcher] of fetchers) {
    assert.throws(fetcher, (error) => {
      assert.ok(/not implemented/.test(error.message), `${name} does not say it is unimplemented`);
      assert.ok(/403 CONNECT|proxy allowlist|paid API key/.test(error.message),
        `${name} does not name the block`);
      return true;
    }, `${name}.fetch did not throw`);
  }
});
