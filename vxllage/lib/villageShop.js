// VXLLAGE -- the Village Shop: real boost economy + real
// village-specific cosmetics. Source of truth: VXLLAGE_CLAUDE.md's own
// prototype inventory calls both out as fake: "village boost (spends
// real VCoin, moves a progress bar)" and "village-specific cosmetic
// purchase" -- both listed under "Real (local React state)" in the
// PROTOTYPE, meaning real-looking but never actually backed by VCoin
// moving anywhere. This module is the real version: every boost and
// every cosmetic purchase is a real `transferFn` call against V3, paid
// to the village's own owner -- the actual "Community Boosting" /
// "Avatar Economy" revenue streams the doc's own Wallet sheet already
// named as real monetization concepts, not decoration.
//
// **Real, deliberate, flagged interpretive scale**: no source doc
// gives exact VCoin thresholds for boost levels. `BOOST_LEVEL_THRESHOLDS`
// is a real, bounded 3-tier scale (mirroring Discord's own real,
// well-known 3-level server-boost structure, the actual comparable
// this feature is modeled on) -- cumulative VCoin contributed, not
// invented from nothing but not a documented number either.

const { getVillage } = require('./villages');

const BOOST_LEVEL_THRESHOLDS = [
  { level: 1, minVCoin: 100 },
  { level: 2, minVCoin: 500 },
  { level: 3, minVCoin: 1500 },
];

function computeBoostLevel(totalVCoin) {
  let level = 0;
  for (const tier of BOOST_LEVEL_THRESHOLDS) {
    if (totalVCoin >= tier.minVCoin) level = tier.level;
  }
  return level;
}

async function boostVillage(store, options = {}) {
  const { villageId, boosterId, amountVCoin, transferFn } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`boostVillage: no village with id ${villageId}`);
  if (!boosterId) throw new Error('boostVillage requires a boosterId');
  if (!Number.isFinite(amountVCoin) || amountVCoin <= 0) throw new Error('boostVillage requires a positive amountVCoin');
  if (typeof transferFn !== 'function') throw new Error('boostVillage requires a transferFn(fromUserId, toUserId, amount, reason)');

  await transferFn(boosterId, village.ownerId, amountVCoin, `vxllage_village_boost:${villageId}`);

  const contribution = {
    id: store.nextBoostContributionId++, villageId, boosterId, amountVCoin, createdAt: Date.now(),
  };
  store.villageBoostContributions.push(contribution);

  village.totalBoostVCoin = (village.totalBoostVCoin || 0) + amountVCoin;
  village.boostLevel = computeBoostLevel(village.totalBoostVCoin);

  return { contribution, totalBoostVCoin: village.totalBoostVCoin, boostLevel: village.boostLevel };
}

function getBoostStatus(store, villageId) {
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`getBoostStatus: no village with id ${villageId}`);
  const totalVCoin = village.totalBoostVCoin || 0;
  const level = village.boostLevel || 0;
  const nextTier = BOOST_LEVEL_THRESHOLDS.find((t) => t.level === level + 1) || null;
  return {
    villageId,
    totalBoostVCoin: totalVCoin,
    boostLevel: level,
    nextLevelAt: nextTier ? nextTier.minVCoin : null,
    vCoinToNextLevel: nextTier ? nextTier.minVCoin - totalVCoin : 0,
  };
}

// -- Village-specific cosmetics --
// Only a village's own owner can list a cosmetic for sale there -- the
// real "creator monetizes their own community" framing the doc's own
// Wallet sheet names ("Avatar Economy" / "Community Boosting" as
// distinct-but-related revenue streams).

function createCosmeticItem(store, options = {}) {
  const { villageId, creatorId, name, priceVCoin } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`createCosmeticItem: no village with id ${villageId}`);
  if (village.ownerId !== creatorId) {
    throw new Error(`createCosmeticItem: only village ${villageId}'s own owner can list a cosmetic there`);
  }
  if (!name) throw new Error('createCosmeticItem requires a name');
  if (!Number.isFinite(priceVCoin) || priceVCoin <= 0) throw new Error('createCosmeticItem requires a positive priceVCoin');

  const item = {
    id: store.nextCosmeticItemId++, villageId, name, priceVCoin, createdAt: Date.now(),
  };
  store.villageCosmeticItems.push(item);
  return item;
}

function listCosmeticsForVillage(store, villageId) {
  return store.villageCosmeticItems.filter((c) => c.villageId === villageId);
}

async function purchaseCosmetic(store, options = {}) {
  const { itemId, buyerId, transferFn } = options;
  const item = store.villageCosmeticItems.find((c) => c.id === itemId);
  if (!item) throw new Error(`purchaseCosmetic: no cosmetic item with id ${itemId}`);
  if (!buyerId) throw new Error('purchaseCosmetic requires a buyerId');
  if (typeof transferFn !== 'function') throw new Error('purchaseCosmetic requires a transferFn(fromUserId, toUserId, amount, reason)');
  if (store.villageCosmeticOwnership.some((o) => o.itemId === itemId && o.userId === buyerId)) {
    throw new Error(`purchaseCosmetic: ${buyerId} already owns cosmetic ${itemId}`);
  }

  const village = getVillage(store, item.villageId);
  await transferFn(buyerId, village.ownerId, item.priceVCoin, `vxllage_cosmetic_purchase:${itemId}`);

  const ownership = { id: store.nextCosmeticOwnershipId++, itemId, userId: buyerId, purchasedAt: Date.now() };
  store.villageCosmeticOwnership.push(ownership);
  return ownership;
}

function getOwnedCosmeticsForUser(store, userId) {
  const ownedItemIds = new Set(store.villageCosmeticOwnership.filter((o) => o.userId === userId).map((o) => o.itemId));
  return store.villageCosmeticItems.filter((c) => ownedItemIds.has(c.id));
}

module.exports = {
  BOOST_LEVEL_THRESHOLDS,
  computeBoostLevel,
  boostVillage,
  getBoostStatus,
  createCosmeticItem,
  listCosmeticsForVillage,
  purchaseCosmetic,
  getOwnedCosmeticsForUser,
};
