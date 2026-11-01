const test = require('node:test');
const assert = require('node:assert/strict');
const { createShieldStore } = require('../lib/store');
const {
  SESSION_LIFETIME_MS, createSession, getSession, revokeSession, revokeAllSessionsForUser,
} = require('../lib/sessions');

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

// -- revokeSession / revokeAllSessionsForUser (real server-side logout) --

test('revokeSession invalidates a real, currently-valid token immediately', () => {
  const store = createShieldStore();
  const { sessionToken } = createSession(store, { userId: 'alice' });
  const result = revokeSession(store, sessionToken);
  assert.deepEqual(result, { revoked: true, userId: 'alice' });
  assert.equal(getSession(store, sessionToken), null, 'a revoked token must stop validating');
});

test('revokeSession returns null for a token that was never issued or already expired', () => {
  const store = createShieldStore();
  assert.equal(revokeSession(store, 'shield_nobody_deadbeef'), null);

  const now = Date.now();
  const { sessionToken } = createSession(store, { userId: 'alice', now });
  assert.equal(revokeSession(store, sessionToken, now + SESSION_LIFETIME_MS + 1), null,
    'an already-expired token should not report a fresh revocation');
});

test('revokeSession does not disturb a different user\'s own session', () => {
  const store = createShieldStore();
  const { sessionToken: aliceToken } = createSession(store, { userId: 'alice' });
  const { sessionToken: bobToken } = createSession(store, { userId: 'bob' });
  revokeSession(store, aliceToken);
  assert.equal(getSession(store, bobToken).valid, true);
});

test('revokeAllSessionsForUser revokes every real session for that user, and only that user', () => {
  const store = createShieldStore();
  const a1 = createSession(store, { userId: 'alice' }).sessionToken;
  const a2 = createSession(store, { userId: 'alice' }).sessionToken;
  const bobToken = createSession(store, { userId: 'bob' }).sessionToken;

  const { revokedCount } = revokeAllSessionsForUser(store, 'alice');
  assert.equal(revokedCount, 2);
  assert.equal(getSession(store, a1), null);
  assert.equal(getSession(store, a2), null);
  assert.equal(getSession(store, bobToken).valid, true, 'a different user\'s session must survive');
});

test('revokeAllSessionsForUser does not count an already-expired session', () => {
  const store = createShieldStore();
  const now = Date.now();
  createSession(store, { userId: 'alice', now });
  const { revokedCount } = revokeAllSessionsForUser(store, 'alice', now + SESSION_LIFETIME_MS + 1);
  assert.equal(revokedCount, 0);
});
