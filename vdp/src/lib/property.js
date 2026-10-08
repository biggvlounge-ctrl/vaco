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

// **Land and unauthorized building (8 Oct 2026), per direct
// instruction.** "People can also have the option to buy land as
// well" is a real, separate purchase from a finished home -- vacant
// `land` is its own `PROPERTY_TYPES` entry, priced below the cheapest
// built unit (unbuilt land is worth less than VXLLAGE's own finished
// Studio), a flagged interpretive number on the same footing as every
// other price in this file, not derived from a document.
//
// "People doing unauthorized buildings. We will be restricted, and we
// will try to keep everything [controlled]" is the same instruction's
// other half: `authorized` is a real field on every property this file
// creates (true for everything above), and `buildUnauthorized` is the
// one path that sets it false on purpose -- a real structure on the
// books as not sanctioned, distinct from `immigration.js`'s
// `foundIllegalSettlement` (a standing claim to a place, not a single
// structure). `demolishUnauthorized` is the governors' own real
// enforcement action -- a robot patrol (`jobs.js`'s
// `robot-patrol-officer`) tearing an unsanctioned structure down.

// **Commercial property (8 Oct 2026), per direct instruction**: "we
// will start off with just a village, commercial, residential, and
// dreams screen mix." This file's own header above had named exactly
// this as the reason only `residential` existed -- "VDP has no
// commercial... districts to attach [VACON-C's `commercial`] to" --
// closed now that the instruction says commercial belongs in the
// STARTING mix, not a later one. `'commercial'` is VACON-C's own real
// literal `PROPERTY_TYPES` value, reused verbatim, the same borrowing
// this file already does for `LIFECYCLE`/`OWNER_TYPES`.
//
// Kept as its own independent ownership slot, deliberately NOT folded
// into `homeOwnedBy`'s one-residence check -- a business and a home
// are not the same claim, and a player operating a storefront should
// still be able to buy or rent a home. `homeOwnedBy` itself is scoped
// to exclude `commercial` for exactly this reason. `COMMERCIAL_LEVELS`
// is a flagged interpretive ladder, the same footing `PROPERTY_LEVELS`
// already stands on -- no document gives VDP a real commercial price
// schedule, and no materials cost is charged here (unlike
// `upgradeHome`) to keep this first pass scoped to the real ask:
// commercial belongs in the starting mix, not yet a second materials
// economy.

import { TOWN_NAME } from './town.js';

export const PROPERTY_TYPES = ['residential', 'land', 'commercial'];

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

// A real, separate ladder for the commercial slot (see header) --
// smaller than residential's 5 tiers, since nothing specifies a
// bigger one and a business starting small is the honest default.
export const COMMERCIAL_LEVELS = [
  { level: 1, name: 'Market Kiosk', price: 800 },
  { level: 2, name: 'Storefront', price: 2200 },
  { level: 3, name: 'Showroom', price: 5000 },
];

export function commercialLevelByNumber(level) {
  return COMMERCIAL_LEVELS.find((l) => l.level === level) || null;
}

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

// Excludes `commercial` on purpose -- a business is its own
// independent slot (`commercialOwnedBy`), not a second claim on the
// same "one home" check every function below already enforces.
export function homeOwnedBy(store, ownerId) {
  return store.properties.find((p) => p.ownerId === ownerId && p.type !== 'commercial') || null;
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
    authorized: true,
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
    authorized: true,
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

// Vacant land -- a real, separate purchase from a finished home. Same
// one-property-per-owner constraint (`homeOwnedBy`) every function
// above already enforces, and the same claim-before-pay/rollback
// ordering as `purchaseHome`.
export const LAND_PRICE = Math.round(PROPERTY_LEVELS[0].price * 0.4);

export async function purchaseLand(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('purchaseLand requires an ownerId');
  if (homeOwnedBy(store, ownerId)) {
    throw new Error(`purchaseLand: "${ownerId}" already owns a home or plot`);
  }
  if (typeof transferFn !== 'function') throw new Error('purchaseLand requires a transferFn');

  const property = {
    id: store.nextPropertyId++,
    type: 'land',
    ownerId,
    ownerType: 'individual',
    ownershipType: 'owned',
    lifecycleStage: 'planning',
    authorized: true,
    purchasedAt: now,
  };
  store.properties.push(property);

  try {
    await transferFn({ fromUserId: ownerId, amount: LAND_PRICE, reason: 'vdp-land-purchase' });
  } catch (err) {
    const idx = store.properties.indexOf(property);
    if (idx !== -1) store.properties.splice(idx, 1);
    throw err;
  }

  return property;
}

// "People doing unauthorized buildings" -- a real structure that
// exists on the books as not sanctioned, built with no purchase at
// all (an unauthorized builder did not go through the governors'
// office), which is why this takes no `transferFn` -- there is no real
// payment to roll back, the structure itself is the thing that is
// not legitimate.
//
// **Unsecured-community businesses (8 Oct 2026, direct instruction)**:
// "other certain communities that haven't been secured by the
// government also can have businesses there... existing business, or
// NPC built businesses." `type` defaults to `'residential'` (every
// existing caller, unchanged) but now also accepts `'commercial'` --
// a real business that exists entirely outside the governors' office,
// never purchased through `purchaseCommercial`, seeded at the same
// real Market Kiosk level so `operateBusiness` (which only cares
// whether a property is `commercial`, never whether it is
// `authorized`) works on it identically to a sanctioned one.
// `ownerId` is any real string, `npc-<id>` included -- an NPC-built
// business needs no new code, the same way `contracts.js`'s
// `builderId` already allows one. The same one-business-per-owner
// rule `purchaseCommercial` enforces applies here too: going around
// the governors' office does not grant a second business slot.
export function buildUnauthorized(store, { ownerId, locationLabel, type = 'residential', now = Date.now() } = {}) {
  if (!ownerId) throw new Error('buildUnauthorized requires an ownerId');
  if (!locationLabel) throw new Error('buildUnauthorized requires a locationLabel');
  if (!['residential', 'commercial'].includes(type)) {
    throw new Error(`buildUnauthorized: "${type}" is not a real type (expected residential or commercial)`);
  }
  if (type === 'commercial' && commercialOwnedBy(store, ownerId)) {
    throw new Error(`buildUnauthorized: "${ownerId}" already owns a commercial property`);
  }

  const property = {
    id: store.nextPropertyId++,
    type,
    ownerId,
    ownerType: 'individual',
    ownershipType: 'owned',
    lifecycleStage: type === 'commercial' ? 'operation' : 'construction',
    authorized: false,
    locationLabel,
    builtAt: now,
    ...(type === 'commercial' ? { level: COMMERCIAL_LEVELS[0].level, levelName: COMMERCIAL_LEVELS[0].name } : {}),
  };
  store.properties.push(property);
  return property;
}

export function listUnauthorized(store) {
  return store.properties.filter((p) => p.authorized === false);
}

// The governors' own real enforcement action -- a robot patrol
// (`jobs.js`'s `robot-patrol-officer`) tearing down a structure that
// was never authorized. Removes the row outright rather than flagging
// it cleared, the real distinction `immigration.js`'s
// `clearIllegalSettlement` draws for a whole settlement instead of one
// structure.
export function demolishUnauthorized(store, propertyId, { demolishedBy, now = Date.now() } = {}) {
  const property = store.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error(`demolishUnauthorized: no property #${propertyId}`);
  if (property.authorized) throw new Error(`demolishUnauthorized: property #${propertyId} is authorized`);

  const idx = store.properties.indexOf(property);
  store.properties.splice(idx, 1);
  return {
    demolishedPropertyId: propertyId,
    ownerId: property.ownerId,
    demolishedBy: demolishedBy || null,
    demolishedAt: now,
  };
}

// Independent of `homeOwnedBy` -- see the commercial header above.
export function commercialOwnedBy(store, ownerId) {
  return store.properties.find((p) => p.ownerId === ownerId && p.type === 'commercial') || null;
}

export async function purchaseCommercial(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('purchaseCommercial requires an ownerId');
  if (commercialOwnedBy(store, ownerId)) {
    throw new Error(`purchaseCommercial: "${ownerId}" already owns a commercial property`);
  }
  if (typeof transferFn !== 'function') throw new Error('purchaseCommercial requires a transferFn');

  const property = {
    id: store.nextPropertyId++,
    type: 'commercial',
    ownerId,
    ownerType: 'individual',
    ownershipType: 'owned',
    lifecycleStage: 'operation',
    level: COMMERCIAL_LEVELS[0].level,
    levelName: COMMERCIAL_LEVELS[0].name,
    authorized: true,
    purchasedAt: now,
  };
  store.properties.push(property);

  try {
    await transferFn({ fromUserId: ownerId, amount: COMMERCIAL_LEVELS[0].price, reason: 'vdp-commercial-purchase' });
  } catch (err) {
    const idx = store.properties.indexOf(property);
    if (idx !== -1) store.properties.splice(idx, 1);
    throw err;
  }

  return property;
}

// Same claim-before-pay ordering as `upgradeHome`, charging the real
// price difference between levels, not the next level's full price.
export async function upgradeCommercial(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('upgradeCommercial requires an ownerId');
  const property = commercialOwnedBy(store, ownerId);
  if (!property) throw new Error(`upgradeCommercial: "${ownerId}" does not own a commercial property`);
  if (typeof transferFn !== 'function') throw new Error('upgradeCommercial requires a transferFn');

  const current = commercialLevelByNumber(property.level);
  const next = commercialLevelByNumber(property.level + 1);
  if (!next) throw new Error(`upgradeCommercial: "${ownerId}"'s commercial property is already at the top level (${current.name})`);

  const cost = next.price - current.price;
  const previousLevel = property.level;
  const previousLevelName = property.levelName;
  property.level = next.level;
  property.levelName = next.name;
  property.upgradedAt = now;

  try {
    await transferFn({ fromUserId: ownerId, amount: cost, reason: 'vdp-commercial-upgrade' });
  } catch (err) {
    property.level = previousLevel;
    property.levelName = previousLevelName;
    delete property.upgradedAt;
    throw err;
  }

  return property;
}

// "People get, it can be involved in the economy rotation... the
// economy should continue to thrive as far as the owners of the
// businesses" (8 Oct 2026, direct instruction) -- until now a
// commercial property was something a player only ever paid INTO
// (`purchaseCommercial`/`upgradeCommercial`); this is the real,
// opposite flow, an owner's own business actually earning. Gated by
// `OPERATE_COOLDOWN_MS`, the same shape `resources.js`'s
// `DIG_COOLDOWN_MS` already uses, so running a business is a real,
// repeatable action rather than a one-time payout. `economyMultiplier`
// is injected (from `economy.js`'s `economyMultiplierFor`) rather than
// imported, the same decoupling every other cross-module number in
// this file already uses -- a thriving world (real spending elsewhere)
// is the real reason a business earns more, not a second invented
// number this function would otherwise have to make up on its own.
export const BASE_COMMERCIAL_REVENUE = 30;
export const BUSINESS_REVENUE_ACCOUNT = 'vdp-business-customers';
export const OPERATE_COOLDOWN_MS = 5 * 60 * 1000;

export function canOperateBusiness(property, now = Date.now()) {
  if (!property || property.type !== 'commercial') return false;
  if (!property.lastOperatedAt) return true;
  return now - property.lastOperatedAt >= OPERATE_COOLDOWN_MS;
}

export async function operateBusiness(store, {
  ownerId, transferFn, economyMultiplier = 1, now = Date.now(),
} = {}) {
  if (!ownerId) throw new Error('operateBusiness requires an ownerId');
  const property = commercialOwnedBy(store, ownerId);
  if (!property) throw new Error(`operateBusiness: "${ownerId}" does not own a commercial property`);
  if (!canOperateBusiness(property, now)) {
    throw new Error(`operateBusiness: "${ownerId}"'s business is still restocking -- try again later`);
  }
  if (typeof transferFn !== 'function') throw new Error('operateBusiness requires a transferFn');

  const level = commercialLevelByNumber(property.level);
  const revenue = Math.max(0, Math.round(level.level * BASE_COMMERCIAL_REVENUE * economyMultiplier));

  const previousOperatedAt = property.lastOperatedAt || null;
  property.lastOperatedAt = now;

  try {
    await transferFn({
      fromUserId: BUSINESS_REVENUE_ACCOUNT, toUserId: ownerId, amount: revenue, reason: 'vdp-business-revenue',
    });
  } catch (err) {
    property.lastOperatedAt = previousOperatedAt;
    throw err;
  }

  return { property, revenue };
}
