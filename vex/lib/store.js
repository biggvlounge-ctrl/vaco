// VEX -- shared, growing store object. Same factory pattern used
// across this ecosystem (voken/hvntz/void/etc): one function whose
// shape grows by adding new top-level array/counter fields as needed.
// Only VEX's own domain data lives here now -- Cvltvre Card data
// stays in VOKEN, VEX calls it over HTTP (see lib/vokenClient.js).

const { createComplianceGateState } = require('./complianceGate');

function createVexStore() {
  return {
    complianceGates: createComplianceGateState(),
    brokerAccounts: [],
    nextBrokerAccountId: 1,
    tradeOrders: [],
    nextTradeOrderId: 1,
  };
}

module.exports = { createVexStore };
