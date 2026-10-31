// VEX -- the real compliance gate, extracted from VOKEN's own
// lib/complianceGate.js. Only 'vex-brokerage' comes with VEX --
// 'fractional-ownership' was VADO's own gate and correctly stays
// behind in VOKEN, which still owns fractional-ownership.
//
// Source of truth: VOKEN_ARCHITECTURE.md's original real, confirmed
// requirement -- VEX's brokerage trading is built now, its live-money
// trigger stays off until real broker-dealer legal review clears it.
//
// 'vex-coin-trading' is a second, separate gate for VXC (see
// lib/coinMarket.js) -- deliberately not folded into 'vex-brokerage'.
// Trading a platform-native digital coin against VCoin is a different
// regulatory question (money transmission / virtual-asset posture)
// from brokering real Cvltvre Card editions (securities/broker-dealer
// posture); clearing one must never silently clear the other.

const GATES = ['vex-brokerage', 'vex-coin-trading'];

function createComplianceGateState() {
  return { 'vex-brokerage': false, 'vex-coin-trading': false };
}

function isComplianceCleared(store, gateName) {
  if (!GATES.includes(gateName)) {
    throw new Error(`isComplianceCleared: invalid gateName "${gateName}" (expected one of ${GATES.join(', ')})`);
  }
  return store.complianceGates[gateName];
}

// A real admin action -- fires only after actual broker-dealer
// registration/legal work clears, not as a routine toggle.
function setComplianceStatus(store, gateName, cleared) {
  if (!GATES.includes(gateName)) {
    throw new Error(`setComplianceStatus: invalid gateName "${gateName}" (expected one of ${GATES.join(', ')})`);
  }
  if (typeof cleared !== 'boolean') {
    throw new Error('setComplianceStatus requires a boolean cleared');
  }
  store.complianceGates[gateName] = cleared;
  return { gateName, cleared };
}

module.exports = { GATES, createComplianceGateState, isComplianceCleared, setComplianceStatus };
