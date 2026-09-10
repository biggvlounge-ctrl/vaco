// VVLTVRE STUDIOS -- the real production-financing arm. `VVLTVRE ->
// STUDIOS`, the same real umbrella VOID MAGIC, Vvltvre Music/
// Distribution, Vvltvre Flix, and Vvltvre Pods already belong to.
// Confirmed genuinely new by direct grep across the whole repo before
// this build: no "Vvltvre Studios" concept existed anywhere, under
// any name, in any source doc.
//
// Real, deliberate scope: greenlight a project, raise real financing
// from investors in exchange for real proportional equity, move it
// through a real production pipeline, distribute a completed film/TV
// project into Vvltvre Flix via a real cross-app call (a new, honest
// third acquisition path there -- no fabricated second fee on top of
// real financing already paid), and pay real, proportional profit
// participation back to every investor as the completed project earns
// real revenue.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8815/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createVultureStudiosStore } = require('./lib/store');
const { createPersistentStore, durable } = require('./lib/persistence');
const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');
const {
  PROJECT_MEDIUMS, PROJECT_STATUSES, VULTURE_STUDIOS_PRODUCTION_ACCOUNT, greenlightProject, getProject, listProjects,
  investInProject, getProjectEquity, getInvestorCoWriterSplits, startProduction, completeProject,
  recordDistribution, reportProjectRevenue,
} = require('./lib/projects');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8815;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vulture-studios';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VULTURE_FLIX_API_URL = process.env.VULTURE_FLIX_API_URL || 'http://localhost:8807';
const VULTURE_MUSIC_API_URL = process.env.VULTURE_MUSIC_API_URL || 'http://localhost:8806';
const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVultureStudiosStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Atomic settlement: every leg moves, or none does.
//
// **Every multi-party payment in this app used to be consecutive
// transfers.** The second leg can fail on its own -- often precisely
// because the first just drew down the account it pays from -- and the
// record that would mark the work done is written afterwards. So a
// partial failure left one party paid, another not, and a retry that
// paid the first one again.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass. `settleVCoin` is
// removed rather than kept beside it: a working single-transfer helper
// is what the next money path gets written with, and consecutive calls
// to it are the defect.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names what is being
      // settled, so it doubles as the idempotency key: a retried
      // settlement replays V3's first answer rather than paying
      // twice. Atomicity stops a *partial* settlement; this stops
      // a *duplicate* one.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// Real, live cross-app call into Vvltvre Flix's own new, honest third
// acquisition path -- registers the completed, studio-financed
// project as a real Flix title with no fabricated second fee (the
// real payment already happened as production financing, tracked
// entirely in this app's own ledger).
// Real, distinguishable failure class -- a connection failure (Vvltvre
// Flix unreachable) throws Node's own generic "fetch failed", which a
// naive substring check on the function name would never match (the
// same real bug DREAMS' generate-creative route hit and fixed earlier
// this session). Wrapped and rethrown with a reliable
// "distribution call failed:" prefix instead, so the route below can
// tell a real upstream/connectivity failure (502) apart from a real
// validation error (400) reliably.
async function registerWithVultureFlix(studioProjectId, title, type) {
  try {
    const res = await fetch(`${VULTURE_FLIX_API_URL}/api/titles/studio-produced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studioId: 'vulture-studios', studioProjectId, title, type,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `failed (${res.status})`);
    return body;
  } catch (err) {
    throw new Error(`distribution call failed: ${err.message}`);
  }
}

// Real, live cross-app hand-off for music/podcast projects -- the
// genuinely different real path this session's own honest scope
// review confirmed still open (film/tv already had its own real
// Vvltvre Flix hookup). Deliberately does NOT reinvent proportional
// investor payouts: Vvltvre Music's own `submitRelease` already has a
// real, already-tested, exact co-writer-split mechanism
// (`coWriters`), so this project's real investors are handed off
// directly as that release's own co-writers (`getInvestorCoWriterSplits`
// in `lib/projects.js`) -- the moment real streaming revenue is later
// reported THERE, Vvltvre Music pays every investor directly and
// proportionally on its own, no separate call back into this app
// required for that medium (see `reportProjectRevenue`'s own new
// guard against double-accounting for a project distributed this
// way). `VULTURE_STUDIOS_PRODUCTION_ACCOUNT` -- the same real account
// every investor's financing already sits in -- is the real payer of
// Vvltvre Music's own flat, TuneCore-style distribution fee, the same
// real-world shape as a label paying to distribute a record it
// financed. `format`/`targetPlatforms` are a real, deliberate,
// flagged simplification: this project's own schema carries no
// release-format or platform-list granularity of its own, so `music`
// maps to Vvltvre Music's real `single` format and `podcast` to its
// real, already-standalone `podcast-episode` format (that format's
// own header comment already describes it as "a standalone item...
// with no concept of a running series" -- the exact shape of a
// one-off Vvltvre Studios project, so no Vvltvre Pods Show/Episode
// wrapper is fabricated here to carry metadata this project's own
// schema doesn't have).
async function registerWithVultureMusic(project) {
  const coWriters = getInvestorCoWriterSplits(store, project.id);
  try {
    const res = await fetch(`${VULTURE_MUSIC_API_URL}/api/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artistId: VULTURE_STUDIOS_PRODUCTION_ACCOUNT,
        title: project.title,
        format: project.medium === 'podcast' ? 'podcast-episode' : 'single',
        targetPlatforms: project.medium === 'podcast' ? ['Spotify'] : ['Spotify', 'Apple Music'],
        coWriters,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `failed (${res.status})`);
    return body;
  } catch (err) {
    throw new Error(`distribution call failed: ${err.message}`);
  }
}

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real investment or revenue report is never held up by VACO
// Analytics being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'vulture-studios', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

// == Authorization ======================================================
//
// **A financing app, so the payout route is the one that matters.**
// `reportProjectRevenue` distributes to every investor by equity share
// and to the co-writers -- an open route let anyone trigger a
// distribution at a moment of their choosing, and `greenlightProject`
// let anyone create the project it distributes from.
//
// Notably, `greenlightProject` names no owner at all: the studio
// greenlights, investors buy in afterwards. There is no session that
// could own it, which is the signature of an operator surface.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'vulture-studios' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

app.get('/api/health', (_req, res) => {
  res.json({
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
    ok: true, service: 'vulture-studios', projectMediums: PROJECT_MEDIUMS, projectStatuses: PROJECT_STATUSES,
  });
});

app.post('/api/projects', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(greenlightProject(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/projects', (req, res) => {
  res.json({ projects: listProjects(store, req.query) });
});

app.get('/api/projects/:id', (req, res) => {
  const project = getProject(store, Number(req.params.id));
  if (!project) return res.status(404).json({ error: `no project with id ${req.params.id}` });
  res.json(project);
});

app.get('/api/projects/:id/equity', (req, res) => {
  try {
    res.json(getProjectEquity(store, Number(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/projects/:id/invest', requireActor('investorId'), async (req, res) => {
  try {
    const result = await investInProject(store, {
      ...req.body, projectId: Number(req.params.id), settleFn: settleVCoin,
    });
    await pushMetric('project_financing_raised', result.investment.amount);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects/:id/start-production', requireOperator('vulture-studios:state'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/projects/:id/start-production',
      outcomeKind: 'state-change',
      subjectType: 'project',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(startProduction(store, { projectId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects/:id/complete', requireOperator('vulture-studios:state'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/projects/:id/complete',
      outcomeKind: 'state-change',
      subjectType: 'project',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(completeProject(store, { ...req.body, projectId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real distribution hand-off, now wired for every medium this app
// supports. film/tv routes into Vvltvre Flix's own new
// studio-produced-title path; music/podcast routes into Vvltvre
// Music's own already-real release/co-writer-payout economics (see
// `registerWithVultureMusic` above) -- previously deferred entirely,
// closed in this phase per direct instruction. Real, explicit
// status check added here (previously missing): a real cross-app call
// must never fire for a project that isn't actually `completed` yet --
// `recordDistribution` below already re-checks this on its own side,
// but that check ran AFTER the external call, which could have
// already created a real title/release for an unfinished project.
app.post('/api/projects/:id/distribute', requireOperator('vulture-studios:state'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/projects/:id/distribute',
      outcomeKind: 'state-change',
      subjectType: 'project',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const projectId = Number(req.params.id);
  try {
    const project = getProject(store, projectId);
    if (!project) return res.status(404).json({ error: `no project with id ${projectId}` });
    if (project.status !== 'completed') {
      return res.status(400).json({ error: `distribute: project ${projectId} is "${project.status}", must be "completed"` });
    }

    if (project.medium === 'film' || project.medium === 'tv') {
      const flixTitle = await registerWithVultureFlix(projectId, project.title, project.medium === 'tv' ? 'series' : 'film');
      const updated = recordDistribution(store, {
        projectId, distributionApp: 'vulture-flix', distributionTitleId: flixTitle.id,
      });
      return res.json({ project: updated, vultureFlixTitle: flixTitle });
    }

    if (project.medium === 'music' || project.medium === 'podcast') {
      const release = await registerWithVultureMusic(project);
      const updated = recordDistribution(store, {
        projectId, distributionApp: 'vulture-music', distributionTitleId: release.id,
      });
      return res.json({ project: updated, vultureMusicRelease: release });
    }

    return res.status(400).json({ error: `distribute: unsupported medium "${project.medium}"` });
  } catch (err) {
    res.status(err.message.startsWith('distribution call failed:') ? 502 : 400).json({ error: err.message });
  }
});

// The distribution itself. An investor who could call this could not
// steal, but could force a payout on their own timing -- and anyone at
// all could, which is worse.
app.post('/api/projects/:id/revenue', requireOperator('vulture-studios:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/projects/:id/revenue',
      outcomeKind: 'settlement',
      subjectType: 'project',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    const report = await reportProjectRevenue(store, {
      ...req.body, projectId: Number(req.params.id), settleFn: settleVCoin,
    });
    await pushMetric('project_revenue_distributed', report.amount);
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Vvltvre Studios listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
