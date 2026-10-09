// VDP — taxes.js: real income tax, and the import-vs-domestic
// efficiency signal.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTaxesStore, taxAmountFor, recordTaxCollection, totalTaxRevenue, recommendDeploymentSource,
  DEFAULT_INCOME_TAX_RATE, GOVERNMENT_TREASURY_ACCOUNT,
} from '../src/lib/taxes.js';

test('taxAmountFor applies the real rate, defaulting to DEFAULT_INCOME_TAX_RATE', () => {
  assert.equal(taxAmountFor(100), Math.round(100 * DEFAULT_INCOME_TAX_RATE));
  assert.equal(taxAmountFor(100, 0.2), 20);
});

test('taxAmountFor refuses a negative grossAmount', () => {
  assert.throws(() => taxAmountFor(-5), /non-negative grossAmount/);
});

test('recordTaxCollection builds a real, running total -- never a second invented figure', () => {
  const store = createTaxesStore();
  recordTaxCollection(store, { amount: 10, source: 'lumberjack' });
  recordTaxCollection(store, { amount: 15, source: 'farmer' });
  assert.equal(totalTaxRevenue(store), 25);
});

test('recordTaxCollection refuses a negative amount', () => {
  const store = createTaxesStore();
  assert.throws(() => recordTaxCollection(store, { amount: -1 }), /non-negative amount/);
});

test('GOVERNMENT_TREASURY_ACCOUNT is an ordinary V3 userId string, not a second ledger', () => {
  assert.equal(typeof GOVERNMENT_TREASURY_ACCOUNT, 'string');
});

// -- recommendDeploymentSource ------------------------------------------

const PATROL_DRONE = { importCost: 200, domesticCost: 350 };

test('recommendDeploymentSource picks the real cheaper source and says whether the treasury can afford it', () => {
  const affordable = recommendDeploymentSource(500, PATROL_DRONE);
  assert.equal(affordable.cheaperSource, 'import');
  assert.equal(affordable.cost, 200);
  assert.equal(affordable.canAfford, true);

  const tooPoor = recommendDeploymentSource(50, PATROL_DRONE);
  assert.equal(tooPoor.canAfford, false);
});

test('recommendDeploymentSource picks domestic when it is the real cheaper real option', () => {
  const result = recommendDeploymentSource(1000, { importCost: 900, domesticCost: 300 });
  assert.equal(result.cheaperSource, 'domestic');
  assert.equal(result.cost, 300);
});

test('recommendDeploymentSource refuses a negative treasuryBalance or a robot type missing real costs', () => {
  assert.throws(() => recommendDeploymentSource(-1, PATROL_DRONE), /non-negative treasuryBalance/);
  assert.throws(() => recommendDeploymentSource(100, {}), /requires a real robot type/);
});
