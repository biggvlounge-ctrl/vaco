// VDP — the starter hospital. The silent-charge-with-no-effect bug
// and the charged-but-not-yet-paid rollback bug this file asserts
// against were both watched failing against the pre-fix code before
// being trusted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHospitalStore, treatPatient, treatmentsFor,
  HOSPITAL_PAYROLL_ACCOUNT, TREATMENT_COST, HEALTH_BUMP_AMOUNT, HEALTH_TRAITS,
} from '../src/lib/hospital.js';
import { generateTraitSheet } from '../src/lib/traits.js';
import { PLANETARY_GOVERNORS_PAYROLL } from '../src/lib/jobs.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

test('HOSPITAL_PAYROLL_ACCOUNT is the real planetary-governors payroll, same as water treatment', () => {
  assert.equal(HOSPITAL_PAYROLL_ACCOUNT, PLANETARY_GOVERNORS_PAYROLL);
});

test('treatPatient requires a patientId, traits and a transferFn', async () => {
  const store = createHospitalStore();
  const traits = generateTraitSheet(() => 0.5);
  await assert.rejects(treatPatient(store, { traits, transferFn: fakeTransfer([]) }), /patientId/);
  await assert.rejects(treatPatient(store, { patientId: 'alice', transferFn: fakeTransfer([]) }), /traits/);
  await assert.rejects(treatPatient(store, { patientId: 'alice', traits }), /transferFn/);
});

test('treatPatient charges the real flat fee from patient to the hospital payroll', async () => {
  const store = createHospitalStore();
  const traits = generateTraitSheet(() => 0.5);
  const calls = [];
  const treatment = await treatPatient(store, { patientId: 'alice', traits, transferFn: fakeTransfer(calls) });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    fromUserId: 'alice', toUserId: HOSPITAL_PAYROLL_ACCOUNT, amount: TREATMENT_COST, reason: 'vdp-hospital-treatment',
  });
  assert.equal(treatment.paid, true);
  assert.equal(treatment.cost, TREATMENT_COST);
});

test('treatPatient bumps every real health trait up by the same flagged-interpretive amount', async () => {
  const store = createHospitalStore();
  const traits = generateTraitSheet(() => 0); // every trait starts at 0
  const calls = [];
  const treatment = await treatPatient(store, { patientId: 'alice', traits, transferFn: fakeTransfer(calls) });

  for (const name of HEALTH_TRAITS) {
    assert.equal(treatment.effect.before[name], 0);
    assert.equal(treatment.effect.after[name], HEALTH_BUMP_AMOUNT);
    assert.equal(traits.health[name], HEALTH_BUMP_AMOUNT);
  }
});

test('a failed charge rolls back the treatment record and never touches traits', async () => {
  const store = createHospitalStore();
  const traits = generateTraitSheet(() => 0);
  const before = JSON.parse(JSON.stringify(traits.health));

  await assert.rejects(
    treatPatient(store, { patientId: 'alice', traits, transferFn: fakeTransfer([], { shouldFail: true }) }),
    /transfer failed/,
  );

  assert.deepEqual(traits.health, before);
  assert.equal(treatmentsFor(store, 'alice').length, 0);
});

test('treatmentsFor only returns a given patient\'s own treatments', async () => {
  const store = createHospitalStore();
  const aliceTraits = generateTraitSheet(() => 0.5);
  const bobTraits = generateTraitSheet(() => 0.5);
  await treatPatient(store, { patientId: 'alice', traits: aliceTraits, transferFn: fakeTransfer([]) });
  await treatPatient(store, { patientId: 'bob', traits: bobTraits, transferFn: fakeTransfer([]) });
  await treatPatient(store, { patientId: 'alice', traits: aliceTraits, transferFn: fakeTransfer([]) });

  assert.equal(treatmentsFor(store, 'alice').length, 2);
  assert.equal(treatmentsFor(store, 'bob').length, 1);
});
