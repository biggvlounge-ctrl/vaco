// V3 -- VASH Insurance: a real quote, a real premium charged up front
// into the real pool account, a real claim decision, and a real
// payout -- all settled through the existing VCoin ledger, the real
// MGA-style administration this module's own header describes.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { transfer } = require('../lib/vcoin');
const {
  PLATFORM_INSURANCE_POOL_ACCOUNT, ANNUAL_RATE_BY_POLICY_TYPE,
  quotePolicy, purchasePolicy, getPolicy, cancelPolicy,
  fileClaim, getClaim, approveClaim, denyClaim, payClaim,
} = require('../lib/vashInsurance');

test('quotePolicy computes a real premium from the real flagged rate', () => {
  const quote = quotePolicy({ policyType: 'home', coverageAmount: 100000 });
  assert.equal(quote.annualPremium, 100000 * ANNUAL_RATE_BY_POLICY_TYPE.home);
  assert.equal(quote.monthlyPremium, Math.round((quote.annualPremium / 12) * 100) / 100);
});

test('quotePolicy refuses an unreal policy type', () => {
  assert.throws(() => quotePolicy({ policyType: 'boat', coverageAmount: 1000 }), /policyType must be one of/);
});

test('purchasePolicy really charges the premium into the real pool account', async () => {
  const store = createV3Store();
  const policy = await purchasePolicy(store, {
    policyholderId: 'ada', policyType: 'home', coverageAmount: 90000, propertyOrVehicleDescription: '1 Main St rehab',
  }, { transferFn: (opts) => transfer(store, opts) });

  assert.equal(policy.status, 'active');
  assert.equal(policy.annualPremium, 90000 * ANNUAL_RATE_BY_POLICY_TYPE.home);
  // ada started with the real STARTING_VCOIN_BALANCE (1000) on first touch.
  assert.equal(store.vcoinBalances.ada, 1000 - policy.annualPremium);
  assert.ok(store.vcoinBalances[PLATFORM_INSURANCE_POOL_ACCOUNT] >= policy.annualPremium);
  assert.equal(getPolicy(store, policy.id).id, policy.id);
});

test('fileClaim refuses an amount over the real policy coverage', async () => {
  const store = createV3Store();
  const policy = await purchasePolicy(store, {
    policyholderId: 'ada', policyType: 'vehicle', coverageAmount: 15000, propertyOrVehicleDescription: '2019 sedan',
  }, { transferFn: (opts) => transfer(store, opts) });
  assert.throws(
    () => fileClaim(store, { policyId: policy.id, policyholderId: 'ada', description: 'collision', amountRequested: 20000 }),
    /exceeds the real policy coverage/,
  );
});

test('approveClaim cannot exceed the amount requested; payClaim moves real VCoin from the real pool', async () => {
  const store = createV3Store();
  // Coverage sized so the real premium (ada's own real STARTING_VCOIN_
  // BALANCE of 1000 has to cover it) still funds the pool past this
  // test's approved payout -- the point being tested is the payout
  // mechanics, not pool-funding arithmetic.
  const policy = await purchasePolicy(store, {
    policyholderId: 'ada', policyType: 'vehicle', coverageAmount: 20000, propertyOrVehicleDescription: '2019 sedan',
  }, { transferFn: (opts) => transfer(store, opts) });
  const claim = fileClaim(store, { policyId: policy.id, policyholderId: 'ada', description: 'fender damage', amountRequested: 1800 });

  assert.throws(
    () => approveClaim(store, { claimId: claim.id, reviewedBy: 'adjuster-1', amountApproved: 5000 }),
    /cannot exceed the amount requested/,
  );

  const approved = approveClaim(store, { claimId: claim.id, reviewedBy: 'adjuster-1', amountApproved: 1500 });
  assert.equal(approved.status, 'approved');

  const poolBefore = store.vcoinBalances[PLATFORM_INSURANCE_POOL_ACCOUNT];
  const adaBefore = store.vcoinBalances.ada;
  const { claim: paid, transaction } = await payClaim(store, { claimId: claim.id }, { transferFn: (opts) => transfer(store, opts) });

  assert.equal(paid.status, 'paid');
  assert.equal(transaction.fromUserId, PLATFORM_INSURANCE_POOL_ACCOUNT);
  assert.equal(store.vcoinBalances[PLATFORM_INSURANCE_POOL_ACCOUNT], poolBefore - 1500);
  assert.equal(store.vcoinBalances.ada, adaBefore + 1500);
  assert.equal(getClaim(store, claim.id).status, 'paid');
});

test('denyClaim requires a real reason, and a denied claim cannot be paid', async () => {
  const store = createV3Store();
  const policy = await purchasePolicy(store, {
    policyholderId: 'ada', policyType: 'home', coverageAmount: 50000, propertyOrVehicleDescription: '3 Elm St',
  }, { transferFn: (opts) => transfer(store, opts) });
  const claim = fileClaim(store, { policyId: policy.id, policyholderId: 'ada', description: 'roof leak', amountRequested: 4000 });

  assert.throws(() => denyClaim(store, { claimId: claim.id, reviewedBy: 'adjuster-2' }), /requires a reason/);
  const denied = denyClaim(store, { claimId: claim.id, reviewedBy: 'adjuster-2', reason: 'pre-existing damage, not covered' });
  assert.equal(denied.status, 'denied');

  await assert.rejects(payClaim(store, { claimId: claim.id }, { transferFn: (opts) => transfer(store, opts) }), /not "approved"/);
});

test('cancelPolicy requires the real policyholder and refuses an already-cancelled policy', async () => {
  const store = createV3Store();
  const policy = await purchasePolicy(store, {
    policyholderId: 'ada', policyType: 'home', coverageAmount: 50000, propertyOrVehicleDescription: '3 Elm St',
  }, { transferFn: (opts) => transfer(store, opts) });

  assert.throws(() => cancelPolicy(store, { policyId: policy.id, policyholderId: 'intruder' }), /policyholderId does not match/);

  const cancelled = cancelPolicy(store, { policyId: policy.id, policyholderId: 'ada' });
  assert.equal(cancelled.status, 'cancelled');
  assert.throws(() => cancelPolicy(store, { policyId: policy.id, policyholderId: 'ada' }), /not "active"/);
});
