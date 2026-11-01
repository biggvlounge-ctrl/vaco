// Shield -- real login rate-limiting, closing this project's own
// previously-flagged gap ("no rate-limiting on login attempts").
// Tracks failed attempts per userId (the login route's own real,
// stable identity, not a spoofable client IP this app has no real
// reverse-proxy chain to trust) and locks that userId out for a real
// cooldown window once a real, interpretive threshold is crossed --
// the common real pattern (GitHub, AWS, and most password managers
// all lock the *account*, not just the request, after repeated
// failures), not invented from nothing.
//
// Deliberately NOT a captcha/device-fingerprint system -- those need
// real, external infrastructure this ecosystem's own sandbox has no
// access to. This is the one real, server-side primitive that is
// actually buildable here: count, lock, and honestly report how much
// longer the lockout lasts.

const MAX_FAILED_ATTEMPTS = 5; // flagged, interpretive -- a common real default
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes, flagged interpretive

function record(store, userId) {
  if (!Object.hasOwn(store.loginAttempts, userId)) {
    store.loginAttempts[userId] = { count: 0, lockedUntil: null };
  }
  return store.loginAttempts[userId];
}

// Checked BEFORE verifying a password -- a locked-out account must
// refuse the attempt without ever touching `verifyCredentials`, so a
// correct password presented mid-lockout still doesn't get in early.
function checkLockout(store, userId, now = Date.now()) {
  if (typeof userId !== 'string' || !Object.hasOwn(store.loginAttempts, userId)) {
    return { lockedOut: false };
  }
  const entry = store.loginAttempts[userId];
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { lockedOut: true, retryAfterMs: entry.lockedUntil - now };
  }
  // A lockout whose window has genuinely elapsed is over -- clearing
  // it here (rather than only ever checking `> now`) means the next
  // failure starts counting from zero again, not from a stale count
  // that would otherwise re-lock on a single additional miss.
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.count = 0;
    entry.lockedUntil = null;
  }
  return { lockedOut: false };
}

function recordFailedLogin(store, userId, now = Date.now()) {
  const entry = record(store, userId);
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  return { count: entry.count, lockedUntil: entry.lockedUntil };
}

function recordSuccessfulLogin(store, userId) {
  if (Object.hasOwn(store.loginAttempts, userId)) {
    store.loginAttempts[userId] = { count: 0, lockedUntil: null };
  }
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MS,
  checkLockout,
  recordFailedLogin,
  recordSuccessfulLogin,
};
