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
const { createPersistentStore, durable } = require('./lib/persistence');
const { SESSION_LIFETIME_MS, createSession, getSession } = require('./lib/sessions');
const { MIN_PASSWORD_LENGTH, registerCredentials, verifyCredentials } = require('./lib/credentials');
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
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createShieldStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

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
    res.status(201).json(createSession(store, { userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- exchanges credentials for a session; requiring one would be circular
app.post('/api/shield/login', (req, res) => {
  const { userId, password } = req.body || {};
  if (!verifyCredentials(store, { userId, password })) {
    return res.status(401).json({ error: 'invalid userId or password' });
  }
  res.json(createSession(store, { userId }));
});

app.get('/api/shield/session/:token', (req, res) => {
  const session = getSession(store, req.params.token);
  if (!session) return res.status(404).json({ valid: false });
  res.json(session);
});

app.listen(PORT, () => {
  console.log(`Shield listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
