// VSAFE -- Background/Trust Signals.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md. Real, deterministic, bounded
// [0,100] aggregate, flagged as an interpretive build (matching
// VOKEN's valueAlgorithm.js/VOID's cargoPricing.js precedent) since no
// real formula exists anywhere. Deliberately app-agnostic: this module
// never touches CVNVO's own Yap reports directly (Yap is CVNVO-local,
// not a VSAFE concern) -- a calling app supplies its own real
// `reportedIncidentCount` if it wants that reflected, keeping VSAFE's
// trust signal genuinely reusable rather than secretly CVNVO-coupled.

const { isVerified } = require('./idVerification');

const ID_VERIFIED_BONUS = 30;
const ACCOUNT_AGE_MAX_BONUS = 30;
const ACCOUNT_AGE_LOG_MULTIPLIER = 8; // real log-scale growth, matching this session's established scarcity/trust-curve pattern
const INCIDENT_PENALTY_PER_REPORT = 15;
const BASE_SCORE = 40; // a real, non-zero floor -- an unverified, brand-new, unreported user isn't automatically "untrustworthy," just unproven

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeTrustScore(store, options = {}) {
  const { userId, accountAgeDays = 0, reportedIncidentCount = 0 } = options;
  if (!userId) throw new Error('computeTrustScore requires a userId');
  if (!Number.isFinite(accountAgeDays) || accountAgeDays < 0) throw new Error('computeTrustScore requires a non-negative accountAgeDays');
  if (!Number.isInteger(reportedIncidentCount) || reportedIncidentCount < 0) {
    throw new Error('computeTrustScore requires a non-negative integer reportedIncidentCount');
  }

  const idBonus = isVerified(store, userId) ? ID_VERIFIED_BONUS : 0;
  const ageBonus = clamp(Math.log10(accountAgeDays + 1) * ACCOUNT_AGE_LOG_MULTIPLIER, 0, ACCOUNT_AGE_MAX_BONUS);
  const incidentPenalty = reportedIncidentCount * INCIDENT_PENALTY_PER_REPORT;

  const trustScore = round(clamp(BASE_SCORE + idBonus + ageBonus - incidentPenalty, 0, 100));
  return {
    userId, trustScore, idVerified: isVerified(store, userId), idBonus, ageBonus: round(ageBonus), incidentPenalty,
  };
}

module.exports = {
  ID_VERIFIED_BONUS, ACCOUNT_AGE_MAX_BONUS, INCIDENT_PENALTY_PER_REPORT, BASE_SCORE, computeTrustScore,
};
