// server/items.js
//
// The item catalogue — §26's trade categories, §28's resource types,
// and §27's barter key and its seventeen sourced values.
//
// **This is data, and it lives alone because two modules need it.**
// `server/barter.js` prices an item and `server/inventory.js` holds
// one, and when the catalogue lived inside barter the two required
// each other — a cycle Node resolves by handing one of them a
// half-built module, which surfaced as `barter.findItem is not a
// function` in every inventory test at once.
//
// The catalogue was always the shared thing rather than a barter
// concern, so splitting it out is the shape the dependency actually
// has. `barter.js` re-exports these names, so nothing that already
// reads `barter.RESOURCE_TYPES` had to change.
//
// ---------------------------------------------------------------------
// The line this file must not blur
//
// The consolidated spec's own intake note:
//
//   "17 example item values are given against an intended catalogue of
//   roughly 3,750 items. The 17 are real; the 3,750 are a target.
//   Anyone implementing from this must not generate those enumerations
//   and then cite them as recovered source."
//
// So `SOURCED_ITEMS` is exactly the seventeen, verbatim, and nothing
// else. **No item is invented here.** A world that wants more supplies
// them through `worldState.barterItems`, which follows the precedent
// `flows.js` set for its ten named templates: definitions live as
// data, a world can override or extend them with no code change, and
// what the package specified stays distinguishable from what somebody
// added later.

'use strict';

// §26, verbatim and in its order.
const TRADE_CATEGORIES = [
  'food', 'water', 'medicine', 'clothing', 'tools', 'materials',
  'livestock', 'fish', 'crops', 'metals', 'gems', 'spices',
  'textiles', 'luxury goods', 'knowledge', 'services', 'labor',
  'transport', 'repair', 'protection',
];

// §28, verbatim and in its order. **This is the canonical list the
// engine did not have.** `resources.resource_type` stays open TEXT —
// the schema is the source of truth for shape and this file does not
// change it — but anything generating a resource can now check against
// the spec's own enumeration instead of inventing a third list.
const RESOURCE_TYPES = [
  'food', 'water', 'medicine', 'fuel', 'wood', 'stone', 'metals',
  'minerals', 'energy', 'tools', 'clothing', 'knowledge', 'technology',
];

// §27's seven fields, in its order. Held as data so the test can
// assert every item carries them rather than trusting a comment.
const BARTER_KEY_FIELDS = [
  'Item_Name', 'Section_Category', 'Base_Value', 'Rarity',
  'Environment_Modifier', 'Population_Modifier', 'Final_Barter_Score',
];

//: **The seventeen values §27 actually gives, and nothing else.**
//: `Base_Value` is quoted verbatim. `Section_Category` is assigned
//: from §26's own twenty categories — that assignment is the one
//: interpretive act in this table, because the spec gives values
//: without categories, and it is flagged rather than presented as
//: sourced. `Rarity` is NOT in the spec for these items and is left
//: null rather than invented; `barterScore` treats a null rarity as 1.
const SOURCED_ITEMS = [
  { name: 'Gold Ingot', category: 'metals', baseValue: 100 },
  { name: 'Silver Ingot', category: 'metals', baseValue: 50 },
  { name: 'Platinum Ingot', category: 'metals', baseValue: 120 },
  { name: 'Copper Ingot', category: 'metals', baseValue: 20 },
  { name: 'Palladium', category: 'metals', baseValue: 110 },
  { name: 'Diamond', category: 'gems', baseValue: 200 },
  { name: 'Sapphire', category: 'gems', baseValue: 150 },
  { name: 'Ruby', category: 'gems', baseValue: 150 },
  { name: 'Emerald', category: 'gems', baseValue: 150 },
  { name: 'Amethyst', category: 'gems', baseValue: 60 },
  { name: 'Sand', category: 'materials', baseValue: 5 },
  { name: 'Gravel', category: 'materials', baseValue: 7 },
  { name: 'Hammer', category: 'tools', baseValue: 8 },
  { name: 'Saw', category: 'tools', baseValue: 10 },
  { name: 'Gold Bar', category: 'metals', baseValue: 1800 },
  { name: 'Silver Coin', category: 'metals', baseValue: 25 },
  { name: 'Rare Musical Instrument', category: 'luxury goods', baseValue: 2000 },
];

// -- the catalogue ------------------------------------------------------

// The items a world trades: the seventeen sourced ones, plus anything
// the world itself defines. Same shape as `flows.js`'s template
// resolution — a world's own entries win on name.
function itemsFor(worldState) {
  const custom = Array.isArray(worldState?.barterItems) ? worldState.barterItems : [];
  const byName = new Map(SOURCED_ITEMS.map((i) => [i.name, { ...i, sourced: true }]));
  for (const item of custom) {
    if (!item || !item.name) continue;
    byName.set(item.name, { ...item, sourced: false });
  }
  return [...byName.values()];
}

function findItem(worldState, name) {
  return itemsFor(worldState).find((i) => i.name === name) || null;
}


module.exports = {
  TRADE_CATEGORIES,
  RESOURCE_TYPES,
  BARTER_KEY_FIELDS,
  SOURCED_ITEMS,
  itemsFor,
  findItem,
};
