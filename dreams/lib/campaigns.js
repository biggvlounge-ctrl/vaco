// DREAMS -- the real self-serve advertiser flow: sign up (see
// `advertisers.js`), pick screens, upload/generate creative, set a
// budget, go live, and real per-screen revenue on every real ad run.
//
// **The real revenue-split decision, made explicit rather than
// invented silently**: no exact DREAMS revenue-share percentage is
// given anywhere in any source doc -- `hvntz/HVNTZ_COMPLETE_REVENUE_
// STACK.md` and `HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md` both refer
// to "DREAMS' standing revenue-share model" as already established
// without stating the number, and HVNTZ's own `lib/adPricing.js`
// already flagged its base ad prices the same honest way ("no base
// price or exact formula is specified anywhere"). This module takes
// the same posture: a real, deterministic, flagged-interpretive
// 70/30 split (screen owner / platform) -- a real, common range for
// digital-out-of-home ad network deals, not a number pulled from any
// doc in this repo.

const { getScreen } = require('./screens');
const { getAdvertiser } = require('./advertisers');

const CAMPAIGN_STATUSES = ['draft', 'live', 'completed'];
const SCREEN_OWNER_SHARE = 0.7;
const DREAMS_PLATFORM_ACCOUNT = 'dreams-platform';

function round(n) {
  return Math.round(n * 100) / 100;
}

function createCampaign(store, options = {}) {
  const { advertiserId, name, now = Date.now() } = options;
  if (!getAdvertiser(store, advertiserId)) {
    throw new Error(`createCampaign: no advertiser signed up with id ${advertiserId}`);
  }
  if (!name) throw new Error('createCampaign requires a name');

  const campaign = {
    id: store.nextCampaignId++,
    advertiserId,
    name,
    screenIds: [],
    creativeUrl: null,
    creativeText: null,
    budget: null,
    remainingBudget: null,
    status: 'draft',
    createdAt: now,
    launchedAt: null,
  };
  store.campaigns.push(campaign);
  return campaign;
}

function getCampaign(store, campaignId) {
  return store.campaigns.find((c) => c.id === campaignId) || null;
}

function listCampaignsForAdvertiser(store, advertiserId) {
  return store.campaigns.filter((c) => c.advertiserId === advertiserId);
}

function requireDraft(store, campaignId, action) {
  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`${action}: no campaign with id ${campaignId}`);
  if (campaign.status !== 'draft') {
    throw new Error(`${action}: campaign ${campaignId} is "${campaign.status}", must be "draft"`);
  }
  return campaign;
}

// Real "pick locations" step -- every screenId must be a real,
// currently active registered screen.
function selectScreens(store, options = {}) {
  const { campaignId, screenIds } = options;
  const campaign = requireDraft(store, campaignId, 'selectScreens');
  if (!Array.isArray(screenIds) || screenIds.length === 0) {
    throw new Error('selectScreens requires a non-empty screenIds array');
  }
  for (const screenId of screenIds) {
    const screen = getScreen(store, screenId);
    if (!screen) throw new Error(`selectScreens: no screen with id ${screenId}`);
    if (screen.status !== 'active') throw new Error(`selectScreens: screen ${screenId} is not active`);
  }
  campaign.screenIds = screenIds;
  return campaign;
}

// Real "upload/generate creative" step -- either a real, caller-
// supplied creativeUrl (the upload path) or creativeText (either
// caller-supplied directly, or generated via `generateCreativeText`
// below). At least one is required to launch.
function setCreative(store, options = {}) {
  const { campaignId, creativeUrl = null, creativeText = null } = options;
  const campaign = requireDraft(store, campaignId, 'setCreative');
  if (!creativeUrl && !creativeText) {
    throw new Error('setCreative requires a creativeUrl, a creativeText, or both');
  }
  if (creativeUrl) campaign.creativeUrl = creativeUrl;
  if (creativeText) campaign.creativeText = creativeText;
  return campaign;
}

// Real "generate creative" path -- routed through V4/VENVM's own real
// completion pathway (an injected invokeFn, same posture as
// `venvm/lib/scriptEngine.js`'s own `generateScript`). DREAMS never
// talks to Anthropic directly. A real completion failure throws with
// the real error attached -- never a fabricated ad copy standing in
// for one that was never actually generated.
async function generateCreativeText(store, options = {}) {
  const { campaignId, brief, invokeFn } = options;
  const campaign = requireDraft(store, campaignId, 'generateCreativeText');
  if (!brief) throw new Error('generateCreativeText requires a brief');
  if (typeof invokeFn !== 'function') throw new Error('generateCreativeText requires an invokeFn(systemPrompt, messages)');

  const systemPrompt = "You are DREA, DREAMS' real ad-copy assistant for the VACO ecosystem's screen network. Given a brief, write short, direct ad copy suitable for a digital screen ad -- a hook and a clear call to action driving a QR-code scan. Keep it under 40 words. Return only the copy itself, no preamble.";
  let completion;
  try {
    completion = await invokeFn(systemPrompt, [{ role: 'user', content: `Brief: ${brief}` }]);
  } catch (err) {
    // Real, distinguishable failure class -- a completion failure
    // (no ANTHROPIC_API_KEY behind v4-proxy, v4-proxy unreachable, a
    // real upstream error) is a real 502 to the caller, not a 400
    // validation error. The "completion failed:" prefix is what
    // server.js's own route matches on to tell the two apart.
    throw new Error(`completion failed: ${err.message}`);
  }
  campaign.creativeText = completion.text || '';
  return campaign;
}

function setBudget(store, options = {}) {
  const { campaignId, budget } = options;
  const campaign = requireDraft(store, campaignId, 'setBudget');
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('setBudget requires a positive budget');
  }
  campaign.budget = round(budget);
  campaign.remainingBudget = campaign.budget;
  return campaign;
}

// Real "go live" step -- every prior step must be genuinely complete;
// no default-filling any of them.
function launchCampaign(store, options = {}) {
  const { campaignId, now = Date.now() } = options;
  const campaign = requireDraft(store, campaignId, 'launchCampaign');
  if (campaign.screenIds.length === 0) throw new Error('launchCampaign: campaign has no screens selected');
  if (!campaign.budget || campaign.budget <= 0) throw new Error('launchCampaign: campaign has no budget set');
  if (!campaign.creativeUrl && !campaign.creativeText) throw new Error('launchCampaign: campaign has no creative');

  campaign.status = 'live';
  campaign.launchedAt = now;
  return campaign;
}

// Real per-screen revenue event -- one real ad run on one real
// selected screen. A real transferFn moves the real, split payment:
// SCREEN_OWNER_SHARE to the screen's own owner, the remainder to
// DREAMS_PLATFORM_ACCOUNT -- the same two-real-transfers shape VOID's
// own `completeJob` already established, guaranteeing the two amounts
// always sum to the exact real cost, not two independently-rounded
// halves that could drift by a cent. Exhausting the campaign's real
// remaining budget auto-completes it -- no more impressions can run
// against a completed campaign.
async function recordImpression(store, options = {}) {
  const { campaignId, screenId, costPerImpression, transferFn, now = Date.now() } = options;

  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`recordImpression: no campaign with id ${campaignId}`);
  if (campaign.status !== 'live') {
    throw new Error(`recordImpression: campaign ${campaignId} is "${campaign.status}", not "live"`);
  }
  if (!campaign.screenIds.includes(screenId)) {
    throw new Error(`recordImpression: screen ${screenId} is not selected for campaign ${campaignId}`);
  }
  if (!Number.isFinite(costPerImpression) || costPerImpression <= 0) {
    throw new Error('recordImpression requires a positive costPerImpression');
  }
  if (costPerImpression > campaign.remainingBudget) {
    throw new Error(`recordImpression: costPerImpression ${costPerImpression} exceeds campaign ${campaignId}'s remaining budget ${campaign.remainingBudget}`);
  }
  if (typeof transferFn !== 'function') {
    throw new Error('recordImpression requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`recordImpression: no screen with id ${screenId}`);

  const screenOwnerPayout = round(costPerImpression * SCREEN_OWNER_SHARE);
  const platformFee = round(costPerImpression - screenOwnerPayout);

  await transferFn(campaign.advertiserId, screen.screenOwnerId, screenOwnerPayout, `dreams_impression:${campaignId}:${screenId}`);
  await transferFn(campaign.advertiserId, DREAMS_PLATFORM_ACCOUNT, platformFee, `dreams_impression_platform_fee:${campaignId}:${screenId}`);

  campaign.remainingBudget = round(campaign.remainingBudget - costPerImpression);
  if (campaign.remainingBudget <= 0) {
    campaign.status = 'completed';
  }

  const impression = {
    id: store.nextImpressionId++,
    campaignId,
    screenId,
    advertiserId: campaign.advertiserId,
    costPerImpression,
    screenOwnerPayout,
    platformFee,
    recordedAt: now,
  };
  store.impressions.push(impression);
  return impression;
}

module.exports = {
  CAMPAIGN_STATUSES,
  SCREEN_OWNER_SHARE,
  DREAMS_PLATFORM_ACCOUNT,
  createCampaign,
  getCampaign,
  listCampaignsForAdvertiser,
  selectScreens,
  setCreative,
  generateCreativeText,
  setBudget,
  launchCampaign,
  recordImpression,
};
