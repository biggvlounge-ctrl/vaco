// Vvltvre Flix -- exclusive, subscriber-gated originals. Vvltvre's own
// division under the same real umbrella VOID MAGIC (Touring & Tix) and
// Vvltvre Music/Distribution already belong to, built specifically
// against the real, named comparable given for it: the Netflix
// Originals model, for its real exclusive-content strategy.
//
// See `lib/titles.js`'s own header for the real structural contrast
// with `../vulture-music/`: two Vvltvre divisions, two genuinely
// opposite real economic models (artist-retained-ownership + flat fee
// vs. platform-acquired-exclusivity + one-time acquisition payment),
// deliberately not reusing the same shape for both.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8807/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVultureFlixStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { createMediaClient } = require('./lib/mediaClient.cjs');
const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');
const {
  TITLE_TYPES, TITLE_STATUSES, acquireExclusiveTitle, licenseNonExclusiveTitle, registerStudioProducedTitle, getTitleRecord, listTitlesForCreator,
  markStreaming, removeTitle, getCatalog, watchTitle, getWatchHistory,
  startStream, endStream, listActiveStreams,
} = require('./lib/titles');
const {
  SUBSCRIPTION_TIERS, TIER_FEES, TIER_MAX_SIMULTANEOUS_STREAMS, MONTHLY_FEE,
  subscribe, cancelSubscription, getSubscription, isSubscriber,
} = require('./lib/subscriptions');

const app = express();

// Live media and recorded assets live in vaco-media, not here.
// **Fails soft**, which is the opposite call from the decision log
// and deliberately so: a settlement that cannot be recorded must
// not happen, but an interaction that cannot show video is
// degraded rather than broken. See shared/mediaClient.js.
const media = createMediaClient({ app: 'vulture-flix' });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8807;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vulture-flix';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVultureFlixStore);
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

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real subscription payment is never held up by VACO Analytics
// being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'vulture-flix', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

// == Authorization ======================================================
//
// **The catalog is the platform's, the viewing is the user's**, and the
// split is unusually clean here. Acquiring an exclusive title pays the
// creator an acquisition fee; licensing one pays the licensor a licence
// fee. Both move money OUT of Vvltvre Flix on terms the request body
// names, so an open route was a creator writing their own cheque:
//
//   POST /api/titles { creatorId: me, acquisitionFee: 999999 }
//
// Guarding those with `requireActor('creatorId')` would have been
// exactly backwards -- it would confirm the payee is a real logged-in
// user, which is the problem. They are the platform's decisions and
// take a service credential, as does everything else that changes what
// is in the catalog.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

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

const requireStreamOwner = () => requireRecordOwner(
  'stream session', (req) => (store.streamSessions || []).find((x) => x.id === Number(req.params.id)), (x) => x.userId,
);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vulture-flix',
    titleTypes: TITLE_TYPES,
    titleStatuses: TITLE_STATUSES,
    monthlySubscriptionFee: MONTHLY_FEE,
    subscriptionTiers: SUBSCRIPTION_TIERS,
    tierFees: TIER_FEES,
    tierMaxSimultaneousStreams: TIER_MAX_SIMULTANEOUS_STREAMS,
  });
});

app.post('/api/subscriptions', requireActor('userId'), async (req, res) => {
  try {
    const sub = await subscribe(store, { ...req.body, settleFn: settleVCoin });
    await pushMetric('subscription_revenue', TIER_FEES[sub.tier]);
    res.status(201).json(sub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/subscriptions/:userId/cancel', requireParamActor('userId'), (req, res) => {
  try {
    res.json(cancelSubscription(store, { userId: req.params.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/subscriptions/:userId', (req, res) => {
  res.json({
    userId: req.params.userId, subscription: getSubscription(store, req.params.userId), isActive: isSubscriber(store, req.params.userId),
  });
});

app.post('/api/titles', requireCallingService(), async (req, res) => {
  try {
    res.status(201).json(await acquireExclusiveTitle(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/titles/licensed', requireCallingService(), async (req, res) => {
  try {
    res.status(201).json(await licenseNonExclusiveTitle(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/titles/studio-produced', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerStudioProducedTitle(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/titles/:id', (req, res) => {
  const record = getTitleRecord(store, Number(req.params.id));
  if (!record) return res.status(404).json({ error: `no title with id ${req.params.id}` });
  res.json(record);
});

app.post('/api/titles/:id/streaming', requireCallingService(), async (req, res) => {
  try {
    const marked = markStreaming(store, Number(req.params.id));
    // Marking a title streaming is what makes it a thing viewers can
    // ask for, so that is where its media asset gets registered.
    // `registered`, not `ready`: the bytes are a separate step.
    const asset = await media.registerAsset(
      marked.id, 'video', marked.studioId ?? marked.licensorId ?? 'vulture-flix',
      { durationSec: marked.runtimeMinutes ? marked.runtimeMinutes * 60 : null },
    );
    return res.json({ ...marked, media: asset ? { assetId: asset.id, status: asset.status } : { available: false } });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/titles/:id/remove', requireCallingService(), (req, res) => {
  try {
    res.json(removeTitle(store, { ...req.body, titleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/catalog', (req, res) => {
  res.json({ catalog: getCatalog(store, { onlyStreaming: req.query.onlyStreaming === 'true' }) });
});

app.post('/api/titles/:id/watch', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(watchTitle(store, { ...req.body, titleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Concurrent-stream limits are enforced per user, so letting anyone
// start a stream as anyone would both leak the catalog and burn the
// victim's stream slots.
app.post('/api/titles/:id/stream', requireActor('userId'), async (req, res) => {
  let stream;
  try {
    // **The concurrent-stream limit is checked here, first, and stays
    // here.** It is a product rule -- which tier gets how many streams
    // -- and vaco-media holds no subscription state and makes no
    // policy. This is the order that matters: entitlement is decided
    // before a playback ticket exists, never after.
    stream = startStream(store, { ...req.body, titleId: Number(req.params.id) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const titleId = Number(req.params.id);
  const asset = await media.assetState(titleId);
  // A grant is only issued for a `ready` asset -- vaco-media refuses
  // otherwise, which is what stops the catalogue handing out addresses
  // for titles that are still processing.
  const playback = asset && asset.status === 'ready'
    ? await media.grantPlayback(asset.id, (req.body || {}).userId)
    : null;

  return res.status(201).json({
    ...stream,
    media: playback
      ? { assetId: asset.id, playbackCredential: playback.credential, playAt: '/api/play' }
      : {
        available: false,
        reason: asset
          ? `the title's media asset is "${asset.status}", not ready to play`
          : 'no media asset is registered for this title yet',
      },
  });
});

app.post('/api/streams/:id/end', requireStreamOwner(), (req, res) => {
  try {
    res.json(endStream(store, { ...req.body, sessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/:userId/active-streams', (req, res) => {
  res.json({ activeStreams: listActiveStreams(store, req.params.userId) });
});

app.get('/api/creators/:creatorId/titles', (req, res) => {
  res.json({ titles: listTitlesForCreator(store, req.params.creatorId) });
});

app.get('/api/users/:userId/watch-history', (req, res) => {
  res.json({ history: getWatchHistory(store, req.params.userId) });
});

app.listen(PORT, () => {
  console.log(`Vvltvre Flix listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
