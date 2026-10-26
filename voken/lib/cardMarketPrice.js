// VOKEN — the real, tradeable market price, by direct instruction,
// reconciling an apparent contradiction between two messages:
//
// Earlier: "the more attention... their card goes up in value or can
// go down in value... I guess it really can't really lower, it just
// won't raise [further]." Built as `recordPeakValueScore()` in
// `cultureCards.js` -- a card's all-time-high `combinedRealValueScore`
// that never erases, like a career-high stat line on a real baseball
// card. That stays exactly as built.
//
// Later, this message: "it could lower, though, if their following
// drops or if more cards are added... as more people join cards, the
// value of cards will go up because there are more cards available
// on the market now... you might start off with a Bill Cosby card
// and it might be $2 because we're just getting started. But then as
// all the other cards come in with a lower score, that Bill Cosby
// card will go up."
//
// The real resolution: these are two different real numbers. The PEAK
// is a fact about this one card's own best-ever real achievement --
// it never erases, the same way a player's career-high stat line
// never erases even if the card's market price falls. The real
// tradeable PRICE built here is a different, live, market-relative
// number -- it reflects (a) the card's current LIVE score (which can
// genuinely dip if a real following drops) and (b) this card's real
// standing relative to every other card currently on the market,
// which genuinely shifts as the market grows -- exactly like a real
// baseball card's price can fall even though the player's own career
// stats never go backward.
//
// Every constant below is a real, deterministic, flagged interpretive
// choice (no source doc gives exact dollar figures), the same
// discipline every other formula in this session already follows.

const { getCultureCard } = require('./cultureCards');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// A full, "mature" market is modeled as 500 other real cards with a
// known score on file -- below that, the market hasn't yet proven
// enough real relative scarcity to price confidently, so price is
// real but deliberately suppressed ("we're just getting started").
const MARKET_MATURITY_ANCHOR_CARD_COUNT = 500;
// Even a lone, brand-new card still has a real, non-zero price (never
// literally $0) -- the real floor "we're just getting started" sits
// at. The ceiling rewards genuinely outranking almost the entire real
// market, not just being decent.
const MIN_SCARCITY_MULTIPLIER = 0.05;
const MAX_SCARCITY_MULTIPLIER = 2.0;
// At a perfect live score of 100 and a fully mature, top-of-the-market
// standing, a card's real price tops out at this many real dollars --
// a flagged, round anchor, not a literal confirmed figure.
const BASE_PRICE_SCALE = 1000;

// **The real market-relative price.** Reads every other real card's
// own real `peakValueScore` already on file (recorded by
// `recordPeakValueScore` whenever any card is scored) as this card's
// real market -- not an invented second ledger. `liveCombinedRealValueScore`
// defaults to this card's own real peak when no fresher live score is
// given, so this function works even for a card that hasn't been
// re-scored since it was minted.
function computeCardMarketPrice(store, options = {}) {
  const { cardId } = options;
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`computeCardMarketPrice: no card with id ${cardId}`);

  const liveCombinedRealValueScore = options.liveCombinedRealValueScore ?? card.peakValueScore;
  if (!Number.isFinite(liveCombinedRealValueScore) || liveCombinedRealValueScore < 0 || liveCombinedRealValueScore > 100) {
    throw new Error(`computeCardMarketPrice: card ${cardId} has no real score on file yet -- score it at least once, or pass liveCombinedRealValueScore`);
  }

  const others = store.cultureCards.filter((c) => c.id !== cardId && Number.isFinite(c.peakValueScore));
  const totalOtherCardsConsidered = others.length;
  const belowCount = others.filter((c) => c.peakValueScore < liveCombinedRealValueScore).length;
  // With no real market to compare against yet, neither raised nor
  // lowered -- an honest, neutral 0.5, not a guessed extreme.
  const percentileRank = totalOtherCardsConsidered === 0 ? 0.5 : belowCount / totalOtherCardsConsidered;

  const marketMaturity = clamp(totalOtherCardsConsidered / MARKET_MATURITY_ANCHOR_CARD_COUNT, 0, 1);
  const scarcityMultiplier = clamp(
    MIN_SCARCITY_MULTIPLIER + marketMaturity * percentileRank * (MAX_SCARCITY_MULTIPLIER - MIN_SCARCITY_MULTIPLIER),
    MIN_SCARCITY_MULTIPLIER, MAX_SCARCITY_MULTIPLIER,
  );

  const basePrice = (liveCombinedRealValueScore / 100) * BASE_PRICE_SCALE;
  const marketPrice = round2(basePrice * scarcityMultiplier);

  return {
    cardId,
    liveCombinedRealValueScore,
    peakValueScore: card.peakValueScore,
    totalOtherCardsConsidered,
    percentileRank: round2(percentileRank),
    marketMaturity: round2(marketMaturity),
    scarcityMultiplier: round2(scarcityMultiplier),
    marketPrice,
  };
}

module.exports = {
  MARKET_MATURITY_ANCHOR_CARD_COUNT,
  MIN_SCARCITY_MULTIPLIER,
  MAX_SCARCITY_MULTIPLIER,
  BASE_PRICE_SCALE,
  computeCardMarketPrice,
};
