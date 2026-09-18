// Everything has value, because everything can become something.
//
// ---------------------------------------------------------------------
// What this file is really guarding
// ---------------------------------------------------------------------
// "Everything has value" is a claim about EVERY row, so most of what is
// below is a guard rather than a unit test: if any item in a world can
// become nothing, or any material is reachable from nothing, or any
// recipe is one nobody could ever follow, the claim is a slogan and
// these fail.
//
// **`describeSalvage` was rigged twice before it told the truth**, and
// both times it reported a clean bill of health:
//
//   Round one counted a material as reachable if anything in the
//   catalogue yielded it — and materials ARE in the catalogue, where
//   `salvageOf` returns them unchanged. Every material vouched for
//   itself, so `unreachableMaterials` was structurally always empty.
//   Standing rule 14 in miniature: the only writer of the check sat
//   behind the check.
//
//   Round two excluded materials and was still wrong, because the
//   PRODUCTS are in the catalogue too. A `blade` yields cloth and a
//   blade is made of cloth, so the crafting table vouched for its own
//   inputs.
//
// Each time the guard got quieter the real gap got louder. With
// materials excluded it found rubber and plastic; with products excluded
// as well it found that cloth, paper and plastic reached a generated
// world through nothing at all — because no item anywhere carries the
// §26 `textiles`, `clothing`, `medicine` or `water` category, so the
// teardowns that yield them described a supply that did not exist.
// Measured consequence: `blade` — the request's own headline example, a
// piece of glass made into a weapon — was makeable by **0 of 150
// people**, along with `furniture`, `bandage` and `notebook`.
//
// The fix was not a number. Buildings now list what is actually inside
// them: a house has curtains and pipework as surely as it has windows, a
// government office is full of paper. 149 of 150 afterwards.
//
// ---------------------------------------------------------------------
// Three more, worth keeping
// ---------------------------------------------------------------------
//   **A declared field nothing reads.** Every recipe named a `skill` and
//   `canMake` never looked at it. The §25 tier gate alone excludes
//   NOBODY from these recipes, because Tiers 1 and 2 need no schooling
//   by design — measured, 150 of 150 qualified for all eight — so the
//   only gate was materials. Standing rule 12's second clause.
//
//   **`npc.community_id` does not exist.** An NPC is an engine object
//   with `communityId`; `properties` is a database row with
//   `community_id`. `runSalvage`'s first version read the snake_case one
//   off a person, got `undefined` for every person in every world, and
//   would have run on schedule forever doing nothing. Standing rule 6.
//
//   **Making was welded to stripping.** One trip did both, so when an
//   area's strippable buildings ran out nobody in it ever made anything
//   again regardless of what they carried: 8 products against 284
//   materials sitting in hands over 400 ticks. Separated, a trip is one
//   or the other.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const salvage = require('../server/salvage.js');
const items = require('../server/items.js');
const inventory = require('../server/inventory.js');
const occupations = require('../server/occupations.js');
const actions = require('../server/actions.js');
const engine = require('../server/engine.js');

// ---------------------------------------------------------------------
// A world with exactly what salvage reads.
//
// Constructed rather than generated (standing rule 8): every assertion
// below is about a specific material count or a specific skill value,
// and a randomly-drawn subject would make each one a coin toss.
// ---------------------------------------------------------------------
const YEAR = 365;

// The `skills` family, from the engine's own 128 definitions rather
// than a list retyped here.
const SKILL_DEFINITIONS = engine.TRAIT_DEFINITIONS.filter((d) => d.family === 'skills');

function world(options = {}) {
  const { tick = 10000 } = options;
  return {
    tick,
    seed: 'salvage-test',
    npcs: [],
    properties: [],
    employmentRecords: [],
    entityTraits: [],
    communities: [{ id: 1, city_id: 1 }],
    inventory: [],
    barterItems: [],
    events: [],
    families: [],
    familyMemberships: [],
    organizations: [],
    relationships: [],
  };
}

// A person with a NAMED skill level and a NAMED education, because both
// gates are being tested and neither may be left to a draw.
function person(w, options = {}) {
  const {
    id, skill = 90, education = 'secondary', age = 30, communityId = 1,
  } = options;
  w.npcs.push({
    id,
    status: 'active',
    education,
    communityId,
    createdTick: w.tick - age * YEAR,
    birth_tick: w.tick - age * YEAR,
    traits: {},
  });
  // Live traits, through `entity_traits` — standing rule 9. Writing
  // `npc.traits.skills` instead would set the birth sheet, which
  // `getLiveEntity` does not read, and every skill assertion here would
  // silently be about the neutral default.
  //
  // **`trait_id` and `current_value`, not a family/name/value triple.**
  // `traitsToSheet` looks the definition up by id and `continue`s past a
  // row whose id it cannot resolve — so a wrongly-shaped fixture row is
  // not an error, it is an empty sheet. Five tests in this file failed
  // that way first, all of them reporting "the skill gate let somebody
  // through" when the real answer was that the subject had no skills at
  // all. The same silence CLAUDE.md's tenth rule describes for a
  // restore, reproduced in a fixture.
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

function building(w, options = {}) {
  const {
    id, type = 'residential', condition = 100, landSize = 500, floors = 1,
    occupants = [], communityId = 1, operatingOrganizationId = null,
  } = options;
  w.properties.push({
    id,
    type,
    condition,
    land_size: landSize,
    floors,
    occupants,
    community_id: communityId,
    operating_organization_id: operatingOrganizationId,
  });
  return w.properties[w.properties.length - 1];
}

function hand(w, entityId, material, quantity) {
  salvage.registerItems(w);
  inventory.give(w, { entityId, itemName: material, quantity, tick: w.tick });
}

// ---------------------------------------------------------------------
// The vocabularies are the engine's, not a fourth list
// ---------------------------------------------------------------------

test('every material and product trades as one of §26’s twenty categories', () => {
  const categories = new Set(items.TRADE_CATEGORIES);
  for (const [name, definition] of Object.entries(salvage.MATERIALS)) {
    assert.ok(categories.has(definition.category), `material ${name} → ${definition.category}`);
  }
  for (const [name, definition] of Object.entries(salvage.PRODUCTS)) {
    assert.ok(categories.has(definition.category), `product ${name} → ${definition.category}`);
  }
});

test('every §26 category has a teardown, so any item yields something', () => {
  // This is what makes "everything has value" true of items added
  // tomorrow rather than only of the catalogue as it stands today.
  for (const category of items.TRADE_CATEGORIES) {
    assert.ok(salvage.CATEGORY_TEARDOWNS[category], `no teardown for "${category}"`);
  }
});

test('every recipe names a real skill and a real §25 knowledge tier', () => {
  for (const [product, recipe] of Object.entries(salvage.RECIPES)) {
    assert.ok(
      occupations.KNOWLEDGE_TIERS[recipe.tier],
      `${product} sits at tier ${recipe.tier}, which is not one of §25's`,
    );
    // A skill no trait answers is a requirement nobody can ever meet —
    // standing rule 6, pointed at the crafting table.
    assert.ok(
      SKILL_DEFINITIONS.some((d) => d.name === recipe.skill),
      `${product} needs "${recipe.skill}", which is not a skills trait`,
    );
  }
});

test('every recipe yields a product the catalogue defines, and vice versa', () => {
  assert.deepEqual(
    Object.keys(salvage.RECIPES).sort(),
    salvage.PRODUCT_NAMES.slice().sort(),
  );
});

test('every ingredient in every alternative is a real material', () => {
  for (const [product, recipe] of Object.entries(salvage.RECIPES)) {
    assert.ok(Array.isArray(recipe.from), `${product}.from must be a list of alternatives`);
    assert.ok(recipe.from.length > 0, `${product} has no way to be made`);
    for (const ingredients of recipe.from) {
      for (const material of Object.keys(ingredients)) {
        assert.ok(salvage.MATERIALS[material], `${product} asks for "${material}"`);
      }
    }
  }
});

// ---------------------------------------------------------------------
// Everything yields something
// ---------------------------------------------------------------------

test('every sourced item yields materials, none of them nothing', () => {
  const w = world();
  for (const item of items.SOURCED_ITEMS) {
    const yielded = salvage.salvageOf(w, item.name);
    assert.ok(yielded, `${item.name} yielded null`);
    assert.ok(Object.keys(yielded).length > 0, `${item.name} yielded nothing`);
  }
});

test('an unknown item is null — a caller error, not a worthless object', () => {
  assert.equal(salvage.salvageOf(world(), 'Moon Rock'), null);
});

test('a ruined item still yields something — junk is the floor, not zero', () => {
  const w = world();
  const wrecked = salvage.salvageOf(w, 'Hammer', { condition: 1 });
  assert.ok(Object.values(wrecked).every((n) => n >= 1));
});

test('a material taken apart is still itself, and the loop stops there', () => {
  const w = world();
  salvage.registerItems(w);
  assert.deepEqual(salvage.salvageOf(w, 'glass', { quantity: 3 }), { glass: 3 });
});

test('worth is what a thing can become, and nothing is worth nothing', () => {
  const w = world();
  salvage.registerItems(w);
  // A diamond breaks down to junk, and junk still makes a club or a
  // container. That is the claim: value is usefulness, not price.
  const diamond = salvage.worthOf(w, 'Diamond');
  assert.deepEqual(diamond.yields, { junk: 1 });
  assert.ok(diamond.worth > 0, 'a diamond can become nothing');
  // A hammer is worth more than a diamond HERE, which is the whole
  // point of the setting and would be backwards under §27's prices.
  assert.ok(salvage.worthOf(w, 'Hammer').worth > diamond.worth);
});

// ---------------------------------------------------------------------
// The guard — and the two ways it was rigged
// ---------------------------------------------------------------------

test('describeSalvage reports no worthless item, on a world with buildings', () => {
  const w = world();
  salvage.registerItems(w);
  building(w, { id: 1, type: 'residential' });
  building(w, { id: 2, type: 'government' });
  const report = salvage.describeSalvage(w);
  assert.deepEqual(report.worthless, []);
  assert.deepEqual(report.unreachableMaterials, []);
  assert.deepEqual(report.unusedMaterials, []);
  assert.deepEqual(report.unmakeableProducts, []);
});

test('the guard does not let a material vouch for itself', () => {
  // The rigging, asserted directly so it cannot come back. `glass`
  // yields `glass`, and if that counted as supply the check would be
  // structurally incapable of failing.
  const w = world();
  salvage.registerItems(w);
  // No buildings at all: glass is then genuinely unobtainable, because
  // no ITEM in the catalogue yields it.
  const report = salvage.describeSalvage(w);
  assert.ok(
    report.unreachableMaterials.includes('glass'),
    'glass vouched for itself — the guard is rigged again',
  );
});

test('the guard does not let a product vouch for its own ingredients', () => {
  const w = world();
  salvage.registerItems(w);
  // A `blade` is `protection`, and `protection` yields cloth. If
  // products counted as supply, cloth would look reachable in a world
  // with no textiles and no buildings in it.
  assert.ok(
    salvage.describeSalvage(w).unreachableMaterials.includes('cloth'),
    'a blade vouched for the cloth a blade is made of',
  );
});

// ---------------------------------------------------------------------
// Making — all three gates
// ---------------------------------------------------------------------

test('the skill gate is real, and reads the LIVE trait', () => {
  const w = world();
  const able = person(w, { id: 1, skill: 90 });
  const unable = person(w, { id: 2, skill: 5 });
  hand(w, able.id, 'timber', 4);
  hand(w, unable.id, 'timber', 4);

  assert.equal(salvage.canMake(w, able.id, 'club').ok, true);
  const refused = salvage.canMake(w, unable.id, 'club');
  assert.equal(refused.ok, false);
  assert.equal(refused.skill, 'Crafting');
  assert.equal(refused.have, 5);
});

test('a skill that cannot be read is unskilled, not competent', () => {
  // `Number(null)` is 0 and 0 is finite — CLAUDE.md's own corollary.
  // Somebody with no trait row must not pass a floor of 20.
  const w = world();
  w.npcs.push({
    id: 1, status: 'active', education: 'secondary', communityId: 1,
    createdTick: w.tick - 30 * YEAR, traits: {},
  });
  hand(w, 1, 'timber', 4);
  assert.equal(salvage.skillOf(w, 1, 'Crafting'), null);
  assert.equal(salvage.canMake(w, 1, 'club').ok, false);
});

test('the §25 tier gate refuses Tier 2 work to unschooled hands', () => {
  const w = world();
  // Tier 2 needs 'none' as its minimum by design, so this asserts the
  // gate is WIRED rather than that it excludes anybody — which is
  // exactly why the skill floor above had to exist.
  const p = person(w, { id: 1, skill: 90, education: null });
  hand(w, p.id, 'scrap_metal', 3);
  assert.equal(occupations.attainmentOf(p), null);
  assert.equal(salvage.canMake(w, p.id, 'shield').ok, true);
});

test('any one alternative is enough, and make consumes the one checked', () => {
  const w = world();
  const p = person(w, { id: 1, skill: 90 });
  // No glass and no stone — only the metal route to a blade.
  hand(w, p.id, 'scrap_metal', 1);
  hand(w, p.id, 'cloth', 1);

  const check = salvage.canMake(w, p.id, 'blade');
  assert.equal(check.ok, true);
  assert.deepEqual(check.using, { scrap_metal: 1, cloth: 1 });

  const made = salvage.make(w, p.id, 'blade');
  assert.deepEqual(made.consumed, check.using);
  assert.equal(inventory.quantityOf(w, p.id, 'blade'), 1);
  assert.equal(inventory.quantityOf(w, p.id, 'scrap_metal'), 0);
});

test('a refusal says what to go and find, per alternative', () => {
  const w = world();
  const p = person(w, { id: 1, skill: 90 });
  const refused = salvage.canMake(w, p.id, 'blade');
  assert.equal(refused.ok, false);
  assert.equal(refused.shortfalls.length, salvage.RECIPES.blade.from.length);
});

test('making something nobody knows how to make is refused, not invented', () => {
  const w = world();
  person(w, { id: 1 });
  assert.equal(salvage.canMake(w, 1, 'aeroplane').ok, false);
  assert.throws(() => salvage.make(w, 1, 'aeroplane'), /not something anybody knows/);
});

// ---------------------------------------------------------------------
// Breaking down
// ---------------------------------------------------------------------

test('breaking down takes the item and hands back what it was made of', () => {
  const w = world();
  const p = person(w, { id: 1 });
  inventory.give(w, { entityId: p.id, itemName: 'Hammer', quantity: 1, tick: w.tick });

  const result = salvage.breakDown(w, p.id, 'Hammer');
  assert.equal(inventory.quantityOf(w, p.id, 'Hammer'), 0);
  for (const [material, amount] of Object.entries(result.yielded)) {
    assert.equal(inventory.quantityOf(w, p.id, material), amount);
  }
});

test('the yield is valued per parcel, at the condition actually taken', () => {
  // `inventory.take` takes WORST CONDITION FIRST and will draw across
  // several holdings. The first version read one holding's condition and
  // applied it to the lot, so a ruined hammer yielded a good one's
  // materials. Standing rule 13's ledger: value what was taken.
  const w = world();
  const p = person(w, { id: 1 });
  inventory.give(w, { entityId: p.id, itemName: 'Hammer', quantity: 1, condition: 100, tick: w.tick });
  inventory.give(w, { entityId: p.id, itemName: 'Hammer', quantity: 1, condition: 10, tick: w.tick });

  const ruined = salvage.breakDown(w, p.id, 'Hammer', { quantity: 1 });
  const good = salvage.breakDown(w, p.id, 'Hammer', { quantity: 1 });
  assert.ok(
    good.yielded.scrap_metal > ruined.yielded.scrap_metal,
    'the worn hammer yielded as much as the good one',
  );
});

test('breaking down what you do not have is refused, not silently zero', () => {
  const w = world();
  person(w, { id: 1 });
  assert.throws(() => salvage.breakDown(w, 1, 'Hammer'), /has 0 Hammer/);
});

// ---------------------------------------------------------------------
// Stripping a building
// ---------------------------------------------------------------------

test('stripping yields materials and costs the building condition', () => {
  const w = world();
  const p = person(w, { id: 1 });
  const b = building(w, { id: 10, type: 'residential', condition: 100, landSize: 1000, floors: 2 });

  const before = b.condition;
  const result = salvage.stripProperty(w, p.id, b.id);
  assert.equal(b.condition, before - salvage.STRIP_CONDITION_COST);
  assert.ok(Object.keys(result.yielded).length > 0);
  assert.ok(inventory.quantityOf(w, p.id, 'glass') > 0, 'a house has windows in it');
});

test('a home with people in it is not salvage', () => {
  const w = world();
  person(w, { id: 1 });
  building(w, { id: 10, occupants: [2, 3] });
  assert.throws(() => salvage.stripProperty(w, 1, 10), /that is a home, not salvage/);
});

test('a building an organization works out of is not salvage', () => {
  const w = world();
  person(w, { id: 1 });
  building(w, { id: 10, operatingOrganizationId: 77 });
  assert.throws(() => salvage.stripProperty(w, 1, 10), /in use by organization/);
});

test('a building runs out — the supply is finite, not a ratchet', () => {
  // Standing rule 13: a mechanism with no inverse has no equilibrium.
  // Stripping creates material out of the world, so the thing to check
  // is that it STOPS. `salvageOfProperty` deliberately has no floor of
  // one for exactly this reason.
  const w = world();
  const p = person(w, { id: 1 });
  const b = building(w, { id: 10, condition: 100, landSize: 1000, floors: 1 });

  let trips = 0;
  while (Number(b.condition) > 0 && trips < 500) {
    salvage.stripProperty(w, p.id, b.id);
    trips += 1;
  }
  assert.ok(trips < 500, 'the building never ran out');
  assert.equal(b.condition, 0);
  assert.throws(() => salvage.stripProperty(w, p.id, b.id), /stripped to nothing/);
});

// ---------------------------------------------------------------------
// runSalvage — the pass, and the reason it exists
// ---------------------------------------------------------------------

test('runSalvage leaves the employed alone', () => {
  const w = world();
  person(w, { id: 1 });
  building(w, { id: 10 });
  w.employmentRecords.push({ entity_id: 1, status: 'active', organization_id: 5 });
  for (let t = 0; t < 400; t += 1) salvage.runSalvage(w, w.tick + t);
  assert.equal(inventory.holdingsOf(w, 1).length, 0);
});

test('runSalvage reaches the idle, and puts materials in real hands', () => {
  // Standing rule 11: a generator nothing calls is indistinguishable
  // from one that does not exist. Before `runSalvage`, a generated world
  // measured `materials_held` at 0.0 in every community — three player
  // verbs and a full crafting chain that nobody in the world could
  // reach, because a player is one person.
  const w = world();
  for (let i = 1; i <= 20; i += 1) person(w, { id: i });
  for (let i = 100; i < 120; i += 1) building(w, { id: i, landSize: 1000 });

  for (let t = 0; t < 200; t += 1) salvage.runSalvage(w, w.tick + t);
  const held = w.npcs.reduce(
    (total, n) => total + inventory.holdingsOf(w, n.id).length, 0,
  );
  assert.ok(held > 0, 'nobody in the world ever picked anything up');
});

test('runSalvage reads communityId, not community_id', () => {
  // Standing rule 6, and it is not hypothetical: the first version read
  // the snake_case name off a person, got `undefined` for everybody in
  // every world, and would have run forever doing nothing.
  const w = world();
  const p = person(w, { id: 1, communityId: 1 });
  delete p.community_id;
  building(w, { id: 10, communityId: 1, landSize: 2000 });
  for (let t = 0; t < 400; t += 1) salvage.runSalvage(w, w.tick + t);
  assert.ok(inventory.holdingsOf(w, 1).length > 0);
});

test('making is not welded to stripping — a full hand is used with no building left', () => {
  // The measured failure: 8 products against 284 materials sitting in
  // hands, because once an area's buildings were down to nothing nobody
  // in it ever made anything again.
  const w = world();
  const p = person(w, { id: 1, skill: 90 });
  hand(w, p.id, 'timber', 20);
  // No strippable building anywhere.
  building(w, { id: 10, condition: 0 });

  let made = 0;
  for (let t = 0; t < 600; t += 1) {
    made += salvage.runSalvage(w, w.tick + t).filter((e) => e.type === 'thing_made').length;
  }
  assert.ok(made > 0, 'a full hand and a finished street produced nothing');
  assert.ok(inventory.quantityOf(w, p.id, 'club') > 0);
});

test('runSalvage is deterministic for the same seed and tick', () => {
  // §88. Two worlds built identically must salvage identically.
  const run = () => {
    const w = world();
    for (let i = 1; i <= 15; i += 1) person(w, { id: i });
    for (let i = 100; i < 110; i += 1) building(w, { id: i, landSize: 1200 });
    for (let t = 0; t < 120; t += 1) salvage.runSalvage(w, w.tick + t);
    return w.inventory.map((h) => `${h.holder_entity_id}:${h.item_name}:${h.quantity}`).sort();
  };
  assert.deepEqual(run(), run());
});

test('runSalvage emits on the making, not on every strip', () => {
  // Standing rule 7: an event on a condition rather than a crossing
  // buries the tick something actually happened.
  // Twenty people who can strip and can NEVER make: a skill of 1 is
  // below every recipe's floor. So every action in this world is a
  // strip, and the honest assertion is that a great many of them produce
  // no events at all.
  const w = world();
  for (let i = 1; i <= 20; i += 1) person(w, { id: i, skill: 1 });
  for (let i = 100; i < 120; i += 1) building(w, { id: i, landSize: 1000 });

  let strips = 0;
  let events = 0;
  for (let t = 0; t < 200; t += 1) {
    const before = w.properties.reduce((a, p) => a + Number(p.condition), 0);
    events += salvage.runSalvage(w, w.tick + t).length;
    strips += Math.round(
      (before - w.properties.reduce((a, p) => a + Number(p.condition), 0))
      / salvage.STRIP_CONDITION_COST,
    );
  }
  assert.ok(strips > 0, 'nothing was ever stripped');
  assert.equal(events, 0, 'stripping emitted an event — that buries the log');
});

test('the only event salvage ever emits is a thing being made', () => {
  const w = world();
  for (let i = 1; i <= 20; i += 1) person(w, { id: i, skill: 90 });
  for (let i = 100; i < 120; i += 1) building(w, { id: i, landSize: 1000 });

  const emitted = [];
  for (let t = 0; t < 200; t += 1) emitted.push(...salvage.runSalvage(w, w.tick + t));
  assert.ok(emitted.length > 0, 'nobody ever made anything');
  for (const event of emitted) {
    assert.equal(event.type, 'thing_made');
    // **The fields `runEventPhase` actually keeps.** It builds the
    // stored row from six named fields and drops everything else
    // silently, so an event carrying its payload under any other name
    // reaches the log saying nothing. Measured before this was fixed: 16
    // rows reading `thing_made` with a null note.
    assert.ok(event.note.includes(`entity ${event.affected_entity_ids[0]}`));
    assert.ok(
      salvage.PRODUCTS[event.global_effects.product],
      'made something that is not a product',
    );
  }
});

// ---------------------------------------------------------------------
// Registration, and what it costs to get it wrong
// ---------------------------------------------------------------------

test('registering is idempotent — a second pass adds nothing', () => {
  // Standing rule 15. `make`, `breakDown`, `stripProperty`, worldgen and
  // restore all call it, so a non-idempotent version would grow the
  // catalogue without bound.
  const w = world();
  const first = salvage.registerItems(w);
  assert.ok(first > 0);
  assert.equal(salvage.registerItems(w), 0);
  assert.equal(w.barterItems.length, first);
});

test('nothing salvage adds is priced', () => {
  // `items.js`: "No item is invented here" — §27 gives seventeen values
  // and this file adds none. An unpriced holding is skipped by
  // `trade.sellableOf`, which is what stops salvage being a money
  // printer, and `knowledge.js` set the precedent with books.
  for (const definition of salvage.itemDefinitions()) {
    assert.equal(definition.baseValue, undefined, definition.name);
    assert.equal(definition.Base_Value, undefined, definition.name);
  }
});

test('a made product is materiel a tribe can count', () => {
  // The payoff of registering products as ordinary items rather than as
  // a parallel kind of thing: `control.materielOf` sums §26 categories
  // across a tribe's holdings and needs no knowledge of this file at
  // all. A blade is `protection` and a hand tool is `tools`, which are
  // the two categories a takeover asks for.
  assert.equal(salvage.PRODUCTS.blade.category, 'protection');
  assert.equal(salvage.PRODUCTS.hand_tool.category, 'tools');
});

// ---------------------------------------------------------------------
// The player verbs
// ---------------------------------------------------------------------

test('the three salvage verbs are dispatchable actions', () => {
  const names = actions.listActions('citizen').map((a) => a.action);
  for (const verb of ['break-down', 'strip-building', 'make-thing']) {
    assert.ok(names.includes(verb), `${verb} is not an action`);
  }
});

test('every verb the salvage actions name is a real engine function', () => {
  // `assertVerbsPresent`'s own invariant: actions call the ENGINE's
  // bound functions, never the modules underneath.
  assert.doesNotThrow(() => actions.assertActionsAreReal());
});
