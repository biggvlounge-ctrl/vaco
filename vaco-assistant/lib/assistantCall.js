// Vaco Assistant -- the same FaceTime-style agent call flow V4 already
// built (ring -> live call -> text fallback), now reachable for your
// own personal assistant too, not only VACON's named executive agents.
//
// **No second call engine.** V4's `lib/agentCall.js` is the one real
// system of record for call state (ringing/connected/ended/declined/
// missed) and the one place `vaco-media` is actually wired in to make
// "connected" a verified fact rather than an assumption. This module
// is a thin HTTP client against V4's own `/api/calls*` surface,
// server-to-server with a service credential -- same shape as
// `lib/insight.js`'s call into VACON and `lib/personalAssistant.js`'s
// own `invokeV4Direct`, not a third copy of the state machine.
//
// **`ASSISTANT_AGENT_ID` needs no entry in V4's twin roster to work.**
// `getTwinProfile` already hands an unknown id the default embodied
// presenter profile. V4 lists `assistant` explicitly anyway (see
// `v4-proxy/lib/twinProfiles.js`) purely so a reader of that file does
// not mistake "no entry" for "not supported."
//
// **Auto-answered, on purpose.** V4's ring/answer split exists for the
// case a *human* callee might not pick up. Your own assistant has no
// such case -- it is always available -- so `placeAssistantCall`
// places the call and answers it in the same round trip rather than
// making the caller wait out a ring it can never miss.

const V4_PROXY_URL = process.env.V4_PROXY_URL || 'http://localhost:8787';

// Not a VACON-roster executive -- see the header. One id, shared by
// every user's own personal assistant; which conversation it is sits
// in the call's own `userId`, not in a second, per-user agent id.
const ASSISTANT_AGENT_ID = 'assistant';

// Same per-file service-credential pattern this app's other modules
// already carry (see lib/insight.js, lib/personalAssistant.js) -- a
// server-to-server call with no end-user session to present downstream.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-assistant';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

// The one real network call every function below goes through --
// injectable for tests, same pattern as every other completion-shaped
// call in this ecosystem. Throws with a real `.status` set from V4's
// own response when V4 answered with an error, and no `.status` at
// all when V4 could not be reached -- callers use that distinction to
// tell "V4 said no" apart from "V4 is down" (502).
async function v4Request(method, path, body) {
  let res;
  try {
    res = await fetch(`${V4_PROXY_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`V4 unreachable: ${err.message}`);
  }
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(responseBody.error || `V4 ${method} ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return responseBody;
}

async function placeAssistantCall(userId, options = {}) {
  const { requestFn = v4Request, topic = null, surfaceId = 'facetime', vehicleMoving } = options;
  if (!userId) throw new Error('placeAssistantCall requires a userId');

  const call = await requestFn('POST', '/api/calls', {
    agentId: ASSISTANT_AGENT_ID, userId, topic, surfaceId, vehicleMoving,
  });
  // Already connected (a retried/duplicate placeCall, handled
  // idempotently by V4 itself) -- nothing to answer.
  if (call.status !== 'ringing') return call;
  return requestFn('POST', `/api/calls/${encodeURIComponent(call.id)}/answer`);
}

async function getAssistantCall(callId, options = {}) {
  const { requestFn = v4Request } = options;
  return requestFn('GET', `/api/calls/${encodeURIComponent(callId)}`);
}

async function listAssistantCalls(userId, options = {}) {
  const { requestFn = v4Request } = options;
  if (!userId) throw new Error('listAssistantCalls requires a userId');
  const result = await requestFn(
    'GET',
    `/api/calls?userId=${encodeURIComponent(userId)}&agentId=${ASSISTANT_AGENT_ID}`,
  );
  return result.calls;
}

async function declineAssistantCall(callId, options = {}) {
  const { requestFn = v4Request } = options;
  return requestFn('POST', `/api/calls/${encodeURIComponent(callId)}/decline`);
}

async function recordAssistantCallEvent(callId, event, options = {}) {
  const { requestFn = v4Request } = options;
  if (!event) throw new Error('recordAssistantCallEvent requires an event');
  return requestFn('POST', `/api/calls/${encodeURIComponent(callId)}/events`, { event });
}

async function endAssistantCall(callId, options = {}) {
  const { requestFn = v4Request } = options;
  return requestFn('POST', `/api/calls/${encodeURIComponent(callId)}/end`);
}

module.exports = {
  ASSISTANT_AGENT_ID,
  placeAssistantCall,
  getAssistantCall,
  listAssistantCalls,
  declineAssistantCall,
  recordAssistantCallEvent,
  endAssistantCall,
};
