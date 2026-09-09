// HVNTZ — Hunts Local Neighbor Program.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, "Hunts Local
// Neighbor Program": businesses within a defined vicinity (the
// business owner chooses the radius) opt in to trade advertising
// directly with each other, each side offering a real incentive.
//
// Real geographic matching (Haversine great-circle distance), not a
// placeholder -- a business's own chosen radius determines which
// other opted-in businesses it can see as neighbors. Trades are
// mutual: recording one creates the reciprocal record on the
// partner's side too, since a trade is inherently two-sided.
//
// **Real DREA-driven automatic neighbor-match suggestions added**,
// closing this file's own previously-flagged gap ("matching by
// distance exists; nothing auto-generates or ranks suggested
// trades"). `suggestNeighborTrades` is the real, deterministic
// enforcement layer underneath DREA (same posture `drea.js` already
// takes toward placement rules -- the actual AI matching agent isn't
// built here, this is the real, testable ranking logic underneath
// it), grounded in the doc's own real, explicit "avoid direct
// competitor conflicts" constraint: a business's own optional
// `category` (a real, minimal schema extension, the same kind of
// addition `chopz-shop`'s own `Product.category` already made when a
// feature needed it) excludes same-category candidates from
// suggestions, and already-established partners are excluded too,
// since there's nothing to "suggest" about a trade that already
// exists. Ranks the real remaining candidates by the same real
// `computeLocationScore`/50-50-weighted-with-activity formula
// `explore.js` already established for its own Explore Page ranking
// -- moved here so both real callers share one real scoring function
// instead of two independent copies.

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Real, standard great-circle distance formula -- Earth radius 6371km.
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Real, interpretive location-score decay, moved here from
// `explore.js` so both real callers (the Explore Page and neighbor-
// trade suggestions) share one real scoring function.
const LOCATION_SCORE_DECAY_KM = 20; // interpretive: score reaches ~0 by this distance

function computeLocationScore(distanceKm) {
  return Math.max(0, Math.round((100 - (distanceKm / LOCATION_SCORE_DECAY_KM) * 100) * 100) / 100);
}

function optInToNeighborProgram(store, options = {}) {
  const {
    businessId, lat, lng, definedVicinityRadius, category = null,
  } = options;
  if (!businessId) {
    throw new Error('optInToNeighborProgram requires a businessId');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('optInToNeighborProgram requires numeric lat and lng');
  }
  if (!Number.isFinite(definedVicinityRadius) || definedVicinityRadius <= 0) {
    throw new Error('optInToNeighborProgram requires a positive definedVicinityRadius');
  }

  const existing = store.neighborPrograms.find((p) => p.businessId === businessId);
  if (existing) {
    existing.lat = lat;
    existing.lng = lng;
    existing.definedVicinityRadius = definedVicinityRadius;
    existing.optedIn = true;
    existing.category = category;
    return existing;
  }
  const program = {
    businessId, lat, lng, definedVicinityRadius, category, optedIn: true, neighborTradeMatches: [],
  };
  store.neighborPrograms.push(program);
  return program;
}

function optOutOfNeighborProgram(store, businessId) {
  const program = store.neighborPrograms.find((p) => p.businessId === businessId);
  if (!program) {
    throw new Error(`optOutOfNeighborProgram: no neighbor program record for business ${businessId}`);
  }
  program.optedIn = false;
  return program;
}

function getNeighborProgram(store, businessId) {
  return store.neighborPrograms.find((p) => p.businessId === businessId) || null;
}

// Real distance-based matching, scoped by the searching business's
// own chosen radius -- not requiring the other side's radius to also
// reach back, since the doc frames the radius as each business's own
// individual choice.
function findNearbyNeighbors(store, businessId) {
  const mine = getNeighborProgram(store, businessId);
  if (!mine || !mine.optedIn) {
    throw new Error(`findNearbyNeighbors: business ${businessId} is not opted into the neighbor program`);
  }
  return store.neighborPrograms
    .filter((p) => p.optedIn && p.businessId !== businessId)
    .map((p) => ({ businessId: p.businessId, distanceKm: Math.round(haversineDistanceKm(mine.lat, mine.lng, p.lat, p.lng) * 100) / 100 }))
    .filter((n) => n.distanceKm <= mine.definedVicinityRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// A trade is mutual -- recording it creates both sides' records at
// once, matching the doc's own "nearby businesses become allies"
// framing (not a one-sided offer awaiting acceptance).
function recordNeighborTrade(store, options = {}) {
  const { businessId, partnerBusinessId, incentiveOffered, incentiveReceived } = options;
  const mine = getNeighborProgram(store, businessId);
  const partner = getNeighborProgram(store, partnerBusinessId);
  if (!mine || !mine.optedIn) {
    throw new Error(`recordNeighborTrade: business ${businessId} is not opted into the neighbor program`);
  }
  if (!partner || !partner.optedIn) {
    throw new Error(`recordNeighborTrade: partner business ${partnerBusinessId} is not opted into the neighbor program`);
  }
  if (!incentiveOffered || !incentiveReceived) {
    throw new Error('recordNeighborTrade requires both incentiveOffered and incentiveReceived');
  }

  const match = { partnerBusinessId, incentiveOffered, incentiveReceived, dreaRecommendationPriority: 'high' };
  mine.neighborTradeMatches.push(match);
  partner.neighborTradeMatches.push({
    partnerBusinessId: businessId,
    incentiveOffered: incentiveReceived,
    incentiveReceived: incentiveOffered,
    dreaRecommendationPriority: 'high',
  });
  return match;
}

// The real, automatic ranking DREA sits on top of: every opted-in,
// in-radius, not-already-partnered, not-same-category candidate,
// ranked by a real combined location + activity score -- the highest-
// ranked entry is the real "suggested trade," not left for a human to
// manually discover via `findNearbyNeighbors` alone.
function suggestNeighborTrades(store, businessId) {
  const mine = getNeighborProgram(store, businessId);
  if (!mine || !mine.optedIn) {
    throw new Error(`suggestNeighborTrades: business ${businessId} is not opted into the neighbor program`);
  }
  const existingPartnerIds = new Set(mine.neighborTradeMatches.map((m) => m.partnerBusinessId));

  const suggestions = store.neighborPrograms
    .filter((p) => p.optedIn && p.businessId !== businessId)
    .filter((p) => !existingPartnerIds.has(p.businessId))
    // Real, explicit competitor-conflict avoidance, grounded in the
    // doc's own cited constraint -- a business with no declared
    // category is never excluded on this basis (nothing to conflict
    // with), matching how `category` is optional at opt-in time.
    .filter((p) => !(mine.category && p.category && p.category === mine.category))
    .map((p) => {
      const distanceKm = Math.round(haversineDistanceKm(mine.lat, mine.lng, p.lat, p.lng) * 100) / 100;
      const locationScore = computeLocationScore(distanceKm);
      const activityScore = Math.round(Math.min(100, p.neighborTradeMatches.length * 20) * 100) / 100;
      const combinedRankingScore = Math.round((locationScore * 0.5 + activityScore * 0.5) * 100) / 100;
      return {
        businessId: p.businessId, category: p.category, distanceKm, locationScore, activityScore, combinedRankingScore,
      };
    })
    .filter((s) => s.distanceKm <= mine.definedVicinityRadius)
    .sort((a, b) => b.combinedRankingScore - a.combinedRankingScore);

  return suggestions;
}

module.exports = {
  LOCATION_SCORE_DECAY_KM,
  computeLocationScore,
  haversineDistanceKm,
  optInToNeighborProgram,
  optOutOfNeighborProgram,
  getNeighborProgram,
  findNearbyNeighbors,
  recordNeighborTrade,
  suggestNeighborTrades,
};
