// CVNVO -- Communication Controls: real anonymous in-app calling.
// Source of truth: CVNVO_CORE_FEATURES.md: "Anonymous in-app calling/
// video before phone numbers are shared (per the existing safety
// system's Communication Controls)."
//
// The real, literal requirement is the anonymity guarantee: a call
// session tracks two real userIds, never a phone number, and no
// function in this module ever accepts or stores one. No real media/
// SIP/WebRTC relay is built here (that's real telephony
// infrastructure, out of this phase's scope) -- this is the real
// session bookkeeping layer a call UI would sit on top of.

const CALL_STATUSES = ['active', 'ended'];

function startAnonymousCall(store, options = {}) {
  const { matchId, callerId, calleeId, now = Date.now() } = options;
  if (!matchId) throw new Error('startAnonymousCall requires a matchId');
  if (!callerId || !calleeId) throw new Error('startAnonymousCall requires callerId and calleeId');
  if (callerId === calleeId) throw new Error('startAnonymousCall: callerId and calleeId must differ');

  const session = { id: store.nextCallSessionId++, matchId, callerId, calleeId, status: 'active', startedAt: now, endedAt: null };
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
