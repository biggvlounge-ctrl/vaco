'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCivilizationsStore, createCivilization, listTradeRoutes } from '../src/lib/civilizations.js';
import {
  scarcityValueFor, findScarceOpportunities, conductScarcityTrade, BASE_SCARCITY_VALUE, CIVILIZATION_TRADE_ACCOUNT,
} from '../src/lib/civilizationTrade.js';

function seedWorld(store) {
  const robots = createCivilization(store, { name: 'Ironreach', kind: 'mainland-country', majorIndustries: ['robotics', 'mining'] });
  const food = createCivilization(store, { name: 'Verdane', kind: 'mainland-country', majorIndustries: ['farming', 'fishing'] });
  const hidden = createCivilization(store, { name: 'Wagerden', kind: 'hidden-civilization', majorIndustries: ['gambling'] });
  return { robots, food, hidden };
}

function fakeTransferFn(ledger) {
  return async ({ fromUserId, toUserId, amount }) => {
    ledger.push({ fromUserId, toUserId, amount });
  };
}

test('scarcityValueFor is highest for an industry only one civilization carries, and falls as more carry it', () => {
  const store = createCivilizationsStore();
  seedWorld(store);
  createCivilization(store, { name: 'Luminae', kind: 'mainland-country', majorIndustries: ['robotics'] });
  const rareValue = scarcityValueFor(store, 'gambling'); // only 1 civ
  const commonValue = scarcityValueFor(store, 'robotics'); // 2 civs now
  assert.ok(rareValue > commonValue, 'an industry fewer civilizations carry must be worth more');
  assert.equal(rareValue, BASE_SCARCITY_VALUE / 2);
  assert.equal(commonValue, BASE_SCARCITY_VALUE / 3);
});

test('findScarceOpportunities lists only real gaps with a real supplier, ranked scarcest first', () => {
  const store = createCivilizationsStore();
  const { food } = seedWorld(store);
  const opportunities = findScarceOpportunities(store, food.id);
  const industries = opportunities.map((o) => o.industry);
  assert.ok(industries.includes('robotics'));
  assert.ok(industries.includes('mining'));
  assert.ok(industries.includes('gambling'));
  assert.ok(!industries.includes('farming'), 'Verdane already carries farming -- not a real gap');
  assert.ok(!industries.includes('fishing'), 'Verdane already carries fishing -- not a real gap');
  for (let i = 1; i < opportunities.length; i += 1) {
    assert.ok(opportunities[i - 1].value >= opportunities[i].value, 'opportunities must be sorted scarcest-first');
  }
});

test('findScarceOpportunities never lists an industry nobody in the world actually carries', () => {
  const store = createCivilizationsStore();
  const { food } = seedWorld(store);
  const opportunities = findScarceOpportunities(store, food.id);
  assert.ok(!opportunities.some((o) => o.industry === 'anything invented'));
});

test('conductScarcityTrade refuses a trade that is not real scarcity', async () => {
  const store = createCivilizationsStore();
  const { robots, food } = seedWorld(store);
  const ledger = [];
  await assert.rejects(
    () => conductScarcityTrade(store, {
      fromCivilizationId: robots.id, toCivilizationId: robots.id, industry: 'robotics', traderId: 'alice', transferFn: fakeTransferFn(ledger),
    }),
    /requires two different civilizations/,
  );
  await assert.rejects(
    () => conductScarcityTrade(store, {
      fromCivilizationId: food.id, toCivilizationId: robots.id, industry: 'robotics', traderId: 'alice', transferFn: fakeTransferFn(ledger),
    }),
    /does not carry "robotics"/,
  );
  const otherRoboticsCiv = createCivilization(store, { name: 'Luminae', kind: 'mainland-country', majorIndustries: ['robotics'] });
  await assert.rejects(
    () => conductScarcityTrade(store, {
      fromCivilizationId: robots.id, toCivilizationId: otherRoboticsCiv.id, industry: 'robotics', traderId: 'alice', transferFn: fakeTransferFn(ledger),
    }),
    /already carries "robotics"/,
  );
});

test('conductScarcityTrade pays the trader and creates a real trade route only once scarcity is real', async () => {
  const store = createCivilizationsStore();
  const { robots, food } = seedWorld(store);
  const ledger = [];

  const result = await conductScarcityTrade(store, {
    fromCivilizationId: robots.id, toCivilizationId: food.id, industry: 'robotics', traderId: 'alice', cargoAmount: 2, transferFn: fakeTransferFn(ledger),
  });

  assert.equal(result.payout, Math.round(scarcityValueFor(store, 'robotics') * 2));
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].fromUserId, CIVILIZATION_TRADE_ACCOUNT);
  assert.equal(ledger[0].toUserId, 'alice');
  assert.equal(ledger[0].amount, result.payout);

  const routes = listTradeRoutes(store);
  assert.ok(routes.some((r) => r.id === result.route.id));
  assert.equal(result.route.cargo[0], 'robotics');
  assert.equal(result.route.status, 'legal');
});

test('conductScarcityTrade never creates a trade route when the payout fails', async () => {
  const store = createCivilizationsStore();
  const { robots, food } = seedWorld(store);
  const before = listTradeRoutes(store).length;
  const failingTransferFn = async () => { throw new Error('ledger unreachable'); };

  await assert.rejects(
    () => conductScarcityTrade(store, {
      fromCivilizationId: robots.id, toCivilizationId: food.id, industry: 'robotics', traderId: 'alice', transferFn: failingTransferFn,
    }),
    /ledger unreachable/,
  );
  assert.equal(listTradeRoutes(store).length, before, 'a failed payout must leave no trade route behind');
});

test('conductScarcityTrade requires a real trader, a real transferFn, and a positive integer cargoAmount', async () => {
  const store = createCivilizationsStore();
  const { robots, food } = seedWorld(store);
  const ledger = [];
  await assert.rejects(() => conductScarcityTrade(store, {
    fromCivilizationId: robots.id, toCivilizationId: food.id, industry: 'robotics', transferFn: fakeTransferFn(ledger),
  }), /requires a traderId/);
  await assert.rejects(() => conductScarcityTrade(store, {
    fromCivilizationId: robots.id, toCivilizationId: food.id, industry: 'robotics', traderId: 'alice', cargoAmount: 0, transferFn: fakeTransferFn(ledger),
  }), /positive integer cargoAmount/);
  await assert.rejects(() => conductScarcityTrade(store, {
    fromCivilizationId: robots.id, toCivilizationId: food.id, industry: 'robotics', traderId: 'alice',
  }), /requires a transferFn/);
});
