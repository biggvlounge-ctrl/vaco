const test = require('node:test');
const assert = require('node:assert/strict');
const { createShieldStore } = require('../lib/store');
const { SESSION_LIFETIME_MS, createSession, getSession } = require('../lib/sessions');

test('createSession requires a real userId', () => {
  const store = createShieldStore();
  assert.throws(() => createSession(store, {}), /'userId' is required/);
});

test('createSession mints a real, unguessable, non-timestamp-only token', () => {
  const store = createShieldStore();
  const a = createSession(store, { userId: 'alice' });
  const b = createSession(store, { userId: 'alice' });
  assert.notEqual(a.sessionToken, b.sessionToken, 'two sessions for the same user must not collide');
  assert.match(a.sessionToken, /^shield_alice_[0-9a-f]+$/);
});

test('getSession resolves a real, currently-valid token', () => {
  const store = createShieldStore();
  const { sessionToken } = createSession(store, { userId: 'alice' });
  const session = getSession(store, sessionToken);
  assert.deepEqual(session, { valid: true, userId: 'alice', expiresAt: store.sessions[sessionToken].expiresAt });
});

test('getSession returns null for a token that was never issued', () => {
  const store = createShieldStore();
  assert.equal(getSession(store, 'shield_nobody_deadbeef'), null);
});

test('getSession returns null once the real 24h expiry has passed', () => {
  const store = createShieldStore();
  const now = Date.now();
  const { sessionToken } = createSession(store, { userId: 'alice', now });
  assert.equal(getSession(store, sessionToken, now + SESSION_LIFETIME_MS + 1), null);
});

test('getSession still resolves one millisecond before the real expiry', () => {
  const store = createShieldStore();
  const now = Date.now();
  const { sessionToken } = createSession(store, { userId: 'alice', now });
  const session = getSession(store, sessionToken, now + SESSION_LIFETIME_MS - 1);
  assert.equal(session.valid, true);
});
