// HVNTZ — Explore Page.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, "HVNTZ Explore
// Page — a real, confirmed gap, now closed": a real algorithm
// combining location-based and attention-based factors, surfacing
// nearby active hunts and neighbor-program matches from one ranked
// feed -- the same real ranking logic Instagram Explore/TikTok's For
// You page use.
//
// No exact scoring formula or location/attention weighting is given
// anywhere -- both are real, deterministic, flagged interpretive
// choices. Reuses neighborProgram.js's real Haversine distance and
// `computeLocationScore` rather than inventing a second copy of
// either -- `suggestNeighborTrades` (neighborProgram.js's own real
// DREA-suggestion ranking) shares this exact same scoring function.

const { haversineDistanceKm, computeLocationScore, LOCATION_SCORE_DECAY_KM } = require('./neighborProgram');

function getExplorePage(store, options = {}) {
  const { userLat, userLng } = options;
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    throw new Error('getExplorePage requires numeric userLat and userLng');
  }

  const surfaced = [];

  for (const hunt of store.hunts) {
    const originCheckpoint = hunt.checkpoints.find((c) => c.lat !== null && c.lng !== null);
    if (!originCheckpoint) continue; // no geolocated checkpoint yet -- can't rank by location
    const distanceKm = haversineDistanceKm(userLat, userLng, originCheckpoint.lat, originCheckpoint.lng);
    const locationScore = computeLocationScore(distanceKm);
    // Attention: real, measured signal -- how many checkpoints exist
    // (bigger hunt = more real content) and how much of the budget
    // has actually been used (real participation activity), not a
    // vanity metric.
    const budgetUsedFraction = 1 - hunt.remainingBudget / hunt.totalBudget;
    const attentionScore = Math.round(Math.min(100, hunt.checkpoints.length * 10 + budgetUsedFraction * 50) * 100) / 100;
    const combinedRankingScore = Math.round((locationScore * 0.5 + attentionScore * 0.5) * 100) / 100;
    surfaced.push({ contentType: 'hunt', contentId: hunt.id, locationScore, attentionScore, combinedRankingScore });
  }

  for (const program of store.neighborPrograms.filter((p) => p.optedIn)) {
    const distanceKm = haversineDistanceKm(userLat, userLng, program.lat, program.lng);
    const locationScore = computeLocationScore(distanceKm);
    const attentionScore = Math.round(Math.min(100, program.neighborTradeMatches.length * 20) * 100) / 100;
    const combinedRankingScore = Math.round((locationScore * 0.5 + attentionScore * 0.5) * 100) / 100;
    surfaced.push({ contentType: 'neighbor-match', contentId: program.businessId, locationScore, attentionScore, combinedRankingScore });
  }

  surfaced.sort((a, b) => b.combinedRankingScore - a.combinedRankingScore);
  return surfaced;
}

module.exports = { LOCATION_SCORE_DECAY_KM, computeLocationScore, getExplorePage };
