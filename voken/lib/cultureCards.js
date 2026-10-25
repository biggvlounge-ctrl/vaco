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
const { getHistoricEntry } = require('./historicRegistry');

// Shared by every mint path -- the category/rarity/tokenization/format/
// mint-count validation a person-subject and an external-entity card
// both need identically. Only what each subject *is* differs.
function validateMintParams(options, action) {
  const {
    category, rarityTier, tokenizationType, formats = [],
    plannedDigitalMintCount, plannedPhysicalMintCount = 0,
  } = options;

  if (!CATEGORIES.includes(category)) {
    throw new Error(`${action}: invalid category "${category}" (expected one of ${CATEGORIES.join(', ')})`);
  }
  if (!RARITY_TIERS.includes(rarityTier)) {
    throw new Error(`${action}: invalid rarityTier "${rarityTier}" (expected one of ${RARITY_TIERS.join(', ')})`);
  }
  if (!TOKENIZATION_TYPES.includes(tokenizationType)) {
    throw new Error(`${action}: invalid tokenizationType "${tokenizationType}" (expected one of ${TOKENIZATION_TYPES.join(', ')})`);
  }
  if (!Array.isArray(formats) || formats.length === 0) {
    throw new Error(`${action} requires at least one format`);
  }
  for (const f of formats) {
    if (!FORMATS.includes(f)) {
      throw new Error(`${action}: invalid format "${f}" (expected one of ${FORMATS.join(', ')})`);
    }
  }
  if (!Number.isInteger(plannedDigitalMintCount) || plannedDigitalMintCount < 1) {
    throw new Error(`${action} requires a positive integer plannedDigitalMintCount`);
  }
  if (!Number.isInteger(plannedPhysicalMintCount) || plannedPhysicalMintCount < 0) {
    throw new Error(`${action} requires a non-negative integer plannedPhysicalMintCount`);
  }

  return { category, rarityTier, tokenizationType, formats, plannedDigitalMintCount, plannedPhysicalMintCount };
}

function mintCultureCard(store, options = {}) {
  const { subjectPersonId } = options;
  if (!subjectPersonId) throw new Error('mintCultureCard requires a subjectPersonId');

  const {
    category, rarityTier, tokenizationType, formats,
    plannedDigitalMintCount, plannedPhysicalMintCount,
  } = validateMintParams(options, 'mintCultureCard');

  const card = {
    id: store.nextCardId++,
    subjectPersonId,
    sourceApp: null,
    sourceType: null,
    externalRef: null,
    mintedByUserId: null,
    mintedByRole: null,
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

// A Cvltvre Card about something that is not a person -- a World Layer
// location, a Vavlt Stvdios casino event -- so `mintCultureCard`'s own
// consent mechanism (the subject's guaranteed first copy) does not
// apply: there is no person whose likeness is at stake, and therefore
// no `subjectPersonId`.
//
// **`mintedByRole` decides what the mint guarantees, deliberately
// asymmetric**: a real, *verified* owner/host (checked server-side
// against the owning app, not merely claimed -- see
// `server.js`'s `requireExternalCardAuthority`) gets the same
// guaranteed-first-copy treatment a person subject gets, because they
// have the same real standing. An **operator**-minted card (the only
// path for a subject with no single owner at all -- a World Layer
// location's `ownershipData` is always null; VACON-C, not World Layer,
// would generate it) mints no guaranteed first copy to anyone,
// including the operator themselves: an operator curating a card into
// existence is not the same act as owning what it depicts, and handing
// the operator a free edition would make minting-on-behalf-of a way to
// self-enrich.
const SOURCE_APPS = ['world-layer', 'vavlt-stvdios', 'cvllex'];
const SOURCE_TYPES_BY_APP = {
  'world-layer': ['location'],
  'vavlt-stvdios': ['casino-event'],
  // CVLLEX (VOKEN's star constellation's physical-production app)
  // mints the Cvltvre Card for a produced run through this exact
  // path -- `externalRef` names the CVLLEX production order id.
  // VOKEN stays the one place a Cvltvre Card actually comes from;
  // CVLLEX never gets its own competing token.
  cvllex: ['production-order'],
};
const MINTED_BY_ROLES = ['owner', 'operator'];

function mintExternalEntityCard(store, options = {}) {
  const { sourceApp, sourceType, externalRef, mintedByUserId, mintedByRole } = options;

  if (!SOURCE_APPS.includes(sourceApp)) {
    throw new Error(`mintExternalEntityCard: invalid sourceApp "${sourceApp}" (expected one of ${SOURCE_APPS.join(', ')})`);
  }
  if (!SOURCE_TYPES_BY_APP[sourceApp].includes(sourceType)) {
    throw new Error(`mintExternalEntityCard: invalid sourceType "${sourceType}" for ${sourceApp} (expected one of ${SOURCE_TYPES_BY_APP[sourceApp].join(', ')})`);
  }
  if (!externalRef) throw new Error('mintExternalEntityCard requires an externalRef');
  if (!MINTED_BY_ROLES.includes(mintedByRole)) {
    throw new Error(`mintExternalEntityCard: mintedByRole must be one of ${MINTED_BY_ROLES.join(', ')}`);
  }
  if (!mintedByUserId) throw new Error('mintExternalEntityCard requires a mintedByUserId');

  const {
    category, rarityTier, tokenizationType, formats,
    plannedDigitalMintCount, plannedPhysicalMintCount,
  } = validateMintParams(options, 'mintExternalEntityCard');

  const card = {
    id: store.nextCardId++,
    subjectPersonId: null,
    sourceApp,
    sourceType,
    externalRef,
    mintedByUserId,
    mintedByRole,
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

  if (mintedByRole === 'owner') {
    card.editions.push({ editionNumber: 1, format: 'digital', ownerId: mintedByUserId, mintedAt: card.createdAt });
    if (plannedPhysicalMintCount > 0) {
      card.editions.push({ editionNumber: 1, format: 'physical', ownerId: mintedByUserId, mintedAt: card.createdAt });
    }
    card.provenance.push({ year: new Date(card.createdAt).getFullYear(), event: 'minted', ownerId: mintedByUserId });
  } else {
    card.provenance.push({ year: new Date(card.createdAt).getFullYear(), event: 'minted', ownerId: null });
  }

  store.cultureCards.push(card);
  return card;
}

// A Cvltvre Card about a real historic place, person, invention, or
// book -- informational and educational, grounded against the fixed
// register in `lib/historicRegistry.js` rather than free-text, so a
// historic card's factual content is always real and checkable (see
// that file's own header for why). Structurally the "no single owner"
// shape `mintExternalEntityCard`'s operator path already established:
// nobody owns the Great Wall of China or the invention of the printing
// press, so no guaranteed first edition goes to anyone, including the
// operator who curated the card into existence.
function mintHistoricCard(store, options = {}) {
  const { historicSlug, mintedByUserId } = options;
  if (!historicSlug) throw new Error('mintHistoricCard requires a historicSlug');
  const entry = getHistoricEntry(historicSlug);
  if (!entry) throw new Error(`mintHistoricCard: no historic entry "${historicSlug}" in the register`);
  if (!mintedByUserId) throw new Error('mintHistoricCard requires a mintedByUserId');

  const {
    rarityTier, tokenizationType, formats,
    plannedDigitalMintCount, plannedPhysicalMintCount,
  } = validateMintParams({ ...options, category: 'historic' }, 'mintHistoricCard');

  const card = {
    id: store.nextCardId++,
    subjectPersonId: null,
    sourceApp: null,
    sourceType: null,
    externalRef: null,
    mintedByUserId,
    mintedByRole: 'operator',
    category: 'historic',
    historicSlug: entry.slug,
    historicSubjectType: entry.subjectType,
    historicFact: { name: entry.name, era: entry.era, summary: entry.summary },
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
  card.provenance.push({ year: new Date(card.createdAt).getFullYear(), event: 'minted', ownerId: null });

  store.cultureCards.push(card);
  return card;
}

function listHistoricCards(store, historicSubjectType = null) {
  return store.cultureCards.filter(
    (c) => c.category === 'historic' && (!historicSubjectType || c.historicSubjectType === historicSubjectType),
  );
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
  SOURCE_APPS,
  SOURCE_TYPES_BY_APP,
  MINTED_BY_ROLES,
  serialNumberFor,
  listEditionsWithSerials,
  mintCultureCard,
  mintExternalEntityCard,
  mintHistoricCard,
  listHistoricCards,
  getCultureCard,
  listCultureCardsByCategory,
  countMintedEditions,
  mintAdditionalEdition,
  transferEditionOwnership,
};
