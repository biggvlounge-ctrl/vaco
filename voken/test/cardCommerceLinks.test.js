// VOKEN -- a card's own merch links, by direct instruction: "on
// their page... it should link directly to their merch involved with
// them... this also is an opportunity for them to sell or promote
// their collectibles as well." The failure this file exists to
// catch: a real listing linked to this exact card, or made by this
// card's own real subject, silently missing from the lookup -- or a
// stranger's unrelated merch wrongly showing up on someone else's
// card page.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintCultureCard, mintHistoricCard } = require('../lib/cultureCards');
const { createMerchListing, listMerchForCard } = require('../lib/limitedEditionMerch');

function mintPersonCard(store, subjectPersonId = 'ada') {
  return mintCultureCard(store, {
    subjectPersonId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a card with no real merch yet has an empty list, not an error', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  assert.deepEqual(listMerchForCard(store, card.id), []);
});

test('a listing explicitly linked to this exact card shows up', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  const listing = createMerchListing(store, {
    creatorId: 'ada', itemType: 't-shirt', totalSupply: 100, basePrice: 25, linkedCultureCardId: card.id,
  });
  const result = listMerchForCard(store, card.id);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, listing.id);
});

test('a listing made by the same real subject, but not linked to this exact card, still shows up -- a real cross-promotion opportunity', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  createMerchListing(store, { creatorId: 'ada', itemType: 'poster', totalSupply: 50, basePrice: 10 });
  const result = listMerchForCard(store, card.id);
  assert.equal(result.length, 1);
  assert.equal(result[0].creatorId, 'ada');
});

test('a stranger\'s unrelated merch never shows up on someone else\'s card', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  createMerchListing(store, { creatorId: 'ben', itemType: 'hat', totalSupply: 10, basePrice: 15 });
  assert.deepEqual(listMerchForCard(store, card.id), []);
});

test('a historic card (no real subjectPersonId) only ever sees explicitly-linked merch, never a creator-match false positive', () => {
  const store = createVokenStore();
  const card = mintHistoricCard(store, {
    historicSlug: 'printing-press', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
  assert.equal(card.subjectPersonId, null);
  createMerchListing(store, { creatorId: 'operator-jane', itemType: 'poster', totalSupply: 50, basePrice: 10 });
  assert.deepEqual(listMerchForCard(store, card.id), [], 'the operator who minted it is not "the subject" -- their merch must not leak in');

  const linked = createMerchListing(store, {
    creatorId: 'operator-jane', itemType: 'poster', totalSupply: 50, basePrice: 10, linkedCultureCardId: card.id,
  });
  const result = listMerchForCard(store, card.id);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, linked.id, 'an explicit link still works even with no real subject');
});

test('several real listings for the same card all show up together, none duplicated', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  createMerchListing(store, { creatorId: 'ada', itemType: 't-shirt', totalSupply: 100, basePrice: 25, linkedCultureCardId: card.id });
  createMerchListing(store, { creatorId: 'ada', itemType: 'poster', totalSupply: 50, basePrice: 10 });
  createMerchListing(store, { creatorId: 'ben', itemType: 'hat', totalSupply: 10, basePrice: 15 });
  assert.equal(listMerchForCard(store, card.id).length, 2);
});

test('listMerchForCard refuses an unknown card', () => {
  const store = createVokenStore();
  assert.throws(() => listMerchForCard(store, 999999), /no card with id 999999/);
});
