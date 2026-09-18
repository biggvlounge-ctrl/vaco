// server/salvage.js
//
// **Everything has value, because everything can become something.**
//
// A piece of glass is a blade. Paper is fuel, or it is a book nobody
// has written yet. A wrecked car is metal, glass, textiles and rubber
// standing in a field. That is the whole idea, and it is the difference
// between an item economy and a loot table.
//
// ---------------------------------------------------------------------
// This is new design, and the documents that specified it are LOST
// ---------------------------------------------------------------------
// `VACANCY_DOCUMENT_MANIFEST.md` lists roughly forty documents as
// missing, and **three of them are this**:
//
//   `VACANCY_UNIVERSAL_VALUE_DISCOVERY_SYSTEM.md`
//       "Parts 61-70, item/discovery economy"
//   `OCCUPATION_TAXONOMY_ORGANIZED_CRIME_HOMEMADE_CRAFTING.md`
//       "30-category occupation list" — and homemade crafting
//   `BOOKS_RECONQUEST_CHAOS_ERA_GAMEPLAY.md`
//       "books, reconquest, scarcity rules"
//
// So nothing below is recovered and all of it is invented, which is
// stated here rather than left for a reader to work out. What IS
// sourced is the vocabulary it is built on, and that is not a small
// thing: §26's twenty trade categories and §28's thirteen resource
// types are the spec's own lists, `traits.js` already carries
// `skills.Crafting` and `technology.Salvage Engineering`, and
// `items.js` carries §27's seventeen. This file connects those and adds
// no fourth vocabulary.
//
// ---------------------------------------------------------------------
// Two directions, and they are not inverses
// ---------------------------------------------------------------------
//   **breaking down** — `salvageOf` says what a thing yields when it is
//   taken apart. Everything yields something, which is the request's
//   own point: junk is only junk until somebody needs what it is made
//   of.
//
//   **making** — `RECIPES` says what can be built from what. A recipe
//   names the skill it needs and the §25 knowledge tier it sits at, so
//   the occupation taxonomy and the knowledge tiers both bear on it.
//
// They are deliberately NOT inverses. You can break a window into glass
// and you cannot reassemble the window, and a system where every
// teardown round-trips is a system with no scarcity in it — which would
// undo the one thing the setting is about.
//
// ---------------------------------------------------------------------
// Nothing here is priced
// ---------------------------------------------------------------------
// `items.js` says in its own header that §27 gives seventeen values and
// no item is invented there. Every material and every product below is
// therefore registered through `worldState.barterItems` — the extension
// point that file documents — carrying a §26 `category` and **no
// `Base_Value`**. `trade.sellableOf` skips an unpriced holding, so
// salvage does not become a money printer, and `knowledge.js` already
// set that precedent for books.
//
// What a thing is WORTH here is what it can become, which is
// `worthOf` — a count of reachable products, not a currency.

'use strict';

const items = require('./items.js');
const occupations = require('./occupations.js');

// ---------------------------------------------------------------------
// MATERIALS — what things are made of
// ---------------------------------------------------------------------
//: Each one names the §26 trade category it belongs to, so a material
//: is an ordinary item and `barter`, `inventory` and `control.materielOf`
//: all see it without a special case. `glass` and `paper` are the two
//: the request named; the rest are what a collapsed city is full of.
//:
//: **`category` is the constraint that keeps this honest.** Every value
//: below is one of §26's twenty, checked by the test — so this list can
//: grow without growing a vocabulary.
const MATERIALS = {
  glass: { category: 'materials' },
  paper: { category: 'materials' },
  timber: { category: 'materials' },
  scrap_metal: { category: 'metals' },
  wire: { category: 'metals' },
  cloth: { category: 'textiles' },
  rubber: { category: 'materials' },
  stone: { category: 'materials' },
  plastic: { category: 'materials' },
  // Not a material anybody makes anything from — it is what is left
  // when a thing yields nothing useful, and it exists so that
  // `salvageOf` never has to return an empty hand. Junk is the honest
  // answer for a ruined thing, and it is still a §26 category.
  junk: { category: 'materials' },
};

const MATERIAL_NAMES = Object.keys(MATERIALS);

// ---------------------------------------------------------------------
// PRODUCTS — what can be made
// ---------------------------------------------------------------------
//: The request's own list — "from a piece of glass for weapon to paper,
//: furniture, tools" — plus what those imply. Each carries the §26
//: category it trades as.
const PRODUCTS = {
  blade: { category: 'protection' },
  club: { category: 'protection' },
  shield: { category: 'protection' },
  hand_tool: { category: 'tools' },
  furniture: { category: 'materials' },
  container: { category: 'tools' },
  bandage: { category: 'medicine' },
  // §26 has `knowledge` as a category and `knowledge.js` already builds
  // its items there. Blank paper bound into something somebody can
  // write in is the one product that crosses into that system.
  notebook: { category: 'knowledge' },
};

const PRODUCT_NAMES = Object.keys(PRODUCTS);

// ---------------------------------------------------------------------
// RECIPES — what becomes what
// ---------------------------------------------------------------------
//: `from` is a LIST OF ALTERNATIVES — "any one of these sets of
//: materials" — not a single fixed bill. That is the difference between
//: scavenging and a production line, and it is not a convenience: the
//: first version of this file had one set per recipe, and the guard at
//: the bottom of the file said every recipe was makeable while `blade`
//: required glass that no item in the world yields. A blade is a sharp
//: edge and a handle; whether the edge is glass, flaked stone or a strip
//: of car panel is exactly the improvisation the setting is about.
//:
//: `skill` is one of `traits.js`'s sixteen `skills`, and `canMake` READS
//: it — see `SKILL_PER_TIER`. `tier` is the §25 knowledge tier, the same
//: ladder `occupations.KNOWLEDGE_TIERS` carries, so a blade is Tier 1
//: improvisation and a shield is a trade.
//:
//: **Quantities are small and deliberately so.** This is scavenging, not
//: manufacture: a recipe that asked for fifty of something would be a
//: production chain, and production is `economy.js`'s job.
const RECIPES = {
  blade: {
    from: [{ glass: 1, cloth: 1 }, { stone: 2, cloth: 1 }, { scrap_metal: 1, cloth: 1 }],
    skill: 'Crafting',
    tier: 1,
    note: "the request's own example: a piece of glass and something to hold it by",
  },
  club: {
    from: [{ timber: 2 }, { scrap_metal: 1, junk: 2 }],
    skill: 'Crafting',
    tier: 1,
  },
  shield: {
    from: [{ timber: 2, scrap_metal: 1 }, { scrap_metal: 3 }],
    skill: 'Construction',
    tier: 2,
  },
  hand_tool: {
    from: [{ scrap_metal: 2, timber: 1 }, { scrap_metal: 2, rubber: 1 }, { scrap_metal: 2, wire: 1 }],
    skill: 'Crafting',
    tier: 2,
  },
  furniture: {
    from: [{ timber: 4, cloth: 2 }, { timber: 3, plastic: 2 }],
    skill: 'Construction',
    tier: 2,
  },
  container: {
    from: [{ plastic: 2 }, { scrap_metal: 2 }, { junk: 3 }],
    skill: 'Crafting',
    tier: 1,
  },
  bandage: {
    from: [{ cloth: 2 }, { paper: 3 }],
    skill: 'Medicine',
    tier: 1,
  },
  notebook: {
    from: [{ paper: 3, cloth: 1 }, { paper: 4 }],
    skill: 'Crafting',
    tier: 2,
  },
};

//: **How good you have to be, per tier of the recipe.** One constant
//: rather than a floor per recipe, because a second number per recipe
//: would be twenty-four guesses instead of one and nothing known would
//: justify the differences between them.
//:
//: Measured on a generated world (150 people, 50 ticks), `skills` runs
//: min 10 / p25 33 / p50 55 / p90 87. So a Tier 1 floor of 20 turns
//: away roughly the bottom tenth — the people who genuinely cannot
//: improvise — and a Tier 2 floor of 40 turns away about a third. That
//: is the "don't make it easy" the request asked for, applied where it
//: belongs: the §25 tier gate alone excludes NOBODY from these recipes,
//: because Tiers 1 and 2 need no schooling by design, so without this
//: the declared `skill` would have been a field nothing read.
const SKILL_PER_TIER = 20;

function skillFloorFor(recipe) {
  return recipe.tier * SKILL_PER_TIER;
}

// ---------------------------------------------------------------------
// TEARDOWNS — what a thing yields
// ---------------------------------------------------------------------
//: Keyed on §26 category rather than on item name, so **every item in
//: the world yields something without this file having to know the
//: catalogue**. That is what makes "everything has value" true rather
//: than aspirational: add an item tomorrow and it is already
//: salvageable.
//:
//: An item's own name can override the category — `ITEM_TEARDOWNS`
//: below — for the handful where the category is misleading.
//: Four of these were changed after the guard below was fixed and
//: started telling the truth: it reported `rubber` and `plastic` as
//: materials **nothing in a generated world yields**, so a `container`
//: could only ever be made the junk way and a rubber-gripped `hand_tool`
//: was a recipe alternative nobody could reach. `transport` was the only
//: source of rubber and no item in any world is a transport item. The
//: answers are all ordinary: tools have rubber grips, repair goods are
//: wire and fixings, medicine comes in plastic, and a unit of water
//: taken apart is the container it came in.
const CATEGORY_TEARDOWNS = {
  tools: { scrap_metal: 2, timber: 1, rubber: 1 },
  protection: { scrap_metal: 2, cloth: 1 },
  metals: { scrap_metal: 3 },
  gems: { junk: 1 },
  materials: { stone: 2 },
  textiles: { cloth: 3 },
  clothing: { cloth: 2 },
  'luxury goods': { timber: 2, wire: 1 },
  food: { junk: 1 },
  water: { plastic: 1 },
  medicine: { cloth: 1, plastic: 1 },
  knowledge: { paper: 2 },
  livestock: { junk: 1 },
  fish: { junk: 1 },
  crops: { junk: 1 },
  spices: { junk: 1 },
  services: { junk: 1 },
  labor: { junk: 1 },
  transport: { scrap_metal: 4, rubber: 2, glass: 2 },
  repair: { scrap_metal: 1, wire: 1 },
};

//: The exceptions, where a category would give the wrong answer.
//: `Sand` and `Gravel` are §27's two `materials` and they are not
//: things you break down — they are already the bottom.
const ITEM_TEARDOWNS = {
  Sand: { junk: 1 },
  Gravel: { stone: 1 },
};

// ---------------------------------------------------------------------
// BUILDING_TEARDOWNS — a building is a pile of materials standing up
// ---------------------------------------------------------------------
//: Per `properties.type`, in materials per unit of floor area. The
//: request's own framing — a monument's past does not fix its future,
//: and one of the futures is "taken apart for what it is made of".
//:
//: **Scaled by condition**, because a ruin yields less than a standing
//: building: half a roof is half the timber. That is one multiplication
//: and it is the honest one.
//: **Cloth, paper and plastic are here because the guard below said they
//: had to be.** With buildings yielding only structure — timber, glass,
//: stone, metal — a measured world could make no `blade`, no `bandage`,
//: no `notebook` and no `furniture`, four of eight products at zero of
//: 150 people, including the request's own headline example. The reason
//: was not balance: no item in a generated world carries the §26
//: `textiles`, `clothing`, `medicine` or `water` category, so the
//: categories that yield those three materials described a supply that
//: did not exist anywhere.
//:
//: The answers are all just what is inside the building. A house has
//: curtains, carpets and pipework in it as surely as it has windows; a
//: government office is full of paper; a factory runs on belts and
//: hoses. None of this is a new mechanic — it is the teardown table
//: finally listing what a building is actually made of.
const BUILDING_TEARDOWNS = {
  residential: { timber: 3, glass: 1, stone: 2, cloth: 2, plastic: 1 },
  commercial: { glass: 3, scrap_metal: 2, stone: 2, plastic: 2 },
  industrial: { scrap_metal: 5, wire: 2, stone: 2, rubber: 2 },
  government: { stone: 4, timber: 2, glass: 2, paper: 3 },
  historical_site: { stone: 5, timber: 1 },
  agricultural: { timber: 2, stone: 1, cloth: 1 },
  farm: { timber: 2, stone: 1, cloth: 1 },
  mixed: { timber: 2, glass: 2, stone: 2, cloth: 1 },
  digital_property: { junk: 1 },
  virtual_location: { junk: 1 },
};

//: How much floor area one unit of a teardown yield corresponds to.
//: A round number, and the one frankly arbitrary figure in this file —
//: it sets how many materials a building comes to and nothing else
//: depends on it. `describeSalvage` reports the totals so a world where
//: one house yields a thousand timbers is visible rather than assumed.
const AREA_PER_YIELD = 500;

// ---------------------------------------------------------------------
// Registering materials and products as items
// ---------------------------------------------------------------------
// Through `worldState.barterItems`, which `items.js` documents as the
// extension point, and with NO `Base_Value` — see the header.
// Idempotent by name (standing rule 15).
function itemDefinitions() {
  const out = [];
  for (const [name, definition] of Object.entries(MATERIALS)) {
    out.push({ name, category: definition.category, material: true });
  }
  for (const [name, definition] of Object.entries(PRODUCTS)) {
    out.push({ name, category: definition.category, product: true });
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
// salvageOf — what this yields when taken apart
// ---------------------------------------------------------------------
// **Everything yields something.** An item whose category this file has
// never heard of still comes back as junk rather than as nothing,
// because "nothing" would make the claim false the first time somebody
// added a category.
//
// Returns a map of material name to quantity, scaled by how many of the
// thing there are and what condition it is in. Null only for an item
// the world does not define at all, which is a caller error rather than
// a worthless object.
function salvageOf(worldState, itemName, options = {}) {
  const { quantity = 1, condition = 100 } = options;
  const item = items.findItem(worldState, itemName);
  if (!item) return null;

  // A material taken apart is still itself. Breaking scrap metal into
  // scrap metal is where a teardown loop would come from, so it stops.
  if (MATERIALS[itemName]) return { [itemName]: Math.max(1, Math.round(quantity)) };

  const base = ITEM_TEARDOWNS[itemName]
    ?? CATEGORY_TEARDOWNS[item.category]
    ?? { junk: 1 };

  // **Condition scales the yield and never to zero.** A ruined thing is
  // still made of something — that is the request's point about junk —
  // so the floor is one of whatever it was going to give.
  const wear = Math.max(0, Math.min(100, Number(condition))) / 100;
  const out = {};
  for (const [material, amount] of Object.entries(base)) {
    out[material] = Math.max(1, Math.round(amount * quantity * wear));
  }
  return out;
}

// What ONE TRIP to a building yields — not what the whole building
// contains. Scaled by floor area and condition, which are the two
// columns `control.footprintOf` already reads for the maintain key, so
// it is the same building measured the same way.
//
// **No floor of one here, unlike `salvageOf`.** A broken item is still
// made of something, so an item's yield never rounds to nothing. A
// building is different, because `stripProperty` can come back
// tomorrow: a floor of one on a repeated draw is an infinite supply of
// materials out of a ruin, which is standing rule 13's ratchet pointing
// the other way. A building stripped to nothing yields nothing, and
// that is what makes the total finite.
function salvageOfProperty(worldState, propertyId) {
  const row = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!row) return null;
  const base = BUILDING_TEARDOWNS[row.type] ?? { junk: 1 };
  const area = Math.max(1, Number(row.land_size) || 1)
    * Math.max(1, Number(row.floors) || 1);
  const scale = area / AREA_PER_YIELD;
  const wear = Math.max(0, Math.min(100, Number(row.condition ?? 100))) / 100;

  const out = {};
  for (const [material, amount] of Object.entries(base)) {
    const yielded = Math.round(amount * scale * wear);
    if (yielded > 0) out[material] = yielded;
  }
  return out;
}

//: What one trip costs the building, in condition points. `property.js`
//: decays a building by 0.4 a tick, so a strip is twenty-five days of
//: neglect taken in an afternoon — which is roughly what pulling the
//: windows and floorboards out of a place does to it.
const STRIP_CONDITION_COST = 10;

// ---------------------------------------------------------------------
// stripProperty — where glass, timber and stone actually come from
// ---------------------------------------------------------------------
// **This is the function the measurement demanded.** With only
// `salvageOf` wired, the materials a person could reach were whatever
// their pocket kit broke down into: metal, stone and junk. Measured on a
// generated world, `blade` — the request's own headline example, a piece
// of glass made into a weapon — could be made by NOBODY, because no item
// in any world yields glass and glass is in windows. `furniture`,
// `bandage` and `notebook` were the same, all four at zero of 150.
//
// Two gates, and both are about the setting rather than about balance:
//
//   **an inhabited building is not salvage.** A place with occupants or
//   an organization operating out of it is somebody's home or somebody's
//   work, and stripping it would be theft or demolition — both real
//   things, and both `crime.js`'s business rather than this file's.
//
//   **a building stripped to nothing has nothing left.** The condition
//   floor is what makes the supply finite.
function stripProperty(worldState, entityId, propertyId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const row = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!row) throw new Error(`no property ${propertyId}`);

  const occupants = Array.isArray(row.occupants) ? row.occupants.length : 0;
  if (occupants > 0) {
    throw new Error(`property ${propertyId} has ${occupants} occupant(s) — that is a home, not salvage`);
  }
  if (row.operating_organization_id !== null && row.operating_organization_id !== undefined) {
    throw new Error(`property ${propertyId} is in use by organization ${row.operating_organization_id}`);
  }
  if (Number(row.condition ?? 0) <= 0) {
    throw new Error(`property ${propertyId} has been stripped to nothing already`);
  }

  const yielded = salvageOfProperty(worldState, propertyId);
  registerItems(worldState);
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  for (const [material, amount] of Object.entries(yielded)) {
    inventory.give(worldState, { entityId, itemName: material, quantity: amount, tick });
  }
  row.condition = Math.max(0, Number(row.condition ?? 100) - STRIP_CONDITION_COST);
  return { propertyId, yielded, condition: row.condition };
}

// ---------------------------------------------------------------------
// Making things
// ---------------------------------------------------------------------

function recipeFor(product) {
  return RECIPES[product] ?? null;
}

// The skill somebody actually has right now, read through
// `getLiveEntity` rather than off the birth sheet — standing rule 9,
// which exists because `npc.traits` is built once at generation and
// never refreshed, so reading it would return a plausible frozen number
// forever. A person whose skill cannot be read at all is treated as
// unskilled rather than as competent: unknown is not a pass.
function skillOf(worldState, entityId, skill) {
  // eslint-disable-next-line global-require
  const entityTraits = require('./entityTraits.js');
  const live = entityTraits.getLiveEntity(worldState, entityId);
  const value = live?.traits?.skills?.[skill];
  return Number.isFinite(value) ? value : null;
}

// Everything this person could make right now, from what they carry.
// THREE gates, and a recipe has to pass all of them:
//
//   §25 tier    — `occupations.tierReachable`, the same ladder the
//                 occupation taxonomy uses rather than a second opinion
//                 about who knows what.
//   skill       — `skillFloorFor`, read live. This is the gate that
//                 actually bites, because Tiers 1-2 need no schooling.
//   materials   — ANY ONE of the recipe's alternative sets.
//
// On success it reports WHICH alternative it would use, so `make`
// consumes exactly what `canMake` checked and the two cannot drift.
function canMake(worldState, entityId, product) {
  const recipe = recipeFor(product);
  if (!recipe) return { ok: false, reason: `"${product}" is not something anybody knows how to make` };

  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) return { ok: false, reason: `no entity ${entityId}` };
  if (!occupations.tierReachable(npc, recipe.tier)) {
    return { ok: false, reason: `making a ${product} is Tier ${recipe.tier} work`, tier: recipe.tier };
  }

  const floor = skillFloorFor(recipe);
  const have = skillOf(worldState, entityId, recipe.skill);
  if (have === null || have < floor) {
    return {
      ok: false,
      reason: `making a ${product} takes ${recipe.skill} ${floor}`,
      skill: recipe.skill,
      need: floor,
      have,
    };
  }

  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  // The first alternative they can actually satisfy wins. `shortfalls`
  // carries what each one was missing, so a refusal says what to go and
  // find rather than only that the answer was no.
  const shortfalls = [];
  for (const ingredients of recipe.from) {
    const missing = [];
    for (const [material, needed] of Object.entries(ingredients)) {
      const held = inventory.quantityOf(worldState, entityId, material);
      if (held < needed) missing.push({ material, need: needed, have: held });
    }
    if (missing.length === 0) return { ok: true, recipe, using: ingredients };
    shortfalls.push(missing);
  }
  return { ok: false, reason: 'not enough to work with', shortfalls };
}

// Make one. Consumes the materials and hands over the product — through
// `inventory.take` and `inventory.give`, so the holding rows are the
// same shape as every other holding and nothing here writes inventory
// by hand.
function make(worldState, entityId, product, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const check = canMake(worldState, entityId, product);
  if (!check.ok) throw new Error(`cannot make a ${product}: ${check.reason}`);

  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  registerItems(worldState);

  // `check.using` — the alternative `canMake` verified, not a fresh
  // pick. Re-choosing here is how a check and its effect drift apart.
  for (const [material, needed] of Object.entries(check.using)) {
    inventory.take(worldState, { entityId, itemName: material, quantity: needed, tick });
  }
  const made = inventory.give(worldState, {
    entityId, itemName: product, quantity: 1, tick,
  });
  return { product, made, consumed: check.using };
}

// Take something apart. The inverse verb, and not the inverse function
// — see the header.
// **Take first, then value what was actually taken.** The first version
// read `findHolding`'s condition and yielded against that — but
// `inventory.take` deliberately takes the WORST condition first and will
// draw across several holdings, so somebody holding a ruined hammer and
// a good one got the good one's yield for the ruined one's hammer. The
// same shape as the resources ledger in standing rule 13: value what was
// taken, not what was asked for.
function breakDown(worldState, entityId, itemName, options = {}) {
  const { quantity = 1, tick = worldState.tick ?? 0 } = options;
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  const held = inventory.quantityOf(worldState, entityId, itemName);
  if (held < quantity) {
    throw new Error(`entity ${entityId} has ${held} ${itemName}, not ${quantity}`);
  }
  if (!salvageOf(worldState, itemName, { quantity })) {
    throw new Error(`"${itemName}" is not a known item`);
  }

  registerItems(worldState);
  const removed = inventory.take(worldState, { entityId, itemName, quantity, tick });

  const yielded = {};
  for (const parcel of removed.taken) {
    const part = salvageOf(worldState, itemName, {
      quantity: parcel.quantity, condition: parcel.condition,
    });
    for (const [material, amount] of Object.entries(part)) {
      yielded[material] = (yielded[material] ?? 0) + amount;
    }
  }
  for (const [material, amount] of Object.entries(yielded)) {
    inventory.give(worldState, { entityId, itemName: material, quantity: amount, tick });
  }
  return { from: itemName, quantity: removed.quantity, yielded };
}

// ---------------------------------------------------------------------
// worthOf — what a thing is worth is what it can become
// ---------------------------------------------------------------------
// **Not a price.** Nothing in this file is priced, deliberately. This
// counts how many DISTINCT products a thing's salvage contributes a
// material to — so a wrecked car is worth more than a handful of sand
// because more can be made from it, and that is a statement about
// usefulness rather than about money.
//
// It is the request's own sentence turned into a number: everything has
// value because it can be used to create something, so the value IS the
// something.
function worthOf(worldState, itemName, options = {}) {
  const yielded = salvageOf(worldState, itemName, options);
  if (yielded === null) return null;
  const reachable = new Set();
  for (const product of PRODUCT_NAMES) {
    const contributes = RECIPES[product].from.some(
      (ingredients) => Object.keys(ingredients).some((material) => yielded[material] > 0),
    );
    if (contributes) reachable.add(product);
  }
  return {
    itemName,
    yields: yielded,
    contributesTo: [...reachable].sort(),
    worth: reachable.size,
  };
}

// ---------------------------------------------------------------------
// runSalvage — the pass that makes any of this happen to anybody
// ---------------------------------------------------------------------
// **Without this the whole file is standing rule 11.** Three player
// verbs, a measured guard and a full crafting chain, and a generated
// world measured `materials_held` at 0.0 and `things_made` at 0 in every
// community, because a player is one person and nobody else in the world
// had any way to pick anything up. A generator nothing calls is
// indistinguishable from one that does not exist.
//
// Who salvages, and why it is these people: **somebody with no job**.
// Not the poorest, not a trait threshold — `employment_records` already
// says who has nothing else to do with a day, and scavenging is the
// thing people do when there is no work. It needs no new field and no
// new number to decide who.
//
// What they do is one trip: strip an empty building in their own
// community, then make one thing if what they now carry allows it. The
// supply is finite by construction — `stripProperty` takes 10 condition
// and refuses at zero — so this cannot become a ratchet that feeds
// itself, which is the first thing to check about any pass that creates
// material out of the world.
const SALVAGE_CHANCE = 0.02;
const SALVAGE_AGE = 16;

function runSalvage(worldState, tick = worldState.tick ?? 0) {
  // eslint-disable-next-line global-require
  const mortality = require('./mortality.js');
  // eslint-disable-next-line global-require
  const seeded = require('./seeded.js');
  registerItems(worldState);

  const employed = new Set(
    (worldState.employmentRecords || [])
      .filter((r) => r.status === 'active')
      .map((r) => r.entity_id),
  );

  // Strippable buildings, grouped by community, worked out ONCE rather
  // than per person — the same quadratic that `control.noteRecruitment`
  // had to be rewritten to avoid.
  const open = new Map();
  for (const p of worldState.properties || []) {
    if (Array.isArray(p.occupants) && p.occupants.length > 0) continue;
    if (p.operating_organization_id !== null && p.operating_organization_id !== undefined) continue;
    if (Number(p.condition ?? 0) <= 0) continue;
    if (!open.has(p.community_id)) open.set(p.community_id, []);
    open.get(p.community_id).push(p);
  }

  const events = [];
  const people = (worldState.npcs || []).filter((n) => n.status === 'active');
  people.forEach((npc, index) => {
    const age = mortality.ageInYears(worldState, npc, tick);
    if (age === null || age < SALVAGE_AGE) return;
    // Seeded on position and tick, never on identity (§88).
    if (seeded.seededDraw(['salvage', tick, index]) > SALVAGE_CHANCE) return;

    // **`npc.communityId`, camelCase, and it matters.** `properties` is
    // a database row with `community_id`; an NPC is an engine object
    // with `communityId`, and `areaStats.residentsOf` is the authority
    // on that. The first version of this line read `npc.community_id`,
    // which is `undefined` on every person in every world — so the
    // lookup missed every time and this entire pass would have run on
    // schedule and done nothing, forever. Standing rule 6.
    // **Make first, strip second, and the order is the whole point.**
    //
    // The first version did both in one go — strip a building, then make
    // something out of what that one trip yielded — and measured over
    // 400 ticks it produced **8 products against 284 materials sitting
    // in people's hands doing nothing**. The reason was structural
    // rather than a rate: making was welded to stripping, so once every
    // strippable building in an area was down to nothing, nobody in that
    // area ever made anything again no matter what they were carrying.
    // A person holding four timbers and a bolt of cloth stood in a
    // finished street for two hundred ticks.
    //
    // Separated, a trip is one or the other: use what you have, or go
    // and find more. The supply stays finite — `stripProperty` is still
    // the only source and it still refuses at zero — but what has
    // already been salvaged keeps being worth something after the
    // salvaging stops, which is the difference between an economy and a
    // clearance sale.
    //
    // `PRODUCT_NAMES` is a stable order, so the choice is deterministic,
    // and somebody with the materials for several makes the simplest —
    // which is what a person scavenging would do.
    for (const product of PRODUCT_NAMES) {
      if (!canMake(worldState, npc.id, product).ok) continue;
      make(worldState, npc.id, product, { tick });
      // **One event, and it is here rather than on the strip.** Somebody
      // pulling boards off an empty house is a Tuesday; somebody turning
      // them into a blade is a thing that happened. An event per strip
      // would put thousands of identical rows in the log and bury the
      // tick a weapon appeared — standing rule 7's shape.
      //
      // **The fields are `note` / `affected_entity_ids` / `global_effects`
      // and no others.** `runEventPhase` builds the stored row from
      // exactly six named fields and drops everything else on the floor,
      // silently — the first version pushed `entityId` and a `detail`
      // object, both of which vanished, so 16 rows reached the log
      // saying `thing_made` and nothing about what or by whom. Standing
      // rule 18 one level over: the event was not dropped, its contents
      // were.
      events.push({
        type: 'thing_made',
        severity: 'low',
        note: `entity ${npc.id} made a ${product.replace(/_/g, ' ')} out of salvage`,
        tick,
        affected_entity_ids: [npc.id],
        global_effects: { product },
      });
      return;
    }

    // **Stripping is the unemployed person's activity; making is not.**
    // Scavenging an empty building is what somebody does with a day they
    // have nothing else to do with, and `employment_records` already
    // says who that is without a new field or a new number. Sitting down
    // in the evening and turning what you have into something is not a
    // job and never was — gating it on unemployment too is what left a
    // measured world with one EMPLOYED man holding 174 stone and 35
    // timber he had salvaged before he was hired and could now never
    // use, while `things_made` across three whole communities was zero.
    if (employed.has(npc.id)) return;

    const nearby = open.get(npc.communityId);
    if (!nearby || nearby.length === 0) return;
    const pick = nearby[Math.floor(seeded.seededDraw(['salvage-site', tick, index]) * nearby.length)];
    if (!pick || Number(pick.condition ?? 0) <= 0) return;
    stripProperty(worldState, npc.id, pick.id, { tick });
  });
  return events;
}

// ---------------------------------------------------------------------
// describeSalvage
// ---------------------------------------------------------------------
// The measurement, and the guard on the claim.
//
// **The first version of this function was rigged and reported a clean
// bill of health.** It counted a material as reachable if anything in
// the catalogue yielded it — and materials are themselves in the
// catalogue, where `salvageOf` returns them unchanged, so every material
// vouched for itself and `unreachableMaterials` was structurally always
// empty. Standing rule 14 in miniature: the only writer of the check sat
// behind the check. Under it, glass came from nothing in the world and
// `blade` — the request's own headline example — was unmakeable while
// this function said otherwise.
//
// So reachability is counted from **items that are not themselves
// materials, plus buildings**, which is where glass and most timber
// actually come from. And three separate claims are reported rather than
// one, because they fail independently:
//
//   worthless             an item that can become NOTHING. This is the
//                         real test of "everything has value" — yielding
//                         junk that no recipe accepts is not value.
//   unreachableMaterials  a material nothing in the world yields.
//   unusedMaterials       a material no recipe consumes. The mirror, and
//                         just as dead.
//   unmakeableProducts    a product NONE of whose alternatives can be
//                         sourced.
function describeSalvage(worldState) {
  const catalogue = items.itemsFor(worldState);
  const worthless = [];
  const yieldsByMaterial = {};

  function credit(yielded) {
    for (const material of Object.keys(yielded ?? {})) {
      yieldsByMaterial[material] = (yieldsByMaterial[material] ?? 0) + 1;
    }
  }

  for (const item of catalogue) {
    // **Neither a material nor a product is evidence of supply.** A
    // material IS the thing being asked about, and a product only exists
    // once somebody has already made one — so a `blade` yielding cloth
    // would be vouching for the cloth a blade is made from. Both had to
    // be excluded, in that order, and each time the guard got quieter
    // the real gap underneath it got louder: with materials excluded it
    // found rubber and plastic, and with products excluded as well it
    // found that cloth, paper and plastic reach a generated world
    // through nothing at all.
    //
    // They are still measured for `worthless`, because "can a blade be
    // broken back down into something" is a fair question about a blade.
    const value = worthOf(worldState, item.name);
    if (!value || value.worth === 0) worthless.push(item.name);
    if (MATERIALS[item.name] || PRODUCTS[item.name]) continue;
    credit(value?.yields);
  }

  // Buildings are the other half of the supply, and leaving them out is
  // what hid the glass.
  const buildingTypes = new Set((worldState.properties || []).map((p) => p.type));
  for (const type of buildingTypes) credit(BUILDING_TEARDOWNS[type]);

  const unreachable = MATERIAL_NAMES.filter((m) => !yieldsByMaterial[m]);
  const consumed = new Set();
  for (const product of PRODUCT_NAMES) {
    for (const ingredients of RECIPES[product].from) {
      for (const material of Object.keys(ingredients)) consumed.add(material);
    }
  }
  const unused = MATERIAL_NAMES.filter((m) => !consumed.has(m));

  // A product is unmakeable only if EVERY alternative is out of reach —
  // that is what having alternatives is for.
  const unmakeable = PRODUCT_NAMES.filter(
    (product) => RECIPES[product].from.every(
      (ingredients) => Object.keys(ingredients).some((m) => !yieldsByMaterial[m]),
    ),
  );

  return {
    items: catalogue.length,
    materials: MATERIAL_NAMES.length,
    products: PRODUCT_NAMES.length,
    recipes: Object.keys(RECIPES).length,
    worthless,
    unreachableMaterials: unreachable,
    unusedMaterials: unused,
    unmakeableProducts: unmakeable,
    yieldsByMaterial,
  };
}

module.exports = {
  MATERIALS,
  MATERIAL_NAMES,
  PRODUCTS,
  PRODUCT_NAMES,
  RECIPES,
  CATEGORY_TEARDOWNS,
  ITEM_TEARDOWNS,
  BUILDING_TEARDOWNS,
  AREA_PER_YIELD,
  STRIP_CONDITION_COST,
  stripProperty,
  SKILL_PER_TIER,
  skillFloorFor,
  skillOf,
  itemDefinitions,
  registerItems,
  salvageOf,
  salvageOfProperty,
  recipeFor,
  canMake,
  make,
  breakDown,
  worthOf,
  SALVAGE_CHANCE,
  SALVAGE_AGE,
  runSalvage,
  describeSalvage,
};
