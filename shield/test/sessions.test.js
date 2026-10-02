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

test('getSession refuses a token that names an inherited Object.prototype property', () => {
  // store.sessions is a plain object used as a map, and `token` is a
  // fully attacker-controlled string straight off the wire. For a
  // token equal to an inherited member name, `store.sessions[token]`
  // used to resolve to that inherited function/object rather than
  // undefined -- truthy, with no expiresAt, so the old
  // `!session || session.expiresAt < now` guard read `undefined <
  // now` (false) and let it through. `Authorization: Bearer
  // constructor` (or `__proto__`, `toString`, `hasOwnProperty`,
  // `valueOf`) verified successfully against a session that was never
  // issued -- a full authentication bypass for every route in the
  // ecosystem gated by bare requireSession().
  const store = createShieldStore();
  for (const token of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(getSession(store, token), null, `"${token}" must not verify as a valid session`);
  }
});

test('getSession refuses a non-string token outright', () => {
  const store = createShieldStore();
  for (const token of [null, undefined, 123, {}, []]) {
    assert.equal(getSession(store, token), null);
  }
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
