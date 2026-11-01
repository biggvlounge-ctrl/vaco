const test = require('node:test');
const assert = require('node:assert/strict');
const { createShieldStore } = require('../lib/store');
const { registerCredentials } = require('../lib/credentials');
const { VERIFICATION_LIFETIME_MS, requestEmailVerification, confirmEmailVerification } = require('../lib/emailVerification');

function registered(store, userId = 'alice') {
  registerCredentials(store, { userId, password: 'correct-horse' });
  return store;
}

test('requestEmailVerification refuses a userId with no real registered credentials', () => {
  const store = createShieldStore();
  assert.throws(() => requestEmailVerification(store, { userId: 'ghost' }), /no credentials registered/);
});

test('a freshly registered account starts unverified', () => {
  const store = registered(createShieldStore());
  assert.equal(store.credentials.alice.emailVerified, false);
});

test('confirmEmailVerification marks the real account verified', () => {
  const store = registered(createShieldStore());
  const { verificationToken } = requestEmailVerification(store, { userId: 'alice' });
  const result = confirmEmailVerification(store, { token: verificationToken });
  assert.deepEqual(result, { userId: 'alice', emailVerified: true });
  assert.equal(store.credentials.alice.emailVerified, true);
});

test('confirmEmailVerification refuses an unknown token', () => {
  const store = registered(createShieldStore());
  assert.throws(() => confirmEmailVerification(store, { token: 'verify_nope' }), /invalid or unknown/);
});

test('confirmEmailVerification is single-use -- a second confirm with the same token fails', () => {
  const store = registered(createShieldStore());
  const { verificationToken } = requestEmailVerification(store, { userId: 'alice' });
  confirmEmailVerification(store, { token: verificationToken });
  assert.throws(() => confirmEmailVerification(store, { token: verificationToken }), /invalid or unknown/);
});

test('confirmEmailVerification refuses a real token after its real expiry', () => {
  const store = registered(createShieldStore());
  const now = Date.now();
  const { verificationToken } = requestEmailVerification(store, { userId: 'alice', now });
  assert.throws(
    () => confirmEmailVerification(store, { token: verificationToken, now: now + VERIFICATION_LIFETIME_MS + 1 }),
    /expired/,
  );
  // Expired or not, the token is consumed either way -- a leaked,
  // expired token must never be retryable.
  assert.equal(Object.hasOwn(store.emailVerifications, verificationToken), false);
});
