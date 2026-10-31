// DREAMS -- shared, growing store object. Same pattern established
// across this ecosystem: one factory whose shape grows by adding new
// top-level array/counter fields as each module adds real state.

function createDreamsStore() {
  return {
    screens: [],
    screenCaches: [],
    offlinePlays: [],
    nextOfflinePlayId: 1,
    nextScreenId: 1,
    advertisers: [],
    campaigns: [],
    nextCampaignId: 1,
    impressions: [],
    nextImpressionId: 1,
    scans: [],
    nextScanId: 1,
    sales: [],
    nextSaleId: 1,
    emergencyBroadcasts: [],
    nextEmergencyBroadcastId: 1,
    activeEmergencyBroadcastId: null,
    // The Dreams Wallet -- see lib/wallet.js's own header for why this
    // is deliberately separate from `scans` above.
    walletEntries: [],
    nextWalletEntryId: 1,
  };
}

module.exports = { createDreamsStore };
