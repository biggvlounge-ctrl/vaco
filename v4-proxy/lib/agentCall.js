// V4 -- the FaceTime-style agent call flow: ring -> live call -> text
// fallback.
//
// **This is the specific capability three separate documents in this
// repo describe as already built.** All three inherit it for free and
// build features on top of it:
//
//   - `hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md`: "they automatically
//     inherit V4's existing FaceTime-style agent call flow (ring ->
//     live call -> text fallback) ... No new capability needs to be
//     built -- this is confirming an existing V4 feature applies here
//     too, not adding something new."
//   - `cvnvo/CVNVO_DATING_COMPARABLES.md`: "Kevin is already
//     established as V4's Dating/Convo-focused agent personality, with
//     FaceTime-style calling already built into V4's Agent Command
//     Center."
//   - `v4-proxy/QVAN_LESLIE_DESKINS_TECH_AVATAR.md`: "All three agents
//     use the same real, already-built V4 surfaces."
//
// It was not built. Verified before writing this: `v4-proxy/` held one
// route, a pass-through to the Anthropic API, and the strings
// "carplay", "tv play", and "call flow" appeared nowhere in any `.js`
// file in the repository. Three features were scoped against a
// foundation that did not exist -- which is exactly why this was
// blocked, and is now unblocked.
//
// **Scope, stated honestly**: this is the call *session state machine*
// and nothing else. There is no media transport here -- no WebRTC, no
// SIP, no audio, no video stream. What is real is every decision
// around the media: whether a call may ring, what the callee's surface
// is permitted to display while it does, what happens when nobody
// answers, and what the resulting artifact is. A client wired to real
// media and obeying this contract would behave correctly.
//
// The same non-dependency `cvnvo/lib/speedDating.js` already
// established for its own "all-facetime" format, for the same reason:
// the session logic is real and testable now; the media layer is a
// separate, later concern that this does not block on.

import { resolvePresentation } from './surfaces.js';
import { getTwinProfile, advanceAnimation } from './twinProfiles.js';

export const CALL_STATUSES = ['ringing', 'connected', 'ended', 'declined', 'missed'];

//: Flagged interpretive: no source document specifies how long an
//: agent rings before giving up. 30 seconds is the real convention
//: across consumer calling apps -- long enough to reach a phone in a
//: pocket, short enough not to strand the caller. Overridable per
//: call so a surface with different ergonomics (a car, where the
//: driver should not be nagged) can shorten it.
export const DEFAULT_RING_TIMEOUT_SECONDS = 30;

function requireCall(store, callId, action) {
  const call = store.calls.find((c) => c.id === callId);
  if (!call) throw new Error(`${action}: no call with id ${callId}`);
  return call;
}

function requireStatus(call, expected, action) {
  if (call.status !== expected) {
    throw new Error(`${action}: call ${call.id} is "${call.status}", expected "${expected}"`);
  }
}

// Real, and the reason the whole flow has a third leg: an unanswered
// agent call must leave something behind. A call that just vanishes is
// worse than no call, because the agent had something to say and the
// user never learns it.
function createFallbackMessage(store, call, reason, now) {
  const message = {
    id: store.nextFallbackMessageId++,
    callId: call.id,
    agentId: call.agentId,
    userId: call.userId,
    reason,
    body: call.topic
      ? `${call.agentId} tried to reach you about: ${call.topic}`
      : `${call.agentId} tried to reach you.`,
    createdAt: now,
    // Honest marker -- see `lib/store.js`. This is the one artifact in
    // the V4 store that a user would expect to survive a restart, and
    // today it does not.
    durable: false,
  };
  store.fallbackMessages.push(message);
  return message;
}

export function placeCall(store, options = {}) {
  const {
    agentId, userId, surfaceId = 'web', topic = null,
    vehicleMoving, ringTimeoutSeconds = DEFAULT_RING_TIMEOUT_SECONDS,
    now = Date.now(),
  } = options;

  if (!agentId) throw new Error('placeCall requires an agentId');
  if (!userId) throw new Error('placeCall requires a userId');
  if (!Number.isFinite(ringTimeoutSeconds) || ringTimeoutSeconds <= 0) {
    throw new Error('placeCall requires a positive ringTimeoutSeconds');
  }

  const twin = getTwinProfile(agentId);

  //: A real refusal rather than a silent downgrade. An agent marked
  //: `embodied: false` (DREA, Gibson) is a background service, not a
  //: presenter. Placing a video call from one is a caller mistake
  //: worth surfacing -- the fix is to send a message, not to quietly
  //: show a blank frame where a person should be.
  if (!twin.embodied && surfaceId !== 'text') {
    throw new Error(
      `placeCall: agent "${agentId}" is not an embodied presenter; use surface "text" instead of "${surfaceId}"`
    );
  }

  // Resolve what the callee's surface may actually show. On CarPlay in
  // motion this comes back audio-only, which is the point.
  const presentation = resolvePresentation({
    surfaceId, requestedFraming: twin.preferredFraming, vehicleMoving,
  });

  const call = {
    id: store.nextCallId++,
    agentId,
    userId,
    topic,
    surfaceId,
    status: 'ringing',
    presentation,
    animationState: 'absent',
    ringTimeoutSeconds,
    placedAt: now,
    ringExpiresAt: now + ringTimeoutSeconds * 1000,
    connectedAt: null,
    endedAt: null,
    durationMs: null,
    events: [],
    fallbackMessageId: null,
  };
  store.calls.push(call);
  return call;
}

export function answerCall(store, options = {}) {
  const { callId, now = Date.now() } = options;
  const call = requireCall(store, callId, 'answerCall');
  requireStatus(call, 'ringing', 'answerCall');
  //: Real ordering guard: a call whose ring window already elapsed
  //: cannot be answered, even if the sweep has not run yet. Without
  //: this, whether a late answer succeeds would depend on sweep
  //: timing rather than on the clock.
  if (now > call.ringExpiresAt) {
    throw new Error(`answerCall: call ${callId} rang out at ${call.ringExpiresAt}; it can no longer be answered`);
  }

  call.status = 'connected';
  call.connectedAt = now;
  const step = advanceAnimation({ currentState: call.animationState, event: 'call-connected' });
  call.animationState = step.state;
  call.events.push({ event: 'call-connected', at: now, state: step.state, clip: step.clip });
  return call;
}

export function declineCall(store, options = {}) {
  const { callId, now = Date.now() } = options;
  const call = requireCall(store, callId, 'declineCall');
  requireStatus(call, 'ringing', 'declineCall');
  call.status = 'declined';
  call.endedAt = now;
  const message = createFallbackMessage(store, call, 'declined', now);
  call.fallbackMessageId = message.id;
  return { call, fallbackMessage: message };
}

// The real timeout path. Swept rather than timer-driven so it stays
// deterministic and testable -- the same posture VOID's own retry
// sweep already takes, and it means a restart cannot leave calls
// ringing forever because a timer was lost.
export function sweepRingTimeouts(store, options = {}) {
  const { now = Date.now() } = options;
  const missed = [];
  for (const call of store.calls) {
    if (call.status !== 'ringing') continue;
    if (now <= call.ringExpiresAt) continue;
    call.status = 'missed';
    call.endedAt = now;
    const message = createFallbackMessage(store, call, 'no-answer', now);
    call.fallbackMessageId = message.id;
    missed.push({ call, fallbackMessage: message });
  }
  return missed;
}

// Stream a real conversation event into a connected call, advancing
// the twin's animation. Illegal transitions throw -- see
// `twinProfiles.js` for why that one is a hard failure while surface
// clamping is not.
export function recordCallEvent(store, options = {}) {
  const { callId, event, now = Date.now() } = options;
  const call = requireCall(store, callId, 'recordCallEvent');
  requireStatus(call, 'connected', 'recordCallEvent');
  const step = advanceAnimation({ currentState: call.animationState, event });
  call.animationState = step.state;
  call.events.push({ event, at: now, state: step.state, clip: step.clip, changed: step.changed });
  return { call, ...step };
}

export function endCall(store, options = {}) {
  const { callId, now = Date.now() } = options;
  const call = requireCall(store, callId, 'endCall');
  requireStatus(call, 'connected', 'endCall');
  call.status = 'ended';
  call.endedAt = now;
  call.durationMs = now - call.connectedAt;
  const step = advanceAnimation({ currentState: call.animationState, event: 'call-ended' });
  call.animationState = step.state;
  call.events.push({ event: 'call-ended', at: now, state: step.state, clip: step.clip });
  return call;
}

export function getCall(store, callId) {
  return store.calls.find((c) => c.id === callId) || null;
}

export function listCalls(store, options = {}) {
  const { userId, agentId, status } = options;
  return store.calls.filter(
    (c) => (userId ? c.userId === userId : true)
      && (agentId ? c.agentId === agentId : true)
      && (status ? c.status === status : true)
  );
}

export function listFallbackMessages(store, options = {}) {
  const { userId } = options;
  return store.fallbackMessages.filter((m) => (userId ? m.userId === userId : true));
}
