// server/barter.js
//
// The barter economy — §26, §27 and §28, as data.
//
// **What was actually there before this, measured.** The spec is
// unusually specific about this system, and almost none of it was
// represented:
//
//   §26 names **twenty trade categories** — food, water, medicine,
//   clothing, tools, materials, livestock, fish, crops, metals, gems,
//   spices, textiles, luxury goods, knowledge, services, labor,
//   transport, repair, protection. None existed anywhere.
//
//   §27 says every barter item carries **seven fields** — Item_Name,
//   Section_Category, Base_Value, Rarity, Environment_Modifier,
//   Population_Modifier, Final_Barter_Score — and gives seventeen real
//   example values. None existed anywhere.
//
//   §28 names **thirteen resource types**. `resources.resource_type`
//   is open TEXT whose schema comment lists a DIFFERENT set
//   (`food|water|energy|oil|gold|minerals|timber|agricultural_land|
//   rare_materials|...`), and there was no canonical list in code at
//   all. Two ad-hoc lists existed instead: `mortality.SURVIVAL_RESOURCES`
//   (three) and a literal inside `worldgen` (five). Neither matches
//   §28 and neither matched the other.
//
//   And **nothing ever transacted.** `market_listings` resolved a
//   price every tick and no goods, money or value ever changed hands
//   between two entities — `statistics.js` carried a comment claiming
//   "every transaction in the engine goes through market_listings or
//   payroll", and the market half of that was simply false. Payroll
//   was the only movement of value in the simulation.
//
//   `Barter Skill` — a real economic trait on all 114 — was read by
//   nothing, which follows: there was nothing to barter.
//
// ---------------------------------------------------------------------
// What is sourced and what is not — the line this file must not blur
//
// The consolidated spec's own intake note says it plainly, and it is
// the reason this file is shaped the way it is:
//
//   "17 example item values are given against an intended catalogue of
//   roughly 3,750 items. The 17 are real; the 3,750 are a target.
//   Anyone implementing from this must not generate those enumerations
//   and then cite them as recovered source."
//
// So `SOURCED_ITEMS` is exactly the seventeen, verbatim, and nothing
// else. **No item is invented here.** A world that wants more supplies
// them through `worldState.barterItems`, which follows the precedent
// `flows.js` set for its ten named templates: definitions live as data,
// a world can override or extend them with no code change, and the
// difference between what the package specified and what somebody
// added later stays visible.
//
// ---------------------------------------------------------------------
// Where the modifiers come from
//
// §27 says the modifiers "respond to local scarcity, population,
// environment, climate, regional demand, production, transport
// difficulty". Of those, this engine really has scarcity, population
// and production; it has no climate, no regional demand distinct from
// local, and no transport at all (deferred). So two modifiers are
// computed from real world state and the rest are honestly absent —
// `MODIFIERS_NOT_MODELLED` names them rather than folding a plausible
// constant into the score.

'use strict';

const economy = require('./economy.js');
const { getLiveEntity } = require('./entityTraits.js');

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

// §27 lists seven influences on the modifiers. These three have no
// substrate in this engine, and saying so is better than folding a
// constant in and calling the score complete.
const MODIFIERS_NOT_MODELLED = {
  climate: '`regions.climate_key` is TEXT written by nothing — see '
    + 'dev-docs/LAND_AND_MAP_DATA.md for where real climate would come from.',
  transportDifficulty: 'Transportation is deferred in CLAUDE.md and `trade_routes` is a '
    + 'schema-only table, so distance between two markets is not represented at all.',
  regionalDemand: 'demand exists per resource per CITY; there is no region tier above it '
    + 'to hold a demand distinct from the local one.',
};

//: How far scarcity can move a price. At 0.5 a good whose input is in
//: total shortage is worth 1.5x its base, and one in glut 0.5x.
//: Flagged interpretive: §27 says modifiers "respond to local
//: scarcity" and gives no curve.
const SCARCITY_SWING = 0.5;

//: And how far population can. A thin market pays more for the same
//: thing. Deliberately weaker than scarcity — §27 lists scarcity
//: first, and a shortage is the sharper signal.
const POPULATION_SWING = 0.25;
const POPULATION_REFERENCE = 500;

//: How much a skilled barterer moves a price in their own favour.
//: `Barter Skill` is one of the 114 individual traits and was read by
//: nothing before this — which followed, since nothing could be
//: bartered. At 0.3, somebody at 100 trades about 15% better than
//: somebody at 50.
const BARTER_SKILL_SWING = 0.3;

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

// -- the modifiers ------------------------------------------------------

// Local scarcity of whatever this item is made of. An item whose
// category is not a tracked resource type has no input to be scarce —
// it returns 1, meaning "no pressure", rather than 0.
function environmentModifier(worldState, item, cityId = null) {
  const inputs = (worldState.resources || []).filter(
    (r) => r.resource_type === item.category
      && (cityId === null || r.city_id === cityId),
  );
  if (inputs.length === 0) return 1;

  // `getScarcity` is 0..100 with 50 as demand meeting supply, so the
  // signed distance from 50 is the pressure in either direction.
  const scarcity = inputs.reduce((a, r) => a + economy.getScarcity(r), 0) / inputs.length;
  return 1 + ((scarcity - 50) / 50) * SCARCITY_SWING;
}

// A thin market pays more for the same thing.
//
// **Null, not 1, for a city nobody lives in** — an unpopulated market
// is not a market with an average population, and the distinction is
// the one this project has had to make in every module so far. The
// caller decides what to do with an unknown.
function populationModifier(worldState, cityId = null) {
  if (cityId === null) return 1;
  const communities = (worldState.communities || [])
    .filter((c) => c.city_id === cityId)
    .map((c) => c.id);
  if (communities.length === 0) return null;

  const population = (worldState.npcs || [])
    .filter((n) => communities.includes(n.communityId)).length;
  if (population === 0) return null;

  // Smaller than the reference market -> dearer; larger -> cheaper.
  const ratio = POPULATION_REFERENCE / Math.max(1, population);
  return 1 + Math.max(-1, Math.min(1, Math.log10(ratio))) * POPULATION_SWING;
}

// §27's Final_Barter_Score, with every field it names.
//
// Returns the whole key rather than one number, because §27 says an
// item CONTAINS those seven fields — a caller that only gets the score
// cannot show why it is what it is, and "why is this dear here" is the
// question a barter economy exists to answer.
function barterScore(worldState, itemName, options = {}) {
  const { cityId = null } = options;
  const item = findItem(worldState, itemName);
  if (!item) throw new Error(`barterScore: no barter item "${itemName}"`);

  const base = Number(item.baseValue);
  if (!Number.isFinite(base)) throw new Error(`barterScore: "${itemName}" has no Base_Value`);

  // §27 lists Rarity as a field and gives no value for any of the
  // seventeen. Null means unknown and is treated as 1 rather than 0 —
  // an unknown rarity must not make an item worthless.
  const rarity = item.rarity ?? null;
  const rarityFactor = rarity === null ? 1 : Number(rarity);

  const environment = environmentModifier(worldState, item, cityId);
  const populationRaw = populationModifier(worldState, cityId);
  const population = populationRaw === null ? 1 : populationRaw;

  return {
    Item_Name: item.name,
    Section_Category: item.category,
    Base_Value: base,
    Rarity: rarity,
    Environment_Modifier: round(environment),
    Population_Modifier: populationRaw === null ? null : round(population),
    Final_Barter_Score: round(base * rarityFactor * environment * population),
    sourced: item.sourced === true,
  };
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// -- the transaction ----------------------------------------------------

// **The thing that did not exist: value changing hands.**
//
// Before this, the only movement of value anywhere in the simulation
// was payroll. Prices resolved on `market_listings` every tick and
// nobody ever bought anything, so `individual_finances.savings` only
// ever went up.
//
// `Barter Skill` is what makes this a barter rather than a price list:
// the two parties' skills are compared, and the better barterer moves
// the agreed price in their own favour. That trait existed on every
// NPC in every world and was read by nothing.
function agreedPrice(worldState, itemName, options = {}) {
  const { buyerId = null, sellerId = null, cityId = null, quantity = 1 } = options;
  const key = barterScore(worldState, itemName, { cityId });

  const skillOf = (id) => {
    if (id === null) return 50;
    const live = getLiveEntity(worldState, id);
    // `?? 50` rather than `|| 50`: a real 0 is somebody with no
    // haggling ability at all, and `||` would upgrade them to average.
    return Number(live?.traits?.economic?.['Barter Skill'] ?? 50);
  };

  // Positive when the seller is the better barterer.
  const edge = (skillOf(sellerId) - skillOf(buyerId)) / 100;
  const unit = key.Final_Barter_Score * (1 + edge * BARTER_SKILL_SWING);
  return {
    ...key,
    quantity,
    unitPrice: round(Math.max(0, unit)),
    total: round(Math.max(0, unit) * quantity),
    sellerEdge: round(edge, 3),
  };
}

// Move value between two entities for goods.
//
// Refuses rather than going into debt: `individual_finances` has a
// `debt` column and putting somebody into it because they wanted
// something is a lending decision, not a purchase. A buyer who cannot
// pay does not buy.
function exchange(worldState, options = {}) {
  const { buyerId, sellerId, itemName, quantity = 1, cityId = null, tick = worldState.tick ?? 0 } = options;

  if (buyerId === sellerId) throw new Error('exchange: an entity cannot trade with itself');
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`exchange: quantity must be a positive number, got ${quantity}`);
  }
  for (const [role, id] of [['buyer', buyerId], ['seller', sellerId]]) {
    if (!worldState.npcs.some((n) => n.id === id)) {
      throw new Error(`exchange: ${role} ${id} is not among the living`);
    }
  }

  const deal = agreedPrice(worldState, itemName, { buyerId, sellerId, cityId, quantity });
  const buyer = economy.getLatestFinances(worldState, buyerId);

  // **Affordability is SAVINGS, not net worth**, and the first version
  // checked net worth. `individual_finances` splits `savings` from
  // `assets` deliberately: somebody whose wealth is entirely a house
  // and a workshop is not able to hand over 2,000 for a musical
  // instrument. Checking net worth would let them, and their savings
  // would go negative — a debt nobody agreed to, in a column
  // (`debt`) that exists precisely so that lending is explicit.
  const liquid = Number(buyer?.savings ?? 0);
  if (deal.total > liquid) {
    return { settled: false, reason: 'buyer cannot cover the price', deal, liquid };
  }

  // **And the seller has to actually hold the thing.** There is no
  // item, inventory or equipment table anywhere in this schema, so a
  // good being handed over has nothing to be represented BY — which
  // means a trade cannot be conservative unless something stands in
  // for goods held. `individual_finances.assets` is that stand-in: the
  // non-liquid half of somebody's position.
  //
  // The first version skipped this check and a test caught what it
  // costs: a seller with no assets sold a 60-value gem and their net
  // worth rose by 60, out of nothing. Value has to come from
  // somewhere, and a trade that mints it is worse than one that cannot
  // happen.
  const seller = economy.getLatestFinances(worldState, sellerId);
  const goods = Number(seller?.assets ?? 0);
  if (deal.total > goods) {
    return {
      settled: false,
      reason: 'seller does not hold goods of that value — `individual_finances.assets` stands '
        + 'in for inventory because no item table exists',
      deal,
      goods,
    };
  }

  // Both sides get a fresh `individual_finances` row rather than an
  // edited one: that table is a history of somebody's position, and
  // `getLatestFinances` reads the most recent. Editing in place would
  // erase what they were worth before the trade.
  economy.generateIndividualFinances(worldState, buyerId, {
    income: buyer?.income ?? 0,
    savings: (buyer?.savings ?? 0) - deal.total,
    debt: buyer?.debt ?? 0,
    assets: (buyer?.assets ?? 0) + deal.total,
    tick,
  });
  economy.generateIndividualFinances(worldState, sellerId, {
    income: seller?.income ?? 0,
    savings: (seller?.savings ?? 0) + deal.total,
    debt: seller?.debt ?? 0,
    assets: Math.max(0, (seller?.assets ?? 0) - deal.total),
    tick,
  });

  return { settled: true, deal, tick };
}

module.exports = {
  TRADE_CATEGORIES,
  RESOURCE_TYPES,
  BARTER_KEY_FIELDS,
  SOURCED_ITEMS,
  MODIFIERS_NOT_MODELLED,
  SCARCITY_SWING,
  POPULATION_SWING,
  POPULATION_REFERENCE,
  BARTER_SKILL_SWING,
  itemsFor,
  findItem,
  environmentModifier,
  populationModifier,
  barterScore,
  agreedPrice,
  exchange,
};
