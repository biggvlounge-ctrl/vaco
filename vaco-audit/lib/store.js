// VACO AUDIT -- the store.
//
// One array, append-only. No index, no rollup, no cache: everything
// else in this app is derived from `decisions` on read, so there is
// exactly one thing that can be out of date, and it cannot be.
function createAuditStore() {
  return {
    decisions: [],
    nextDecisionId: 1,
  };
}

module.exports = { createAuditStore };
