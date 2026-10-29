// VENVM -- shared, growing store object. Same pattern established
// across this ecosystem: one factory whose shape grows by adding new
// top-level array/counter fields as each module adds real state.

function createVenvmStore() {
  return {
    scriptRequests: [],
    nextScriptRequestId: 1,
    productionJobs: [],
    likenessConsents: [],
    nextConsentId: 1,
    nextProductionJobId: 1,
    // `growthPrograms.js` -- referral codes keyed by the code itself
    // (a real lookup table, not an array scan, since every click on a
    // referral link resolves one), referrals as a real list.
    referralCodes: {},
    nextReferralCodeSuffix: 1,
    referrals: [],
    nextReferralId: 1,
    // Task #59 -- Marketing/Campaign dashboard scaffolding
    // (`brandManagement.js`, `assetLibrary.js`, `campaigns.js`,
    // `adDashboard.js`, `contentCalendar.js`, `productLaunches.js`,
    // `abTesting.js`, `marketingAnalytics.js`): the real,
    // non-generative data model and analytics pieces behind the
    // Marketing Dashboard, Campaign Dashboard, Ad Dashboard, Brand
    // Management, Product Launch Manager, Content Calendar, Asset
    // Library, AI Analytics, and AI A/B Testing.
    brands: [],
    nextBrandId: 1,
    marketingAssets: [],
    nextAssetId: 1,
    campaigns: [],
    nextCampaignId: 1,
    campaignSpend: [],
    nextCampaignSpendId: 1,
    ads: [],
    nextAdId: 1,
    adMetrics: [],
    nextAdMetricId: 1,
    contentCalendarEntries: [],
    nextContentCalendarEntryId: 1,
    productLaunches: [],
    nextProductLaunchId: 1,
    abTests: [],
    nextAbTestId: 1,
    marketingAnalyticsEvents: [],
    nextMarketingAnalyticsEventId: 1,
  };
}

module.exports = { createVenvmStore };
