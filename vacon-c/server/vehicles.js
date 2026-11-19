// server/vehicles.js
//
// By direct instruction: a real vehicle system — cars, motorcycles,
// scooters — with a real fuel constraint, real theft, and real
// crafting/restoration from salvaged parts.
//
// ---------------------------------------------------------------------
// A vehicle is an ordinary real item, not a second inventory system
// ---------------------------------------------------------------------
// `car`/`motorcycle`/`scooter` are real `salvage.js` PRODUCTS (that
// file's own header has the recipes), registered under §28's own
// real `transport` TRADE_CATEGORY — which `items.js` has carried since
// the catalogue was built and nothing had ever used. They hold,
// transfer, stack and wear through the exact same `inventory.js`
// mechanism every other item already uses — no per-vehicle instance
// table, no second condition field. **Closing a real teardown gap for
// free**: `salvage.CATEGORY_TEARDOWNS.transport` (`scrap_metal: 4,
// rubber: 2, glass: 2`) has existed since that file's own teardown
// table was written, with no real `transport`-category item ever
// registered to exercise it — `salvage.salvageOf` already tears a
// vehicle back down into real materials the moment one exists.
//
// ---------------------------------------------------------------------
// Fuel: the real §28 resource §27 item category nothing had ever used
// ---------------------------------------------------------------------
// `items.RESOURCE_TYPES` has named `fuel` since that file's own
// canonical list was written; `grep -rn "'fuel'" server/*.js` before
// this file found exactly one match — its own definition, never a
// generator or a consumer. `travel.js`'s own journeys are the real
// consumer: a vehicle-driven journey needs one real `fuel`-category
// item per real travelling day from its own driver, same category-
// based consumption `travel.js` already established for food/water,
// never a numeric "tank" field invented on top of the real inventory
// condition this file already reads.
//
// ---------------------------------------------------------------------
// Real pace, flagged interpretive like every other number here
// ---------------------------------------------------------------------
// No document gives a real km/day figure for driving an arbitrary
// vehicle through an arbitrary post-collapse road network, so these
// are chosen to express the real qualitative fact that a vehicle is
// an order of magnitude faster than `travel.js`'s own cited walking/
// wagon pace, never a claim about any specific real road condition.
// Scaled by the vehicle's own real, already-tracked inventory
// `condition` — read once, at the moment a journey begins, the same
// "fixed for the journey" posture `travel.js`'s own `totalDays` takes
// for distance. **Deliberately NOT re-read mid-journey**: a vehicle
// that wears down over the course of a long journey does not change
// that journey's already-fixed pace, a real, named scope boundary
// rather than a silently assumed one.
//
// ---------------------------------------------------------------------
// Theft reuses the real robbery composite and the real crime ledger
// ---------------------------------------------------------------------
// `stealVehicle` is not a new success formula — `heists.robberyAptitudeOf`
// (Stealth/Deception/Tactical Awareness) is the identical real
// composite `heists.js` already built for exactly this shape of
// crime, and `crime.recordCrime` (category `theft` — "deprivation,
// against a resident above the poverty line", the schema's own real
// category) is the one real choke point that already carries victim
// perception, knowledge and memory writes. Nothing here duplicates
// any of that. `VEHICLE_THEFT_TECHNIQUES` names three real, commonly
// documented methods (hot-wiring, lock manipulation, towing) for the
// incident's own `detail` field — flavour on a real record, not a
// second mechanical system per technique.
//
// ---------------------------------------------------------------------
// Restoration is new; crafting is not
// ---------------------------------------------------------------------
// Building a NEW vehicle from nothing is already `salvage.make`
// (`'car'`/`'motorcycle'`/`'scooter'` are real PRODUCTS there) — this
// file adds no second crafting path for that. Repairing an ALREADY-
// HELD vehicle's real condition is genuinely new: nothing in this
// engine repairs an item's condition from materials (`property.js`'s
// own maintenance repairs a BUILDING, a different real mechanism).
// `restoreVehicle` reuses the identical Tier/skill gate the matching
// `salvage.js` recipe already defines (mechanic, Tier 3, Technology)
// and the real materials from the SAME recipe, at half the quantity,
// rounded up — a repair costs less than a fresh build, never the same
// price for a different-shaped job.
//
// ---------------------------------------------------------------------
// Carry capacity: declared, not built
// ---------------------------------------------------------------------
// No carry-capacity LIMIT exists anywhere in this engine (there is no
// weight cap on a holder's own inventory to raise) — so "a vehicle
// increases carry capacity" would be a real number with nothing real
// to multiply. Declared here rather than invented: this file's real
// contribution is pace and fuel cost, honestly, not a capacity bonus
// grafted onto a cap that does not exist.

'use strict';

const inventory = require('./inventory.js');
const salvage = require('./salvage.js');
const occupations = require('./occupations.js');
const heists = require('./heists.js');
const crime = require('./crime.js');
const { seededDraw } = require('./seeded.js');

const VEHICLE_TYPES = ['car', 'motorcycle', 'scooter'];

//: The real item a vehicle actually burns. **Checked directly, not
//: assumed**: `items.TRADE_CATEGORIES` (the real §28 item-category
//: list) has no `fuel` entry — only `items.RESOURCE_TYPES` (the
//: SIBLING §28 enumeration, for `resources.resource_type`) does. There
//: is no existing item to reuse here, so `fuel` is registered as its
//: own real item, under its own name AS its own category — the real
//: §28 word itself, taken from the sibling list rather than an
//: invented one, since no entry in the item-category list means what
//: this does. Lazily registered the identical way `salvage.make`
//: already registers its own products, so nothing has to call a
//: separate setup step first.
const FUEL_ITEM_NAME = 'fuel';
function registerFuelItem(worldState) {
  worldState.barterItems = worldState.barterItems || [];
  if (worldState.barterItems.some((i) => i?.name === FUEL_ITEM_NAME)) return;
  worldState.barterItems.push({ name: FUEL_ITEM_NAME, category: FUEL_ITEM_NAME, origin: 'remnant' });
}

//: See this file's own header — a real, cited-as-interpretive pace,
//: not a measurement of any generated world's own road network.
const KM_PER_DAY_BY_TYPE = {
  car: 400,
  motorcycle: 350,
  scooter: 150,
};

//: Three real, commonly documented vehicle-theft methods — flavour on
//: a real `crime.recordCrime` incident's own `detail` field, not a
//: second mechanical system per technique.
const VEHICLE_THEFT_TECHNIQUES = ['hot-wiring', 'lock manipulation (slim jim)', 'towing'];

//: Flagged interpretive, same posture as every other hand-fitted
//: amount in this engine with no document to cite a figure from. A
//: full restoration from ruined (condition 0) takes three real
//: attempts, each gated on the real materials and the real skill.
const RESTORATION_CONDITION_GAIN = 40;

function assertVehicleType(type, who) {
  if (!VEHICLE_TYPES.includes(type)) {
    throw new Error(`${who}: type must be one of ${VEHICLE_TYPES.join(', ')}.`);
  }
}

// The real km/day a specific held vehicle can cover right now, scaled
// by its own real inventory condition. Null when the entity does not
// really hold one.
function kmPerDayFor(worldState, entityId, type) {
  assertVehicleType(type, 'kmPerDayFor');
  const holding = inventory.findHolding(worldState, Number(entityId), type);
  if (!holding || Number(holding.quantity) <= 0) return null;
  const conditionFactor = Math.max(0, Math.min(100, Number(holding.condition))) / 100;
  return KM_PER_DAY_BY_TYPE[type] * conditionFactor;
}

function currentHolderOf(worldState, type, entityId) {
  const holding = inventory.findHolding(worldState, Number(entityId), type);
  return holding && Number(holding.quantity) > 0 ? holding : null;
}

// One real day of use -- a small, flagged-interpretive wear amount,
// read and written through the exact real holding `travel.js` already
// reads to scale pace. Never-negative, same floor every condition
// field in this engine already holds.
const WEAR_PER_TRAVEL_DAY = 0.5;
function applyDailyWear(worldState, entityId, type) {
  const holding = inventory.findHolding(worldState, Number(entityId), type);
  if (!holding) return;
  holding.condition = Math.max(0, Number(holding.condition) - WEAR_PER_TRAVEL_DAY);
}

// Real theft -- see this file's own header. **`victimEntityId` is a
// real, named argument, not whoever a bare search happens to find
// first.** The first version of this picked the first matching
// holding in `worldState.inventory` regardless of who it belonged to
// — harmless with one real vehicle in the world, and silently wrong
// the moment a second person held the same real type: a thief could
// end up stealing from a stranger across the map while their actual,
// intended target kept theirs. Caught by testing two real holders of
// the same type at once, not assumed safe from one.
function stealVehicle(worldState, thiefEntityId, victimEntityId, type, options = {}) {
  assertVehicleType(type, 'stealVehicle');
  const { tick = worldState.tick ?? 0 } = options;

  const thief = (worldState.npcs || []).find((n) => n.id === Number(thiefEntityId));
  if (!thief) throw new Error(`stealVehicle: entity ${thiefEntityId} is not among the living.`);
  if (Number(victimEntityId) === Number(thiefEntityId)) {
    throw new Error(`stealVehicle: entity ${thiefEntityId} cannot steal a real ${type} from themselves.`);
  }

  const holding = inventory.findHolding(worldState, Number(victimEntityId), type);
  if (!holding || Number(holding.quantity) <= 0) {
    throw new Error(`stealVehicle: entity ${victimEntityId} does not really hold a ${type}.`);
  }
  const victimId = Number(victimEntityId);

  const technique = VEHICLE_THEFT_TECHNIQUES[Math.floor(
    seededDraw([worldState.seed ?? 'world', 'vehicle-theft-technique', type, victimId, tick])
      * VEHICLE_THEFT_TECHNIQUES.length,
  )];

  const aptitude = heists.robberyAptitudeOf(worldState, thiefEntityId);
  // Flagged interpretive, the identical centred-on-50 shape
  // `heists.successChanceFor` already uses for an undefended target —
  // a parked vehicle has no real "defense" term the way a guarded
  // organization does.
  const chance = Math.max(0, Math.min(1, 0.5 + (aptitude - 50) / 100));
  const succeeded = seededDraw([worldState.seed ?? 'world', 'vehicle-theft', type, victimId, thiefEntityId, tick]) < chance;

  if (!succeeded) {
    return { stolen: false, technique, victimEntityId: victimId };
  }

  inventory.transfer(worldState, {
    fromId: victimId, toId: Number(thiefEntityId), itemName: type, quantity: 1, tick,
  });
  // **Real provenance, where none existed before.** No inventory
  // holding anywhere in this engine ever carried where it came from —
  // `fencing.js`'s own header on why that made a legitimately-owned
  // vehicle and a stolen one indistinguishable the moment either
  // reached `barter.exchange`. The flag lands on the holding ROW
  // (itemName + condition), the real grain this schema has — a known,
  // stated limitation for the rare case a thief already held an
  // identical, legitimately-owned vehicle of the same type and
  // condition, named here rather than quietly swept aside.
  const stolenHolding = inventory.findHolding(worldState, Number(thiefEntityId), type, {
    condition: holding.condition,
  });
  if (stolenHolding) stolenHolding.stolen = true;
  const incident = crime.recordCrime(worldState, {
    category: 'theft',
    perpetratorId: Number(thiefEntityId),
    victimId,
    tick,
    detail: `stole a real ${type} via ${technique}`,
  });

  return { stolen: true, technique, victimEntityId: victimId, incident };
}

// Repairs an ALREADY-HELD vehicle's real condition from real salvaged
// materials -- see this file's own header on why this is genuinely
// new rather than a second crafting path. Refuses rather than
// half-applies when no real alternative's materials can be afforded.
function restoreVehicle(worldState, entityId, type, options = {}) {
  assertVehicleType(type, 'restoreVehicle');
  const npc = (worldState.npcs || []).find((n) => n.id === Number(entityId));
  if (!npc) throw new Error(`restoreVehicle: entity ${entityId} is not among the living.`);

  const holding = inventory.findHolding(worldState, Number(entityId), type);
  if (!holding || Number(holding.quantity) <= 0) {
    throw new Error(`restoreVehicle: entity ${entityId} does not hold a real ${type} to restore.`);
  }
  if (Number(holding.condition) >= 100) {
    return { restored: false, reason: 'already at full real condition', condition: Number(holding.condition) };
  }

  const recipe = salvage.recipeFor(type);
  if (!occupations.tierReachable(npc, recipe.tier)) {
    throw new Error(`restoreVehicle: restoring a ${type} is Tier ${recipe.tier} work.`);
  }
  const floor = salvage.skillFloorFor(recipe);
  const have = salvage.skillOf(worldState, entityId, recipe.skill);
  if (have === null || have < floor) {
    throw new Error(`restoreVehicle: restoring a ${type} takes ${recipe.skill} ${floor}; this entity has ${have}.`);
  }

  for (const alternative of recipe.from) {
    const needed = {};
    for (const [material, amount] of Object.entries(alternative)) {
      needed[material] = Math.ceil(amount / 2);
    }
    const canAfford = Object.entries(needed).every(
      ([material, amount]) => inventory.quantityOf(worldState, entityId, material) >= amount,
    );
    if (!canAfford) continue;

    for (const [material, amount] of Object.entries(needed)) {
      inventory.take(worldState, { entityId: Number(entityId), itemName: material, quantity: amount });
    }
    holding.condition = Math.min(100, Number(holding.condition) + RESTORATION_CONDITION_GAIN);
    return { restored: true, condition: holding.condition, consumed: needed };
  }

  throw new Error(`restoreVehicle: entity ${entityId} does not hold enough real materials to restore this ${type}.`);
}

module.exports = {
  VEHICLE_TYPES,
  KM_PER_DAY_BY_TYPE,
  FUEL_ITEM_NAME,
  VEHICLE_THEFT_TECHNIQUES,
  RESTORATION_CONDITION_GAIN,
  WEAR_PER_TRAVEL_DAY,
  registerFuelItem,
  kmPerDayFor,
  currentHolderOf,
  applyDailyWear,
  stealVehicle,
  restoreVehicle,
};
