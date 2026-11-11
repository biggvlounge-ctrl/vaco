'use strict';
function calculateScenario(input) {
  const fields = ['landCost','hardCosts','softCosts','contingency','financingCost','otherCosts','expectedRevenue','operatingCosts'];
  const values = {};
  for (const key of fields) {
    const n = input[key] === undefined ? 0 : Number(input[key]);
    if (!Number.isFinite(n) || n < 0) throw new TypeError(`${key} must be finite and non-negative`);
    values[key] = n;
  }
  const totalDevelopmentCost = ['landCost','hardCosts','softCosts','contingency','financingCost','otherCosts'].reduce((s,k)=>s+values[k],0);
  const projectedNetBeforeTax = values.expectedRevenue - totalDevelopmentCost - values.operatingCosts;
  return {
    ...values,
    totalDevelopmentCost,
    projectedNetBeforeTax,
    assumptionsOnly: true,
    disclaimer: 'Illustrative scenario only. Validate quantities, costs, financing, revenue, approvals, taxes, and schedule with qualified professionals.'
  };
}
module.exports = { calculateScenario };
