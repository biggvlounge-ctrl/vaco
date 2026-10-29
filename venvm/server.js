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
  REFERRAL_STATUSES, AMBASSADOR_TIERS, GROWTH_MISSIONS,
  createReferralCode, getReferralCode, recordReferral, getReferral,
  convertReferral, rewardReferral, ambassadorScorecard, checkMissionProgress,
} = require('./lib/growthPrograms');
const {
  PRODUCTION_STAGES, createProductionJob, getProductionJob, advanceToStoryboard, queueRender, markRendered,
} = require('./lib/productionPipeline');
const {
  createBrand, getBrand, listBrands, updateBrandGuidelines, generateBrandVoiceGuidelines,
} = require('./lib/brandManagement');
const {
  catalogAsset, getAsset, listAssetsForBrand, listAssetsForCampaign, recordAssetReuse,
} = require('./lib/assetLibrary');
const {
  CAMPAIGN_STATUSES, createCampaign, getCampaign, listCampaignsForBrand, updateCampaignStatus,
  recordSpend, campaignRemainingBudget, generateCampaignOptimization,
} = require('./lib/campaigns');
const {
  createAd, getAd, listAdsForCampaign, recordAdMetrics, adPerformance, generateAdCopy,
} = require('./lib/adDashboard');
const {
  CONTENT_CALENDAR_STATUSES, scheduleContent, getContentCalendarEntry, markPublished,
  cancelScheduledContent, listUpcoming, suggestContentSlots,
} = require('./lib/contentCalendar');
const {
  createLaunch, getLaunch, listLaunchesForBrand, completeMilestone, launchReadiness, generateLaunchCopy,
} = require('./lib/productLaunches');
const {
  createAbTest, getAbTest, assignVariant, recordConversion, abTestResults, generateVariantCopy,
} = require('./lib/abTesting');
const { recordAnalyticsEvent, analyticsSummary, generateInsights } = require('./lib/marketingAnalytics');
const { getMarketingDashboard, getCampaignDashboard } = require('./lib/marketingDashboard');
const { PendingIntegrationError } = require('./lib/pendingIntegration');

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
    referralStatuses: REFERRAL_STATUSES,
    ambassadorTiers: AMBASSADOR_TIERS,
    growthMissions: Object.keys(GROWTH_MISSIONS),
    campaignStatuses: CAMPAIGN_STATUSES,
    contentCalendarStatuses: CONTENT_CALENDAR_STATUSES,
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

// --- Growth Programs: referrals, growth missions, ambassador tiers,
// and the KPI scorecard (added per a direct batch instruction naming
// a "Zeely AI inspired growth system") -- see `growthPrograms.js`'s
// own header for what this builds and what it deliberately does not
// (no AI recommendations/campaign optimization -- no model provider
// configured; no real payout yet -- VENVM does not sync
// `shared/settleOnce.js`).
//
// An ambassador creates their own code (`requireActor('ambassadorId')`,
// the same real-person-owns-their-own-thing shape `likeness-consents`
// already uses); recording a referral is the new recruit's own real
// claim at signup time, so it is gated the same way. Converting and
// rewarding a referral are operational facts an app observed (a real
// purchase, a real published video), never the ambassador's or the
// recruit's own call to make about themselves -- `requireCallingService()`.
app.post('/api/growth/referral-codes', requireActor('ambassadorId'), (req, res) => {
  try { res.status(201).json(createReferralCode(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/growth/referral-codes/:code', (req, res) => {
  const entry = getReferralCode(store, req.params.code);
  if (!entry) return res.status(404).json({ error: `no referral code "${req.params.code}"` });
  res.json(entry);
});

app.post('/api/growth/referrals', requireActor('referredId'), (req, res) => {
  try { res.status(201).json(recordReferral(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/growth/referrals/:id', (req, res) => {
  const referral = getReferral(store, Number(req.params.id));
  if (!referral) return res.status(404).json({ error: `no referral with id ${req.params.id}` });
  res.json(referral);
});

app.post('/api/growth/referrals/:id/convert', requireCallingService(), (req, res) => {
  try { res.json(convertReferral(store, { referralId: Number(req.params.id), ...(req.body || {}) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/growth/referrals/:id/reward', requireCallingService(), (req, res) => {
  try { res.json(rewardReferral(store, { referralId: Number(req.params.id), ...(req.body || {}) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/growth/ambassadors/:ambassadorId/scorecard', (req, res) => {
  res.json(ambassadorScorecard(store, req.params.ambassadorId));
});

app.get('/api/growth/ambassadors/:ambassadorId/missions/:missionKey', (req, res) => {
  try {
    res.json(checkMissionProgress(store, { ambassadorId: req.params.ambassadorId, missionKey: req.params.missionKey }));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Marketing/Campaign dashboard scaffolding (task #59) -----------
//
// Brand Management, Asset Library, Campaign Dashboard, Ad Dashboard,
// Content Calendar, Product Launch Manager, AI A/B Testing, and AI
// Analytics -- see each lib module's own header for what is real
// here (the data model and every analytics/tracking computation) and
// what is a clearly-labeled pending integration point (every
// generation call: ad copy, brand voice, launch copy, variant
// creative, analytics insights, content-slot suggestions -- see
// `lib/pendingIntegration.js`).
//
// This is internal marketing tooling, the same "apps submit briefs"
// shape the rest of this server already uses for the production
// pipeline -- there is no end-consumer session that owns a brand or a
// campaign, so mutations are gated the same way script/production-job
// submission already is: `requireCallingService()`.
function sendPendingIntegration(res, err) {
  if (err instanceof PendingIntegrationError) return res.status(501).json({ error: err.message });
  return res.status(400).json({ error: err.message });
}

// Brand Management
app.post('/api/marketing/brands', requireCallingService(), (req, res) => {
  try { res.status(201).json(createBrand(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/brands', (req, res) => {
  res.json({ brands: listBrands(store, { ownerApp: req.query.ownerApp }) });
});

app.get('/api/marketing/brands/:id', (req, res) => {
  const brand = getBrand(store, Number(req.params.id));
  if (!brand) return res.status(404).json({ error: `no brand with id ${req.params.id}` });
  res.json(brand);
});

app.post('/api/marketing/brands/:id/guidelines', requireCallingService(), (req, res) => {
  try { res.json(updateBrandGuidelines(store, { ...req.body, brandId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/marketing/brands/:id/voice-guidelines/generate', requireCallingService(), (_req, res) => {
  try { res.json(generateBrandVoiceGuidelines()); }
  catch (err) { sendPendingIntegration(res, err); }
});

// Asset Library
app.post('/api/marketing/assets', requireCallingService(), (req, res) => {
  try { res.status(201).json(catalogAsset(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/assets/:id', (req, res) => {
  const asset = getAsset(store, Number(req.params.id));
  if (!asset) return res.status(404).json({ error: `no asset with id ${req.params.id}` });
  res.json(asset);
});

app.get('/api/marketing/brands/:id/assets', (req, res) => {
  res.json({ assets: listAssetsForBrand(store, Number(req.params.id)) });
});

app.post('/api/marketing/assets/:id/reuse', requireCallingService(), (req, res) => {
  try { res.json(recordAssetReuse(store, { ...req.body, assetId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

// Campaign Dashboard
app.post('/api/marketing/campaigns', requireCallingService(), (req, res) => {
  try { res.status(201).json(createCampaign(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/campaigns/:id', (req, res) => {
  const campaign = getCampaign(store, Number(req.params.id));
  if (!campaign) return res.status(404).json({ error: `no campaign with id ${req.params.id}` });
  res.json(campaign);
});

app.get('/api/marketing/brands/:id/campaigns', (req, res) => {
  res.json({ campaigns: listCampaignsForBrand(store, Number(req.params.id)) });
});

app.post('/api/marketing/campaigns/:id/status', requireCallingService(), (req, res) => {
  try { res.json(updateCampaignStatus(store, { ...req.body, campaignId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/marketing/campaigns/:id/spend', requireCallingService(), (req, res) => {
  try { res.status(201).json(recordSpend(store, { ...req.body, campaignId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/campaigns/:id/budget', (req, res) => {
  try { res.json({ campaignId: Number(req.params.id), remainingBudget: campaignRemainingBudget(store, Number(req.params.id)) }); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/marketing/campaigns/:id/optimize/generate', requireCallingService(), (_req, res) => {
  try { res.json(generateCampaignOptimization()); }
  catch (err) { sendPendingIntegration(res, err); }
});

app.get('/api/marketing/campaigns/:id/dashboard', (req, res) => {
  try { res.json(getCampaignDashboard(store, { campaignId: Number(req.params.id) })); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.get('/api/marketing/brands/:id/dashboard', (req, res) => {
  try { res.json(getMarketingDashboard(store, { brandId: Number(req.params.id) })); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

// Ad Dashboard
app.post('/api/marketing/ads', requireCallingService(), (req, res) => {
  try { res.status(201).json(createAd(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/campaigns/:id/ads', (req, res) => {
  res.json({ ads: listAdsForCampaign(store, Number(req.params.id)) });
});

app.post('/api/marketing/ads/:id/metrics', requireCallingService(), (req, res) => {
  try { res.status(201).json(recordAdMetrics(store, { ...req.body, adId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/ads/:id/performance', (req, res) => {
  try { res.json(adPerformance(store, Number(req.params.id))); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/marketing/ads/:id/copy/generate', requireCallingService(), (_req, res) => {
  try { res.json(generateAdCopy()); }
  catch (err) { sendPendingIntegration(res, err); }
});

// Content Calendar
app.post('/api/marketing/content-calendar', requireCallingService(), (req, res) => {
  try { res.status(201).json(scheduleContent(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/content-calendar/:id', (req, res) => {
  const entry = getContentCalendarEntry(store, Number(req.params.id));
  if (!entry) return res.status(404).json({ error: `no content calendar entry with id ${req.params.id}` });
  res.json(entry);
});

app.get('/api/marketing/brands/:id/content-calendar/upcoming', (req, res) => {
  res.json({ upcoming: listUpcoming(store, { brandId: Number(req.params.id), fromTime: req.query.fromTime ? Number(req.query.fromTime) : undefined }) });
});

app.post('/api/marketing/content-calendar/:id/publish', requireCallingService(), (req, res) => {
  try { res.json(markPublished(store, { ...req.body, entryId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/marketing/content-calendar/:id/cancel', requireCallingService(), (req, res) => {
  try { res.json(cancelScheduledContent(store, { entryId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/marketing/content-calendar/suggest-slots/generate', requireCallingService(), (_req, res) => {
  try { res.json(suggestContentSlots()); }
  catch (err) { sendPendingIntegration(res, err); }
});

// Product Launch Manager
app.post('/api/marketing/launches', requireCallingService(), (req, res) => {
  try { res.status(201).json(createLaunch(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/launches/:id', (req, res) => {
  const launch = getLaunch(store, Number(req.params.id));
  if (!launch) return res.status(404).json({ error: `no launch with id ${req.params.id}` });
  res.json(launch);
});

app.get('/api/marketing/brands/:id/launches', (req, res) => {
  res.json({ launches: listLaunchesForBrand(store, Number(req.params.id)) });
});

app.post('/api/marketing/launches/:id/milestones/:index/complete', requireCallingService(), (req, res) => {
  try { res.json(completeMilestone(store, { launchId: Number(req.params.id), milestoneIndex: Number(req.params.index) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/launches/:id/readiness', (req, res) => {
  try { res.json(launchReadiness(store, Number(req.params.id))); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/marketing/launches/:id/copy/generate', requireCallingService(), (_req, res) => {
  try { res.json(generateLaunchCopy()); }
  catch (err) { sendPendingIntegration(res, err); }
});

// AI A/B Testing (real assignment + results math; generation stubbed)
app.post('/api/marketing/ab-tests', requireCallingService(), (req, res) => {
  try { res.status(201).json(createAbTest(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/ab-tests/:id', (req, res) => {
  const test = getAbTest(store, Number(req.params.id));
  if (!test) return res.status(404).json({ error: `no A/B test with id ${req.params.id}` });
  res.json(test);
});

app.post('/api/marketing/ab-tests/:id/assign', requireCallingService(), (req, res) => {
  try { res.json({ variantKey: assignVariant(store, { ...req.body, testId: Number(req.params.id) }) }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/marketing/ab-tests/:id/convert', requireCallingService(), (req, res) => {
  try { res.json(recordConversion(store, { ...req.body, testId: Number(req.params.id) })); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/ab-tests/:id/results', (req, res) => {
  try { res.json(abTestResults(store, Number(req.params.id), { minSampleSize: req.query.minSampleSize ? Number(req.query.minSampleSize) : undefined })); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/marketing/ab-tests/:id/variant-copy/generate', requireCallingService(), (_req, res) => {
  try { res.json(generateVariantCopy()); }
  catch (err) { sendPendingIntegration(res, err); }
});

// AI Analytics (real event tracking + aggregation; insight generation stubbed)
app.post('/api/marketing/analytics/events', requireCallingService(), (req, res) => {
  try { res.status(201).json(recordAnalyticsEvent(store, req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/marketing/brands/:id/analytics/summary', (req, res) => {
  try {
    res.json(analyticsSummary(store, {
      brandId: Number(req.params.id),
      campaignId: req.query.campaignId ? Number(req.query.campaignId) : null,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/marketing/analytics/insights/generate', requireCallingService(), (_req, res) => {
  try { res.json(generateInsights()); }
  catch (err) { sendPendingIntegration(res, err); }
});

app.listen(PORT, () => {
  console.log(`VENVM listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
