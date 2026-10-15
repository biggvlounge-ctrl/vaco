// Vaco Assistant -- the FaceTime-style call flow is a thin HTTP client
// against V4's own /api/calls* surface, so these tests fake that one
// real network call (same injected-function pattern as
// personalAssistant.test.js's insightFn/invokeFn) rather than spinning
// up v4-proxy. The real cross-app wiring is proven separately in
// test/server.test.js / live verification, not here.

const test = require('node:test');
const assert = require('node:assert');

const {
  ASSISTANT_AGENT_ID, placeAssistantCall, getAssistantCall, listAssistantCalls,
  declineAssistantCall, recordAssistantCallEvent, endAssistantCall,
} = require('../lib/assistantCall');

function recordingRequest(responses) {
  const calls = [];
  const fn = async (method, path, body) => {
    calls.push({ method, path, body });
    const match = responses.find((r) => r.method === method && (
      typeof r.path === 'string' ? r.path === path : r.path.test(path)
    ));
    if (!match) throw new Error(`recordingRequest: no stub for ${method} ${path}`);
    if (match.error) {
      const err = new Error(match.error);
      if (match.status) err.status = match.status;
      throw err;
    }
    return match.result;
  };
  fn.calls = calls;
  return fn;
}

test('placeAssistantCall rings and immediately answers -- your own assistant never leaves you waiting', async () => {
  const requestFn = recordingRequest([
    { method: 'POST', path: '/api/calls', result: { id: 7, status: 'ringing', agentId: ASSISTANT_AGENT_ID, userId: 'u1' } },
    { method: 'POST', path: '/api/calls/7/answer', result: { id: 7, status: 'connected', agentId: ASSISTANT_AGENT_ID, userId: 'u1', media: { available: false, reason: 'no media configured' } } },
  ]);

  const call = await placeAssistantCall('u1', { requestFn, topic: 'how is my VXLLAGE doing' });

  assert.equal(call.status, 'connected');
  assert.equal(requestFn.calls.length, 2);
  assert.equal(requestFn.calls[0].body.agentId, ASSISTANT_AGENT_ID);
  assert.equal(requestFn.calls[0].body.userId, 'u1');
  assert.equal(requestFn.calls[0].body.topic, 'how is my VXLLAGE doing');
  assert.equal(requestFn.calls[0].body.surfaceId, 'facetime');
});

test('placeAssistantCall requires a userId', async () => {
  await assert.rejects(placeAssistantCall(undefined, {}), /requires a userId/);
});

test('placeAssistantCall does not try to answer an already-connected retried call', async () => {
  // V4's own placeCall is idempotent for a still-ringing/connected call
  // between the same agent and user -- a retry can come back already
  // connected, and answering an already-connected call is itself an
  // error on V4's side, so this must not attempt it.
  const requestFn = recordingRequest([
    { method: 'POST', path: '/api/calls', result: { id: 7, status: 'connected', agentId: ASSISTANT_AGENT_ID, userId: 'u1' } },
  ]);

  const call = await placeAssistantCall('u1', { requestFn });

  assert.equal(call.status, 'connected');
  assert.equal(requestFn.calls.length, 1, 'an already-connected call must not be answered again');
});

test('getAssistantCall returns the real call V4 holds', async () => {
  const requestFn = recordingRequest([
    { method: 'GET', path: '/api/calls/7', result: { id: 7, status: 'connected', userId: 'u1' } },
  ]);
  const call = await getAssistantCall(7, { requestFn });
  assert.equal(call.id, 7);
});

test('getAssistantCall surfaces a real 404 rather than guessing', async () => {
  const requestFn = recordingRequest([
    { method: 'GET', path: '/api/calls/404', error: 'no call with id 404', status: 404 },
  ]);
  await assert.rejects(getAssistantCall(404, { requestFn }), (err) => err.status === 404);
});

test('listAssistantCalls scopes to this user and the assistant twin', async () => {
  const requestFn = recordingRequest([
    { method: 'GET', path: /^\/api\/calls\?/, result: { calls: [{ id: 1 }, { id: 2 }] } },
  ]);
  const calls = await listAssistantCalls('u1', { requestFn });
  assert.equal(calls.length, 2);
  assert.match(requestFn.calls[0].path, /userId=u1/);
  assert.match(requestFn.calls[0].path, new RegExp(`agentId=${ASSISTANT_AGENT_ID}`));
});

test('declineAssistantCall, recordAssistantCallEvent, endAssistantCall each call their real V4 route', async () => {
  const requestFn = recordingRequest([
    { method: 'POST', path: '/api/calls/7/decline', result: { id: 7, status: 'declined' } },
    { method: 'POST', path: '/api/calls/7/events', result: { id: 7, status: 'connected', state: 'speaking' } },
    { method: 'POST', path: '/api/calls/7/end', result: { id: 7, status: 'ended' } },
  ]);

  assert.equal((await declineAssistantCall(7, { requestFn })).status, 'declined');
  assert.equal((await recordAssistantCallEvent(7, 'agent-started-speaking', { requestFn })).state, 'speaking');
  assert.equal((await endAssistantCall(7, { requestFn })).status, 'ended');
  assert.deepEqual(requestFn.calls[1].body, { event: 'agent-started-speaking' });
});

test('recordAssistantCallEvent requires an event', async () => {
  await assert.rejects(recordAssistantCallEvent(7, undefined, { requestFn: async () => ({}) }), /requires an event/);
});
