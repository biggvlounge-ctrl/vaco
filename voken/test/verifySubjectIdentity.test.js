// VOKEN -- real subject self-verification, by direct instruction: "I
// want people to be able to verify their own cards to show that that
// is them and they verify it." The failure this file exists to
// catch: anyone other than the card's own real subject managing to
// verify it -- the whole point of the feature is that this
// particular checkmark means something real.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  mintCultureCard, mintExternalEntityCard, verifySubjectIdentity, getCultureCard,
} = require('../lib/cultureCards');

function mintPersonCard(store, subjectPersonId = 'ada') {
  return mintCultureCard(store, {
    subjectPersonId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

test('a freshly minted person-subject card is not yet verified', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  assert.equal(card.verifiedBySubject, false);
  assert.equal(card.verifiedBySubjectAt, null);
});

test('the card\'s own real subject can verify it', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  const verified = verifySubjectIdentity(store, { cardId: card.id, verifierId: 'ada' });
  assert.equal(verified.verifiedBySubject, true);
  assert.ok(Number.isFinite(verified.verifiedBySubjectAt));
  assert.equal(getCultureCard(store, card.id).verifiedBySubject, true);
});

test('nobody else can verify a card that is not about them, the whole point of the feature', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store, 'ada');
  assert.throws(
    () => verifySubjectIdentity(store, { cardId: card.id, verifierId: 'ben' }),
    /only card \d+'s own real subject may verify it/,
  );
  assert.equal(getCultureCard(store, card.id).verifiedBySubject, false);
});

test('a card with no living subject (an external-entity card) cannot be "verified" by anyone', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, {
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'WL-LOC-0001',
    mintedByUserId: 'operator-jane', mintedByRole: 'operator',
    category: 'landmarks', rarityTier: 'rare', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
  assert.throws(
    () => verifySubjectIdentity(store, { cardId: card.id, verifierId: 'operator-jane' }),
    /has no living subject to verify/,
  );
});

test('verifySubjectIdentity requires a verifierId and refuses an unknown card', () => {
  const store = createVokenStore();
  const card = mintPersonCard(store);
  assert.throws(
    () => verifySubjectIdentity(store, { cardId: card.id }),
    /requires a verifierId/,
  );
  assert.throws(
    () => verifySubjectIdentity(store, { cardId: 999999, verifierId: 'ada' }),
    /no card with id 999999/,
  );
});
