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
