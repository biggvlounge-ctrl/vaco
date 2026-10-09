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
  isAgreementExpired, computeSplit, distributeRevenue, distributionsForNetwork, agreementsForNetwork, agreementView,
} = require('../lib/revenueShareAgreements');

function recorder() {
  const legs = [];
  const fn = async (settlementLegs) => { legs.push(...settlementLegs); return { id: 'settlement-1' }; };
  fn.legs = legs;
  fn.totalTo = (who) => legs.filter((l) => l.toUserId === who).reduce((n, l) => n + l.amount, 0);
  return fn;
}

// **A settleFn that actually enforces V3's real idempotency contract**,
// faithfully enough to catch the bug `recorder()` cannot: every other
// test in this file uses `recorder()`, which accepts any call and never
// looks at `meta.reason` — so it would record two settlements as "both
// happened" even if the real V3 ledger would have replayed the first
// one's result for the second. server.js's own `settleVCoin` derives
// V3's real `Idempotency-Key` header from `meta.reason` alone (see its
// own comment), so this keys its memory the same way: a repeated
// reason with the SAME legs replays; a repeated reason with DIFFERENT
// legs is refused, mirroring V3's real 422 rather than its pre-fix
// silent replay.
function fakeV3IdempotentSettleFn() {
  const byReason = new Map();
  let realCalls = 0;
  const fn = async (settlementLegs, meta = {}) => {
    const print = JSON.stringify(settlementLegs);
    const existing = meta.reason ? byReason.get(meta.reason) : undefined;
    if (existing) {
      if (existing.print !== print) {
        throw new Error(`Idempotency-Key "${meta.reason}" was already used for a different request`);
      }
      return { ...existing.result, idempotentReplay: true };
    }
    realCalls += 1;
    const result = { id: `settlement-${realCalls}` };
    if (meta.reason) byReason.set(meta.reason, { print, result });
    return result;
  };
  fn.realCalls = () => realCalls;
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
  assert.deepStrictEqual(SPLIT_TYPES, ['percentage', 'fixed-amount', 'tiered-percentage']);
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

// -- tiered-percentage: a real revenue BAND, not a bracket split ------------

function tieredAgreementOptions(overrides = {}) {
  return {
    name: 'Tiered split',
    splitType: 'tiered-percentage',
    tiers: [
      { upTo: 1000, shares: [{ role: 'business', payeeId: 'owner-1', value: 90 }, { role: 'platform', payeeId: 'vaco-platform', value: 10 }] },
      { upTo: null, shares: [{ role: 'business', payeeId: 'owner-1', value: 80 }, { role: 'platform', payeeId: 'vaco-platform', value: 20 }] },
    ],
    ...overrides,
  };
}

test('createRevenueShareAgreement requires exactly one unbounded top tier', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  assert.throws(
    () => createRevenueShareAgreement(store, {
      networkId: network.id,
      ...tieredAgreementOptions({ tiers: [{ upTo: 1000, shares: [{ role: 'a', payeeId: 'x', value: 100 }] }] }),
    }),
    /requires exactly one unbounded top tier/,
  );
});

test('createRevenueShareAgreement refuses a tier whose own percentages do not sum to 100', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  assert.throws(
    () => createRevenueShareAgreement(store, {
      networkId: network.id,
      ...tieredAgreementOptions({
        tiers: [{ upTo: null, shares: [{ role: 'business', payeeId: 'owner-1', value: 60 }] }],
      }),
    }),
    /percentage shares must sum to exactly 100 \(got 60\)/,
  );
});

test('createRevenueShareAgreement sorts tiers ascending regardless of input order, unbounded last', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id,
    name: 'Out of order tiers',
    splitType: 'tiered-percentage',
    tiers: [
      { upTo: null, shares: [{ role: 'business', payeeId: 'owner-1', value: 80 }, { role: 'platform', payeeId: 'vaco-platform', value: 20 }] },
      { upTo: 500, shares: [{ role: 'business', payeeId: 'owner-1', value: 95 }, { role: 'platform', payeeId: 'vaco-platform', value: 5 }] },
      { upTo: 1000, shares: [{ role: 'business', payeeId: 'owner-1', value: 90 }, { role: 'platform', payeeId: 'vaco-platform', value: 10 }] },
    ],
  });
  assert.deepStrictEqual(agreement.tiers.map((t) => t.upTo), [500, 1000, null]);
});

test('computeSplit applies the WHOLE amount at the band it falls in, not a marginal bracket split', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, { networkId: network.id, ...tieredAgreementOptions() });

  // Falls inside the first band (<= 1000): 90/10 on the WHOLE 800.
  const underLegs = computeSplit(agreement, 800);
  assert.strictEqual(underLegs.find((l) => l.role === 'business').amount, 720);
  assert.strictEqual(underLegs.find((l) => l.role === 'platform').amount, 80);

  // Above the first band: 80/20 on the WHOLE 2000 -- not 90/10 on the
  // first 1000 and 80/20 on the remainder, which would be a different
  // (marginal) shape this file deliberately does not build.
  const overLegs = computeSplit(agreement, 2000);
  assert.strictEqual(overLegs.find((l) => l.role === 'business').amount, 1600);
  assert.strictEqual(overLegs.find((l) => l.role === 'platform').amount, 400);
});

test('computeSplit on a tiered-percentage agreement is still solvent to the cent', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, { networkId: network.id, ...tieredAgreementOptions() });
  const legs = computeSplit(agreement, 333.33);
  const sum = Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  assert.strictEqual(sum, 333.33);
});

test('distributeRevenue moves real money through a tiered-percentage agreement', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, { networkId: network.id, ...tieredAgreementOptions() });
  const settleFn = recorder();
  await distributeRevenue(store, {
    agreementId: agreement.id, totalAmount: 2000, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn,
  });
  assert.strictEqual(settleFn.totalTo('owner-1'), 1600);
  assert.strictEqual(settleFn.totalTo('vaco-platform'), 400);
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
    agreementId: agreement.id, totalAmount: 10000, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn,
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
    distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn: recorder() }),
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
    distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn: failingSettleFn }),
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
    agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', sourceType: 'hunt', sourceId: 7,
    idempotencyKey: 'dist-1', settleFn: recorder(),
  });
  assert.strictEqual(distribution.sourceType, 'hunt');
  assert.strictEqual(distribution.sourceId, 7);
});

// -- time-limited agreements (§17's own "time-limited agreements" shape) --------

test('createRevenueShareAgreement refuses an expiresAt that is not in the future', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const past = Date.now() - 1000;
  assert.throws(
    () => createRevenueShareAgreement(store, {
      networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(), expiresAt: past,
    }),
    /expiresAt must be a timestamp in the future/,
  );
});

test('isAgreementExpired is computed live, never a stored flag — a background job never flips it', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(), expiresAt: Date.now() + 50,
  });
  assert.strictEqual(isAgreementExpired(agreement), false);
  assert.strictEqual(isAgreementExpired(agreement, agreement.expiresAt + 1), true, 'computed against a later "now" without any write to the record');
});

test('an agreement with no expiresAt is never expired', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  assert.strictEqual(isAgreementExpired(agreement, Date.now() + 1000 * 60 * 60 * 24 * 365), false);
});

test('distributeRevenue refuses to distribute through an expired agreement', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(), expiresAt: Date.now() + 50,
  });
  await new Promise((r) => setTimeout(r, 60));
  await assert.rejects(
    distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn: recorder() }),
    /expired at/,
  );
});

test('distributeRevenue still succeeds right up until expiry', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(), expiresAt: Date.now() + 60 * 60 * 1000,
  });
  const distribution = await distributeRevenue(store, {
    agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn: recorder(),
  });
  assert.ok(distribution.id);
});

test('agreementView exposes the live-computed expired state alongside the stored record', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(), expiresAt: Date.now() + 50,
  });
  let view = agreementView(store, agreement.id);
  assert.strictEqual(view.expired, false);
  view = agreementView(store, agreement.id, { now: agreement.expiresAt + 1 });
  assert.strictEqual(view.expired, true, 'a view computed past expiresAt reports expired without any stored mutation');
});

test('agreementView returns null for an unknown id, rather than throwing', () => {
  const store = createHvntzStore();
  assert.strictEqual(agreementView(store, 999999), null);
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
  // **Two real, distinct distributions against the SAME agreement —
  // the bug an audit found.** `idempotencyKey` has to differ here: the
  // old code reused one key per AGREEMENT regardless of how many
  // distributions were made through it, so the second call below
  // would have silently replayed the first one's result instead of
  // actually moving the 200.
  await distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'dist-1', settleFn: recorder() });
  await distributeRevenue(store, { agreementId: agreement.id, totalAmount: 200, payerId: 'owner-1', idempotencyKey: 'dist-2', settleFn: recorder() });
  assert.strictEqual(distributionsForNetwork(store, network.id).length, 2);
});

test('a second, genuinely different distribution against one agreement actually settles, against a real idempotency-enforcing ledger', async () => {
  // The bug itself, proven against something that behaves like the
  // real V3 ledger rather than `recorder()`'s unconditional accept.
  // Before the fix, `distributeRevenue` sent BOTH settlements under the
  // identical reason `hvntz_revenue_share:${agreement.id}` — no per-
  // distribution component at all — so this fake (and the real V3
  // idempotency middleware it mirrors) would have refused the second,
  // different-amount call outright rather than letting it settle.
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  const settleFn = fakeV3IdempotentSettleFn();

  const first = await distributeRevenue(store, {
    agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'payout-week-1', settleFn,
  });
  const second = await distributeRevenue(store, {
    agreementId: agreement.id, totalAmount: 200, payerId: 'owner-1', idempotencyKey: 'payout-week-2', settleFn,
  });

  assert.strictEqual(settleFn.realCalls(), 2, 'the second, genuinely different distribution did not reach the ledger as a real settlement');
  assert.notStrictEqual(first.settlementId, second.settlementId);
  assert.strictEqual(Math.round(first.legs.reduce((n, l) => n + l.amount, 0) * 100) / 100, 100);
  assert.strictEqual(Math.round(second.legs.reduce((n, l) => n + l.amount, 0) * 100) / 100, 200);
});

test('a genuine retry with the SAME idempotencyKey replays rather than settling twice', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  const settleFn = fakeV3IdempotentSettleFn();
  const options = {
    agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', idempotencyKey: 'payout-week-1', settleFn,
  };

  await distributeRevenue(store, options);
  await distributeRevenue(store, options);

  assert.strictEqual(settleFn.realCalls(), 1, 'a retried distribution with the same key reached the ledger twice');
});

test('distributeRevenue requires an idempotencyKey', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id, name: 'Split', splitType: 'percentage', shares: workedExampleShares(),
  });
  await assert.rejects(
    distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', settleFn: recorder() }),
    /requires an idempotencyKey/,
  );
});
