// server/merchandise.js
//
// **What is on the shelves, and who gets it when the place is taken.**
//
// `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` makes one claim this engine
// did not honour, and states it as confirmed rather than proposed:
//
//   "once a location's Control Key challenge is met, the capturing
//   group — Organization, Gang, Tribe, Family, or Relief Organization —
//   gains real, tangible access to that location's merchandise pool."
//
//   KeyLocationCapture { locationId, capturingEntityId,
//     capturingEntityType, merchandiseAccessGranted: true }
//
// `grep -rn merchandise server/` returned nothing. **Taking a hardware
// store gave you a hardware store and not one hammer** — which mattered
// more the day `control.js` grew a materiel requirement, because a
// tribe that cannot take a building for want of tools cannot take the
// building tools come from either. That is a lock, not a difficulty
// curve.
//
// ---------------------------------------------------------------------
// The items the world did not have
// ---------------------------------------------------------------------
// `discovery.describeDiscovery` found this before it was looked for:
// four §26 trade categories that real discovery pools draw from and
// **no item in any generated world belongs to** — `clothing`, `food`,
// `repair` and `transport`. §27 prices seventeen items and they are
// metals, gems, sand, gravel, two tools and a musical instrument. So
// searching a grocery store found nothing, every time, for ever.
//
// The names below come from the retail document's own merchandise
// nouns, quoted where it gives them — "construction materials",
// "protective gear", "medical supplies", "technology components",
// "vehicle repair components". That is as sourced as this can be: §26
// gives the categories and this document gives the goods, and nothing
// here invents a third vocabulary.
//
// **Unpriced, like everything else added through `barterItems`.**
// `items.js` says no item is invented there and §27's seventeen values
// are the only ones anybody has. `knowledge.js` set the precedent with
// books and `salvage.js` followed it; a shelf of tinned food with a
// made-up price would be a made-up economy.

'use strict';

const items = require('./items.js');

// ---------------------------------------------------------------------
// STOCK — the goods, per §26 category
// ---------------------------------------------------------------------
//: Keyed by item name, carrying the §26 category it trades as. The test
//: asserts every category here is one of the twenty and that between
//: them they cover every category a `discovery` pool draws on — which
//: is the guard that closes the gap rather than moving it.
const STOCK = {
  // "Grocery Store/Supermarket (food)"
  'preserved food': { category: 'food' },
  'dry goods': { category: 'food' },
  // "Clothing Store (clothing, fabric, protective gear)" — three nouns,
  // three §26 categories, which is why this one line of the document
  // produces three entries.
  'work clothing': { category: 'clothing' },
  'fabric bolt': { category: 'textiles' },
  'protective gear': { category: 'protection' },
  // "Pharmacy (medicine, medical supplies)"
  'medical supplies': { category: 'medicine' },
  // "Auto Parts Store (vehicle repair components)"
  'vehicle parts': { category: 'repair' },
  'fuel can': { category: 'transport' },
  // "Electronics Store (technology components)"
  'technology components': { category: 'tools' },
  // "Sporting Goods Store (hunting/fishing equipment)"
  'hunting equipment': { category: 'tools' },
  'fishing equipment': { category: 'fish' },
  // "Hardware Store (tools, construction materials)" — `salvage.js`
  // already registers timber, stone and scrap metal under `materials`,
  // so construction materials need nothing new. Listed here as a note
  // rather than a duplicate entry, because two modules registering the
  // same name under different definitions is the divergence
  // `registerItems` being idempotent by name exists to prevent.

  // Added 26 Sep 2026, not from the retail document — `landmarks.js`'s
  // new `river`/`lake` categories give `water` a discovery pool
  // (`discovery.js`) and nothing in this file or `salvage.js` had ever
  // put an item in that §26 category, which the merchandise guard below
  // caught the moment those two pools existed. Named plainly rather
  // than reaching for the document's retail-noun style, because no
  // retail location sells this — a river does.
  'clean water': { category: 'water' },
};

const STOCK_NAMES = Object.keys(STOCK);

//: How many units of merchandise a captured location yields per point
//: of its historical significance. Deliberately the same shape as
//: `discovery.FINDS_PER_SIGNIFICANCE` and deliberately larger: taking a
//: shop gets you the stockroom, searching it gets you what is on one
//: shelf. Ten times, which is the one interpretive number here — the
//: document says "real, tangible access" and gives no quantity.
const UNITS_PER_SIGNIFICANCE = 1.0;
const MINIMUM_UNITS = 1;

function itemDefinitions() {
  return STOCK_NAMES.map((name) => ({
    name, category: STOCK[name].category, merchandise: true,
  }));
}

// Idempotent by name (standing rule 15), and `salvage.js`/`knowledge.js`
// register into the same array.
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
// What a location holds
// ---------------------------------------------------------------------
// The merchandise pool IS the discovery pool — `discovery.POOLS`
// already carries the retail document's own "(tools, construction
// materials)" as `itemCategories: ['tools','materials']`. One
// vocabulary reached two ways: searching takes one thing off a shelf,
// capturing takes the stockroom. A second table of what a hardware
// store sells would be the two-disagreeing-answers failure by
// construction.
function stockOf(worldState, propertyId) {
  // eslint-disable-next-line global-require
  const discovery = require('./discovery.js');
  // eslint-disable-next-line global-require
  const landmarks = require('./landmarks.js');

  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property || !property.landmark_category) return null;
  const pool = discovery.poolFor(property.landmark_category);
  if (!pool || !pool.itemCategories) return null;

  const significance = landmarks.significanceOf(worldState, propertyId) ?? 0;
  const units = Math.max(
    MINIMUM_UNITS,
    Math.round(significance * UNITS_PER_SIGNIFICANCE),
  );

  // Spread across whatever the world actually has in those categories,
  // read live so a world that registered salvage's products finds them
  // and one that did not does not.
  const catalogue = items.itemsFor(worldState);
  const available = pool.itemCategories
    .flatMap((category) => catalogue.filter((i) => i.category === category));
  if (available.length === 0) return {};

  const out = {};
  for (let i = 0; i < units; i += 1) {
    const item = available[i % available.length];
    out[item.name] = (out[item.name] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------
// grantOnCapture — the document's own KeyLocationCapture
// ---------------------------------------------------------------------
// **Once, per capture.** `properties.merchandise_taken` is the guard:
// a group that takes a shop, loses it and takes it back does not get a
// second stockroom, and a takeover loop would otherwise be an infinite
// supply of food — standing rule 13, and the same reason
// `discovery.js` counts what has been carried out.
//
// Goods go to the members, not to an abstraction. There is no "tribe
// inventory" table in the schema and inventing one would put a second
// answer beside `inventory.holder_entity_id`; `control.materielOf`
// already sums a tribe's holdings across its living members, so
// handing the stock to the members IS handing it to the tribe, and the
// takeover key reads it back without a line of new code.
function grantOnCapture(worldState, propertyId, tribeId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  // eslint-disable-next-line global-require
  const familyTraits = require('./familyTraits.js');
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');

  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property) return null;
  if (property.merchandise_taken === true) return null;

  const stock = stockOf(worldState, propertyId);
  if (stock === null || Object.keys(stock).length === 0) return null;

  const members = familyTraits.livingMembers(worldState, tribeId);
  if (members.length === 0) return null;

  registerItems(worldState);
  const granted = {};
  let index = 0;
  for (const [itemName, quantity] of Object.entries(stock)) {
    // Round-robin across the members, so a large haul is spread through
    // the tribe rather than piled on whoever happens to be first.
    const holder = members[index % members.length];
    index += 1;
    inventory.give(worldState, { entityId: holder.id, itemName, quantity, tick });
    granted[itemName] = quantity;
  }
  property.merchandise_taken = true;

  return {
    locationId: propertyId,
    capturingEntityId: tribeId,
    capturingEntityType: 'tribe',
    merchandiseAccessGranted: true,
    granted,
  };
}

// ---------------------------------------------------------------------
// describeMerchandise — the guard
// ---------------------------------------------------------------------
// The claim is that capturing a retail location gives real, tangible
// access to its merchandise. That is false if a pool's categories have
// nothing in them, which is the exact defect this module was built to
// fix, so the measurement is the first thing here.
function describeMerchandise(worldState) {
  // eslint-disable-next-line global-require
  const discovery = require('./discovery.js');

  const drawn = new Set();
  for (const pool of Object.values(discovery.POOLS)) {
    for (const category of pool?.itemCategories ?? []) drawn.add(category);
  }
  const catalogue = items.itemsFor(worldState);
  const empty = [...drawn].filter((c) => !catalogue.some((i) => i.category === c));

  const retail = (worldState.properties || [])
    .filter((p) => p.landmark_category && discovery.poolFor(p.landmark_category)?.itemCategories);

  return {
    stockNames: STOCK_NAMES.length,
    categoriesDrawnOn: [...drawn].sort(),
    // The gap, named. Empty when every pool has something behind it.
    emptyCategories: empty,
    stockedLocations: retail.length,
    alreadyTaken: retail.filter((p) => p.merchandise_taken === true).length,
    // Nothing here is priced — the same guard `salvage.js` carries.
    priced: itemDefinitions().filter((d) => d.baseValue !== undefined).length,
  };
}

module.exports = {
  STOCK,
  STOCK_NAMES,
  UNITS_PER_SIGNIFICANCE,
  MINIMUM_UNITS,
  itemDefinitions,
  registerItems,
  stockOf,
  grantOnCapture,
  describeMerchandise,
};
