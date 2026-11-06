// server/weapons.js — real firearms, real ammunition, kept separate, as
// weapons.js's own header explains at length. This file holds that
// module's own unit coverage; crime.js/discovery.js/tick.js's own test
// files carry the integration coverage for the paths those files gained
// (see the bottom of each for the new assertions added alongside this).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const weapons = require('../server/weapons.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');
const technology = require('../server/technology.js');

let nextId = 700000;

function world({ tick = 36500 } = {}) {
  const w = {
    tick,
    seed: 'weapons-test',
    npcs: [],
    deceased: [],
    organizations: [],
    inventory: [],
    barterItems: [],
    properties: [],
    cities: [],
    regions: [],
    employmentRecords: [],
    civilizations: [],
    technologyEras: [],
    civilizationTechnologyProgress: [],
    entityTraits: [],
    nextEntityId: 1,
  };
  economy.reseedIds(w);
  inventory.reseedIds(w);
  return w;
}

function person(w) {
  const npc = { id: nextId++, status: 'active', communityId: null, traits: {} };
  w.npcs.push(npc);
  return npc;
}

// Reaches a named era, the same real ladder test/media.test.js uses
// rather than a fixture's own idea of what "industrialization" means.
function reachEra(w, eraName) {
  if (w.technologyEras.length === 0) technology.seedTechnologyEras(w);
  if (w.civilizations.length === 0) w.civilizations.push({ id: 1, name: 'Test', era: null, stability_index: 50 });
  const era = w.technologyEras.find((e) => e.name === eraName);
  assert.ok(era, `${eraName} is not one of technology.ERA_NAMES`);
  w.civilizationTechnologyProgress.push({ civilization_id: w.civilizations[0].id, era_id: era.id, unlocked_tick: 1 });
}

function employAsEngineer(w, entityId, { employerType = 'business' } = {}) {
  const employer = { id: nextId++, name: 'Factory', type: employerType };
  w.organizations.push(employer);
  economy.hireEntity(w, {
    entityId, employerOrganizationId: employer.id, wage: 50, position: weapons.MANUFACTURING_OCCUPATION,
  });
  return employer;
}

function placeWithChain(w, { landmarkCategory = null, countryKey = null } = {}) {
  const region = { id: nextId++, country_key: countryKey };
  w.regions.push(region);
  const city = { id: nextId++, region_id: region.id };
  w.cities.push(city);
  const property = { id: nextId++, city_id: city.id, landmark_category: landmarkCategory };
  w.properties.push(property);
  return property;
}

// -- item registration ---------------------------------------------------

test('registerItems adds every real firearm, ammunition and the switch exactly once, idempotently', () => {
  const w = world();
  const added = weapons.registerItems(w);
  assert.equal(added, weapons.itemDefinitions().length);
  const names = w.barterItems.map((i) => i.name);
  for (const name of weapons.FIREARM_NAMES) {
    if (name === 'zip_gun') continue; // registered by salvage.js, not this file -- see weapons.js's own header
    assert.ok(names.includes(name), `${name} should be registered`);
  }
  for (const name of weapons.AMMUNITION_NAMES) assert.ok(names.includes(name));
  assert.ok(names.includes(weapons.SWITCH_ITEM));

  const before = w.barterItems.length;
  const addedAgain = weapons.registerItems(w);
  assert.equal(addedAgain, 0, 'a second call registers nothing new');
  assert.equal(w.barterItems.length, before);
});

// -- equippedFirearm / isFunctioningFirearm ------------------------------

test('equippedFirearm reads only what is actually equipped, never what is merely held', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  assert.equal(weapons.equippedFirearm(w, p.id), null, 'held, not equipped -- not armed');

  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  assert.equal(weapons.equippedFirearm(w, p.id), 'pistol');
});

test('isFunctioningFirearm is the real, literal gate: equipped gun AND a held round of its own ammunition', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);

  assert.equal(weapons.isFunctioningFirearm(w, p.id), false, 'nobody armed yet');

  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  assert.equal(
    weapons.isFunctioningFirearm(w, p.id), false,
    'a real object that does nothing -- equipped but no ammunition of its own',
  );

  inventory.give(w, { entityId: p.id, itemName: 'pistol_rounds', quantity: 5 });
  assert.equal(weapons.isFunctioningFirearm(w, p.id), true);
});

test('isFunctioningFirearm does not accept the WRONG ammunition for the equipped gun', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  inventory.give(w, { entityId: p.id, itemName: 'rifle_rounds', quantity: 10 });
  assert.equal(weapons.isFunctioningFirearm(w, p.id), false, 'rifle rounds do not load a pistol');
});

// -- isSwitchModified -----------------------------------------------------

test('isSwitchModified fires only for a switchable firearm actually holding a real switch', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  assert.equal(weapons.isSwitchModified(w, p.id), false, 'no switch held');

  inventory.give(w, { entityId: p.id, itemName: weapons.SWITCH_ITEM });
  assert.equal(weapons.isSwitchModified(w, p.id), true);
});

test('isSwitchModified never fires for zip_gun or machine_gun -- neither is a SWITCHABLE_FIREARMS entry', () => {
  const w = world();
  weapons.registerItems(w);
  require('../server/salvage.js').registerItems(w);

  const zipHolder = person(w);
  inventory.give(w, { entityId: zipHolder.id, itemName: 'zip_gun' });
  inventory.equip(w, { entityId: zipHolder.id, itemName: 'zip_gun' });
  inventory.give(w, { entityId: zipHolder.id, itemName: weapons.SWITCH_ITEM });
  assert.equal(weapons.isSwitchModified(w, zipHolder.id), false, 'a zip gun takes no switch');

  const mgHolder = person(w);
  inventory.give(w, { entityId: mgHolder.id, itemName: 'machine_gun' });
  inventory.equip(w, { entityId: mgHolder.id, itemName: 'machine_gun' });
  inventory.give(w, { entityId: mgHolder.id, itemName: weapons.SWITCH_ITEM });
  assert.equal(weapons.isSwitchModified(w, mgHolder.id), false, 'already fires on its own burst');
});

// -- fireRound -------------------------------------------------------------

test('fireRound consumes exactly one round for an ordinary pistol/rifle shot', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  inventory.give(w, { entityId: p.id, itemName: 'pistol_rounds', quantity: 3 });

  const result = weapons.fireRound(w, p.id);
  assert.equal(result.fired, true);
  assert.equal(result.roundsUsed, 1);
  assert.equal(result.roundsLeft, 2);
  assert.equal(inventory.quantityOf(w, p.id, 'pistol_rounds'), 2);
});

test('fireRound clamps to what is actually held, never going negative', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'rifle' });
  inventory.equip(w, { entityId: p.id, itemName: 'rifle' });
  inventory.give(w, { entityId: p.id, itemName: 'rifle_rounds', quantity: 1 });
  inventory.give(w, { entityId: p.id, itemName: weapons.SWITCH_ITEM });
  inventory.equip(w, { entityId: p.id, itemName: weapons.SWITCH_ITEM });

  // Burst would want 5 (machine_gun's ROUNDS_PER_SHOT), only 1 is held.
  const result = weapons.fireRound(w, p.id);
  assert.equal(result.fired, true);
  assert.equal(result.roundsUsed, 1, 'clamped to what was actually held');
  assert.equal(inventory.quantityOf(w, p.id, 'rifle_rounds'), 0);
  assert.ok(inventory.quantityOf(w, p.id, 'rifle_rounds') >= 0);
});

test('fireRound on a switch-modified semi-auto spends the machine_gun burst size, not the ordinary one', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  inventory.give(w, { entityId: p.id, itemName: 'pistol_rounds', quantity: 20 });
  inventory.give(w, { entityId: p.id, itemName: weapons.SWITCH_ITEM });
  inventory.equip(w, { entityId: p.id, itemName: weapons.SWITCH_ITEM });

  const result = weapons.fireRound(w, p.id);
  assert.equal(result.roundsUsed, weapons.ROUNDS_PER_SHOT.machine_gun);
  assert.equal(inventory.quantityOf(w, p.id, 'pistol_rounds'), 20 - weapons.ROUNDS_PER_SHOT.machine_gun);
});

test('fireRound on an unarmed person fires nothing and takes nothing', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  const result = weapons.fireRound(w, p.id);
  assert.equal(result.fired, false);
  assert.equal(result.roundsUsed, 0);
});

// -- regionHasTrackedMilitaryCapability / availableAt ----------------------

test('regionHasTrackedMilitaryCapability is honest absence at every missing link in the chain', () => {
  const w = world();
  assert.equal(weapons.regionHasTrackedMilitaryCapability(w, 999), false, 'no property at all');

  const noCity = { id: 1, city_id: null };
  w.properties.push(noCity);
  assert.equal(weapons.regionHasTrackedMilitaryCapability(w, 1), false, 'property with no city');

  const cityNoRegion = { id: 2, city_id: 10 };
  w.properties.push(cityNoRegion);
  w.cities.push({ id: 10, region_id: null });
  assert.equal(weapons.regionHasTrackedMilitaryCapability(w, 2), false, 'city with no region');

  const regionNoCountry = { id: 3, city_id: 11 };
  w.properties.push(regionNoCountry);
  w.cities.push({ id: 11, region_id: 20 });
  w.regions.push({ id: 20, country_key: null });
  assert.equal(weapons.regionHasTrackedMilitaryCapability(w, 3), false, 'region with no country key');

  const untrackedCountry = placeWithChain(w, { countryKey: 'not-a-real-country-key' });
  assert.equal(weapons.regionHasTrackedMilitaryCapability(w, untrackedCountry.id), false, 'a country key this engine has no tracked figure for');

  const tracked = placeWithChain(w, { countryKey: 'russian' });
  assert.equal(weapons.regionHasTrackedMilitaryCapability(w, tracked.id), true, 'russia has a real, tracked SIPRI figure');
});

test('availableAt refuses the switch everywhere, and gates machine_gun on a government-building in a militarily tracked region', () => {
  const w = world();
  assert.equal(weapons.availableAt(w, 1, weapons.SWITCH_ITEM), false, 'never a discovery location, by direct instruction');

  const ordinary = placeWithChain(w, { landmarkCategory: 'grocery-store', countryKey: 'russian' });
  assert.equal(weapons.availableAt(w, ordinary.id, 'machine_gun'), false, 'not a government-building');

  const untrackedGov = placeWithChain(w, { landmarkCategory: 'government-building', countryKey: null });
  assert.equal(weapons.availableAt(w, untrackedGov.id, 'machine_gun'), false, 'government-building but no tracked military signal');

  const trackedGov = placeWithChain(w, { landmarkCategory: 'government-building', countryKey: 'russian' });
  assert.equal(weapons.availableAt(w, trackedGov.id, 'machine_gun'), true);

  assert.equal(weapons.availableAt(w, ordinary.id, 'pistol'), true, 'everything else answers true wherever its category pool already allows it');
});

// -- canManufactureAmmunition / manufactureAmmunition -----------------------

test('canManufactureAmmunition refuses a non-ammunition item name', () => {
  const w = world();
  const p = person(w);
  const check = weapons.canManufactureAmmunition(w, p.id, 'pistol');
  assert.equal(check.ok, false);
  assert.match(check.reason, /not an ammunition item/);
});

test('canManufactureAmmunition gates on the real era first', () => {
  const w = world();
  const p = person(w);
  employAsEngineer(w, p.id);
  const check = weapons.canManufactureAmmunition(w, p.id, 'pistol_rounds');
  assert.equal(check.ok, false);
  assert.equal(check.era, weapons.MANUFACTURING_ERA);
  assert.match(check.reason, /industrialization/);
});

test('canManufactureAmmunition gates on the real occupation, even once the era is reached', () => {
  const w = world();
  reachEra(w, weapons.MANUFACTURING_ERA);
  const p = person(w);
  const check = weapons.canManufactureAmmunition(w, p.id, 'pistol_rounds');
  assert.equal(check.ok, false);
  assert.match(check.reason, /engineer/);
});

test('canManufactureAmmunition gates on a real business employer, not an individual', () => {
  const w = world();
  reachEra(w, weapons.MANUFACTURING_ERA);
  const p = person(w);
  employAsEngineer(w, p.id, { employerType: 'faction' });
  const check = weapons.canManufactureAmmunition(w, p.id, 'pistol_rounds');
  assert.equal(check.ok, false);
  assert.match(check.reason, /real business/);
});

test('canManufactureAmmunition passes once era, occupation and employer all really hold', () => {
  const w = world();
  reachEra(w, weapons.MANUFACTURING_ERA);
  const p = person(w);
  employAsEngineer(w, p.id);
  const check = weapons.canManufactureAmmunition(w, p.id, 'pistol_rounds');
  assert.equal(check.ok, true);
});

test('manufactureAmmunition throws with the real reason when the gate fails', () => {
  const w = world();
  const p = person(w);
  assert.throws(
    () => weapons.manufactureAmmunition(w, p.id, 'pistol_rounds'),
    /industrialization/,
  );
});

test('manufactureAmmunition gives exactly one bounded real batch, registering items if needed', () => {
  const w = world();
  reachEra(w, weapons.MANUFACTURING_ERA);
  const p = person(w);
  employAsEngineer(w, p.id);
  assert.equal(w.barterItems.length, 0, 'not registered yet');

  const result = weapons.manufactureAmmunition(w, p.id, 'pistol_rounds');
  assert.equal(result.quantity, weapons.ROUNDS_PER_MANUFACTURE);
  assert.equal(inventory.quantityOf(w, p.id, 'pistol_rounds'), weapons.ROUNDS_PER_MANUFACTURE);
  assert.ok(w.barterItems.length > 0, 'registerItems ran as a side effect');

  // One real batch per call -- calling again gives a second batch, not
  // a passive regen that would have happened with no call at all.
  weapons.manufactureAmmunition(w, p.id, 'pistol_rounds');
  assert.equal(inventory.quantityOf(w, p.id, 'pistol_rounds'), weapons.ROUNDS_PER_MANUFACTURE * 2);
});

// -- mutation verification ---------------------------------------------
// Held inline rather than as a separate script, same posture as the
// extended-family recursion guard CLAUDE.md's forty-ninth standing rule
// names: this IS the test that would have failed to catch the bug, run
// against a deliberately broken copy of the real check, then reverted.

test('mutation check: a version of isFunctioningFirearm that skips the ammunition gate would misclassify an unloaded gun as armed -- the real one does not', () => {
  const w = world();
  weapons.registerItems(w);
  const p = person(w);
  inventory.give(w, { entityId: p.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: p.id, itemName: 'pistol' });
  // No ammunition given at all.

  // The real function: must read false.
  assert.equal(weapons.isFunctioningFirearm(w, p.id), false);

  // The mutated version this guards against: equipped-alone would read
  // true, which is exactly the bug the header calls out by name.
  const mutatedWouldSay = weapons.equippedFirearm(w, p.id) !== null;
  assert.equal(mutatedWouldSay, true, 'equipped alone is true -- proving the real gate is doing real work, not a no-op check');
});

module.exports = { world, person, reachEra, employAsEngineer, placeWithChain };
