// VOKEN — shared, growing store object.
// Same pattern established across this session (world-layer/venvs/
// hvntz/void): one factory whose shape grows by adding new top-level
// array/counter fields as each phase adds a module.

const { createComplianceGateState } = require('./complianceGate');

function createVokenStore() {
  return {
    cultureCards: [],
    nextCardId: 1,
    establishedCreatorAssessments: [],
    cardPackTiers: [],
    nextPackTierId: 1,
    raffles: [],
    nextRaffleId: 1,
    trades: [],
    nextTradeId: 1,
    cultureCardApplications: [],
    nextApplicationId: 1,
    cardEngagementEvents: [],
    complianceGates: createComplianceGateState(),
    auctions: [],
    nextAuctionId: 1,
    artCultureCards: [],
    galleryAccounts: [],
    nextGalleryAccountId: 1,
    fractionalListings: [],
    nextFractionalListingId: 1,
    nextFractionalLotId: 1,
    secondaryListings: [],
    nextSecondaryListingId: 1,
    limitedEditionMerch: [],
    nextMerchListingId: 1,
    digitalArtFrames: [],
    nextArtFrameId: 1,
    referrals: [],
    nextReferralId: 1,
    referralGrowth: [],
    spins: [],
    nextSpinId: 1,
  };
}

module.exports = { createVokenStore };
