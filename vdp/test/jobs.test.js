// VDP — jobs/careers. The amount-undefined bug and the lost-assignment
// rollback bug this file asserts against were both watched failing
// against the pre-fix code before being trusted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { listJobs, getJob, createJobsStore, clockIn, clockOutAndPay, currentAssignment, shiftsFor } from '../src/lib/jobs.js';

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
