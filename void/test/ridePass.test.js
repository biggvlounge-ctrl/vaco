// VOID — Ride Pass: prepaid ride packs and monthly ride subscriptions
// against the Transportation vertical. See lib/ridePass.js's own
// header for the real escrow-then-redeem design.
//
// Same `ledger()` fake-settleFn convention as settlementAtomicity.test.js
// (records legs, can be told to refuse the next call the way a real
// V3 refuses an under-funded settlement).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const marketplace = require('../lib/marketplace');
const ridePass = require('../lib/ridePass');
const { createVoidStore } = require('../lib/store');

const NOW = Date.UTC(2026, 10, 1);
const DAY = 24 * 60 * 60 * 1000;

function ledger({ failNextCall = false } = {}) {
  const calls = [];
  let refuseNext = failNextCall;
  const fn = async (legs, meta = {}) => {
    if (refuseNext) {
      refuseNext = false;
      throw new Error('legs[0]: Insufficient VCoin balance. Nothing in this settlement was applied.');
    }
    calls.push({ legs, meta });
    return { settlementId: calls.length };
  };
  fn.calls = calls;
  fn.paidBy = (userId) => calls
    .flatMap((c) => c.legs)
    .filter((l) => l.fromUserId === userId)
    .reduce((n, l) => n + l.amount, 0);
  return fn;
}

function acceptedRide(store, { customerId = 'rider', unitPrice = 10 } = {}) {
  const job = marketplace.requestJob(store, {
    verticalId: 'transportation', customerId, quantity: 1, unitPrice,
  });
  marketplace.matchProvider(store, { jobId: job.id, providerId: 'driver' });
  marketplace.acceptJob(store, job.id);
  return job;
}

// -- purchase -----------------------------------------------------------

test('purchaseRidePass charges the full plan price up front into escrow', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });

  assert.equal(settleFn.calls.length, 1);
  assert.equal(settleFn.calls[0].legs.length, 1);
  assert.equal(settleFn.calls[0].legs[0].fromUserId, 'rider');
  assert.equal(settleFn.calls[0].legs[0].toUserId, ridePass.VOID_RIDE_PASS_ESCROW_ACCOUNT);
  assert.equal(settleFn.calls[0].legs[0].amount, 42);

  assert.equal(pass.kind, 'prepaid-pack');
  assert.equal(pass.creditsRemaining, 5);
  assert.equal(pass.balanceRemaining, 42);
  assert.equal(pass.status, 'active');
  assert.equal(pass.expiresAt, NOW + 60 * DAY);
});

test('purchaseRidePass on a subscription plan sets a real billing cycle and auto-renews by default', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });

  assert.equal(pass.kind, 'subscription');
  assert.equal(pass.creditsRemaining, 15);
  assert.equal(pass.balanceRemaining, 59);
  assert.equal(pass.autoRenew, true);
  assert.equal(pass.currentCycleStart, NOW);
  assert.equal(pass.currentCycleEnd, NOW + 30 * DAY);
});

test('purchaseRidePass refuses an unknown plan', async () => {
  const store = createVoidStore();
  await assert.rejects(
    () => ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'not-a-plan', settleFn: ledger() }),
    /unknown planId/,
  );
});

test('purchaseRidePass refuses without a customerId', async () => {
  const store = createVoidStore();
  await assert.rejects(
    () => ridePass.purchaseRidePass(store, { planId: 'pack-5', settleFn: ledger() }),
    /requires a customerId/,
  );
});

// -- redemption -----------------------------------------------------------

test('redeemRidePassForJob covers a ride entirely from escrow -- the rider pays nothing directly', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });
  const job = acceptedRide(store, { customerId: 'rider', unitPrice: 8 });

  const { job: completed } = await ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.providerPayout + completed.platformFee, 8);
  // The purchase call plus the redemption call -- never a leg paid by
  // the rider themselves for this ride.
  assert.equal(settleFn.calls.length, 2);
  const redemptionLegs = settleFn.calls[1].legs;
  assert.ok(redemptionLegs.every((l) => l.fromUserId === ridePass.VOID_RIDE_PASS_ESCROW_ACCOUNT));
  assert.equal(settleFn.paidBy('rider'), 42, 'only the original purchase, nothing charged to the rider for the ride itself');

  assert.equal(pass.creditsRemaining, 4);
  assert.equal(pass.balanceRemaining, 34);
  assert.equal(pass.ridesRedeemed, 1);
  assert.equal(pass.redemptions.length, 1);
  assert.equal(pass.redemptions[0].jobId, job.id);
});

test('redeemRidePassForJob refuses a non-Transportation job', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });
  const job = marketplace.requestJob(store, { verticalId: 'courier', customerId: 'rider', quantity: 1, unitPrice: 8 });
  marketplace.matchProvider(store, { jobId: job.id, providerId: 'driver' });
  marketplace.acceptJob(store, job.id);

  await assert.rejects(
    () => ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW }),
    /only cover the Transportation vertical/,
  );
});

test('redeemRidePassForJob refuses a ride that belongs to someone else', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });
  const job = acceptedRide(store, { customerId: 'someone-else', unitPrice: 8 });

  await assert.rejects(
    () => ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW }),
    /does not belong to this ride pass's holder/,
  );
});

test('redeemRidePassForJob refuses once ride credits are exhausted', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });
  pass.creditsRemaining = 0;
  const job = acceptedRide(store, { customerId: 'rider', unitPrice: 8 });

  await assert.rejects(
    () => ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW }),
    /no ride credits remaining/,
  );
});

test('redeemRidePassForJob refuses a ride pricier than the pass has real balance left to cover', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });
  pass.balanceRemaining = 5; // plenty of credits left, but not enough real money
  const job = acceptedRide(store, { customerId: 'rider', unitPrice: 8 });

  await assert.rejects(
    () => ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW }),
    /cannot cover this ride/,
  );
  assert.equal(job.status, 'accepted', 'a refused redemption must not advance the job');
});

test('redeemRidePassForJob refuses a prepaid pack past its expiry', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });
  const job = acceptedRide(store, { customerId: 'rider', unitPrice: 8 });

  await assert.rejects(
    () => ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW + 61 * DAY }),
    /expired/,
  );
});

test('redeemRidePassForJob refuses a subscription past its current cycle end', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });
  const job = acceptedRide(store, { customerId: 'rider', unitPrice: 8 });

  await assert.rejects(
    () => ridePass.redeemRidePassForJob(store, { passId: pass.id, jobId: job.id, settleFn, now: NOW + 31 * DAY }),
    /billing cycle has ended/,
  );
});

// -- renewal / cancellation -----------------------------------------------

test('renewRidePassCycle charges the next cycle and resets credits + balance (no rollover)', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });
  pass.creditsRemaining = 1;
  pass.balanceRemaining = 2;

  await ridePass.renewRidePassCycle(store, { passId: pass.id, settleFn, now: NOW + 30 * DAY });

  assert.equal(settleFn.calls.length, 2);
  assert.equal(settleFn.calls[1].legs[0].amount, 59);
  assert.equal(pass.creditsRemaining, 15, 'unused credits do not roll over');
  assert.equal(pass.balanceRemaining, 59, 'unused balance does not roll over');
  assert.equal(pass.cyclesRenewed, 1);
  assert.equal(pass.currentCycleStart, NOW + 30 * DAY);
  assert.equal(pass.currentCycleEnd, NOW + 60 * DAY);
});

test('renewRidePassCycle refuses a prepaid pack', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });

  await assert.rejects(
    () => ridePass.renewRidePassCycle(store, { passId: pass.id, settleFn, now: NOW }),
    /not a subscription/,
  );
});

test('cancelRidePassAutoRenew turns off future billing without cutting the current cycle short', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });

  const cancelled = ridePass.cancelRidePassAutoRenew(store, pass.id);
  assert.equal(cancelled.autoRenew, false);
  assert.equal(cancelled.status, 'active', 'the pass stays usable for the rest of the cycle already paid for');
});

test('cancelRidePassAutoRenew refuses a prepaid pack, which has nothing to auto-renew', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'pack-5', settleFn, now: NOW });

  assert.throws(() => ridePass.cancelRidePassAutoRenew(store, pass.id), /not a subscription/);
});

// -- the real background-sweep behavior ------------------------------------

test('sweepRidePassRenewals renews a due subscription that still auto-renews and can pay', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });

  const result = await ridePass.sweepRidePassRenewals(store, { settleFn, now: NOW + 31 * DAY });

  assert.deepEqual(result.renewed, [pass.id]);
  assert.deepEqual(result.expired, []);
  assert.deepEqual(result.lapsed, []);
  assert.equal(pass.status, 'active');
  assert.equal(pass.cyclesRenewed, 1);
});

test('sweepRidePassRenewals expires a due subscription whose holder turned off auto-renew, with no charge attempted', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });
  ridePass.cancelRidePassAutoRenew(store, pass.id);

  const result = await ridePass.sweepRidePassRenewals(store, { settleFn, now: NOW + 31 * DAY });

  assert.deepEqual(result.expired, [pass.id]);
  assert.equal(pass.status, 'expired');
  assert.equal(settleFn.calls.length, 1, 'only the original purchase -- no renewal charge was attempted');
});

test('sweepRidePassRenewals marks a due subscription lapsed, not silently active, when the renewal charge fails', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });

  const failingSettleFn = ledger({ failNextCall: true });
  const result = await ridePass.sweepRidePassRenewals(store, { settleFn: failingSettleFn, now: NOW + 31 * DAY });

  assert.deepEqual(result.lapsed.map((l) => l.id), [pass.id]);
  assert.equal(pass.status, 'lapsed');
  assert.match(pass.lapsedReason, /Insufficient VCoin balance/);
});

test('sweepRidePassRenewals leaves a subscription alone before its cycle actually ends', async () => {
  const store = createVoidStore();
  const settleFn = ledger();
  const pass = await ridePass.purchaseRidePass(store, { customerId: 'rider', planId: 'monthly-15', settleFn, now: NOW });

  const result = await ridePass.sweepRidePassRenewals(store, { settleFn, now: NOW + 10 * DAY });

  assert.deepEqual(result.renewed, []);
  assert.deepEqual(result.expired, []);
  assert.deepEqual(result.lapsed, []);
  assert.equal(pass.status, 'active');
  assert.equal(pass.cyclesRenewed, 0);
});
