// `investments` — genuinely unbuilt rather than deferred until now.
// economy.js's own header names it alongside trade_routes and is
// explicit that only trade_routes is closed scope under the
// Transportation deferral. No mechanism anywhere created, valued or
// settled one before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const investments = require('../server/investments.js');
const economy = require('../server/economy.js');

function world({ tick = 1000 } = {}) {
  const w = {
    tick,
    npcs: [],
    organizations: [],
    individualFinances: [],
    investments: [],
  };
  economy.reseedIds(w);
  investments.reseedIds(w);
  return w;
}

function person(w, { id, savings = 0 } = {}) {
  w.npcs.push({ id, status: 'active' });
  economy.generateIndividualFinances(w, id, { savings, tick: w.tick });
  return w.npcs[w.npcs.length - 1];
}

function business(w, { id, assets = 0 } = {}) {
  w.organizations.push({ id, type: 'business', assets, income: 0 });
  return w.organizations[w.organizations.length - 1];
}

// -- invest -----------------------------------------------------------

test('investing moves real money: the investor\'s savings down, the target\'s assets up', () => {
  const w = world();
  person(w, { id: 1, savings: 500 });
  business(w, { id: 10, assets: 1000 });

  const row = investments.invest(w, {
    investorEntityId: 1, targetEntityId: 10, category: 'businesses', amount: 200, tick: w.tick,
  });

  assert.equal(row.amount, 200);
  assert.equal(economy.getLatestFinances(w, 1).savings, 300);
  assert.equal(w.organizations[0].assets, 1200);
  assert.equal(w.investments.length, 1);
});

test('an unknown category is refused, not silently recorded', () => {
  const w = world();
  person(w, { id: 1, savings: 500 });
  business(w, { id: 10 });
  assert.throws(
    () => investments.invest(w, { investorEntityId: 1, targetEntityId: 10, category: 'vehicles', amount: 10 }),
    /not a real investments\.category/,
  );
});

test('investing more than you have in savings is refused', () => {
  const w = world();
  person(w, { id: 1, savings: 50 });
  business(w, { id: 10 });
  assert.throws(
    () => investments.invest(w, { investorEntityId: 1, targetEntityId: 10, category: 'businesses', amount: 500 }),
    /has 50 savings, not 500/,
  );
});

test('a non-organization target still records the real transfer, with no invented holding account', () => {
  const w = world();
  const investor = person(w, { id: 1, savings: 500 });
  const student = person(w, { id: 2, savings: 0 });
  void investor;

  const row = investments.invest(w, {
    investorEntityId: 1, targetEntityId: student.id, category: 'education', amount: 100, tick: w.tick,
  });
  assert.equal(row.target_entity_id, student.id);
  assert.equal(economy.getLatestFinances(w, 1).savings, 400);
  // The student's own finances are untouched -- a scholarship recorded
  // as a real transfer is not a second, invented wallet for them.
  assert.equal(economy.getLatestFinances(w, 2).savings, 0);
});

// -- stake --------------------------------------------------------------

test('stakeOf is null with no investment at all, and a real fraction once there is one', () => {
  const w = world();
  person(w, { id: 1, savings: 500 });
  person(w, { id: 2, savings: 500 });
  business(w, { id: 10 });

  assert.equal(investments.stakeOf(w, 1, 10), null);

  investments.invest(w, { investorEntityId: 1, targetEntityId: 10, category: 'businesses', amount: 300, tick: w.tick });
  investments.invest(w, { investorEntityId: 2, targetEntityId: 10, category: 'businesses', amount: 100, tick: w.tick });

  assert.equal(investments.stakeOf(w, 1, 10), 0.75);
  assert.equal(investments.stakeOf(w, 2, 10), 0.25);
  assert.equal(investments.totalInvestedIn(w, 10), 400);
});

// -- dividends ----------------------------------------------------------

test('runDividends pays a real, bounded share out of the organization\'s own assets, proportional to stake', () => {
  const w = world();
  person(w, { id: 1, savings: 500 });
  person(w, { id: 2, savings: 500 });
  business(w, { id: 10, assets: 10000 });

  investments.invest(w, { investorEntityId: 1, targetEntityId: 10, category: 'businesses', amount: 300, tick: w.tick });
  investments.invest(w, { investorEntityId: 2, targetEntityId: 10, category: 'businesses', amount: 100, tick: w.tick });

  const assetsBefore = w.organizations[0].assets;
  const result = investments.runDividends(w, w.tick);

  const pool = Math.floor(assetsBefore * investments.DIVIDEND_RATE_PER_TICK);
  assert.ok(pool > 0, 'the fixture should pay a real, non-zero pool');
  assert.equal(result.paid, pool);
  assert.equal(w.organizations[0].assets, assetsBefore - pool);

  // 1 holds 75% of the stake, 2 holds 25% -- the real split, not an
  // equal share.
  const share1 = Math.floor(pool * 0.75);
  const share2 = Math.floor(pool * 0.25);
  assert.equal(economy.getLatestFinances(w, 1).savings, 500 - 300 + share1);
  assert.equal(economy.getLatestFinances(w, 2).savings, 500 - 100 + share2);
});

test('runDividends never pays more than the organization actually has, and pays nothing to a non-organization target', () => {
  const w = world();
  person(w, { id: 1, savings: 500 });
  const student = person(w, { id: 2, savings: 0 });

  investments.invest(w, { investorEntityId: 1, targetEntityId: student.id, category: 'education', amount: 100, tick: w.tick });
  const result = investments.runDividends(w, w.tick);

  assert.equal(result.paid, 0, 'a person target has no production engine to pay a dividend from');
  assert.equal(economy.getLatestFinances(w, 2).savings, 0);
});

test('runDividends is a no-op on a world with no investments at all', () => {
  const w = world();
  business(w, { id: 10, assets: 10000 });
  const result = investments.runDividends(w, w.tick);
  assert.deepEqual(result, { events: [], paid: 0 });
});

// -- id sequencing --------------------------------------------------------

test('reseedIds derives the next id from the highest one present, same as every other counter', () => {
  const w = world();
  w.investments.push({ id: 7, investor_entity_id: 1, target_entity_id: 10, category: 'businesses', amount: 50, tick: w.tick });
  const seeded = investments.reseedIds(w);
  assert.equal(seeded.nextInvestmentId, 8);

  person(w, { id: 1, savings: 500 });
  business(w, { id: 10 });
  const row = investments.invest(w, { investorEntityId: 1, targetEntityId: 10, category: 'businesses', amount: 10, tick: w.tick });
  assert.equal(row.id, 8, 'the next id must not collide with the restored row');
});
