// VOKEN -- real value-history time series, by direct instruction: "no
// real price-history / time-series tracking." The failure this file
// exists to catch: a real scoring call that moves the live score but
// never leaves a real trace a chart could later read back.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, recordPeakValueScore, getCardValueHistory } = require('../lib/cultureCards');

function mint(store) {
  return mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a freshly minted card has a real, empty value history', () => {
  const store = createVokenStore();
  const card = mint(store);
  assert.deepEqual(getCardValueHistory(store, card.id), []);
});

test('every real scoring call is recorded, not just a new peak', () => {
  const store = createVokenStore();
  const card = mint(store);
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 40, now: 1000 });
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 70, now: 2000 });
  // A real quiet stretch -- the live score dips below the peak, but
  // this real call still happened and must still show up on the chart.
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 30, now: 3000 });

  const history = getCardValueHistory(store, card.id);
  assert.equal(history.length, 3, 'a real dip must still leave a real entry, not be silently dropped');
  assert.deepEqual(history, [
    { combinedRealValueScore: 40, at: 1000 },
    { combinedRealValueScore: 70, at: 2000 },
    { combinedRealValueScore: 30, at: 3000 },
  ]);
});

test('history stays in real chronological order, oldest first', () => {
  const store = createVokenStore();
  const card = mint(store);
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 10, now: 500 });
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 20, now: 1500 });
  const history = getCardValueHistory(store, card.id);
  assert.ok(history[0].at < history[1].at);
});

test('two different cards keep two real, independent histories', () => {
  const store = createVokenStore();
  const cardA = mint(store);
  const cardB = mint(store);
  recordPeakValueScore(store, { cardId: cardA.id, combinedRealValueScore: 90, now: 1000 });
  recordPeakValueScore(store, { cardId: cardB.id, combinedRealValueScore: 10, now: 1000 });
  assert.equal(getCardValueHistory(store, cardA.id).length, 1);
  assert.equal(getCardValueHistory(store, cardB.id).length, 1);
  assert.equal(getCardValueHistory(store, cardA.id)[0].combinedRealValueScore, 90);
  assert.equal(getCardValueHistory(store, cardB.id)[0].combinedRealValueScore, 10);
});

test('getCardValueHistory refuses an unknown card', () => {
  const store = createVokenStore();
  assert.throws(() => getCardValueHistory(store, 999999), /no card with id 999999/);
});
