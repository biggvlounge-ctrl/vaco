// VEX -- shared, growing store object. Same factory pattern used
// across this ecosystem (voken/hvntz/void/etc): one function whose
// shape grows by adding new top-level array/counter fields as needed.
// Only VEX's own domain data lives here now -- Cvltvre Card data
// stays in VOKEN, VEX calls it over HTTP (see lib/vokenClient.js).

const { createComplianceGateState } = require('./complianceGate');
const { INITIAL_COIN_RESERVE, INITIAL_VCOIN_RESERVE } = require('./coinMarket');

function createVexStore() {
  return {
    complianceGates: createComplianceGateState(),
    brokerAccounts: [],
    nextBrokerAccountId: 1,
    tradeOrders: [],
    nextTradeOrderId: 1,
    // VXC's constant-product liquidity pool and per-user holdings --
    // see lib/coinMarket.js's own header for why this is a pool, not a
    // priced-by-fame market like VOKEN's cards.
    coinMarket: { coinReserve: INITIAL_COIN_RESERVE, vcoinReserve: INITIAL_VCOIN_RESERVE },
    coinHoldings: {},
    coinOrders: [],
    nextCoinOrderId: 1,
  };
}

module.exports = { createVexStore };
