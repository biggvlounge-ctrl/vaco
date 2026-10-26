// VOKEN -- the real, tradeable market price, deliberately a different
// real number from peakValueScore. By direct instruction: "it could
// lower, though, if their following drops or if more cards are
// added... as more people join cards, the value of cards will go up
// because there are more cards available on the market now... you
// might start off with a Bill Cosby card and it might be $2 because
// we're just getting started. But then as all the other cards come
// in with a lower score, that Bill Cosby card will go up." The
// failures this file exists to catch: a price that can only ever
// rise (the opposite of what was asked for here), or one that ignores
// the rest of the real market entirely.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, recordPeakValueScore } = require('../lib/cultureCards');
const { computeCardMarketPrice } = require('../lib/cardMarketPrice');

function mint(store, subjectPersonId) {
  return mintCultureCard(store, {
    subjectPersonId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a lone card with no real market yet still gets a real, non-zero price', () => {
  const store = createVokenStore();
  const card = mint(store, 'ada');
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 50 });
  const result = computeCardMarketPrice(store, { cardId: card.id });
  assert.equal(result.totalOtherCardsConsidered, 0);
  assert.equal(result.percentileRank, 0.5, 'no real market to compare against yet -- neutral, not a guessed extreme');
  assert.ok(result.marketPrice > 0, 'never literally $0, even brand new');
});

test('a real following drop lowers the price directly, via the live score -- it is not locked to the peak', () => {
  const store = createVokenStore();
  const card = mint(store, 'ada');
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 80 });
  const atPeak = computeCardMarketPrice(store, { cardId: card.id, liveCombinedRealValueScore: 80 });
  const afterDrop = computeCardMarketPrice(store, { cardId: card.id, liveCombinedRealValueScore: 30 });
  assert.ok(afterDrop.marketPrice < atPeak.marketPrice, 'a real quiet stretch must be able to pull the real market price down');
  assert.equal(afterDrop.peakValueScore, 80, 'the real peak itself is unaffected -- a different real number');
});

test('as more lower-scoring cards join the market, a fixed card\'s real price rises -- the exact "Bill Cosby card" scenario', () => {
  const store = createVokenStore();
  const topCard = mint(store, 'cosby-like');
  recordPeakValueScore(store, { cardId: topCard.id, combinedRealValueScore: 70 });
  const early = computeCardMarketPrice(store, { cardId: topCard.id });

  // "as all the other cards come in with a lower score" -- real new
  // cards join, each scoring below the fixed card.
  for (let i = 0; i < 20; i += 1) {
    const newcomer = mint(store, `newcomer-${i}`);
    recordPeakValueScore(store, { cardId: newcomer.id, combinedRealValueScore: 10 });
  }
  const later = computeCardMarketPrice(store, { cardId: topCard.id });

  assert.ok(later.percentileRank > early.percentileRank, 'the fixed card\'s real standing must rise as lower-scoring cards join');
  assert.ok(later.marketPrice > early.marketPrice, 'and its real market price must rise with it');
});

test('more HIGHER-scoring cards joining (same market size) lowers a fixed card\'s real percentile and price', () => {
  const store = createVokenStore();
  const card = mint(store, 'ada');
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 50 });

  // Market A: 10 other cards, all scoring below this card.
  const storeBelow = createVokenStore();
  const cardBelow = mint(storeBelow, 'ada');
  recordPeakValueScore(storeBelow, { cardId: cardBelow.id, combinedRealValueScore: 50 });
  for (let i = 0; i < 10; i += 1) {
    const c = mint(storeBelow, `low-${i}`);
    recordPeakValueScore(storeBelow, { cardId: c.id, combinedRealValueScore: 10 });
  }
  const priceWithLowerMarket = computeCardMarketPrice(storeBelow, { cardId: cardBelow.id });

  // Market B: the same 10-card market size, but all scoring ABOVE
  // this card instead.
  const storeAbove = createVokenStore();
  const cardAbove = mint(storeAbove, 'ada');
  recordPeakValueScore(storeAbove, { cardId: cardAbove.id, combinedRealValueScore: 50 });
  for (let i = 0; i < 10; i += 1) {
    const c = mint(storeAbove, `high-${i}`);
    recordPeakValueScore(storeAbove, { cardId: c.id, combinedRealValueScore: 90 });
  }
  const priceWithHigherMarket = computeCardMarketPrice(storeAbove, { cardId: cardAbove.id });

  assert.ok(priceWithHigherMarket.percentileRank < priceWithLowerMarket.percentileRank);
  assert.ok(priceWithHigherMarket.marketPrice < priceWithLowerMarket.marketPrice, 'being outranked by the real market must lower the real price');
});

test('a young, small market suppresses price even at the same relative top standing -- "we\'re just getting started"', () => {
  const store = createVokenStore();
  const card = mint(store, 'ada');
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 90 });
  const young = computeCardMarketPrice(store, { cardId: card.id }); // this card IS the entire market

  // Grow the market with many real cards, all scoring lower, so this
  // card stays at the real top of the percentile the whole time.
  for (let i = 0; i < 400; i += 1) {
    const c = mint(store, `low-${i}`);
    recordPeakValueScore(store, { cardId: c.id, combinedRealValueScore: 5 });
  }
  const mature = computeCardMarketPrice(store, { cardId: card.id });

  assert.ok(mature.percentileRank >= young.percentileRank, 'still at or near the real top of the market');
  assert.ok(mature.marketPrice > young.marketPrice, 'a real, mature market must price a sustained top standing higher than a brand-new one could');
});

test('computeCardMarketPrice refuses an unscored card and an unknown card', () => {
  const store = createVokenStore();
  const card = mint(store, 'ada');
  assert.throws(() => computeCardMarketPrice(store, { cardId: card.id }), /no real score on file yet/);
  assert.throws(() => computeCardMarketPrice(store, { cardId: 999999 }), /no card with id 999999/);
});
