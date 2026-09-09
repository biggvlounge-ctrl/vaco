// VSAFE -- Communication Controls: real, app-agnostic anonymous
// calling.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md, but CVNVO_CORE_FEATURES.md
// describes the real, concrete requirement this generalizes:
// "Anonymous in-app calling/video before phone numbers are shared."
// CVNVO already had its own local copy of this exact mechanic before
// VSAFE existed as a real service -- this is the real, shared version,
// with a `sourceApp` field so any VACO app can originate a session the
// same way. CVNVO's own local copy is a real, flagged migration
// candidate for a later phase (see README), not silently duplicated
// forever.
//
// The real, literal anonymity guarantee: a call session tracks two
// real userIds and which app originated it, never a phone number --
// no function in this module ever accepts or stores one.

const { SOURCE_APPS } = require('./safetyCheckIn');

const CALL_STATUSES = ['active', 'ended'];

function startAnonymousCall(store, options = {}) {
  const { sourceApp, contextId, callerId, calleeId, now = Date.now() } = options;
  if (!SOURCE_APPS.includes(sourceApp)) {
    throw new Error(`startAnonymousCall: invalid sourceApp "${sourceApp}" (expected one of ${SOURCE_APPS.join(', ')})`);
  }
  if (!callerId || !calleeId) throw new Error('startAnonymousCall requires callerId and calleeId');
  if (callerId === calleeId) throw new Error('startAnonymousCall: callerId and calleeId must differ');

  const session = {
    id: store.nextCallSessionId++, sourceApp, contextId: contextId || null, callerId, calleeId,
    status: 'active', startedAt: now, endedAt: null,
  };
  store.callSessions.push(session);
  return session;
}

function endCall(store, options = {}) {
  const { callSessionId, now = Date.now() } = options;
  const session = store.callSessions.find((c) => c.id === callSessionId);
  if (!session) throw new Error(`endCall: no call session with id ${callSessionId}`);
  if (session.status !== 'active') throw new Error(`endCall: call session ${callSessionId} is not active (status: ${session.status})`);

  session.status = 'ended';
  session.endedAt = now;
  return session;
}

function getCallSession(store, callSessionId) {
  return store.callSessions.find((c) => c.id === callSessionId) || null;
}

module.exports = { CALL_STATUSES, startAnonymousCall, endCall, getCallSession };
