// VOKEN -- real VAGO prediction markets on a card's own real market
// price, by direct instruction: "let's also add in our predictions
// on the culture card market as well." The failure this file exists
// to catch: a card's own display name being invented for a historic
// card that has no real name stored, or a prediction-market record
// silently losing which card it was about.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  mintCultureCard, mintHistoricCard, describeCardForQuestion, recordCardPredictionMarket, getCultureCard,
} = require('../lib/cultureCards');

function mintPersonCard(store, subjectPersonId = 'ada') {
  return mintCultureCard(store, {
    subjectPersonId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a freshly minted card has no real prediction markets yet', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  assert.deepEqual(card.predictionMarkets, []);
});

test('describeCardForQuestion uses the real historic fact name for a historic card', () => {
  const store = createVokenStore();
  const card = mintHistoricCard(store, {
    historicSlug: 'johannes-gutenberg', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
  assert.equal(describeCardForQuestion(card), 'Johannes Gutenberg');
});

test('describeCardForQuestion falls back to a real, honest numeric id for a living-subject card, never an invented name', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  assert.equal(describeCardForQuestion(card), `Cvltvre Card #${card.id}`);
});

test('recordCardPredictionMarket records a real entry on the card, including an honest null vagoMarketId when VAGO was unreachable', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  const record = recordCardPredictionMarket(store, {
    cardId: card.id, vagoMarketId: null, question: 'Will it exceed $500 by 2027-01-01?', thresholdPrice: 500, byDate: '2027-01-01',
  });
  assert.equal(record.vagoMarketId, null);
  assert.equal(getCultureCard(store, card.id).predictionMarkets.length, 1);
  assert.equal(getCultureCard(store, card.id).predictionMarkets[0].thresholdPrice, 500);
});

test('recordCardPredictionMarket records a real vagoMarketId when VAGO succeeded', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  recordCardPredictionMarket(store, {
    cardId: card.id, vagoMarketId: 42, question: 'q', thresholdPrice: 100, byDate: '2027-01-01',
  });
  assert.equal(getCultureCard(store, card.id).predictionMarkets[0].vagoMarketId, 42);
});

test('a card can have several real prediction markets over time', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  recordCardPredictionMarket(store, { cardId: card.id, vagoMarketId: 1, question: 'q1', thresholdPrice: 100, byDate: '2027-01-01' });
  recordCardPredictionMarket(store, { cardId: card.id, vagoMarketId: 2, question: 'q2', thresholdPrice: 200, byDate: '2027-06-01' });
  assert.equal(getCultureCard(store, card.id).predictionMarkets.length, 2);
});

test('recordCardPredictionMarket requires every real field and refuses an unknown card', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  assert.throws(
    () => recordCardPredictionMarket(store, { cardId: card.id, vagoMarketId: null, thresholdPrice: 100, byDate: '2027-01-01' }),
    /requires a question/,
  );
  assert.throws(
    () => recordCardPredictionMarket(store, { cardId: card.id, vagoMarketId: null, question: 'q', byDate: '2027-01-01' }),
    /non-negative thresholdPrice/,
  );
  assert.throws(
    () => recordCardPredictionMarket(store, { cardId: card.id, vagoMarketId: null, question: 'q', thresholdPrice: -1, byDate: '2027-01-01' }),
    /non-negative thresholdPrice/,
  );
  assert.throws(
    () => recordCardPredictionMarket(store, { cardId: card.id, vagoMarketId: null, question: 'q', thresholdPrice: 100 }),
    /requires a byDate/,
  );
  assert.throws(
    () => recordCardPredictionMarket(store, { cardId: 999999, vagoMarketId: null, question: 'q', thresholdPrice: 100, byDate: '2027-01-01' }),
    /no card with id 999999/,
  );
});
