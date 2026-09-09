// VVLTVRE STUDIOS -- shared, growing store object. Same pattern
// established across this ecosystem: one factory whose shape grows by
// adding new top-level array/counter fields as each module adds real
// state.

function createVultureStudiosStore() {
  return {
    projects: [],
    nextProjectId: 1,
    investments: [],
    nextInvestmentId: 1,
    revenueReports: [],
    nextRevenueReportId: 1,
  };
}

module.exports = { createVultureStudiosStore };
