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
    streamSessions: [],
    nextStreamSessionId: 1,
  };
}

module.exports = { createVultureFlixStore };
