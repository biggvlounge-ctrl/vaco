// VACANCY — the economy: resources, scarcity, prices, personal wealth.
//
// This is the layer a player feels most directly -- what things cost,
// whether there is enough, and whether their family is getting richer
// or poorer. `economy.js` takes `worldState` explicitly, so everything
// here runs against a private world.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const economy = require('../server/economy.js');

function freshWorld() {
  return {
    tick: 0, npcs: [], resources: [], marketListings: [], individualFinances: [],
    memories: [], relationships: [], entityKnowledge: [], entityTraits: [],
  };
}

// -- resources ---------------------------------------------------------------

test('a resource must declare its type', () => {
  // resources.resource_type is NOT NULL with no default. Failing loudly
  // here beats a row that reaches Postgres and is rejected there.
  assert.throws(() => economy.generateResource(freshWorld(), {}), /resourceType/);
});

test('production and consumption net out into quantity each tick', () => {
  const w = freshWorld();
  const surplus = economy.generateResource(w, {
    resourceType: 'grain', quantity: 100, productionRate: 30, consumptionRate: 10,
  });
  const deficit = economy.generateResource(w, {
    resourceType: 'oil', quantity: 100, productionRate: 5, consumptionRate: 25,
  });

  economy.advanceResourceTick(surplus);
  economy.advanceResourceTick(deficit);

  assert.equal(surplus.quantity, 120, 'a surplus accumulates');
  assert.equal(deficit.quantity, 80, 'a deficit draws down');
});

test('quantity floors at zero rather than going negative', () => {
  // A negative stockpile is not a state the world can be in, and
  // letting one exist would propagate through every rollup that sums
  // resources.
  const w = freshWorld();
  const r = economy.generateResource(w, {
    resourceType: 'water', quantity: 5, productionRate: 0, consumptionRate: 40,
  });

  economy.advanceResourceTick(r);

  assert.equal(r.quantity, 0, 'you cannot consume more than exists');
});

// -- scarcity ----------------------------------------------------------------

test('scarcity is 50 when demand equals supply', () => {
  // 50 is load-bearing: it is the neutral point the price model pivots
  // on. If this drifts, every price in the game drifts with it.
  const w = freshWorld();
  const r = economy.generateResource(w, { resourceType: 'water', supply: 80, demand: 80 });
  assert.equal(economy.getScarcity(r), 50);
});

test('scarcity rises with demand and falls with supply', () => {
  const w = freshWorld();
  const tight = economy.generateResource(w, { resourceType: 'a', supply: 50, demand: 100 });
  const loose = economy.generateResource(w, { resourceType: 'b', supply: 100, demand: 50 });

  assert.ok(economy.getScarcity(tight) > 50, 'demand over supply is scarce');
  assert.ok(economy.getScarcity(loose) < 50, 'supply over demand is abundant');
});

test('scarcity is clamped to 0-100 and survives zero supply', () => {
  const w = freshWorld();
  const gone = economy.generateResource(w, { resourceType: 'x', supply: 0, demand: 500 });
  const unwanted = economy.generateResource(w, { resourceType: 'y', supply: 500, demand: 0 });

  const s = economy.getScarcity(gone);
  assert.equal(s, 100, 'total exhaustion is maximum scarcity, not Infinity');
  assert.ok(Number.isFinite(s), 'a divide-by-zero must not escape as Infinity');
  assert.equal(economy.getScarcity(unwanted), 0);
});

// -- prices ------------------------------------------------------------------

test('a listing must declare a name and a price', () => {
  const w = freshWorld();
  assert.throws(() => economy.generateMarketListing(w, { price: 1 }), /productName/);
  assert.throws(() => economy.generateMarketListing(w, { productName: 'x' }), /price/);
});

test('price follows the listing\'s own supply and demand', () => {
  const w = freshWorld();
  const scarce = economy.generateMarketListing(w, {
    productName: 'bread', price: 10, supply: 50, demand: 100,
  });
  const glut = economy.generateMarketListing(w, {
    productName: 'salt', price: 10, supply: 100, demand: 50,
  });

  economy.resolveMarketPrice(scarce, 1);
  economy.resolveMarketPrice(glut, 1);

  assert.ok(scarce.price > 10, 'scarce goods get dearer');
  assert.ok(glut.price < 10, 'glutted goods get cheaper');
});

test('price never reaches zero however deep the glut', () => {
  // A free good breaks every downstream calculation that divides by
  // price, and nothing in a real market is worth exactly nothing.
  const w = freshWorld();
  const listing = economy.generateMarketListing(w, {
    productName: 'sand', price: 0.02, supply: 1000, demand: 0,
  });

  for (let i = 0; i < 200; i += 1) economy.resolveMarketPrice(listing, i);

  // Asserting `> 0` here was not enough and a mutation proved it:
  // stripping the floor entirely still leaves a positive number,
  // because exponential decay in floating point approaches zero
  // without reaching it. 0.01 is the actual floor the model promises,
  // so 0.01 is what has to be asserted.
  assert.ok(listing.price >= 0.01,
    `price must stay at or above the 0.01 floor, got ${listing.price}`);
});

test('input scarcity moves the price of the good made from it', () => {
  // The link the Definition-of-Done cascade test found missing. Both
  // listings are internally balanced, so their own imbalance is zero
  // and input scarcity is the only force acting.
  const w = freshWorld();
  const dear = economy.generateMarketListing(w, {
    productName: 'water ration', resourceType: 'water', price: 10, supply: 100, demand: 100,
  });
  const cheap = economy.generateMarketListing(w, {
    productName: 'water ration', resourceType: 'water', price: 10, supply: 100, demand: 100,
  });

  economy.resolveMarketPrice(dear, 1, 90);    // input badly scarce
  economy.resolveMarketPrice(cheap, 1, 10);   // input abundant

  assert.ok(dear.price > 10, 'a scarce input makes the finished good dearer');
  assert.ok(cheap.price < 10, 'an abundant input makes it cheaper');
});

test('neutral input scarcity changes nothing at all', () => {
  // The property that makes the new term safe to add: at 50 -- demand
  // equal to supply -- it must be exactly as if it were not there.
  const w = freshWorld();
  const withNeutral = economy.generateMarketListing(w, {
    productName: 'a', resourceType: 'water', price: 10, supply: 60, demand: 90,
  });
  const withNone = economy.generateMarketListing(w, {
    productName: 'b', price: 10, supply: 60, demand: 90,
  });

  economy.resolveMarketPrice(withNeutral, 1, 50);
  economy.resolveMarketPrice(withNone, 1, null);

  assert.equal(withNeutral.price, withNone.price,
    'scarcity 50 must be indistinguishable from no input at all');
});

test('a listing with no resource_type is unaffected by any scarcity', () => {
  const w = freshWorld();
  const listing = economy.generateMarketListing(w, {
    productName: 'hand-carved chair', price: 100, supply: 50, demand: 50,
  });

  assert.equal(listing.resource_type, null);
  economy.resolveMarketPrice(listing, 1, null);
  assert.equal(listing.price, 100);
});

// -- personal wealth ---------------------------------------------------------

test('net worth sums an entity\'s finances', () => {
  const w = freshWorld();
  economy.generateIndividualFinances(w, 1, { savings: 400 });
  const worth = economy.getNetWorth(w, 1);

  assert.equal(typeof worth, 'number');
  assert.ok(Number.isFinite(worth), 'net worth must be a real number, not NaN');
});

test('an entity with no finances is worth zero, not NaN', () => {
  // The NaN class of bug this repo audited every money path for. An
  // entity nobody has given a finances row must read as zero so that
  // family wealth -- a sum over members -- stays a number.
  const w = freshWorld();
  assert.equal(economy.getNetWorth(w, 999), 0);
});

test('family wealth stays a number when one member has no finances', () => {
  const w = freshWorld();
  economy.generateIndividualFinances(w, 1, { savings: 100 });
  // entity 2 deliberately has none
  const total = [1, 2].reduce((sum, id) => sum + economy.getNetWorth(w, id), 0);

  assert.ok(Number.isFinite(total), `family wealth went non-finite: ${total}`);
  assert.equal(total, economy.getNetWorth(w, 1), 'the memberless member contributes zero');
});

// -- demand tracks the population that wants the thing -------------------
//
// **`getScarcity` returned the same number for the life of every world
// ever generated.** Measured over 400 ticks: food 44, water 45,
// medicine 46, energy 42, wood 62, never moving by one. Scarcity is
// `demand / supply` and the only writer of either column anywhere in
// the engine was the environmental-condition applier — so outside a
// drought a settlement's scarcity was a constant drawn on tick 0, and
// prices, the food satisfier, survival pressure and the broadcast that
// feeds two Key resolvers were all reading it.
//
// The Resource phase was worse: `production_rate` and
// `consumption_rate` were 0 on every resource in every world, so
// `advanceResourceTick` computed `max(0, 0 + 0 - 0)` on every tick.
// **Phase 2 of the locked eleven was a no-op.**

function peopledWorld({ residents = 10, demand = 50, supply = 100 } = {}) {
  const w = {
    tick: 10,
    npcs: [], communities: [{ id: 1, city_id: 1 }], cities: [{ id: 1 }],
    resources: [], marketListings: [], individualFinances: [],
    organizations: [], employmentRecords: [], entityTraits: [],
  };
  for (let i = 0; i < residents; i += 1) {
    w.npcs.push({ id: 5000 + i, status: 'active', communityId: 1 });
  }
  economy.generateResource(w, {
    cityId: 1, resourceType: 'food', supply, demand,
    // Derived from the demand, exactly as `worldgen` does it.
    consumptionRate: demand / residents,
  });
  return w;
}

test('demand on tick 0 is exactly the number that was drawn', () => {
  // **Centred, and that is why `consumption_rate` is derived rather
  // than chosen.** Standing rule 12's first clause: a modifier centred
  // anywhere but zero recalibrates every world the day it starts being
  // read.
  const w = peopledWorld({ residents: 10, demand: 50 });
  const [food] = w.resources;
  assert.equal(economy.demandTargetFor(w, food), 50);
  economy.refreshDemand(w);
  assert.equal(food.demand, 50, 'a world at its own population shifted anyway');
});

test('more people want more, and fewer people want less', () => {
  const grow = peopledWorld({ residents: 10, demand: 50 });
  for (let i = 0; i < 10; i += 1) {
    grow.npcs.push({ id: 6000 + i, status: 'active', communityId: 1 });
  }
  assert.equal(economy.demandTargetFor(grow, grow.resources[0]), 100);
  for (let t = 0; t < 400; t += 1) economy.refreshDemand(grow);
  assert.ok(grow.resources[0].demand > 90,
    `demand reached ${grow.resources[0].demand} against a target of 100`);

  const shrink = peopledWorld({ residents: 10, demand: 50 });
  shrink.npcs = shrink.npcs.slice(0, 4);
  for (let t = 0; t < 400; t += 1) economy.refreshDemand(shrink);
  assert.ok(shrink.resources[0].demand < 25,
    `demand reached ${shrink.resources[0].demand} against a target of 20`);
});

test('scarcity moves when the population does, which it never did before', () => {
  const w = peopledWorld({ residents: 10, demand: 50, supply: 100 });
  const before = economy.getScarcity(w.resources[0]);
  for (let i = 0; i < 20; i += 1) {
    w.npcs.push({ id: 7000 + i, status: 'active', communityId: 1 });
  }
  for (let t = 0; t < 400; t += 1) economy.refreshDemand(w);
  assert.ok(economy.getScarcity(w.resources[0]) > before,
    'tripling the population left scarcity where it was');
});

test('a resource nobody can measure a population for is left alone', () => {
  // **Null residents is not zero residents.** `resources.city_id` is
  // nullable and most fixtures — the drought cascade's included —
  // create a resource with no city at all. Drifting those toward a
  // target of 0 would empty every hand-made world's demand and break
  // the cascade that is this project's Definition of Done.
  const w = peopledWorld();
  const orphan = economy.generateResource(w, {
    resourceType: 'water', supply: 100, demand: 100, consumptionRate: 5,
  });
  assert.equal(orphan.city_id, null);
  assert.equal(economy.demandTargetFor(w, orphan), null);
  economy.refreshDemand(w);
  assert.equal(orphan.demand, 100);

  // Same for a resource in a city nobody lives in, and for one with no
  // per-capita rate recorded — a world generated before this existed.
  const empty = economy.generateResource(w, {
    cityId: 99, resourceType: 'wood', supply: 100, demand: 100, consumptionRate: 5,
  });
  assert.equal(economy.demandTargetFor(w, empty), null);
  const unrated = economy.generateResource(w, {
    cityId: 1, resourceType: 'medicine', supply: 100, demand: 100,
  });
  assert.equal(economy.demandTargetFor(w, unrated), null);
  economy.refreshDemand(w);
  assert.equal(empty.demand, 100);
  assert.equal(unrated.demand, 100);
});

test('refreshDemand reports only what moved', () => {
  // Standing rule 7: a resource sitting at its own target for a decade
  // is not three thousand events.
  const w = peopledWorld({ residents: 10, demand: 50 });
  assert.deepEqual(economy.refreshDemand(w), []);
  w.npcs.push({ id: 8001, status: 'active', communityId: 1 });
  assert.equal(economy.refreshDemand(w).length, 1);
});

// -- net worth includes what you own -------------------------------------

const property = require('../server/property.js');

function wealthWorld() {
  return {
    tick: 0, nextEntityId: 1, entities: [],
    npcs: [], properties: [], ownershipRecords: [], individualFinances: [],
  };
}

test('somebody who owns a building is not destitute', () => {
  // **Measured before this changed anything.** 23 of 58 property owners
  // in a 600-tick world were classified below the poverty line; the
  // worst held 41,275 in buildings against 5,894 in cash. The poverty
  // line is the median of this function, so the misclassification
  // reached crime.deprivation, births, trade and the statistics at once.
  const w = wealthWorld();
  const home = property.generateProperty(w, {
    type: 'residential', value: 40000, lifecycleStage: 'operation',
  });
  home.condition = 100;
  property.recordOwnership(w, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual', tick: 0,
  });

  assert.equal(economy.getNetWorth(w, 7), 40000,
    'a person with no cash and a 40,000 building read as worth nothing');
  assert.equal(economy.ownedPropertyValue(w, 7), 40000);
});

test('a decaying building takes its owner down with it', () => {
  // This is the half that matters for the economy: property decay
  // destroys 56% of all property value over 600 ticks, and before this
  // nothing that reads wealth could see any of it. Net worth rose
  // monotonically because it was reading one side of a two-sided
  // ledger.
  const w = wealthWorld();
  const home = property.generateProperty(w, {
    type: 'residential', value: 40000, lifecycleStage: 'operation',
  });
  home.condition = 100;
  property.recordOwnership(w, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual', tick: 0,
  });
  const before = economy.getNetWorth(w, 7);

  home.condition = 25;
  const after = economy.getNetWorth(w, 7);
  assert.ok(after < before, 'a building rotting to a quarter of its condition cost its owner nothing');
  assert.equal(after, 10000, 'value should track condition straight-line');
});

test('family-held property is not counted into each member', () => {
  // `ownership_records.owner_type` has family, organization, government
  // and community beside individual. Attributing a family's house to
  // every member would multiply one building across the household —
  // and `getFamilyWealth` sums member net worths, so it would compound
  // a second time there.
  const w = wealthWorld();
  const home = property.generateProperty(w, {
    type: 'residential', value: 40000, lifecycleStage: 'operation',
  });
  home.condition = 100;
  property.recordOwnership(w, {
    entityId: home.id, ownerEntityId: 3, ownerType: 'family', tick: 0,
  });
  assert.equal(economy.getNetWorth(w, 3), 0,
    'family-held property was attributed to an individual');
});

test('cash and property add rather than one replacing the other', () => {
  const w = wealthWorld();
  const home = property.generateProperty(w, {
    type: 'residential', value: 10000, lifecycleStage: 'operation',
  });
  home.condition = 100;
  property.recordOwnership(w, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual', tick: 0,
  });
  w.individualFinances.push({
    id: 1, entity_id: 7, tick: 0, assets: 0, savings: 500, debt: 200, income: 0, expenses: 0,
  });
  assert.equal(economy.getNetWorth(w, 7), 10300, '10000 property + 500 savings - 200 debt');
});

test('somebody who owns nothing is unchanged by this', () => {
  // Standing rule 12, first clause: an ordinary person's outcome must
  // be bit-identical to what it was before the change existed, or the
  // whole world has been recalibrated rather than a gap closed. 90 of
  // 148 people in the measured world own no property at all.
  const w = wealthWorld();
  w.individualFinances.push({
    id: 1, entity_id: 9, tick: 0, assets: 100, savings: 500, debt: 200, income: 0, expenses: 0,
  });
  assert.equal(economy.getNetWorth(w, 9), 400);
  assert.equal(economy.ownedPropertyValue(w, 9), 0);
});
