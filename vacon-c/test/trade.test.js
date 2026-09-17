// The market — the occasion `barter.exchange` never had.
//
// ---------------------------------------------------------------------
// What this closes
//
// `server/barter.js` is a complete trade: §27's own barter key, local
// scarcity, population, both sides' `economic.Barter Skill`, the
// seller's `reputation.Trustworthiness`, affordability checked against
// SAVINGS rather than net worth, the seller's holding checked
// literally, a fresh `individual_finances` row for each side so that
// table stays a history, and the object itself moving through
// `inventory.transfer`. Conservative on both sides, with its own green
// test file.
//
// `grep -rn "barter\." server/*.js` returned nothing outside
// `barter.js` and `inventory.js`. `engine.js` does not mention the
// module. Part of it WAS reached — `crime.js` calls `valueOfHoldings`
// to pick which item a thief takes — but **the trade half had never
// executed in any generated world.**
//
// That is CLAUDE.md's recorded shape for `contest.js`: "a resolver
// nothing calls is the eleventh rule's sibling". `competition.js` was
// that resolver's occasion; this is trade's.
//
// ---------------------------------------------------------------------
// The occasion invents no motive
//
// `crime.js` already computes one. `runDeprivationCrime` asks
// `deprivationPressure` how far below the poverty line somebody is and
// draws against it to produce a theft. **Somebody under that pressure
// who owns something does not have to steal — they can sell it**, and
// only those with nothing left to sell are pushed toward the
// alternative. Same driver, second branch.
//
// ---------------------------------------------------------------------
// And the bug this file exists to prevent recurring
//
// `sellableOf`'s first version called `barter.valueOfHoldings(worldState,
// [holding])`. That function takes an ENTITY ID, not an array of
// holdings, so `holdingsOf(worldState, [holding])` matched nothing,
// every holding priced at 0, nothing ever cleared `MIN_SALE_VALUE`, and
// **the market settled zero trades in 400 ticks while looking entirely
// wired.** No test would have caught it — a fixture that hands a seller
// one item and asserts a sale would have failed loudly, but the failure
// mode was silence in a real world. Found by measuring, which is the
// eleventh standing rule applied to a module written to satisfy it.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const trade = require('../server/trade.js');
const barter = require('../server/barter.js');
const crime = require('../server/crime.js');
const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const areaStats = require('../server/areaStats.js');
const engine = require('../server/engine.js');
const { generateEntityTraits } = require('../server/entityTraits.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');

let nextId = 7000;

// ---------------------------------------------------------------------
// A world with exactly what the market reads.
//
// **Standing rule 8**: constructed, not generated. Every assertion
// below is about who is below the poverty line and who holds what, so
// both are set rather than drawn. `generateWorld` also APPENDS to a
// shared WorldState.
// ---------------------------------------------------------------------
function marketWorld({ tick = 100 } = {}) {
  const w = {
    tick,
    seed: 'trade-test',
    npcs: [],
    deceased: [],
    communities: [{ id: 1, city_id: 1, population: 0 }],
    cities: [{ id: 1, name: 'Testbed' }],
    organizations: [],
    resources: [],
    marketListings: [],
    individualFinances: [],
    inventory: [],
    entityTraits: [],
    memories: [],
    relationships: [],
    entityKnowledge: [],
    historicalRecords: [],
    crimeIncidents: [],
    events: [],
    activeConditions: [],
    // A real catalogue entry, so pricing reads the same path a world
    // does rather than a stub.
    barterItems: [{ name: 'Silver Ingot', category: 'metals', baseValue: 50 }],
  };
  return w;
}

function person(w, { savings = 0, assets = 0, traitValue = 50 } = {}) {
  const npc = { id: nextId++, status: 'active', communityId: 1, home_property_id: null };
  w.npcs.push(npc);
  w.entityTraits.push(...generateEntityTraits(
    npc.id, w.tick, INDIVIDUAL_DEFINITIONS, () => traitValue,
  ));
  economy.generateIndividualFinances(w, npc.id, { savings, assets, tick: w.tick });
  w.communities[0].population = w.npcs.length;
  return npc;
}

// ---------------------------------------------------------------------
// What is sellable
// ---------------------------------------------------------------------

test('a holding is priced by its own barter score, not by a whole store', () => {
  // **The bug this test exists for.** `valueOfHoldings` takes an entity
  // id; passing it `[holding]` prices nothing, and every holding came
  // back at 0.
  const w = marketWorld();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Silver Ingot' });

  const sellable = trade.sellableOf(w, a.id, { cityId: 1 });
  assert.equal(sellable.length, 1, 'a real holding was not sellable');
  assert.ok(sellable[0].value >= trade.MIN_SALE_VALUE,
    `a Silver Ingot priced at ${sellable[0].value}, below the ${trade.MIN_SALE_VALUE} floor`);
  // It agrees with the module that prices a whole store, for a store of
  // one thing.
  assert.equal(
    Math.round(sellable[0].value * 100) / 100,
    barter.valueOfHoldings(w, a.id, { cityId: 1 }),
  );
});

test('an equipped item is not for sale', () => {
  // `inventory.equip` is what makes an item about somebody rather than
  // in their store — it is how `crime.js` decides an offence is armed.
  // Selling the coat off your own back is a different decision.
  const w = marketWorld();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Silver Ingot' });
  assert.equal(trade.sellableOf(w, a.id, { cityId: 1 }).length, 1);
  inventory.equip(w, { entityId: a.id, itemName: 'Silver Ingot' });
  assert.equal(trade.sellableOf(w, a.id, { cityId: 1 }).length, 0);
});

test('the cheapest thing goes first', () => {
  // Somebody raising cash parts with what they can spare, not with the
  // best thing they own — the same reasoning `crime.js` gives for which
  // item a thief takes, pointed the other way.
  const w = marketWorld();
  w.barterItems.push({ name: 'Gold Bar', category: 'metals', baseValue: 1800 });
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Gold Bar' });
  inventory.give(w, { entityId: a.id, itemName: 'Silver Ingot' });
  assert.equal(trade.sellableOf(w, a.id, { cityId: 1 })[0].holding.item_name, 'Silver Ingot');
});

// ---------------------------------------------------------------------
// Who can buy
// ---------------------------------------------------------------------

test('a buyer needs savings, not net worth', () => {
  // `barter.exchange` checks SAVINGS for a stated reason — "somebody
  // whose wealth is entirely a house and a workshop is not able to hand
  // over 2,000 for a musical instrument" — so a buyer list built on net
  // worth would hand it people who fail its own check.
  const w = marketWorld();
  const seller = person(w);
  const liquid = person(w, { savings: 500 });
  const landed = person(w, { savings: 0, assets: 5000 });

  const line = 100;
  const buyers = trade.buyersIn(w, w.npcs, line, 200, seller.id).map((b) => b.npc.id);
  assert.deepEqual(buyers, [liquid.id],
    'somebody whose wealth is all assets was offered a cash purchase');
  assert.ok(!buyers.includes(landed.id));
});

test('somebody below the line is not a buyer, and nor is a prisoner', () => {
  const w = marketWorld();
  const seller = person(w);
  const poor = person(w, { savings: 500 });
  const jailed = person(w, { savings: 5000 });
  jailed.status = 'imprisoned';

  // A line above the poor buyer's net worth excludes them.
  const line = 2000;
  const buyers = trade.buyersIn(w, w.npcs, line, 100, seller.id).map((b) => b.npc.id);
  assert.ok(!buyers.includes(poor.id), 'somebody below the poverty line was asked to buy');
  assert.ok(!buyers.includes(jailed.id), 'somebody serving a sentence went shopping');
});

test('the most liquid buyer takes it, deterministically', () => {
  // Deterministic, so §88 holds without a second draw on top of the one
  // that decided a sale happens at all.
  const w = marketWorld();
  const seller = person(w);
  person(w, { savings: 300 });
  const richest = person(w, { savings: 900 });
  person(w, { savings: 600 });
  assert.equal(trade.buyersIn(w, w.npcs, 100, 100, seller.id)[0].npc.id, richest.id);
});

// ---------------------------------------------------------------------
// The market
// ---------------------------------------------------------------------

// A world where exactly one person is destitute and holds something,
// and one person is solvent — so a sale is the only thing that can
// happen and the assertion is about whether it does.
function distressWorld() {
  const w = marketWorld();
  // Net worth spread so `povertyLine` (half the median) sits between
  // them. Built rather than drawn — standing rule 8.
  const seller = person(w, { savings: 0 });
  const buyer = person(w, { savings: 4000 });
  person(w, { savings: 3000 });
  person(w, { savings: 3500 });
  inventory.give(w, { entityId: seller.id, itemName: 'Silver Ingot' });
  return { w, seller, buyer };
}

test('a destitute person with something to sell sells it', () => {
  const { w, seller } = distressWorld();
  const line = areaStats.povertyLine(w);
  assert.ok(
    crime.deprivationPressure(w, seller, { line, scarcity: 0 }) > 0,
    'the fixture did not put the seller under any pressure',
  );

  // Long enough for a rate of 0.006 against real pressure to fire; the
  // assertion is about WHETHER, not how fast.
  let trades = [];
  for (let t = 0; t < 4000 && trades.length === 0; t += 1) {
    w.tick = 100 + t;
    trades = trade.runMarket(w, w.tick).trades;
  }
  assert.equal(trades.length, 1, 'no sale ever settled');
  assert.equal(trades[0].sellerId, seller.id);
  assert.ok(trades[0].result.settled);
  assert.ok(trades[0].result.deal.total > 0);
});

test('the sale moves the money down and the object across', () => {
  const { w, seller, buyer } = distressWorld();
  const sellerBefore = Number(economy.getLatestFinances(w, seller.id).savings);
  const buyerBefore = Number(economy.getLatestFinances(w, buyer.id).savings);

  let trades = [];
  for (let t = 0; t < 4000 && trades.length === 0; t += 1) {
    w.tick = 100 + t;
    trades = trade.runMarket(w, w.tick).trades;
  }
  assert.equal(trades.length, 1);
  const paid = trades[0].result.deal.total;

  // **Conservative.** What the seller gained is what the buyer spent —
  // this is the property `barter.exchange` was built for and the reason
  // this pass does none of the bookkeeping itself.
  assert.equal(Number(economy.getLatestFinances(w, seller.id).savings), sellerBefore + paid);
  assert.equal(
    Number(economy.getLatestFinances(w, trades[0].buyerId).savings),
    buyerBefore - paid,
  );

  // And the object moved, not just the value.
  assert.equal(inventory.quantityOf(w, seller.id, 'Silver Ingot'), 0);
  assert.equal(inventory.quantityOf(w, trades[0].buyerId, 'Silver Ingot'), 1);
});

test('somebody with nothing to sell is left with the other branch', () => {
  // The whole point of the second branch: crime is what is left when
  // selling is not available, rather than the only response to
  // deprivation.
  const { w, seller } = distressWorld();
  w.inventory = [];
  for (let t = 0; t < 2000; t += 1) {
    w.tick = 100 + t;
    assert.equal(trade.runMarket(w, w.tick).trades.length, 0);
  }
  assert.ok(crime.deprivationPressure(w, seller, {
    line: areaStats.povertyLine(w), scarcity: 0,
  }) > 0, 'the pressure went away, so this asserts nothing');
});

test('nobody above the line sells anything', () => {
  // Centred where it has to be: a comfortable world is unchanged by
  // this pass existing.
  const w = marketWorld();
  for (let i = 0; i < 4; i += 1) {
    const npc = person(w, { savings: 3000 });
    inventory.give(w, { entityId: npc.id, itemName: 'Silver Ingot' });
  }
  for (let t = 0; t < 2000; t += 1) {
    w.tick = 100 + t;
    assert.equal(trade.runMarket(w, w.tick).trades.length, 0);
  }
});

test('a world with no poverty line to read trades nothing and throws nothing', () => {
  // **Null is not zero.** A world nobody can compute a line for has no
  // deprivation to read, and treating that as a line of 0 would make
  // every resident "above" it while the pass silently did nothing and
  // looked wired.
  const w = marketWorld();
  assert.equal(areaStats.povertyLine(w), null);
  assert.deepEqual(trade.runMarket(w, w.tick), { trades: [], events: [] });
});

test('the same seed settles the same trades', () => {
  // §88. Seeded on the person and the tick, not on a counter.
  // **The ids have to be the same in both runs.** The draw is seeded on
  // the person — which is right, because the person IS its subject, the
  // same call `statecraft.runSchooling` makes — and this file's `nextId`
  // is a counter whose state depends on what was built before it. That
  // is CLAUDE.md's own §88 corollary ("a seeded generator keyed on
  // generated ids is not reproducible, because ids come from a counter")
  // showing up in a test rather than in the engine.
  const run = (seed) => {
    nextId = 7500;
    const { w } = distressWorld();
    w.seed = seed;
    const trail = [];
    for (let t = 0; t < 600; t += 1) {
      w.tick = 100 + t;
      for (const settled of trade.runMarket(w, w.tick).trades) {
        trail.push(`${settled.sellerId}->${settled.buyerId}@${w.tick}`);
      }
    }
    return trail.join(',');
  };
  assert.equal(run('alpha'), run('alpha'), 'the same seed did not replay');
  assert.notEqual(run('alpha'), run('beta'), 'the seed does not reach the draw');
});

test('selling is more likely than stealing, and deliberately so', () => {
  // The two rates are set against each other rather than chosen
  // separately: a world where stealing and selling were equally likely
  // would say something false about the choice.
  assert.ok(trade.DISTRESS_SALE_RATE > crime.BASE_DEPRIVATION_RISK,
    'stealing is at least as likely as selling');
  assert.equal(trade.DISTRESS_SALE_RATE, 0.006);
  assert.equal(crime.BASE_DEPRIVATION_RISK, 0.0006);
});

// ---------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------

test('trades are reported as a rate, and an empty area reads null not zero', () => {
  const w = marketWorld();
  w.events.push({
    type: 'distress_sale', tick: w.tick, severity: 'low', note: '',
    affected_entity_ids: [], global_effects: { communityId: 1, total: 120 },
  });
  assert.equal(trade.tradesIn(w, 1, { tick: w.tick }).length, 1);
  assert.equal(trade.tradeVolumeIn(w, 1, 10, { tick: w.tick }), 12);
  // Nobody to divide by is not a volume of zero.
  assert.equal(trade.tradeVolumeIn(w, 1, 0, { tick: w.tick }), null);
  // And a sale outside the window is not this year's trade.
  assert.equal(
    trade.tradesIn(w, 1, { tick: w.tick + trade.TRADE_WINDOW_TICKS + 1 }).length, 0,
  );
});

test('a GENERATED world actually settles trades', () => {
  // **Standing rule 11, and the check that would have caught the
  // pricing bug.** The fixtures above all pass with a `sellableOf` that
  // works; the failure mode was silence in a real world, so the claim
  // has to be held against one.
  const worldgen = require('../server/worldgen.js');
  const w = engine.WorldState;
  const before = w.events.filter((e) => e.type === 'distress_sale').length;
  worldgen.generateWorld({
    seed: 'trade-real', cities: 1, communitiesPerCity: 2, populationPerCommunity: 20,
  });
  for (let t = 0; t < 120; t += 1) engine.advanceTick();
  const settled = w.events.filter((e) => e.type === 'distress_sale').length - before;
  assert.ok(settled > 0, 'a generated world settled no trades at all in 120 ticks');
});
