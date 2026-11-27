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
// A real tool now changes the real odds, not just the flavour text
// (task #168)
// ---------------------------------------------------------------------
// NICB's own 2014 analysis states hot-wiring has been obsolete on any
// vehicle with a transponder immobiliser since that technology became
// standard in 1997; the same shift to electronic locks makes slim-jim
// lock manipulation equally obsolete. `heistTools.VEHICLE_BYPASS_
// TOOLS` are the real, current methods current reporting (NICB; CBS
// News; Autoblog, 2023) document instead: `key_programmer` (writing a
// new key via the OBD-II diagnostic port) and `relay_attack_device`
// (amplifying a nearby keyless fob's own signal -- NICB's 2016 test of
// a purchased unit opened 54% of tested vehicles). A thief holding
// either real tool uses the unmodified chance this file already had;
// one with neither still attempts the legacy techniques named above --
// an older or neglected vehicle can still fall to them -- but pays a
// real, flagged `LEGACY_TECHNIQUE_PENALTY` for using a method NICB
// itself documents as obsolete, rather than treating 2024's electronic
// locks and the 1960's as equally vulnerable to the same flavour text.
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
//
// ---------------------------------------------------------------------
// Driving is a real skill now (task #127), modulating pace, not
// gating it
// ---------------------------------------------------------------------
// `kmPerDayFor` scaled a vehicle's rated pace by its own real
// inventory condition and nothing else — the driver's own competence
// never entered it, even though `entityId` (the holder) already IS
// the driver. `skills.Driving` (traits.js's own header on why it was
// added — no spec document in this repo names a driving trait
// anywhere) closes that: `drivingModulatorFor` reads it live through
// `salvage.skillOf` and applies the identical `0.75 + x/200`
// neutral-at-50 band `economy.productivityOf` already established for
// Discipline/efficiency/health/focus, reused rather than invented
// fresh. A modulator, never a gate: an unmeasured or unskilled driver
// still gets the vehicle moving, just not as fast — the same posture
// every other modulator in this engine takes, and the right one here
// since nothing about a parked vehicle's base rating should be
// unreachable to a below-average driver.

'use strict';

const inventory = require('./inventory.js');
const salvage = require('./salvage.js');
const occupations = require('./occupations.js');
const heists = require('./heists.js');
const heistTools = require('./heistTools.js');
const crime = require('./crime.js');
const { seededDraw } = require('./seeded.js');

const VEHICLE_TYPES = ['car', 'motorcycle', 'scooter', 'electric_car', 'autonomous_car'];

// Task #109, by direct backlog instruction: "stalled electric/
// autonomous vehicles after the grid goes down (new mission source)."
// Real EVs and today's real commercially-deployed autonomous fleets
// (Waymo, Zoox) are both electric -- pairing them under one real
// dependency (grid power, never a fuel item) is accurate, not
// invented. **Remnant-only, same posture `weapons.js`'s own
// pistol/rifle already hold**: there is no real recipe here, and
// none is invented -- a battery pack, an electric drivetrain and (for
// the autonomous half) the onboard compute are not something
// `salvage.js`'s own materials-and-Tier model can honestly reproduce.
// `salvage.recipeFor` returns `null` for both names, which
// `restoreVehicle` below refuses explicitly rather than crashing on.
const ELECTRIC_VEHICLE_TYPES = ['electric_car', 'autonomous_car'];

// Registered the identical lazy way `registerFuelItem` already is --
// `transport`, the real §28 category `car`/`motorcycle`/`scooter`
// already use, never a second one invented for just these two.
function registerElectricVehicleItems(worldState) {
  worldState.barterItems = worldState.barterItems || [];
  for (const name of ELECTRIC_VEHICLE_TYPES) {
    if (worldState.barterItems.some((i) => i?.name === name)) continue;
    worldState.barterItems.push({ name, category: 'transport', origin: 'remnant' });
  }
}

// Same local join every other file in this engine repeats rather than
// centralising (`travel.js#cityOf`, `crime.js#cityOf`, and others) --
// an NPC's real community joined to its real city.
function cityOf(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === Number(entityId));
  if (!npc) return null;
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  return community?.city_id ?? null;
}

// Real tri-state, never a guessed boolean: `true`/`false` only once a
// real `electricity` infrastructure row for this city actually exists
// to ask — `infrastructure.isFailed`, never a second outage signal.
// `null` ("unknown") for a city with no such row placed at all, or no
// real city to ask about — the corollary on `Number()` this file's
// own project discipline holds elsewhere: unknown is not a zero, and
// a vehicle is not stalled on an unmeasured city any more than an
// unobserved person reads as content.
function gridAvailableIn(worldState, cityId) {
  if (cityId == null) return null;
  // eslint-disable-next-line global-require
  const infrastructure = require('./infrastructure.js');
  const rows = infrastructure.infrastructureIn(worldState, cityId, 'electricity');
  if (rows.length === 0) return null;
  return !rows.some((row) => infrastructure.isFailed(row));
}

// Is THIS specific vehicle usable right now, given where its holder
// actually is? A non-electric vehicle never stalls for this reason —
// its own fuel/condition checks are the whole story, unchanged.
function isStalled(worldState, entityId, vehicleType) {
  if (!ELECTRIC_VEHICLE_TYPES.includes(vehicleType)) return false;
  return gridAvailableIn(worldState, cityOf(worldState, entityId)) === false;
}

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
  // Same rate as `car` -- no document here distinguishes a real
  // achievable daily range for an EV/AV from an ordinary car on this
  // engine's own post-collapse road network, so this does not invent
  // one; the real difference this file models is the power source
  // (`isStalled`), not the pace.
  electric_car: 400,
  autonomous_car: 400,
};

//: Three real, commonly documented LEGACY vehicle-theft methods —
//: flavour on a real `crime.recordCrime` incident's own `detail`
//: field for a thief with no real bypass tool, not a second
//: mechanical system per technique. See this file's own header on why
//: "legacy" rather than simply "the techniques": NICB's own analysis
//: documents both as obsolete against any vehicle built after
//: transponder immobilisers became standard (1997).
const VEHICLE_THEFT_TECHNIQUES = ['hot-wiring', 'lock manipulation (slim jim)', 'towing'];

//: Flagged interpretive, same honesty as every other hand-fitted band
//: here. No source gives a number for how much harder a transponder
//: immobiliser makes a legacy technique; this is kept modest and in
//: the same direction `heists.js#INTIMIDATION_DETECTION_PENALTY`
//: already names for an unmeasured real trade-off.
const LEGACY_TECHNIQUE_PENALTY = 0.15;

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

// Task #127, by direct backlog instruction ("real Driving skill/
// trait, currently missing entirely"). `skills.Driving` (traits.js's
// own header on why it was added) is read here, the one real place a
// driver's own skill could change a real outcome in this file — the
// SAME `0.75 + x/200` neutral-at-50 band `economy.productivityOf`
// already established for Discipline/efficiency/health/focus, reused
// rather than inventing a second modulator shape. `?? 50` for the
// identical reason those use it: an unmeasured driver is neutral, not
// penalised, and every NPC generated after this trait exists gets a
// real value anyway. A modulator, not a gate — nobody is refused a
// vehicle's base pace for being an unmeasured or below-average driver,
// the same posture every other modulator in this engine takes.
const DRIVING_MODULATOR_FLOOR = 0.75;
const DRIVING_MODULATOR_SPAN = 200;
function drivingModulatorFor(worldState, entityId) {
  const driving = Number(salvage.skillOf(worldState, entityId, 'Driving') ?? 50);
  return DRIVING_MODULATOR_FLOOR + driving / DRIVING_MODULATOR_SPAN;
}

// The real km/day a specific held vehicle can cover right now, scaled
// by its own real inventory condition and the real driver's own real
// Driving skill (task #127) — the one ALREADY-REAL argument to this
// function, `entityId`, doubling as the driver, since that is also
// whoever the vehicle is held by. Null when the entity does not
// really hold one.
function kmPerDayFor(worldState, entityId, type) {
  assertVehicleType(type, 'kmPerDayFor');
  const holding = inventory.findHolding(worldState, Number(entityId), type);
  if (!holding || Number(holding.quantity) <= 0) return null;
  const conditionFactor = Math.max(0, Math.min(100, Number(holding.condition))) / 100;
  return KM_PER_DAY_BY_TYPE[type] * conditionFactor * drivingModulatorFor(worldState, entityId);
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

  // **A real tool changes which technique is even in play (task #168)
  // — not just a label on the incident.** A thief holding a real
  // `key_programmer` or `relay_attack_device` uses that real, current
  // method at the unmodified chance below; one with neither still
  // attempts a legacy technique, flavoured from the real, named list,
  // but pays `LEGACY_TECHNIQUE_PENALTY` for using a method NICB's own
  // analysis documents as obsolete against this vehicle's real
  // immobiliser.
  const bypassTool = heistTools.VEHICLE_BYPASS_TOOLS.find(
    (name) => inventory.findHolding(worldState, Number(thiefEntityId), name),
  );
  const technique = bypassTool ?? VEHICLE_THEFT_TECHNIQUES[Math.floor(
    seededDraw([worldState.seed ?? 'world', 'vehicle-theft-technique', type, victimId, tick])
      * VEHICLE_THEFT_TECHNIQUES.length,
  )];

  const aptitude = heists.robberyAptitudeOf(worldState, thiefEntityId);
  // Flagged interpretive, the identical centred-on-50 shape
  // `heists.successChanceFor` already uses for an undefended target —
  // a parked vehicle has no real "defense" term the way a guarded
  // organization does.
  const chance = Math.max(
    0,
    Math.min(1, 0.5 + (aptitude - 50) / 100 - (bypassTool ? 0 : LEGACY_TECHNIQUE_PENALTY)),
  );
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
  // Remnant-only, see this file's own header on ELECTRIC_VEHICLE_TYPES
  // -- `salvage.recipeFor` would return `null` for both, which this
  // refuses explicitly rather than crashing on `null.tier` below.
  if (ELECTRIC_VEHICLE_TYPES.includes(type)) {
    throw new Error(`restoreVehicle: a ${type} cannot be repaired from salvaged materials -- there is no real recipe for one, by design.`);
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
  ELECTRIC_VEHICLE_TYPES,
  KM_PER_DAY_BY_TYPE,
  FUEL_ITEM_NAME,
  VEHICLE_THEFT_TECHNIQUES,
  LEGACY_TECHNIQUE_PENALTY,
  RESTORATION_CONDITION_GAIN,
  WEAR_PER_TRAVEL_DAY,
  DRIVING_MODULATOR_FLOOR,
  DRIVING_MODULATOR_SPAN,
  registerFuelItem,
  registerElectricVehicleItems,
  gridAvailableIn,
  isStalled,
  drivingModulatorFor,
  kmPerDayFor,
  currentHolderOf,
  applyDailyWear,
  stealVehicle,
  restoreVehicle,
};
