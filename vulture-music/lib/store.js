// Vvltvre Music/Distribution -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVultureMusicStore() {
  return {
    releases: [],
    nextReleaseId: 1,
    revenueReports: [],
    nextRevenueReportId: 1,
    managementDeals: [],
    nextDealId: 1,
    commissionPayouts: [],
    nextCommissionPayoutId: 1,
    labelDeals: [],
    nextLabelDealId: 1,
    beats: [],
    nextBeatId: 1,
    beatPurchases: [],
    nextBeatPurchaseId: 1,
  };
}

module.exports = { createVultureMusicStore };
