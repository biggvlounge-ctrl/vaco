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
const { settleOnce } = require('./settleOnce');
const { getAdvertiser } = require('./advertisers');

const CAMPAIGN_STATUSES = ['draft', 'live', 'completed'];
const SCREEN_OWNER_SHARE = 0.7;
const DREAMS_PLATFORM_ACCOUNT = 'dreams-platform';

//: Flagged interpretive: no source doc names these three exactly --
//: "a coupon, a percent off" is the direct instruction, and "coupon"
//: is kept open-ended (a fixed-amount discount, a free item, any
//: redeemable code) rather than narrowed to percent-off alone, since
//: the same instruction's own examples already span both a
//: percentage and a generic "something."
const INCENTIVE_TYPES = ['percent-off', 'amount-off', 'coupon'];

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
    incentive: null,
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
//
// **Confirmed real, not a new build**: "as businesses grow, they can
// have the option of using as many screens that are available for
// purchase... this will encourage people to sell." There is, and was,
// no cap here -- `screenIds` accepts any number of real active
// screens, so a growing advertiser's only real limit is how many
// screens currently exist and how large a budget (`setBudget`) they
// set to actually run impressions across them.
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

// Real "give something away" step -- per direct instruction,
// "everything has to be used to give away something, a coupon, a
// percentage off, even if it's a large corporation. The whole goal is
// to get businesses and corporations to start to migrate." Required
// before launch (see `launchCampaign` below) rather than left
// optional, so a campaign can never go live as a plain, giveaway-free
// ad the instruction explicitly rules out -- no exception carved out
// for size of advertiser.
function setIncentive(store, options = {}) {
  const { campaignId, type, value = null, code = null } = options;
  const campaign = requireDraft(store, campaignId, 'setIncentive');
  if (!INCENTIVE_TYPES.includes(type)) {
    throw new Error(`setIncentive: type must be one of ${INCENTIVE_TYPES.join(', ')}`);
  }
  if (type === 'percent-off') {
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      throw new Error('setIncentive: a percent-off incentive requires a value between 0 and 100');
    }
  }
  if (type === 'amount-off') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('setIncentive: an amount-off incentive requires a positive value');
    }
  }
  if (type === 'coupon' && !code) {
    throw new Error('setIncentive: a coupon incentive requires a code');
  }
  campaign.incentive = { type, value, code };
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
  if (!campaign.incentive) {
    throw new Error('launchCampaign: campaign has no incentive -- every DREAMS ad must give something away (a coupon or a percent/amount off), even for a large corporation');
  }

  campaign.status = 'live';
  campaign.launchedAt = now;
  return campaign;
}

// Real per-screen revenue event -- one real ad run on one real
// selected screen. A real settleFn moves the real, split payment:
// SCREEN_OWNER_SHARE to the screen's own owner, the remainder to
// DREAMS_PLATFORM_ACCOUNT -- the same two-real-transfers shape VOID's
// own `completeJob` already established, guaranteeing the two amounts
// always sum to the exact real cost, not two independently-rounded
// halves that could drift by a cent. Exhausting the campaign's real
// remaining budget auto-completes it -- no more impressions can run
// against a completed campaign.
async function recordImpression(store, options = {}) {
  const { campaignId, screenId, costPerImpression, settleFn, now = Date.now() } = options;

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
  if (typeof settleFn !== 'function') {
    throw new Error('recordImpression requires a settleFn(legs, meta)');
  }

  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`recordImpression: no screen with id ${screenId}`);

  const screenOwnerPayout = round(costPerImpression * SCREEN_OWNER_SHARE);
  const platformFee = round(costPerImpression - screenOwnerPayout);

  // One settlement per impression. Both legs leave the advertiser, and
  // the impression record and spend counters below are written only
  // afterwards -- so a split could pay the screen owner, fail the
  // platform fee, and leave an impression that was served, paid for in
  // part, and recorded nowhere.
  // **The budget is spent before the money moves, not after.**
  //
  // This read `remainingBudget`, awaited the settlement, then
  // decremented. Ten concurrent impressions at 10 VCoin each against a
  // 10 VCoin budget all passed the check, all settled, and all charged:
  // **100 VCoin moved on a 10 VCoin cap, leaving remainingBudget at
  // -90**. An advertiser who set a cap got billed ten times it.
  //
  // Claiming the reduced budget first means the second impression sees
  // 0 remaining and is refused by the ordinary check above.
  //
  // **The impression id is reserved here, before settlement, and
  // folded into the reason -- not assigned afterward.** The reason
  // doubles as V3's idempotency key (see server.js's settleVCoin), and
  // used to be scoped only by campaignId:screenId. A live campaign
  // runs many impressions against the same screen by design, so every
  // impression after the first with the same costPerImpression
  // fingerprinted identically to it: V3 replayed the first
  // settlement's cached success without moving any new money, while
  // this function still committed the budget decrement and wrote a
  // normal-looking impression record with a real payout figure -- the
  // screen owner and platform were silently stiffed from the second
  // same-cost impression onward. (A differently-priced impression hit
  // the opposite failure: a genuinely fresh request refused by V3 as a
  // key collision.) Scoping by this impression's own id makes every
  // impression's key unique by construction.
  const impressionId = store.nextImpressionId++;
  const remainingAfter = round(campaign.remainingBudget - costPerImpression);
  await settleOnce(campaign, { remainingBudget: remainingAfter }, async () => {
      await settleFn([
      { fromUserId: campaign.advertiserId, toUserId: screen.screenOwnerId, amount: screenOwnerPayout, reason: `dreams_impression:${campaignId}:${screenId}:${impressionId}` },
      { fromUserId: campaign.advertiserId, toUserId: DREAMS_PLATFORM_ACCOUNT, amount: platformFee, reason: `dreams_impression_platform_fee:${campaignId}:${screenId}:${impressionId}` },
    ], { reason: `dreams_impression:${campaignId}:${screenId}:${impressionId}` });
  });

  if (campaign.remainingBudget <= 0) {
    campaign.status = 'completed';
  }

  const impression = {
    id: impressionId,
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
  INCENTIVE_TYPES,
  createCampaign,
  getCampaign,
  listCampaignsForAdvertiser,
  selectScreens,
  setCreative,
  generateCreativeText,
  setBudget,
  setIncentive,
  launchCampaign,
  recordImpression,
};
