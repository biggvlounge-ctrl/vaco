// server/weapons.js
//
// Real weapons and real ammunition, as two separate things — by direct
// instruction, after the first draft of this file conflated them.
//
// ---------------------------------------------------------------------
// Four interpretive calls, named up front rather than left implicit
// ---------------------------------------------------------------------
//
// 1. **A gun and its ammunition are two separate real items.** §26 gives
//    this file no fourth category to invent, so both stay `protection`
//    — the same category `salvage.js` already uses for `blade`/`club`/
//    `shield` — and a `firearm`/`ammunition` flag on each entry (same
//    shape as `material`/`product` elsewhere) is what tells a gun apart
//    from a melee weapon sharing that category. `crime.js` used to ask
//    `inventory.hasEquippedCategory(..., 'protection')` for "armed", which
//    would have called an equipped shield a gun the day one existed; this
//    file's `FIREARM_NAMES` is the narrower, correct question.
//
//    **A firearm with no held ammunition is a real object that does
//    nothing.** `isFunctioningFirearm` is the honest gate: equipped gun
//    AND at least one round of its own ammunition, or `crime.js` falls
//    back to classifying the act as unarmed.
//
// 2. **Where a stockpile is found, and where it is not invented.**
//    `discovery.js`'s own `POOLS` already names two real location
//    types for exactly this: `gun-store` (a real retail landmark
//    category the document left with no pool — closed here, by direct
//    instruction, rather than invented silently) and
//    `government-building` (a hero-tier landmark whose own `discovery`
//    string already says "weapons/security equipment" and which
//    already carries `itemCategories: ['protection']` — the honest
//    substrate for "a military/security installation", since
//    `landmarks.js` has no separate military-base category and none is
//    invented here). **No third discovery location exists** — an
//    "ammunition plant" is not a place to loot, it is the production
//    mechanic below.
//
// 3. **Ammunition manufacturing is real, bounded, and era-gated.**
//    `MANUFACTURING_ERA = 'industrialization'` is the chosen floor —
//    the first era on `technology.ERA_NAMES`'s own ladder with the
//    industrial capacity a cartridge factory needs; below it, ammunition
//    is what survived the reset and nothing more. At or above it,
//    `manufactureAmmunition` reuses the exact gate `produce.js#harvest`
//    already established for a real primary-produce occupation (a real
//    employment record, a real business employer, read live) — one
//    small batch per call, never a passive per-tick regen.
//
// 4. **Military-grade firearms are not a US-only mechanic.**
//    `countryPacks.js` carries real, SIPRI-sourced
//    `militaryExpenditurePctGDP` per country — that is the real,
//    already-collected signal this file reads to decide whether a
//    region's `government-building` can ever hold a `machine_gun`,
//    rather than assuming any one country's regime (ATF/FFL licensing
//    is a real US-specific instance of "a licensed dealer is a
//    discoverable location", not a universal default). A region with
//    no `country_key`, or a country this engine has no tracked military
//    figure for, genuinely cannot produce a `machine_gun` find — an
//    honest absence, not a guessed cutoff on the real expenditure
//    number itself.
//
// ---------------------------------------------------------------------
// The taxonomy, and what is deliberately NOT in it
// ---------------------------------------------------------------------
// `blade`/`club`/`shield` (`salvage.js`) are already the street-level
// melee tier — a shiv is a blade, and neither is reinvented here.
// `zip_gun` is this request's street-level FIREARM: crude, illegal,
// improvised, and genuinely craftable at Tier 2 Crafting the same way
// `salvage.js`'s other Tier 1-2 products are — so it lives in
// `salvage.js`'s own `PRODUCTS`/`RECIPES` (reusing that machinery
// rather than duplicating `canMake`/`make`), and this file only adds its
// name to the firearm vocabulary below. `pistol`/`rifle` are mid-tier,
// pre-collapse remnant stock — nobody alive manufactures a fresh one,
// same reasoning `items.js` already gives gold ingots and cut gems.
// `machine_gun` is the most restricted tier: remnant-only (never
// producible, at any era — true automatic-weapons manufacture is
// beyond what this engine's industrial model represents, a stricter
// statement than the ammunition gate above) and discoverable only from
// a `government-building` in a region with a tracked military figure.
//
// `auto_sear_switch` ("a switch") is modelled as the real, separate,
// small item it is in life — an illegal device that turns an
// otherwise-semi-automatic firearm (`pistol`/`rifle`) into one that
// fires like `machine_gun`'s burst — never folded into the weapon item
// itself. It is registered so the rest of the engine (inventory, barter)
// recognises it by name, and deliberately NOT placed in any
// `discovery.js` loot pool — a real, separately-acquirable thing this
// round does not build an acquisition path for, which is named here
// rather than left to look like an oversight.
//
// **Missiles and drones are explicitly out of scope for this file.**
// Both are organizational/military-asset-tier capabilities — closer to
// `organizations.power`/`security` or a future ordnance system than a
// person's carryable, equippable inventory — and do not fit the
// holder/item/quantity/equipped shape everything above uses. Drones
// specifically fall inside CLAUDE.md's own already-locked, explicitly
// deferred Transportation scope. Declared here as a real, deliberate
// boundary, not a silently missed request.

'use strict';

const economy = require('./economy.js');

// ---------------------------------------------------------------------
// FIREARMS — real guns, never the thing that makes them fire
// ---------------------------------------------------------------------
//: `zip_gun` is deliberately absent from this table's own registration —
//: it is `salvage.js`'s product, crafted through `salvage.canMake`/
//: `salvage.make`. It is still named in `FIREARM_NAMES` below, because
//: "is this a gun" is a question this file answers regardless of which
//: module registered the item.
const FIREARMS = {
  pistol: { category: 'protection', origin: 'remnant' },
  rifle: { category: 'protection', origin: 'remnant' },
  machine_gun: { category: 'protection', origin: 'remnant', restricted: true },
};

const FIREARM_NAMES = [...Object.keys(FIREARMS), 'zip_gun'];

// Semi-automatic firearms a real switch can modify. `zip_gun` is a
// crude single-shot improvisation, not a semi-auto action, and
// `machine_gun` already fires on its own burst — neither takes one.
const SWITCHABLE_FIREARMS = ['pistol', 'rifle'];

// Which real ammunition each firearm needs. `zip_gun` and `machine_gun`
// each reuse an existing caliber rather than this file inventing a
// fifth cartridge — a deliberate simplification, named rather than
// hidden: a zip gun is modelled as pistol-caliber and a machine gun as
// rifle-caliber.
const AMMO_FOR = {
  pistol: 'pistol_rounds',
  rifle: 'rifle_rounds',
  zip_gun: 'pistol_rounds',
  machine_gun: 'rifle_rounds',
};

// Rounds one real firing event spends. Small and deliberately so, same
// discipline `salvage.js`'s own recipe quantities carry — this is one
// incident, not a battle. A switch-modified semi-auto spends the
// `machine_gun` burst (see `isSwitchModified`), the one real escalation
// a switch is for.
const ROUNDS_PER_SHOT = {
  pistol: 1, rifle: 1, zip_gun: 1, machine_gun: 5,
};

// ---------------------------------------------------------------------
// AMMUNITION — finite from world start, not a craft loop
// ---------------------------------------------------------------------
//: `origin: 'remnant'` for both, always — not a value that flips at the
//: manufacturing era. What changes above `MANUFACTURING_ERA` is not
//: what these items ARE, it is that `manufactureAmmunition` becomes a
//: real way to get more of them; the stockpile a world starts with is
//: remnant stock either way, same as every other pre-collapse item this
//: engine prices as `origin: 'remnant'`.
const AMMUNITION = {
  pistol_rounds: { category: 'protection', origin: 'remnant' },
  rifle_rounds: { category: 'protection', origin: 'remnant' },
};

const AMMUNITION_NAMES = Object.keys(AMMUNITION);

// The illegal modifier device. Remnant-only — nobody alive machines a
// precision auto sear out of Tier 1-2 scrap, same reasoning `items.js`
// gives a cut diamond.
const SWITCH_ITEM = 'auto_sear_switch';

// ---------------------------------------------------------------------
// Registering firearms, ammunition and the switch as real items
// ---------------------------------------------------------------------
// Through `worldState.barterItems`, the extension point `items.js`
// documents — same shape `salvage.js`/`produce.js` already use.
// Idempotent by name. `zip_gun` is excluded on purpose (see header):
// `salvage.registerItems` owns it.
function itemDefinitions() {
  const out = [];
  for (const [name, definition] of Object.entries(FIREARMS)) {
    out.push({ name, category: definition.category, origin: definition.origin, firearm: true });
  }
  for (const [name, definition] of Object.entries(AMMUNITION)) {
    out.push({
      name, category: definition.category, origin: definition.origin, ammunition: true,
    });
  }
  out.push({ name: SWITCH_ITEM, category: 'protection', origin: 'remnant', switchDevice: true });
  return out;
}

function registerItems(worldState) {
  if (!Array.isArray(worldState.barterItems)) worldState.barterItems = [];
  const known = new Set(worldState.barterItems.map((i) => i?.name));
  let added = 0;
  for (const definition of itemDefinitions()) {
    if (known.has(definition.name)) continue;
    worldState.barterItems.push(definition);
    added += 1;
  }
  return added;
}

// ---------------------------------------------------------------------
// Is this person actually armed with a firearm?
// ---------------------------------------------------------------------

function equippedFirearm(worldState, entityId) {
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  const hit = inventory.equippedItems(worldState, entityId)
    .find((h) => FIREARM_NAMES.includes(h.item_name));
  return hit ? hit.item_name : null;
}

// The real gate from the header: equipped gun AND a held round of its
// own ammunition. Ammo need not itself be `equipped` — a magazine is
// loaded, not worn as gear — `inventory.quantityOf` is the right
// question.
function isFunctioningFirearm(worldState, entityId) {
  const gun = equippedFirearm(worldState, entityId);
  if (!gun) return false;
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  return inventory.quantityOf(worldState, entityId, AMMO_FOR[gun]) > 0;
}

// A real switch, held, fitted to a firearm it actually fits.
function isSwitchModified(worldState, entityId) {
  const gun = equippedFirearm(worldState, entityId);
  if (!gun || !SWITCHABLE_FIREARMS.includes(gun)) return false;
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  return inventory.quantityOf(worldState, entityId, SWITCH_ITEM) > 0;
}

// Fired exactly once, by `crime.recordEscalation` — consumes the real
// rounds that incident just used, no more than what is actually held
// (standing rule: no negative holding). A world can run genuinely dry,
// globally or on one person, and that is the correct outcome.
function fireRound(worldState, entityId) {
  const gun = equippedFirearm(worldState, entityId);
  if (!gun) return { fired: false, roundsUsed: 0 };
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  const ammoName = AMMO_FOR[gun];
  const burst = isSwitchModified(worldState, entityId) ? ROUNDS_PER_SHOT.machine_gun : (ROUNDS_PER_SHOT[gun] ?? 1);
  const have = inventory.quantityOf(worldState, entityId, ammoName);
  const use = Math.min(burst, have);
  if (use <= 0) return { fired: false, roundsUsed: 0 };
  inventory.take(worldState, { entityId, itemName: ammoName, quantity: use });
  return { fired: true, roundsUsed: use, roundsLeft: inventory.quantityOf(worldState, entityId, ammoName) };
}

// ---------------------------------------------------------------------
// Machine guns — restricted to a real, tracked military signal
// ---------------------------------------------------------------------
// `countryPacks.js`'s real, SIPRI-sourced `militaryExpenditurePctGDP`
// per country — read through the one real chain that already exists
// from a landmark to a country: `properties.city_id` ->
// `cities.region_id` -> `regions.country_key` ->
// `countryPacks.countryFor`. A region with no country attached, or a
// country this file has no tracked figure for, answers `false` —
// honest absence, not an invented cutoff on the number itself.
function regionHasTrackedMilitaryCapability(worldState, propertyId) {
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property || !property.city_id) return false;
  const city = (worldState.cities || []).find((c) => c.id === property.city_id);
  if (!city || !city.region_id) return false;
  const region = (worldState.regions || []).find((r) => r.id === city.region_id);
  if (!region || !region.country_key) return false;
  // eslint-disable-next-line global-require
  const countryPacks = require('./countryPacks.js');
  const country = countryPacks.countryFor(region.country_key);
  return !!(country && country.militaryExpenditurePctGDP);
}

// `discovery.js`'s own question: can THIS item be found at THIS
// property? `auto_sear_switch` never — see header. `machine_gun` only
// from a `government-building` with a real tracked military signal.
// Everything else this file names answers true wherever its §26
// category pool already allows it.
const RESTRICTED_DISCOVERY_NAMES = ['machine_gun', SWITCH_ITEM];

function availableAt(worldState, propertyId, itemName) {
  if (itemName === SWITCH_ITEM) return false;
  if (itemName === 'machine_gun') {
    const property = (worldState.properties || []).find((p) => p.id === propertyId);
    return property?.landmark_category === 'government-building'
      && regionHasTrackedMilitaryCapability(worldState, propertyId);
  }
  return true;
}

// ---------------------------------------------------------------------
// Manufacturing — era-gated, occupation-gated, one real batch per call
// ---------------------------------------------------------------------
const MANUFACTURING_ERA = 'industrialization';
const MANUFACTURING_OCCUPATION = 'engineer';
const ROUNDS_PER_MANUFACTURE = 20;

function canManufactureAmmunition(worldState, entityId, ammoName) {
  if (!AMMUNITION[ammoName]) {
    return { ok: false, reason: `"${ammoName}" is not an ammunition item` };
  }
  // eslint-disable-next-line global-require
  const media = require('./media.js');
  if (!media.eraReached(worldState, MANUFACTURING_ERA)) {
    return {
      ok: false,
      reason: `ammunition manufacturing needs the ${MANUFACTURING_ERA} era, not yet reached`,
      era: MANUFACTURING_ERA,
    };
  }
  const record = economy.getEmployment(worldState, entityId);
  if (record?.position !== MANUFACTURING_OCCUPATION) {
    return {
      ok: false,
      reason: `manufacturing ammunition is an ${MANUFACTURING_OCCUPATION}'s work, and ${entityId} is not employed as one`,
      occupation: MANUFACTURING_OCCUPATION,
    };
  }
  const employer = (worldState.organizations || []).find((o) => o.id === record.employer_organization_id);
  if (!employer || employer.type !== 'business') {
    return { ok: false, reason: 'ammunition is manufactured by a real business, not an individual' };
  }
  return { ok: true, employer };
}

function manufactureAmmunition(worldState, entityId, ammoName, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const check = canManufactureAmmunition(worldState, entityId, ammoName);
  if (!check.ok) throw new Error(`cannot manufacture ${ammoName}: ${check.reason}`);
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  registerItems(worldState);
  const given = inventory.give(worldState, {
    entityId, itemName: ammoName, quantity: ROUNDS_PER_MANUFACTURE, tick,
  });
  return { ammoName, quantity: ROUNDS_PER_MANUFACTURE, given };
}

module.exports = {
  FIREARMS,
  FIREARM_NAMES,
  SWITCHABLE_FIREARMS,
  AMMO_FOR,
  ROUNDS_PER_SHOT,
  AMMUNITION,
  AMMUNITION_NAMES,
  SWITCH_ITEM,
  RESTRICTED_DISCOVERY_NAMES,
  MANUFACTURING_ERA,
  MANUFACTURING_OCCUPATION,
  ROUNDS_PER_MANUFACTURE,
  itemDefinitions,
  registerItems,
  equippedFirearm,
  isFunctioningFirearm,
  isSwitchModified,
  fireRound,
  regionHasTrackedMilitaryCapability,
  availableAt,
  canManufactureAmmunition,
  manufactureAmmunition,
};
