// VEX -- the real compliance gate, extracted from VOKEN's own
// lib/complianceGate.js. Only 'vex-brokerage' comes with VEX --
// 'fractional-ownership' was VADO's own gate and correctly stays
// behind in VOKEN, which still owns fractional-ownership.
//
// Source of truth: VOKEN_ARCHITECTURE.md's original real, confirmed
// requirement -- VEX's brokerage trading is built now, its live-money
// trigger stays off until real broker-dealer legal review clears it.

const GATES = ['vex-brokerage'];

function createComplianceGateState() {
  return { 'vex-brokerage': false };
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
