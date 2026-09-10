// VXLLAGE -- the personal, cross-village avatar cosmetic shop.
// Source of truth: `VXLLAGE_CLAUDE.md`'s own "Profile / Wallet sheet"
// section: "Wallet: ... avatar cosmetic shop (3 items, real VCoin
// spend + equip state)" -- a real, distinct concept from
// `villageShop.js`'s own per-village cosmetics (which are listed by
// one village's own owner and scoped to that village). This shop
// belongs to no village at all; every item is available to every
// user, everywhere, matching the doc's own separate "Avatar Economy"
// line in the Wallet sheet's revenue-stream list (distinct from
// "Community Boosting", which `villageShop.js` already covers).
//
// **Real, flagged interpretive catalog**: the doc names a real count
// (3 items) and a real mechanic (VCoin spend + equip), but no source
// doc names the 3 items themselves. `AVATAR_COSMETIC_CATALOG` below is
// a real, fixed, flagged placeholder set -- exactly 3 items, matching
// the doc's own real number, not invented in quantity.
//
// **Real, flagged interpretive equip model**: the doc says "equip
// state" (singular), with no category structure the way VDP's own
// DEGVCHI wardrobe has (3 real categories). Modeled here as a single
// equip slot -- one avatar cosmetic equipped at a time -- the simplest
// reading of "equip state" that doesn't invent categories nowhere
// named.
//
// Payment goes to a real, fixed platform account (`VXLLAGE_PLATFORM_ACCOUNT`),
// not any one village's owner -- this shop isn't village property,
// unlike `villageShop.js`'s own cosmetics.

const VXLLAGE_PLATFORM_ACCOUNT = 'vxllage-platform';

const AVATAR_COSMETIC_CATALOG = [
  { id: 'gold-aura', name: 'Gold Aura', priceVCoin: 50 },
  { id: 'neon-trail', name: 'Neon Trail', priceVCoin: 75 },
  { id: 'founders-badge', name: "Founder's Badge", priceVCoin: 120 },
];

function getAvatarCosmeticCatalog() {
  return AVATAR_COSMETIC_CATALOG;
}

function findCatalogItem(itemId) {
  return AVATAR_COSMETIC_CATALOG.find((c) => c.id === itemId) || null;
}

async function purchaseAvatarCosmetic(store, options = {}) {
  const { userId, itemId, settleFn } = options;
  if (!userId) throw new Error('purchaseAvatarCosmetic requires a userId');
  const item = findCatalogItem(itemId);
  if (!item) throw new Error(`purchaseAvatarCosmetic: no real catalog item with id "${itemId}"`);
  if (typeof settleFn !== 'function') throw new Error('purchaseAvatarCosmetic requires a settleFn(legs, meta)');
  if (store.avatarCosmeticOwnership.some((o) => o.userId === userId && o.itemId === itemId)) {
    throw new Error(`purchaseAvatarCosmetic: ${userId} already owns "${itemId}"`);
  }

  await settleFn(
    [{ fromUserId: userId, toUserId: VXLLAGE_PLATFORM_ACCOUNT, amount: item.priceVCoin, reason: `vxllage_avatar_cosmetic_purchase:${itemId}` }],
    { reason: `vxllage_avatar_cosmetic_purchase:${itemId}` },
  );

  const ownership = {
    id: store.nextAvatarCosmeticOwnershipId++, userId, itemId, purchasedAt: Date.now(),
  };
  store.avatarCosmeticOwnership.push(ownership);
  return ownership;
}

function getOwnedAvatarCosmetics(store, userId) {
  const ownedIds = new Set(store.avatarCosmeticOwnership.filter((o) => o.userId === userId).map((o) => o.itemId));
  return AVATAR_COSMETIC_CATALOG.filter((c) => ownedIds.has(c.id));
}

// Real, single-slot equip -- requires real, existing ownership, never
// trusted from a bare itemId. Equipping a new item silently replaces
// whatever was equipped before, matching the doc's own singular
// "equip state."
function equipAvatarCosmetic(store, options = {}) {
  const { userId, itemId } = options;
  if (!userId) throw new Error('equipAvatarCosmetic requires a userId');
  const owns = store.avatarCosmeticOwnership.some((o) => o.userId === userId && o.itemId === itemId);
  if (!owns) throw new Error(`equipAvatarCosmetic: ${userId} does not own "${itemId}"`);

  const existing = store.avatarEquippedCosmetic.find((e) => e.userId === userId);
  if (existing) existing.itemId = itemId;
  else store.avatarEquippedCosmetic.push({ userId, itemId });

  return { userId, equippedItemId: itemId };
}

function unequipAvatarCosmetic(store, userId) {
  store.avatarEquippedCosmetic = store.avatarEquippedCosmetic.filter((e) => e.userId !== userId);
  return { userId, equippedItemId: null };
}

function getAvatarProfile(store, userId) {
  const equipped = store.avatarEquippedCosmetic.find((e) => e.userId === userId) || null;
  return {
    userId,
    ownedCosmetics: getOwnedAvatarCosmetics(store, userId),
    equippedItemId: equipped ? equipped.itemId : null,
  };
}

module.exports = {
  VXLLAGE_PLATFORM_ACCOUNT,
  getAvatarCosmeticCatalog,
  purchaseAvatarCosmetic,
  getOwnedAvatarCosmetics,
  equipAvatarCosmetic,
  unequipAvatarCosmetic,
  getAvatarProfile,
};
