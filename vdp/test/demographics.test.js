// VDP — demographics.js: real-world-weighted origin, income tiers,
// and the Hawkins Scale of Consciousness.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORLD_REGIONS, HAWKINS_SCALE, COURAGE_THRESHOLD, isConstructiveState,
  INCOME_LEVELS, drawOriginRegion, drawIncomeLevel, getIncomeLevel,
  drawConsciousnessLevel, drawDemographics,
} from '../src/lib/demographics.js';

test('WORLD_REGIONS real shares sum to approximately 1', () => {
  const total = WORLD_REGIONS.reduce((sum, r) => sum + r.share, 0);
  assert.ok(Math.abs(total - 1) < 0.01);
});

test('drawOriginRegion is weighted -- Asia (the largest real share) wins far more draws than Oceania (the smallest)', () => {
  let asia = 0;
  let oceania = 0;
  const rng = (() => {
    let seed = 1;
    return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  })();
  for (let i = 0; i < 2000; i += 1) {
    const region = drawOriginRegion(rng);
    if (region === 'Asia') asia += 1;
    if (region === 'Oceania') oceania += 1;
  }
  assert.ok(asia > oceania * 10, `expected Asia (${asia}) to dominate Oceania (${oceania})`);
});

test('drawOriginRegion with rng()=0 always returns the first real region', () => {
  assert.equal(drawOriginRegion(() => 0), WORLD_REGIONS[0].name);
});

test('HAWKINS_SCALE is the real, named, ordered scale -- Shame lowest, Enlightenment highest', () => {
  assert.equal(HAWKINS_SCALE[0].name, 'Shame');
  assert.equal(HAWKINS_SCALE[HAWKINS_SCALE.length - 1].name, 'Enlightenment');
  for (let i = 1; i < HAWKINS_SCALE.length; i += 1) {
    assert.ok(HAWKINS_SCALE[i].value > HAWKINS_SCALE[i - 1].value, 'every real level must be strictly higher than the last');
  }
});

test('isConstructiveState uses the real Hawkins Courage threshold (200)', () => {
  assert.equal(COURAGE_THRESHOLD, 200);
  assert.equal(isConstructiveState(199), false);
  assert.equal(isConstructiveState(200), true);
});

test('drawConsciousnessLevel with rng()=0 returns Shame; rng() near 1 returns Enlightenment', () => {
  assert.equal(drawConsciousnessLevel(() => 0).name, 'Shame');
  assert.equal(drawConsciousnessLevel(() => 0.999).name, 'Enlightenment');
});

test('INCOME_LEVELS is a real, ordered ladder naming a real affordable property.js level', () => {
  assert.equal(INCOME_LEVELS[0].name, 'low');
  assert.equal(INCOME_LEVELS[INCOME_LEVELS.length - 1].name, 'affluent');
  assert.equal(getIncomeLevel('middle').maxAffordablePropertyLevel, 2);
  assert.equal(getIncomeLevel('nonexistent'), null);
});

test('drawIncomeLevel picks a real, named tier', () => {
  const level = drawIncomeLevel(() => 0);
  assert.equal(level, 'low');
});

test('drawDemographics returns one real, combined record, with religion/culture left null when not supplied', () => {
  const demo = drawDemographics({ rng: () => 0 });
  assert.equal(demo.originRegion, WORLD_REGIONS[0].name);
  assert.equal(demo.religion, null);
  assert.equal(demo.culture, null);
  assert.equal(demo.incomeLevel, 'low');
  assert.equal(demo.consciousnessLevel, 'Shame');
  assert.equal(demo.consciousnessValue, 20);
});

test('drawDemographics passes through a real, caller-supplied religion/culture rather than drawing one', () => {
  const demo = drawDemographics({ religion: 'a real faith the caller already knows', culture: 'a real culture the caller already knows', rng: () => 0 });
  assert.equal(demo.religion, 'a real faith the caller already knows');
  assert.equal(demo.culture, 'a real culture the caller already knows');
});
