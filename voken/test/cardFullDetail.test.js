// VOKEN -- a real, unified card page, by direct instruction: "a real
// card's page now needs ~8 separate calls... worth collapsing into
// one GET /api/card/:id/full." The failure this file exists to
// catch: one piece of the real page (an unscored card, a non-vehicle
// category, an unreachable CVLLEX) throwing and taking down every
// other real piece with it.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  mintCultureCard, recordPeakValueScore, verifySubjectIdentity, updateCardStatistics,
} = require('../lib/cultureCards');
const { createMerchListing } = require('../lib/limitedEditionMerch');
const { followCard } = require('../lib/cardFollows');
const { recordEngagementEvent } = require('../lib/cardEngagement');
const { getCardFullDetail } = require('../lib/cardFullDetail');

function mintMusicCard(store, ownerId = 'ada') {
  return mintCultureCard(store, {
    subjectPersonId: ownerId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('an unscored card still returns a full, real page -- marketPrice is honestly null, not a thrown error', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store);
  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.equal(detail.card.id, card.id);
  assert.equal(detail.marketPrice, null);
  assert.equal(detail.vehicleValue, null, 'a music card is never a vehicle');
  assert.deepEqual(detail.valueHistory, []);
  assert.deepEqual(detail.predictionMarkets, []);
  assert.equal(detail.followerCount, 0);
  assert.deepEqual(detail.merch, []);
  assert.deepEqual(detail.collectibles, [], 'no real fetchCollectibles given -- the honest default is empty, not an error');
});

test('a scored card includes a real, non-null marketPrice and its real valueHistory', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store);
  recordPeakValueScore(store, { cardId: card.id, combinedRealValueScore: 60 });
  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.ok(detail.marketPrice.marketPrice > 0);
  assert.equal(detail.valueHistory.length, 1);
});

test('a real vehicle card with real attributes set includes a real, non-null vehicleValue', async () => {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'marcus', category: 'vehicles', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 1,
  });
  verifySubjectIdentity(store, { cardId: card.id, verifierId: 'marcus' });
  updateCardStatistics(store, {
    cardId: card.id, updaterId: 'marcus',
    statistics: { referenceValue: 40000, mileage: 30000, condition: 'excellent', modelYear: 2015 },
  });
  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.ok(detail.vehicleValue.vehicleCardValue > 0);
});

test('merch, followers, and real engagement all show up together on the one real page', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store, 'ada');
  createMerchListing(store, { creatorId: 'ada', itemType: 't-shirt', totalSupply: 100, basePrice: 25, linkedCultureCardId: card.id });
  followCard(store, { cardId: card.id, followerId: 'ben' });
  recordEngagementEvent(store, { cardId: card.id, type: 'view', viewerId: 'ben' });

  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.equal(detail.merch.length, 1);
  assert.equal(detail.followerCount, 1);
  assert.equal(detail.engagement.views, 1);
});

test('a real, injected fetchCollectibles supplies the real collectibles list, only for a card with a real subject', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store, 'ada');
  const fetchCollectibles = async (creatorId) => {
    assert.equal(creatorId, 'ada');
    return [{ orderId: 1, itemType: 'vinyl' }];
  };
  const detail = await getCardFullDetail(store, { cardId: card.id, fetchCollectibles });
  assert.equal(detail.collectibles.length, 1);
});

test('a card with no real subjectPersonId never calls fetchCollectibles at all', async () => {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  // Force a no-subject shape the same way an external-entity card has it.
  card.subjectPersonId = null;
  let called = false;
  const fetchCollectibles = async () => { called = true; return []; };
  await getCardFullDetail(store, { cardId: card.id, fetchCollectibles });
  assert.equal(called, false, 'no real subject exists to fetch real collectibles for');
});

test('a card with a real subject surfaces its real royalty recipient and rate on the full page', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store, 'ada');
  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.equal(detail.royaltyRecipient, 'ada');
  assert.equal(detail.royaltyRate, 0.10);
});

test('a card with no real royalty recipient honestly shows both as null, not a guessed rate', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store, 'ada');
  // Force a no-recipient shape the same way a fixed historic/operator-curated card has it.
  card.subjectPersonId = null;
  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.equal(detail.royaltyRecipient, null);
  assert.equal(detail.royaltyRate, null);
});

test('getCardFullDetail refuses an unknown card', async () => {
  const store = createVokenStore();
  await assert.rejects(() => getCardFullDetail(store, { cardId: 999999 }), /no card with id 999999/);
});

// -- authenticityGrade: the real, visible VACA verification badge --------

test('with no real fetchAuthenticityGrade given, the page honestly shows null, not a guessed grade', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store);
  const detail = await getCardFullDetail(store, { cardId: card.id });
  assert.equal(detail.authenticityGrade, null);
});

test('a real, injected fetchAuthenticityGrade supplies the real grade on the page', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store);
  const fetchAuthenticityGrade = async (cardId) => {
    assert.equal(cardId, card.id);
    return 'A';
  };
  const detail = await getCardFullDetail(store, { cardId: card.id, fetchAuthenticityGrade });
  assert.equal(detail.authenticityGrade, 'A');
});

test('a VACA outage fails the page soft -- authenticityGrade is honestly null, the rest of the page still loads', async () => {
  const store = createVokenStore();
  const card = mintMusicCard(store);
  const fetchAuthenticityGrade = async () => { throw new Error('VACA unreachable'); };
  const detail = await getCardFullDetail(store, { cardId: card.id, fetchAuthenticityGrade });
  assert.equal(detail.authenticityGrade, null);
  assert.equal(detail.card.id, card.id, 'the rest of the page must not be taken down by a VACA outage');
});
