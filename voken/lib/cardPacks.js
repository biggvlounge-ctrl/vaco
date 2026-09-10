// VOKEN — the Card Pack system.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md's real, structured
// pack-tier table (basic/standard/premium/chase, each with a real
// price point, card count, and guaranteed minimum rarity) matching
// how actual baseball card packs work. Real code reuse: opening a
// pack mints a real additional edition to the buyer through
// `mintAdditionalEdition()`, the same mechanic anything else that
// distributes a card would use -- not a separate, parallel minting
// path.

const { RARITY_TIERS, CATEGORIES } = require('./cardTypes');
const { getCultureCard, countMintedEditions, mintAdditionalEdition } = require('./cultureCards');
const { VOKEN_PLATFORM_ACCOUNT } = require('./platformAccount');

const PACK_TIER_NAMES = ['basic', 'standard', 'premium', 'chase'];
const DIGITAL_OR_PHYSICAL = ['digital', 'physical', 'both-available'];
const CATEGORY_POOLS = [...CATEGORIES, 'mixed'];
const RARITY_RANK = Object.fromEntries(RARITY_TIERS.map((t, i) => [t, i]));

// No real cardsPerPack numbers are given anywhere -- flagged,
// interpretive defaults matching the doc's own qualitative "fewer,
// higher-value cards" framing for chase packs.
const DEFAULT_CARDS_PER_PACK = { basic: 5, standard: 5, premium: 5, chase: 3 };

function createPackTier(store, options = {}) {
  const { tierName, price, cardsPerPack = DEFAULT_CARDS_PER_PACK[options.tierName], guaranteedMinimumRarity = null, digitalOrPhysical = 'digital', categoryPool = 'mixed' } = options;

  if (!PACK_TIER_NAMES.includes(tierName)) {
    throw new Error(`createPackTier: invalid tierName "${tierName}" (expected one of ${PACK_TIER_NAMES.join(', ')})`);
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('createPackTier requires a positive price');
  }
  if (!Number.isInteger(cardsPerPack) || cardsPerPack <= 0) {
    throw new Error('createPackTier requires a positive integer cardsPerPack');
  }
  if (guaranteedMinimumRarity !== null && !RARITY_TIERS.includes(guaranteedMinimumRarity)) {
    throw new Error(`createPackTier: invalid guaranteedMinimumRarity "${guaranteedMinimumRarity}"`);
  }
  if (!DIGITAL_OR_PHYSICAL.includes(digitalOrPhysical)) {
    throw new Error(`createPackTier: invalid digitalOrPhysical "${digitalOrPhysical}"`);
  }
  if (!CATEGORY_POOLS.includes(categoryPool)) {
    throw new Error(`createPackTier: invalid categoryPool "${categoryPool}"`);
  }

  const packTier = {
    packTierId: store.nextPackTierId++,
    tierName, price, cardsPerPack, guaranteedMinimumRarity, digitalOrPhysical, categoryPool,
  };
  store.cardPackTiers.push(packTier);
  return packTier;
}

function getPackTier(store, packTierId) {
  return store.cardPackTiers.find((t) => t.packTierId === packTierId) || null;
}

function shuffle(array, rng) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The real blind-pack mechanic: random selection from an available
// pool, with the tier's guaranteed-minimum-rarity real enforced --
// if the random draw doesn't naturally include a card meeting the
// guarantee, the best-available qualifying card is swapped in rather
// than the guarantee silently going unmet.
//
// Real charge, closing a gap this session's own deployment-guide
// investigation found: openPack minted real cards to a real buyer
// without ever actually charging them -- packTier.price was a real
// field nothing collected. Now a real settleFn(buyerId,
// VOKEN_PLATFORM_ACCOUNT, packTier.price, ...) fires after the pack's
// real contents are resolved (so a real "no qualifying card" failure
// below never charges a buyer for a pack that couldn't be filled) but
// before minting (a buyer who paid always gets real cards back).
async function openPack(store, options = {}) {
  const {
    packTierId, buyerId, candidateCardIds, settleFn, rng = Math.random,
  } = options;

  const packTier = getPackTier(store, packTierId);
  if (!packTier) throw new Error(`openPack: no pack tier with id ${packTierId}`);
  if (!buyerId) throw new Error('openPack requires a buyerId');
  if (!Array.isArray(candidateCardIds) || candidateCardIds.length === 0) {
    throw new Error('openPack requires at least one candidateCardId');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('openPack requires a settleFn(legs, meta)');
  }

  const available = candidateCardIds
    .map((id) => getCultureCard(store, id))
    .filter((card) => card && countMintedEditions(card, 'digital') < card.mintPlan.plannedDigitalMintCount);

  if (available.length === 0) {
    throw new Error('openPack: no candidate cards have any remaining digital editions to mint');
  }

  const drawCount = Math.min(packTier.cardsPerPack, available.length);
  let selected = shuffle(available, rng).slice(0, drawCount);

  if (packTier.guaranteedMinimumRarity) {
    const requiredRank = RARITY_RANK[packTier.guaranteedMinimumRarity];
    const alreadyMeetsGuarantee = selected.some((c) => RARITY_RANK[c.rarityTier] >= requiredRank);
    if (!alreadyMeetsGuarantee) {
      const qualifying = available
        .filter((c) => RARITY_RANK[c.rarityTier] >= requiredRank)
        .sort((a, b) => RARITY_RANK[b.rarityTier] - RARITY_RANK[a.rarityTier]);
      if (qualifying.length === 0) {
        throw new Error(`openPack: no available card meets the guaranteed minimum rarity "${packTier.guaranteedMinimumRarity}"`);
      }
      selected = [qualifying[0], ...selected.slice(0, drawCount - 1)];
    }
  }

  await settleFn(
    [{ fromUserId: buyerId, toUserId: VOKEN_PLATFORM_ACCOUNT, amount: packTier.price, reason: `voken_pack_open:${packTierId}` }],
    { reason: `voken_pack_open:${packTierId}` },
  );

  const cardsReceived = selected.map((card) => ({
    card,
    edition: mintAdditionalEdition(store, { cardId: card.id, format: 'digital', ownerId: buyerId }),
  }));

  return {
    packTierId, buyerId, pricePaid: packTier.price, cardsReceived,
  };
}

module.exports = {
  PACK_TIER_NAMES,
  DIGITAL_OR_PHYSICAL,
  CATEGORY_POOLS,
  DEFAULT_CARDS_PER_PACK,
  createPackTier,
  getPackTier,
  openPack,
};
