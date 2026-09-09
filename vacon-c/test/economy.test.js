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
