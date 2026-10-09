// VDP — the technological daycare. "We need some type of new
// technological daycare" (9 Oct 2026, direct instruction).
//
// VDP has no children/births/dependent-modeling system anywhere
// (checked directly: no such record in `households.js` or
// `immigration.js`) -- so this module does NOT pretend to model a
// literal child being cared for, taught, or developed. What it
// honestly models is the real, bounded benefit the instruction's own
// framing implies: a guardian who enrolls gets real freed-up time
// back, read as a direct boost to their own `rest` need
// (`npcs.js`'s own `NEED_NAMES`, the need whose matching action,
// "get some real rest," has no district of its own -- the nearest
// real stand-in for "time that would otherwise go to caregiving").
// This is flagged here, explicitly, rather than silently overclaiming
// a child-development mechanic that doesn't exist.
//
// A `daycare-technician` job (see `jobs.js`) staffs it. `occupations.js`
// has no "daycare"/"childcare" entry at all (checked directly) --
// the same real gap `robot-patrol-officer` hit for "police," so this
// job's title and skill (`Engineering`, for the "technological" half
// of the instruction -- monitoring systems/robot-assisted care, not
// hands-on childcare) are VDP's own flagged-interpretive choice, same
// precedent as that job.
//
// `transferFn` is injected, same decoupling/claim-before-pay/rollback
// ordering as `hospital.js`'s `treatPatient` and `property.js`'s
// `purchaseHome`. `ENROLLMENT_FEE` and `REST_BOOST_AMOUNT` are both
// flagged interpretive: no source document gives either number.

import { PLANETARY_GOVERNORS_PAYROLL } from './jobs.js';

export const DAYCARE_PAYROLL_ACCOUNT = PLANETARY_GOVERNORS_PAYROLL;
export const ENROLLMENT_FEE = 20; // interpretive
export const REST_BOOST_AMOUNT = 15; // interpretive

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function createDaycareStore() {
  return { enrollments: [], nextEnrollmentId: 1 };
}

// `needs` is the enrolling guardian's own real needs object
// (`npcs.js`'s `createPlayerState` shape) -- passed in directly, the
// same way `hospital.js`'s `treatPatient` takes `traits` rather than
// a whole player record.
export async function enrollInDaycare(store, { guardianId, needs, transferFn, now = Date.now() } = {}) {
  if (!guardianId) throw new Error('enrollInDaycare requires a guardianId');
  if (!needs) throw new Error("enrollInDaycare requires the guardian's needs");
  if (typeof transferFn !== 'function') throw new Error('enrollInDaycare requires a transferFn');

  const enrollment = {
    id: store.nextEnrollmentId++,
    guardianId,
    fee: ENROLLMENT_FEE,
    enrolledAt: now,
    paid: false,
  };
  // Claim before pay -- see this module's own header comment.
  store.enrollments.push(enrollment);

  try {
    await transferFn({
      fromUserId: guardianId, toUserId: DAYCARE_PAYROLL_ACCOUNT, amount: ENROLLMENT_FEE, reason: 'vdp-daycare-enrollment',
    });
  } catch (err) {
    store.enrollments.splice(store.enrollments.indexOf(enrollment), 1);
    throw err;
  }
  enrollment.paid = true;

  const restBefore = Number(needs.rest) || 0;
  needs.rest = clamp(restBefore + REST_BOOST_AMOUNT, 0, 100);
  enrollment.effect = { need: 'rest', before: restBefore, after: needs.rest };

  return enrollment;
}

export function enrollmentsFor(store, guardianId) {
  return store.enrollments.filter((e) => e.guardianId === guardianId);
}
