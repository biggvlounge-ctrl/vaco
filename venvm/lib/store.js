// VENVM -- shared, growing store object. Same pattern established
// across this ecosystem: one factory whose shape grows by adding new
// top-level array/counter fields as each module adds real state.

function createVenvmStore() {
  return {
    scriptRequests: [],
    nextScriptRequestId: 1,
    productionJobs: [],
    likenessConsents: [],
    nextConsentId: 1,
    nextProductionJobId: 1,
  };
}

module.exports = { createVenvmStore };
