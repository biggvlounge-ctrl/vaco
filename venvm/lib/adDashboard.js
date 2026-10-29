// VENVM -- Ad Dashboard: a real ad under a real campaign, with a real,
// append-only metrics log (impressions/clicks/conversions/spend) --
// the same snapshot-and-derive shape `campaigns.js` uses for spend,
// because real ad metrics arrive as periodic reports from a platform,
// not as one number that only ever increases predictably.
//
// `adPerformance` sums the real log and computes real, deterministic
// ratios (CTR, CPA, ROAS) -- plain division, no model call. Every
// ratio is honestly `null` when its real denominator is zero, the
// same fail-soft posture `cardMarketPrice.js`/`walletValue.js` already
// take elsewhere in this ecosystem, never a divide-by-zero or a
// guessed figure.
//
// `generateAdCopy` is this module's one real generative sliver (AI ad
// copy / creative generation) -- stubbed via `pendingIntegration.js`.

const { getCampaign } = require('./campaigns');
const { pendingGenerationCall } = require('./pendingIntegration');

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function createAd(store, options = {}) {
  const { campaignId, platform, assetId = null, now = Date.now() } = options;
  if (!getCampaign(store, campaignId)) throw new Error(`createAd: no campaign with id ${campaignId}`);
  requireString(platform, 'platform', 'createAd');

  const ad = {
    id: store.nextAdId++,
    campaignId,
    platform: platform.trim(),
    assetId,
    createdAt: now,
  };
  store.ads.push(ad);
  return ad;
}

function getAd(store, adId) {
  return store.ads.find((a) => a.id === adId) || null;
}

function listAdsForCampaign(store, campaignId) {
  return store.ads.filter((a) => a.campaignId === campaignId);
}

// A real metrics snapshot, as reported for some real reporting window
// -- never a running total a caller is expected to maintain
// themselves.
function recordAdMetrics(store, options = {}) {
  const {
    adId, impressions = 0, clicks = 0, conversions = 0, spend = 0, now = Date.now(),
  } = options;
  const ad = getAd(store, adId);
  if (!ad) throw new Error(`recordAdMetrics: no ad with id ${adId}`);
  for (const [field, value] of Object.entries({ impressions, clicks, conversions, spend })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`recordAdMetrics requires a non-negative ${field}`);
    }
  }
  const snapshot = { id: store.nextAdMetricId++, adId, impressions, clicks, conversions, spend, recordedAt: now };
  store.adMetrics.push(snapshot);
  return snapshot;
}

// The real Ad Dashboard figure for one ad: totals summed from every
// real snapshot on file, plus real, deterministic ratios.
function adPerformance(store, adId) {
  const ad = getAd(store, adId);
  if (!ad) throw new Error(`adPerformance: no ad with id ${adId}`);
  const snapshots = store.adMetrics.filter((m) => m.adId === adId);
  const totals = snapshots.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      conversions: acc.conversions + s.conversions,
      spend: acc.spend + s.spend,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend: 0 },
  );
  return {
    adId,
    ...totals,
    spend: Math.round(totals.spend * 100) / 100,
    ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 10000 : null,
    cpa: totals.conversions > 0 ? Math.round((totals.spend / totals.conversions) * 100) / 100 : null,
    conversionRate: totals.clicks > 0 ? Math.round((totals.conversions / totals.clicks) * 10000) / 10000 : null,
  };
}

function generateAdCopy() {
  return pendingGenerationCall('AI ad copy/creative generation');
}

module.exports = {
  createAd, getAd, listAdsForCampaign, recordAdMetrics, adPerformance, generateAdCopy,
};
