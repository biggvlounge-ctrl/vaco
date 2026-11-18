// A broader, shallower real country income reference -- closing the
// thirty-ninth standing rule's own "not all 190-odd countries" gap.
// Read `server/globalIncomeClassification.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const globalIncome = require('../server/globalIncomeClassification.js');
const countryPacks = require('../server/countryPacks.js');

test('every entry with a real level uses a real INCOME_LEVELS value', () => {
  for (const [key, entry] of Object.entries(globalIncome.GLOBAL_INCOME_LEVELS)) {
    if (entry.level === null) continue;
    assert.ok(countryPacks.INCOME_LEVELS.includes(entry.level), `${key}: "${entry.level}"`);
  }
});

test('every entry carries a real confidence flag', () => {
  const allowed = ['bracket-estimate', 'checked', 'no-reliable-figure-found'];
  for (const [key, entry] of Object.entries(globalIncome.GLOBAL_INCOME_LEVELS)) {
    assert.ok(allowed.includes(entry.confidence), `${key}: "${entry.confidence}"`);
  }
});

test('a null level always carries the no-reliable-figure-found confidence, never a guessed band', () => {
  for (const [key, entry] of Object.entries(globalIncome.GLOBAL_INCOME_LEVELS)) {
    if (entry.level === null) {
      assert.equal(entry.confidence, 'no-reliable-figure-found', key);
    }
  }
});

test('globalIncomeLevelFor returns null for a country in neither table', () => {
  assert.equal(globalIncome.globalIncomeLevelFor('atlantis'), null);
});

test('globalIncomeLevelFor prefers the deeper countryPacks.COUNTRIES entry when both tables cover it', () => {
  const result = globalIncome.globalIncomeLevelFor('german');
  assert.equal(result.confidence, 'countries-table');
  assert.equal(result.level, countryPacks.COUNTRIES.german.incomeLevel);
});

test('globalIncomeLevelFor reads this file\'s own table for a country countryPacks.COUNTRIES does not cover', () => {
  const result = globalIncome.globalIncomeLevelFor('japan');
  assert.equal(result.level, 'high-income');
  assert.equal(result.source, 'world-bank-country-lending-groups-fy2027');
});

test('this table does not duplicate a real country already in countryPacks.COUNTRIES', () => {
  const deepCountries = new Set(Object.values(countryPacks.COUNTRIES).map((c) => c.country));
  for (const [key, entry] of Object.entries(globalIncome.GLOBAL_INCOME_LEVELS)) {
    void entry;
    assert.ok(!countryPacks.COUNTRIES[key], `"${key}" is already a real countryPacks.COUNTRIES key`);
  }
  void deepCountries;
});
