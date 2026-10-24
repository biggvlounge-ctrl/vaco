// The first real step of global expansion: a real, cited per-country
// income level, conflict level and government type, reported on the
// region — not yet wired into authority.js's regime system or
// environment.js's weather, on purpose. Read
// `server/countryPacks.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const countryPacks = require('../server/countryPacks.js');
const ancestryPacks = require('../server/ancestryPacks.js');
const migration = require('../server/migration.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

test('every key except the explicit baseline is a real ancestryPacks.GROUPS entry', () => {
  for (const key of Object.keys(countryPacks.COUNTRIES)) {
    if (key === 'united-states') continue;
    assert.ok(ancestryPacks.GROUPS.includes(key), `${key} is not in ancestryPacks.GROUPS`);
  }
});

test('countryFor reads a real entry, and null for an unrecognised key', () => {
  assert.equal(countryPacks.countryFor('somali').country, 'Somalia');
  assert.equal(countryPacks.countryFor('martian'), null);
});

test('every entry\'s incomeLevel and conflictLevel are in the stated vocabularies', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    assert.ok(countryPacks.INCOME_LEVELS.includes(entry.incomeLevel), `${key}: bad incomeLevel`);
    assert.ok(countryPacks.CONFLICT_LEVELS.includes(entry.conflictLevel), `${key}: bad conflictLevel`);
  }
});

test('Russia and Ukraine both read active-armed-conflict — checked directly, not a judgement call', () => {
  assert.equal(countryPacks.countryFor('russian').conflictLevel, 'active-armed-conflict');
  assert.equal(countryPacks.countryFor('ukrainian').conflictLevel, 'active-armed-conflict');
});

test('describeCountry carries the key alongside the entry, and is null for an unrecognised one', () => {
  const described = countryPacks.describeCountry('ghanaian');
  assert.equal(described.key, 'ghanaian');
  assert.equal(described.country, 'Ghana');
  assert.equal(countryPacks.describeCountry('other'), null);
});

// ---------------------------------------------------------------------
// regimeType, militaryExpenditurePctGDP, oilProducer — added after the
// first round, same real/cited/null-if-not-found discipline
// ---------------------------------------------------------------------

test('every entry\'s regimeType is either null or in REGIME_TYPES', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    assert.ok(entry.regimeType === null || countryPacks.REGIME_TYPES.includes(entry.regimeType),
      `${key}: bad regimeType`);
  }
});

test('Russia reads authoritarian-regime and Ukraine reads hybrid-regime — real EIU 2024 scores', () => {
  assert.equal(countryPacks.countryFor('russian').regimeType, 'authoritarian-regime');
  assert.equal(countryPacks.countryFor('ukrainian').regimeType, 'hybrid-regime');
});

test('Somalia has no EIU score and reads regimeType null rather than a guess', () => {
  assert.equal(countryPacks.countryFor('somali').regimeType, null);
});

test('only Russia and Ukraine carry a sipri-official military expenditure confidence', () => {
  for (const [key, entry] of Object.entries(countryPacks.COUNTRIES)) {
    if (entry.militaryExpenditurePctGDP?.confidence === 'sipri-official') {
      assert.ok(key === 'russian' || key === 'ukrainian', `${key}: unexpected sipri-official confidence`);
    }
  }
  assert.equal(countryPacks.countryFor('ukrainian').militaryExpenditurePctGDP.value, 34);
});

test('Israel is a real entry, added after a direct question about why it was missing', () => {
  // The honest reason was structural: this table is keyed on
  // ancestryPacks.GROUPS, and there was no `israeli` group until this
  // round. Jewish-observance data answered a religion question, not a
  // nationality one, and never created this key.
  assert.ok(ancestryPacks.GROUPS.includes('israeli'));
  const israel = countryPacks.countryFor('israeli');
  assert.equal(israel.country, 'Israel');
  assert.equal(israel.incomeLevel, 'high-income');
  assert.equal(israel.conflictLevel, 'active-armed-conflict');
  assert.equal(israel.regimeType, 'flawed-democracy');
  assert.equal(israel.militaryExpenditurePctGDP.value, 8.8);
  // A real natural-gas producer, not an oil producer — the two are not
  // conflated just because both are "energy".
  assert.equal(israel.oilProducer, null);
});

test('oilProducer is null for the great majority of entries and set only for real major producers', () => {
  const producers = Object.entries(countryPacks.COUNTRIES)
    .filter(([, entry]) => entry.oilProducer !== null)
    .map(([key]) => key);
  assert.ok(producers.includes('russian'));
  assert.ok(producers.includes('norwegian'));
  assert.ok(producers.includes('nigerian'));
  assert.ok(producers.includes('mexican'));
  assert.ok(producers.includes('united-states'));
  // China produces oil domestically but is a net importer, not an exporter —
  // deliberately null, not a forced "producer" row.
  assert.equal(countryPacks.countryFor('chinese').oilProducer, null);
});

// ---------------------------------------------------------------------
// homelessness, immigration, informalEconomyPctGDP — France only, same
// "real, cited, null-if-not-found, never forced onto every entry" rule
// ---------------------------------------------------------------------

test('homelessness, immigration and informalEconomyPctGDP are null for countries with no confirmed figure', () => {
  for (const key of ['german', 'irish', 'italian', 'swedish', 'russian', 'ukrainian']) {
    const entry = countryPacks.countryFor(key);
    assert.ok(entry.homelessness === null || entry.homelessness === undefined, `${key}: homelessness should not be forced`);
    assert.ok(entry.immigration === null || entry.immigration === undefined, `${key}: immigration should not be forced`);
    assert.ok(entry.informalEconomyPctGDP === null || entry.informalEconomyPctGDP === undefined, `${key}: informalEconomyPctGDP should not be forced`);
  }
});

test('France carries a real, cited homelessness figure from the Fondation pour le Logement des Défavorisés', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.homelessness.estimatedPeople.value, 350000);
  assert.equal(france.homelessness.estimatedPeople.year, 2025);
  assert.ok(france.homelessness.priorYears.some((p) => p.value === 143000 && p.year === 2012),
    'the 2012 baseline is kept so "more than doubled since 2012" is checkable, not asserted');
  assert.equal(france.homelessness.streetDeaths2024.low, 735);
  assert.equal(france.homelessness.streetDeaths2024.high, 912);
});

test('France carries real asylum/immigration figures, including the Mayotte situation as its own sub-field', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.immigration.asylumApplicationsOFPRA.value, 145211);
  assert.equal(france.immigration.asylumApplicationsOFPRA.priorYear.value, 153715);
  assert.equal(france.immigration.asylumRegistrationsInteriorMinistry.value, 160303);
  assert.equal(france.immigration.estimatedUndocumentedPopulation.confidence, 'unconfirmed-secondary-estimate',
    'an unconfirmed figure must say so, not read as solid as OFPRA\'s own count');
  assert.equal(france.immigration.mayotte.maritimeInterceptions[2024], 6764);
  assert.equal(france.immigration.mayotte.nationalityGrantsMayotte[2023], 860);
  assert.ok(france.immigration.mayotte.citizenshipLawChange.includes('1 year'));
});

test('France\'s informal-economy figure is reported as a range with named methodologies, not one invented number', () => {
  const france = countryPacks.countryFor('french');
  assert.equal(france.informalEconomyPctGDP.range.low, 6.3);
  assert.equal(france.informalEconomyPctGDP.range.high, 15);
  assert.ok(france.informalEconomyPctGDP.estimates.length > 1,
    'more than one method is named rather than collapsed into a single figure');
});

// ---------------------------------------------------------------------
// generateRegion wiring
// ---------------------------------------------------------------------

test('generateRegion reports a real country\'s fields when given a recognised countryKey', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'bosnian' });
  assert.equal(region.incomeLevel, 'upper-middle-income');
  assert.equal(region.conflictLevel, 'no-active-conflict');
  assert.equal(region.governmentType, 'federal parliamentary republic');
  assert.equal(region.regimeType, 'hybrid-regime');
});

test('generateRegion reports the new military/oil fields, real and confidence-flagged', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'russian' });
  assert.equal(region.regimeType, 'authoritarian-regime');
  assert.deepEqual(region.militaryExpenditurePctGDP, { value: 7.1, year: 2024, confidence: 'sipri-official' });
  assert.equal(region.oilProducer.status, 'major-exporter');
});

test('generateRegion leaves country fields null with no countryKey or an unrecognised one', () => {
  const w = { regions: [] };
  const noKey = migration.generateRegion(w, { name: 'Test Region A' });
  assert.equal(noKey.incomeLevel, null);
  const badKey = migration.generateRegion(w, { name: 'Test Region B', countryKey: 'martian' });
  assert.equal(badKey.incomeLevel, null);
  assert.equal(badKey.countryKey, 'martian', 'the key itself is still recorded even if unrecognised');
});

test('generateRegion reports France\'s real homelessness/immigration/informal-economy figures', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'french' });
  assert.equal(region.homelessness.estimatedPeople.value, 350000);
  assert.equal(region.immigration.mayotte.maritimeInterceptions[2024], 6764);
  assert.equal(region.informalEconomyPctGDP.range.low, 6.3);
});

test('generateRegion leaves the three new fields null for a country with no confirmed figure', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'german' });
  assert.equal(region.homelessness, null);
  assert.equal(region.immigration, null);
  assert.equal(region.informalEconomyPctGDP, null);
});

// ---------------------------------------------------------------------
// A world built with it
// ---------------------------------------------------------------------

test('a world built with a real countryKey reports it on the generated region', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'country-pack-world-test', countryKey: 'somali', communitiesPerCity: 1, populationPerCommunity: 5 });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.countryKey, 'somali');
  assert.equal(region.incomeLevel, 'low-income');
  assert.equal(region.conflictLevel, 'active-armed-conflict');
});

test('a world with no countryKey reports null country fields, same as before this existed', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-country-pack-world-test', communitiesPerCity: 1, populationPerCommunity: 5 });
  const region = w.regions[w.regions.length - 1];
  assert.equal(region.countryKey, null);
  assert.equal(region.incomeLevel, null);
});
