// server/produce.js
//
// Primary production -- what a living person grows, raises, catches
// or gathers, as distinct from `salvage.js`'s two verbs (breaking an
// old-world thing down, and crafting a product from materials).
//
// ---------------------------------------------------------------------
// Why this is a third file rather than growing salvage.js
// ---------------------------------------------------------------------
// Per direct instruction: a post-collapse world "will only be
// importing and exporting so much from the old world, and anything
// else will have to be created or made or manufactured." `items.js`
// now carries that distinction as `origin` ('remnant' | 'producible'),
// and `salvage.js` already models one half of "producible" -- crafting
// a product from materials somebody already holds. It does not model
// the other half: growing wheat, catching a fish, raising livestock,
// or gathering salt is not breaking anything down and it is not
// combining held materials either. It is turning LAND, WATER or an
// ANIMAL into a held item, through a real occupation this engine
// already has (`occupations.js`'s `farmer`/`fisher`/`hunter`) and
// `economy.js`'s already-real `employment_records.position`.
//
// **This is new design, same posture as `salvage.js`'s own header.**
// No document specifies a primary-produce catalogue or a harvest
// mechanic; both are invented and flagged as such. What is sourced is
// the vocabulary this file builds on: §26's twenty trade categories
// (`items.js`), the occupation taxonomy (`occupations.js`), and the
// sixteen skills (`traits.js`). This file adds no fourth vocabulary.
//
// ---------------------------------------------------------------------
// What this does NOT do
// ---------------------------------------------------------------------
// It does not decide HOW MUCH a farmer grows in a tick, or run on a
// schedule. `salvage.js`'s own header already draws that line --
// "production is economy.js's job" -- and `economy.js#runProduction`
// already converts labour into an employer's money every tick. This
// is the one piece that was still missing underneath it: a harvest
// gives a REAL, held, nameable item (so "what is in this world" has an
// answer beyond a currency figure), gated the same way `salvage.js`
// gates crafting -- a real occupation, a real skill, read live.
//
// It does not model transport, trade routes, or moving goods between
// places -- CLAUDE.md's locked scope defers Transportation explicitly,
// and nothing here creates a vehicle, a route or a distance. A harvest
// happens where the person already is.

'use strict';

const items = require('./items.js');
const occupations = require('./occupations.js');
const economy = require('./economy.js');
const salvage = require('./salvage.js');

// ---------------------------------------------------------------------
// PRIMARY_PRODUCE — grown, raised, caught or gathered, not crafted
// ---------------------------------------------------------------------
//: `occupation` names a real row in `occupations.OCCUPATIONS` --
//: checked by the test, so this file cannot drift from the taxonomy by
//: inventing a trade it does not have. `null` means no occupation gate
//: at all: salt and clean water are gathered the way `items.js`'s own
//: `Sand`/`Gravel` are, by anybody, the same honest exception that file
//: already makes.
const PRIMARY_PRODUCE = {
  wheat: { category: 'crops', occupation: 'farmer' },
  vegetables: { category: 'crops', occupation: 'farmer' },
  raw_fish: { category: 'fish', occupation: 'fisher' },
  raw_meat: { category: 'livestock', occupation: 'hunter' },
  raw_fiber: { category: 'textiles', occupation: 'farmer' },
  salt: { category: 'spices', occupation: null },
  clean_water: { category: 'water', occupation: null },
};

const PRIMARY_PRODUCE_NAMES = Object.keys(PRIMARY_PRODUCE);

// ---------------------------------------------------------------------
// REMNANT_GOODS — old-world stock, found rather than made
// ---------------------------------------------------------------------
//: No recipe, no occupation, no harvest -- this file's own `canHarvest`
//: refuses every one of them, and `salvage.js`'s `canMake` already
//: refuses anything with no RECIPES entry. The only ways into a
//: holding are discovery (`discovery.js`'s pools) and whatever a
//: scenario hands out directly. That absence is the point: these are
//: exactly what "importing so much from the old world" leaves behind,
//: and no more of it is coming.
const REMNANT_GOODS = {
  canned_food: { category: 'food' },
  bottled_water: { category: 'water' },
  antibiotics: { category: 'medicine' },
  old_coat: { category: 'clothing' },
  preserved_spices: { category: 'spices' },
};

const REMNANT_GOOD_NAMES = Object.keys(REMNANT_GOODS);

// ---------------------------------------------------------------------
// Registering these as items
// ---------------------------------------------------------------------
// Through `worldState.barterItems`, the same extension point
// `salvage.js` uses and `items.js` documents -- one shared catalogue,
// never a second one. Idempotent by name.
function itemDefinitions() {
  const out = [];
  for (const [name, definition] of Object.entries(PRIMARY_PRODUCE)) {
    out.push({ name, category: definition.category, origin: 'producible', primaryProduce: true });
  }
  for (const [name, definition] of Object.entries(REMNANT_GOODS)) {
    out.push({ name, category: definition.category, origin: 'remnant', remnantGood: true });
  }
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
// canHarvest / harvest
// ---------------------------------------------------------------------
// Same three-gate shape `salvage.canMake` already uses, read from the
// OCCUPATION's own real definition rather than a second, invented
// floor -- a farmer is Tier 2 Agriculture because `occupations.js`
// already says so, and this file does not get to disagree with it.
function canHarvest(worldState, entityId, name) {
  const produce = PRIMARY_PRODUCE[name];
  if (!produce) {
    if (REMNANT_GOODS[name]) {
      return { ok: false, reason: `"${name}" is old-world stock -- nobody alive can make more of it` };
    }
    return { ok: false, reason: `"${name}" is not something anybody grows, raises, catches or gathers` };
  }

  // No occupation gate at all: anybody can gather it, same honest
  // exception `items.js` already makes for Sand and Gravel.
  if (!produce.occupation) return { ok: true, produce };

  const trade = occupations.definitionOf(produce.occupation);
  if (!trade) {
    throw new Error(`produce.js: "${produce.occupation}" is not a real occupation -- check occupations.OCCUPATIONS`);
  }

  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) return { ok: false, reason: `no entity ${entityId}` };

  const record = economy.getEmployment(worldState, entityId);
  if (record?.position !== produce.occupation) {
    return {
      ok: false,
      reason: `harvesting ${name} is a ${produce.occupation}'s work, and ${entityId} is not employed as one`,
      occupation: produce.occupation,
    };
  }

  if (!occupations.tierReachable(npc, trade.tier)) {
    return { ok: false, reason: `${produce.occupation} is Tier ${trade.tier} work`, tier: trade.tier };
  }

  const floor = salvage.skillFloorFor({ tier: trade.tier });
  const have = salvage.skillOf(worldState, entityId, trade.skill);
  if (have === null || have < floor) {
    return {
      ok: false,
      reason: `harvesting ${name} takes ${trade.skill} ${floor}`,
      skill: trade.skill,
      need: floor,
      have,
    };
  }

  return { ok: true, produce, trade };
}

//: One unit per call, same deliberately small quantity `salvage.js`'s
//: own `RECIPES` keep -- this is a day's work, not a harvest season,
//: and how large a season's yield is stays `economy.js`'s question.
function harvest(worldState, entityId, name, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const check = canHarvest(worldState, entityId, name);
  if (!check.ok) throw new Error(`cannot harvest ${name}: ${check.reason}`);

  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  registerItems(worldState);
  const given = inventory.give(worldState, { entityId, itemName: name, quantity: 1, tick });
  return { name, given };
}

// ---------------------------------------------------------------------
// describeProduce -- the same honesty check `describeSalvage` runs
// ---------------------------------------------------------------------
// Every category the user asked to see filled, checked against the
// real catalogue rather than asserted. `services` and `labor` are
// real §26 categories with no physical item by design -- a haircut is
// not a thing anybody holds -- and `transport` stays empty on purpose,
// deferred under CLAUDE.md's locked Transportation scope.
const NO_PHYSICAL_ITEM_CATEGORIES = ['services', 'labor', 'transport'];

function describeProduce(worldState) {
  const catalogue = items.itemsFor(worldState);
  const byCategory = new Map();
  for (const item of catalogue) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item.name);
  }

  const emptyCategories = items.TRADE_CATEGORIES.filter(
    (category) => !NO_PHYSICAL_ITEM_CATEGORIES.includes(category) && !(byCategory.get(category)?.length),
  );

  return {
    totalItems: catalogue.length,
    remnantItems: catalogue.filter((i) => i.origin === 'remnant').length,
    producibleItems: catalogue.filter((i) => i.origin === 'producible').length,
    unclassifiedOrigin: catalogue.filter((i) => i.origin !== 'remnant' && i.origin !== 'producible').map((i) => i.name),
    emptyCategories,
  };
}

module.exports = {
  PRIMARY_PRODUCE,
  PRIMARY_PRODUCE_NAMES,
  REMNANT_GOODS,
  REMNANT_GOOD_NAMES,
  NO_PHYSICAL_ITEM_CATEGORIES,
  itemDefinitions,
  registerItems,
  canHarvest,
  harvest,
  describeProduce,
};
