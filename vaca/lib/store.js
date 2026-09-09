// VACA -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVacaStore() {
  return {
    verifications: [],
    nextVerificationId: 1,
  };
}

module.exports = { createVacaStore };
