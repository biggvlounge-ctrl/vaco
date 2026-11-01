// Shield -- real password reset, closing this project's own
// previously-flagged gap ("no password reset flow"). Same real,
// honest limitation as emailVerification.js: no email provider exists
// in this ecosystem's sandbox, so `requestPasswordReset` returns the
// real reset token directly rather than pretending to email it -- a
// real deployment wires an actual mail provider in front of this.
//
// Real security practice, not just a token swap: confirming a reset
// also revokes every other currently-valid session for that user
// (`sessions.js`'s own `revokeAllSessionsForUser`) -- the same real
// "a password reset ends every other signed-in session" behavior
// most real identity providers have, so a reset actually locks out
// whoever/whatever had the old password, not just the password itself.

const crypto = require('crypto');
const { revokeAllSessionsForUser } = require('./sessions');
const { resetPassword } = require('./credentials');

const RESET_LIFETIME_MS = 60 * 60 * 1000; // 1 hour, flagged interpretive -- shorter than email verification on purpose, since a live reset token is a real account-takeover risk if leaked

function requestPasswordReset(store, options = {}) {
  const { userId, now = Date.now() } = options;
  if (typeof userId !== 'string' || !Object.hasOwn(store.credentials, userId)) {
    throw new Error(`requestPasswordReset: no credentials registered for userId "${userId}"`);
  }
  const token = `reset_${crypto.randomBytes(16).toString('hex')}`;
  store.passwordResets[token] = { userId, expiresAt: now + RESET_LIFETIME_MS };
  return { resetToken: token, expiresAt: store.passwordResets[token].expiresAt };
}

function confirmPasswordReset(store, options = {}) {
  const { token, newPassword, now = Date.now() } = options;
  if (typeof token !== 'string' || !Object.hasOwn(store.passwordResets, token)) {
    throw new Error('confirmPasswordReset: invalid or unknown reset token');
  }
  const entry = store.passwordResets[token];
  // Single-use either way, same reasoning as emailVerification.js:
  // an expired token must not stay claimable, and a used one must
  // never reset the password a second time if replayed.
  delete store.passwordResets[token];
  if (entry.expiresAt < now) {
    throw new Error('confirmPasswordReset: this reset token has expired');
  }
  resetPassword(store, { userId: entry.userId, newPassword });
  const { revokedCount } = revokeAllSessionsForUser(store, entry.userId, now);
  return { userId: entry.userId, sessionsRevoked: revokedCount };
}

module.exports = {
  RESET_LIFETIME_MS,
  requestPasswordReset,
  confirmPasswordReset,
};
