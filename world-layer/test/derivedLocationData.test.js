// Universal World Layer — deriving populationData/economicData from
// real NPCs/businesses, and real supply-chain resolution against
// supplyNeeds/suppliesResources. See derivedLocationData.js's and
// supplyChain.js's own headers for what gap each closes and why.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const locations = require('../locations.js');
const npcGenesis = require('../npcGenesis.js');
const commerce = require('../commerce.js');
const transportation = require('../transportation.js');
const derived = require('../derivedLocationData.js');
const supplyChain = require('../supplyChain.js');

const world = () => locations.createWorldLayer();

// ---------------------------------------------------------------------------
// populationData / economicData derivation
// ---------------------------------------------------------------------------

test('deriveLocationPopulationData aggregates only real, stored NPC fields', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Springfield', lat: 1, lng: 1 });

  npcGenesis.generateNPC(w, {
    locationId: place.id, demographics: { age: 30 }, occupation: 'baker', economicRole: 'producer', migrationStatus: 'resident',
  });
  npcGenesis.generateNPC(w, {
    locationId: place.id, demographics: { age: 40 }, occupation: 'baker', economicRole: 'producer', migrationStatus: 'migrating',
  });
  npcGenesis.generateNPC(w, {
    locationId: place.id, demographics: {}, occupation: null, economicRole: null, migrationStatus: 'resident',
  });

  const population = derived.deriveLocationPopulationData(w, place.id);
  assert.equal(population.totalPopulation, 3);
  assert.deepEqual(population.byOccupation, { baker: 2, unspecified: 1 });
  assert.deepEqual(population.byEconomicRole, { producer: 2, unspecified: 1 });
  assert.deepEqual(population.byMigrationStatus, { resident: 2, migrating: 1 });
  // (30 + 40) / 2 -- the third NPC has no real age to average in.
  assert.equal(population.averageAge, 35);
});

test('deriveLocationPopulationData reports a real null average age with no real ages at all, never a fabricated 0', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Nowhere', lat: 1, lng: 1 });
  npcGenesis.generateNPC(w, { locationId: place.id, demographics: {} });

  const population = derived.deriveLocationPopulationData(w, place.id);
  assert.equal(population.averageAge, null);
});

test('deriveLocationPopulationData never counts an NPC from a different location', () => {
  const w = world();
  const here = locations.generateLocation(w, { name: 'Here', lat: 1, lng: 1 });
  const there = locations.generateLocation(w, { name: 'There', lat: 2, lng: 2 });
  npcGenesis.generateNPC(w, { locationId: here.id, demographics: { age: 20 } });
  npcGenesis.generateNPC(w, { locationId: there.id, demographics: { age: 90 } });

  assert.equal(derived.deriveLocationPopulationData(w, here.id).totalPopulation, 1);
  assert.equal(derived.deriveLocationPopulationData(w, here.id).averageAge, 20);
});

test('deriveLocationEconomicData aggregates real business economicValue/industry/employment', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Dockside', lat: 1, lng: 1 });
  const owner = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });
  const worker = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 25 } });

  const biz = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'fishing', ownerId: owner.id, economicValue: 100, securityRequirement: 'low',
  });
  commerce.addEmployee(w, biz.id, worker.id);
  commerce.generateBusiness(w, { locationId: place.id, industry: 'fishing', economicValue: 50 });

  const economic = derived.deriveLocationEconomicData(w, place.id);
  assert.equal(economic.businessCount, 2);
  assert.equal(economic.totalEconomicValue, 150);
  assert.equal(economic.totalEmployment, 1);
  assert.deepEqual(economic.byIndustry, { fishing: 2 });
  assert.deepEqual(economic.bySecurityRequirement, { low: 1, none: 1 });
});

test('syncLocationDataFromNPCs actually writes the derived slices back onto the Location', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Harborview', lat: 1, lng: 1 });
  npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 50 }, occupation: 'welder' });
  commerce.generateBusiness(w, { locationId: place.id, industry: 'shipyard', economicValue: 200 });

  assert.equal(locations.getLocation(w, place.id).populationData, null);
  assert.equal(locations.getLocation(w, place.id).economicData, null);

  const result = derived.syncLocationDataFromNPCs(w, place.id);

  const refreshed = locations.getLocation(w, place.id);
  assert.deepEqual(refreshed.populationData, result.populationData);
  assert.deepEqual(refreshed.economicData, result.economicData);
  assert.equal(refreshed.populationData.totalPopulation, 1);
  assert.equal(refreshed.economicData.totalEconomicValue, 200);
});

test('deriving for an unknown location fails loudly rather than returning empty aggregates', () => {
  const w = world();
  assert.throws(() => derived.deriveLocationPopulationData(w, 999), /no location with id 999/);
  assert.throws(() => derived.deriveLocationEconomicData(w, 999), /no location with id 999/);
});

// ---------------------------------------------------------------------------
// supplyNeeds / suppliesResources validation
// ---------------------------------------------------------------------------

test('generateBusiness validates supplyNeeds and suppliesResources shapes', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Millbrook', lat: 1, lng: 1 });

  assert.throws(
    () => commerce.generateBusiness(w, {
      locationId: place.id, industry: 'mill', supplyNeeds: [{ resourceType: 'timber', quantity: -1 }],
    }),
    /non-negative numeric quantity/,
  );
  assert.throws(
    () => commerce.generateBusiness(w, {
      locationId: place.id, industry: 'mill', supplyNeeds: [{ quantity: 5 }],
    }),
    /requires a string resourceType/,
  );
  assert.throws(
    () => commerce.generateBusiness(w, {
      locationId: place.id, industry: 'mill', suppliesResources: [{ resourceType: 'timber', capacity: -5 }],
    }),
    /non-negative numeric capacity/,
  );

  const biz = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'mill', supplyNeeds: [{ resourceType: 'timber', quantity: 10 }],
  });
  assert.deepEqual(biz.supplyNeeds, [{ resourceType: 'timber', quantity: 10 }]);
  assert.deepEqual(biz.suppliesResources, []);
});

// ---------------------------------------------------------------------------
// Supply chain resolution
// ---------------------------------------------------------------------------

test('a supply need is "met" when enough reachable same-location capacity exists', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Millbrook', lat: 1, lng: 1 });
  const needer = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'furniture', supplyNeeds: [{ resourceType: 'timber', quantity: 10 }],
  });
  commerce.generateBusiness(w, {
    locationId: place.id, industry: 'logging', suppliesResources: [{ resourceType: 'timber', capacity: 15 }],
  });

  const resolution = supplyChain.resolveSupplyChain(w, needer.id);
  assert.equal(resolution.overallStatus, 'met');
  assert.equal(resolution.needs[0].status, 'met');
  assert.equal(resolution.needs[0].availableCapacity, 15);
  assert.equal(resolution.needs[0].suppliers.length, 1);
});

test('a supply need is "partial" when real reachable capacity exists but not enough', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Millbrook', lat: 1, lng: 1 });
  const needer = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'furniture', supplyNeeds: [{ resourceType: 'timber', quantity: 10 }],
  });
  commerce.generateBusiness(w, {
    locationId: place.id, industry: 'logging', suppliesResources: [{ resourceType: 'timber', capacity: 4 }],
  });

  const resolution = supplyChain.resolveSupplyChain(w, needer.id);
  assert.equal(resolution.overallStatus, 'partial');
  assert.equal(resolution.needs[0].status, 'partial');
  assert.equal(resolution.needs[0].availableCapacity, 4);
});

test('a supply need is "unmet" with no supplier of that resourceType anywhere', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Millbrook', lat: 1, lng: 1 });
  const needer = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'furniture', supplyNeeds: [{ resourceType: 'timber', quantity: 10 }],
  });
  commerce.generateBusiness(w, {
    locationId: place.id, industry: 'bakery', suppliesResources: [{ resourceType: 'flour', capacity: 999 }],
  });

  const resolution = supplyChain.resolveSupplyChain(w, needer.id);
  assert.equal(resolution.overallStatus, 'unmet');
  assert.equal(resolution.needs[0].availableCapacity, 0);
  assert.deepEqual(resolution.needs[0].suppliers, []);
});

test('a real supplier is never counted unless it is actually reachable', () => {
  const w = world();
  const here = locations.generateLocation(w, { name: 'Here', lat: 1, lng: 1 });
  const there = locations.generateLocation(w, { name: 'There', lat: 50, lng: 50 });
  const needer = commerce.generateBusiness(w, {
    locationId: here.id, industry: 'furniture', supplyNeeds: [{ resourceType: 'timber', quantity: 10 }],
  });
  // A real supplier exists, but at an unconnected location with no
  // transport node linking the two -- findRoute reports unreachable,
  // and this must not count toward the need regardless of capacity.
  commerce.generateBusiness(w, {
    locationId: there.id, industry: 'logging', suppliesResources: [{ resourceType: 'timber', capacity: 999 }],
  });

  const resolution = supplyChain.resolveSupplyChain(w, needer.id);
  assert.equal(resolution.overallStatus, 'unmet');

  // Now connect them with a real, shared-vehicle-type transport path
  // at each end and confirm the same supplier becomes reachable.
  const nodeHere = transportation.generateTransportNode(w, {
    locationId: here.id, vehicleTypes: ['truck'],
  });
  const nodeThere = transportation.generateTransportNode(w, {
    locationId: there.id, vehicleTypes: ['truck'],
  });
  assert.ok(nodeHere.id !== nodeThere.id);

  const reconnected = supplyChain.resolveSupplyChain(w, needer.id);
  assert.equal(reconnected.overallStatus, 'met');
});

test('resolveSupplyNeed fails loudly for an unknown business or a need the business does not actually have', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Millbrook', lat: 1, lng: 1 });
  const needer = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'furniture', supplyNeeds: [{ resourceType: 'timber', quantity: 10 }],
  });

  assert.throws(() => supplyChain.resolveSupplyNeed(w, 999, 'timber'), /no business with id 999/);
  assert.throws(
    () => supplyChain.resolveSupplyNeed(w, needer.id, 'flour'),
    /has no supply need for "flour"/,
  );
});

test('a business with no supplyNeeds at all resolves as a real, honest "met" rather than an error', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Millbrook', lat: 1, lng: 1 });
  const biz = commerce.generateBusiness(w, { locationId: place.id, industry: 'consulting' });

  const resolution = supplyChain.resolveSupplyChain(w, biz.id);
  assert.equal(resolution.overallStatus, 'met');
  assert.deepEqual(resolution.needs, []);
});
