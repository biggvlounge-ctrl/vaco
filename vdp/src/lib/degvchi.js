// VENVS / DEGVCHI — avatar-wearable economy.
// Source of truth: VENVS_DIGITAL_PLANET_COMPARABLES.md, "Direct
// translation to VENVS and DEGVCHI specifically": Roblox's 2026
// brand-sponsored avatar wearable pivot is the direct model for
// DEGVCHI's fashion district — "real or DEGVCHI-original branded
// avatar wearables, sold for VCoin, with the same category structure
// Roblox validated (clothing, makeup/cosmetics, accessories) — not
// invented from scratch." Per `CLAUDE.md` §4, DEGVCHI is a district
// inside VENVS's Fashion District, not a standalone app.
//
// purchaseWearable() reuses the same buyer -> recipient VCoin-transfer
// pattern as Phases 2-3, via an injected transferFn. No revenue-split
// percentage is specified anywhere in the source doc for a sponsored
// item (unlike Publishing's precise royalty rates) -- rather than
// invent one, the full sale price goes to the item's `creatorId`
// (the sponsor's or DEGVCHI's own account), matching how Marketplace
// sellers already receive their full line-item price. The doc's own
// "real revenue mechanism worth adopting" point is that VCoin earned
// this way is already cash-out-able via the VCoin -> VASH path
// Phase 1 built (cashOutToVash) -- explicitly not a new mechanism.

const WEARABLE_CATEGORIES = ['clothing', 'cosmetics', 'accessories'];

export function createDegvchi() {
  return {
    wearables: [],
    nextWearableId: 1,
    ownership: [], // { userId, wearableId }
    equipped: {}, // userId -> { clothing?, cosmetics?, accessories? } (wearableId per category)
  };
}

export function registerWearable(store, options = {}) {
  const { name, category, price, creatorId, sponsor = null } = options;
  if (!name) {
    throw new Error('registerWearable requires a name');
  }
  if (!WEARABLE_CATEGORIES.includes(category)) {
    throw new Error(
      `registerWearable: invalid category "${category}" (expected one of ${WEARABLE_CATEGORIES.join(', ')})`
    );
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('registerWearable requires a positive price');
  }
  if (!creatorId) {
    throw new Error('registerWearable requires a creatorId (the payout account for this item)');
  }
  const wearable = {
    id: store.nextWearableId++,
    name,
    category,
    price,
    creatorId,
    // `sponsor` is a real-brand name (e.g. "e.l.f. Cosmetics") per the
    // doc's own launch-sponsor example, or null for a DEGVCHI-original
    // item -- purely descriptive, doesn't change payout routing.
    sponsor,
    createdAt: Date.now(),
  };
  store.wearables.push(wearable);
  return wearable;
}

export function getWearable(store, wearableId) {
  return store.wearables.find((w) => w.id === wearableId) || null;
}

export function browseWearables(store, options = {}) {
  const { category, sponsoredOnly } = options;
  return store.wearables.filter(
    (w) =>
      (category ? w.category === category : true) &&
      (sponsoredOnly ? w.sponsor !== null : true)
  );
}

export function ownsWearable(store, userId, wearableId) {
  return store.ownership.some((o) => o.userId === userId && o.wearableId === wearableId);
}

export function getOwnedWearables(store, userId) {
  return store.ownership
    .filter((o) => o.userId === userId)
    .map((o) => getWearable(store, o.wearableId));
}

export async function purchaseWearable(store, options = {}) {
  const { wearableId, buyerId, transferFn } = options;
  if (typeof transferFn !== 'function') {
    throw new Error('purchaseWearable requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  const wearable = getWearable(store, wearableId);
  if (!wearable) {
    throw new Error(`purchaseWearable: no wearable with id ${wearableId}`);
  }
  if (!buyerId) {
    throw new Error('purchaseWearable requires a buyerId');
  }
  if (ownsWearable(store, buyerId, wearableId)) {
    throw new Error(`purchaseWearable: ${buyerId} already owns wearable ${wearableId}`);
  }

  await transferFn(buyerId, wearable.creatorId, wearable.price, `venvs_degvchi_purchase:${wearable.id}`);
  store.ownership.push({ userId: buyerId, wearableId });
  return wearable;
}

// Real "one equipped item per category" mechanic -- equipping a new
// clothing item replaces whatever clothing item was previously
// equipped, same real avatar-customization behavior Roblox and every
// comparable avatar system use.
export function equipWearable(store, userId, wearableId) {
  const wearable = getWearable(store, wearableId);
  if (!wearable) {
    throw new Error(`equipWearable: no wearable with id ${wearableId}`);
  }
  if (!ownsWearable(store, userId, wearableId)) {
    throw new Error(`equipWearable: ${userId} does not own wearable ${wearableId}`);
  }
  if (!store.equipped[userId]) {
    store.equipped[userId] = {};
  }
  store.equipped[userId][wearable.category] = wearableId;
  return getEquippedOutfit(store, userId);
}

export function unequipWearable(store, userId, category) {
  if (!WEARABLE_CATEGORIES.includes(category)) {
    throw new Error(
      `unequipWearable: invalid category "${category}" (expected one of ${WEARABLE_CATEGORIES.join(', ')})`
    );
  }
  if (store.equipped[userId]) {
    delete store.equipped[userId][category];
  }
  return getEquippedOutfit(store, userId);
}

export function getEquippedOutfit(store, userId) {
  const equippedIds = store.equipped[userId] || {};
  const outfit = {};
  for (const category of WEARABLE_CATEGORIES) {
    outfit[category] = equippedIds[category] != null ? getWearable(store, equippedIds[category]) : null;
  }
  return outfit;
}

export { WEARABLE_CATEGORIES };
