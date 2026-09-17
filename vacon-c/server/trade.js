// server/trade.js
//
// The occasion. `barter.exchange` has never executed in a generated
// world.
//
// ---------------------------------------------------------------------
// What this closes
//
// `server/barter.js` is a complete trade: it prices an item from §27's
// own barter key, adjusts for local scarcity, population, each side's
// `economic.Barter Skill` and the seller's
// `reputation.Trustworthiness`, checks the buyer can cover it out of
// SAVINGS rather than net worth, checks the seller actually holds the
// thing, writes a fresh `individual_finances` row for both sides so the
// table stays a history rather than a mutation, and moves the object
// through `inventory.transfer`. It is conservative on both sides and it
// has its own green test file.
//
// `grep -rn "barter\." server/*.js` returns **nothing outside
// `barter.js` and `inventory.js`** — no route, no tick phase, and
// `engine.js` does not mention the module at all. Part of it IS
// reached: `crime.js` calls `valueOfHoldings` to decide which item a
// thief takes. **The trade half has never run.**
//
// That is CLAUDE.md's own recorded shape for `contest.js`: "a resolver
// nothing calls is the eleventh rule's sibling" — five disciplines,
// live traits, a seeded re-runnable result, its own green test file,
// and no generated world had ever held a contest. `competition.js` was
// the occasion. This is the same commit for trade.
//
// ---------------------------------------------------------------------
// The occasion is already in the engine, in the crime system
//
// Nothing here invents a reason to trade, because `crime.js` already
// computes one. `runDeprivationCrime` walks the population, asks
// `deprivationPressure` how far below the poverty line somebody is,
// and draws against it: the pressure produces a theft.
//
// **Somebody under that pressure who owns something does not have to
// steal.** They can sell it. That is the honest second branch of a
// mechanism that already existed with only one, and it uses the same
// driver rather than a new one — `areaStats.povertyLine`,
// `areaStats.povertyDepth` and `crime.deprivationPressure`, the three
// functions the theft path reads.
//
// So a settlement's poor sell what they have to whoever can pay, and
// only those with nothing left to sell are pushed toward the
// alternative. Crime stops being a fate and becomes a branch. And the
// money moves in the direction that has been missing: `runProduction`
// mints an employer's assets and `runPayroll` moves them to wages, and
// nothing until now moved value from the people who had it to the
// people who did not.
//
// ---------------------------------------------------------------------
// Where it runs
//
// The Economy phase, after payroll and the labour market — somebody
// decides to sell on what they have in hand today, and a wage paid this
// tick is money they no longer need to raise.

'use strict';

const areaStats = require('./areaStats.js');
const barter = require('./barter.js');
const crime = require('./crime.js');
const economy = require('./economy.js');
const inventory = require('./inventory.js');
const mortality = require('./mortality.js');
const { seededDraw } = require('./seeded.js');

//: How likely somebody under full deprivation pressure is to sell
//: something on a given day. **Flagged interpretive**, and set against
//: `crime.BASE_DEPRIVATION_RISK` rather than chosen freely: that
//: constant is 0.0006, the chance the same pressure produces a theft.
//: Selling is the easier and less dangerous option, so it is the more
//: likely one — an order of magnitude more, which puts a person at the
//: poverty line's floor at roughly one sale a season rather than one
//: theft every four years.
//:
//: The two are deliberately not equal. A world where stealing and
//: selling were equally likely would say something false about the
//: choice.
const DISTRESS_SALE_RATE = 0.006;

//: The least a holding has to be worth before somebody bothers taking
//: it to market. **Flagged interpretive**, and measured against the
//: catalogue: `items.SOURCED_ITEMS` runs from Sand at 5 to a Rare
//: Musical Instrument at 2000, so a floor of 10 excludes sand and
//: gravel — the two things nobody carries across town to sell — and
//: keeps everything else.
const MIN_SALE_VALUE = 10;

// What somebody could sell: what they hold, unequipped, worth having.
//
// **Equipped items are excluded.** `inventory.equip` is what makes an
// item "about somebody" rather than in their store — it is how
// `crime.js` decides an offence is armed and how §26's `protection`
// category means anything. Selling the coat off your own back is a
// different decision from selling a spare, and only the second one is
// modelled here.
// **`barterScore` per holding, NOT `valueOfHoldings`.** That function
// takes an entity id and prices everything they own; the first version
// here passed it a one-element array of holdings, so
// `holdingsOf(worldState, [holding])` matched nothing, every holding
// priced at 0, nothing ever cleared `MIN_SALE_VALUE`, and **the market
// settled zero trades in 400 ticks while looking entirely wired.**
// Caught by measuring the world rather than by the suite, which is the
// eleventh standing rule doing its job on a module written to satisfy
// it.
function sellableOf(worldState, entityId, options = {}) {
  const { cityId = null } = options;
  return inventory.holdingsOf(worldState, entityId)
    .filter((holding) => !holding.equipped)
    .map((holding) => {
      const item = barter.findItem(worldState, holding.item_name);
      if (!item) return { holding, value: null };
      const score = barter.barterScore(worldState, holding.item_name, { cityId });
      return {
        holding,
        // The same three terms `valueOfHoldings` multiplies, for one
        // holding rather than for a whole store.
        value: score.Final_Barter_Score
          * Number(holding.quantity)
          * inventory.conditionFactor(holding.condition),
      };
    })
    .filter((entry) => Number.isFinite(entry.value) && entry.value >= MIN_SALE_VALUE)
    // The least valuable thing first: somebody raising cash parts with
    // what they can spare, not with the best thing they own. Same
    // reasoning `crime.js` gives for which item a thief takes, pointed
    // the other way.
    .sort((a, b) => a.value - b.value || a.holding.item_name.localeCompare(b.holding.item_name));
}

// Who in this community could pay for it.
//
// Above the poverty line and holding enough SAVINGS — not net worth.
// `barter.exchange` makes that distinction for a stated reason
// ("somebody whose wealth is entirely a house and a workshop is not
// able to hand over 2,000 for a musical instrument") and a buyer list
// built on net worth would hand it people who fail its own check.
function buyersIn(worldState, residents, line, price, sellerId) {
  const candidates = [];
  for (const npc of residents) {
    if (npc.id === sellerId) continue;
    if (npc.status === 'imprisoned') continue;
    const worth = economy.getNetWorth(worldState, npc.id);
    if (areaStats.isBelowPovertyLine(worth, line)) continue;
    const savings = Number(economy.getLatestFinances(worldState, npc.id)?.savings ?? 0);
    if (savings < price) continue;
    candidates.push({ npc, savings });
  }
  // The most liquid buyer takes it. Deterministic, so §88 holds without
  // a second draw on top of the one that decided a sale happens at all.
  candidates.sort((a, b) => b.savings - a.savings || a.npc.id - b.npc.id);
  return candidates;
}

// One tick of the market.
//
// Returns `{ trades, events }`. Every settlement goes through
// `barter.exchange`, which is the whole point — this file decides WHO
// and WHETHER, and nothing about the price or the bookkeeping.
function runMarket(worldState, tick = worldState.tick ?? 0) {
  const events = [];
  const trades = [];

  const line = areaStats.povertyLine(worldState);
  // **Null is not zero here either.** A world nobody can compute a
  // poverty line for has no deprivation to read, and treating that as
  // a line of 0 would make every resident "above" it and the whole
  // pass silently do nothing while looking wired.
  if (line === null) return { trades, events };

  const scarcity = mortality.survivalScarcity(worldState);

  // Residents indexed by community once for the pass rather than
  // filtered per seller — `traitDrift.indexRows` and
  // `crime.dangerByCommunity` both cost this lesson.
  const byCommunity = new Map();
  for (const npc of worldState.npcs || []) {
    if (npc.communityId === null || npc.communityId === undefined) continue;
    const list = byCommunity.get(npc.communityId);
    if (list) list.push(npc); else byCommunity.set(npc.communityId, [npc]);
  }

  const cityOf = new Map();
  for (const community of worldState.communities || []) {
    cityOf.set(community.id, community.city_id ?? null);
  }

  for (const npc of worldState.npcs || []) {
    if (npc.status === 'imprisoned') continue;
    if (npc.communityId === null || npc.communityId === undefined) continue;

    const pressure = crime.deprivationPressure(worldState, npc, { line, scarcity });
    if (pressure <= 0) continue;

    // Seeded on the person and the tick (§88), at a rate proportional
    // to how badly they need the money — the same shape the theft draw
    // uses, because it is the same pressure.
    if (seededDraw([worldState.seed ?? 'world', 'sale', npc.id, tick])
        >= pressure * DISTRESS_SALE_RATE) continue;

    const cityId = cityOf.get(npc.communityId) ?? null;
    const sellable = sellableOf(worldState, npc.id, { cityId });
    if (sellable.length === 0) continue;

    const residents = byCommunity.get(npc.communityId) || [];

    // Try the cheapest thing first, and stop at the first sale — one
    // transaction per person per tick. Somebody raising cash sells a
    // thing, not their whole household.
    let settled = null;
    for (const entry of sellable) {
      const itemName = entry.holding.item_name;
      // Priced once to find a buyer who can cover it; `exchange`
      // prices it again for the pair that actually meets, because the
      // price depends on which buyer it is — their `Barter Skill` is
      // half the haggle.
      const indicative = barter.agreedPrice(worldState, itemName, {
        sellerId: npc.id, cityId, quantity: 1,
      });
      const asking = Number(indicative?.total);
      if (!Number.isFinite(asking) || asking <= 0) continue;

      for (const { npc: buyer } of buyersIn(worldState, residents, line, asking, npc.id)) {
        const result = barter.exchange(worldState, {
          buyerId: buyer.id, sellerId: npc.id, itemName, quantity: 1, cityId, tick,
        });
        if (!result.settled) continue;
        settled = { buyerId: buyer.id, sellerId: npc.id, itemName, result };
        break;
      }
      if (settled) break;
    }
    if (!settled) continue;

    trades.push(settled);
    events.push({
      type: 'distress_sale',
      severity: 'low',
      note: `Entity ${settled.sellerId} sold ${settled.itemName} to entity ${settled.buyerId} `
        + `for ${settled.result.deal.total}`,
      tick,
      affected_entity_ids: [settled.sellerId, settled.buyerId],
      global_effects: {
        itemName: settled.itemName,
        total: settled.result.deal.total,
        communityId: npc.communityId,
        pressure: Math.round(pressure * 100) / 100,
      },
    });
  }

  return { trades, events };
}

// -- reading ------------------------------------------------------------

// Trades settled in an area over a window, from the event log — the
// only durable record, because `barter.exchange` writes finance rows
// and inventory rows rather than a transactions table (the schema has
// none, and inventing one would be a table outside the source of
// truth).
const TRADE_WINDOW_TICKS = 365;

function tradesIn(worldState, communityId, options = {}) {
  const tick = Number(options.tick ?? worldState.tick ?? 0);
  const since = tick - (options.windowTicks ?? TRADE_WINDOW_TICKS);
  return (worldState.events || []).filter(
    (e) => e.type === 'distress_sale'
      && e.global_effects?.communityId === communityId
      && Number(e.tick) > since,
  );
}

// Value traded per resident over the window, or null where there is
// nobody to divide by. A rate rather than a count, so two areas of
// different size can be compared — the rule `statistics.js` holds
// every reading to.
function tradeVolumeIn(worldState, communityId, residents, options = {}) {
  if (!Number.isFinite(residents) || residents <= 0) return null;
  const total = tradesIn(worldState, communityId, options)
    .reduce((sum, e) => sum + (Number(e.global_effects?.total) || 0), 0);
  return Math.round((total / residents) * 100) / 100;
}

module.exports = {
  DISTRESS_SALE_RATE,
  MIN_SALE_VALUE,
  TRADE_WINDOW_TICKS,
  sellableOf,
  buyersIn,
  runMarket,
  tradesIn,
  tradeVolumeIn,
};
