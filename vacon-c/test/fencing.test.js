// Car fencing (stolen-vehicle resale market) — by direct instruction.
// Read `server/fencing.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fencing = require('../server/fencing.js');
const barter = require('../server/barter.js');
const vehicles = require('../server/vehicles.js');
const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const salvage = require('../server/salvage.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 700000;

function world() {
  const worldState = {
    tick: 10,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    communities: [],
    cities: [],
    entityTraits: [],
    individualFinances: [],
    employmentRecords: [],
    resources: [],
    marketListings: [],
    inventory: [],
    barterItems: [],
    crimeIncidents: [],
    historicalRecords: [],
    entityKnowledge: [],
    entityState: [],
    memories: [],
  };
  economy.reseedIds(worldState);
  return worldState;
}

function person(worldState, { savings = 5000, blackMarketTies = 50 } = {}) {
  const id = nextId++;
  const rows = generateEntityTraits(id, worldState.tick, INDIVIDUAL_DEFINITIONS, () => 50);
  for (const row of rows) {
    const def = INDIVIDUAL_DEFINITIONS.find((d) => d.trait_id === row.trait_id);
    if (def && def.family === 'criminal' && def.name === 'Black Market Ties') {
      row.current_value = blackMarketTies;
    }
  }
  worldState.entityTraits.push(...rows);
  worldState.npcs.push({
    id, status: 'active', traits: {}, createdTick: 0, updatedTick: 0, home_property_id: null,
  });
  economy.generateIndividualFinances(worldState, id, { savings, tick: worldState.tick });
  return worldState.npcs[worldState.npcs.length - 1];
}

// ---------------------------------------------------------------------
// isFence
// ---------------------------------------------------------------------

test('isFence is false below the real measured floor, true at or above it', () => {
  const w = world();
  const ordinary = person(w, { blackMarketTies: 50 });
  const fence = person(w, { blackMarketTies: fencing.FENCE_BLACK_MARKET_TIES_FLOOR });
  assert.equal(fencing.isFence(w, ordinary.id), false);
  assert.equal(fencing.isFence(w, fence.id), true);
});

// ---------------------------------------------------------------------
// vehicles.stealVehicle marks real provenance — uses a real vehicle
// item (`car`), since this does not go through barterScore.
// ---------------------------------------------------------------------

test('a stolen vehicle is really flagged stolen on its own holding row', () => {
  const w = world();
  salvage.registerItems(w);
  const thief = person(w, { blackMarketTies: 95 });
  const victim = person(w);
  inventory.give(w, { entityId: victim.id, itemName: 'car', quantity: 1 });

  let result;
  for (let i = 0; i < 50 && !result?.stolen; i += 1) {
    result = vehicles.stealVehicle(w, thief.id, victim.id, 'car', { tick: w.tick + i });
    if (result.stolen) break;
    inventory.give(w, { entityId: victim.id, itemName: 'car', quantity: 1 });
  }
  assert.ok(result.stolen, 'a theft must eventually succeed across 50 real attempts');

  const holding = inventory.findHolding(w, thief.id, 'car');
  assert.equal(holding.stolen, true);
});

// ---------------------------------------------------------------------
// barter.exchange — uses a real, already-priced §27 item (`Hammer`),
// since `car` has no real Base_Value registered in barter's own
// pricing table (a separate, pre-existing gap, out of this round's
// scope). The stolen-goods gate itself is generic over any item.
// ---------------------------------------------------------------------

test('barter.exchange refuses to move a real stolen holding to a non-fence buyer', () => {
  const w = world();
  const thief = person(w);
  const ordinaryBuyer = person(w, { blackMarketTies: 50 });
  inventory.give(w, { entityId: thief.id, itemName: 'Hammer', quantity: 1 });
  inventory.findHolding(w, thief.id, 'Hammer').stolen = true;

  const result = barter.exchange(w, { buyerId: ordinaryBuyer.id, sellerId: thief.id, itemName: 'Hammer' });
  assert.equal(result.settled, false);
  assert.match(result.reason, /stolen/);
});

test('barter.exchange allows a real fence to buy a stolen holding, at the real discount', () => {
  const w = world();
  const thief = person(w);
  const fence = person(w, { blackMarketTies: fencing.FENCE_BLACK_MARKET_TIES_FLOOR });
  inventory.give(w, { entityId: thief.id, itemName: 'Hammer', quantity: 1 });
  inventory.findHolding(w, thief.id, 'Hammer').stolen = true;

  const cleanPrice = barter.agreedPrice(w, 'Hammer', { buyerId: fence.id, sellerId: thief.id });
  const result = barter.exchange(w, {
    buyerId: fence.id, sellerId: thief.id, itemName: 'Hammer',
    priceMultiplier: fencing.FENCE_PRICE_MULTIPLIER,
  });

  assert.equal(result.settled, true);
  assert.equal(result.deal.total, Math.round(cleanPrice.total * fencing.FENCE_PRICE_MULTIPLIER * 10000) / 10000);
  assert.equal(inventory.quantityOf(w, fence.id, 'Hammer'), 1);
});

test('an ordinary, non-stolen sale is completely unaffected', () => {
  const w = world();
  const seller = person(w);
  const buyer = person(w, { blackMarketTies: 50 });
  inventory.give(w, { entityId: seller.id, itemName: 'Hammer', quantity: 1 });

  const result = barter.exchange(w, { buyerId: buyer.id, sellerId: seller.id, itemName: 'Hammer' });
  assert.equal(result.settled, true);
});

// ---------------------------------------------------------------------
// fencing.sellToFence — the named convenience wrapper
// ---------------------------------------------------------------------

test('sellToFence refuses a buyer who is not a real fence', () => {
  const w = world();
  const thief = person(w);
  const notAFence = person(w, { blackMarketTies: 50 });
  inventory.give(w, { entityId: thief.id, itemName: 'Hammer', quantity: 1 });
  inventory.findHolding(w, thief.id, 'Hammer').stolen = true;

  const result = fencing.sellToFence(w, { sellerId: thief.id, fenceId: notAFence.id, itemName: 'Hammer' });
  assert.equal(result.settled, false);
});

test('sellToFence settles a real sale at the real discount when the buyer qualifies', () => {
  const w = world();
  const thief = person(w);
  const fence = person(w, { blackMarketTies: fencing.FENCE_BLACK_MARKET_TIES_FLOOR });
  inventory.give(w, { entityId: thief.id, itemName: 'Hammer', quantity: 1 });
  inventory.findHolding(w, thief.id, 'Hammer').stolen = true;

  const result = fencing.sellToFence(w, { sellerId: thief.id, fenceId: fence.id, itemName: 'Hammer' });
  assert.equal(result.settled, true);
  assert.equal(inventory.quantityOf(w, fence.id, 'Hammer'), 1);
});

// ---------------------------------------------------------------------
// Mutation check: a disabled stolen-goods gate would let a stolen
// holding sell to anybody at full price, which is the exact gap this
// closes.
// ---------------------------------------------------------------------

test('mutation check: the stolen-goods gate genuinely refuses, it is not decorative', () => {
  const w = world();
  const thief = person(w);
  const ordinaryBuyer = person(w, { blackMarketTies: 50 });
  const fence = person(w, { blackMarketTies: fencing.FENCE_BLACK_MARKET_TIES_FLOOR });
  inventory.give(w, { entityId: thief.id, itemName: 'Hammer', quantity: 1 });
  inventory.findHolding(w, thief.id, 'Hammer').stolen = true;

  const toOrdinary = barter.exchange(w, { buyerId: ordinaryBuyer.id, sellerId: thief.id, itemName: 'Hammer' });
  assert.equal(toOrdinary.settled, false);

  const toFence = barter.exchange(w, { buyerId: fence.id, sellerId: thief.id, itemName: 'Hammer' });
  assert.equal(toFence.settled, true, 'the identical stolen holding must settle once the buyer is a real fence');
});
