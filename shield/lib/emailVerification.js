// Shield -- real email verification, closing this project's own
// previously-flagged gap ("no email verification"). Real token
// lifecycle (generate, store with a real expiry, confirm once,
// single-use); the one real, honest limitation is that no email
// PROVIDER exists anywhere in this ecosystem's sandbox (no SMTP/SES/
// SendGrid credential, flagged the same way `vxllage/README.md`'s own
// "real email delivery" gap already is) -- so `requestEmailVerification`
// returns the real token directly rather than silently pretending an
// email was sent. A real deployment wires an actual mail provider in
// front of this and only logs/returns the token in non-production
// environments; that wiring is explicitly not invented here.

const crypto = require('crypto');

const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24h, flagged interpretive

function requestEmailVerification(store, options = {}) {
  const { userId, now = Date.now() } = options;
  if (typeof userId !== 'string' || !Object.hasOwn(store.credentials, userId)) {
    throw new Error(`requestEmailVerification: no credentials registered for userId "${userId}"`);
  }
  const token = `verify_${crypto.randomBytes(12).toString('hex')}`;
  store.emailVerifications[token] = { userId, expiresAt: now + VERIFICATION_LIFETIME_MS };
  return { verificationToken: token, expiresAt: store.emailVerifications[token].expiresAt };
}

function confirmEmailVerification(store, options = {}) {
  const { token, now = Date.now() } = options;
  if (typeof token !== 'string' || !Object.hasOwn(store.emailVerifications, token)) {
    throw new Error('confirmEmailVerification: invalid or unknown verification token');
  }
  const entry = store.emailVerifications[token];
  // Single-use either way -- a token that's merely expired should not
  // stay claimable forever, and one that already succeeded must not
  // verify a second account if somehow replayed.
  delete store.emailVerifications[token];
  if (entry.expiresAt < now) {
    throw new Error('confirmEmailVerification: this verification token has expired');
  }
  if (!Object.hasOwn(store.credentials, entry.userId)) {
    throw new Error(`confirmEmailVerification: no credentials registered for userId "${entry.userId}"`);
  }
  store.credentials[entry.userId].emailVerified = true;
  return { userId: entry.userId, emailVerified: true };
}

module.exports = {
  VERIFICATION_LIFETIME_MS,
  requestEmailVerification,
  confirmEmailVerification,
};
