// VSAFE -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVsafeStore() {
  return {
    safetyCheckIns: [],
    nextCheckInId: 1,
    idVerifications: [],
    callSessions: [],
    nextCallSessionId: 1,
    privacySettings: [],
    blocks: [],
    meetupVerifications: [],
    nextMeetupVerificationId: 1,
    relationshipSafetyLogs: [],
    nextSafetyConcernId: 1,
    safetyWords: [],
    photoCheckIns: [],
    nextPhotoCheckInId: 1,
    fakeCalls: [],
    nextFakeCallId: 1,
    screenTimeSessions: [],
    nextScreenTimeSessionId: 1,
    screenTimeCheckIns: [],
  };
}

module.exports = { createVsafeStore };
