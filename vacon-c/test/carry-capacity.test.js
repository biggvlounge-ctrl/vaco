// Real carry-capacity limit — by direct instruction: "carry-capacity /
// bags / storage system." Read `server/carryCapacity.js`'s own header
// first for why this measures COUNT, not weight, and why `container`
// (the real, pre-existing, zero-consumer `salvage.js` product) is the
// "bag" rather than a new item invented here.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const carryCapacity = require('../server/carryCapacity.js');
const discovery = require('../server/discovery.js');
const landmarks = require('../server/landmarks.js');
const inventory = require('../server/inventory.js');
const salvage = require('../server/salvage.js');

function world() {
  return {
    tick: 10000,
    seed: 'carry-capacity-test',
    npcs: [],
    properties: [],
    historicalRecords: [],
    communities: [{ id: 1, city_id: 1 }],
    inventory: [],
    barterItems: [],
    artifacts: [],
    events: [],
    entityTraits: [],
    employmentRecords: [],
    families: [],
    familyMemberships: [],
    organizations: [],
    relationships: [],
  };
}

function person(w, id) {
  w.npcs.push({ id, status: 'active', communityId: 1, createdTick: w.tick - 30 * 365, traits: {} });
  return w.npcs[w.npcs.length - 1];
}

function landmark(w, id, category, significance = 95) {
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
    operating_organization_id: null,
    discoveries_taken: 0,
  });
  return w.properties[w.properties.length - 1];
}

// ---------------------------------------------------------------------
// capacityOf / carriedCountOf / canCarry
// ---------------------------------------------------------------------

test('capacityOf is BASE_CAPACITY with no containers held', () => {
  const w = world();
  person(w, 1);
  assert.equal(carryCapacity.capacityOf(w, 1), carryCapacity.BASE_CAPACITY);
});

test('each real container held adds the real bonus, cumulatively', () => {
  const w = world();
  person(w, 1);
  salvage.registerItems(w);
  inventory.give(w, { entityId: 1, itemName: carryCapacity.CONTAINER_ITEM_NAME, quantity: 1 });
  assert.equal(
    carryCapacity.capacityOf(w, 1),
    carryCapacity.BASE_CAPACITY + carryCapacity.CONTAINER_CAPACITY_BONUS,
  );
  inventory.give(w, { entityId: 1, itemName: carryCapacity.CONTAINER_ITEM_NAME, quantity: 1 });
  assert.equal(
    carryCapacity.capacityOf(w, 1),
    carryCapacity.BASE_CAPACITY + carryCapacity.CONTAINER_CAPACITY_BONUS * 2,
  );
});

test('carriedCountOf sums real quantity across every holding, not the number of rows', () => {
  const w = world();
  person(w, 1);
  inventory.give(w, { entityId: 1, itemName: 'Hammer', quantity: 3 });
  inventory.give(w, { entityId: 1, itemName: 'Saw', quantity: 2 });
  assert.equal(carryCapacity.carriedCountOf(w, 1), 5);
});

test('canCarry is true below capacity and false at or over it', () => {
  const w = world();
  person(w, 1);
  inventory.give(w, { entityId: 1, itemName: 'Hammer', quantity: carryCapacity.BASE_CAPACITY - 1 });
  assert.equal(carryCapacity.canCarry(w, 1, 1), true);
  inventory.give(w, { entityId: 1, itemName: 'Saw', quantity: 1 });
  // Now exactly at capacity -- one more would exceed it.
  assert.equal(carryCapacity.carriedCountOf(w, 1), carryCapacity.BASE_CAPACITY);
  assert.equal(carryCapacity.canCarry(w, 1, 1), false);
});

// ---------------------------------------------------------------------
// discovery.search integration — the one real consumer this round wires
// ---------------------------------------------------------------------

test('a full holder still finds a book, but it is not added, and the search still costs the location a find', () => {
  const w = world();
  person(w, 1);
  inventory.give(w, { entityId: 1, itemName: 'Hammer', quantity: carryCapacity.BASE_CAPACITY });
  assert.equal(carryCapacity.canCarry(w, 1, 1), false);

  const p = landmark(w, 10, 'library');
  const before = discovery.remainingAt(w, 10);
  const result = discovery.search(w, 1, 10);

  assert.equal(result.found.kind, 'book');
  assert.equal(result.found.carried, false);
  assert.equal(inventory.quantityOf(w, 1, result.found.itemName), 0);
  assert.equal(discovery.remainingAt(w, 10), before - 1);
  assert.equal(p.discoveries_taken, 1);
});

test('a full holder still finds an item, but it is not added either', () => {
  const w = world();
  person(w, 1);
  inventory.give(w, { entityId: 1, itemName: 'Hammer', quantity: carryCapacity.BASE_CAPACITY });

  landmark(w, 11, 'natural-formation');
  const result = discovery.search(w, 1, 11);

  assert.equal(result.found.kind, 'item');
  assert.equal(result.found.carried, false);
  assert.equal(inventory.quantityOf(w, 1, result.found.itemName), 0);
});

test('a holder with room actually receives the find, and it is reported as carried', () => {
  const w = world();
  person(w, 1);

  landmark(w, 12, 'library');
  const result = discovery.search(w, 1, 12);

  assert.equal(result.found.carried, true);
  assert.equal(inventory.quantityOf(w, 1, result.found.itemName), 1);
});

// ---------------------------------------------------------------------
// Mutation check: a canCarry that always returned true would hide the
// capacity gate entirely, and look identical on every test above that
// only checks the HAPPY path.
// ---------------------------------------------------------------------

test('mutation check: canCarry genuinely gates — a full holder and an empty one must disagree', () => {
  const full = world();
  person(full, 1);
  inventory.give(full, { entityId: 1, itemName: 'Hammer', quantity: carryCapacity.BASE_CAPACITY });

  const empty = world();
  person(empty, 1);

  assert.equal(carryCapacity.canCarry(full, 1, 1), false);
  assert.equal(carryCapacity.canCarry(empty, 1, 1), true);
});
