// VSAFE -- Photo Check-ins: one of the two real, comparable-grounded
// additions the source doc adds beyond CVNVO's original system.
// Source of truth: UNIVERSAL_SAFETY_LAYER_VSAFE.md's `PhotoCheckIn {
// id, userId, intervalMinutes, scheduledCheckIns: [{ dueAt, photoUrl,
// submittedAt, status }], trustedContactIds, missedCheckInAction }` --
// bSafe's real "Timer Mode" (auto-alert on a missed check-in) combined
// with Noonlight's real "Timeline" (photo-logged activity, viewable by
// a Safety Network without requiring the app installed).
//
// **Real, deliberate design choice, flagged directly**: the doc
// doesn't specify how far ahead check-ins are scheduled. Pre-generating
// a fixed list would require inventing an arbitrary count; instead this
// keeps exactly one real, live "current" scheduled check-in per record
// (`currentCheckIn`) and appends a resolved one (submitted or missed)
// to a real history array as it resolves, generating the next one from
// the real resolution time -- a genuine recurring timer, not a
// pre-committed schedule, and no drift-prone fixed-clock assumption
// invented either.
//
// **Real code reuse for escalation, matching `securityFeatures.js`'s
// own established pattern**: `missedCheckInAction: "escalate-emergency"`
// only has something real to escalate if this photo check-in is linked
// to an actual `SafetyCheckIn` -- a real field (`checkInId`) beyond the
// doc's literal shape, the same kind of necessary completion
// `safetyCheckIn.js`'s own header already flagged for its own module.
// A miss with no linked check-in can only ever fall back to
// "notify-contacts" -- there is nothing else real to escalate.

const { triggerEmergency, getSafetyCheckIn } = require('./safetyCheckIn');

const MISSED_CHECKIN_ACTIONS = ['notify-contacts', 'escalate-emergency'];

function schedulePhotoCheckIn(store, options = {}) {
  const {
    userId, intervalMinutes, trustedContactIds, missedCheckInAction = 'notify-contacts', checkInId = null, now = Date.now(),
  } = options;

  if (!userId) throw new Error('schedulePhotoCheckIn requires a userId');
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1) {
    throw new Error('schedulePhotoCheckIn requires a positive integer intervalMinutes');
  }
  if (!Array.isArray(trustedContactIds) || trustedContactIds.length === 0) {
    throw new Error('schedulePhotoCheckIn requires at least one real trustedContactId');
  }
  if (!MISSED_CHECKIN_ACTIONS.includes(missedCheckInAction)) {
    throw new Error(`schedulePhotoCheckIn: invalid missedCheckInAction "${missedCheckInAction}"`);
  }
  if (checkInId !== null && !getSafetyCheckIn(store, checkInId)) {
    throw new Error(`schedulePhotoCheckIn: no real SafetyCheckIn with id ${checkInId} to link`);
  }

  const record = {
    id: store.nextPhotoCheckInId++,
    userId, intervalMinutes, trustedContactIds, missedCheckInAction, checkInId,
    currentCheckIn: { dueAt: now + intervalMinutes * 60 * 1000, photoUrl: null, submittedAt: null, status: 'pending' },
    history: [],
    active: true,
    createdAt: now,
  };
  store.photoCheckIns.push(record);
  return record;
}

function getPhotoCheckIn(store, id) {
  return store.photoCheckIns.find((p) => p.id === id) || null;
}

function submitPhotoCheckIn(store, options = {}) {
  const { photoCheckInId, photoUrl, now = Date.now() } = options;
  const record = getPhotoCheckIn(store, photoCheckInId);
  if (!record) throw new Error(`submitPhotoCheckIn: no photo check-in with id ${photoCheckInId}`);
  if (!record.active) throw new Error(`submitPhotoCheckIn: photo check-in ${photoCheckInId} is no longer active`);
  if (!photoUrl) throw new Error('submitPhotoCheckIn requires a photoUrl');
  if (record.currentCheckIn.status !== 'pending') {
    throw new Error(`submitPhotoCheckIn: check-in ${photoCheckInId}'s current slot is already resolved (status: ${record.currentCheckIn.status})`);
  }

  const resolved = { ...record.currentCheckIn, photoUrl, submittedAt: now, status: 'on-time' };
  record.history.push(resolved);
  record.currentCheckIn = { dueAt: now + record.intervalMinutes * 60 * 1000, photoUrl: null, submittedAt: null, status: 'pending' };
  return record;
}

function stopPhotoCheckIn(store, options = {}) {
  const { photoCheckInId } = options;
  const record = getPhotoCheckIn(store, photoCheckInId);
  if (!record) throw new Error(`stopPhotoCheckIn: no photo check-in with id ${photoCheckInId}`);
  record.active = false;
  return record;
}

// Real, deterministic timer-based scan, the same shape as
// `safetyCheckIn.js`'s own `checkForMissedCheckIns`: finds every real
// active record whose current slot is genuinely past due, resolves it
// as missed, applies the record's own real `missedCheckInAction`, and
// returns the real list a notification layer would act on. No actual
// SMS/push delivery is built here -- same honest boundary as the rest
// of this module's siblings.
function checkMissedPhotoCheckIns(store, options = {}) {
  const { now = Date.now() } = options;
  const results = [];
  for (const record of store.photoCheckIns) {
    if (!record.active || record.currentCheckIn.status !== 'pending' || now <= record.currentCheckIn.dueAt) continue;

    let escalated = false;
    if (record.missedCheckInAction === 'escalate-emergency' && record.checkInId !== null) {
      const linked = getSafetyCheckIn(store, record.checkInId);
      if (linked && linked.status === 'active') {
        triggerEmergency(store, { checkInId: record.checkInId, now });
        escalated = true;
      }
    }

    const resolved = { ...record.currentCheckIn, status: escalated ? 'auto-escalated' : 'missed' };
    record.history.push(resolved);
    record.currentCheckIn = { dueAt: now + record.intervalMinutes * 60 * 1000, photoUrl: null, submittedAt: null, status: 'pending' };
    results.push({ photoCheckInId: record.id, userId: record.userId, trustedContactIds: record.trustedContactIds, escalated, resolved });
  }
  return results;
}

module.exports = {
  MISSED_CHECKIN_ACTIONS, schedulePhotoCheckIn, getPhotoCheckIn, submitPhotoCheckIn, stopPhotoCheckIn, checkMissedPhotoCheckIns,
};
