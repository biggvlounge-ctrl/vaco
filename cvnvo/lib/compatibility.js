// CVNVO -- the real compatibility scoring function.
// Source of truth: CVNVO_CORE_FEATURES.md's standing decision to model
// Hinge's mutual-compatibility approach ("who you'll like AND who's
// likely to like you back"), not Tinder's one-sided ELO/volume model,
// and "Compatibility score shown transparently (not a black box)."
//
// No exact formula is given anywhere -- CVNVO_DATING_COMPARABLES.md
// itself flags this directly: "Real matching algorithm implementation
// ... is a genuine engineering lift, not a UI decision." The formula
// below is real, deterministic, bounded [0,100], and flagged as an
// interpretive choice, matching this session's established pattern
// (VOKEN's valueAlgorithm.js, VOID's cargoPricing.js): real shared-
// interest overlap, a real MUTUAL age-preference check (both
// directions, not just one -- the literal "who's likely to like you
// back" piece), and real Haversine-based proximity.

const INTEREST_WEIGHT = 40;
const AGE_FIT_WEIGHT = 30;
const DISTANCE_WEIGHT = 30;
const MAX_DISTANCE_KM = 100; // beyond this, real proximity contributes nothing
const EARTH_RADIUS_KM = 6371;

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Real Haversine great-circle distance, same real formula this
// session's other geo-aware modules use (VOID's lib/geo.js).
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jaccardSimilarity(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  if (a.size === 0 && b.size === 0) return 0;
  const intersectionSize = [...a].filter((x) => b.has(x)).length;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// Real mutual fit: full credit only if EACH person's age falls inside
// the OTHER's stated seeking range -- the literal, real implementation
// of "who you'll like AND who's likely to like you back," not a
// one-directional filter.
function mutualAgeFitScore(inputsA, inputsB) {
  const aFitsB = inputsA.age >= inputsB.seekingAgeMin && inputsA.age <= inputsB.seekingAgeMax;
  const bFitsA = inputsB.age >= inputsA.seekingAgeMin && inputsB.age <= inputsA.seekingAgeMax;
  return (aFitsB ? 0.5 : 0) + (bFitsA ? 0.5 : 0);
}

function computeCompatibilityScore(profileA, profileB) {
  if (!profileA || !profileB) throw new Error('computeCompatibilityScore requires two real profiles');
  const inputsA = profileA.compatibilityInputs;
  const inputsB = profileB.compatibilityInputs;

  const interestScore = jaccardSimilarity(inputsA.interests, inputsB.interests);
  const ageFitScore = mutualAgeFitScore(inputsA, inputsB);
  const distanceKm = haversineKm(inputsA.lat, inputsA.lng, inputsB.lat, inputsB.lng);
  const distanceScore = clamp(1 - distanceKm / MAX_DISTANCE_KM, 0, 1);

  const combined = interestScore * INTEREST_WEIGHT + ageFitScore * AGE_FIT_WEIGHT + distanceScore * DISTANCE_WEIGHT;
  return {
    compatibilityScore: round(clamp(combined, 0, 100)),
    interestScore: round(interestScore),
    ageFitScore: round(ageFitScore),
    distanceKm: round(distanceKm),
    distanceScore: round(distanceScore),
  };
}

module.exports = { INTEREST_WEIGHT, AGE_FIT_WEIGHT, DISTANCE_WEIGHT, MAX_DISTANCE_KM, haversineKm, computeCompatibilityScore };
