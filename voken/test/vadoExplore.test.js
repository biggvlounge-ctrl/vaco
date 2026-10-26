// VOKEN -- VADO's Instagram-Explore-style browsing surface, added by
// direct instruction: "Bado [VADO] to have the same Instagram feel to
// it and explore page feel to it, similar to Culture Cards." Three
// real sections (live-auction/for-sale/gallery), grounded in VADO's
// own real market state, not invented categories. The failure this
// file exists to catch: a piece with an open auction showing up in
// "for-sale" or "gallery" instead of "live-auction" -- the one
// mis-section that would actually mislead a real buyer.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { createArtCultureCard, setForSale } = require('../lib/artCultureCard');
const { createAuction } = require('../lib/auctions');
const { VADO_EXPLORE_SECTIONS, getVadoExplorePage } = require('../lib/vadoExplore');

function makeArtCard(store, artistId, overrides = {}) {
  return createArtCultureCard(store, {
    artistId, rarityTier: 'rare', digitalEditionCount: 10, ...overrides,
  });
}

test('every real piece lands in exactly one of the three real sections, in a fixed order', () => {
  const store = createVokenStore();
  makeArtCard(store, 'ada');
  const page = getVadoExplorePage(store);
  assert.deepEqual(page.sections.map((s) => s.section), VADO_EXPLORE_SECTIONS);
});

test('a piece with a real open auction lands in "live-auction", not "for-sale" or "gallery"', () => {
  const store = createVokenStore();
  const { card, artRecord } = makeArtCard(store, 'ada');
  setForSale(store, { cardId: card.id, isForSale: true }); // also for sale, but the auction takes priority
  createAuction(store, {
    cardId: card.id, editionNumber: 1, format: 'digital', sellerId: 'ada', auctionType: 'instant', startingPrice: 100,
  });

  const page = getVadoExplorePage(store);
  const liveAuction = page.sections.find((s) => s.section === 'live-auction');
  const forSale = page.sections.find((s) => s.section === 'for-sale');
  assert.equal(liveAuction.cards.length, 1);
  assert.equal(liveAuction.cards[0].contentId, card.id);
  assert.equal(forSale.cards.length, 0);
  assert.ok(artRecord.isForSale);
});

test('a piece marked for sale with no open auction lands in "for-sale"', () => {
  const store = createVokenStore();
  const { card } = makeArtCard(store, 'ada');
  setForSale(store, { cardId: card.id, isForSale: true });

  const page = getVadoExplorePage(store);
  const forSale = page.sections.find((s) => s.section === 'for-sale');
  assert.equal(forSale.cards.length, 1);
  assert.equal(forSale.cards[0].contentId, card.id);
});

test('a piece that is neither auctioned nor for sale lands in "gallery"', () => {
  const store = createVokenStore();
  const { card } = makeArtCard(store, 'ada');

  const page = getVadoExplorePage(store);
  const gallery = page.sections.find((s) => s.section === 'gallery');
  assert.equal(gallery.cards.length, 1);
  assert.equal(gallery.cards[0].contentId, card.id);
  assert.equal(gallery.cards[0].isForSale, false);
});

test('a non-art card never appears in VADO\'s explore page', () => {
  const store = createVokenStore();
  makeArtCard(store, 'ada');
  const { mintCultureCard } = require('../lib/cultureCards');
  mintCultureCard(store, {
    subjectPersonId: 'ben', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });

  const page = getVadoExplorePage(store);
  assert.equal(page.totalCards, 1);
});

test('within a section, pieces rank by real attentionScore, not insertion order', () => {
  const store = createVokenStore();
  const { card: quiet } = makeArtCard(store, 'ada');
  const { card: loud } = makeArtCard(store, 'ben');
  setForSale(store, { cardId: quiet.id, isForSale: true });
  setForSale(store, { cardId: loud.id, isForSale: true });

  const { recordEngagementEvent } = require('../lib/cardEngagement');
  for (let i = 0; i < 20; i += 1) recordEngagementEvent(store, { cardId: loud.id, type: 'like' });

  const page = getVadoExplorePage(store);
  const forSale = page.sections.find((s) => s.section === 'for-sale');
  assert.equal(forSale.cards[0].contentId, loud.id);
  assert.ok(forSale.cards[0].attentionScore > forSale.cards[1].attentionScore);
});
