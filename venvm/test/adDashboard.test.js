// Ad Dashboard -- real ads under a real campaign, a real append-only
// metrics log, and real, deterministic performance ratios.

const test = require('node:test');
const assert = require('node:assert');

const { createBrand } = require('../lib/brandManagement');
const { createCampaign } = require('../lib/campaigns');
const {
  createAd, getAd, listAdsForCampaign, recordAdMetrics, adPerformance, generateAdCopy,
} = require('../lib/adDashboard');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

function mkCampaign(store) {
  const brand = createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
  return createCampaign(store, { brandId: brand.id, name: 'Launch' });
}

test('createAd refuses an unknown campaign', () => {
  const store = createVenvmStore();
  assert.throws(() => createAd(store, { campaignId: 999999, platform: 'tiktok' }), /no campaign with id/);
});

test('createAd creates a real, retrievable ad', () => {
  const store = createVenvmStore();
  const campaign = mkCampaign(store);
  const ad = createAd(store, { campaignId: campaign.id, platform: 'tiktok' });
  assert.strictEqual(getAd(store, ad.id).platform, 'tiktok');
  assert.strictEqual(listAdsForCampaign(store, campaign.id).length, 1);
});

test('recordAdMetrics refuses a negative figure', () => {
  const store = createVenvmStore();
  const campaign = mkCampaign(store);
  const ad = createAd(store, { campaignId: campaign.id, platform: 'tiktok' });
  assert.throws(() => recordAdMetrics(store, { adId: ad.id, clicks: -1 }), /non-negative clicks/);
});

test('adPerformance sums real snapshots and computes real, deterministic ratios', () => {
  const store = createVenvmStore();
  const campaign = mkCampaign(store);
  const ad = createAd(store, { campaignId: campaign.id, platform: 'tiktok' });
  recordAdMetrics(store, { adId: ad.id, impressions: 1000, clicks: 50, conversions: 5, spend: 25 });
  recordAdMetrics(store, { adId: ad.id, impressions: 1000, clicks: 50, conversions: 5, spend: 25 });

  const perf = adPerformance(store, ad.id);
  assert.strictEqual(perf.impressions, 2000);
  assert.strictEqual(perf.clicks, 100);
  assert.strictEqual(perf.conversions, 10);
  assert.strictEqual(perf.spend, 50);
  assert.strictEqual(perf.ctr, 0.05);
  assert.strictEqual(perf.cpa, 5);
  assert.strictEqual(perf.conversionRate, 0.1);
});

test('adPerformance is honestly null for every ratio when its real denominator is zero', () => {
  const store = createVenvmStore();
  const campaign = mkCampaign(store);
  const ad = createAd(store, { campaignId: campaign.id, platform: 'tiktok' });
  const perf = adPerformance(store, ad.id);
  assert.strictEqual(perf.ctr, null);
  assert.strictEqual(perf.cpa, null);
  assert.strictEqual(perf.conversionRate, null);
});

test('generateAdCopy is an honest, labeled pending integration point', () => {
  assert.throws(() => generateAdCopy(), PendingIntegrationError);
});
