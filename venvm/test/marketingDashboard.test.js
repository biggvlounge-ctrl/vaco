// The Marketing Dashboard and Campaign Dashboard themselves -- real
// rollups assembled from already-real, already-tested modules. The
// failure this file exists to catch: one piece (an unbudgeted
// campaign, a brand with no assets yet) throwing and taking down the
// whole real page with it.

const test = require('node:test');
const assert = require('node:assert');

const { createBrand } = require('../lib/brandManagement');
const { createCampaign, recordSpend, updateCampaignStatus } = require('../lib/campaigns');
const { catalogAsset } = require('../lib/assetLibrary');
const { createAd, recordAdMetrics } = require('../lib/adDashboard');
const { scheduleContent } = require('../lib/contentCalendar');
const { createLaunch } = require('../lib/productLaunches');
const { createAbTest, assignVariant, recordConversion } = require('../lib/abTesting');
const { recordAnalyticsEvent } = require('../lib/marketingAnalytics');
const { getMarketingDashboard, getCampaignDashboard } = require('../lib/marketingDashboard');
const { createVenvmStore } = require('../lib/store');

test('getMarketingDashboard refuses an unknown brand', () => {
  const store = createVenvmStore();
  assert.throws(() => getMarketingDashboard(store, { brandId: 999999 }), /no brand with id/);
});

test('a brand new brand still returns a full, real dashboard -- every list honestly empty, not an error', () => {
  const store = createVenvmStore();
  const brand = createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
  const dashboard = getMarketingDashboard(store, { brandId: brand.id });
  assert.strictEqual(dashboard.brand.id, brand.id);
  assert.deepEqual(dashboard.campaigns, []);
  assert.strictEqual(dashboard.totalSpend, 0);
  assert.strictEqual(dashboard.assetCount, 0);
  assert.deepEqual(dashboard.upcomingContent, []);
  assert.deepEqual(dashboard.launches, []);
  assert.strictEqual(dashboard.analytics.totalEvents, 0);
});

test('getMarketingDashboard sums real spend across every real campaign under the brand', () => {
  const store = createVenvmStore();
  const brand = createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
  const c1 = createCampaign(store, { brandId: brand.id, name: 'A', budget: 100 });
  const c2 = createCampaign(store, { brandId: brand.id, name: 'B' });
  recordSpend(store, { campaignId: c1.id, amount: 30 });
  recordSpend(store, { campaignId: c2.id, amount: 20 });
  catalogAsset(store, { brandId: brand.id, assetType: 'video' });
  scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: Date.now() + 1000 });
  createLaunch(store, { brandId: brand.id, productName: 'X', milestones: ['A'] });
  recordAnalyticsEvent(store, { brandId: brand.id, eventType: 'view' });

  const dashboard = getMarketingDashboard(store, { brandId: brand.id });
  assert.strictEqual(dashboard.totalSpend, 50);
  assert.strictEqual(dashboard.campaigns.length, 2);
  assert.strictEqual(dashboard.campaigns.find((c) => c.id === c1.id).spend, 30);
  assert.strictEqual(dashboard.campaigns.find((c) => c.id === c1.id).remainingBudget, 70);
  assert.strictEqual(dashboard.assetCount, 1);
  assert.strictEqual(dashboard.upcomingContent.length, 1);
  assert.strictEqual(dashboard.launches.length, 1);
  assert.strictEqual(dashboard.analytics.totalEvents, 1);
});

test('getCampaignDashboard refuses an unknown campaign', () => {
  const store = createVenvmStore();
  assert.throws(() => getCampaignDashboard(store, { campaignId: 999999 }), /no campaign with id/);
});

test('getCampaignDashboard assembles real ads with real performance, real assets, and real A/B test results', () => {
  const store = createVenvmStore();
  const brand = createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
  const campaign = createCampaign(store, { brandId: brand.id, name: 'Launch', budget: 500 });
  updateCampaignStatus(store, { campaignId: campaign.id, status: 'active' });
  recordSpend(store, { campaignId: campaign.id, amount: 40 });
  const ad = createAd(store, { campaignId: campaign.id, platform: 'tiktok' });
  recordAdMetrics(store, { adId: ad.id, impressions: 100, clicks: 10, conversions: 1, spend: 5 });
  catalogAsset(store, { brandId: brand.id, campaignId: campaign.id, assetType: 'video' });
  const abTest = createAbTest(store, { campaignId: campaign.id, name: 'Headline', variants: [{ key: 'a' }, { key: 'b' }] });
  const variantKey = assignVariant(store, { testId: abTest.id, subjectId: 'sam' });
  recordConversion(store, { testId: abTest.id, subjectId: 'sam' });

  const dashboard = getCampaignDashboard(store, { campaignId: campaign.id });
  assert.strictEqual(dashboard.campaign.id, campaign.id);
  assert.strictEqual(dashboard.brand.id, brand.id);
  assert.strictEqual(dashboard.spend, 40);
  assert.strictEqual(dashboard.remainingBudget, 460);
  assert.strictEqual(dashboard.ads.length, 1);
  assert.strictEqual(dashboard.ads[0].performance.clicks, 10);
  assert.strictEqual(dashboard.assets.length, 1);
  assert.strictEqual(dashboard.abTests.length, 1);
  assert.strictEqual(dashboard.abTests[0].variants.find((v) => v.key === variantKey).converted, 1);
});
