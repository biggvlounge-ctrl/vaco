// VOKEN — Cvltvre Cards (the VDAS core asset type).
// Source of truth: VOKEN_ARCHITECTURE.md's `CultureCard` data model,
// VOKEN_NEW_VALUE_ALGORITHM.md's real, confirmed requirements:
//
// (1) Mint transparency, visible before you even apply -- planned
// digital/physical mint counts are set at mint time and never hidden.
// (2) The subject always gets card #1 -- the actual person a card is
// about receives the very first minted copy (digital and physical, if
// planned), a guaranteed right, not something bought or won like
// everyone else. Implemented literally: `mintCultureCard()` performs
// that first mint itself, atomically, before the card is returned.

const { CATEGORIES, RARITY_TIERS, TOKENIZATION_TYPES, FORMATS } = require('./cardTypes');

function mintCultureCard(store, options = {}) {
  const {
    subjectPersonId, category, rarityTier, tokenizationType, formats = [],
    plannedDigitalMintCount, plannedPhysicalMintCount = 0,
  } = options;

  if (!subjectPersonId) throw new Error('mintCultureCard requires a subjectPersonId');
  if (!CATEGORIES.includes(category)) {
    throw new Error(`mintCultureCard: invalid category "${category}" (expected one of ${CATEGORIES.join(', ')})`);
  }
  if (!RARITY_TIERS.includes(rarityTier)) {
    throw new Error(`mintCultureCard: invalid rarityTier "${rarityTier}" (expected one of ${RARITY_TIERS.join(', ')})`);
  }
  if (!TOKENIZATION_TYPES.includes(tokenizationType)) {
    throw new Error(`mintCultureCard: invalid tokenizationType "${tokenizationType}" (expected one of ${TOKENIZATION_TYPES.join(', ')})`);
  }
  if (!Array.isArray(formats) || formats.length === 0) {
    throw new Error('mintCultureCard requires at least one format');
  }
  for (const f of formats) {
    if (!FORMATS.includes(f)) {
      throw new Error(`mintCultureCard: invalid format "${f}" (expected one of ${FORMATS.join(', ')})`);
    }
  }
  if (!Number.isInteger(plannedDigitalMintCount) || plannedDigitalMintCount < 1) {
    throw new Error('mintCultureCard requires a positive integer plannedDigitalMintCount');
  }
  if (!Number.isInteger(plannedPhysicalMintCount) || plannedPhysicalMintCount < 0) {
    throw new Error('mintCultureCard requires a non-negative integer plannedPhysicalMintCount');
  }

  const card = {
    id: store.nextCardId++,
    subjectPersonId,
    category,
    rarityTier,
    tokenizationType,
    formats,
    mintPlan: {
      plannedDigitalMintCount,
      plannedPhysicalMintCount,
      visibleAtApplicationStage: true,
    },
    editions: [],
    provenance: [],
    createdAt: Date.now(),
  };

  // The real, guaranteed right: the subject gets the literal first
  // mint, both digital and physical (if planned), before anyone else.
  card.editions.push({ editionNumber: 1, format: 'digital', ownerId: subjectPersonId, mintedAt: card.createdAt });
  if (plannedPhysicalMintCount > 0) {
    card.editions.push({ editionNumber: 1, format: 'physical', ownerId: subjectPersonId, mintedAt: card.createdAt });
  }
  card.provenance.push({ year: new Date(card.createdAt).getFullYear(), event: 'minted', ownerId: subjectPersonId });

  store.cultureCards.push(card);
  return card;
}

function getCultureCard(store, cardId) {
  return store.cultureCards.find((c) => c.id === cardId) || null;
}

function listCultureCardsByCategory(store, category) {
  return store.cultureCards.filter((c) => c.category === category);
}

function countMintedEditions(card, format) {
  return card.editions.filter((e) => e.format === format).length;
}

// Every additional edition beyond the subject's guaranteed first copy
// goes through this -- real enforcement against the mint plan, never
// silently exceeding what was disclosed at application/mint time.
function mintAdditionalEdition(store, options = {}) {
  const { cardId, format, ownerId } = options;
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`mintAdditionalEdition: no card with id ${cardId}`);
  if (format !== 'digital' && format !== 'physical') {
    throw new Error('mintAdditionalEdition: format must be "digital" or "physical"');
  }
  if (!ownerId) throw new Error('mintAdditionalEdition requires an ownerId');

  const plannedCount = format === 'digital' ? card.mintPlan.plannedDigitalMintCount : card.mintPlan.plannedPhysicalMintCount;
  const alreadyMinted = countMintedEditions(card, format);
  if (alreadyMinted >= plannedCount) {
    throw new Error(`mintAdditionalEdition: card ${cardId} has already minted all ${plannedCount} planned ${format} editions`);
  }

  const edition = { editionNumber: alreadyMinted + 1, format, ownerId, mintedAt: Date.now() };
  card.editions.push(edition);
  card.provenance.push({ year: new Date(edition.mintedAt).getFullYear(), event: `minted-edition-${edition.editionNumber}-${format}`, ownerId });
  return { ...edition, serialNumber: serialNumberFor(card, edition) };
}

//: Serial number display, per VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md's
//: "explicit serial numbering on every Cvltvre Card ... real, visible
//: scarcity ('Rookie Card #12/500'), not just internal rarity-tier
//: metadata."
//:
//: Worth being precise about what was and was not at risk here. That
//: document was read as requiring new capture at mint time -- and mint
//: order genuinely is only knowable at mint time, so a missing ordinal
//: would have been unrecoverable. It was never missing:
//: `mintAdditionalEdition` has always assigned `editionNumber` as
//: `alreadyMinted + 1`. What was absent was only the *rendered* form.
//:
//: So this is a derivation over data already captured, not a
//: migration. Every edition ever minted gets a correct serial
//: retroactively, because the ordinal was always there.
function serialNumberFor(card, edition) {
  if (!card || !edition) throw new Error('serialNumberFor requires a card and an edition');
  const total = edition.format === 'digital'
    ? card.mintPlan.plannedDigitalMintCount
    : card.mintPlan.plannedPhysicalMintCount;
  return `${edition.editionNumber}/${total}`;
}

// Every edition on a card, each with its display serial attached --
// the shape a card detail view actually needs.
function listEditionsWithSerials(store, cardId) {
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`listEditionsWithSerials: no card with id ${cardId}`);
  return card.editions.map((e) => ({
    ...e,
    serialNumber: serialNumberFor(card, e),
    //: The Rookie designation is real and already drives a 15% weight
    //: in valueAlgorithm.js; surfacing it beside the serial is what
    //: makes "Rookie Card #12/500" renderable as one label.
    displayLabel: `${card.isRookieDesignation ? 'Rookie Card ' : ''}#${serialNumberFor(card, e)}`,
  }));
}

function transferEditionOwnership(store, options = {}) {
  const { cardId, editionNumber, format, fromOwnerId, toOwnerId } = options;
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`transferEditionOwnership: no card with id ${cardId}`);
  const edition = card.editions.find((e) => e.editionNumber === editionNumber && e.format === format);
  if (!edition) throw new Error(`transferEditionOwnership: no ${format} edition #${editionNumber} on card ${cardId}`);
  if (edition.ownerId !== fromOwnerId) {
    throw new Error(`transferEditionOwnership: edition is not owned by ${fromOwnerId}`);
  }
  if (!toOwnerId) throw new Error('transferEditionOwnership requires a toOwnerId');

  edition.ownerId = toOwnerId;
  card.provenance.push({ year: new Date().getFullYear(), event: `transferred-${format}-${editionNumber}`, ownerId: toOwnerId });
  return edition;
}

module.exports = {
  serialNumberFor,
  listEditionsWithSerials,
  mintCultureCard,
  getCultureCard,
  listCultureCardsByCategory,
  countMintedEditions,
  mintAdditionalEdition,
  transferEditionOwnership,
};
