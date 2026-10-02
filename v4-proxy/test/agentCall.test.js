// V4 -- the FaceTime-style agent call flow had no test coverage at
// all. This covers the one real bug found in it (placeCall had no
// protection against ringing the same user twice for one logical
// call) plus enough of the surrounding lifecycle to prove the fix
// doesn't block a legitimate second call.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createV4Store } from '../lib/store.js';
import {
  placeCall, answerCall, declineCall, endCall, getCall,
} from '../lib/agentCall.js';

const NOW = Date.UTC(2026, 0, 1);

function ring(store, overrides = {}) {
  return placeCall(store, {
    agentId: 'qvan', userId: 'user-1', now: NOW, ...overrides,
  });
}

test('placing a call twice for the same agent and user returns the same ringing call', () => {
  // Mirrors lib/sessions.js's createSession, which already returns an
  // existing open session rather than a second one for this exact
  // reason. placeCall had no equivalent: a retried "call" request (an
  // HTTP client timing out and retrying, or a double-tapped button)
  // used to ring the same user twice for one logical call.
  const store = createV4Store();
  const first = ring(store);
  const second = ring(store);

  assert.equal(second.id, first.id, 'a retried placeCall must not create a second ringing call');
  assert.equal(store.calls.length, 1);
});

test('a call to a different user still rings separately', () => {
  const store = createV4Store();
  const toAlice = ring(store, { userId: 'alice' });
  const toBob = ring(store, { userId: 'bob' });

  assert.notEqual(toAlice.id, toBob.id);
  assert.equal(store.calls.length, 2);
});

test('once a call ends, placing another rings a new one', () => {
  const store = createV4Store();
  const first = ring(store);
  answerCall(store, { callId: first.id, now: NOW + 1000 });
  endCall(store, { callId: first.id, now: NOW + 2000 });

  const second = ring(store, { now: NOW + 3000 });
  assert.notEqual(second.id, first.id);
  assert.equal(getCall(store, first.id).status, 'ended');
  assert.equal(getCall(store, second.id).status, 'ringing');
});

test('once a call is declined, placing another rings a new one', () => {
  const store = createV4Store();
  const first = ring(store);
  declineCall(store, { callId: first.id, now: NOW + 1000 });

  const second = ring(store, { now: NOW + 2000 });
  assert.notEqual(second.id, first.id);
});

test('a connected call is also deduplicated, not only a ringing one', () => {
  const store = createV4Store();
  const first = ring(store);
  answerCall(store, { callId: first.id, now: NOW + 1000 });

  const retried = ring(store, { now: NOW + 1500 });
  assert.equal(retried.id, first.id);
  assert.equal(retried.status, 'connected');
});
