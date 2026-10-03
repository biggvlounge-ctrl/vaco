'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TIERS, populationTier, describePopulation } from '../src/lib/population.js';

test('a tiny real population is a Hamlet', () => {
  assert.equal(populationTier(0).tier, 'Hamlet');
  assert.equal(populationTier(9).tier, 'Hamlet');
});

test('each real boundary takes the higher, more specific tier', () => {
  assert.equal(populationTier(10).tier, 'Village');
  assert.equal(populationTier(50).tier, 'Town');
  assert.equal(populationTier(200).tier, 'City');
  assert.equal(populationTier(1000).tier, 'Metropolis');
});

test('just below a boundary stays in the lower tier', () => {
  assert.equal(populationTier(49).tier, 'Village');
  assert.equal(populationTier(199).tier, 'Town');
  assert.equal(populationTier(999).tier, 'City');
});

test('a negative or non-integer population is refused, not silently floored', () => {
  assert.throws(() => populationTier(-1), /non-negative integer/);
  assert.throws(() => populationTier(3.5), /non-negative integer/);
});

test('describePopulation combines real players and real NPCs into one real headcount', () => {
  const result = describePopulation(3, 14);
  assert.equal(result.population, 17);
  assert.equal(result.players, 3);
  assert.equal(result.npcs, 14);
  assert.equal(result.tier, 'Village');
});

test('custom tiers are honored, not just the default scale', () => {
  const tiers = [{ name: 'Empty', min: 0 }, { name: 'Occupied', min: 1 }];
  assert.equal(populationTier(0, tiers).tier, 'Empty');
  assert.equal(populationTier(1, tiers).tier, 'Occupied');
});

test('DEFAULT_TIERS is sorted ascending by min and starts at zero', () => {
  assert.equal(DEFAULT_TIERS[0].min, 0);
  for (let i = 1; i < DEFAULT_TIERS.length; i += 1) {
    assert.ok(DEFAULT_TIERS[i].min > DEFAULT_TIERS[i - 1].min);
  }
});
