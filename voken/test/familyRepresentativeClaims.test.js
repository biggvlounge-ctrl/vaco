// VOKEN -- the real "master card goes to the family" guarantee, by
// direct instruction: "for the people who aren't living, the initial
// card... the master card, goes to the family." The failure this file
// exists to catch: a deceased person's master edition going to nobody
// when a real, approved family representative is on file, or going to
// an unverified stranger's claim that was never reviewed.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  submitFamilyRepresentativeClaim, reviewFamilyRepresentativeClaim, getApprovedFamilyRepresentative,
} = require('../lib/familyRepresentativeClaims');
const { mintHistoricCard } = require('../lib/cultureCards');

function mintPrintingPress(store) {
  return mintHistoricCard(store, {
    historicSlug: 'printing-press', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
}

function mintGutenbergCard(store) {
  return mintHistoricCard(store, {
    historicSlug: 'johannes-gutenberg', mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital', 'physical'],
    plannedDigitalMintCount: 500, plannedPhysicalMintCount: 50,
  });
}

test('a historic person card with no approved family representative mints with no owner, honestly', () => {
  const store = createVokenStore();
  const card = mintGutenbergCard(store);
  assert.equal(card.familyRepresentativeId, null);
  assert.equal(card.editions.length, 0);
});

test('a claim is only accepted for a person entry, not a place/monument/invention/book', () => {
  const store = createVokenStore();
  assert.throws(
    () => submitFamilyRepresentativeClaim(store, {
      claimantId: 'descendant-sam', historicSlug: 'printing-press', relationship: 'descendant',
    }),
    /is a "invention", not a person/,
  );
});

test('an approved family representative receives the real master edition (digital + physical)', () => {
  const store = createVokenStore();
  const claim = submitFamilyRepresentativeClaim(store, {
    claimantId: 'descendant-sam', historicSlug: 'johannes-gutenberg', relationship: 'great-great-grandson',
    evidence: ['genealogy record'],
  });
  assert.equal(claim.status, 'pending-review');

  reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: true, operatorName: 'operator-jane' });
  assert.equal(getApprovedFamilyRepresentative(store, 'johannes-gutenberg'), 'descendant-sam');

  const card = mintGutenbergCard(store);
  assert.equal(card.familyRepresentativeId, 'descendant-sam');
  const digitalFirst = card.editions.find((e) => e.format === 'digital' && e.editionNumber === 1);
  const physicalFirst = card.editions.find((e) => e.format === 'physical' && e.editionNumber === 1);
  assert.equal(digitalFirst.ownerId, 'descendant-sam');
  assert.equal(physicalFirst.ownerId, 'descendant-sam');
});

test('a declined claim never affects minting', () => {
  const store = createVokenStore();
  const claim = submitFamilyRepresentativeClaim(store, {
    claimantId: 'stranger-bob', historicSlug: 'johannes-gutenberg', relationship: 'claims to be related',
  });
  reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: false, operatorName: 'operator-jane', reason: 'no real evidence' });
  assert.equal(getApprovedFamilyRepresentative(store, 'johannes-gutenberg'), null);

  const card = mintGutenbergCard(store);
  assert.equal(card.familyRepresentativeId, null);
});

test('a second approved claim for the same slug is refused -- the master edition is singular', () => {
  const store = createVokenStore();
  const claimA = submitFamilyRepresentativeClaim(store, {
    claimantId: 'descendant-sam', historicSlug: 'johannes-gutenberg', relationship: 'descendant',
  });
  reviewFamilyRepresentativeClaim(store, { claimId: claimA.claimId, approved: true, operatorName: 'operator-jane' });

  assert.throws(
    () => submitFamilyRepresentativeClaim(store, {
      claimantId: 'another-claimant', historicSlug: 'johannes-gutenberg', relationship: 'descendant',
    }),
    /already has an approved family representative/,
  );
});

test('reviewFamilyRepresentativeClaim requires a real operatorName and refuses re-review', () => {
  const store = createVokenStore();
  const claim = submitFamilyRepresentativeClaim(store, {
    claimantId: 'descendant-sam', historicSlug: 'johannes-gutenberg', relationship: 'descendant',
  });
  assert.throws(
    () => reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: true }),
    /requires an operatorName/,
  );
  reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: true, operatorName: 'operator-jane' });
  assert.throws(
    () => reviewFamilyRepresentativeClaim(store, { claimId: claim.claimId, approved: true, operatorName: 'operator-jane' }),
    /not pending-review/,
  );
});
