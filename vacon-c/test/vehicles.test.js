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
const heistTools = require('../server/heistTools.js');
const entityTraits = require('../server/entityTraits.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');

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

// Task #168: a thief with no real bypass tool now pays a real,
// flagged penalty against a legacy technique. These existing tests
// predate that and want the UNPENALISED chance their own comments
// already describe, so equip the real, current tool.
function equipBypassTool(entityId) {
  heistTools.registerItems(w);
  inventory.give(w, { entityId, itemName: 'key_programmer' });
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
  // Task #127: `mechanic()`'s own `traitValueFor: () => 80` sets EVERY
  // individual trait to 80, `skills.Driving` included, so the real
  // driving modulator (0.75 + 80/200 = 1.15) applies here too — not a
  // bug this test is working around, the real mechanism this fixture
  // happens to also exercise.
  const drivingModulator = vehicles.drivingModulatorFor(w, owner.id);
  assert.equal(drivingModulator, 1.15);
  assert.equal(vehicles.kmPerDayFor(w, owner.id, 'scooter'), vehicles.KM_PER_DAY_BY_TYPE.scooter * drivingModulator);

  const holding = inventory.findHolding(w, owner.id, 'scooter');
  holding.condition = 50;
  assert.equal(
    vehicles.kmPerDayFor(w, owner.id, 'scooter'),
    vehicles.KM_PER_DAY_BY_TYPE.scooter * 0.5 * drivingModulator,
  );
});

// Task #127: a real Driving skill modulates pace, and an unmeasured
// or average (50) driver is unaffected -- the same "modulator, not a
// gate" shape task #107 established for Discipline on production.
test('kmPerDayFor: Driving modulates pace, and an average (50) driver gets the vehicle\'s unmodified rated pace', () => {
  // Direct `inventory.give` rather than `craftScooter`/`salvage.make`
  // -- this test is about the DRIVER's own skill, not about who can
  // craft a vehicle (Tier 3 work `person()`'s plain fixture does not
  // qualify for), the same shape `test/travel.test.js`'s own vehicle
  // test already uses.
  salvage.registerItems(w);
  function give(entityId) {
    inventory.give(w, { entityId, itemName: 'scooter', quantity: 1, condition: 100, tick: 0 });
  }

  const average = person();
  give(average.id);
  assert.equal(vehicles.drivingModulatorFor(w, average.id), 1);
  assert.equal(vehicles.kmPerDayFor(w, average.id, 'scooter'), vehicles.KM_PER_DAY_BY_TYPE.scooter);

  const skilled = person();
  const unskilled = person();
  give(skilled.id);
  give(unskilled.id);
  const drivingDef = INDIVIDUAL_DEFINITIONS.find((d) => d.family === 'skills' && d.name === 'Driving');
  for (const row of w.entityTraits) {
    if (row.trait_id !== drivingDef.trait_id) continue;
    if (row.entity_id === skilled.id) row.current_value = 100;
    if (row.entity_id === unskilled.id) row.current_value = 0;
  }
  assert.equal(entityTraits.getLiveEntity(w, skilled.id).traits.skills.Driving, 100);
  assert.equal(entityTraits.getLiveEntity(w, unskilled.id).traits.skills.Driving, 0);

  assert.ok(
    vehicles.kmPerDayFor(w, skilled.id, 'scooter') > vehicles.kmPerDayFor(w, unskilled.id, 'scooter'),
    'a skilled driver should out-pace an unskilled one in the identical vehicle',
  );
  assert.ok(vehicles.kmPerDayFor(w, skilled.id, 'scooter') <= vehicles.KM_PER_DAY_BY_TYPE.scooter * 1.25 + 1e-9);
  assert.ok(vehicles.kmPerDayFor(w, unskilled.id, 'scooter') >= vehicles.KM_PER_DAY_BY_TYPE.scooter * 0.75 - 1e-9);
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
  equipBypassTool(perfectThief.id);

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
  // deterministic hit -- `seededDraw(...) < 1` is always true. Equipped
  // with a real bypass tool (task #168) so this stays the unpenalised
  // chance the comment above describes.
  const perfectThief = engine.generateNPC({ traitValueFor: () => 100 });
  equipBypassTool(perfectThief.id);
  const result = vehicles.stealVehicle(w, perfectThief.id, victim.id, 'scooter', { tick: 0 });
  assert.equal(result.stolen, true);
  assert.equal(result.technique, 'key_programmer', 'a real bypass tool is used as the technique, not a legacy one');
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
  equipBypassTool(skilledThief.id);
  let stolen = false;
  for (let tick = 0; tick < 10 && !stolen; tick += 1) {
    const result = vehicles.stealVehicle(w, skilledThief.id, victim.id, 'scooter', { tick });
    stolen = result.stolen;
  }
  assert.ok(stolen, 'a real, highly skilled thief should succeed within 10 real tries');
});

// ---------------------------------------------------------------------
// stealVehicle — the real tool requirement (task #168)
// ---------------------------------------------------------------------

test('stealVehicle: a real bypass tool (key_programmer/relay_attack_device) is used as the technique, and carries no real penalty', () => {
  const victim = mechanic();
  craftScooter(victim.id);
  const thief = engine.generateNPC({ traitValueFor: () => 100 });
  heistTools.registerItems(w);
  inventory.give(w, { entityId: thief.id, itemName: 'relay_attack_device' });

  const result = vehicles.stealVehicle(w, thief.id, victim.id, 'scooter', { tick: 0 });
  assert.equal(result.technique, 'relay_attack_device');
  assert.equal(result.stolen, true, 'a real tool at aptitude 100 must clear the unpenalised chance of 1');
});

test('stealVehicle: with neither real bypass tool, a legacy technique is attempted at a real, flagged penalty', () => {
  // aptitude 100, no tool -> chance = min(1, 0.5 + 0.5 - 0.15) = 0.85,
  // not 1 -- the real cost of a method NICB documents as obsolete. A
  // fresh victim/scooter each try, since a success removes the real
  // item a next try needs to hold.
  const thief = engine.generateNPC({ traitValueFor: () => 100 });
  let sawFailure = false;
  let sawSuccess = false;
  for (let tick = 0; tick < 60 && !sawFailure; tick += 1) {
    const victim = mechanic();
    craftScooter(victim.id);
    const result = vehicles.stealVehicle(w, thief.id, victim.id, 'scooter', { tick });
    assert.ok(vehicles.VEHICLE_THEFT_TECHNIQUES.includes(result.technique),
      'with no real tool the technique must stay one of the real legacy ones');
    if (result.stolen) sawSuccess = true; else sawFailure = true;
  }
  assert.ok(sawFailure,
    'aptitude 100 with no real tool must fail at least once in 60 tries -- it is not chance 1 any more');
  assert.ok(sawSuccess, 'aptitude 100 with no real tool still succeeds most of the time (chance 0.85)');
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
