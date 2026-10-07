// Primary production: what a living person grows, raises, catches or
// gathers -- the other half of "producible" that salvage.js's own
// RECIPES does not model (combining held materials, not drawing from
// land, water or an animal).
//
// Per direct instruction: a post-collapse world "will only be
// importing and exporting so much from the old world, and anything
// else will have to be created or made or manufactured." This file
// guards both halves of that sentence: a `PRIMARY_PRODUCE`/
// `REMNANT_GOODS` item is tagged with the real `origin` that decides
// which half it is in, and a remnant good is refused by `canHarvest`
// no matter who is asking -- nobody alive can make more old-world
// stock.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const produce = require('../server/produce.js');
const salvage = require('../server/salvage.js');
const items = require('../server/items.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');
const occupations = require('../server/occupations.js');
const engine = require('../server/engine.js');

const SKILL_DEFINITIONS = engine.TRAIT_DEFINITIONS.filter((d) => d.family === 'skills');

function world(options = {}) {
  const { tick = 10000 } = options;
  const w = {
    tick,
    npcs: [],
    entityTraits: [],
    inventory: [],
    barterItems: [],
    employmentRecords: [],
    organizations: [],
    individualFinances: [],
    events: [],
    nextEntityId: 1,
  };
  economy.reseedIds(w);
  return w;
}

// A named skill level, written live through `entity_traits` -- the
// same standing-rule-9 discipline `salvage.test.js`'s own `person()`
// follows, for the same reason: `npc.traits` is the birth sheet and
// `getLiveEntity` never reads it.
function person(w, { id, skills = {} } = {}) {
  const npc = { id, status: 'active', education: 'secondary', createdTick: w.tick - 30 * 365, traits: {} };
  w.npcs.push(npc);
  for (const [name, value] of Object.entries(skills)) {
    const definition = SKILL_DEFINITIONS.find((d) => d.name === name);
    w.entityTraits.push({
      entity_id: id,
      trait_id: definition.trait_id,
      base_value: value,
      current_value: value,
      key_modifier: 0,
      temporary_modifier: 0,
      permanent_modifier: 0,
      experience_modifier: 0,
      environmental_modifier: 0,
      relationship_modifier: 0,
    });
  }
  return npc;
}

function employer(w) {
  const org = { id: w.organizations.length + 1, type: 'business' };
  w.organizations.push(org);
  return org;
}

// -- the catalogue --------------------------------------------------

test('every primary-produce and remnant item names a real §26 category', () => {
  for (const [name, def] of Object.entries(produce.PRIMARY_PRODUCE)) {
    assert.ok(items.TRADE_CATEGORIES.includes(def.category), `${name} is categorised "${def.category}", which §26 does not list`);
  }
  for (const [name, def] of Object.entries(produce.REMNANT_GOODS)) {
    assert.ok(items.TRADE_CATEGORIES.includes(def.category), `${name} is categorised "${def.category}", which §26 does not list`);
  }
});

test('every occupation a produce item names is a real occupation', () => {
  for (const [name, def] of Object.entries(produce.PRIMARY_PRODUCE)) {
    if (def.occupation === null) continue;
    assert.ok(occupations.definitionOf(def.occupation), `${name} names "${def.occupation}", which is not a real occupation`);
  }
});

test('registering is idempotent and tags every item with the real origin', () => {
  const w = world();
  const added = produce.registerItems(w);
  assert.equal(added, produce.PRIMARY_PRODUCE_NAMES.length + produce.REMNANT_GOOD_NAMES.length);
  assert.equal(produce.registerItems(w), 0, 'a second pass adds nothing');

  for (const name of produce.PRIMARY_PRODUCE_NAMES) {
    assert.equal(items.originOf(w, name), 'producible', `${name} should be producible`);
  }
  for (const name of produce.REMNANT_GOOD_NAMES) {
    assert.equal(items.originOf(w, name), 'remnant', `${name} should be remnant`);
  }
});

// -- harvesting -------------------------------------------------------

test('an occupation-gated item refuses someone not employed as that occupation', () => {
  const w = world();
  const farmer = person(w, { id: 1, skills: { Agriculture: 90 } });
  const check = produce.canHarvest(w, farmer.id, 'wheat');
  assert.equal(check.ok, false);
  assert.match(check.reason, /farmer/);
});

test("employed as the right occupation, with the occupation's own real skill and tier, harvesting succeeds", () => {
  const w = world();
  const farmer = person(w, { id: 1, skills: { Agriculture: 90 } });
  const org = employer(w);
  economy.hireEntity(w, { entityId: farmer.id, employerOrganizationId: org.id, wage: 20, position: 'farmer', tick: w.tick });

  const check = produce.canHarvest(w, farmer.id, 'wheat');
  assert.equal(check.ok, true);

  const result = produce.harvest(w, farmer.id, 'wheat', { tick: w.tick });
  assert.equal(result.name, 'wheat');
  assert.equal(inventory.quantityOf(w, farmer.id, 'wheat'), 1);
});

test('employed as the right occupation but under its real skill floor still refuses', () => {
  const w = world();
  const farmer = person(w, { id: 1, skills: { Agriculture: 5 } });
  const org = employer(w);
  economy.hireEntity(w, { entityId: farmer.id, employerOrganizationId: org.id, wage: 20, position: 'farmer', tick: w.tick });

  const check = produce.canHarvest(w, farmer.id, 'wheat');
  assert.equal(check.ok, false);
  assert.match(check.reason, /Agriculture/);
});

test('being employed as the WRONG occupation refuses too, not just being unemployed', () => {
  const w = world();
  const hunter = person(w, { id: 1, skills: { Agriculture: 90, Combat: 90 } });
  const org = employer(w);
  economy.hireEntity(w, { entityId: hunter.id, employerOrganizationId: org.id, wage: 20, position: 'hunter', tick: w.tick });

  const check = produce.canHarvest(w, hunter.id, 'wheat');
  assert.equal(check.ok, false, 'a hunter does not farm');
});

test('an ungated item (salt, clean water) can be gathered by anybody, no occupation needed', () => {
  const w = world();
  const anybody = person(w, { id: 1 });
  assert.equal(produce.canHarvest(w, anybody.id, 'salt').ok, true);
  assert.equal(produce.canHarvest(w, anybody.id, 'clean_water').ok, true);
  const result = produce.harvest(w, anybody.id, 'salt', { tick: w.tick });
  assert.equal(inventory.quantityOf(w, anybody.id, 'salt'), 1);
  assert.equal(result.name, 'salt');
});

test('a remnant good is refused by canHarvest no matter who is asking', () => {
  const w = world();
  const anybody = person(w, { id: 1, skills: { Agriculture: 100, Combat: 100, Crafting: 100, Technology: 100 } });
  for (const name of produce.REMNANT_GOOD_NAMES) {
    const check = produce.canHarvest(w, anybody.id, name);
    assert.equal(check.ok, false, `${name} should never be harvestable`);
  }
  assert.throws(() => produce.harvest(w, anybody.id, 'canned_food'), /cannot harvest/);
});

test('an unknown name is refused with a clear reason, not a crash', () => {
  const w = world();
  const anybody = person(w, { id: 1 });
  const check = produce.canHarvest(w, anybody.id, 'not-a-real-item');
  assert.equal(check.ok, false);
});

// -- the harvest feeds real crafting ---------------------------------

test('a harvested primary-produce item is a real ingredient a RECIPES entry can consume', () => {
  const w = world();
  const farmer = person(w, { id: 1, skills: { Agriculture: 90, Crafting: 90 } });
  const org = employer(w);
  economy.hireEntity(w, { entityId: farmer.id, employerOrganizationId: org.id, wage: 20, position: 'farmer', tick: w.tick });

  for (let i = 0; i < 3; i += 1) produce.harvest(w, farmer.id, 'wheat', { tick: w.tick });
  assert.equal(inventory.quantityOf(w, farmer.id, 'wheat'), 3);

  const check = salvage.canMake(w, farmer.id, 'bread');
  assert.equal(check.ok, true);
  const made = salvage.make(w, farmer.id, 'bread', { tick: w.tick });
  assert.equal(made.product, 'bread');
  assert.equal(inventory.quantityOf(w, farmer.id, 'wheat'), 0, 'the wheat was consumed');
  assert.equal(inventory.quantityOf(w, farmer.id, 'bread'), 1);
});

// -- the catalogue is actually complete -------------------------------

test('describeProduce reports every §26 category filled except the ones with no physical item by design', () => {
  const w = world();
  produce.registerItems(w);
  salvage.registerItems(w);
  const described = produce.describeProduce(w);
  assert.deepEqual(described.emptyCategories, []);
  assert.deepEqual(described.unclassifiedOrigin, []);
  assert.ok(described.remnantItems > 0);
  assert.ok(described.producibleItems > 0);
});
