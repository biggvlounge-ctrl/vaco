// The barter economy — §26, §27, §28.
//
// **What was there before, measured.** The spec is unusually specific
// about this system and almost none of it was represented: twenty
// trade categories (§26) existed nowhere; §27's seven-field barter key
// and its seventeen example values existed nowhere; §28's thirteen
// resource types existed nowhere, and in their place were two ad-hoc
// lists — `mortality.SURVIVAL_RESOURCES` (three) and a literal inside
// `worldgen` (five) — which matched neither the spec nor each other.
//
// And **nothing ever transacted.** `market_listings` resolved a price
// every tick and no value ever moved between two entities. Payroll was
// the only movement of value in the whole simulation.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const barter = require('../server/barter.js');
const economy = require('../server/economy.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

const SPEC = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_CONSOLIDATED_MASTER_SPEC.md'), 'utf8',
);

let nextId = 500000;

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
  };
  economy.reseedIds(worldState);
  return worldState;
}

function trader(worldState, { savings = 5000, barterSkill = 50 } = {}) {
  const id = nextId++;
  const rows = generateEntityTraits(id, worldState.tick, INDIVIDUAL_DEFINITIONS, () => 50);
  for (const row of rows) {
    const def = INDIVIDUAL_DEFINITIONS.find((d) => d.trait_id === row.trait_id);
    if (def && def.family === 'economic' && def.name === 'Barter Skill') {
      row.current_value = barterSkill;
    }
  }
  worldState.entityTraits.push(...rows);
  worldState.npcs.push({ id, status: 'active', traits: {}, createdTick: 0, updatedTick: 0 });
  economy.generateIndividualFinances(worldState, id, { savings, tick: worldState.tick });
  return worldState.npcs[worldState.npcs.length - 1];
}

// -- the enumerations, checked against the spec rather than memory ------

test('the trade categories are §26\'s twenty, verbatim and in order', () => {
  // **Parsed out of the spec file itself**, so this cannot drift from
  // the source the way a hand-copied list would. The same check caught
  // a real error while this was being written: the header claimed §28
  // names fourteen resource types and it names thirteen.
  const fromSpec = SPEC.match(/Trade categories: ([^.]+)\./)[1]
    .split(',').map((s) => s.trim().replace(/\s+/g, ' '));
  assert.equal(fromSpec.length, 20);
  assert.deepEqual(barter.TRADE_CATEGORIES, fromSpec);
});

test('the resource types are §28\'s thirteen, verbatim and in order', () => {
  const fromSpec = SPEC.match(/Resources include ([^.]+)\./)[1]
    .split(',').map((s) => s.trim().replace(/\s+/g, ' '));
  assert.equal(fromSpec.length, 13);
  assert.deepEqual(barter.RESOURCE_TYPES, fromSpec);
});

test('the barter key carries §27\'s seven fields, and a score reports all of them', () => {
  // §27 says an item CONTAINS those fields. A caller handed only the
  // final number cannot show why an item is dear here and cheap there,
  // which is the question a barter economy exists to answer.
  assert.deepEqual(barter.BARTER_KEY_FIELDS, [
    'Item_Name', 'Section_Category', 'Base_Value', 'Rarity',
    'Environment_Modifier', 'Population_Modifier', 'Final_Barter_Score',
  ]);
  const key = barter.barterScore(world(), 'Diamond');
  for (const field of barter.BARTER_KEY_FIELDS) {
    assert.ok(field in key, `a barter score is missing §27's ${field}`);
  }
});

test('exactly the seventeen sourced values, none invented, each matching the spec table', () => {
  // **The line this module must not blur.** The spec's own intake note
  // says the 17 are real and the 3,750 are a target, and that anyone
  // implementing "must not generate those enumerations and then cite
  // them as recovered source". So every base value is checked against
  // the spec's own table row.
  assert.equal(barter.SOURCED_ITEMS.length, 17);
  for (const item of barter.SOURCED_ITEMS) {
    const row = new RegExp(`\\|\\s*${item.name}\\s*\\|\\s*(\\d+)\\s*\\|`).exec(SPEC);
    assert.ok(row, `"${item.name}" is not in §27's table — it was invented`);
    assert.equal(item.baseValue, Number(row[1]),
      `"${item.name}" has base value ${item.baseValue}, the spec says ${row[1]}`);
  }

  // And every category assigned to them is one of §26's twenty. That
  // assignment is the one interpretive act in the table — the spec
  // gives values without categories — so it is checked rather than
  // trusted.
  for (const item of barter.SOURCED_ITEMS) {
    assert.ok(barter.TRADE_CATEGORIES.includes(item.category),
      `"${item.name}" is categorised "${item.category}", which §26 does not list`);
  }
});

test('a world can add items, and a sourced one is still marked as sourced', () => {
  // Same precedent flows.js set: definitions are data, a world extends
  // them with no code change, and what the package specified stays
  // distinguishable from what somebody added later.
  const w = world();
  w.barterItems = [{ name: 'Salt Block', category: 'food', baseValue: 12 }];

  const items = barter.itemsFor(w);
  assert.equal(items.length, 18);
  assert.equal(barter.findItem(w, 'Salt Block').sourced, false);
  assert.equal(barter.findItem(w, 'Diamond').sourced, true);
  assert.equal(barter.barterScore(w, 'Salt Block').Final_Barter_Score, 12);

  // A world can override a sourced item, and it stops claiming to be
  // sourced when it does.
  w.barterItems.push({ name: 'Diamond', category: 'gems', baseValue: 999 });
  assert.equal(barter.findItem(w, 'Diamond').sourced, false);
});

test('an unknown item is refused rather than priced at zero', () => {
  assert.throws(() => barter.barterScore(world(), 'Flux Capacitor'),
    /no barter item "Flux Capacitor"/);
});

// -- the modifiers ------------------------------------------------------

test('local scarcity makes a thing dearer, and glut makes it cheaper', () => {
  function scoreWith(supply, demand) {
    const w = world();
    const city = { id: 1, name: 'Market' };
    w.cities.push(city);
    economy.generateResource(w, { cityId: city.id, resourceType: 'metals', supply, demand });
    return barter.barterScore(w, 'Gold Ingot', { cityId: city.id }).Final_Barter_Score;
  }
  const balanced = scoreWith(100, 100);
  const scarce = scoreWith(10, 200);
  const glut = scoreWith(200, 10);

  assert.equal(balanced, 100, 'balanced supply and demand should leave the base value alone');
  assert.ok(scarce > balanced, 'a shortage of metals did not raise the price of a gold ingot');
  assert.ok(glut < balanced);
});

test('an item whose category is not a tracked resource has no input pressure', () => {
  // "no input to be scarce" has to read as 1, not 0 — otherwise every
  // luxury good in the world is free.
  const w = world();
  w.cities.push({ id: 1, name: 'Market' });
  const key = barter.barterScore(w, 'Rare Musical Instrument', { cityId: 1 });
  assert.equal(key.Environment_Modifier, 1);
  assert.equal(key.Final_Barter_Score, 2000);
});

test('a city nobody lives in has an unknown population modifier, not an average one', () => {
  // The distinction this project has had to make in every module: an
  // unpopulated market is not a market of average size.
  const w = world();
  w.cities.push({ id: 1, name: 'Empty' });
  assert.equal(barter.populationModifier(w, 1), null);

  const key = barter.barterScore(w, 'Hammer', { cityId: 1 });
  assert.equal(key.Population_Modifier, null);
  // And an unknown modifier must not zero the score.
  assert.equal(key.Final_Barter_Score, 8);
});

test('a thin market pays more than a crowded one', () => {
  function scoreWith(people) {
    const w = world();
    w.cities.push({ id: 1, name: 'Market' });
    w.communities.push({ id: 1, city_id: 1 });
    for (let i = 0; i < people; i += 1) {
      w.npcs.push({ id: nextId++, status: 'active', communityId: 1 });
    }
    return barter.barterScore(w, 'Saw', { cityId: 1 }).Final_Barter_Score;
  }
  assert.ok(scoreWith(20) > scoreWith(2000));
});

test('the modifiers §27 names that this engine cannot compute are declared', () => {
  // §27 lists seven influences. Three have no substrate, and naming
  // them beats folding a plausible constant into the score and calling
  // it complete.
  assert.deepEqual(Object.keys(barter.MODIFIERS_NOT_MODELLED).sort(),
    ['climate', 'regionalDemand', 'transportDifficulty']);
  for (const [key, reason] of Object.entries(barter.MODIFIERS_NOT_MODELLED)) {
    assert.ok(reason.length > 60, `${key} has no real explanation`);
  }
});

// -- Barter Skill, which had no reader ----------------------------------

test('the better barterer moves the price in their own favour', () => {
  // `Barter Skill` is one of the 114 individual traits and was read by
  // nothing — which followed, because nothing could be bartered. This
  // is what makes the system a barter rather than a price list.
  const w = world();
  const sharp = trader(w, { barterSkill: 100 });
  const dull = trader(w, { barterSkill: 0 });
  const even = trader(w, { barterSkill: 50 });

  const sellerSharp = barter.agreedPrice(w, 'Ruby', { sellerId: sharp.id, buyerId: dull.id });
  const buyerSharp = barter.agreedPrice(w, 'Ruby', { sellerId: dull.id, buyerId: sharp.id });
  const level = barter.agreedPrice(w, 'Ruby', { sellerId: even.id, buyerId: even.id });

  assert.equal(level.unitPrice, 150, 'two equal barterers should agree the base score');
  assert.ok(sellerSharp.unitPrice > level.unitPrice, 'a sharp seller got no better price');
  assert.ok(buyerSharp.unitPrice < level.unitPrice, 'a sharp buyer paid over the odds');
  assert.equal(sellerSharp.sellerEdge, 1);
  assert.equal(buyerSharp.sellerEdge, -1);
});

test('a Barter Skill of 0 is a real 0, not an unrecorded average', () => {
  // `?? 50` rather than `|| 50` — somebody with no haggling ability at
  // all would otherwise be quietly upgraded to average.
  const w = world();
  const none = trader(w, { barterSkill: 0 });
  const average = trader(w, { barterSkill: 50 });
  const deal = barter.agreedPrice(w, 'Emerald', { sellerId: none.id, buyerId: average.id });
  assert.ok(deal.unitPrice < 150);
});

// -- the transaction ----------------------------------------------------

test('value actually changes hands, which it never did before', () => {
  const w = world();
  const buyer = trader(w, { savings: 1000 });
  const seller = trader(w, { savings: 100 });
  // The seller has to actually hold the thing — `assets` stands in for
  // inventory, because no item table exists anywhere in the schema.
  economy.generateIndividualFinances(w, seller.id, { savings: 100, assets: 500, tick: 10 });

  const before = {
    buyer: economy.getNetWorth(w, buyer.id),
    seller: economy.getNetWorth(w, seller.id),
  };
  const result = barter.exchange(w, {
    buyerId: buyer.id, sellerId: seller.id, itemName: 'Amethyst', tick: 11,
  });

  assert.equal(result.settled, true);
  assert.equal(result.deal.total, 60);
  assert.equal(economy.getLatestFinances(w, buyer.id).savings, 940);
  assert.equal(economy.getLatestFinances(w, seller.id).savings, 160);
  // The buyer traded money for a thing of equal worth, so their net
  // position is unchanged; the seller gave up the thing.
  assert.equal(economy.getNetWorth(w, buyer.id), before.buyer);
  assert.equal(economy.getNetWorth(w, seller.id), before.seller);
});

test('a buyer who cannot pay does not buy, and is not put into debt', () => {
  // **Affordability is savings, not net worth**, and the first version
  // checked net worth. Somebody whose wealth is entirely a house
  // cannot hand over 2,000 for a musical instrument — and letting them
  // would drive savings negative, which is a debt nobody agreed to in
  // a column that exists so lending is explicit.
  const w = world();
  const buyer = trader(w, { savings: 10 });
  const seller = trader(w, { savings: 10 });
  // Rich on paper, no cash.
  economy.generateIndividualFinances(w, buyer.id, { savings: 10, assets: 500000, tick: 11 });

  const result = barter.exchange(w, {
    buyerId: buyer.id, sellerId: seller.id, itemName: 'Rare Musical Instrument', tick: 12,
  });
  assert.equal(result.settled, false);
  assert.match(result.reason, /cannot cover/);
  assert.equal(economy.getLatestFinances(w, buyer.id).savings, 10, 'savings moved on a refused trade');
  assert.ok(economy.getLatestFinances(w, buyer.id).debt === 0);
});

test('a trade leaves the earlier position in the history rather than editing it', () => {
  // `individual_finances` is keyed (entity_id, tick) and is a history
  // of somebody's position. Editing in place would erase what they
  // were worth before the trade.
  const w = world();
  const buyer = trader(w, { savings: 1000 });
  const seller = trader(w, { savings: 0 });
  economy.generateIndividualFinances(w, seller.id, { savings: 0, assets: 500, tick: 10 });
  const rowsBefore = w.individualFinances.filter((r) => r.entity_id === buyer.id).length;

  barter.exchange(w, { buyerId: buyer.id, sellerId: seller.id, itemName: 'Saw', tick: 12 });
  const rows = w.individualFinances.filter((r) => r.entity_id === buyer.id);
  assert.equal(rows.length, rowsBefore + 1);
  assert.equal(rows[0].savings, 1000, 'the earlier row was overwritten');
});

test('trading with yourself, or for nothing, is refused', () => {
  const w = world();
  const a = trader(w);
  const b = trader(w);
  assert.throws(() => barter.exchange(w, {
    buyerId: a.id, sellerId: a.id, itemName: 'Sand',
  }), /cannot trade with itself/);
  assert.throws(() => barter.exchange(w, {
    buyerId: a.id, sellerId: b.id, itemName: 'Sand', quantity: 0,
  }), /positive number/);
  assert.throws(() => barter.exchange(w, {
    buyerId: a.id, sellerId: 999999, itemName: 'Sand',
  }), /seller 999999 is not among the living/);
});

test('quantity multiplies the total and not the unit price', () => {
  const w = world();
  const buyer = trader(w, { savings: 100000 });
  const seller = trader(w, { savings: 0 });
  economy.generateIndividualFinances(w, seller.id, { savings: 0, assets: 500, tick: 10 });
  const result = barter.exchange(w, {
    buyerId: buyer.id, sellerId: seller.id, itemName: 'Gravel', quantity: 12, tick: 12,
  });
  assert.equal(result.deal.unitPrice, 7);
  assert.equal(result.deal.total, 84);
  assert.equal(economy.getLatestFinances(w, seller.id).savings, 84);
});

test('every resource a generated world creates is a §28 resource type', () => {
  // **There were three vocabularies and no canon.**
  // `mortality.SURVIVAL_RESOURCES` had three, `worldgen` had a literal
  // five, and the schema comment on `resources.resource_type` lists a
  // fourth set — none of which matched §28's thirteen. `timber` was
  // being generated in every world and is not a §28 type at all; the
  // spec says `wood`.
  const engine = require('../server/engine.js');
  const worldgen = require('../server/worldgen.js');
  const mortality = require('../server/mortality.js');

  const before = engine.WorldState.resources.length;
  worldgen.generateWorld({ communitiesPerCity: 1, populationPerCommunity: 5, seed: 'canon' });
  const fresh = engine.WorldState.resources.slice(before);
  assert.ok(fresh.length > 0);

  for (const resource of fresh) {
    assert.ok(barter.RESOURCE_TYPES.includes(resource.resource_type),
      `a generated world created "${resource.resource_type}", which §28 does not list`);
  }

  // And the survival essentials are a subset of the same list rather
  // than a second vocabulary.
  for (const essential of mortality.SURVIVAL_RESOURCES) {
    assert.ok(barter.RESOURCE_TYPES.includes(essential),
      `mortality treats "${essential}" as essential and §28 does not list it`);
  }
});
