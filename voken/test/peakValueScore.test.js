// VOKEN -- the real "only ever goes up" value floor, by direct
// instruction: "the more attention... their card goes up in value or
// can go down in value... I guess it really can't really lower, it
// just won't raise [further]." The failure this file exists to
// catch: a card's effective value actually dropping when its live
// underlying metrics have a real quiet stretch.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, recordPeakValueScore, getCultureCard } = require('../lib/cultureCards');

function mint(store) {
  return mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a freshly minted card has no real peak yet', () => {
  const store = createVokenStore();
  const card = mint(store);
  assert.equal(card.peakValueScore, null);
  assert.equal(card.peakValueScoreAt, null);
});

test('recordPeakValueScore sets the real peak the first time it is called', () => {
  const store = createVokenStore();
  const card = mint(store);
  const peak = recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 40 });
  assert.equal(peak, 40);
  assert.equal(getCultureCard(store, card.id).peakValueScore, 40);
});

test('a real higher score raises the peak', () => {
  const store = createVokenStore();
  const card = mint(store);
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 40 });
  const peak = recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 65 });
  assert.equal(peak, 65);
});

test('a real lower score never lowers the peak -- the exact mechanic this file exists to prove', () => {
  const store = createVokenStore();
  const card = mint(store);
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 70 });
  const peak = recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 20 });
  assert.equal(peak, 70, 'a real quiet stretch must never pull the effective value below the real high already earned');
  assert.equal(getCultureCard(store, card.id).peakValueScore, 70);
});

test('an equal score is a real no-op, not treated as a new peak', () => {
  const store = createVokenStore();
  const card = mint(store);
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 50, now: 1000 });
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 50, now: 2000 });
  assert.equal(getCultureCard(store, card.id).peakValueScoreAt, 1000, 'the peak timestamp must not move for a tie');
});

test('recordPeakValueScore refuses an unknown card', () => {
  const store = createVokenStore();
  assert.throws(
    () => recordPeakValueScore(store, { cardId: 999, combinedRealValueScore: 50 }),
    /no card with id 999/,
  );
});

test('recordPeakValueScore validates combinedRealValueScore', () => {
  const store = createVokenStore();
  const card = mint(store);
  assert.throws(
    () => recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: -1 }),
    /between 0 and 100/,
  );
  assert.throws(
    () => recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 101 }),
    /between 0 and 100/,
  );
});

test('two different cards track two real, independent peaks', () => {
  const store = createVokenStore();
  const cardA = mint(store);
  const cardB = mint(store);
  recordPeakValueScore(store, { cardId: cardA.id, combinedRealValueScore: 90 });
  recordPeakValueScore(store, { cardId: cardB.id, combinedRealValueScore: 10 });
  assert.equal(getCultureCard(store, cardA.id).peakValueScore, 90);
  assert.equal(getCultureCard(store, cardB.id).peakValueScore, 10);
});
