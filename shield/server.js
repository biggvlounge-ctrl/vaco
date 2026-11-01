// Shield -- the ecosystem's real session layer: "one unified login/
// session, trusted by every app" (venvs/CLAUDE.md §0.2). Real,
// standalone extraction out of `venvs-mock-backend`'s own real,
// already-running, already-relied-upon session contract -- the same
// extraction discipline as `../v3/`, closing the other real half of
// this ecosystem's own largest-flagged remaining gap ("V3 never
// getting its own standalone app" also meant Shield never did).
//
// Deliberately does NOT include V3's own VCoin/VASH routes -- V3 and
// Shield are two real, distinct ecosystem services (every source doc
// that mentions either names them separately), combined into one mock
// process purely to keep an earlier session's scope manageable. This
// app is Shield only; see `../v3/` for the ledger.
//
// Every route below matches `venvs-mock-backend`'s own real Shield
// contract exactly in path, method, and response shape, so any app
// can switch to this real service by changing its own
// `SHIELD_API_URL` env var alone. See `lib/sessions.js`'s own header
// for the one real, deliberate token-generation improvement (a real
// unguessable token instead of the mock's predictable timestamp-based
// one) and the honest scope note about what "session" does and
// doesn't mean here (no real credential/password check exists
// anywhere in this ecosystem's own source docs).
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl -X POST http://localhost:8812/api/shield/session -H "Content-Type: application/json" -d '{"userId":"u1"}'

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createShieldStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const {
  SESSION_LIFETIME_MS, createSession, getSession, revokeSession,
} = require('./lib/sessions');
const { MIN_PASSWORD_LENGTH, registerCredentials, verifyCredentials } = require('./lib/credentials');
const { checkLockout, recordFailedLogin, recordSuccessfulLogin } = require('./lib/loginThrottle');
const { requestEmailVerification, confirmEmailVerification } = require('./lib/emailVerification');
const { requestPasswordReset, confirmPasswordReset } = require('./lib/passwordReset');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8812;
// -- The store, and which backend holds it ----------------------------
//
// `let`, not `const`: with DATABASE_URL set this app's store lives in
// Postgres, which cannot be built synchronously. `attachStore` mounts a
// gate ahead of the routes so no request runs before the store has
// loaded, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide. The route handlers close
// over this binding rather than a value, so they see the real store the
// moment it is installed.
//
// Without DATABASE_URL nothing changes: the same JSON file, in the same
// place, with the same guarantees.
let store = createShieldStore();
attachStore(app, {
  appKey: 'shield',
  createDefault: createShieldStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'shield', sessionLifetimeMs: SESSION_LIFETIME_MS, minPasswordLength: MIN_PASSWORD_LENGTH,
  });
});

// audit-route-guards: open -- no actor exists yet; this route creates the session
app.post('/api/shield/session', (req, res) => {
  try {
    res.status(201).json(createSession(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Real credential auth (Phase 4): additive, not a replacement for
// the claimed-userId session route above -- see credentials.js's own
// header for why both exist. Registering logs you in immediately
// (mints a real session), same as any real signup flow would.

// audit-route-guards: open -- creates the identity a session would prove; nothing to check against
app.post('/api/shield/register', (req, res) => {
  try {
    const { userId, password } = req.body || {};
    registerCredentials(store, { userId, password });
    // Real token issuance, no real mailer behind it -- see
    // emailVerification.js's own header for why this returns the
    // token directly instead of pretending an email went out.
    const { verificationToken } = requestEmailVerification(store, { userId });
    res.status(201).json({ ...createSession(store, { userId }), emailVerificationToken: verificationToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- exchanges credentials for a session; requiring one would be circular
app.post('/api/shield/login', (req, res) => {
  const { userId, password } = req.body || {};
  if (typeof userId !== 'string') return res.status(400).json({ error: 'userId is required' });

  const lockout = checkLockout(store, userId);
  if (lockout.lockedOut) {
    return res.status(429).json({ error: 'too many failed login attempts', retryAfterMs: lockout.retryAfterMs });
  }
  if (!verifyCredentials(store, { userId, password })) {
    recordFailedLogin(store, userId);
    return res.status(401).json({ error: 'invalid userId or password' });
  }
  recordSuccessfulLogin(store, userId);
  res.json(createSession(store, { userId }));
});

app.get('/api/shield/session/:token', (req, res) => {
  const session = getSession(store, req.params.token);
  if (!session) return res.status(404).json({ valid: false });
  res.json(session);
});

// Real server-side logout -- closes this project's own previously-
// flagged "nothing here invalidates a token before its real 24-hour
// expiry" gap. Presenting the real token is itself the proof needed
// to revoke it; see sessions.js's own header on `revokeSession`.
// audit-route-guards: open -- the token itself IS the credential being revoked; requiring a session to revoke a session is circular
app.post('/api/shield/session/:token/revoke', (req, res) => {
  const result = revokeSession(store, req.params.token);
  if (!result) return res.status(404).json({ error: `no valid session with token "${req.params.token}"` });
  res.json(result);
});

// -- Email verification (additive, real token lifecycle; no real
// mailer exists -- see emailVerification.js's own header) -------------
app.post('/api/shield/verify-email/confirm', (req, res) => {
  try {
    res.json(confirmEmailVerification(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Password reset (additive, real token lifecycle; no real mailer
// exists -- see passwordReset.js's own header) ------------------------

// audit-route-guards: open -- requesting a reset must work for someone who is LOCKED OUT of their own account; requiring a session here would defeat the entire feature
app.post('/api/shield/password-reset/request', (req, res) => {
  try {
    res.status(201).json(requestPasswordReset(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- the reset token itself is the real credential proving this request is authorized, same as the revoke route above
app.post('/api/shield/password-reset/confirm', (req, res) => {
  try {
    res.json(confirmPasswordReset(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Shield listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
