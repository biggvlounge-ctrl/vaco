// VDP — player housing.
//
// One unit type to start (`residential`), since VDP has no commercial/
// industrial/agricultural districts to attach the other nine of
// VACON-C's `PROPERTY_TYPES` to. `lifecycle` is VACON-C's own
// `server/property.js` stage list, reused verbatim rather than
// reinvented — a VDP home starts in `planning` the same way a VACON-C
// building does, and moves through the same real stages.
//
// Rent/buy pays through V3 (`v3Client.js`), with the same
// claim-before-pay ordering `degvchi.js`'s `purchaseWearable` already
// proved: the ownership row is pushed before the transfer is awaited,
// and rolled back if the transfer fails — so a declined charge never
// leaves a home on the books with nobody having paid for it.
//
// Tower-style levels, not a second lifecycle: `lifecycleStage` is
// still VACON-C's own real-estate stage (planning/operation/...), a
// property management concept. `level` is a separate, VDP-only
// progression -- a bigger, nicer home a player moves up into -- so
// the two axes don't collide: a level-5 Penthouse can still be under
// `renovation`.
//
// **The entry-level tiers are VXLLAGE's own complex**, per explicit
// naming instruction: a new player's first real home is a unit inside
// a real, named development ("VXLLAGE Studio/Flat at <town.js's
// TOWN_NAME>"), not a generic "Studio." Tiers 3+ are a player's own
// independent property, outside that one complex, so they drop the
// VXLLAGE name the same way a real person moves out of their first
// apartment complex into a house they own outright.

import { TOWN_NAME } from './town.js';

export const PROPERTY_TYPES = ['residential'];

// Verbatim from vacon-c/server/property.js's own LIFECYCLE list.
export const LIFECYCLE = [
  'planning', 'construction', 'operation', 'maintenance',
  'renovation', 'expansion', 'historical_legacy',
];

export const OWNER_TYPES = ['individual'];

export const PROPERTY_LEVELS = [
  { level: 1, name: `VXLLAGE Studio at ${TOWN_NAME}`, price: 500 },
  { level: 2, name: `VXLLAGE Flat at ${TOWN_NAME}`, price: 1200 },
  { level: 3, name: 'Townhouse', price: 2500 },
  { level: 4, name: 'Estate', price: 5000 },
  { level: 5, name: 'Penthouse', price: 9000 },
];

export const HOME_PRICE = PROPERTY_LEVELS[0].price;

// Renting is the cheap, non-committal way in: a fifth of buying
// outright, always a Studio (no tower levels while renting -- the
// level ladder is an owner's progression), and converting to
// ownership later credits the rent already paid rather than charging
// the full price again.
export const RENT_FRACTION = 0.2;
export const RENT_PRICE = Math.round(PROPERTY_LEVELS[0].price * RENT_FRACTION);

// **A flagged interpretive ladder, the same footing `PROPERTY_LEVELS`'
// own prices already stand on** — no document specifies a real
// materials cost, so this is chosen, not derived, scaled against the
// same price ladder. Level 1 costs none: it is a unit inside the
// already-built VXLLAGE complex, not something a player constructs —
// only moving UP a tower level represents real new building, which is
// why `upgradeHome` is the only place this is charged, never
// `purchaseHome` or `rentHome`.
export const MATERIALS_REQUIRED = {
  1: { wood: 0, stone: 0, clay: 0, ore: 0 },
  2: { wood: 20, stone: 5, clay: 0, ore: 0 },
  3: { wood: 45, stone: 20, clay: 5, ore: 0 },
  4: { wood: 80, stone: 40, clay: 15, ore: 5 },
  5: { wood: 130, stone: 65, clay: 30, ore: 15 },
};

export function levelByNumber(level) {
  return PROPERTY_LEVELS.find((l) => l.level === level) || null;
}

// The real per-type difference between two levels' requirements —
// never the next level's full requirement, the same "don't charge
// twice" rule the VCoin price delta already follows.
export function materialsDeltaFor(fromLevel, toLevel) {
  const from = MATERIALS_REQUIRED[fromLevel] || {};
  const to = MATERIALS_REQUIRED[toLevel] || {};
  const delta = {};
  for (const type of Object.keys(to)) {
    delta[type] = Math.max(0, (to[type] || 0) - (from[type] || 0));
  }
  return delta;
}

export function createPropertyStore() {
  return { properties: [], nextPropertyId: 1 };
}

export function listHomes(store) {
  return store.properties;
}

export function homeOwnedBy(store, ownerId) {
  return store.properties.find((p) => p.ownerId === ownerId) || null;
}

// `transferFn` is injected, the same decoupling `catalog.js`'s
// `purchaseBook` uses, so this stays runnable/testable without
// importing `v3Client.js` (which needs Vite's `import.meta.env`).
export async function purchaseHome(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('purchaseHome requires an ownerId');
  if (homeOwnedBy(store, ownerId)) {
    throw new Error(`purchaseHome: "${ownerId}" already owns a home`);
  }
  if (typeof transferFn !== 'function') throw new Error('purchaseHome requires a transferFn');

  const property = {
    id: store.nextPropertyId++,
    type: 'residential',
    ownerId,
    ownerType: 'individual',
    ownershipType: 'owned',
    lifecycleStage: 'operation',
    level: PROPERTY_LEVELS[0].level,
    levelName: PROPERTY_LEVELS[0].name,
    purchasedAt: now,
  };
  // Claim before pay: the row exists the instant it's committed to,
  // so a crash between the push and the transfer resolving can only
  // ever look like "paid for but not yet confirmed," never "charged
  // with no record of what for."
  store.properties.push(property);

  try {
    await transferFn({ fromUserId: ownerId, amount: HOME_PRICE, reason: 'vdp-home-purchase' });
  } catch (err) {
    const idx = store.properties.indexOf(property);
    if (idx !== -1) store.properties.splice(idx, 1);
    throw err;
  }

  return property;
}

// The cheap, non-committal path in: always a Studio, no tower levels
// until the renter converts to ownership (see `buyRentedHome`). Same
// claim-before-pay/rollback ordering as `purchaseHome`.
export async function rentHome(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('rentHome requires an ownerId');
  if (homeOwnedBy(store, ownerId)) {
    throw new Error(`rentHome: "${ownerId}" already has a home`);
  }
  if (typeof transferFn !== 'function') throw new Error('rentHome requires a transferFn');

  const property = {
    id: store.nextPropertyId++,
    type: 'residential',
    ownerId,
    ownerType: 'individual',
    ownershipType: 'rented',
    lifecycleStage: 'operation',
    level: PROPERTY_LEVELS[0].level,
    levelName: PROPERTY_LEVELS[0].name,
    purchasedAt: now,
  };
  store.properties.push(property);

  try {
    await transferFn({ fromUserId: ownerId, amount: RENT_PRICE, reason: 'vdp-home-rent' });
  } catch (err) {
    const idx = store.properties.indexOf(property);
    if (idx !== -1) store.properties.splice(idx, 1);
    throw err;
  }

  return property;
}

// Converts a rented Studio into an owned one. Charges the real
// remainder -- the full purchase price minus the rent already paid --
// not the full price again, the same "don't charge twice for the same
// level" discipline `upgradeHome` applies between tower levels.
export async function buyRentedHome(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('buyRentedHome requires an ownerId');
  const property = homeOwnedBy(store, ownerId);
  if (!property) throw new Error(`buyRentedHome: "${ownerId}" does not have a home`);
  if (property.ownershipType === 'owned') {
    throw new Error(`buyRentedHome: "${ownerId}" already owns their home`);
  }
  if (typeof transferFn !== 'function') throw new Error('buyRentedHome requires a transferFn');

  const cost = HOME_PRICE - RENT_PRICE;
  property.ownershipType = 'owned';
  property.purchasedAt = now;

  try {
    await transferFn({ fromUserId: ownerId, amount: cost, reason: 'vdp-home-rent-to-own' });
  } catch (err) {
    property.ownershipType = 'rented';
    throw err;
  }

  return property;
}

// Moves a home up exactly one tower level, charging the real price
// difference between the current and next level -- not the next
// level's full price, since the player already paid for the level
// they're standing in. Same claim-before-pay ordering as
// `purchaseHome`: the level is bumped before the transfer is awaited,
// rolled back on failure.
//
// `resourcesStore`/`spendMaterialsFn`/`undoSpendFn` are optional and
// injected, the same decoupling `transferFn` already uses -- this
// file has no import of `resources.js` and does not need one. Omit
// all three and only VCoin is charged, which is what every existing
// caller and test still does. When given, materials are spent BEFORE
// the VCoin transfer is attempted (insufficient materials should
// never cost VCoin first) and undone if the transfer then fails --
// two payments for one upgrade, and neither may survive the other's
// failure alone.
export async function upgradeHome(store, {
  ownerId, transferFn, now = Date.now(), resourcesStore, spendMaterialsFn, undoSpendFn,
} = {}) {
  if (!ownerId) throw new Error('upgradeHome requires an ownerId');
  const property = homeOwnedBy(store, ownerId);
  if (!property) throw new Error(`upgradeHome: "${ownerId}" does not own a home`);
  if (property.ownershipType === 'rented') {
    throw new Error(`upgradeHome: "${ownerId}" is renting, not owning -- buy the home first (buyRentedHome)`);
  }
  if (typeof transferFn !== 'function') throw new Error('upgradeHome requires a transferFn');
  if (resourcesStore && (typeof spendMaterialsFn !== 'function' || typeof undoSpendFn !== 'function')) {
    throw new Error('upgradeHome: resourcesStore requires both spendMaterialsFn and undoSpendFn');
  }

  const current = levelByNumber(property.level);
  const next = levelByNumber(property.level + 1);
  if (!next) throw new Error(`upgradeHome: "${ownerId}"'s home is already at the top level (${current.name})`);

  const cost = next.price - current.price;
  const previousLevel = property.level;
  const previousLevelName = property.levelName;
  property.level = next.level;
  property.levelName = next.name;
  property.upgradedAt = now;

  let spendResult = null;
  if (resourcesStore) {
    try {
      spendResult = spendMaterialsFn(resourcesStore, ownerId, materialsDeltaFor(previousLevel, next.level));
    } catch (err) {
      property.level = previousLevel;
      property.levelName = previousLevelName;
      delete property.upgradedAt;
      throw err;
    }
  }

  try {
    await transferFn({ fromUserId: ownerId, amount: cost, reason: 'vdp-home-upgrade' });
  } catch (err) {
    if (resourcesStore) undoSpendFn(resourcesStore, ownerId, spendResult);
    property.level = previousLevel;
    property.levelName = previousLevelName;
    delete property.upgradedAt;
    throw err;
  }

  return property;
}

export function advanceLifecycle(property) {
  const idx = LIFECYCLE.indexOf(property.lifecycleStage);
  if (idx === -1 || idx === LIFECYCLE.length - 1) return property;
  property.lifecycleStage = LIFECYCLE[idx + 1];
  return property;
}
