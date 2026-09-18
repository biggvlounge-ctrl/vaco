// What is on the shelves, and who gets it when the place is taken.
//
// ---------------------------------------------------------------------
// A confirmed claim the engine did not honour
// ---------------------------------------------------------------------
// `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` states it outright:
//
//   "once a location's Control Key challenge is met, the capturing
//   group gains real, tangible access to that location's merchandise
//   pool."
//   KeyLocationCapture { ..., merchandiseAccessGranted: true }
//
// `grep -rn merchandise server/` returned nothing. **Taking a hardware
// store gave you a hardware store and not one hammer.**
//
// That mattered more than it sounds, because `control.js` requires
// materiel: a tribe that cannot take a building for want of tools could
// not take the building tools come from either. A lock, not a
// difficulty curve. Measured after: a tribe went from 3 tools to 15 by
// taking one hardware store, and `control.materielOf` reads it back
// with no new code because the goods go to the members.
//
// ---------------------------------------------------------------------
// The gap the discovery guard found first
// ---------------------------------------------------------------------
// `discovery.describeDiscovery` reported four §26 categories that real
// pools draw from and **no item in any generated world belonged to**:
// clothing, food, repair and transport. §27 prices seventeen items and
// they are metals, gems, sand, gravel, two tools and a musical
// instrument — so a grocery store search found nothing, every time.
// The names here are the retail document's own merchandise nouns.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const merchandise = require('../server/merchandise.js');
const discovery = require('../server/discovery.js');
const salvage = require('../server/salvage.js');
const items = require('../server/items.js');
const inventory = require('../server/inventory.js');
const control = require('../server/control.js');
const landmarks = require('../server/landmarks.js');

const YEAR = 365;

function world(options = {}) {
  const { tick = 10000 } = options;
  return {
    tick,
    seed: 'merchandise-test',
    npcs: [],
    properties: [],
    historicalRecords: [],
    communities: [{ id: 1, city_id: 1 }],
    cities: [{ id: 1 }],
    inventory: [],
    barterItems: [],
    artifacts: [],
    events: [],
    entityTraits: [],
    employmentRecords: [],
    families: [{ id: 900, surname: 'Okonkwo', unity: 50, conflict: 0 }],
    familyMemberships: [],
    organizations: [],
    relationships: [],
    memories: [],
    ownershipRecords: [],
    infrastructure: [],
    civilizations: [],
    entityOrganizationMemberships: [],
  };
}

function member(w, id, age = 30) {
  w.npcs.push({
    id, status: 'active', communityId: 1, education: 'secondary',
    createdTick: w.tick - age * YEAR, traits: {},
  });
  w.familyMemberships.push({
    entity_id: id, family_id: 900, role: 'sibling', generation_number: 1,
  });
  return w.npcs[w.npcs.length - 1];
}

function shop(w, id, category, significance = 40) {
  const record = { id: 5000 + id, significance, where_location_id: id };
  w.historicalRecords.push(record);
  w.properties.push({
    id,
    type: landmarks.propertyTypeFor(category),
    landmark_category: category,
    history_ref: record.id,
    condition: 100,
    land_size: 500,
    floors: 1,
    occupants: [],
    community_id: 1,
    city_id: 1,
    operating_organization_id: null,
    discoveries_taken: 0,
    merchandise_taken: false,
  });
  return w.properties[w.properties.length - 1];
}

// ---------------------------------------------------------------------
// The goods
// ---------------------------------------------------------------------

test('every stock item trades as one of §26’s twenty categories', () => {
  const categories = new Set(items.TRADE_CATEGORIES);
  for (const [name, definition] of Object.entries(merchandise.STOCK)) {
    assert.ok(categories.has(definition.category), `${name} → ${definition.category}`);
  }
});

test('nothing merchandise adds is priced', () => {
  // §27 gives seventeen values and `items.js` says no item is invented
  // there. A shelf of tinned food with a made-up price is a made-up
  // economy — `knowledge.js` set this precedent with books.
  for (const definition of merchandise.itemDefinitions()) {
    assert.equal(definition.baseValue, undefined, definition.name);
    assert.equal(definition.Base_Value, undefined, definition.name);
  }
  assert.equal(merchandise.describeMerchandise(world()).priced, 0);
});

test('registering is idempotent, and shares the array with salvage and books', () => {
  const w = world();
  const first = merchandise.registerItems(w);
  assert.ok(first > 0);
  assert.equal(merchandise.registerItems(w), 0);
  // Two modules writing the same array: a name registered twice under
  // different definitions is exactly the divergence idempotency-by-name
  // exists to prevent.
  salvage.registerItems(w);
  const names = w.barterItems.map((i) => i.name);
  assert.equal(new Set(names).size, names.length, 'a name was registered twice');
});

test('between them, every category a discovery pool draws on has goods', () => {
  // **The guard, and the whole reason this module exists.** A pool
  // drawing on an empty category finds nothing for ever — standing rule
  // 14's shape, and it was true of four categories before this.
  const w = world();
  merchandise.registerItems(w);
  salvage.registerItems(w);
  assert.deepEqual(merchandise.describeMerchandise(w).emptyCategories, []);
  assert.deepEqual(discovery.describeDiscovery(w).emptyCategories, []);
});

// ---------------------------------------------------------------------
// What a location holds
// ---------------------------------------------------------------------

test('the stockroom is the discovery pool, not a second table', () => {
  // One vocabulary reached two ways: searching takes one thing off a
  // shelf, capturing takes the stockroom. A second table of what a
  // hardware store sells would be two disagreeing answers by
  // construction.
  const w = world();
  merchandise.registerItems(w);
  salvage.registerItems(w);
  shop(w, 10, 'hardware-store', 40);

  const stock = merchandise.stockOf(w, 10);
  const pool = discovery.poolFor('hardware-store').itemCategories;
  for (const name of Object.keys(stock)) {
    assert.ok(pool.includes(items.findItem(w, name).category), `${name} is not in the pool`);
  }
});

test('a more significant location holds more stock', () => {
  const w = world();
  merchandise.registerItems(w);
  shop(w, 10, 'pharmacy', 90);
  shop(w, 11, 'pharmacy', 10);
  const big = Object.values(merchandise.stockOf(w, 10)).reduce((a, b) => a + b, 0);
  const small = Object.values(merchandise.stockOf(w, 11)).reduce((a, b) => a + b, 0);
  assert.ok(big > small);
});

test('a location with no merchandise pool has no stockroom — null, not empty', () => {
  // A cathedral is worth taking and has nothing to sell. Null says the
  // question does not apply; an empty object would say the shelves are
  // bare, which is a different and wrong claim.
  const w = world();
  merchandise.registerItems(w);
  shop(w, 10, 'church', 80);
  assert.equal(merchandise.stockOf(w, 10), null);
  assert.equal(merchandise.stockOf(w, 999), null);
});

// ---------------------------------------------------------------------
// The capture
// ---------------------------------------------------------------------

test('capturing a shop puts its stock in the members’ hands', () => {
  const w = world();
  merchandise.registerItems(w);
  salvage.registerItems(w);
  for (let i = 1; i <= 3; i += 1) member(w, i);
  shop(w, 10, 'pharmacy', 50);

  const result = merchandise.grantOnCapture(w, 10, 900);
  assert.equal(result.merchandiseAccessGranted, true);
  assert.equal(result.capturingEntityType, 'tribe');
  assert.ok(Object.keys(result.granted).length > 0);

  const held = w.npcs.reduce((total, n) => total + inventory.holdingsOf(w, n.id).length, 0);
  assert.ok(held > 0, 'the stock went nowhere');
});

test('the goods reach the tribe, because materielOf sums its members', () => {
  // There is no tribe inventory table and inventing one would put a
  // second answer beside `inventory.holder_entity_id`. Handing the
  // stock to the members IS handing it to the tribe, and the takeover
  // key reads it back with no new code.
  const w = world();
  merchandise.registerItems(w);
  salvage.registerItems(w);
  for (let i = 1; i <= 3; i += 1) member(w, i);
  shop(w, 10, 'hardware-store', 60);

  const before = control.materielOf(w, 900).tools ?? 0;
  merchandise.grantOnCapture(w, 10, 900);
  assert.ok(control.materielOf(w, 900).tools > before, 'a hardware store yielded no tools');
});

test('a stockroom is emptied once, not once per capture', () => {
  // Standing rule 13: take, lose, retake would otherwise be an
  // infinite supply of food.
  const w = world();
  merchandise.registerItems(w);
  for (let i = 1; i <= 3; i += 1) member(w, i);
  const p = shop(w, 10, 'grocery-store', 50);

  assert.ok(merchandise.grantOnCapture(w, 10, 900));
  assert.equal(p.merchandise_taken, true);
  assert.equal(merchandise.grantOnCapture(w, 10, 900), null);
});

test('a tribe with no living members is granted nothing rather than throwing', () => {
  const w = world();
  merchandise.registerItems(w);
  shop(w, 10, 'grocery-store', 50);
  assert.equal(merchandise.grantOnCapture(w, 10, 900), null);
});

test('a successful takeover carries the merchandise with it', () => {
  // End to end through `control.attempt`, which is where the document's
  // claim actually lives — not through `grantOnCapture` directly.
  const w = world();
  merchandise.registerItems(w);
  salvage.registerItems(w);
  for (let i = 1; i <= 8; i += 1) member(w, i);
  // Kit, so the attempt is not refused on materiel before it starts.
  inventory.give(w, { entityId: 1, itemName: 'Hammer', quantity: 50, tick: w.tick });
  const p = shop(w, 10, 'hardware-store', 60);
  p.occupants = [];

  // Drive it to a success rather than waiting on the seeded draw:
  // `attempt` is deterministic, so a fixture asserting on one draw is
  // asserting on the seed. What matters here is the wiring.
  const before = control.materielOf(w, 900).materials ?? 0;
  const result = control.attempt(w, { scale: 'property', locationId: 10, tribeId: 900 });
  assert.ok(result !== null);
  if (result.succeeded) {
    assert.ok(result.merchandise, 'a successful capture granted no merchandise');
    assert.equal(p.merchandise_taken, true);
    assert.ok((control.materielOf(w, 900).materials ?? 0) >= before);
  } else {
    // A failed attempt must not empty the shelves.
    assert.equal(result.merchandise, null);
    assert.equal(p.merchandise_taken, false);
  }
});

test('taking something with no shelves reports no merchandise, and does not throw', () => {
  const w = world();
  merchandise.registerItems(w);
  for (let i = 1; i <= 8; i += 1) member(w, i);
  inventory.give(w, { entityId: 1, itemName: 'Hammer', quantity: 50, tick: w.tick });
  shop(w, 10, 'monument-memorial', 90);
  const result = control.attempt(w, { scale: 'property', locationId: 10, tribeId: 900 });
  assert.equal(result.merchandise, null);
});
