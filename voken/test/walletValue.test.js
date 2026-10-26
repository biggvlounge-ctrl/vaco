// VOKEN -- the real wallet value, by direct instruction: "when people
// get the cards, they will know how much their wallet is worth."
// The failure this file exists to catch: a wallet total that
// silently drops a real card the user owns (e.g. one nobody has
// scored yet) instead of honestly reporting it, or one that doesn't
// scale with how many real editions of the same card a user holds.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, recordPeakValueScore, mintAdditionalEdition } = require('../lib/cultureCards');
const { computeWalletValue } = require('../lib/walletValue');
const { computeCardMarketPrice } = require('../lib/cardMarketPrice');

function mint(store, subjectPersonId) {
  return mintCultureCard(store, {
    subjectPersonId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('an owner with no real cards has a real, zero-value, empty wallet', () => {
  const store = createVokenStore();
  const wallet = computeWalletValue(store, { ownerId: 'nobody-home' });
  assert.equal(wallet.totalValue, 0);
  assert.deepEqual(wallet.holdings, []);
});

test('a real owned card with a real score contributes its real market price', () => {
  const store = createVokenStore();
  const card = mint(store, 'ben'); // ben is the subject AND gets edition #1
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 60 });
  const { marketPrice } = computeCardMarketPrice(store, { cardId: card.id });

  const wallet = computeWalletValue(store, { ownerId: 'ben' });
  assert.equal(wallet.totalValue, marketPrice);
  assert.equal(wallet.holdings.length, 1);
  assert.equal(wallet.holdings[0].editionsOwned, 1);
});

test('owning several real editions of the same card multiplies its real market price', () => {
  const store = createVokenStore();
  const card = mint(store, 'ben');
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 60 });
  mintAdditionalEdition(store, { cardId: card.id, format: 'digital', ownerId: 'ben' });
  mintAdditionalEdition(store, { cardId: card.id, format: 'digital', ownerId: 'ben' });

  const { marketPrice } = computeCardMarketPrice(store, { cardId: card.id });
  const wallet = computeWalletValue(store, { ownerId: 'ben' });
  assert.equal(wallet.holdings[0].editionsOwned, 3);
  assert.equal(wallet.totalValue, Math.round(marketPrice * 3 * 100) / 100);
});

test('a real owned card nobody has ever scored contributes $0 honestly, without disappearing from holdings', () => {
  const store = createVokenStore();
  const card = mint(store, 'ben');
  const wallet = computeWalletValue(store, { ownerId: 'ben' });
  assert.equal(wallet.totalValue, 0);
  assert.equal(wallet.holdings.length, 1);
  assert.equal(wallet.holdings[0].marketPricePerEdition, null);
  assert.equal(wallet.holdings[0].holdingValue, 0);
});

test('several real distinct cards sum into one real total', () => {
  const store = createVokenStore();
  const cardA = mint(store, 'ben');
  const cardB = mint(store, 'carla');
  recordPeakValueScore(store, { cardId: cardA.id, combinedRealValueScore: 40 });
  recordPeakValueScore(store, { cardId: cardB.id, combinedRealValueScore: 80 });
  mintAdditionalEdition(store, { cardId: cardB.id, format: 'digital', ownerId: 'ben' });

  const wallet = computeWalletValue(store, { ownerId: 'ben' });
  const priceA = computeCardMarketPrice(store, { cardId: cardA.id }).marketPrice;
  const priceB = computeCardMarketPrice(store, { cardId: cardB.id }).marketPrice;
  assert.equal(wallet.holdings.length, 2);
  assert.equal(wallet.totalValue, Math.round((priceA + priceB) * 100) / 100);
});

test('computeWalletValue requires an ownerId', () => {
  const store = createVokenStore();
  assert.throws(() => computeWalletValue(store, {}), /requires an ownerId/);
});
