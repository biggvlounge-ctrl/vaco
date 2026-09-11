// VACO MEDIA -- the one place media sessions live.
//
// The fourth shared service, alongside V3 (money), Shield (identity)
// and vaco-operator (authority). It exists for the reason
// `dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md` gives: four
// consumers -- VXLLAGE Live/Call, Vavlt Stvdios screen sessions,
// CVNVO speed dating, V4 agent calls -- each built a real session
// layer and each stopped at the same wall. Building it inside any one
// of them would make the other three depend on it, which is backwards.
//
// **What is real here and what is not, stated plainly.** The control
// plane is real: sessions, per-participant join grants, capacity,
// expiry, revocation, presence and lifecycle. That is most of the work
// and all of the security. The media plane -- actual audio and video
// bytes -- is carried by an SFU behind `lib/transport/`, defaulting to
// self-hosted LiveKit, and `deploy/` does not run one yet. Until it
// does, the loopback adapter approves joins and says clearly that
// nothing will connect.
//
// That split is deliberate, per the media decision doc's own rule: do
// not build something that looks like it plays.
//
// Run:
//   npm install && npm start
//
// Test:
//   curl http://localhost:8821/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createMediaStore } = require('./lib/store');
const { attachStore } = require('./lib/storeBackend');
const {
  SESSION_KINDS, ROLES, EVENT_KINDS, DEFAULT_GRANT_TTL_MS,
  createSession, getSession, findSession, issueGrant, revokeGrant, verifyGrant,
  recordEvent, eventsFor, startRecording, endSession, describeSession,
} = require('./lib/sessions');
const { createTransport } = require('./lib/transport');
const { traceMiddleware } = require('./lib/tracing.cjs');
const {
  ASSET_KINDS, DEFAULT_PLAYBACK_TTL_MS,
  registerAsset, getAsset, findAsset, attachStorage, markReady, markFailed,
  removeAsset, issuePlaybackGrant, activeGrantsForViewer, revokePlaybackGrant,
  verifyPlaybackGrant, describeCatalogue,
} = require('./lib/assets');
const { createStorage } = require('./lib/storage');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { requireCallingService } = require('./lib/shieldAuth.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Mounted before the auth middleware on purpose: a request that
// serviceAuth *refuses* still gets a trace id, and a 401 you cannot
// correlate is exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8821;
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
let store = createMediaStore();
attachStore(app, {
  appKey: 'vaco-media',
  createDefault: createMediaStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

const transport = createTransport();

// **Refuse to start rather than fail on the first person who speaks.**
//
// The livekit adapter has always been able to say whether it is
// configured; nothing ever asked it at boot, so selecting `livekit`
// with no keys produced a service that came up healthy, reported
// `configured: false` on a health endpoint nobody was watching, and
// 503'd the first join. Same class as a settlement route that 401s
// only once money moves.
//
// Checked here rather than in the adapter's constructor: `describe()`
// reports `configured` onto /api/health and the seam's own tests
// construct every adapter by name, both of which need an unconfigured
// instance to exist. This is the one place that can honestly say the
// process should not run.
if (typeof transport.assertConfigured === 'function') transport.assertConfigured();
const storage = createStorage();

// Mounted above every route, per the rule VOID learned the hard way --
// with exactly one composition, and it is worth spelling out because a
// bare `app.use(serviceAuth.middleware)` here was wrong and only
// running it showed that.
//
// `serviceAuth` enforces "no anonymous mutating call." Every route here
// satisfies that with a service credential except **`/api/join`**,
// which is the one route a *participant's own client* calls -- and it
// is not anonymous either: it carries a `vmg_` grant this service
// minted and can verify. It is a different credential type, not a
// missing one.
//
// So the floor admits either, and the join route still proves the
// grant itself. What this must never become is a general exemption
// list: it is one route, named literally, and anything else on this
// service goes through serviceAuth untouched.
const serviceAuth = createServiceAuth();
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path === '/api/join' || req.path === '/api/play')) return next();
  return serviceAuth.middleware(req, res, next);
});

// -- Who may ask ---------------------------------------------------------
//
// **Every write here is `requireCallingService()`, and that is the
// design rather than a shortcut.** A browser that can mint its own join
// grant can join any room it can name, which is the entire attack this
// service exists to prevent. The consuming app -- which already decided
// the person belongs in the room -- asks on their behalf over a service
// credential and hands the result down.
//
// This service makes no authorization policy of its own. Shield says
// who someone is; CVNVO decides who is in a speed date. We enforce the
// grant we were handed and invent nothing.

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vaco-media',
    sessionKinds: SESSION_KINDS,
    roles: ROLES,
    eventKinds: EVENT_KINDS,
    defaultGrantTtlMs: DEFAULT_GRANT_TTL_MS,
    openSessions: store.sessions.filter((s) => s.status !== 'ended').length,
    // Says out loud whether media can actually flow. A health endpoint
    // that reports ok while nothing can connect is the failure this
    // whole service is careful about.
    assetKinds: ASSET_KINDS,
    catalogue: describeCatalogue(store),
    transport: transport.describe(),
    storage: storage.describe(),
    serviceAuth: serviceAuth.describe(),
  });
});

// -- Sessions ------------------------------------------------------------

app.post('/api/sessions', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createSession(store, {
      ...req.body,
      // From the verified credential, not the body: a session records
      // which service asked for it, and a service cannot claim to be
      // another one.
      app: req.callingService,
      createdBy: req.callingService,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  const described = describeSession(store, Number(req.params.id));
  if (!described) return res.status(404).json({ error: `no session with id ${req.params.id}` });
  res.json(described);
});

// Look a session up the way a consumer actually holds it: by its own id.
app.get('/api/sessions/by-app/:app/:externalId', (req, res) => {
  const session = findSession(store, req.params.app, req.params.externalId);
  if (!session) return res.status(404).json({ error: 'no open session at that address' });
  res.json(describeSession(store, session.id));
});

app.post('/api/sessions/:id/end', requireCallingService(), (req, res) => {
  try {
    res.json(endSession(store, {
      sessionId: Number(req.params.id), endedBy: req.callingService,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/recording/start', requireCallingService(), (req, res) => {
  try {
    res.json(startRecording(store, {
      sessionId: Number(req.params.id), startedBy: req.callingService,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Grants: the security boundary --------------------------------------

// Returns the credential exactly once. Only its digest is stored, for
// the same reason operator credentials are: these stores go to disk and
// off-host.
app.post('/api/sessions/:id/grants', requireCallingService(), (req, res) => {
  try {
    const { grant, credential } = issueGrant(store, {
      sessionId: Number(req.params.id),
      participantId: (req.body || {}).participantId,
      role: (req.body || {}).role || 'both',
      ttlMs: (req.body || {}).ttlMs || DEFAULT_GRANT_TTL_MS,
      issuedBy: req.callingService,
    });
    const { credentialDigest, ...safe } = grant;
    res.status(201).json({ grant: safe, credential });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/grants/:id/revoke', requireCallingService(), (req, res) => {
  try {
    const { credentialDigest, ...safe } = revokeGrant(store, {
      grantId: Number(req.params.id), revokedBy: req.callingService,
    });
    res.json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Join ----------------------------------------------------------------
//
// The one route a participant's own client calls, and it takes a
// credential this service issued rather than a session token: the
// grant *is* the authorization, which is why it had to come from the
// server in the first place.
// audit-route-guards: open -- the grant IS the authorization; verifyGrant below is the check, and it cannot be middleware because the credential names the session it is for
app.post('/api/join', (req, res) => {
  // Reached without a service credential by design -- see the mount
  // above. The grant below is the authorization, and it is the only
  // thing this route trusts.
  const { credential, sessionId } = req.body || {};
  const verdict = verifyGrant(store, {
    credential,
    sessionId: sessionId === undefined ? undefined : Number(sessionId),
  });
  if (!verdict.ok) return res.status(403).json({ error: verdict.reason });

  const session = getSession(store, verdict.sessionId);
  try {
    res.json({
      sessionId: session.id,
      kind: session.kind,
      recordable: session.recordable,
      // Whatever the transport needs the client to connect with -- a
      // LiveKit URL and token, or the loopback adapter saying plainly
      // that nothing will connect.
      ...transport.joinCredential(verdict, session, {}),
    });
  } catch (err) {
    // A misconfigured transport is a 503, not a 403: the participant
    // was allowed in, the service cannot carry them.
    res.status(503).json({ error: err.message });
  }
});

// -- Lifecycle -----------------------------------------------------------
//
// Reported by the transport, never inferred. A consumer learns a call
// actually connected rather than assuming it did.
app.post('/api/sessions/:id/events', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(recordEvent(store, {
      sessionId: Number(req.params.id),
      kind: (req.body || {}).kind,
      participantId: (req.body || {}).participantId ?? null,
      detail: (req.body || {}).detail || {},
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/events', (req, res) => {
  res.json({ events: eventsFor(store, Number(req.params.id)) });
});

// -- Assets: the catalogue ----------------------------------------------
//
// Same security model as sessions, deliberately: the owning app decides
// who may watch and asks on their behalf over a service credential. A
// playback URL is a bearer token, and one a client could mint itself
// would be public the moment anyone pasted it.

app.post('/api/assets', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerAsset(store, { ...req.body, app: req.callingService }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/assets/:id', (req, res) => {
  const asset = getAsset(store, Number(req.params.id));
  if (!asset) return res.status(404).json({ error: `no asset with id ${req.params.id}` });
  res.json(asset);
});

app.get('/api/assets/by-app/:app/:externalId', (req, res) => {
  const asset = findAsset(store, req.params.app, req.params.externalId);
  if (!asset) return res.status(404).json({ error: 'no asset at that address' });
  res.json(asset);
});

app.post('/api/assets/:id/storage', requireCallingService(), (req, res) => {
  try {
    res.json(attachStorage(store, { assetId: Number(req.params.id), ...req.body }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/assets/:id/ready', requireCallingService(), (req, res) => {
  try {
    res.json(markReady(store, { assetId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/assets/:id/failed', requireCallingService(), (req, res) => {
  try {
    res.json(markFailed(store, { assetId: Number(req.params.id), reason: (req.body || {}).reason }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/assets/:id/remove', requireCallingService(), (req, res) => {
  try {
    res.json(removeAsset(store, {
      assetId: Number(req.params.id),
      removedBy: req.callingService,
      reason: (req.body || {}).reason || null,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/assets/:id/playback-grants', requireCallingService(), (req, res) => {
  try {
    const { grant, credential } = issuePlaybackGrant(store, {
      assetId: Number(req.params.id),
      viewerId: (req.body || {}).viewerId,
      ttlMs: (req.body || {}).ttlMs || DEFAULT_PLAYBACK_TTL_MS,
      issuedBy: req.callingService,
    });
    const { credentialDigest, ...safe } = grant;
    res.status(201).json({ grant: safe, credential });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/playback-grants/:id/revoke', requireCallingService(), (req, res) => {
  try {
    const { credentialDigest, ...safe } = revokePlaybackGrant(store, {
      grantId: Number(req.params.id), revokedBy: req.callingService,
    });
    res.json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// What Vvltvre Flix's concurrent-stream limit needs. The limit stays
// Flix's -- it is a product rule -- but the count lives where the
// grants do.
app.get('/api/viewers/:viewerId/active-playback', (req, res) => {
  const active = activeGrantsForViewer(store, req.params.viewerId);
  res.json({
    viewerId: req.params.viewerId,
    active: active.length,
    assetIds: active.map((g) => g.assetId),
  });
});

// audit-route-guards: open -- the playback grant IS the authorization; verifyPlaybackGrant below is the check, and it cannot be middleware because the credential names the asset it is for
app.post('/api/play', (req, res) => {
  const { credential, assetId } = req.body || {};
  const verdict = verifyPlaybackGrant(store, {
    credential, assetId: assetId === undefined ? undefined : Number(assetId),
  });
  if (!verdict.ok) return res.status(403).json({ error: verdict.reason });

  const asset = getAsset(store, verdict.assetId);
  const grant = store.grants.find((g) => g.assetId === verdict.assetId
    && g.viewerId === verdict.viewerId && !g.revokedAt);
  try {
    res.json({
      assetId: asset.id, kind: asset.kind, durationSec: asset.durationSec,
      // The signed URL expires no later than the grant does, so a
      // revoked-early grant cannot outlive itself through an address
      // already handed out. The URL is the thing that leaks.
      ...storage.playbackUrl(verdict, { expiresAt: grant ? grant.expiresAt : undefined }),
    });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VACO MEDIA listening on http://localhost:${PORT}`);
  console.log(`Transport: ${transport.describe().adapter}`);
  console.log(`Storage:   ${storage.describe().adapter}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
