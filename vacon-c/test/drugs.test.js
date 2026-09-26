// Drug production, use and dependency — added 26 Sep 2026 alongside
// server/drugs.js. See that file's own header for what this closes:
// `criminal['Black Market Ties']` getting its first reader, and
// `psychological['Substance Dependency']` getting its only writer.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const drugs = require('../server/drugs.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');
const { getTraitId } = require('../server/traitDefinitions.js');

function world({ tick = 100 } = {}) {
  const w = {
    tick,
    npcs: [],
    entityTraits: [],
    inventory: [],
    barterItems: [],
    individualFinances: [],
    informalTransactions: [],
  };
  drugs.reseedIds(w);
  return w;
}

let nextId = 1;
function person(w, traits = {}, { savings = 0 } = {}) {
  const npc = { id: nextId++, status: 'active' };
  w.npcs.push(npc);
  economy.generateIndividualFinances(w, npc.id, { savings, tick: w.tick });
  for (const [family, values] of Object.entries(traits)) {
    for (const [name, value] of Object.entries(values)) {
      w.entityTraits.push({
        entity_id: npc.id,
        trait_id: getTraitId(family, name),
        base_value: value,
        temporary_modifier: 0,
        permanent_modifier: 0,
        experience_modifier: 0,
        environmental_modifier: 0,
        relationship_modifier: 0,
        key_modifier: 0,
        current_value: value,
      });
    }
  }
  return npc;
}

// ---------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------

test('the item exists from tick zero and registering twice adds nothing twice', () => {
  const w = world();
  assert.equal(drugs.registerItems(w), 1);
  assert.equal(drugs.registerItems(w), 0);
  assert.ok(w.barterItems.some((i) => i.name === drugs.NARCOTICS_ITEM));
});

// ---------------------------------------------------------------------
// Production — Black Market Ties' first reader
// ---------------------------------------------------------------------

test('an ordinary person with no black-market ties never produces anything', () => {
  const w = world();
  drugs.registerItems(w);
  const ordinary = person(w, { criminal: { 'Black Market Ties': 50 } });
  for (let t = 1; t <= 2000; t += 1) drugs.runProduction(w, t);
  assert.equal(inventory.quantityOf(w, ordinary.id, drugs.NARCOTICS_ITEM), 0);
});

test('somebody with deep black-market ties eventually produces', () => {
  const w = world();
  drugs.registerItems(w);
  const dealer = person(w, { criminal: { 'Black Market Ties': 100 } });
  for (let t = 1; t <= 2000; t += 1) drugs.runProduction(w, t);
  assert.ok(inventory.quantityOf(w, dealer.id, drugs.NARCOTICS_ITEM) > 0,
    'nobody at maximum Black Market Ties ever dealt in 2000 ticks');
});

test('the floor is a real gate, not a slope that starts at zero', () => {
  const w = world();
  const justBelow = person(w, { criminal: { 'Black Market Ties': drugs.PRODUCTION_TIES_FLOOR - 1 } });
  assert.equal(drugs.producesThisTick(w, justBelow.id, 1), false);
  for (let t = 1; t <= 5000; t += 1) {
    assert.equal(drugs.producesThisTick(w, justBelow.id, t), false);
  }
});

// ---------------------------------------------------------------------
// Use and dependency
// ---------------------------------------------------------------------

test('using what you hold raises Substance Dependency, and holding nothing does not', () => {
  const w = world();
  drugs.registerItems(w);
  const user = person(w, {
    psychological: { Impulsivity: 90, Compulsiveness: 90, 'Substance Dependency': 0 },
  });
  inventory.give(w, { entityId: user.id, itemName: drugs.NARCOTICS_ITEM, quantity: 50 });

  for (let t = 1; t <= 200; t += 1) drugs.runUseAndWithdrawal(w, t);
  assert.ok(drugs.dependencyOf(w, user.id) > 0, 'dependency never moved after 200 ticks of use');
  assert.ok(inventory.quantityOf(w, user.id, drugs.NARCOTICS_ITEM) < 50, 'nothing was ever used');
});

test('withdrawal only fires for somebody dependent AND empty-handed', () => {
  const w = world();
  drugs.registerItems(w);

  const dependentButStocked = person(w, {
    psychological: { 'Substance Dependency': drugs.WITHDRAWAL_DEPENDENCY_FLOOR + 10 },
  });
  inventory.give(w, { entityId: dependentButStocked.id, itemName: drugs.NARCOTICS_ITEM, quantity: 1 });

  const emptyButNotDependent = person(w, {
    psychological: { 'Substance Dependency': drugs.WITHDRAWAL_DEPENDENCY_FLOOR - 20 },
  });

  const dependentAndEmpty = person(w, {
    psychological: { 'Substance Dependency': drugs.WITHDRAWAL_DEPENDENCY_FLOOR + 10 },
  });

  const events = drugs.runUseAndWithdrawal(w, w.tick);
  const affected = events.filter((e) => e.type === 'withdrawal')
    .flatMap((e) => e.affected_entity_ids);
  assert.ok(!affected.includes(dependentButStocked.id), 'stocked but dependent still withdrew');
  assert.ok(!affected.includes(emptyButNotDependent.id), 'empty but not dependent still withdrew');
  assert.ok(affected.includes(dependentAndEmpty.id), 'dependent and empty-handed never withdrew');
});

test('describeDrugs counts holders and the dependent separately from each other', () => {
  const w = world();
  drugs.registerItems(w);
  const holderOnly = person(w, { psychological: { 'Substance Dependency': 10 } });
  inventory.give(w, { entityId: holderOnly.id, itemName: drugs.NARCOTICS_ITEM, quantity: 1 });
  person(w, { psychological: { 'Substance Dependency': drugs.WITHDRAWAL_DEPENDENCY_FLOOR + 5 } });

  const report = drugs.describeDrugs(w);
  assert.equal(report.holders, 1);
  assert.equal(report.dependent, 1);
});

// ---------------------------------------------------------------------
// Informal trade — statistics.js's informal_economy_share, closed
// ---------------------------------------------------------------------

test('a dealer only sells to someone who does not already hold any', () => {
  const w = world();
  drugs.registerItems(w);
  const dealer = person(w, { criminal: { 'Black Market Ties': 100 } });
  const stocked = person(w, {}, { savings: 1000 });
  inventory.give(w, { entityId: stocked.id, itemName: drugs.NARCOTICS_ITEM, quantity: 1 });
  inventory.give(w, { entityId: dealer.id, itemName: drugs.NARCOTICS_ITEM, quantity: 5 });

  const buyer = drugs.buyerFor(w, dealer.id, 1);
  assert.notEqual(buyer?.id, stocked.id, 'offered a sale to somebody already holding some');
});

test('a dealer never sells to someone who cannot afford it', () => {
  const w = world();
  const dealer = person(w, { criminal: { 'Black Market Ties': 100 } });
  person(w, {}, { savings: drugs.STREET_PRICE - 1 }); // one short
  const buyer = drugs.buyerFor(w, dealer.id, 1);
  assert.equal(buyer, null);
});

test('a sale moves the item and the cash, and records an informal transaction', () => {
  // tick 0, not the usual fixture default — `economy.generateIndividualFinances`
  // is append-only and picks the highest tick, so a person seeded at
  // tick 100 and then sold to on ticks 1..99 would have every sale's
  // result shadowed by the seed row for as long as the loop stayed
  // below it. See test/gambling.test.js for the same fix.
  const w = world({ tick: 0 });
  drugs.registerItems(w);
  const dealer = person(w, { criminal: { 'Black Market Ties': 100 } });
  const buyer = person(w, {}, { savings: 1000 });
  inventory.give(w, { entityId: dealer.id, itemName: drugs.NARCOTICS_ITEM, quantity: 5 });

  let sold = 0;
  for (let t = 1; t <= 2000 && sold === 0; t += 1) sold += drugs.runInformalTrade(w, t);
  assert.ok(sold > 0, 'no sale happened across 2000 ticks at maximum Black Market Ties');

  const transaction = w.informalTransactions[0];
  assert.equal(transaction.sellerId, dealer.id);
  assert.equal(transaction.buyerId, buyer.id);
  assert.equal(transaction.amount, drugs.STREET_PRICE);

  assert.equal(economy.getLatestFinances(w, dealer.id).savings, drugs.STREET_PRICE);
  assert.equal(economy.getLatestFinances(w, buyer.id).savings, 1000 - drugs.STREET_PRICE);
  assert.equal(inventory.quantityOf(w, buyer.id, drugs.NARCOTICS_ITEM), 1);
});

test('an ordinary person with no black-market ties never deals to anyone', () => {
  const w = world();
  drugs.registerItems(w);
  const holder = person(w, { criminal: { 'Black Market Ties': 50 } });
  person(w, {}, { savings: 1000 });
  inventory.give(w, { entityId: holder.id, itemName: drugs.NARCOTICS_ITEM, quantity: 5 });

  let sold = 0;
  for (let t = 1; t <= 2000; t += 1) sold += drugs.runInformalTrade(w, t);
  assert.equal(sold, 0);
  assert.equal(w.informalTransactions.length, 0);
});

test('informalValueIn sums only transactions touching the named ids, within the window', () => {
  const w = world();
  w.informalTransactions.push(
    { id: 1, sellerId: 10, buyerId: 20, amount: 20, tick: 95 },
    { id: 2, sellerId: 30, buyerId: 40, amount: 20, tick: 95 }, // neither id named
    { id: 3, sellerId: 10, buyerId: 50, amount: 20, tick: 1 }, // too old for the window
  );
  const value = drugs.informalValueIn(w, new Set([10, 20]), { sinceTick: 90, tick: 100 });
  assert.equal(value, 20);
});
