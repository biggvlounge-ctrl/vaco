// CVNVO -- real integration into VSAFE's other two Phase 3 features
// (Fake Call, Screen Time), kept separate from `firstDateSafety.js`
// deliberately: neither one is tied to a specific date's own
// SafetyCheckIn the way Photo Check-ins are -- VSAFE's own `FakeCall`
// takes a bare `userId`, and `ScreenTimeCheckIn` takes a bare
// `userId`/`appId`, with no real per-date state for CVNVO to add on
// top. Both functions below are real, thin, validated pass-throughs:
// CVNVO's only real contribution is confirming the caller is a real,
// existing CVNVO user before forwarding to VSAFE -- no local storage
// is added here, VSAFE already owns 100% of the real state.

const { getUserProfile } = require('./profiles');

async function triggerFakeCall(store, options = {}) {
  const {
    userId, callerName, callerPhotoUrl = null, delaySeconds, vsafeFakeCallFn, now = Date.now(),
  } = options;
  if (!getUserProfile(store, userId)) throw new Error(`triggerFakeCall: no real CVNVO profile for ${userId}`);
  if (typeof vsafeFakeCallFn !== 'function') throw new Error('triggerFakeCall requires a vsafeFakeCallFn(params)');

  return vsafeFakeCallFn({
    userId, callerName, callerPhotoUrl, delaySeconds, now,
  });
}

// `isMinorAccount` is real-derived from the caller's own real,
// verified profile age (never trusted as caller-supplied input, the
// same "don't let the client just assert a safety-relevant boolean"
// instinct behind VACA's own `verifiedBadge` fix). In practice this
// always resolves false today, since `createUserProfile` already
// enforces an 18+ floor on every real CVNVO profile -- flagged
// directly here rather than silently hardcoding `false`, so this stays
// correct if that floor is ever loosened.
async function recordScreenTimeSession(store, options = {}) {
  const { userId, sessionDurationMinutes, vsafeScreenTimeFn, now = Date.now() } = options;
  const profile = getUserProfile(store, userId);
  if (!profile) throw new Error(`recordScreenTimeSession: no real CVNVO profile for ${userId}`);
  if (typeof vsafeScreenTimeFn !== 'function') throw new Error('recordScreenTimeSession requires a vsafeScreenTimeFn(params)');

  const isMinorAccount = profile.compatibilityInputs.age < 18;
  return vsafeScreenTimeFn({
    userId, appId: 'cvnvo', sessionDurationMinutes, isMinorAccount, now,
  });
}

module.exports = { triggerFakeCall, recordScreenTimeSession };
