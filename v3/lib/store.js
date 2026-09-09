// V3 -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// module adds real state. Real persistence now wraps this in
// `server.js` (`lib/persistence.js`) -- this factory itself stays a
// plain in-memory default, since it's also the fresh-start shape used
// on first boot and the shallow-merge default for older persisted
// files missing a newly-added field.

function createV3Store() {
  return {
    idempotencyRecords: [],
    vcoinBalances: {}, // userId -> number
    vashBalances: {}, // userId -> number
    transactions: [],
    nextTransactionId: 1,
  };
}

module.exports = { createV3Store };
