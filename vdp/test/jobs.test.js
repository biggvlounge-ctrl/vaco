// VDP — jobs/careers. The amount-undefined bug and the lost-assignment
// rollback bug this file asserts against were both watched failing
// against the pre-fix code before being trusted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  listJobs, getJob, createJobsStore, clockIn, clockOutAndPay, currentAssignment, shiftsFor,
  PLANETARY_GOVERNORS_PAYROLL,
} from '../src/lib/jobs.js';
import {
  createResourcesStore, grantMaterials, materialsFor, spendMaterials, undoSpend,
} from '../src/lib/resources.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

test('clockIn refuses an unknown job and a double clock-in', () => {
  const store = createJobsStore();
  assert.throws(() => clockIn(store, { workerId: 'alice', jobId: 'not-a-job' }), /no job/);
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  assert.throws(() => clockIn(store, { workerId: 'alice', jobId: 'food-cashier' }), /already clocked in/);
});

test('clockOutAndPay sends the real per-shift amount, not undefined', async () => {
  const store = createJobsStore();
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  const calls = [];
  const shift = await clockOutAndPay(store, { workerId: 'alice', transferFn: fakeTransfer(calls) });

  const job = getJob('food-cashier');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, job.payPerShift, 'the real per-shift pay, not job.pay (undefined)');
  assert.ok(Number.isFinite(calls[0].amount), 'amount must be a finite number or V3 rejects the transfer');
  assert.equal(shift.pay, job.payPerShift);
  assert.equal(shift.paid, true);
});

test('a failed payout leaves the worker still clocked in, with no shift recorded', async () => {
  const store = createJobsStore();
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  const calls = [];
  await assert.rejects(
    clockOutAndPay(store, { workerId: 'alice', transferFn: fakeTransfer(calls, { shouldFail: true }) }),
  );

  assert.ok(currentAssignment(store, 'alice'), 'alice must still be clocked in after a failed payout');
  assert.equal(shiftsFor(store, 'alice').length, 0, 'no shift record survives a failed payout');
});

test('listJobs/getJob agree on every job id', () => {
  for (const job of listJobs()) {
    assert.equal(getJob(job.id).title, job.title);
  }
});

test('the three frontier jobs are founder-run, with the planetary governors as payroll', () => {
  for (const jobId of ['lumberjack', 'farmer', 'hunter']) {
    assert.equal(getJob(jobId).payrollAccountId, PLANETARY_GOVERNORS_PAYROLL);
    assert.equal(getJob(jobId).districtId, 'frontier', `${jobId} must not claim a real world.js district`);
  }
});

test('a frontier shift pays VCoin AND grants a real, produced yield, when wired to a resources store', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  clockIn(store, { workerId: 'alice', jobId: 'lumberjack' });
  const calls = [];
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn: fakeTransfer(calls), resourcesStore, grantMaterialsFn: grantMaterials,
  });

  assert.equal(calls[0].amount, getJob('lumberjack').payPerShift);
  assert.deepEqual(shift.yielded, { type: 'wood', amount: 8 });
  assert.equal(materialsFor(resourcesStore, 'alice').wood, 8);
});

test('a job with no real yields grants nothing, even when wired to a resources store', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn: fakeTransfer([]), resourcesStore, grantMaterialsFn: grantMaterials,
  });

  assert.equal(shift.yielded, undefined);
  assert.deepEqual(materialsFor(resourcesStore, 'alice'), { wood: 0, stone: 0, clay: 0, ore: 0, game: 0, crop: 0, water: 0 });
});

test('a failed payout grants no yield for a shift that never completed', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  clockIn(store, { workerId: 'alice', jobId: 'hunter' });
  await assert.rejects(
    clockOutAndPay(store, {
      workerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }), resourcesStore, grantMaterialsFn: grantMaterials,
    }),
  );
  assert.equal(materialsFor(resourcesStore, 'alice').game, 0, 'a declined payout must not also hand out the yield');
});

test('a frontier shift still works with no resources wiring at all — yields stay optional', async () => {
  const store = createJobsStore();
  clockIn(store, { workerId: 'alice', jobId: 'farmer' });
  const shift = await clockOutAndPay(store, { workerId: 'alice', transferFn: fakeTransfer([]) });
  assert.equal(shift.paid, true);
  assert.equal(shift.yielded, undefined);
});

// -- real income tax (9 Oct 2026) ---------------------------------------

test('with no taxRate given, pay is exactly job.payPerShift -- the original behavior, unchanged', async () => {
  const store = createJobsStore();
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  const calls = [];
  const shift = await clockOutAndPay(store, { workerId: 'alice', transferFn: fakeTransfer(calls) });
  assert.equal(shift.pay, getJob('food-cashier').payPerShift);
  assert.equal(shift.taxAmount, 0);
  assert.equal(shift.taxCollected, false);
  assert.equal(calls.length, 1, 'no tax transfer should be attempted at all');
});

test('a real taxRate withholds a real cut into the real treasury account, paid as a second transfer', async () => {
  const store = createJobsStore();
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  const calls = [];
  const grossPay = getJob('food-cashier').payPerShift;
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn: fakeTransfer(calls), taxRate: 0.1, treasuryAccountId: 'vdp-government-treasury',
  });
  const expectedTax = Math.round(grossPay * 0.1);
  assert.equal(shift.grossPay, grossPay);
  assert.equal(shift.taxAmount, expectedTax);
  assert.equal(shift.pay, grossPay - expectedTax);
  assert.equal(shift.taxCollected, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].amount, grossPay - expectedTax);
  assert.equal(calls[0].toUserId, 'alice');
  assert.equal(calls[1].amount, expectedTax);
  assert.equal(calls[1].toUserId, 'vdp-government-treasury');
});

test('the worker is still paid even if the real tax transfer itself fails -- recorded honestly as uncollected', async () => {
  const store = createJobsStore();
  clockIn(store, { workerId: 'alice', jobId: 'food-cashier' });
  let call = 0;
  const transferFn = async (args) => {
    call += 1;
    if (call === 2) throw new Error('treasury transfer failed');
    return { ok: true };
  };
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn, taxRate: 0.1, treasuryAccountId: 'vdp-government-treasury',
  });
  assert.equal(shift.paid, true, 'the worker\'s own real pay must not be undone by a tax-collection failure');
  assert.equal(shift.taxCollected, false);
});

// -- real overhunting regulation (9 Oct 2026) ---------------------------

test('regulateYieldFn, when given, overrides the real granted yield amount', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  clockIn(store, { workerId: 'alice', jobId: 'hunter' });
  const regulateYieldFn = (resStore, job, jobId) => {
    assert.equal(jobId, 'hunter');
    assert.equal(job.yields.amount, 5);
    return 2; // a regulated-down real yield
  };
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn: fakeTransfer([]), resourcesStore, grantMaterialsFn: grantMaterials, regulateYieldFn,
  });
  assert.deepEqual(shift.yielded, { type: 'game', amount: 2 });
  assert.equal(materialsFor(resourcesStore, 'alice').game, 2);
});

test('with no regulateYieldFn given, the yield is exactly job.yields.amount -- the original behavior, unchanged', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  clockIn(store, { workerId: 'alice', jobId: 'hunter' });
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn: fakeTransfer([]), resourcesStore, grantMaterialsFn: grantMaterials,
  });
  assert.deepEqual(shift.yielded, { type: 'game', amount: 5 });
});

test('the water treatment job is government-run and has no input of its own — it is the base of the chain', () => {
  const job = getJob('water-treatment-worker');
  assert.equal(job.payrollAccountId, PLANETARY_GOVERNORS_PAYROLL);
  assert.equal(job.districtId, 'government', 'water treatment is founding-team infrastructure, not land being worked');
  assert.equal(job.consumes, undefined, 'nothing produces the water treatment job\'s own input -- it is the root');
  assert.deepEqual(job.yields, { type: 'water', amount: 10 });
});

test('a farmer spends real water before being paid, when wired to a resources store', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  grantMaterials(resourcesStore, 'alice', { water: 10 });
  clockIn(store, { workerId: 'alice', jobId: 'farmer' });
  const calls = [];
  const shift = await clockOutAndPay(store, {
    workerId: 'alice', transferFn: fakeTransfer(calls), resourcesStore,
    grantMaterialsFn: grantMaterials, spendMaterialsFn: spendMaterials, undoSpendFn: undoSpend,
  });

  assert.deepEqual(shift.consumed, { type: 'water', amount: 3 });
  assert.deepEqual(shift.yielded, { type: 'crop', amount: 8 });
  assert.equal(materialsFor(resourcesStore, 'alice').water, 7);
  assert.equal(materialsFor(resourcesStore, 'alice').crop, 8);
  assert.equal(calls.length, 1, 'a farmer who has real water on hand still gets paid');
});

test('a farmer with no real water is refused, and paid nothing for it', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  resourcesStore.oldWorldStock = 0;
  clockIn(store, { workerId: 'alice', jobId: 'farmer' });
  const calls = [];

  await assert.rejects(
    clockOutAndPay(store, {
      workerId: 'alice', transferFn: fakeTransfer(calls), resourcesStore,
      grantMaterialsFn: grantMaterials, spendMaterialsFn: spendMaterials, undoSpendFn: undoSpend,
    }),
    /short/,
  );
  assert.equal(calls.length, 0, 'no water must mean no pay, not a harvest from nothing');
  assert.ok(currentAssignment(store, 'alice'), 'alice must still be clocked in -- the shift never actually happened');
});

test('a failed payout undoes a farmer\'s real water spend, not just the shift record', async () => {
  const store = createJobsStore();
  const resourcesStore = createResourcesStore();
  grantMaterials(resourcesStore, 'alice', { water: 10 });
  clockIn(store, { workerId: 'alice', jobId: 'farmer' });

  await assert.rejects(
    clockOutAndPay(store, {
      workerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }), resourcesStore,
      grantMaterialsFn: grantMaterials, spendMaterialsFn: spendMaterials, undoSpendFn: undoSpend,
    }),
  );
  assert.equal(materialsFor(resourcesStore, 'alice').water, 10, 'a declined payout must not leave the water spent for a harvest that never happened');
});
