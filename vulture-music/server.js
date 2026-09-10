// Vvltvre Music/Distribution -- flat-fee, artist-retained-ownership
// release distribution. Vvltvre's own division under the same real
// umbrella VOID MAGIC already belongs to (`VVLTVRE -> TOURING & TIX ->
// VOID MAGIC`, per that project's own §17); this is
// `VVLTVRE -> MUSIC/DISTRIBUTION`, built against the real, named
// comparables: DistroKid and TuneCore's real flat-fee model, plus
// gamma.'s real multi-format (music/video/podcast) scope.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8806/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVultureMusicStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');
const {
  RELEASE_FORMATS, DISTRIBUTION_TARGETS, DISTRIBUTION_FEES, RELEASE_STATUSES,
  submitRelease, getRelease, listReleasesForArtist, markDistributing, markLive, takeDown, attachMusicVideo,
  reportStreamingRevenue, getArtistSummary, getCollaboratorEarnings,
} = require('./lib/releases');
const {
  DEFAULT_COMMISSION_PERCENT, signArtist, getDeal, terminateDeal, getArtistManager, getManagerRoster, getManagerSummary,
} = require('./lib/managers');
const {
  LABEL_DEAL_TYPES, DEFAULT_LABEL_SHARE_PERCENT, signLabelDeal, getLabelDeal, terminateLabelDeal,
} = require('./lib/labelDeals');
const {
  LICENSE_TYPES, BEAT_STATUSES, listBeat, getBeat, listActiveBeats, takeDownBeat,
  purchaseBeat, listPurchasesForBuyer, listSalesForProducer,
} = require('./lib/beatMarketplace');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8806;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vulture-music';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VAULT_STVDIOS_API_URL = process.env.VAULT_STVDIOS_API_URL || 'http://localhost:8808';
const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVultureMusicStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Atomic settlement: every leg moves, or none does.
//
// **A streaming revenue report pays up to three parties per co-writer**
// -- label recoupment, artist net share, manager commission -- and used
// to pay each with its own transfer while mutating as it went. A
// failure part-way left some co-writers paid and others not, recoupment
// already applied against revenue that never moved, orphan commission
// records, and no revenue report at all. The retry then recouped a
// second time against the same revenue, permanently underpaying the
// artist. See `lib/labelDeals.js`'s `computeLabelDeal`/`commitLabelDeal`
// split, which exists for exactly this.
//
// The whole report is now one settlement. `POST /api/vcoin/settle`
// validates every leg against running balances and writes nothing
// unless all of them pass. `settleVCoin` is removed rather than kept
// beside it.
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
  // **Read the text, then parse — never parse before checking ok.**
  // `await res.json()` on a failed response throws on whatever the
  // peer actually sent, and Express answers an unknown path with an
  // HTML page. The result was that every failure of this call, whatever
  // its cause, surfaced as:
  //
  //   Unexpected token '<', "<!DOCTYPE "... is not valid JSON
  //
  // which names neither the status, nor the URL, nor the real problem.
  // Found by a seeding run that could not create a release and could
  // not be told why.
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `settleVCoin: ${V3_API_URL}/api/vcoin/settle answered ${res.status} with `
      + `${res.headers.get('content-type') || 'no content-type'}, not JSON: `
      + `${text.slice(0, 200).replace(/\s+/g, ' ')}`,
    );
  }
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// Real, live cross-app call into Vavlt Stvdios' own Reel infrastructure
// -- per explicit instruction, a real music video attaches here rather
// than this project reinventing video hosting. Vavlt Stvdios' own real
// `REEL_MAX_DURATION_SECONDS` (20 minutes) applies as-is; a video
// longer than that is rejected by Vavlt Stvdios' own real validation,
// passed straight through rather than silently raised on this side.
async function postVideoToVaultStvdios({
  authorId, caption, mediaUrl, durationSeconds,
}) {
  const res = await fetch(`${VAULT_STVDIOS_API_URL}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authorId, postType: 'reel', mediaUrl, durationSeconds, caption, source: 'vulture-music',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `postVideoToVaultStvdios failed (${res.status})`);
  return body;
}

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real streaming-revenue report is never held up by VACO Analytics
// being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'vulture-music', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

// == Authorization ======================================================
//
// **A deal that takes money out of somebody else\'s earnings must not be
// creatable by the party it pays.** That is not a hypothetical here.
// Verified against a running instance before this change:
//
//   POST /api/managers/<stranger>/roster
//        { artistId: <victim>, commissionPercent: 0.9 }   -> 201
//   POST /api/releases/<id>/revenue  { amount: 1000 }     -> 201
//
//   victim  990.01 -> 1090.01   (+100)
//   stranger 1000  -> 1900      (+900)
//
// Entirely unauthenticated. `reportStreamingRevenue` looks up the
// artist\'s active management deal and hands the commission over, and
// nothing checked who created that deal. A label deal does the same
// through `applyLabelDeal`.
//
// **Neither party alone is a safe guard for these two routes**, which is
// why they are service-only rather than actor-guarded:
//
//   manager-only -> a manager claims any artist (the exploit above)
//   artist-only  -> an artist makes a label pay them an advance
//
// A two-sided contract needs an offer and an acceptance, and this app
// has no such flow. Until it does, the deal is recorded by the platform
// after both sides agreed elsewhere -- refusing everyone rather than
// accepting either. Recorded in dev-docs/ROUTE_AUTHORIZATION_AUDIT.md.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'vulture-music' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

function requireRecordOwner(label, lookup, ownerOf, param = 'id') {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params[param]}` });
    const owners = [].concat(ownerOf(record)).filter(Boolean);
    if (!owners.includes(req.sessionUserId)) {
      return res.status(403).json({ error: `only a party to this ${label} may act on it` });
    }
    return next();
  });
}

const requireReleaseArtist = () => requireRecordOwner(
  'release', (req) => getRelease(store, Number(req.params.id)), (r) => r.artistId,
);
// Either side of a deal may end it -- an artist must be able to leave a
// manager, and a manager must be able to drop an artist.
const requireDealParty = () => requireRecordOwner(
  'deal', (req) => getDeal(store, Number(req.params.id)), (d) => [d.managerId, d.artistId],
);
const requireLabelDealParty = () => requireRecordOwner(
  'label deal', (req) => getLabelDeal(store, Number(req.params.id)), (d) => [d.labelId, d.artistId],
);

app.get('/api/health', (_req, res) => {
  res.json({
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
    ok: true, service: 'vulture-music', releaseFormats: RELEASE_FORMATS, distributionTargets: DISTRIBUTION_TARGETS, distributionFees: DISTRIBUTION_FEES, releaseStatuses: RELEASE_STATUSES, defaultManagementCommissionPercent: DEFAULT_COMMISSION_PERCENT,
    labelDealTypes: LABEL_DEAL_TYPES, defaultLabelSharePercent: DEFAULT_LABEL_SHARE_PERCENT,
    beatLicenseTypes: LICENSE_TYPES, beatStatuses: BEAT_STATUSES,
  });
});

app.post('/api/releases', requireActor('artistId'), async (req, res) => {
  try {
    res.status(201).json(await submitRelease(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/releases/:id', (req, res) => {
  const release = getRelease(store, Number(req.params.id));
  if (!release) return res.status(404).json({ error: `no release with id ${req.params.id}` });
  res.json(release);
});

// Distribution pipeline state: "it reached the platforms" is the
// distributor's report, not the artist's claim. `markLive` is what
// makes a release eligible for revenue reports.
app.post('/api/releases/:id/distributing', requireOperator('vulture-music:state'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/releases/:id/distributing',
      outcomeKind: 'state-change',
      subjectType: 'release',
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
    res.json(markDistributing(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/releases/:id/live', requireOperator('vulture-music:state'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/releases/:id/live',
      outcomeKind: 'state-change',
      subjectType: 'release',
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
    res.json(markLive(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/releases/:id/take-down', requireReleaseArtist(), (req, res) => {
  try {
    res.json(takeDown(store, { ...req.body, releaseId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/releases/:id/video', requireReleaseArtist(), async (req, res) => {
  try {
    const releaseId = Number(req.params.id);
    const release = getRelease(store, releaseId);
    if (!release) return res.status(404).json({ error: `no release with id ${releaseId}` });
    const post = await postVideoToVaultStvdios({
      authorId: release.artistId, caption: req.body.caption || release.title, mediaUrl: req.body.mediaUrl, durationSeconds: req.body.durationSeconds,
    });
    res.status(201).json(attachMusicVideo(store, { releaseId, vaultStvdiosPostId: post.id }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// This is the payout. It splits gross across co-writers, applies each
// one's label deal, deducts the manager's commission, and settles the
// remainder -- so an artist who could report their own revenue could
// mint it, and anyone else could trigger a settlement at a moment of
// their choosing.
app.post('/api/releases/:id/revenue', requireOperator('vulture-music:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/releases/:id/revenue',
      outcomeKind: 'settlement',
      subjectType: 'release',
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
    const report = await reportStreamingRevenue(store, {
      ...req.body, releaseId: Number(req.params.id), settleFn: settleVCoin,
    });
    await pushMetric('streaming_revenue', req.body.amount);
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/artists/:artistId/releases', (req, res) => {
  res.json({ releases: listReleasesForArtist(store, req.params.artistId) });
});

app.get('/api/artists/:artistId/summary', (req, res) => {
  res.json(getArtistSummary(store, req.params.artistId));
});

app.get('/api/collaborators/:userId/earnings', (req, res) => {
  res.json(getCollaboratorEarnings(store, req.params.userId));
});

app.get('/api/artists/:artistId/manager', (req, res) => {
  res.json({ artistId: req.params.artistId, deal: getArtistManager(store, req.params.artistId) });
});

app.post('/api/managers/:managerId/roster', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(signArtist(store, { ...req.body, managerId: req.params.managerId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/managers/:managerId/roster', (req, res) => {
  res.json({ roster: getManagerRoster(store, req.params.managerId) });
});

app.get('/api/managers/:managerId/summary', (req, res) => {
  res.json(getManagerSummary(store, req.params.managerId));
});

app.post('/api/label-deals', requireCallingService(), async (req, res) => {
  try {
    const { releaseId, ...rest } = req.body || {};
    const release = releaseId ? getRelease(store, Number(releaseId)) : null;
    res.status(201).json(await signLabelDeal(store, { ...rest, release, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/label-deals/:id', (req, res) => {
  const deal = getLabelDeal(store, Number(req.params.id));
  if (!deal) return res.status(404).json({ error: `no label deal with id ${req.params.id}` });
  res.json(deal);
});

app.post('/api/label-deals/:id/terminate', requireLabelDealParty(), (req, res) => {
  try {
    res.json(terminateLabelDeal(store, { ...req.body, dealId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/deals/:id/terminate', requireDealParty(), (req, res) => {
  try {
    res.json(terminateDeal(store, { ...req.body, dealId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/beats', requireActor('producerId'), (req, res) => {
  try {
    res.status(201).json(listBeat(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/beats', (_req, res) => {
  res.json({ beats: listActiveBeats(store) });
});

app.get('/api/beats/:id', (req, res) => {
  const beat = getBeat(store, Number(req.params.id));
  if (!beat) return res.status(404).json({ error: `no beat with id ${req.params.id}` });
  res.json(beat);
});

// `takeDownBeat` already refuses a producerId that is not the
// listing's, so the actor check is the missing half: it stops anyone
// from *claiming* to be that producer.
app.post('/api/beats/:id/take-down', requireActor('producerId'), (req, res) => {
  try {
    res.json(takeDownBeat(store, { ...req.body, beatId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/beats/:id/purchase', requireActor('buyerId'), async (req, res) => {
  try {
    const purchase = await purchaseBeat(store, {
      ...req.body, beatId: Number(req.params.id), settleFn: settleVCoin,
    });
    await pushMetric('beat_sales_revenue', purchase.pricePaid);
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/beat-purchases/buyer/:userId', (req, res) => {
  res.json({ purchases: listPurchasesForBuyer(store, req.params.userId) });
});

app.get('/api/beat-purchases/producer/:userId', (req, res) => {
  res.json({ sales: listSalesForProducer(store, req.params.userId) });
});

app.listen(PORT, () => {
  console.log(`Vvltvre Music/Distribution listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
