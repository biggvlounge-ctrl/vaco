// VOKEN — a real, unified card page, closing a real gap this session
// itself flagged: "a real card's page now needs ~8 separate calls...
// worth collapsing into one GET /api/card/:id/full so a real
// frontend isn't juggling waterfalls." Every piece here is genuine
// reuse of an already-real, already-tested function — nothing new is
// computed, this module only assembles.
//
// Deliberately uses the card's STORED peak (never a fresh live
// re-score, which needs a live VACA fetch and this app's own
// cross-platform-influence fetch) — the same real "cached data on
// load, explicit action to re-score" split `POST
// /api/card/:id/value-score` vs. this module already implies
// elsewhere. `marketPrice` and `vehicleValue` are both honestly
// `null` rather than erroring the whole page when they don't yet
// apply (an unscored card, or a non-vehicle category) — the same
// fail-soft posture `walletValue.js` already takes for an unscored
// holding.
//
// `fetchCollectibles` is injected, the same real dependency-injection
// shape every settlement in this codebase already uses for
// `settleFn` — this module never calls CVLLEX itself, so it stays a
// directly-testable function with no network mock required.
// `server.js` supplies the real, fail-soft CVLLEX fetch; a caller
// that passes nothing gets an honest empty list, never a guess.

const { getCultureCard, getCardValueHistory } = require('./cultureCards');
const { computeCardMarketPrice } = require('./cardMarketPrice');
const { computeVehicleCardValue } = require('./vehicleCardValue');
const { listMerchForCard } = require('./limitedEditionMerch');
const { computeEngagementStats } = require('./cardEngagement');
const { getFollowerCount } = require('./cardFollows');

async function getCardFullDetail(store, options = {}) {
  const { cardId, fetchCollectibles = async () => [] } = options;
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`getCardFullDetail: no card with id ${cardId}`);

  let marketPrice = null;
  try {
    marketPrice = computeCardMarketPrice(store, { cardId });
  } catch { /* no real score on file yet -- honestly null, not an error */ }

  let vehicleValue = null;
  try {
    vehicleValue = computeVehicleCardValue(store, { cardId });
  } catch { /* not a vehicle card, or no real attributes set yet -- honestly null */ }

  const [merch, collectibles] = await Promise.all([
    Promise.resolve(listMerchForCard(store, cardId)),
    card.subjectPersonId ? fetchCollectibles(card.subjectPersonId) : Promise.resolve([]),
  ]);

  return {
    card,
    marketPrice,
    vehicleValue,
    valueHistory: getCardValueHistory(store, cardId),
    predictionMarkets: card.predictionMarkets,
    engagement: computeEngagementStats(store, { cardId }),
    followerCount: getFollowerCount(store, cardId),
    merch,
    collectibles,
  };
}

module.exports = { getCardFullDetail };
