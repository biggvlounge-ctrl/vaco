// VENVM -- the ecosystem's AI production/marketing tool. Real,
// standalone extraction of the one real shared system this
// ecosystem's own status audit confirmed was 0% built -- checked
// directly (grep across the whole repo), not assumed: no VENVM
// directory, route, or line of implementation existed anywhere before
// this. See lib/scriptEngine.js's own header for the full honest
// account of what source material does and doesn't exist for VENVM.
//
// Real scope, deliberately bounded: a real script-generation request
// (routed through V4/VACON's own real completion pathway -- VENVM
// never talks to Anthropic directly), real cross-platform reformatting
// math, and a real production pipeline status machine. Actual video
// rendering is a real, honest, flagged gap -- no rendering
// infrastructure exists in this environment, same class of gap as
// Vavlt Stvdios' own `streamUrl`.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8813/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createVenvmStore } = require('./lib/store');
const { attachStore } = require('./lib/storeBackend');
const {
  SCRIPT_STATUSES, submitScriptRequest, getScriptRequest, generateScript,
} = require('./lib/scriptEngine');
const { PLATFORM_SPECS, reformatForPlatforms } = require('./lib/crossPlatformReformat');
const {
  CONSENT_SCOPES, recordConsent, revokeConsent, listConsents, ConsentError,
} = require('./lib/likenessConsent');
const {
  PRODUCTION_STAGES, createProductionJob, getProductionJob, advanceToStoryboard, queueRender, markRendered,
} = require('./lib/productionPipeline');

const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware, traceHeaders } = require('./lib/tracing.cjs');const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Mounted before the auth middleware on purpose: a request that
// serviceAuth *refuses* still gets a trace id, and a 401 you cannot
// correlate is exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8813;
const V4_PROXY_URL = process.env.V4_PROXY_URL || 'http://localhost:8787';

// This app's own service identity, presented to V4 the same way it
// is presented to V3. Empty by default so a dev machine with no
// tokens configured still boots; `serviceAuth` in enforce mode is
// what makes it required, not this line.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'venvm';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
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
let store = createVenvmStore();
attachStore(app, {
  appKey: 'venvm',
  createDefault: createVenvmStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// `requireCallingService()` on this app's operator and telemetry routes
// is only meaningful with serviceAuth establishing who the caller is.
// It also puts a floor under everything else: no route here has a
// legitimate anonymous caller.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Real, live call into V4's own interface layer -- the exact same
// pattern vacon/server.js's own invokeViaV4Proxy already established.
// VENVM only ever supplies a real systemPrompt + the caller's real
// messages; V4 (v4-proxy) is the only thing holding the Anthropic key.
async function invokeViaV4Proxy(systemPrompt, messages, req) {
  const res = await fetch(`${V4_PROXY_URL}/api/agent`, {
    method: 'POST',
    // V4 now requires a principal on this route: a signed-in person or
    // a named internal service. This caller is the latter, and the
    // same credential it already presents to V3 identifies it here.
    headers: {
      'Content-Type': 'application/json',
      ...(VACO_SERVICE_TOKEN
        ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
        : {}),
      // Same trace as the request that caused this call, so the two
      // halves of one agent invocation line up in a log.
      ...traceHeaders(req),
    },
    body: JSON.stringify({ system: systemPrompt, messages }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `invokeViaV4Proxy failed (${res.status})`);
  return body;
}

const {
  requireActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');

// -- Authorization ------------------------------------------------------
//
// VENVM is an AI production pipeline: apps submit briefs, it returns
// scripts and rendered video. Its principals are the **requesting app**
// (`requesterApp`, a service, not a person) and the **likeness
// subject** (a person, whose consent gates whether a job may run at
// all).
//
// So the pipeline routes are service surfaces -- there is no user whose
// session owns "render this job" -- while the consent routes are the
// opposite: only the subject may grant consent over their own likeness,
// and only the subject may revoke it. That asymmetry is the point.
// `enforceLikenessConsent` already throws rather than warns; this makes
// the record it checks equally hard to forge.
function requireConsentSubject() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const consent = (store.likenessConsents || []).find((c) => c.id === Number(req.params.id));
    if (!consent) return res.status(404).json({ error: `no consent with id ${req.params.id}` });
    if (consent.subjectId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the subject of this likeness consent may revoke it' });
    }
    return next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'venvm',
    scriptStatuses: SCRIPT_STATUSES,
    productionStages: PRODUCTION_STAGES,
    platforms: Object.keys(PLATFORM_SPECS),
  });
});

app.post('/api/scripts', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(submitScriptRequest(store, req.body || {}));
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

app.get('/api/scripts/:id', (req, res) => {
  const request = getScriptRequest(store, Number(req.params.id));
  if (!request) return res.status(404).json({ error: `no script request with id ${req.params.id}` });
  res.json(request);
});

app.post('/api/scripts/:id/generate', requireCallingService(), async (req, res) => {
  try {
    const result = await generateScript(store, { requestId: Number(req.params.id), invokeFn: (sp, msgs) => invokeViaV4Proxy(sp, msgs, req) });
    // A real completion failure (no API key behind v4-proxy, upstream
    // error, etc.) is a real, honest 502 -- not silently 200'd.
    if (result.status === 'failed') return res.status(502).json(result);
    res.json(result);
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

// A pure transform: takes a script and a target platform, returns the
// reformatted text. Reads and writes nothing.
app.post('/api/reformat', requireSession(), (req, res) => {
  try {
    res.json({ reformats: reformatForPlatforms(req.body || {}) });
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

app.post('/api/production-jobs', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createProductionJob(store, req.body || {}));
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

app.get('/api/production-jobs/:id', (req, res) => {
  const job = getProductionJob(store, Number(req.params.id));
  if (!job) return res.status(404).json({ error: `no production job with id ${req.params.id}` });
  res.json(job);
});

app.post('/api/production-jobs/:id/storyboard', requireCallingService(), (req, res) => {
  try {
    res.json(advanceToStoryboard(store, { ...req.body, jobId: Number(req.params.id) }));
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

app.post('/api/production-jobs/:id/queue-render', requireCallingService(), (req, res) => {
  try {
    res.json(queueRender(store, { jobId: Number(req.params.id) }));
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

app.post('/api/production-jobs/:id/mark-rendered', requireCallingService(), (req, res) => {
  try {
    res.json(markRendered(store, { ...req.body, jobId: Number(req.params.id) }));
  } catch (err) {
    res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message });
  }
});

// -- Likeness consent. A hard gate, not a warning: every
// production-job route above re-checks it, so no generation depicting
// a real person is reachable without an unrevoked, unexpired,
// scope-matching record on file.

app.get('/api/consent-scopes', (_req, res) => res.json({ scopes: CONSENT_SCOPES }));

app.get('/api/likeness-consents', (req, res) => {
  res.json({ consents: listConsents(store, { subjectId: req.query.subjectId }) });
});

// **Only the subject may consent to their own likeness.** An open
// route here would make the whole consent mechanism decorative: anyone
// could record a consent naming anyone, and `enforceLikenessConsent`
// would then correctly find it and correctly let the job run.
app.post('/api/likeness-consents', requireActor('subjectId'), (req, res) => {
  try { res.status(201).json(recordConsent(store, req.body || {})); }
  catch (err) { res.status(err instanceof ConsentError ? 422 : 400).json({ error: err.message }); }
});

// Revocation takes effect immediately on every job not yet rendered.
app.post('/api/likeness-consents/:id/revoke', requireConsentSubject(), (req, res) => {
  try { res.json(revokeConsent(store, { consentId: Number(req.params.id), ...(req.body || {}) })); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`VENVM listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
