// DREAMS -- the ecosystem's ad/screen network. Real, standalone
// extraction of a system referenced extensively by name across HVNTZ,
// VOID MAGIC, VENVS, Vavlt Stvdios, and VOKEN's own agent roster, but
// confirmed by direct grep across the whole repo to have never
// actually existed anywhere before this -- no directory, route, or
// line of implementation.
//
// Real, deliberate first-phase scope, per direct instruction: screen
// registration, the self-serve advertiser flow (sign up, pick
// screens, upload/generate creative, set budget, go live), and real
// per-screen revenue tracking feeding into VACO Analytics the same
// way vago/chopz-shop/vulture-music already do. DREA's full
// contextual-placement/competitor-exclusion intelligence
// (`HVNTZ_COMPLETE_REVENUE_STACK.md`'s own extensive spec for it) is
// real, later work -- flagged honestly in this app's own README, not
// built here.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8814/api/health

const {
  syncScreenCache, getScreenCache, resolveOfflineContent, recordOfflinePlay, getOfflinePlays,
} = require('./lib/offlineCache');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createDreamsStore } = require('./lib/store');
const { attachStore } = require('./lib/storeBackend');
const {
  SCREEN_STATUSES, registerScreen, getScreen, listActiveScreens, deactivateScreen, getScreenRevenue,
} = require('./lib/screens');
const { signUpAdvertiser, getAdvertiser } = require('./lib/advertisers');
const {
  CAMPAIGN_STATUSES, createCampaign, getCampaign, listCampaignsForAdvertiser,
  selectScreens, setCreative, generateCreativeText, setBudget, launchCampaign, recordImpression,
} = require('./lib/campaigns');

const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware, traceHeaders } = require('./lib/tracing.cjs');const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Mounted before the auth middleware on purpose: a request that
// serviceAuth *refuses* still gets a trace id, and a 401 you cannot
// correlate is exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8814;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'dreams';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const V4_PROXY_URL = process.env.V4_PROXY_URL || 'http://localhost:8787';
const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';
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
let store = createDreamsStore();
attachStore(app, {
  appKey: 'dreams',
  createDefault: createDreamsStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// `requireCallingService()` on this app's operator and telemetry routes
// is only meaningful with serviceAuth establishing who the caller is.
// It also puts a floor under everything else: no route here has a
// legitimate anonymous caller.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

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

// Real, live call into V4's own interface layer -- same pattern
// vacon/server.js and venvm/server.js already established. DREAMS
// only ever supplies a real systemPrompt + the caller's real
// messages; v4-proxy is the only thing holding the Anthropic key.
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

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real ad impression is never held up by VACO Analytics being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'dreams', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

const {
  requireActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');

// -- Authorization ------------------------------------------------------
//
// DREAMS has two kinds of principal and they are not interchangeable:
// an **advertiser**, who owns campaigns and pays for impressions, and a
// **screen owner**, who owns physical screens and gets paid. Every
// route belongs to exactly one of them.
//
// The two that are neither belong to the screen hardware itself:
// recording an impression and reporting offline plays are what causes
// money to move, and they are reported by the player software, not by a
// person. An advertiser who could post impressions against their own
// campaign could drain their own budget into a screen they control; a
// screen owner who could post them could invoice for plays that never
// happened. Both stay service-credential-only.
function requireCampaignAdvertiser() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const campaign = getCampaign(store, Number(req.params.id));
    if (!campaign) return res.status(404).json({ error: `no campaign with id ${req.params.id}` });
    if (campaign.advertiserId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the advertiser who owns this campaign may change it' });
    }
    return next();
  });
}

function requireScreenOwner() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const screen = getScreen(store, Number(req.params.id));
    if (!screen) return res.status(404).json({ error: `no screen with id ${req.params.id}` });
    if (screen.screenOwnerId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the owner of this screen may act on it' });
    }
    return next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'dreams', screenStatuses: SCREEN_STATUSES, campaignStatuses: CAMPAIGN_STATUSES,
  });
});

app.post('/api/screens', requireActor('screenOwnerId'), (req, res) => {
  try {
    res.status(201).json(registerScreen(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/screens', (_req, res) => {
  res.json({ screens: listActiveScreens(store) });
});

app.get('/api/screens/:id', (req, res) => {
  const screen = getScreen(store, Number(req.params.id));
  if (!screen) return res.status(404).json({ error: `no screen with id ${req.params.id}` });
  res.json(screen);
});

app.post('/api/screens/:id/deactivate', requireScreenOwner(), async (req, res) => {
  try {
    const screen = deactivateScreen(store, { ...req.body, screenId: Number(req.params.id) });
    // A dark screen earns its owner nothing and serves no campaign. It
    // is the one DREAMS event with a person on the other end of it.
    await notify(
      `Screen ${screen.id} went offline`,
      `"${screen.locationName}" is no longer serving. Its owner stops earning until it returns.`,
      { screenId: screen.id, screenOwnerId: screen.screenOwnerId, locationName: screen.locationName },
    );
    res.json(screen);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/screens/:id/revenue', (req, res) => {
  res.json(getScreenRevenue(store, Number(req.params.id)));
});

app.post('/api/advertisers', requireActor('advertiserId'), (req, res) => {
  try {
    res.status(201).json(signUpAdvertiser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/advertisers/:id', (req, res) => {
  const advertiser = getAdvertiser(store, req.params.id);
  if (!advertiser) return res.status(404).json({ error: `no advertiser with id ${req.params.id}` });
  res.json(advertiser);
});

app.post('/api/campaigns', requireActor('advertiserId'), (req, res) => {
  try {
    res.status(201).json(createCampaign(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/campaigns/:id', (req, res) => {
  const campaign = getCampaign(store, Number(req.params.id));
  if (!campaign) return res.status(404).json({ error: `no campaign with id ${req.params.id}` });
  res.json(campaign);
});

app.get('/api/advertisers/:id/campaigns', (req, res) => {
  res.json({ campaigns: listCampaignsForAdvertiser(store, req.params.id) });
});

app.post('/api/campaigns/:id/screens', requireCampaignAdvertiser(), (req, res) => {
  try {
    res.json(selectScreens(store, { ...req.body, campaignId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/creative', requireCampaignAdvertiser(), (req, res) => {
  try {
    res.json(setCreative(store, { ...req.body, campaignId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/generate-creative', requireCampaignAdvertiser(), async (req, res) => {
  try {
    res.json(await generateCreativeText(store, {
      ...req.body, campaignId: Number(req.params.id),
      invokeFn: (sp, msgs) => invokeViaV4Proxy(sp, msgs, req),
    }));
  } catch (err) {
    res.status(err.message.startsWith('completion failed:') ? 502 : 400).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/budget', requireCampaignAdvertiser(), (req, res) => {
  try {
    res.json(setBudget(store, { ...req.body, campaignId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/launch', requireCampaignAdvertiser(), (req, res) => {
  try {
    res.json(launchCampaign(store, { campaignId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Alert delivery -----------------------------------------------------
//
// `vaco-notify` (8818) is the one channel. DREAMS raises two things a
// person actually needs to know about, and until now both were recorded
// locally and delivered nowhere.
//
// **These fail soft, deliberately — unlike VSAFE's.** VSAFE's escalation
// reports its own delivery failure in the response, because the whole
// product promise is that somebody finds out. An exhausted ad budget is
// not that: it is an `alert`, and holding up a real impression because
// a webhook is slow would be the wrong trade. Same posture as
// `pushMetric` below.
//
// Severity is `alert`, never `critical`. Critical is reserved for
// safety, and a pager that fires for ad budgets gets muted — after
// which the real one is missed too.
const VACO_NOTIFY_URL = process.env.VACO_NOTIFY_URL || 'http://localhost:8818';

async function notify(title, body, context) {
  try {
    await fetch(`${VACO_NOTIFY_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'dreams', severity: 'alert', title, body, context }),
    });
  } catch {
    // Honest no-op. vaco-notify records its own undelivered count; a
    // DREAMS impression is not the place to surface a channel outage.
  }
}

app.post('/api/campaigns/:id/impression', requireCallingService(), async (req, res) => {
  try {
    const impression = await recordImpression(store, {
      ...req.body, campaignId: Number(req.params.id), settleFn: settleVCoin,
    });
    await pushMetric('screen_revenue', impression.screenOwnerPayout);

    // recordImpression flips a campaign to 'completed' the moment its
    // remaining budget hits zero. That is the instant an advertiser's
    // campaign stopped running, and nobody was told until now.
    const campaign = getCampaign(store, Number(req.params.id));
    if (campaign && campaign.status === 'completed') {
      await notify(
        `Campaign ${campaign.id} has exhausted its budget`,
        `"${campaign.name}" stopped serving. Budget ${campaign.budget} is spent `
        + `across ${campaign.screenIds.length} screen(s).`,
        {
          campaignId: campaign.id,
          advertiserId: campaign.advertiserId,
          budget: campaign.budget,
          screenIds: campaign.screenIds,
        },
      );
    }
    res.status(201).json(impression);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Offline content cache (QVAN_SECURITY_RESILIENCE_SCOPE.md's own
// DREAMS-specific fallback requirement): connectivity loss now has
// real, defined behavior instead of a blank screen.
app.post('/api/screens/:id/cache/sync', requireScreenOwner(), (req, res) => {
  try { res.status(201).json(syncScreenCache(store, { ...req.body, screenId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/screens/:id/cache', (req, res) => {
  const cache = getScreenCache(store, Number(req.params.id));
  if (!cache) return res.status(404).json({ error: `no cache for screen ${req.params.id}` });
  res.json(cache);
});

app.get('/api/screens/:id/offline-content', (req, res) => {
  try { res.json(resolveOfflineContent(store, { screenId: Number(req.params.id) })); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/screens/:id/offline-plays', requireCallingService(), (req, res) => {
  try { res.status(201).json(recordOfflinePlay(store, { ...req.body, screenId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/offline-plays', (req, res) => {
  const { screenId, campaignId } = req.query;
  res.json({ plays: getOfflinePlays(store, {
    screenId: screenId ? Number(screenId) : undefined, campaignId,
  }) });
});

app.listen(PORT, () => {
  console.log(`DREAMS listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
