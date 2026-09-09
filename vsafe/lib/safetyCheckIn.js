// VSAFE -- the real, generalized SafetyCheckIn: the one fully-
// specified subsystem in the source doc, built first per its own
// explicit "Status" instruction ("the main work is extracting the
// existing logic into a shared service and giving each app a clean
// integration point").
// Source of truth: UNIVERSAL_SAFETY_LAYER_VSAFE.md's `SafetyCheckIn {
// id, userId, sourceApp, activityType, trustedContactIds,
// locationSharingActive, checkInTimerExpiresAt, emergencyTriggered }`.
//
// Deliberately app-agnostic, unlike CVNVO's own earlier local
// implementation (which was keyed to a CVNVO `matchId` and could only
// ever be called by CVNVO): `sourceApp` and `activityType` are the
// real fields that let HVNTZ, VOID, Vavlt Stvdios, VACAY, and VXLLAGE
// all originate a check-in through this exact same code path, per the
// doc's own "any app can originate a check-in" framing.
//
// Two real fields beyond the doc's minimal list were necessary to
// make the lifecycle actually functional and are flagged here as a
// real, deliberate completion, not scope creep: `status` (the doc
// only gives a boolean `emergencyTriggered`, with no way to represent
// "confirmed safe" vs. "still pending" vs. "emergency" -- a real
// three-state lifecycle is required for a check-in system to do
// anything) and `confirmedAt` (a real timestamp, needed for any real
// audit trail). `emergencyTriggered` itself is kept as a real,
// doc-matching boolean, synced to `status === 'escalated'`.

const SOURCE_APPS = ['cvnvo', 'hvntz', 'void', 'vault-studios', 'vacay', 'vxllage'];
const CHECKIN_STATUSES = ['active', 'confirmed-safe', 'escalated'];

function createSafetyCheckIn(store, options = {}) {
  const {
    userId, sourceApp, activityType, trustedContactIds, locationSharingActive = true, checkInWindowMinutes, now = Date.now(),
  } = options;

  if (!userId) throw new Error('createSafetyCheckIn requires a userId');
  if (!SOURCE_APPS.includes(sourceApp)) {
    throw new Error(`createSafetyCheckIn: invalid sourceApp "${sourceApp}" (expected one of ${SOURCE_APPS.join(', ')})`);
  }
  if (!activityType) throw new Error('createSafetyCheckIn requires an activityType');
  if (!Array.isArray(trustedContactIds) || trustedContactIds.length === 0) {
    throw new Error('createSafetyCheckIn requires at least one real trustedContactId');
  }
  if (typeof locationSharingActive !== 'boolean') throw new Error('createSafetyCheckIn requires a boolean locationSharingActive');
  if (!Number.isInteger(checkInWindowMinutes) || checkInWindowMinutes < 1) {
    throw new Error('createSafetyCheckIn requires a positive integer checkInWindowMinutes');
  }

  const checkIn = {
    id: store.nextCheckInId++,
    userId, sourceApp, activityType, trustedContactIds, locationSharingActive,
    checkInTimerExpiresAt: now + checkInWindowMinutes * 60 * 1000,
    emergencyTriggered: false,
    status: 'active',
    confirmedAt: null,
    createdAt: now,
  };
  store.safetyCheckIns.push(checkIn);
  return checkIn;
}

function getSafetyCheckIn(store, checkInId) {
  return store.safetyCheckIns.find((c) => c.id === checkInId) || null;
}

function confirmSafe(store, options = {}) {
  const { checkInId, now = Date.now() } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`confirmSafe: no check-in with id ${checkInId}`);
  if (checkIn.status !== 'active') throw new Error(`confirmSafe: check-in ${checkInId} is not awaiting confirmation (status: ${checkIn.status})`);

  checkIn.status = 'confirmed-safe';
  checkIn.confirmedAt = now;
  return checkIn;
}

// A real, direct manual trigger -- the doc's own "emergency/panic
// features" -- distinct from the timer-based escalation below.
function triggerEmergency(store, options = {}) {
  const { checkInId, now = Date.now() } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`triggerEmergency: no check-in with id ${checkInId}`);
  if (checkIn.status === 'confirmed-safe') throw new Error(`triggerEmergency: check-in ${checkInId} was already confirmed safe`);

  checkIn.status = 'escalated';
  checkIn.emergencyTriggered = true;
  checkIn.confirmedAt = null;
  return checkIn;
}

// Real, deterministic timer-based escalation: scans for check-ins
// genuinely past their real deadline, still unconfirmed. Returns the
// real list (with each check-in's real trustedContactIds) that a
// notification layer would act on -- no actual SMS/push delivery is
// built here, that's separate infrastructure.
function checkForMissedCheckIns(store, options = {}) {
  const { now = Date.now() } = options;
  const escalated = [];
  for (const checkIn of store.safetyCheckIns) {
    if (checkIn.status === 'active' && now > checkIn.checkInTimerExpiresAt) {
      checkIn.status = 'escalated';
      checkIn.emergencyTriggered = true;
      escalated.push(checkIn);
    }
  }
  return escalated;
}

module.exports = {
  SOURCE_APPS, CHECKIN_STATUSES, createSafetyCheckIn, getSafetyCheckIn, confirmSafe, triggerEmergency, checkForMissedCheckIns,
};
