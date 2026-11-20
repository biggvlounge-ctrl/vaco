// Penitentiary inventory list (inmate-made weapons, commissary, etc.)
// — by direct instruction. Read `server/penitentiary.js`'s own header
// first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const penitentiary = require('../server/penitentiary.js');
const salvage = require('../server/salvage.js');
const justice = require('../server/justice.js');
const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const engine = require('../server/engine.js');

const YEAR = 365;
const SKILL_DEFINITIONS = engine.TRAIT_DEFINITIONS.filter((d) => d.family === 'skills');

let nextId = 990000;

function world() {
  const w = {
    tick: 10000,
    seed: 'penitentiary-test',
    npcs: [],
    deceased: [],
    properties: [],
    organizations: [],
    employmentRecords: [],
    entityTraits: [],
    individualFinances: [],
    inventory: [],
    barterItems: [],
    courtCases: [],
    communities: [{ id: 1, city_id: 1 }],
    families: [],
    familyMemberships: [],
    relationships: [],
  };
  economy.reseedIds(w);
  return w;
}

// Same real skill-fixture shape `test/salvage.test.js#person` already
// uses for its own blade-crafting tests -- a NAMED skill level and a
// NAMED education, never left to a draw.
function person(w, options = {}) {
  const {
    id = nextId++, skill = 90, education = 'secondary', age = 30, status = 'active',
  } = options;
  w.npcs.push({
    id, status, education,
    createdTick: w.tick - age * YEAR,
    birth_tick: w.tick - age * YEAR,
    traits: {},
  });
  for (const name of ['Crafting', 'Construction', 'Medicine']) {
    const definition = SKILL_DEFINITIONS.find((d) => d.name === name);
    w.entityTraits.push({
      entity_id: id,
      trait_id: definition.trait_id,
      base_value: skill,
      current_value: skill,
      key_modifier: 0,
      temporary_modifier: 0,
      permanent_modifier: 0,
      experience_modifier: 0,
      environmental_modifier: 0,
      relationship_modifier: 0,
    });
  }
  return w.npcs[w.npcs.length - 1];
}

function organization(w, { assets = 1000 } = {}) {
  const id = nextId++;
  const org = { id, name: `Org ${id}`, type: 'government', leader_id: null, assets };
  w.organizations.push(org);
  return org;
}

function prison(w, { operatingOrganizationId = null } = {}) {
  const id = nextId++;
  const property = {
    id, name: `Prison ${id}`, landmark_category: 'prison', community_id: 1,
    operating_organization_id: operatingOrganizationId, condition: 100,
  };
  w.properties.push(property);
  return property;
}

// A real inmate: `justice.inmatesOf` reads a real, open conviction at
// this real prison, never the bare `status === 'imprisoned'` flag
// alone.
function inmate(w, prisonProperty, options = {}) {
  const npc = person(w, { ...options, status: 'imprisoned' });
  w.courtCases.push({
    id: nextId++, defendant_entity_id: npc.id, status: 'convicted', released_tick: null,
    prison_property_id: prisonProperty.id,
  });
  return npc;
}

// ---------------------------------------------------------------------
// registerCommissaryItems
// ---------------------------------------------------------------------

test('registerCommissaryItems adds every real catalogue item to barterItems exactly once', () => {
  const w = world();
  const added = penitentiary.registerCommissaryItems(w);
  assert.equal(added, penitentiary.COMMISSARY_ITEM_NAMES.length);
  const added2 = penitentiary.registerCommissaryItems(w);
  assert.equal(added2, 0, 'a second call must not add duplicate rows');
  assert.equal(w.barterItems.length, penitentiary.COMMISSARY_ITEM_NAMES.length);
});

// ---------------------------------------------------------------------
// affordableItemsFor
// ---------------------------------------------------------------------

test('affordableItemsFor only returns items at or under the real price', () => {
  const cheapest = Math.min(...Object.values(penitentiary.COMMISSARY_CATALOG).map((d) => d.price));
  assert.deepEqual(penitentiary.affordableItemsFor(0), []);
  assert.ok(penitentiary.affordableItemsFor(cheapest).length >= 1);
  assert.equal(
    penitentiary.affordableItemsFor(100000).length,
    penitentiary.COMMISSARY_ITEM_NAMES.length,
    'a wealthy inmate can afford everything in the real catalogue',
  );
});

// ---------------------------------------------------------------------
// runCommissaryPurchases
// ---------------------------------------------------------------------

test('a real inmate with real savings eventually makes a real commissary purchase, paid from their own savings', () => {
  const w = world();
  const operator = organization(w, { assets: 1000 });
  const facility = prison(w, { operatingOrganizationId: operator.id });
  const npc = inmate(w, facility);
  economy.generateIndividualFinances(w, npc.id, { savings: 100, tick: w.tick });

  let purchase = null;
  for (let t = w.tick; t < w.tick + 12000 && !purchase; t += 1) {
    const purchases = penitentiary.runCommissaryPurchases(w, t);
    if (purchases.length > 0) [purchase] = purchases;
  }
  assert.ok(purchase, 'a real, funded inmate never once made a commissary purchase in 12000 ticks');
  assert.equal(purchase.inmateId, npc.id);
  assert.equal(purchase.prisonPropertyId, facility.id);

  const finances = economy.getLatestFinances(w, npc.id);
  assert.ok(Number(finances.savings) < 100, 'the inmate\'s own real savings must have actually dropped');
  assert.equal(inventory.quantityOf(w, npc.id, purchase.itemName), 1);
});

test('the real price paid lands in the prison\'s own real operating organization\'s assets', () => {
  const w = world();
  const operator = organization(w, { assets: 1000 });
  const facility = prison(w, { operatingOrganizationId: operator.id });
  const npc = inmate(w, facility);
  economy.generateIndividualFinances(w, npc.id, { savings: 100, tick: w.tick });

  let purchase = null;
  for (let t = w.tick; t < w.tick + 12000 && !purchase; t += 1) {
    const purchases = penitentiary.runCommissaryPurchases(w, t);
    if (purchases.length > 0) [purchase] = purchases;
  }
  assert.ok(purchase);
  assert.equal(Number(operator.assets), 1000 + purchase.price);
});

test('an inmate with no real savings is never drawn from, however many ticks pass', () => {
  const w = world();
  const operator = organization(w);
  const facility = prison(w, { operatingOrganizationId: operator.id });
  const npc = inmate(w, facility);
  economy.generateIndividualFinances(w, npc.id, { savings: 0, tick: w.tick });

  for (let t = w.tick; t < w.tick + 2000; t += 1) {
    assert.equal(penitentiary.runCommissaryPurchases(w, t).length, 0);
  }
});

test('a free person (not a real inmate) at the exact same prison property is never drawn from', () => {
  const w = world();
  const operator = organization(w);
  const facility = prison(w, { operatingOrganizationId: operator.id });
  const free = person(w, { status: 'active' });
  economy.generateIndividualFinances(w, free.id, { savings: 1000, tick: w.tick });

  for (let t = w.tick; t < w.tick + 2000; t += 1) {
    assert.equal(penitentiary.runCommissaryPurchases(w, t).length, 0);
  }
});

// ---------------------------------------------------------------------
// The real inmate-made-weapon chain: melt down something plastic (a
// toothbrush's own real material) and sharpen it, through the one
// real crafting mechanism this engine has. See `salvage.js
// #RECIPES.shank`'s own comment for why the ingredient is `plastic`
// and not this file's own purchased `toothbrush` item directly.
// ---------------------------------------------------------------------

test('shank is a real Tier 1 product craftable from real plastic, through salvage.make', () => {
  const w = world();
  const npc = person(w);
  salvage.registerItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'plastic', quantity: 1, tick: w.tick });

  const check = salvage.canMake(w, npc.id, 'shank');
  assert.equal(check.ok, true, JSON.stringify(check));
  const made = salvage.make(w, npc.id, 'shank');
  assert.equal(made.product, 'shank');
  assert.equal(inventory.quantityOf(w, npc.id, 'plastic'), 0, 'the plastic must be consumed');
  assert.equal(inventory.quantityOf(w, npc.id, 'shank'), 1);
});

test('shank cannot be made without real plastic in hand', () => {
  const w = world();
  const npc = person(w);
  const check = salvage.canMake(w, npc.id, 'shank');
  assert.equal(check.ok, false);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: affordableItemsFor\'s real price filter is what blocks a zero-savings inmate, confirmed directly', () => {
  // `runCommissaryPurchases` has no separate `savings <= 0` check --
  // see that function's own comment. This confirms the real gate that
  // DOES block it: every real catalogue price is positive, so
  // `affordableItemsFor` itself returns none for a zero balance,
  // directly, without needing a 12000-tick draw to observe it.
  assert.deepEqual(penitentiary.affordableItemsFor(0), []);
  assert.ok(Object.values(penitentiary.COMMISSARY_CATALOG).every((d) => d.price > 0),
    'the gate above only holds because every real catalogue price is positive');
});

test('mutation check: the real price paid is exactly COMMISSARY_CATALOG\'s own stated price, not a different number', () => {
  const w = world();
  const operator = organization(w);
  const facility = prison(w, { operatingOrganizationId: operator.id });
  const npc = inmate(w, facility);
  economy.generateIndividualFinances(w, npc.id, { savings: 100, tick: w.tick });

  let purchase = null;
  for (let t = w.tick; t < w.tick + 12000 && !purchase; t += 1) {
    const purchases = penitentiary.runCommissaryPurchases(w, t);
    if (purchases.length > 0) [purchase] = purchases;
  }
  assert.ok(purchase);
  assert.equal(purchase.price, penitentiary.COMMISSARY_CATALOG[purchase.itemName].price);
});

test('mutation check: inmatesOf is the real source of who gets drawn from, not a bare imprisoned-status scan', () => {
  const w = world();
  const operator = organization(w);
  const facility = prison(w, { operatingOrganizationId: operator.id });
  // An NPC with real `status: 'imprisoned'` but no real court case at
  // all -- `justice.inmatesOf` must not count them.
  const npc = person(w, { status: 'imprisoned' });
  economy.generateIndividualFinances(w, npc.id, { savings: 100, tick: w.tick });
  assert.deepEqual(justice.inmatesOf(w, facility.id), []);

  for (let t = w.tick; t < w.tick + 2000; t += 1) {
    assert.equal(penitentiary.runCommissaryPurchases(w, t).length, 0);
  }
});
