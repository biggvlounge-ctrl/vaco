// VOKEN — the real compliance gate.
// Source of truth: VOKEN_ARCHITECTURE.md: "Fractional ownership (VOKEN
// + VADO) ... should be built with a compliance gate/feature flag,
// since it's on hold pending real legal review -- the code path is
// worth building now, the live-money trigger should stay off until
// cleared." VEX's own `'vex-brokerage'` gate moved out with the rest
// of VEX's brokerage logic when it was extracted into its own
// standalone app (dev-docs/phase-16-vex-extracted-to-standalone-app)
// -- this module now only ever guarded VADO fractional ownership, so
// keeping a two-gate shape here after VEX left would just be dead
// generality.

//: `influencer-culture-card-rewards` gates paying influencers in
//: Cvltvre Card value for promotional engagement. Held on a founder
//: decision pending Deskins' review, and the open question is
//: specific: VOKEN Cvltvre Cards have a real secondary market
//: (`lib/resale.js`), so rewarding promotion with them is compensated
//: promotion in an asset with resale value. That is disclosable
//: regardless of whether the compensation is cash, and it sits next to
//: the securities posture VOKEN already carries for fractional
//: ownership. Not resolved unilaterally -- see
//: `venvm/VIDEO_LIBRARY_INFLUENCER_DISTRIBUTION_STRATEGY.md`.
const GATES = ['fractional-ownership', 'influencer-culture-card-rewards'];

function createComplianceGateState() {
  return { 'fractional-ownership': false, 'influencer-culture-card-rewards': false };
}

function isComplianceCleared(store, gateName) {
  if (!GATES.includes(gateName)) {
    throw new Error(`isComplianceCleared: invalid gateName "${gateName}" (expected one of ${GATES.join(', ')})`);
  }
  return store.complianceGates[gateName];
}

// A real admin action -- in the real ecosystem this fires only after
// actual broker-dealer registration/Reg D/A+ legal work clears, not
// as a routine toggle.
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
