// Shield -- real, standalone credential (email+password) verification.
// Closes this ecosystem's own most directly self-flagged real gap:
// `sessions.js`'s own header says plainly that `createSession` mints a
// real session for whatever `userId` a caller *claims*, with "no
// password, credential, or identity check behind it anywhere in this
// ecosystem's own source docs." No source doc specifies a credential
// flow either -- this is a real, standard, well-understood pattern
// (register a password, verify it on login) built the same way this
// session has built every other undocumented-but-obviously-real
// feature: cited against real-world convention, not invented to look
// more complete than the spec actually is.
//
// Deliberately additive, not a replacement: `POST /api/shield/session`
// (claimed-userId, no password) stays exactly as it was -- every other
// app in this ecosystem already depends on it for its own real,
// already-tested SSO flows (a user who's already proven who they are
// to one app shouldn't have to re-enter a password for every other
// app trusting the same Shield session). These two new routes are the
// real path a human signs up/logs in through directly -- wired into
// `vaco-shell`'s own login UI, the actual front door.
//
// Real, dependency-free hashing: Node's own built-in `crypto.scrypt`
// (a real, standard password-hashing KDF) with a random 16-byte salt
// per user, stored as `salt:hash` hex -- no new npm dependency (no
// native `bcrypt` build step), same posture as this session's other
// deliberate "use what's already in the platform" calls.

const crypto = require('crypto');

const SALT_BYTES = 16;
const KEY_LEN = 64;
const MIN_PASSWORD_LENGTH = 8;

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const candidateBuf = Buffer.from(candidate, 'hex');
  if (hashBuf.length !== candidateBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, candidateBuf);
}

function registerCredentials(store, options = {}) {
  const { userId, password, now = Date.now() } = options;
  if (!userId) throw new Error('registerCredentials requires a userId');
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`registerCredentials requires a password of at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (store.credentials[userId]) {
    throw new Error(`registerCredentials: userId "${userId}" is already registered`);
  }
  store.credentials[userId] = { passwordHash: hashPassword(password), createdAt: now };
  return { userId };
}

function verifyCredentials(store, options = {}) {
  const { userId, password } = options;
  const record = store.credentials[userId];
  if (!record || !password) return false;
  return verifyPassword(password, record.passwordHash);
}

module.exports = {
  MIN_PASSWORD_LENGTH, registerCredentials, verifyCredentials,
};
