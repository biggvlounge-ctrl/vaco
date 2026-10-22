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
    // `growthPrograms.js` -- referral codes keyed by the code itself
    // (a real lookup table, not an array scan, since every click on a
    // referral link resolves one), referrals as a real list.
    referralCodes: {},
    nextReferralCodeSuffix: 1,
    referrals: [],
    nextReferralId: 1,
  };
}

module.exports = { createVenvmStore };
