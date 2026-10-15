// Vaco Assistant — the store factory.
//
// One factory whose shape grows by adding top-level array/counter
// fields as each module arrives. Every app in this ecosystem uses this
// pattern, and `lib/persistence.js` depends on it: it proxies whatever
// this returns, so the store must be a plain object built here rather
// than assembled across files.
//
// This is the exact shape `vaco-shell/lib/store.js` held before the
// personal assistant was extracted into its own app -- same fields,
// same names, so a store written by the old code reads identically
// here.

function createVacoAssistantStore() {
  return {
    assistantProfiles: [],
    assistantMessages: [],
    nextAssistantMessageId: 1,
  };
}

module.exports = { createVacoAssistantStore };
