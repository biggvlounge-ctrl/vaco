// VOKEN — VADO's ArtCultureCard.
// Source of truth: VOKEN_MASTER_SPEC_PROGRESS.md / VOKEN_ARCHITECTURE.md:
// art pieces are Cvltvre Cards with a real physical-original + limited-
// digital-edition structure layered on top. Real code reuse: this
// module calls Phase 1's own `mintCultureCard()` (category: 'art') to
// get the real card-#1-to-subject guarantee and mint-transparency
// mechanics for free, then layers a separate `artCultureCards` record
// linked by `cardId` -- the same own-entity-linked-by-id resolution
// already used for VOID's `VoidLocker` (linked via `stationId`, not
// merged into `VoidStation`), not merged into the base `CultureCard`
// shape.

const { mintCultureCard, getCultureCard } = require('./cultureCards');

function createArtCultureCard(store, options = {}) {
  const {
    artistId, subjectPersonId = artistId, rarityTier, tokenizationType = 'tokenized',
    physicalOriginalExists = false, digitalEditionCount,
  } = options;

  if (!artistId) throw new Error('createArtCultureCard requires an artistId');
  if (!Number.isInteger(digitalEditionCount) || digitalEditionCount < 1) {
    throw new Error('createArtCultureCard requires a positive integer digitalEditionCount');
  }

  const formats = ['digital'];
  if (physicalOriginalExists) formats.push('physical');

  const card = mintCultureCard(store, {
    subjectPersonId,
    category: 'art',
    rarityTier,
    tokenizationType,
    formats,
    plannedDigitalMintCount: digitalEditionCount,
    // A physical "original" is a single, one-of-one physical piece --
    // never a run, regardless of how many digital editions exist.
    plannedPhysicalMintCount: physicalOriginalExists ? 1 : 0,
  });

  const artRecord = {
    cardId: card.id,
    artistId,
    physicalOriginalExists,
    physicalOriginalOwnerId: physicalOriginalExists ? subjectPersonId : null,
    digitalEditionCount,
    isForSale: false,
    viewCount: 0,
    createdAt: Date.now(),
  };
  store.artCultureCards.push(artRecord);
  return { card, artRecord };
}

function getArtCultureCard(store, cardId) {
  return store.artCultureCards.find((a) => a.cardId === cardId) || null;
}

function setForSale(store, options = {}) {
  const { cardId, isForSale } = options;
  const record = getArtCultureCard(store, cardId);
  if (!record) throw new Error(`setForSale: no art Cvltvre card record for cardId ${cardId}`);
  if (typeof isForSale !== 'boolean') throw new Error('setForSale requires a boolean isForSale');
  record.isForSale = isForSale;
  return record;
}

// View counts track real gallery attention regardless of for-sale
// status, per the doc -- browsing a piece isn't conditioned on it
// being purchasable right now.
function recordArtView(store, options = {}) {
  const { cardId } = options;
  const record = getArtCultureCard(store, cardId);
  if (!record) throw new Error(`recordArtView: no art Cvltvre card record for cardId ${cardId}`);
  record.viewCount += 1;
  return record;
}

module.exports = { createArtCultureCard, getArtCultureCard, setForSale, recordArtView };
