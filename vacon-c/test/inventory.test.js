// Who holds what — the table this schema never had.
//
// **Four systems had already run into its absence**, which is what
// cleared the deliberately high bar for a new table:
//
//   `crime.js` declared the `gun` category ungeneratable in its own
//   words — "no weapon exists anywhere in the schema ... so nothing
//   distinguishes an armed offence from an unarmed one".
//   `barter.js` could not make a trade conservative without something
//   to represent the goods.
//   A deprivation theft moved no object: the victim lost nothing.
//   And the growth loop had no item that could raise a trait.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const barter = require('../server/barter.js');
const crime = require('../server/crime.js');
const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const territory = require('../server/territory.js');
const engine = require('../server/engine.js');

let nextId = 600000;

function world({ tick = 10 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    communities: [],
    cities: [],
    entityTraits: [],
    memories: [],
    relationships: [],
    // **`recordCrime` writes a fact about the offender now.** A
    // robbery victim learns something about whoever robbed them, which
    // is what opens `resolveTrust`'s gate — see crime.js. A fixture
    // that records a crime needs somewhere for that to go.
    entityKnowledge: [],
    historicalRecords: [],
    individualFinances: [],
    employmentRecords: [],
    crimeIncidents: [],
    inventory: [],
    resources: [],
    marketListings: [],
  };
  economy.reseedIds(worldState);
  crime.reseedIds(worldState);
  territory.reseedIds(worldState);
  inventory.reseedIds(worldState);
  return worldState;
}

function person(worldState, { communityId = null, savings = 1000 } = {}) {
  const npc = {
    id: nextId++, status: 'active', communityId, home_property_id: null, traits: {},
    createdTick: 0, updatedTick: 0,
  };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings, tick: worldState.tick });
  return npc;
}

// -- holding ------------------------------------------------------------

test('an item has to be one the catalogue knows', () => {
  // There is exactly one place an item can be defined — items.js,
  // which holds §27's seventeen sourced values plus whatever a world
  // adds. An inventory that accepted any string would be a second
  // catalogue, and the two would drift.
  const w = world();
  const a = person(w);
  assert.throws(() => inventory.give(w, { entityId: a.id, itemName: 'Plasma Rifle' }),
    /not a known item/);
  assert.throws(() => inventory.give(w, { entityId: 999999, itemName: 'Hammer' }),
    /not among the living/);
  assert.throws(() => inventory.give(w, { entityId: a.id, itemName: 'Hammer', quantity: 0 }),
    /positive number/);
});

test('identical holdings stack, and different conditions do not', () => {
  // "three hammers" and "one hammer three times" are the same fact, so
  // two rows would make every count depend on how they were acquired.
  // A hammer at 20 and one at 100 are genuinely different things to be
  // holding.
  const w = world();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Hammer' });
  inventory.give(w, { entityId: a.id, itemName: 'Hammer', quantity: 2 });
  assert.equal(inventory.holdingsOf(w, a.id).length, 1);
  assert.equal(inventory.quantityOf(w, a.id, 'Hammer'), 3);

  inventory.give(w, { entityId: a.id, itemName: 'Hammer', condition: 20 });
  assert.equal(inventory.holdingsOf(w, a.id).length, 2);
  assert.equal(inventory.quantityOf(w, a.id, 'Hammer'), 4);
});

test('taking more than is held takes what there is and says how short', () => {
  // **Refuses to go negative.** A negative holding is the inventory
  // equivalent of the negative savings `barter.exchange` had to be
  // stopped from creating, and it would make every count downstream
  // wrong without throwing.
  const w = world();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Saw', quantity: 2 });

  const result = inventory.take(w, { entityId: a.id, itemName: 'Saw', quantity: 5 });
  assert.equal(result.quantity, 2);
  assert.equal(result.short, 3);
  assert.equal(inventory.quantityOf(w, a.id, 'Saw'), 0);
  // And the emptied row is gone rather than sitting at zero.
  assert.equal(inventory.holdingsOf(w, a.id).length, 0);
});

test('the worn and unequipped go first', () => {
  // Somebody handing over a hammer hands over the worn one, and what
  // they have about them is the last to go.
  const w = world();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Hammer', condition: 100 });
  inventory.give(w, { entityId: a.id, itemName: 'Hammer', condition: 30 });

  const result = inventory.take(w, { entityId: a.id, itemName: 'Hammer', quantity: 1 });
  assert.equal(result.taken[0].condition, 30);
  assert.equal(inventory.holdingsOf(w, a.id)[0].condition, 100);
});

test('a transfer preserves condition and refuses what is not there', () => {
  const w = world();
  const a = person(w);
  const b = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Gravel', quantity: 3, condition: 40 });

  const short = inventory.transfer(w, {
    fromId: a.id, toId: b.id, itemName: 'Gravel', quantity: 10,
  });
  assert.equal(short.moved, 0);
  assert.equal(short.short, 7);
  assert.equal(inventory.quantityOf(w, a.id, 'Gravel'), 3, 'a refused transfer moved something');

  const done = inventory.transfer(w, { fromId: a.id, toId: b.id, itemName: 'Gravel', quantity: 2 });
  assert.equal(done.moved, 2);
  assert.equal(inventory.quantityOf(w, a.id, 'Gravel'), 1);
  assert.equal(inventory.findHolding(w, b.id, 'Gravel').condition, 40);

  assert.throws(() => inventory.transfer(w, { fromId: a.id, toId: a.id, itemName: 'Gravel' }),
    /cannot transfer to itself/);
});

// -- worth --------------------------------------------------------------

test('what somebody holds is priced live, never stored', () => {
  // **Standing rule 3, and standing rule 9 in a new place.** A `value`
  // column on a holding would be the price on the day it was picked
  // up, forever — and an item's worth is its base value against local
  // scarcity and population, all of which move.
  const w = world();
  const city = territory.generateCity(w, { name: 'Market' });
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Ruby', quantity: 2 });

  assert.equal(barter.valueOfHoldings(w, a.id, { cityId: city.id }), 300);

  // A shortage of gems raises what the same two rubies are worth, with
  // nothing about the holding having changed.
  economy.generateResource(w, { cityId: city.id, resourceType: 'gems', supply: 10, demand: 200 });
  assert.ok(barter.valueOfHoldings(w, a.id, { cityId: city.id }) > 300);

  for (const holding of inventory.holdingsOf(w, a.id)) {
    assert.equal('value' in holding, false, 'a holding is carrying a stored price');
  }
});

test('a worn item is worth proportionally less', () => {
  const w = world();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Emerald', condition: 50 });
  assert.equal(barter.valueOfHoldings(w, a.id), 75);
});

// -- equipment ----------------------------------------------------------

test('equipping splits a stack rather than lying about the rest', () => {
  // A boolean on a stack of three would claim all three are about the
  // person.
  const w = world();
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Hammer', quantity: 3 });

  const equipped = inventory.equip(w, { entityId: a.id, itemName: 'Hammer' });
  assert.equal(equipped.quantity, 1);
  assert.equal(equipped.equipped, true);
  assert.equal(inventory.quantityOf(w, a.id, 'Hammer'), 3, 'equipping consumed an item');
  assert.equal(inventory.equippedItems(w, a.id).length, 1);

  assert.throws(() => inventory.equip(w, { entityId: a.id, itemName: 'Saw' }), /holds no "Saw"/);
});

test('a category can be asked about, which is what an armed offence needs', () => {
  const w = world();
  w.barterItems = [{ name: 'Hunting Rifle', category: 'protection', baseValue: 300 }];
  const a = person(w);
  inventory.give(w, { entityId: a.id, itemName: 'Hunting Rifle' });

  assert.equal(inventory.hasEquippedCategory(w, a.id, 'protection'), false,
    'an item in store is not an item about somebody');
  inventory.equip(w, { entityId: a.id, itemName: 'Hunting Rifle' });
  assert.equal(inventory.hasEquippedCategory(w, a.id, 'protection'), true);
  assert.equal(inventory.hasEquippedCategory(w, a.id, 'tools'), false);
});

// -- what it unblocks ---------------------------------------------------

test('an armed escalation is a gun crime, which was declared impossible', () => {
  // `crime.CATEGORIES.gun` said "no weapon exists anywhere in the
  // schema — no item, inventory or equipment table — so nothing
  // distinguishes an armed offence from an unarmed one". That was
  // exactly true and is exactly what changed.
  const w = world();
  w.barterItems = [{ name: 'Hunting Rifle', category: 'protection', baseValue: 300 }];
  const c = territory.generateCommunity(w, {});
  const armed = person(w, { communityId: c.id });
  const unarmed = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });

  assert.equal(
    crime.recordEscalation(w, { perpetratorId: unarmed.id, victimId: victim.id }).category,
    'violent',
  );

  inventory.give(w, { entityId: armed.id, itemName: 'Hunting Rifle' });
  inventory.equip(w, { entityId: armed.id, itemName: 'Hunting Rifle' });
  assert.equal(
    crime.recordEscalation(w, { perpetratorId: armed.id, victimId: victim.id }).category,
    'gun',
  );
  assert.equal(crime.CATEGORIES.gun.generated, true);
});

test('an armed offence inside a family is still recorded as armed', () => {
  // `gun` takes precedence over `domestic` because it is the more
  // specific fact: a §9 crime report that recorded an armed assault as
  // a plain one would lose the thing the category exists to count.
  const w = world();
  w.barterItems = [{ name: 'Hunting Rifle', category: 'protection', baseValue: 300 }];
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  const b = person(w, { communityId: c.id });
  w.families.push({ id: 1, surname: 'Vance' });
  w.familyMemberships.push({ entity_id: a.id, family_id: 1, role: 'parent' });
  w.familyMemberships.push({ entity_id: b.id, family_id: 1, role: 'partner' });

  inventory.give(w, { entityId: a.id, itemName: 'Hunting Rifle' });
  inventory.equip(w, { entityId: a.id, itemName: 'Hunting Rifle' });
  assert.equal(
    crime.recordEscalation(w, { perpetratorId: a.id, victimId: b.id }).category, 'gun',
  );
});

test('a theft takes the least valuable thing, and not what is equipped', () => {
  // Somebody stealing out of deprivation takes what they can carry;
  // taking the best item would make every theft a heist. And a thief
  // does not take the coat off somebody's back.
  const w = world({ tick: 1 });
  const c = territory.generateCommunity(w, {});
  const thief = person(w, { communityId: c.id, savings: 0 });
  const victim = person(w, { communityId: c.id, savings: 1000 });
  for (let i = 0; i < 30; i += 1) person(w, { communityId: c.id, savings: 0 });

  inventory.give(w, { entityId: victim.id, itemName: 'Diamond' });
  inventory.give(w, { entityId: victim.id, itemName: 'Sand' });
  inventory.give(w, { entityId: victim.id, itemName: 'Gold Bar' });
  inventory.equip(w, { entityId: victim.id, itemName: 'Gold Bar' });

  for (let t = 1; t <= 600; t += 1) crime.runDeprivationCrime(w, t);

  const thefts = crime.incidentsIn(w, c.id).filter((i) => i.category === 'theft');
  assert.ok(thefts.length > 0, 'no theft occurred in 600 ticks of total deprivation');
  assert.ok(inventory.quantityOf(w, victim.id, 'Gold Bar') === 1,
    'a thief took the equipped item');
  assert.ok(thefts.some((i) => /took a Sand/.test(i.detail)),
    'the theft did not move an object, or took the wrong one');
});

test('a trade moves the object, not only the value', () => {
  // The half `barter.exchange` could not do. Together they make a
  // trade conservative on both sides.
  const w = world();
  const seller = person(w, { savings: 0 });
  const buyer = person(w, { savings: 5000 });
  inventory.give(w, { entityId: seller.id, itemName: 'Sapphire', quantity: 2 });

  const result = barter.exchange(w, {
    buyerId: buyer.id, sellerId: seller.id, itemName: 'Sapphire', tick: 11,
  });
  assert.equal(result.settled, true);
  assert.equal(result.moved.moved, 1);
  assert.equal(inventory.quantityOf(w, seller.id, 'Sapphire'), 1);
  assert.equal(inventory.quantityOf(w, buyer.id, 'Sapphire'), 1);
  // The seller's assets are untouched — the object moved, so taking
  // the value off them too would charge them twice.
  assert.equal(economy.getLatestFinances(w, seller.id).assets, 0);
});

test('a seller who does not hold it does not sell it', () => {
  const w = world();
  const seller = person(w, { savings: 0 });
  const buyer = person(w, { savings: 5000 });
  inventory.give(w, { entityId: seller.id, itemName: 'Sapphire', quantity: 1 });

  const result = barter.exchange(w, {
    buyerId: buyer.id, sellerId: seller.id, itemName: 'Sapphire', quantity: 3, tick: 11,
  });
  assert.equal(result.settled, false);
  assert.match(result.reason, /holds 1 of 3/);
  assert.equal(inventory.quantityOf(w, buyer.id, 'Sapphire'), 0);
});

test('the WorldState the engine ships carries an inventory', () => {
  // Standing rule 6: a module writing to an array the real WorldState
  // does not declare writes to `undefined`.
  assert.ok(Array.isArray(engine.WorldState.inventory));
});

test('ids survive a reseed', () => {
  const w = world();
  w.inventory.push({ id: 17, holder_entity_id: 1, item_name: 'Sand', quantity: 1 });
  assert.deepEqual(inventory.reseedIds(w), { nextHoldingId: 18 });
  const a = person(w);
  assert.equal(inventory.give(w, { entityId: a.id, itemName: 'Saw' }).id, 18);
});
