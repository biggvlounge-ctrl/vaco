// VDP — the technological daycare. The silent-charge-with-no-effect
// bug and the charged-but-not-yet-paid rollback bug this file asserts
// against were both watched failing against the pre-fix code before
// being trusted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDaycareStore, enrollInDaycare, enrollmentsFor,
  DAYCARE_PAYROLL_ACCOUNT, ENROLLMENT_FEE, REST_BOOST_AMOUNT,
} from '../src/lib/daycare.js';
import { PLANETARY_GOVERNORS_PAYROLL } from '../src/lib/jobs.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

test('DAYCARE_PAYROLL_ACCOUNT is the real planetary-governors payroll, same as hospital/water treatment', () => {
  assert.equal(DAYCARE_PAYROLL_ACCOUNT, PLANETARY_GOVERNORS_PAYROLL);
});

test('enrollInDaycare requires a guardianId, needs and a transferFn', async () => {
  const store = createDaycareStore();
  const needs = { rest: 50 };
  await assert.rejects(enrollInDaycare(store, { needs, transferFn: fakeTransfer([]) }), /guardianId/);
  await assert.rejects(enrollInDaycare(store, { guardianId: 'alice', transferFn: fakeTransfer([]) }), /needs/);
  await assert.rejects(enrollInDaycare(store, { guardianId: 'alice', needs }), /transferFn/);
});

test('enrollInDaycare charges the real flat fee from guardian to the daycare payroll', async () => {
  const store = createDaycareStore();
  const needs = { rest: 50 };
  const calls = [];
  const enrollment = await enrollInDaycare(store, { guardianId: 'alice', needs, transferFn: fakeTransfer(calls) });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    fromUserId: 'alice', toUserId: DAYCARE_PAYROLL_ACCOUNT, amount: ENROLLMENT_FEE, reason: 'vdp-daycare-enrollment',
  });
  assert.equal(enrollment.paid, true);
  assert.equal(enrollment.fee, ENROLLMENT_FEE);
});

test('enrollInDaycare boosts the real rest need by the flagged-interpretive amount, bounded at 100', async () => {
  const store = createDaycareStore();
  const needs = { rest: 50 };
  const enrollment = await enrollInDaycare(store, { guardianId: 'alice', needs, transferFn: fakeTransfer([]) });

  assert.equal(enrollment.effect.before, 50);
  assert.equal(enrollment.effect.after, 50 + REST_BOOST_AMOUNT);
  assert.equal(needs.rest, 50 + REST_BOOST_AMOUNT);

  const needsAtCeiling = { rest: 95 };
  await enrollInDaycare(store, { guardianId: 'bob', needs: needsAtCeiling, transferFn: fakeTransfer([]) });
  assert.equal(needsAtCeiling.rest, 100);
});

test('a failed charge rolls back the enrollment record and never touches needs', async () => {
  const store = createDaycareStore();
  const needs = { rest: 50 };

  await assert.rejects(
    enrollInDaycare(store, { guardianId: 'alice', needs, transferFn: fakeTransfer([], { shouldFail: true }) }),
    /transfer failed/,
  );

  assert.equal(needs.rest, 50);
  assert.equal(enrollmentsFor(store, 'alice').length, 0);
});

test('enrollmentsFor only returns a given guardian\'s own enrollments', async () => {
  const store = createDaycareStore();
  await enrollInDaycare(store, { guardianId: 'alice', needs: { rest: 50 }, transferFn: fakeTransfer([]) });
  await enrollInDaycare(store, { guardianId: 'bob', needs: { rest: 50 }, transferFn: fakeTransfer([]) });
  await enrollInDaycare(store, { guardianId: 'alice', needs: { rest: 50 }, transferFn: fakeTransfer([]) });

  assert.equal(enrollmentsFor(store, 'alice').length, 2);
  assert.equal(enrollmentsFor(store, 'bob').length, 1);
});
