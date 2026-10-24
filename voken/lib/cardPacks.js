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

  // Keyed by a per-open nonce, not packTierId alone. packTierId names
  // a fixed catalog tier (e.g. "basic"), shared by every single
  // purchase of that tier by every buyer forever -- the old key meant
  // the first person anywhere to buy a "basic" pack got charged and
  // minted, and every other buyer of that same tier afterward (a
  // different buyerId, so a genuinely different settlement) would be
  // refused by V3 as "already used for a different request" once its
  // fingerprint actually hashes leg content. Same shape found and
  // fixed across this app's auctions, merch, and fractional-share
  // purchases this session.
  const packOpenId = store.nextPackOpenId++;
  const reason = `voken_pack_open:${packTierId}:${packOpenId}`;
  await settleFn(
    [{ fromUserId: buyerId, toUserId: VOKEN_PLATFORM_ACCOUNT, amount: packTier.price, reason }],
    { reason },
  );

  const cardsReceived = selected.map((card) => ({
    card,
    edition: mintAdditionalEdition(store, { cardId: card.id, format: 'digital', ownerId: buyerId }),
  }));

  return {
    packTierId, buyerId, pricePaid: packTier.price, cardsReceived,
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// P(every one of `drawCount` cards drawn without replacement from a
// pool of `totalSize` comes from a sub-pool of `poolSize`) =
// product_{i=0}^{drawCount-1} (poolSize-i)/(totalSize-i) -- the ratio
// of binomial coefficients C(poolSize,drawCount)/C(totalSize,drawCount)
// written without ever computing either coefficient directly, so it
// never overflows regardless of pool size.
function probabilityAllDrawnFromSubPool(poolSize, totalSize, drawCount) {
  if (drawCount > poolSize) return 0;
  let p = 1;
  for (let i = 0; i < drawCount; i += 1) {
    p *= (poolSize - i) / (totalSize - i);
  }
  return p;
}

// Real, honest pre-purchase odds disclosure, matching the real gap
// against PrizePicks' Packs (pre-purchase odds disclosed per tier
// before buying) -- computed from the *actual* candidate-card pool a
// real `openPack` call would draw from, never a static or invented
// table. Mirrors `openPack`'s own eligibility filter and
// guaranteed-minimum-rarity swap-in exactly, so the disclosed odds are
// the odds that call would actually produce, not an approximation of
// them.
//
// Discloses the probability distribution of the single best (highest-
// rarity) card a pack would contain, plus the derived "at least one
// X-or-better" cumulative odds real card-collectible disclosures use.
function getPackOdds(store, options = {}) {
  const { packTierId, candidateCardIds } = options;

  const packTier = getPackTier(store, packTierId);
  if (!packTier) throw new Error(`getPackOdds: no pack tier with id ${packTierId}`);
  if (!Array.isArray(candidateCardIds) || candidateCardIds.length === 0) {
    throw new Error('getPackOdds requires at least one candidateCardId');
  }

  const available = candidateCardIds
    .map((id) => getCultureCard(store, id))
    .filter((c) => c && countMintedEditions(c, 'digital') < c.mintPlan.plannedDigitalMintCount);

  if (available.length === 0) {
    throw new Error('getPackOdds: no candidate cards have any remaining digital editions to mint');
  }

  const poolSize = available.length;
  const drawCount = Math.min(packTier.cardsPerPack, poolSize);

  const countByRank = RARITY_TIERS.map(() => 0);
  for (const c of available) countByRank[RARITY_RANK[c.rarityTier]] += 1;

  const cumulativeAtOrBelowRank = [];
  let running = 0;
  for (let r = 0; r < RARITY_TIERS.length; r += 1) {
    running += countByRank[r];
    cumulativeAtOrBelowRank[r] = running;
  }

  // P(natural best-drawn rank <= r) -- every drawn card comes from the
  // sub-pool at rank <= r.
  const probAtMostRank = (r) => (r < 0 ? 0 : probabilityAllDrawnFromSubPool(cumulativeAtOrBelowRank[r], poolSize, drawCount));

  // P(natural best-drawn rank == r), by telescoping the cumulative --
  // sums to 1 across all ranks by construction.
  const naturalBestByRank = RARITY_TIERS.map((_, r) => probAtMostRank(r) - probAtMostRank(r - 1));

  let finalBestByRank = naturalBestByRank;
  let guaranteeNote = null;

  if (packTier.guaranteedMinimumRarity) {
    const requiredRank = RARITY_RANK[packTier.guaranteedMinimumRarity];
    const qualifyingRanks = available
      .map((c) => RARITY_RANK[c.rarityTier])
      .filter((rank) => rank >= requiredRank);
    if (qualifyingRanks.length === 0) {
      throw new Error(`getPackOdds: no available card meets the guaranteed minimum rarity "${packTier.guaranteedMinimumRarity}"`);
    }
    // The rank `openPack` would actually swap in -- deterministic given
    // the pool, since it always picks the single best qualifying card.
    const swapInRank = Math.max(...qualifyingRanks);
    const probBelowGuarantee = probAtMostRank(requiredRank - 1);

    // Every draw whose natural best falls below the guarantee gets
    // upgraded to exactly `swapInRank` -- that mass moves there, and
    // ranks below the guarantee can never be the final best.
    finalBestByRank = RARITY_TIERS.map((_, r) => {
      if (r < requiredRank) return 0;
      if (r === swapInRank) return naturalBestByRank[r] + probBelowGuarantee;
      return naturalBestByRank[r];
    });
    guaranteeNote = `Every pack is guaranteed at least one ${packTier.guaranteedMinimumRarity}-or-better card; `
      + `${round4(probBelowGuarantee * 100)}% of draws would not have met that naturally and receive the best qualifying card available.`;
  }

  const bestCardRarityOdds = {};
  RARITY_TIERS.forEach((tier, r) => { bestCardRarityOdds[tier] = round4(finalBestByRank[r]); });

  const atLeastOneOfRarityOrBetter = {};
  let cumulativeFromTop = 0;
  for (let r = RARITY_TIERS.length - 1; r >= 0; r -= 1) {
    cumulativeFromTop += finalBestByRank[r];
    atLeastOneOfRarityOrBetter[RARITY_TIERS[r]] = round4(cumulativeFromTop);
  }

  return {
    packTierId,
    poolSize,
    drawCount,
    guaranteedMinimumRarity: packTier.guaranteedMinimumRarity,
    guaranteeNote,
    bestCardRarityOdds,
    atLeastOneOfRarityOrBetter,
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
  getPackOdds,
};
