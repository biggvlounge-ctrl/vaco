// VACA -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVacaStore() {
  return {
    verifications: [],
    nextVerificationId: 1,
    // A real local blockchain: every verification decision is a block
    // cryptographically linked to the one before it. See
    // lib/blockchain.js.
    blockchainLedger: [],
  };
}

module.exports = { createVacaStore };
