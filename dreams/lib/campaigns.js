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
    costPerScan: null,
    saleCommissionRate: null,
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

// Real "pay per scan" opt-in -- per founder's own follow-up on VOID
// DROP's screens: "we will run our ads... plus the renter's personal
// ads, [and the renter] will receive a small percentage of scans and
// sales on the screens." A scan is a stronger engagement signal than a
// plain impression (someone actually acted on the ad), so it is priced
// and set separately rather than folded into costPerImpression --
// optional, same as the rest of a campaign's setup, and `recordScan`
// below refuses to run until this is set.
function setScanPricing(store, options = {}) {
  const { campaignId, costPerScan } = options;
  const campaign = requireDraft(store, campaignId, 'setScanPricing');
  if (!Number.isFinite(costPerScan) || costPerScan <= 0) {
    throw new Error('setScanPricing requires a positive costPerScan');
  }
  campaign.costPerScan = round(costPerScan);
  return campaign;
}

// Real "pay a commission on a sale the screen drove" opt-in -- the
// other half of the same founder instruction. Unlike an impression or
// a scan, a sale has its own real dollar value, so this is priced as a
// percentage of that value (a real referral-commission shape) rather
// than a flat per-event cost. **Flagged interpretive**: no source doc
// anywhere states an exact number for "a small percentage" -- callers
// choose the rate; nothing here defaults or caps it beyond being a
// genuine percentage.
function setSaleCommission(store, options = {}) {
  const { campaignId, saleCommissionRate } = options;
  const campaign = requireDraft(store, campaignId, 'setSaleCommission');
  if (!Number.isFinite(saleCommissionRate) || saleCommissionRate <= 0 || saleCommissionRate > 1) {
    throw new Error('setSaleCommission requires a saleCommissionRate between 0 (exclusive) and 1 (inclusive)');
  }
  campaign.saleCommissionRate = saleCommissionRate;
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

// Real per-screen scan event -- same shape as `recordImpression`
// (same real settlement split, same budget-decrement-before-settle and
// per-event-id idempotency fix, for the same reasons documented on that
// function above), charged at the campaign's own `costPerScan` rather
// than a caller-supplied figure, since a scan's price is something the
// advertiser agreed to up front via `setScanPricing`, not something a
// caller can set on the fly.
async function recordScan(store, options = {}) {
  const { campaignId, screenId, settleFn, now = Date.now() } = options;

  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`recordScan: no campaign with id ${campaignId}`);
  if (campaign.status !== 'live') {
    throw new Error(`recordScan: campaign ${campaignId} is "${campaign.status}", not "live"`);
  }
  if (!campaign.screenIds.includes(screenId)) {
    throw new Error(`recordScan: screen ${screenId} is not selected for campaign ${campaignId}`);
  }
  if (!Number.isFinite(campaign.costPerScan) || campaign.costPerScan <= 0) {
    throw new Error(`recordScan: campaign ${campaignId} has no costPerScan set -- call setScanPricing first`);
  }
  if (campaign.costPerScan > campaign.remainingBudget) {
    throw new Error(`recordScan: costPerScan ${campaign.costPerScan} exceeds campaign ${campaignId}'s remaining budget ${campaign.remainingBudget}`);
  }
  if (typeof settleFn !== 'function') {
    throw new Error('recordScan requires a settleFn(legs, meta)');
  }

  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`recordScan: no screen with id ${screenId}`);

  const screenOwnerPayout = round(campaign.costPerScan * SCREEN_OWNER_SHARE);
  const platformFee = round(campaign.costPerScan - screenOwnerPayout);

  const scanId = store.nextScanId++;
  const remainingAfter = round(campaign.remainingBudget - campaign.costPerScan);
  await settleOnce(campaign, { remainingBudget: remainingAfter }, async () => {
    await settleFn([
      { fromUserId: campaign.advertiserId, toUserId: screen.screenOwnerId, amount: screenOwnerPayout, reason: `dreams_scan:${campaignId}:${screenId}:${scanId}` },
      { fromUserId: campaign.advertiserId, toUserId: DREAMS_PLATFORM_ACCOUNT, amount: platformFee, reason: `dreams_scan_platform_fee:${campaignId}:${screenId}:${scanId}` },
    ], { reason: `dreams_scan:${campaignId}:${screenId}:${scanId}` });
  });

  if (campaign.remainingBudget <= 0) {
    campaign.status = 'completed';
  }

  const scan = {
    id: scanId, campaignId, screenId, advertiserId: campaign.advertiserId,
    costPerScan: campaign.costPerScan, screenOwnerPayout, platformFee, recordedAt: now,
  };
  store.scans.push(scan);
  return scan;
}

// Real per-screen sale event -- a confirmed, real-dollar conversion the
// screen drove, commissioned as a percentage of the sale's own value
// rather than metered against the campaign's ad-spend budget: a
// performance payment on money the advertiser actually made is a
// different thing from money they spend to be seen, and capping it at
// an ad budget set before any sale happened would make no sense. Not
// run through `settleOnce`/a capacity claim for the same reason --
// there is no campaign-level capacity field a sale draws down; it
// carries the same per-event-id idempotency-key shape `recordImpression`
// and `recordScan` use, and inherits the same known limitation they
// already carry: a genuine retry of the exact same real-world event is
// not deduplicated, only overspend past a cap is guarded against.
async function recordSale(store, options = {}) {
  const { campaignId, screenId, saleAmount, settleFn, now = Date.now() } = options;

  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`recordSale: no campaign with id ${campaignId}`);
  if (campaign.status !== 'live') {
    throw new Error(`recordSale: campaign ${campaignId} is "${campaign.status}", not "live"`);
  }
  if (!campaign.screenIds.includes(screenId)) {
    throw new Error(`recordSale: screen ${screenId} is not selected for campaign ${campaignId}`);
  }
  if (!Number.isFinite(campaign.saleCommissionRate) || campaign.saleCommissionRate <= 0) {
    throw new Error(`recordSale: campaign ${campaignId} has no saleCommissionRate set -- call setSaleCommission first`);
  }
  if (!Number.isFinite(saleAmount) || saleAmount <= 0) {
    throw new Error('recordSale requires a positive saleAmount');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('recordSale requires a settleFn(legs, meta)');
  }

  const screen = getScreen(store, screenId);
  if (!screen) throw new Error(`recordSale: no screen with id ${screenId}`);

  const commission = round(saleAmount * campaign.saleCommissionRate);
  const screenOwnerPayout = round(commission * SCREEN_OWNER_SHARE);
  const platformFee = round(commission - screenOwnerPayout);
  const saleId = store.nextSaleId++;

  await settleFn([
    { fromUserId: campaign.advertiserId, toUserId: screen.screenOwnerId, amount: screenOwnerPayout, reason: `dreams_sale:${campaignId}:${screenId}:${saleId}` },
    { fromUserId: campaign.advertiserId, toUserId: DREAMS_PLATFORM_ACCOUNT, amount: platformFee, reason: `dreams_sale_platform_fee:${campaignId}:${screenId}:${saleId}` },
  ], { reason: `dreams_sale:${campaignId}:${screenId}:${saleId}` });

  const sale = {
    id: saleId, campaignId, screenId, advertiserId: campaign.advertiserId,
    saleAmount: round(saleAmount), commission, screenOwnerPayout, platformFee, recordedAt: now,
  };
  store.sales.push(sale);
  return sale;
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
  setScanPricing,
  setSaleCommission,
  recordScan,
  recordSale,
};
