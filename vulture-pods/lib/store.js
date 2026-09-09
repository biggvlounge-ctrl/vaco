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
  };
}

module.exports = { createVulturePodsStore };
