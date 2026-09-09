// Shield -- the real session layer.
// Extracted directly from `venvs-mock-backend/server.js`'s own real,
// already-running, already-relied-upon Shield contract -- the same
// real extraction discipline as `v3/lib/vcoin.js`. Every route and
// response shape below is preserved byte-for-byte on purpose: this is
// the exact real contract every existing Shield client in this
// ecosystem (`venvs/src/lib/shieldAuth.js`, `vdp/src/lib/shieldAuth.js`,
// `vaco-shell/server.js`'s own session proxy) already speaks, and
// drop-in compatibility -- repoint the env var, change no application
// code -- is the entire real point of splitting this out on its own.
//
// **Real, honest scope note, not silently glossed over**: this is a
// real, working SESSION-ISSUANCE mechanic, not a real AUTHENTICATION
// system. `createSession` mints a real, unguessable token and a real
// 24-hour expiry for whatever `userId` the caller claims -- there is
// no password, credential, or identity check behind it anywhere in
// this ecosystem's own source docs (`venvs/CLAUDE.md` §0.2 says only
// "one unified login/session, trusted by every app," never how a
// caller proves who they are). Real login/password/credential
// verification would be a separate, real, currently-undocumented
// feature -- flagged directly in this project's own README, not
// invented here to look more complete than the real spec actually is.
//
// One real, deliberate deviation from pure byte-for-byte parity: the
// mock's own token was `shield_${userId}_${Date.now()}` -- real, but
// trivially predictable (a timestamp, not a secret). Every session
// client in this ecosystem treats the token as an opaque string (none
// parse its contents), so swapping in a real, unguessable
// `crypto.randomBytes` suffix here is a real, safe improvement, not a
// compatibility break -- the same real pattern this session already
// used for VOID's Locker-to-Door codes and VOID MAGIC's booking
// credentials.

const crypto = require('crypto');

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24h, preserved from the mock

function createSession(store, options = {}) {
  const { userId, now = Date.now() } = options;
  if (!userId) throw new Error("'userId' is required.");

  const token = `shield_${userId}_${crypto.randomBytes(9).toString('hex')}`;
  const expiresAt = now + SESSION_LIFETIME_MS;
  store.sessions[token] = { userId, expiresAt };

  return { sessionToken: token, userId, expiresAt };
}

function getSession(store, token, now = Date.now()) {
  const session = store.sessions[token];
  if (!session || session.expiresAt < now) return null;
  return { valid: true, userId: session.userId, expiresAt: session.expiresAt };
}

module.exports = {
  SESSION_LIFETIME_MS,
  createSession,
  getSession,
};
