// Vvltvre Pods -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVulturePodsStore() {
  return {
    shows: [],
    nextShowId: 1,
    episodes: [],
    nextEpisodeId: 1,
    listenEvents: [],
    nextListenEventId: 1,
    showSubscriptions: [],
    nextShowSubscriptionId: 1,
    // A separate counter from nextShowSubscriptionId -- it advances on
    // every charge attempt (a fresh subscribe AND every renewal/tier
    // switch), not just on creating a new subscription record, so it
    // can scope each charge's own settlement reason uniquely. See
    // subscribeToShow's own comment.
    nextShowSubscriptionChargeId: 1,
  };
}

module.exports = { createVulturePodsStore };
