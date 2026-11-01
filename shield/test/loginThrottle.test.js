const test = require('node:test');
const assert = require('node:assert/strict');
const { createShieldStore } = require('../lib/store');
const {
  MAX_FAILED_ATTEMPTS, LOCKOUT_MS, checkLockout, recordFailedLogin, recordSuccessfulLogin,
} = require('../lib/loginThrottle');

test('a userId with no recorded attempts is never locked out', () => {
  const store = createShieldStore();
  assert.deepEqual(checkLockout(store, 'alice'), { lockedOut: false });
});

test('fewer than the real threshold of failures never locks the account', () => {
  const store = createShieldStore();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) recordFailedLogin(store, 'alice');
  assert.equal(checkLockout(store, 'alice').lockedOut, false);
});

test('crossing the real threshold locks the account for the real cooldown window', () => {
  const store = createShieldStore();
  const now = Date.now();
  let last;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) last = recordFailedLogin(store, 'alice', now);
  assert.equal(last.count, MAX_FAILED_ATTEMPTS);
  assert.equal(last.lockedUntil, now + LOCKOUT_MS);

  const lockout = checkLockout(store, 'alice', now);
  assert.equal(lockout.lockedOut, true);
  assert.equal(lockout.retryAfterMs, LOCKOUT_MS);
});

test('a lockout clears once its real cooldown window has genuinely elapsed', () => {
  const store = createShieldStore();
  const now = Date.now();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) recordFailedLogin(store, 'alice', now);
  assert.equal(checkLockout(store, 'alice', now + LOCKOUT_MS + 1).lockedOut, false,
    'the lockout must not outlive its own real window');
});

test('a cleared lockout starts counting failures from zero again, not a stale count', () => {
  const store = createShieldStore();
  const now = Date.now();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) recordFailedLogin(store, 'alice', now);
  // The window has elapsed -- checking clears the stale lock.
  checkLockout(store, 'alice', now + LOCKOUT_MS + 1);
  // A single further failure right after must not immediately re-lock.
  const after = recordFailedLogin(store, 'alice', now + LOCKOUT_MS + 2);
  assert.equal(after.count, 1);
  assert.equal(checkLockout(store, 'alice', now + LOCKOUT_MS + 2).lockedOut, false);
});

test('a successful login resets the failure count for that user', () => {
  const store = createShieldStore();
  recordFailedLogin(store, 'alice');
  recordFailedLogin(store, 'alice');
  recordSuccessfulLogin(store, 'alice');
  assert.equal(store.loginAttempts.alice.count, 0);
  assert.equal(store.loginAttempts.alice.lockedUntil, null);
});

test('login throttling is scoped per user -- one user\'s failures never lock out another', () => {
  const store = createShieldStore();
  const now = Date.now();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) recordFailedLogin(store, 'alice', now);
  assert.equal(checkLockout(store, 'alice', now).lockedOut, true);
  assert.equal(checkLockout(store, 'bob', now).lockedOut, false);
});
