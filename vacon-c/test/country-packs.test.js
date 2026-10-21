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
// generateRegion wiring
// ---------------------------------------------------------------------

test('generateRegion reports a real country\'s fields when given a recognised countryKey', () => {
  const w = { regions: [] };
  const region = migration.generateRegion(w, { name: 'Test Region', countryKey: 'bosnian' });
  assert.equal(region.incomeLevel, 'upper-middle-income');
  assert.equal(region.conflictLevel, 'no-active-conflict');
  assert.equal(region.governmentType, 'federal parliamentary republic');
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
