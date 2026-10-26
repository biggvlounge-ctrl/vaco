// VOKEN -- real resale royalty, by direct instruction: "now they have
// an asset which is their own card" -- a card's real subject should
// keep earning from it, not just at the first mint. The failure this
// file exists to catch: a royalty silently not paid on a genuine
// resale, or paid twice, or paid to the wrong real recipient.

const test = require('node:test');
const assert = require('node:assert');

const {
  mintCultureCard, mintExternalEntityCard, mintHistoricCard,
  getRoyaltyRecipient, SECONDARY_SALE_ROYALTY_RATE, mintAdditionalEdition,
} = require('../lib/cultureCards');
const { submitFamilyRepresentativeClaim, reviewFamilyRepresentativeClaim } = require('../lib/familyRepresentativeClaims');
const { createVokenStore } = require('../lib/store');
const { createAuction, placeBid } = require('../lib/auctions');

function ledger(initial = {}) {
  const balances = { ...initial };
  const fn = async (legs) => {
    for (const { fromUserId, toUserId, amount } of legs) {
      balances[fromUserId] = (balances[fromUserId] || 0) - amount;
      balances[toUserId] = (balances[toUserId] || 0) + amount;
    }
    return { ok: true };
  };
  fn.of = (a) => balances[a] || 0;
  return fn;
}

test('getRoyaltyRecipient returns the real living subject first', () => {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  assert.equal(getRoyaltyRecipient(card), 'ada');
});

test('getRoyaltyRecipient falls back to an approved family representative for a historic person card', () => {
  const store = createVokenStore();
  const claim = submitFamilyRepresentativeClaim(store, {
    claimantId: 'descendant-sam', historicSlug: 'johannes-gutenberg', relationship: 'descendant',
  });
  reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: true, operatorName: 'operator-jane' });
  const card = mintHistoricCard(store, {
    historicSlug: 'johannes-gutenberg', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
  assert.equal(getRoyaltyRecipient(card), 'descendant-sam');
});

test('getRoyaltyRecipient falls back to a verified external-entity owner', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, {
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'WL-LOC-0001',
    mintedByUserId: 'owner-jamal', mintedByRole: 'owner',
    category: 'landmarks', rarityTier: 'rare', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  assert.equal(getRoyaltyRecipient(card), 'owner-jamal');
});

test('getRoyaltyRecipient is honestly null for a fixed historic place and an operator-curated external entity', () => {
  const store = createVokenStore();
  const historic = mintHistoricCard(store, {
    historicSlug: 'stonehenge', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
  assert.equal(getRoyaltyRecipient(historic), null);

  const external = mintExternalEntityCard(store, {
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'WL-LOC-0002',
    mintedByUserId: 'operator-jane', mintedByRole: 'operator',
    category: 'landmarks', rarityTier: 'rare', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  assert.equal(getRoyaltyRecipient(external), null);
});

test('a real secondary sale by someone other than the subject pays the real royalty', async () => {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  // ada (the subject) transfers their own edition to ben first, off
  // the real books (a gift/trade), so ben can resell it.
  mintAdditionalEdition(store, { cardId: card.id, format: 'digital', ownerId: 'ben' });

  const settleFn = ledger({ carla: 1000 });
  const auction = createAuction(store, {
    cardId: card.id, editionNumber: 2, format: 'digital', sellerId: 'ben',
    auctionType: 'instant', startingPrice: 200, reservePrice: 200,
  });
  await placeBid(store, { auctionId: auction.id, bidderId: 'carla', bidAmount: 200, settleFn });

  const expectedRoyalty = Math.round(200 * SECONDARY_SALE_ROYALTY_RATE * 100) / 100;
  assert.equal(settleFn.of('ada'), expectedRoyalty, 'the real subject, no party to this sale at all, must still receive the real royalty');
  assert.equal(settleFn.of('ben'), 200 - expectedRoyalty, 'the real seller nets the sale price minus the real royalty');
  assert.equal(settleFn.of('carla'), 1000 - 200, 'the real buyer still pays exactly the sale price, no more');

  const settled = getAuction(store, auction.id);
  assert.equal(settled.royaltyRecipient, 'ada');
  assert.equal(settled.royaltyAmount, expectedRoyalty);
});

function getAuction(store, auctionId) {
  return store.auctions.find((a) => a.id === auctionId);
}

test('the subject selling their own card keeps the full real proceeds -- no pointless self-royalty leg', async () => {
  const store = createVokenStore();
  const card = mintCultureCard(store, {
    subjectPersonId: 'ada', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  const settleFn = ledger({ carla: 1000 });
  const auction = createAuction(store, {
    cardId: card.id, editionNumber: 1, format: 'digital', sellerId: 'ada',
    auctionType: 'instant', startingPrice: 200, reservePrice: 200,
  });
  await placeBid(store, { auctionId: auction.id, bidderId: 'carla', bidAmount: 200, settleFn });

  assert.equal(settleFn.of('ada'), 200, 'the subject selling their own card gets the full real price, not a royalty-reduced cut of their own sale');
  const settled = getAuction(store, auction.id);
  assert.equal(settled.royaltyRecipient, null);
  assert.equal(settled.royaltyAmount, 0);
});

test('a card with no real royalty recipient settles exactly as before -- a single, full-price leg', async () => {
  const store = createVokenStore();
  const card = mintHistoricCard(store, {
    historicSlug: 'stonehenge', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
  mintAdditionalEdition(store, { cardId: card.id, format: 'digital', ownerId: 'ben' });

  const settleFn = ledger({ carla: 1000 });
  const auction = createAuction(store, {
    cardId: card.id, editionNumber: 1, format: 'digital', sellerId: 'ben',
    auctionType: 'instant', startingPrice: 200, reservePrice: 200,
  });
  await placeBid(store, { auctionId: auction.id, bidderId: 'carla', bidAmount: 200, settleFn });

  assert.equal(settleFn.of('ben'), 200, 'no real royalty recipient exists, so the seller must still receive the real full price');
});
