// VSAFE -- Meetup Verification.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md, and undefined in CVNVO's docs too
// (referenced twice, defined nowhere). Real, grounded interpretation:
// a real, two-sided confirmation that a real meetup tied to an
// existing `SafetyCheckIn` is genuinely happening -- both real
// participants independently confirm, reducing catfishing/no-show
// risk (the real problem this class of feature exists to solve,
// distinct from the check-in timer, which only tracks ONE person's
// safety after the fact).
//
// Real cross-module reuse: a verification is only ever attached to a
// real, existing SafetyCheckIn (checked directly against
// `safetyCheckIn.js`), not a bare, untethered id.

const { getSafetyCheckIn } = require('./safetyCheckIn');

function requestMeetupVerification(store, options = {}) {
  const { checkInId, participantIds } = options;
  const checkIn = getSafetyCheckIn(store, checkInId);
  if (!checkIn) throw new Error(`requestMeetupVerification: no real check-in with id ${checkInId}`);
  if (!Array.isArray(participantIds) || participantIds.length < 2) {
    throw new Error('requestMeetupVerification requires at least 2 real participantIds');
  }

  const verification = {
    id: store.nextMeetupVerificationId++, checkInId, participantIds, confirmations: [], createdAt: Date.now(),
  };
  store.meetupVerifications.push(verification);
  return verification;
}

function getMeetupVerification(store, verificationId) {
  return store.meetupVerifications.find((v) => v.id === verificationId) || null;
}

function confirmMeetup(store, options = {}) {
  const { verificationId, userId, now = Date.now() } = options;
  const verification = getMeetupVerification(store, verificationId);
  if (!verification) throw new Error(`confirmMeetup: no verification with id ${verificationId}`);
  if (!verification.participantIds.includes(userId)) {
    throw new Error(`confirmMeetup: ${userId} is not a real participant in verification ${verificationId}`);
  }
  if (verification.confirmations.some((c) => c.userId === userId)) {
    throw new Error(`confirmMeetup: ${userId} has already confirmed`);
  }

  verification.confirmations.push({ userId, confirmedAt: now });
  return verification;
}

// Real, derived -- never a separately-tracked boolean that could
// desync from the real confirmations array.
function isBothConfirmed(store, verificationId) {
  const verification = getMeetupVerification(store, verificationId);
  if (!verification) throw new Error(`isBothConfirmed: no verification with id ${verificationId}`);
  const confirmedIds = new Set(verification.confirmations.map((c) => c.userId));
  return verification.participantIds.every((id) => confirmedIds.has(id));
}

module.exports = { requestMeetupVerification, getMeetupVerification, confirmMeetup, isBothConfirmed };
