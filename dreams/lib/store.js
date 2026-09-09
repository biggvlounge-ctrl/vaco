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
  };
}

module.exports = { createDreamsStore };
