// Vvltvre Flix -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVultureFlixStore() {
  return {
    titles: [],
    nextTitleId: 1,
    watchEvents: [],
    nextWatchEventId: 1,
    subscriptions: [],
    // Advances on every charge attempt (a fresh subscribe AND every
    // renewal/tier switch), separate from a subscription's own
    // identity, so it can scope each charge's own settlement reason
    // uniquely. See subscribe's own comment in lib/subscriptions.js.
    nextSubscriptionChargeId: 1,
    streamSessions: [],
    nextStreamSessionId: 1,
  };
}

module.exports = { createVultureFlixStore };
