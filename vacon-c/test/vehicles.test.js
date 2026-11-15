// server/vehicles.js — a real vehicle system over the existing, real
// inventory/salvage/crime/heist machinery. See that file's own
// header: crafting a new vehicle is already `salvage.make` (car/
// motorcycle/scooter are real PRODUCTS there); this file adds theft
// (`heists.robberyAptitudeOf` + `crime.recordCrime`) and restoration
// (the same real mechanic Tier-3/Technology gate, at half the real
// materials), and the real `fuel` item `travel.js` consumes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const vehicles = require('../server/vehicles.js');
const salvage = require('../server/salvage.js');
const inventory = require('../server/inventory.js');

const w = engine.WorldState;

let nextId = 1;

function mechanic(skill = 80) {
  const npc = engine.generateNPC({ traitValueFor: () => skill });
  npc.education = 'basic';
  w.employmentRecords = w.employmentRecords || [];
  w.employmentRecords.push({ entity_id: npc.id, position: 'mechanic', status: 'active' });
  return npc;
}

function person() {
  return engine.generateNPC({ traitValueFor: () => 50 });
}

function craftScooter(ownerId) {
  salvage.registerItems(w);
  inventory.give(w, { entityId: ownerId, itemName: 'scrap_metal', quantity: 3, tick: 0 });
  inventory.give(w, { entityId: ownerId, itemName: 'rubber', quantity: 1, tick: 0 });
  salvage.make(w, ownerId, 'scooter');
}

// ---------------------------------------------------------------------
// The real teardown gap this file closes for free
// ---------------------------------------------------------------------

test('salvage.salvageOf tears a real vehicle down into real materials, via the pre-existing transport teardown table', () => {
  salvage.registerItems(w);
  assert.deepEqual(
    salvage.salvageOf(w, 'car', { quantity: 1, condition: 100 }),
    { scrap_metal: 4, rubber: 2, glass: 2 },
  );
});

// ---------------------------------------------------------------------
// kmPerDayFor
// ---------------------------------------------------------------------

test('kmPerDayFor: null for an entity that does not really hold the vehicle; scaled by real condition otherwise', () => {
  const owner = mechanic();
  assert.equal(vehicles.kmPerDayFor(w, owner.id, 'scooter'), null);
  craftScooter(owner.id);
  assert.equal(vehicles.kmPerDayFor(w, owner.id, 'scooter'), vehicles.KM_PER_DAY_BY_TYPE.scooter);

  const holding = inventory.findHolding(w, owner.id, 'scooter');
  holding.condition = 50;
  assert.equal(vehicles.kmPerDayFor(w, owner.id, 'scooter'), vehicles.KM_PER_DAY_BY_TYPE.scooter * 0.5);
});

test('kmPerDayFor refuses an unreal vehicle type', () => {
  assert.throws(() => vehicles.kmPerDayFor(w, 1, 'bicycle'), /must be one of/);
});

// ---------------------------------------------------------------------
// stealVehicle
// ---------------------------------------------------------------------

test('stealVehicle refuses when the named victim does not really hold the vehicle', () => {
  const thief = mechanic();
  const bystander = person();
  assert.throws(() => vehicles.stealVehicle(w, thief.id, bystander.id, 'car'), /does not really hold a car/);
});

test('stealVehicle refuses stealing from yourself', () => {
  const owner = mechanic();
  craftScooter(owner.id);
  assert.throws(() => vehicles.stealVehicle(w, owner.id, owner.id, 'scooter'), /cannot steal a real scooter from themselves/);
});

test('stealVehicle: targets the NAMED victim\'s own holding, never an unrelated real holder of the same type -- the real bug this file\'s own header records', () => {
  // Two real, independent holders of the same real vehicle type at
  // once -- the exact scenario a bare "find any holder" search gets
  // wrong.
  const bystanderOwner = mechanic();
  craftScooter(bystanderOwner.id);
  const victim = mechanic();
  craftScooter(victim.id);
  const perfectThief = engine.generateNPC({ traitValueFor: () => 100 });

  const result = vehicles.stealVehicle(w, perfectThief.id, victim.id, 'scooter', { tick: 0 });
  assert.equal(result.stolen, true);
  assert.equal(inventory.quantityOf(w, victim.id, 'scooter'), 0, 'the NAMED victim must lose theirs');
  assert.equal(inventory.quantityOf(w, bystanderOwner.id, 'scooter'), 1, 'an unrelated real holder of the same type must be untouched');
});

test('stealVehicle: a real failure (aptitude 0 -> chance exactly 0) transfers nothing and records no incident', () => {
  const victim = mechanic();
  craftScooter(victim.id);
  // aptitude 0 -> chance = max(0, 0.5 + (0-50)/100) = 0, a real,
  // deterministic miss -- `seededDraw(...) < 0` can never be true.
  const uselessThief = engine.generateNPC({ traitValueFor: () => 0 });
  const result = vehicles.stealVehicle(w, uselessThief.id, victim.id, 'scooter', { tick: 0 });
  assert.equal(result.stolen, false);
  assert.ok(vehicles.VEHICLE_THEFT_TECHNIQUES.includes(result.technique));
  assert.equal(inventory.quantityOf(w, uselessThief.id, 'scooter'), 0);
  assert.equal(inventory.quantityOf(w, victim.id, 'scooter'), 1);
  assert.equal(w.crimeIncidents.some((c) => c.category === 'theft' && c.perpetrator_entity_id === uselessThief.id), false);
});

test('stealVehicle: a real success (aptitude 100 -> chance exactly 1) transfers the real item and records a real theft incident', () => {
  const victim = mechanic();
  craftScooter(victim.id);
  // aptitude 100 -> chance = min(1, 0.5 + (100-50)/100) = 1, a real,
  // deterministic hit -- `seededDraw(...) < 1` is always true.
  const perfectThief = engine.generateNPC({ traitValueFor: () => 100 });
  const result = vehicles.stealVehicle(w, perfectThief.id, victim.id, 'scooter', { tick: 0 });
  assert.equal(result.stolen, true);
  assert.ok(vehicles.VEHICLE_THEFT_TECHNIQUES.includes(result.technique));
  assert.equal(inventory.quantityOf(w, perfectThief.id, 'scooter'), 1);
  assert.equal(inventory.quantityOf(w, victim.id, 'scooter'), 0);
  const incident = w.crimeIncidents.find(
    (c) => c.category === 'theft' && c.perpetrator_entity_id === perfectThief.id && c.victim_entity_id === victim.id,
  );
  assert.ok(incident, 'a real theft incident must exist through crime.recordCrime');
});

test('stealVehicle: a high real robbery aptitude against an undefended vehicle succeeds reliably', () => {
  const victim = mechanic();
  craftScooter(victim.id);
  const skilledThief = engine.generateNPC({ traitValueFor: () => 95 });
  let stolen = false;
  for (let tick = 0; tick < 10 && !stolen; tick += 1) {
    const result = vehicles.stealVehicle(w, skilledThief.id, victim.id, 'scooter', { tick });
    stolen = result.stolen;
  }
  assert.ok(stolen, 'a real, highly skilled thief should succeed within 10 real tries');
});

// ---------------------------------------------------------------------
// restoreVehicle
// ---------------------------------------------------------------------

test('restoreVehicle refuses without a real held vehicle of that type', () => {
  const owner = mechanic();
  assert.throws(() => vehicles.restoreVehicle(w, owner.id, 'car'), /does not hold a real car/);
});

test('restoreVehicle reports no real work needed at full condition', () => {
  const owner = mechanic();
  craftScooter(owner.id);
  const result = vehicles.restoreVehicle(w, owner.id, 'scooter');
  assert.equal(result.restored, false);
  assert.equal(result.condition, 100);
});

test('restoreVehicle refuses a real entity with no real schooling at all (fails the Tier gate)', () => {
  const owner = person();
  // Give the unschooled person a damaged scooter directly.
  inventory.give(w, { entityId: owner.id, itemName: 'scooter', quantity: 1, condition: 40, tick: 0 });
  inventory.give(w, { entityId: owner.id, itemName: 'scrap_metal', quantity: 2, tick: 0 });
  inventory.give(w, { entityId: owner.id, itemName: 'rubber', quantity: 1, tick: 0 });
  assert.throws(() => vehicles.restoreVehicle(w, owner.id, 'scooter'), /Tier 3 work/);
});

test('restoreVehicle refuses a real entity schooled enough but below the real Technology skill floor', () => {
  const owner = engine.generateNPC({ traitValueFor: () => 10 });
  owner.education = 'basic';
  inventory.give(w, { entityId: owner.id, itemName: 'scooter', quantity: 1, condition: 40, tick: 0 });
  inventory.give(w, { entityId: owner.id, itemName: 'scrap_metal', quantity: 2, tick: 0 });
  inventory.give(w, { entityId: owner.id, itemName: 'rubber', quantity: 1, tick: 0 });
  assert.throws(() => vehicles.restoreVehicle(w, owner.id, 'scooter'), /takes Technology/);
});

test('restoreVehicle: a real mechanic raises a damaged vehicle\'s real condition from HALF the real fresh-build materials', () => {
  const owner = mechanic();
  craftScooter(owner.id);
  const holding = inventory.findHolding(w, owner.id, 'scooter');
  holding.condition = 30;
  inventory.give(w, { entityId: owner.id, itemName: 'scrap_metal', quantity: 2, tick: 0 });
  inventory.give(w, { entityId: owner.id, itemName: 'rubber', quantity: 1, tick: 0 });

  const before = inventory.quantityOf(w, owner.id, 'scrap_metal');
  const result = vehicles.restoreVehicle(w, owner.id, 'scooter');
  assert.equal(result.restored, true);
  assert.equal(result.condition, 30 + vehicles.RESTORATION_CONDITION_GAIN);
  assert.deepEqual(result.consumed, { scrap_metal: 2, rubber: 1 });
  assert.equal(inventory.quantityOf(w, owner.id, 'scrap_metal'), before - 2);
});

test('restoreVehicle refuses outright, never half-applying, when no real alternative\'s materials can be afforded', () => {
  const owner = mechanic();
  craftScooter(owner.id);
  inventory.findHolding(w, owner.id, 'scooter').condition = 30;
  assert.throws(
    () => vehicles.restoreVehicle(w, owner.id, 'scooter'),
    /does not hold enough real materials/,
  );
  assert.equal(inventory.findHolding(w, owner.id, 'scooter').condition, 30, 'a refused restoration must not touch condition at all');
});
