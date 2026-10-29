// VENVM -- the Marketing Dashboard and Campaign Dashboard themselves:
// real, unified rollups, closing the same kind of gap VOKEN's own
// `cardFullDetail.js` closed there -- a real brand or campaign page
// needs several separate real calls across `brandManagement.js`,
// `campaigns.js`, `adDashboard.js`, `assetLibrary.js`,
// `contentCalendar.js`, `productLaunches.js`, `abTesting.js`, and
// `marketingAnalytics.js`; collapsing them into one real call here is
// genuine reuse of already-real, already-tested functions -- nothing
// new is computed in this module, it only assembles.

const { getBrand } = require('./brandManagement');
const {
  getCampaign, listCampaignsForBrand, campaignSpendTotal, campaignRemainingBudget,
} = require('./campaigns');
const { listAdsForCampaign, adPerformance } = require('./adDashboard');
const { listAssetsForBrand, listAssetsForCampaign } = require('./assetLibrary');
const { listUpcoming } = require('./contentCalendar');
const { listLaunchesForBrand, launchReadiness } = require('./productLaunches');
const { abTestResults } = require('./abTesting');
const { analyticsSummary } = require('./marketingAnalytics');

// The real Marketing Dashboard: one brand's whole real picture --
// every active/paused/completed campaign, real total spend across all
// of them, the real asset count, real upcoming content, real launch
// readiness per launch, and real analytics -- assembled, not
// recomputed.
function getMarketingDashboard(store, options = {}) {
  const { brandId } = options;
  const brand = getBrand(store, brandId);
  if (!brand) throw new Error(`getMarketingDashboard: no brand with id ${brandId}`);

  const campaigns = listCampaignsForBrand(store, brandId);
  const totalSpend = Math.round(
    campaigns.reduce((sum, c) => sum + campaignSpendTotal(store, c.id), 0) * 100,
  ) / 100;

  return {
    brand,
    campaigns: campaigns.map((c) => ({
      ...c,
      spend: campaignSpendTotal(store, c.id),
      remainingBudget: campaignRemainingBudget(store, c.id),
    })),
    totalSpend,
    assetCount: listAssetsForBrand(store, brandId).length,
    upcomingContent: listUpcoming(store, { brandId }),
    launches: listLaunchesForBrand(store, brandId).map((l) => launchReadiness(store, l.id)),
    analytics: analyticsSummary(store, { brandId }),
  };
}

// The real Campaign Dashboard: one campaign's whole real picture --
// its real brand, real spend/remaining budget, every real ad under it
// with real performance totals, its real catalogued assets, and the
// real results of any A/B test scoped to it.
function getCampaignDashboard(store, options = {}) {
  const { campaignId } = options;
  const campaign = getCampaign(store, campaignId);
  if (!campaign) throw new Error(`getCampaignDashboard: no campaign with id ${campaignId}`);

  const ads = listAdsForCampaign(store, campaignId);
  const abTests = store.abTests
    .filter((t) => t.campaignId === campaignId)
    .map((t) => abTestResults(store, t.id));

  return {
    campaign,
    brand: getBrand(store, campaign.brandId),
    spend: campaignSpendTotal(store, campaignId),
    remainingBudget: campaignRemainingBudget(store, campaignId),
    ads: ads.map((ad) => ({ ...ad, performance: adPerformance(store, ad.id) })),
    assets: listAssetsForCampaign(store, campaignId),
    abTests,
    analytics: analyticsSummary(store, { brandId: campaign.brandId, campaignId }),
  };
}

module.exports = { getMarketingDashboard, getCampaignDashboard };
