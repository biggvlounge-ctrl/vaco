// VOKEN -- real, owner-updatable accomplishment statistics, by direct
// instruction: "the owner of the card, the verified owner of the
// card, can update the statistics on the card... instead of 6 movies,
// if it turns to 8 published movies, you can change those type of
// things." The failure this file exists to catch: anyone other than
// a card's real verified subject, approved family representative, or
// verified owner managing to rewrite its statistics -- the whole
// point of gating this at all.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  mintCultureCard, mintExternalEntityCard, mintHistoricCard, verifySubjectIdentity, updateCardStatistics, getCultureCard,
} = require('../lib/cultureCards');
const { submitFamilyRepresentativeClaim, reviewFamilyRepresentativeClaim } = require('../lib/familyRepresentativeClaims');

function mintPersonCard(store, subjectPersonId = 'ada') {
  return mintCultureCard(store, {
    subjectPersonId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a freshly minted card has no statistics yet', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  assert.deepEqual(card.statistics, {});
});

test('an unverified subject cannot update statistics -- must verify first', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  assert.throws(
    () => updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: { movies: 6 } }),
    /has no real authority/,
  );
});

test('a verified subject can update their own card\'s statistics, merging rather than replacing', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  verifySubjectIdentity(store, { cardId: card.id, verifierId: 'ada' });

  updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: { movies: 6, albums: 2 } });
  assert.deepEqual(getCultureCard(store, card.id).statistics, { movies: 6, albums: 2 });

  // "instead of 6 movies, if it turns to 8" -- a later update changes
  // one real field without erasing the others.
  updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: { movies: 8 } });
  assert.deepEqual(getCultureCard(store, card.id).statistics, { movies: 8, albums: 2 });
});

test('nobody else can update a verified subject\'s card, not even a different real user', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  verifySubjectIdentity(store, { cardId: card.id, verifierId: 'ada' });
  assert.throws(
    () => updateCardStatistics(store, { cardId: card.id, updaterId: 'ben', statistics: { movies: 6 } }),
    /has no real authority/,
  );
});

test('an approved family representative can update a historic person card\'s statistics', () => {
  const store = createVokenStore();
  const claim = submitFamilyRepresentativeClaim(store, {
    claimantId: 'descendant-sam', historicSlug: 'johannes-gutenberg', relationship: 'descendant',
  });
  reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: true, operatorName: 'operator-jane' });
  const card = mintHistoricCard(store, {
    historicSlug: 'johannes-gutenberg', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });

  updateCardStatistics(store, { cardId: card.id, updaterId: 'descendant-sam', statistics: { biographiesPublishedAboutSubject: 12 } });
  assert.deepEqual(getCultureCard(store, card.id).statistics, { biographiesPublishedAboutSubject: 12 });
});

test('a verified owner of an external-entity card can update its statistics; an operator-curated one cannot', () => {
  const store = createVokenStore();
  const ownerCard = mintExternalEntityCard(store, {
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'WL-LOC-0001',
    mintedByUserId: 'owner-jamal', mintedByRole: 'owner',
    category: 'landmarks', rarityTier: 'rare', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  updateCardStatistics(store, { cardId: ownerCard.id, updaterId: 'owner-jamal', statistics: { annualVisitorCount: 50000 } });
  assert.deepEqual(getCultureCard(store, ownerCard.id).statistics, { annualVisitorCount: 50000 });

  const operatorCard = mintExternalEntityCard(store, {
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'WL-LOC-0002',
    mintedByUserId: 'operator-jane', mintedByRole: 'operator',
    category: 'landmarks', rarityTier: 'rare', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  assert.throws(
    () => updateCardStatistics(store, { cardId: operatorCard.id, updaterId: 'operator-jane', statistics: { annualVisitorCount: 50000 } }),
    /has no real authority/,
  );
});

test('updateCardStatistics requires a non-empty object of real number/string values, and refuses an unknown card', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  verifySubjectIdentity(store, { cardId: card.id, verifierId: 'ada' });

  assert.throws(() => updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: {} }), /non-empty statistics object/);
  assert.throws(() => updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: null }), /non-empty statistics object/);
  assert.throws(
    () => updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: { movies: [1, 2] } }),
    /must be a real number or string/,
  );
  assert.throws(
    () => updateCardStatistics(store, { cardId: 999999, updaterId: 'ada', statistics: { movies: 1 } }),
    /no card with id 999999/,
  );
});

test('updateCardStatistics records a real provenance entry for accountability', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  verifySubjectIdentity(store, { cardId: card.id, verifierId: 'ada' });
  updateCardStatistics(store, { cardId: card.id, updaterId: 'ada', statistics: { movies: 6 } });
  const entry = getCultureCard(store, card.id).provenance.find((p) => p.event === 'statistics-updated');
  assert.ok(entry);
  assert.equal(entry.ownerId, 'ada');
});
