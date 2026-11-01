const test = require('node:test');
const assert = require('node:assert/strict');
const { createShieldStore } = require('../lib/store');
const { registerCredentials, verifyCredentials } = require('../lib/credentials');
const { createSession, getSession } = require('../lib/sessions');
const { RESET_LIFETIME_MS, requestPasswordReset, confirmPasswordReset } = require('../lib/passwordReset');

function registered(store, userId = 'alice', password = 'correct-horse') {
  registerCredentials(store, { userId, password });
  return store;
}

test('requestPasswordReset refuses a userId with no real registered credentials', () => {
  const store = createShieldStore();
  assert.throws(() => requestPasswordReset(store, { userId: 'ghost' }), /no credentials registered/);
});

test('confirmPasswordReset actually changes the real password', () => {
  const store = registered(createShieldStore());
  const { resetToken } = requestPasswordReset(store, { userId: 'alice' });
  confirmPasswordReset(store, { token: resetToken, newPassword: 'battery-staple-9' });

  assert.equal(verifyCredentials(store, { userId: 'alice', password: 'correct-horse' }), false,
    'the old password must stop working');
  assert.equal(verifyCredentials(store, { userId: 'alice', password: 'battery-staple-9' }), true,
    'the new password must actually be in effect');
});

test('confirming a reset revokes every other currently-valid session for that user', () => {
  const store = registered(createShieldStore());
  const t1 = createSession(store, { userId: 'alice' }).sessionToken;
  const t2 = createSession(store, { userId: 'alice' }).sessionToken;
  const bobToken = createSession(store, { userId: 'bob' }).sessionToken;

  const { resetToken } = requestPasswordReset(store, { userId: 'alice' });
  const result = confirmPasswordReset(store, { token: resetToken, newPassword: 'battery-staple-9' });

  assert.equal(result.sessionsRevoked, 2);
  assert.equal(getSession(store, t1), null, 'a session minted under the old password must not survive a reset');
  assert.equal(getSession(store, t2), null);
  assert.equal(getSession(store, bobToken).valid, true, 'a different user\'s session must survive');
});

test('confirmPasswordReset refuses an unknown token, without changing anything', () => {
  const store = registered(createShieldStore());
  assert.throws(() => confirmPasswordReset(store, { token: 'reset_nope', newPassword: 'battery-staple-9' }), /invalid or unknown/);
  assert.equal(verifyCredentials(store, { userId: 'alice', password: 'correct-horse' }), true);
});

test('confirmPasswordReset is single-use -- a second confirm with the same token fails', () => {
  const store = registered(createShieldStore());
  const { resetToken } = requestPasswordReset(store, { userId: 'alice' });
  confirmPasswordReset(store, { token: resetToken, newPassword: 'battery-staple-9' });
  assert.throws(() => confirmPasswordReset(store, { token: resetToken, newPassword: 'another-one' }), /invalid or unknown/);
});

test('confirmPasswordReset refuses a real token after its real expiry, without changing the password', () => {
  const store = registered(createShieldStore());
  const now = Date.now();
  const { resetToken } = requestPasswordReset(store, { userId: 'alice', now });
  assert.throws(
    () => confirmPasswordReset(store, { token: resetToken, newPassword: 'battery-staple-9', now: now + RESET_LIFETIME_MS + 1 }),
    /expired/,
  );
  assert.equal(verifyCredentials(store, { userId: 'alice', password: 'correct-horse' }), true,
    'an expired reset token must never change the real password');
  assert.equal(Object.hasOwn(store.passwordResets, resetToken), false, 'an expired token must still be consumed, not retryable');
});

test('confirmPasswordReset enforces the real minimum password length', () => {
  const store = registered(createShieldStore());
  const { resetToken } = requestPasswordReset(store, { userId: 'alice' });
  assert.throws(() => confirmPasswordReset(store, { token: resetToken, newPassword: 'short' }), /at least 8 characters/);
});
