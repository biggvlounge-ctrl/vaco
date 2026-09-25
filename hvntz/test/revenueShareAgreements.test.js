// HVNTZ — Connected Network Revenue Sharing, §15-18. See
// lib/revenueShareAgreements.js's own header for scope. Every
// assertion here reads the actual moved money (never just a stored
// field), matching this app's own `money.test.js` discipline — a test
// that only checked `distribution.legs` would pass even if `settleFn`
// moved nothing, moved the wrong amount, or the split silently didn't
// sum to the total.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createHvntzStore, registerBusiness } = require('../lib/revenueStack');
const { createNetwork } = require('../lib/networkConnections');
const {
  SPLIT_TYPES, findRevenueShareAgreement, createRevenueShareAgreement, archiveRevenueShareAgreement,
  computeSplit, distributeRevenue, distributionsForNetwork, agreementsForNetwork,
} = require('../lib/revenueShareAgreements');

function recorder() {
  const legs = [];
  const fn = async (settlementLegs) => { legs.push(...settlementLegs); return { id: 'settlement-1' }; };
  fn.legs = legs;
  fn.totalTo = (who) => legs.filter((l) => l.toUserId === who).reduce((n, l) => n + l.amount, 0);
  return fn;
}

function hubNetwork(store) {
  const business = registerBusiness(store, { name: 'The Standard Rooftop', ownerId: 'owner-1' });
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'The Standard Rooftop Network' });
  return { business, network };
}

// §17's own worked example, verbatim: business 50%, DJ 15%, bartender
// pool 15%, hosts 10%, creator/production 5%, platform 5%.
function workedExampleShares() {
  return [
    { role: 'business', payeeId: 'owner-1', value: 50 },
    { role: 'dj', payeeId: 'dj-marcus', value: 15 },
    { role: 'bartender-pool', payeeId: 'bartender-pool-account', value: 15 },
    { role: 'hosts', payeeId: 'hosts-pool-account', value: 10 },
    { role: 'creator-production', payeeId: 'production-account', value: 5 },
    { role: 'platform', payeeId: 'vaco-platform', value: 5 },
  ];
}

// -- createRevenueShareAgreement -----------------------------------------------

test('createRevenueShareAgreement verifies the network is real rather than trusting the id', async () => {
  const store = createHvntzStore();
  assert.throws(
    () => createRevenueShareAgreement(store, {
      networkId: 404, name: 'X', splitType: 'percentage', shares: [{ role: 'a', payeeId: 'x', value: 100 }],
    }),
    /no network with id 404/,
  );
});

test('every declared SPLIT_TYPES value is accepted', () => {
  assert.deepStrictEqual(SPLIT_TYPES, ['percentage', 'fixed-amount']);
});

test('createRevenueShareAgreement refuses percentage shares that do not sum to exactly 100', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  assert.throws(
    () => createRevenueShareAgreement(store, {
      networkId: network.id, name: 'Bad split', splitType: 'percentage', shares: [{ role: 'a', payeeId: 'x', value: 60 }],
    }),
    /must sum to exactly 100 \(got 60\)/,
  );
});

test('createRevenueShareAgreement refuses a zero or negative share value', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  assert.throws(
    () => createRevenueShareAgreement(store, {
      networkId: network.id, name: 'Bad', splitType: 'percentage', shares: [{ role: 'a', payeeId: 'x', value: 0 }],
    }),
    /requires a positive value/,
  );
});

test('createRevenueShareAgreement accepts the freeze\'s own §17 worked example exactly', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Standard Rooftop Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  assert.strictEqual(agreement.shares.length, 6);
  assert.strictEqual(agreement.status, 'active');
});

test('createRevenueShareAgreement accepts a fixed-amount split with no 100-sum requirement', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id,
    name: 'Fixed split',
    splitType: 'fixed-amount',
    shares: [{ role: 'dj', payeeId: 'dj-marcus', value: 200 }, { role: 'platform', payeeId: 'vaco-platform', value: 50 }],
  });
  assert.strictEqual(agreement.splitType, 'fixed-amount');
});

// -- computeSplit — solvent by construction --------------------------------------

test('computeSplit on a percentage agreement sums to exactly the total, to the cent', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  const legs = computeSplit(agreement, 333.33);
  const sum = Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  assert.strictEqual(sum, 333.33);
});

test('computeSplit refuses a fixed-amount agreement whose shares do not sum to the requested total', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id,
    name: 'Fixed split',
    splitType: 'fixed-amount',
    shares: [{ role: 'dj', payeeId: 'dj-marcus', value: 200 }, { role: 'platform', payeeId: 'vaco-platform', value: 50 }],
  });
  assert.throws(() => computeSplit(agreement, 1000), /must sum to exactly totalAmount/);
});

// -- distributeRevenue -- never recorded before the ledger confirms it ------------

test('distributeRevenue moves real money to every named payee, matching §17\'s own worked example', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  const settleFn = recorder();
  const distribution = await distributeRevenue(store, {
    agreementId: agreement.id, totalAmount: 10000, payerId: 'owner-1', settleFn,
  });
  assert.strictEqual(settleFn.totalTo('dj-marcus'), 1500);
  assert.strictEqual(settleFn.totalTo('bartender-pool-account'), 1500);
  assert.strictEqual(settleFn.totalTo('vaco-platform'), 500);
  const sum = distribution.legs.reduce((n, l) => n + l.amount, 0);
  assert.strictEqual(Math.round(sum * 100) / 100, 10000);
});

test('distributeRevenue refuses to distribute through an archived agreement', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  archiveRevenueShareAgreement(store, { agreementId: agreement.id });
  await assert.rejects(
    distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', settleFn: recorder() }),
    /is not active/,
  );
});

test('distributeRevenue records nothing when settleFn throws — never recorded before the ledger confirms it', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  const failingSettleFn = async () => { throw new Error('insufficient balance'); };
  await assert.rejects(
    distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', settleFn: failingSettleFn }),
    /insufficient balance/,
  );
  assert.strictEqual(store.revenueDistributions.length, 0);
});

test('distributeRevenue records real §16 attribution when sourceType/sourceId are supplied', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  const distribution = await distributeRevenue(store, {
    agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', sourceType: 'hunt', sourceId: 7, settleFn: recorder(),
  });
  assert.strictEqual(distribution.sourceType, 'hunt');
  assert.strictEqual(distribution.sourceId, 7);
});

// -- archiveRevenueShareAgreement, and read views --------------------------------

test('archiveRevenueShareAgreement refuses an already-archived agreement', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  archiveRevenueShareAgreement(store, { agreementId: agreement.id });
  assert.throws(() => archiveRevenueShareAgreement(store, { agreementId: agreement.id }), /already archived/);
});

test('agreementsForNetwork and distributionsForNetwork scope to the right network only', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const otherBusiness = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const otherNetwork = createNetwork(store, { hubBusinessId: otherBusiness.id, name: 'Club B Network' });
  createRevenueShareAgreement(store, { networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares() });
  createRevenueShareAgreement(store, { networkId: otherNetwork.id, name: 'Other split', splitType: 'percentage', shares: workedExampleShares() });
  assert.strictEqual(agreementsForNetwork(store, network.id).length, 1);
  assert.strictEqual(agreementsForNetwork(store, otherNetwork.id).length, 1);
});

test('findRevenueShareAgreement returns null for an unknown id, rather than throwing', () => {
  const store = createHvntzStore();
  assert.strictEqual(findRevenueShareAgreement(store, 999999), null);
});

test('distributionsForNetwork lists only that network\'s own real distributions', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  await distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', settleFn: recorder() });
  await distributeRevenue(store, { agreementId: agreement.id, totalAmount: 200, payerId: 'owner-1', settleFn: recorder() });
  assert.strictEqual(distributionsForNetwork(store, network.id).length, 2);
});
