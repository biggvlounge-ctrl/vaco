import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEconomyStore, recordSpending, recentSpending, updateEconomyIndex,
  economyMultiplierFor, MIN_ECONOMY_INDEX, MAX_ECONOMY_INDEX, DEFAULT_ECONOMY_BASELINE,
} from '../src/lib/economy.js';

test('createEconomyStore starts at the neutral, real-world-standing index', () => {
  const store = createEconomyStore();
  assert.deepEqual(store, { spendingLog: [], index: 100 });
});

test('recordSpending refuses a negative amount', () => {
  const store = createEconomyStore();
  assert.throws(() => recordSpending(store, -5), /non-negative/);
});

test('recentSpending sums only entries inside the window', () => {
  const store = createEconomyStore();
  recordSpending(store, 100, 9000);
  recordSpending(store, 50, 5000);
  recordSpending(store, 25, 1000); // too old for the window below
  const sum = recentSpending(store, { now: 10000, windowMs: 5000 });
  assert.equal(sum, 150);
});

test('updateEconomyIndex rises when real spending exceeds the baseline', () => {
  const store = createEconomyStore();
  recordSpending(store, DEFAULT_ECONOMY_BASELINE * 2, 1000);
  const index = updateEconomyIndex(store, { now: 1000, windowMs: 60000 });
  assert.equal(index, 200);
  assert.equal(store.index, 200);
});

test('updateEconomyIndex falls below neutral when spending is below the baseline', () => {
  const store = createEconomyStore();
  recordSpending(store, 300, 1000);
  const index = updateEconomyIndex(store, { now: 1000, windowMs: 60000, baseline: 500 });
  assert.equal(index, 60);
});

test('updateEconomyIndex clamps at both ends -- one giant purchase cannot break the world', () => {
  const store = createEconomyStore();
  recordSpending(store, 1_000_000, 1000);
  const index = updateEconomyIndex(store, { now: 1000, windowMs: 60000 });
  assert.equal(index, MAX_ECONOMY_INDEX);

  const quiet = createEconomyStore();
  const quietIndex = updateEconomyIndex(quiet, { now: 1000, windowMs: 60000 });
  assert.equal(quietIndex, MIN_ECONOMY_INDEX);
});

test('economyMultiplierFor reads 100 as neutral (1x)', () => {
  assert.equal(economyMultiplierFor(100), 1);
  assert.equal(economyMultiplierFor(200), 2);
  assert.equal(economyMultiplierFor(50), 0.5);
});
