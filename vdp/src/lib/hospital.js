// VDP — the starter hospital. "We also will need a hospital, a
// starter hospital, where we'll start off small" (9 Oct 2026, direct
// instruction) -- one real treatment, not a billing/insurance system.
// `physician` is the job that staffs it (see `jobs.js`); this module
// is what a patient's own VCoin actually buys: a real bump to the
// `health` trait family (`traits.js`'s own four traits -- Immune
// Response, Nutrition Status, Chronic Conditions, Sleep Quality),
// which nothing in VDP read before now -- the same "every family
// needs at least one real reader" discipline this project already
// applies elsewhere (`efficiency`'s own `economy.productivityOf`
// modulator, VACON-C side, is the precedent). `traits.js` names no
// direction for any of the four, so all four are bumped the same way
// a "checkup helped" bump, not three up and one down on a guessed
// inversion.
//
// Government-run from day one, the same payroll-is-the-payee pattern
// `jobs.js`'s `PLANETARY_GOVERNORS_PAYROLL` already uses for the
// water-treatment job -- "start off small" reads as one flat-fee
// checkup, not a menu of procedures, so `TREATMENT_COST` and
// `HEALTH_BUMP_AMOUNT` are both flagged interpretive: no source
// document gives either number.
//
// `transferFn` is injected, the same decoupling every other paid
// action in this directory already uses (`property.js`'s
// `purchaseHome`, `jobs.js`'s `clockOutAndPay`). Claim-before-pay/
// rollback ordering matches `purchaseHome` exactly: the treatment
// record exists, unpaid, before the transfer is even attempted, and
// the trait bump itself only happens AFTER payment succeeds -- a
// failed charge must never still leave a healthier patient.

import { PLANETARY_GOVERNORS_PAYROLL } from './jobs.js';
import { bumpTrait } from './traits.js';

export const HOSPITAL_PAYROLL_ACCOUNT = PLANETARY_GOVERNORS_PAYROLL;
export const TREATMENT_COST = 25; // interpretive -- no source document gives a price
export const HEALTH_BUMP_AMOUNT = 10; // interpretive -- same basis as TREATMENT_COST
export const HEALTH_TRAITS = ['Immune Response', 'Nutrition Status', 'Chronic Conditions', 'Sleep Quality'];

export function createHospitalStore() {
  return { treatments: [], nextTreatmentId: 1 };
}

// `traits` is the patient's own real trait sheet (`traits.js`'s
// `generateTraitSheet` shape) -- passed in directly, the same way
// `library.js`'s `applyBookEffect` takes `player.skills` rather than
// a whole player record, so this module stays decoupled from however
// a caller stores a player.
export async function treatPatient(store, { patientId, traits, transferFn, now = Date.now() } = {}) {
  if (!patientId) throw new Error('treatPatient requires a patientId');
  if (!traits) throw new Error("treatPatient requires the patient's traits");
  if (typeof transferFn !== 'function') throw new Error('treatPatient requires a transferFn');

  const treatment = {
    id: store.nextTreatmentId++,
    patientId,
    cost: TREATMENT_COST,
    treatedAt: now,
    paid: false,
  };
  // Claim before pay: the record exists, unpaid, before the transfer
  // is even attempted -- see this module's own header comment.
  store.treatments.push(treatment);

  try {
    await transferFn({
      fromUserId: patientId, toUserId: HOSPITAL_PAYROLL_ACCOUNT, amount: TREATMENT_COST, reason: 'vdp-hospital-treatment',
    });
  } catch (err) {
    store.treatments.splice(store.treatments.indexOf(treatment), 1);
    throw err;
  }
  treatment.paid = true;

  // The actual good being purchased happens strictly after payment
  // succeeds -- a failed charge above already threw, so nothing below
  // this line runs for a patient who was never actually charged.
  const before = {};
  const after = {};
  for (const name of HEALTH_TRAITS) {
    before[name] = Number(traits?.health?.[name]) || 0;
    after[name] = bumpTrait(traits, 'health', name, HEALTH_BUMP_AMOUNT);
  }
  treatment.effect = { before, after };

  return treatment;
}

export function treatmentsFor(store, patientId) {
  return store.treatments.filter((t) => t.patientId === patientId);
}
