'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChopz, leaseUnit, runShift, staffWithAIEmployee, getPendingEarnings,
  TIER_LEASE_COST, TIER_SHIFT_PAYOUT, TIER_AI_EMPLOYEE_RATE_PER_HOUR, TIER_NAMES,
  LEASE_COST, SHIFT_PAYOUT, AI_EMPLOYEE_RATE_PER_HOUR,
} from '../src/lib/chopz.js';

function ledger() {
  const moves = [];
  const fn = async (from, to, amount) => { moves.push({ from, to, amount }); return true; };
  fn.moves = moves;
  return fn;
}

test('every unit carries a real tier from 1 (smallest) to 5 (largest)', () => {
  const store = createChopz();
  const tiers = store.units.map((u) => u.tier);
  assert.ok(tiers.every((t) => t >= 1 && t <= 5), 'every tier must be in the real 1-5 range');
  assert.ok(new Set(tiers).size > 1, 'the 8 units must not all sit at the same tier');
  assert.ok(tiers.includes(1), 'tier 1, the smallest, must be represented');
  assert.ok(tiers.includes(5), 'tier 5, the largest, must be represented');
});

test('tier 1 keeps the module\'s original flat rates, so existing callers see no change', () => {
  assert.equal(TIER_LEASE_COST[1], LEASE_COST);
  assert.equal(TIER_SHIFT_PAYOUT[1], SHIFT_PAYOUT);
  assert.equal(TIER_AI_EMPLOYEE_RATE_PER_HOUR[1], AI_EMPLOYEE_RATE_PER_HOUR);
});

test('tiers 2 through 5 strictly increase lease cost, shift payout, and AI rate -- size really means more', () => {
  for (let t = 2; t <= 5; t += 1) {
    assert.ok(TIER_LEASE_COST[t] > TIER_LEASE_COST[t - 1], `tier ${t} lease must cost more than tier ${t - 1}`);
    assert.ok(TIER_SHIFT_PAYOUT[t] > TIER_SHIFT_PAYOUT[t - 1], `tier ${t} shift must pay more than tier ${t - 1}`);
    assert.ok(
      TIER_AI_EMPLOYEE_RATE_PER_HOUR[t] > TIER_AI_EMPLOYEE_RATE_PER_HOUR[t - 1],
      `tier ${t} AI rate must exceed tier ${t - 1}`,
    );
  }
});

test('leaseUnit charges the real per-tier lease cost, not the flat module rate', async () => {
  const store = createChopz();
  const tier5Unit = store.units.find((u) => u.tier === 5);
  const transferFn = ledger();

  await leaseUnit(store, { unitId: tier5Unit.id, ownerId: 'p1', transferFn });

  assert.equal(transferFn.moves[0].amount, TIER_LEASE_COST[5]);
  assert.notEqual(TIER_LEASE_COST[5], LEASE_COST, 'a tier-5 lease must not silently charge the tier-1 rate');
});

test('runShift pays the real per-tier amount', async () => {
  const store = createChopz();
  const tier4Unit = store.units.find((u) => u.tier === 4);
  const transferFn = ledger();

  await leaseUnit(store, { unitId: tier4Unit.id, ownerId: 'p1', transferFn });
  const out = await runShift(store, { unitId: tier4Unit.id, payoutFn: transferFn, now: 1000 });

  assert.equal(out.payout, TIER_SHIFT_PAYOUT[4]);
  assert.equal(transferFn.moves[1].amount, TIER_SHIFT_PAYOUT[4]);
});

test('an AI employee earns at the real per-tier hourly rate', async () => {
  const store = createChopz();
  const tier3Unit = store.units.find((u) => u.tier === 3);
  const transferFn = ledger();

  await leaseUnit(store, { unitId: tier3Unit.id, ownerId: 'p1', transferFn });
  staffWithAIEmployee(store, tier3Unit.id, 'Marcus (AI)', 0);

  const pending = getPendingEarnings(store, tier3Unit.id, 2 * 60 * 60 * 1000);
  assert.equal(pending, 2 * TIER_AI_EMPLOYEE_RATE_PER_HOUR[3]);
});

test('TIER_NAMES names a real, distinct label for all 5 tiers', () => {
  assert.equal(Object.keys(TIER_NAMES).length, 5);
  assert.equal(new Set(Object.values(TIER_NAMES)).size, 5, 'tier names must be distinct');
});
