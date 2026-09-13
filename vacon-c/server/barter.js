// server/barter.js
//
// The barter economy — §26, §27 and §28.
//
// **The catalogue itself lives in `server/items.js`** and is
// re-exported here, because `inventory.js` needs it too and a module
// that both required created a cycle. See that file's header.
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
const inventory = require('./inventory.js');
const {
  TRADE_CATEGORIES, RESOURCE_TYPES, BARTER_KEY_FIELDS, SOURCED_ITEMS, itemsFor, findItem,
} = require('./items.js');

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

// What everything somebody holds is worth here, at this moment.
//
// **Priced live, never stored.** Standing rule 3: an item's worth is
// its base value against local scarcity and population, all of which
// move — a `value` column on a holding would be the price on the day
// it was picked up, forever, which is standing rule 9's frozen-field
// failure in a new place.
//
// It lives here rather than in `inventory.js` because pricing is this
// module's job and putting it there would need inventory to require
// barter, which requires inventory.
function valueOfHoldings(worldState, entityId, options = {}) {
  const { cityId = null } = options;
  let total = 0;
  for (const holding of inventory.holdingsOf(worldState, entityId)) {
    if (!findItem(worldState, holding.item_name)) continue;
    const score = barterScore(worldState, holding.item_name, { cityId });
    total += score.Final_Barter_Score
      * Number(holding.quantity)
      * inventory.conditionFactor(holding.condition);
  }
  return Math.round(total * 100) / 100;
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
  // **And the seller has to actually hold the thing.** This check
  // started as a value proxy — `individual_finances.assets` standing
  // in for goods held, because no item table existed — after a test
  // caught what its absence cost: a seller with no assets sold a
  // 60-value gem and their net worth rose by 60, out of nothing.
  //
  // `server/inventory.js` exists now, so the question can be asked
  // literally: does this person hold one? The asset check stays as the
  // fallback for a world that trades without tracking holdings, and
  // says which of the two it applied.
  const sellerFinances = economy.getLatestFinances(worldState, sellerId);
  const held = inventory.quantityOf(worldState, sellerId, itemName);
  if (held > 0) {
    if (held < quantity) {
      return {
        settled: false,
        reason: `seller holds ${held} of ${quantity}`,
        deal,
        held,
      };
    }
  } else {
    const goods = Number(sellerFinances?.assets ?? 0);
    if (deal.total > goods) {
      return {
        settled: false,
        reason: 'seller holds none, and does not have assets of that value either — '
          + '`individual_finances.assets` is the fallback stand-in for untracked goods',
        deal,
        goods,
      };
    }
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
    income: sellerFinances?.income ?? 0,
    savings: (sellerFinances?.savings ?? 0) + deal.total,
    debt: sellerFinances?.debt ?? 0,
    // **The asset side only moves when the goods are untracked.** With
    // a real holding the object itself moves, so reducing assets too
    // would take the value off the seller twice.
    assets: held > 0
      ? (sellerFinances?.assets ?? 0)
      : Math.max(0, (sellerFinances?.assets ?? 0) - deal.total),
    tick,
  });

  // The OBJECT moves, not just the value — the half that could not
  // happen before there was an inventory. A seller whose holdings are
  // untracked moves nothing and the asset proxy above stands for it.
  const moved = held > 0
    ? inventory.transfer(worldState, { fromId: sellerId, toId: buyerId, itemName, quantity, tick })
    : { moved: 0, short: 0, untracked: true };

  return { settled: true, deal, tick, moved };
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
  valueOfHoldings,
  environmentModifier,
  populationModifier,
  barterScore,
  agreedPrice,
  exchange,
};
