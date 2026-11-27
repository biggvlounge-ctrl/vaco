// "Explore skyscraper, explore library... every time we learn how to
// fish, we read a book... finding [main characters] will help us
// build missions that will happen in normal situations" — by direct
// instruction. `server/missionTriggers.js` is the real, bounded-chance
// wiring between a player visiting a real location and the real main
// character controlling it — now all four categories
// (`mainCharacters.mainCharactersOf`), not criminal alone. See that
// file's own header for the measured rate, the fixed category-priority
// order, and the honest per-category leadership-availability scope
// (`search-location` always, `practise-habit` only with an explicit
// `locationPropertyId`).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const missionTriggers = require('../server/missionTriggers.js');
const missions = require('../server/missions.js');
const engine = require('../server/engine.js');

// Standing rule 8: a hand-built world with exactly the real substrate
// `maybeTriggerMission` reads — a landmark property, a community, and
// (when requested) a real faction actually holding that community's
// ground with a real, installed leader.
function baseWorld() {
  return {
    tick: 0,
    cities: [{ id: 1, region_id: null }],
    communities: [{ id: 9, city_id: 1 }],
    properties: [{ id: 501, community_id: 9, landmark_category: 'library', name: 'Central Library' }],
    organizations: [],
    governments: [],
    territoryBlocks: [],
    entityTraits: [],
    missions: [],
  };
}

// Same real-generator pattern test/authority.test.js and
// test/mainCharacters.test.js already use — `authority.holderOf`
// reads a faction's traits through `getLiveEntity`, which needs real
// `entity_traits` rows, not a hand-set `.traits` sheet.
function withControllingFaction(w, { leaderId = 701 } = {}) {
  const faction = engine.generateFaction({
    name: 'The Outfit', type: 'gang', traitValueFor: () => 80, leaderId,
  });
  w.organizations.push(faction);
  w.entityTraits = engine.WorldState.entityTraits.filter((r) => r.entity_id === faction.id);
  w.territoryBlocks = [{ id: 1, faction_id: faction.id, city_id: 1, community_id: 9, status: 'controlled' }];
  return faction;
}

// Real substrate for `mainCharacters.politicalLeaderOf`: a government
// organization plus the real `governments` row that scopes it to this
// community's city.
function withGovernment(w, { organizationId = 601, leaderId = 801, name = 'City Hall' } = {}) {
  const government = { id: organizationId, type: 'government', name, leader_id: leaderId };
  w.organizations.push(government);
  w.governments.push({ organization_id: organizationId, scope_type: 'city', scope_id: 1 });
  return government;
}

// Real substrate for `mainCharacters.religiousLeaderOf`: a real
// `type: 'religion'` organization scoped directly to this community —
// the forty-eighth standing rule's own `community_id` convention.
function withReligiousOrder(w, { organizationId = 602, leaderId = 802, name = 'The Chapel' } = {}) {
  const order = {
    id: organizationId, type: 'religion', name, community_id: 9, leader_id: leaderId,
  };
  w.organizations.push(order);
  return order;
}

// Real substrate for `mainCharacters.businessLeaderOf`: a real business
// organization actually operating a real property in this community.
function withBusiness(w, { organizationId = 603, leaderId = 803, name = 'The Corner Store' } = {}) {
  const business = {
    id: organizationId, type: 'business', name, influence: 50, assets: 0, leader_id: leaderId,
  };
  w.organizations.push(business);
  w.properties[0].operating_organization_id = organizationId;
  return business;
}

test('no faction holding this ground: honestly nothing, never thrown', () => {
  const w = baseWorld();
  assert.equal(missionTriggers.maybeTriggerMission(w, 1, 501, { tick: 0 }), null);
});

test('a faction holds the ground but has no installed leader yet: honestly nothing', () => {
  const w = baseWorld();
  withControllingFaction(w, { leaderId: null });
  assert.equal(missionTriggers.maybeTriggerMission(w, 1, 501, { tick: 0 }), null);
});

test('a real faction with a real leader: repeated visits eventually generate a real mission, at the measured rate', () => {
  const w = baseWorld();
  const faction = withControllingFaction(w);

  let generated = null;
  let tick = 0;
  // The measured table in missionTriggers.js's own header says 0.1
  // should land well within 50 tries (mean 10.2) — generous headroom
  // above that so this test is not itself a coin flip on the seed.
  for (; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated, 'expected a mission to have generated within 50 visits');
  assert.equal(generated.location_property_id, 501);
  assert.equal(generated.controlling_faction_id, faction.id);
  assert.equal(generated.status, 'available');
  assert.equal(w.missions.length, 1);
});

test('a location with an already-open mission from its own main character gets no second one', () => {
  const w = baseWorld();
  withControllingFaction(w);
  // Force an already-open mission at this exact location, bypassing
  // the draw, to isolate the cap itself from the rate.
  missions.generateMission(w, { locationId: 501, objective: 'already working this one' });
  assert.equal(w.missions.length, 1);

  for (let tick = 0; tick < 100; tick += 1) {
    const result = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
    assert.equal(result, null, `tick ${tick}: must not stack a second open mission on this location`);
  }
  assert.equal(w.missions.length, 1, 'still exactly the one mission, never a second');
});

test('a resolved mission frees the location up again', () => {
  const w = baseWorld();
  withControllingFaction(w);
  const first = missions.generateMission(w, { locationId: 501, controllingFactionId: null, objective: 'first job' });
  first.status = 'resolved';
  assert.equal(missionTriggers.hasOpenMissionAt(w, 501), false);
});

test('reinforceHabit: practising at a real controlled location can generate a mission; practising with no location never can', () => {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const community = engine.generateCommunity({});
  const property = engine.generateProperty({
    type: 'commercial', value: 50000, communityId: community.id, landmarkCategory: 'library',
  });

  const faction = engine.generateFaction({ name: 'Measured Outfit', traitValueFor: () => 80, leaderId: npc.id });
  engine.WorldState.territoryBlocks.push({
    id: engine.WorldState.territoryBlocks.length + 1,
    faction_id: faction.id, city_id: 1, community_id: community.id, status: 'controlled',
  });

  // No location at all: never triggers, however long you try. The
  // tick is advanced by hand each time (rather than
  // `engine.advanceTick()`, which runs the full pipeline) because the
  // draw is keyed on (tick, propertyId, entityId) — standing rule 8,
  // isolating the one thing this test is actually about.
  for (let i = 0; i < 20; i += 1) {
    engine.WorldState.tick = i;
    const result = engine.dispatchAction(player.id, { action: 'practise-habit', name: 'reading' });
    assert.equal(result.result.missionGenerated, null);
  }

  // With a real location whose community has a real criminal leader:
  // eventually a mission, same measured rate as search-location.
  let found = null;
  for (let i = 0; i < 50 && !found; i += 1) {
    engine.WorldState.tick = 1000 + i;
    const result = engine.dispatchAction(player.id, {
      action: 'practise-habit', name: 'reading', locationPropertyId: property.id,
    });
    found = result.result.missionGenerated;
  }
  assert.ok(found, 'expected practise-habit with a real controlled location to eventually generate a mission');
  assert.equal(found.location_property_id, property.id);
});

// ---------------------------------------------------------------------
// Political, religious, and business — the three categories this
// mechanism was originally scoped away from, now wired through
// issuing_organization_id/issued_by_entity_id instead of
// controllingFactionId, since none of the three is a real faction.
// ---------------------------------------------------------------------

test('a real government with a real leader: repeated visits eventually generate a real mission, routed through issuing_organization_id, never controlling_faction_id', () => {
  const w = baseWorld();
  const government = withGovernment(w);

  let generated = null;
  for (let tick = 0; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated, 'expected a mission to have generated within 50 visits');
  assert.equal(generated.location_property_id, 501);
  assert.equal(generated.controlling_faction_id, null, 'a government is never a real controlling faction');
  assert.equal(generated.issuing_organization_id, government.id);
  assert.equal(generated.issued_by_entity_id, 801);
  assert.match(generated.objective, /constituent matter/);
});

test('a real religious order with a real leader: same real mechanism, religious objective text', () => {
  const w = baseWorld();
  const order = withReligiousOrder(w);

  let generated = null;
  for (let tick = 0; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated);
  assert.equal(generated.controlling_faction_id, null);
  assert.equal(generated.issuing_organization_id, order.id);
  assert.equal(generated.issued_by_entity_id, 802);
  assert.match(generated.objective, /favor for/);
});

test('a real business operating here with a real leader: same real mechanism, business objective text', () => {
  const w = baseWorld();
  const business = withBusiness(w);

  let generated = null;
  for (let tick = 0; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated);
  assert.equal(generated.controlling_faction_id, null);
  assert.equal(generated.issuing_organization_id, business.id);
  assert.equal(generated.issued_by_entity_id, 803);
  assert.match(generated.objective, /Pick up some work/);
});

test('no category anywhere has a real installed leader: honestly nothing, across all four', () => {
  const w = baseWorld();
  // A government and a religious order both exist, neither with a
  // real leader yet — the same "ground is held, nobody installed"
  // shape the original criminal-only test already covered, now
  // checked for the other two categories too.
  withGovernment(w, { leaderId: null });
  withReligiousOrder(w, { leaderId: null });
  for (let tick = 0; tick < 50; tick += 1) {
    assert.equal(missionTriggers.maybeTriggerMission(w, 1, 501, { tick }), null);
  }
});

test('priority order: a criminal hold wins over a real government, even though both have real leaders', () => {
  const w = baseWorld();
  const faction = withControllingFaction(w);
  withGovernment(w);

  let generated = null;
  for (let tick = 0; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated);
  assert.equal(generated.controlling_faction_id, faction.id, 'criminal must win priority over political');
  assert.equal(generated.issuing_organization_id, undefined, 'the criminal path never sets issuing_organization_id at all -- same as every mission before this round');
});

test('priority order: political wins over religious and business when no criminal hold exists', () => {
  const w = baseWorld();
  const government = withGovernment(w);
  withReligiousOrder(w);
  withBusiness(w);

  let generated = null;
  for (let tick = 0; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated);
  assert.equal(generated.issuing_organization_id, government.id, 'political must win priority over religious and business');
});

test('priority order: religious wins over business when no criminal or political leader exists', () => {
  const w = baseWorld();
  const order = withReligiousOrder(w);
  withBusiness(w);

  let generated = null;
  for (let tick = 0; tick < 50 && !generated; tick += 1) {
    generated = missionTriggers.maybeTriggerMission(w, 1, 501, { tick });
  }
  assert.ok(generated);
  assert.equal(generated.issuing_organization_id, order.id, 'religious must win priority over business');
});

test('a mission from a political/religious/business main character still respects the one-open-mission-per-location cap', () => {
  const w = baseWorld();
  withGovernment(w);
  missions.generateMission(w, { locationId: 501, objective: 'already working this one' });
  assert.equal(w.missions.length, 1);

  for (let tick = 0; tick < 100; tick += 1) {
    assert.equal(missionTriggers.maybeTriggerMission(w, 1, 501, { tick }), null);
  }
  assert.equal(w.missions.length, 1);
});

// ---------------------------------------------------------------------
// maybeTriggerItemMission — task #101, "finding a police uniform
// ignites an infiltration mission." No uniform is a real item
// anywhere in this catalogue (checked directly); the real analogue is
// disguise.js's own mask/wig. Deliberately no tick loop in these
// tests, unlike maybeTriggerMission's own above — this function has
// no probability roll (see its own header for why).
// ---------------------------------------------------------------------

test('a non-item find (a book, an artifact) never triggers an item mission', () => {
  const w = baseWorld();
  withControllingFaction(w);
  assert.equal(
    missionTriggers.maybeTriggerItemMission(w, 1, 501, { kind: 'book', itemName: 'Blueprints' }, { tick: 0 }),
    null,
  );
  assert.equal(
    missionTriggers.maybeTriggerItemMission(w, 1, 501, { kind: 'artifact', name: 'a relic' }, { tick: 0 }),
    null,
  );
  assert.equal(missionTriggers.maybeTriggerItemMission(w, 1, 501, null, { tick: 0 }), null);
});

test('an ordinary found item (not a real disguise item) never triggers an item mission', () => {
  const w = baseWorld();
  withControllingFaction(w);
  assert.equal(
    missionTriggers.maybeTriggerItemMission(
      w, 1, 501, { kind: 'item', itemName: 'Hammer', category: 'tools' }, { tick: 0 },
    ),
    null,
  );
});

test('finding a real disguise item with a real controlling faction deterministically ignites a real infiltration mission', () => {
  const w = baseWorld();
  const faction = withControllingFaction(w);
  const mission = missionTriggers.maybeTriggerItemMission(
    w, 1, 501, { kind: 'item', itemName: 'mask', category: 'clothing' }, { tick: 0 },
  );
  assert.ok(mission);
  assert.equal(mission.location_property_id, 501);
  assert.equal(mission.controlling_faction_id, faction.id);
  assert.equal(mission.reward, 40, 'the same flat reward every offer*Mission sibling already uses, never a second invented number');
  assert.match(mission.objective, /Use the mask you found to infiltrate/);
  assert.equal(w.missions.length, 1);
});

test('a found wig works identically to a found mask', () => {
  const w = baseWorld();
  withControllingFaction(w);
  const mission = missionTriggers.maybeTriggerItemMission(
    w, 1, 501, { kind: 'item', itemName: 'wig', category: 'clothing' }, { tick: 0 },
  );
  assert.ok(mission);
  assert.match(mission.objective, /Use the wig you found to infiltrate/);
});

test('a real disguise find with no real leader anywhere: honestly nothing', () => {
  const w = baseWorld();
  const mission = missionTriggers.maybeTriggerItemMission(
    w, 1, 501, { kind: 'item', itemName: 'mask', category: 'clothing' }, { tick: 0 },
  );
  assert.equal(mission, null);
});

test('a real disguise find routes through issuing_organization_id for a political/religious/business leader, same as the location trigger', () => {
  const w = baseWorld();
  const government = withGovernment(w);
  const mission = missionTriggers.maybeTriggerItemMission(
    w, 1, 501, { kind: 'item', itemName: 'mask', category: 'clothing' }, { tick: 0 },
  );
  assert.ok(mission);
  assert.equal(mission.controlling_faction_id, null);
  assert.equal(mission.issuing_organization_id, government.id);
  assert.equal(mission.issued_by_entity_id, 801);
});

test('a disguise find never stacks a second mission on a location that already has one open', () => {
  const w = baseWorld();
  withControllingFaction(w);
  missions.generateMission(w, { locationId: 501, objective: 'already working this one' });
  assert.equal(w.missions.length, 1);

  const mission = missionTriggers.maybeTriggerItemMission(
    w, 1, 501, { kind: 'item', itemName: 'mask', category: 'clothing' }, { tick: 0 },
  );
  assert.equal(mission, null);
  assert.equal(w.missions.length, 1, 'still exactly the one mission, never a second');
});

test('searchLocation: finding a real disguise item at a real controlled location surfaces itemMissionGenerated end to end', () => {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const community = engine.generateCommunity({});
  const property = engine.generateProperty({
    type: 'commercial', value: 90000, communityId: community.id, landmarkCategory: 'mall',
  });
  // A real `mall` pool draws only ['clothing', 'luxury goods'] -- never
  // a book or an artifact -- so every one of this property's finds is
  // guaranteed to be an item. Overriding the world's own real item
  // catalogue to hold only the two real disguise items under
  // 'clothing' (never `salvage.registerItems`'s full set, which would
  // also register `woven_garment` and dilute the odds) makes a
  // clothing-category draw land on a real disguise item every time,
  // rather than this test depending on a three-way pick inside it.
  if (!Array.isArray(engine.WorldState.barterItems)) engine.WorldState.barterItems = [];
  engine.WorldState.barterItems.push(
    { name: 'mask', category: 'clothing', baseValue: 10, origin: 'producible' },
    { name: 'wig', category: 'clothing', baseValue: 10, origin: 'producible' },
  );
  // `landmarks.significanceOf` reads `historical_records.significance`
  // through `properties.history_ref` -- the real link `engine
  // .generateProperty` leaves null by default (see that function's own
  // comment). Linking one by hand, at the maximum 100, gives this
  // property the most finds the real `FINDS_PER_SIGNIFICANCE` formula
  // can ever produce (10) -- generous headroom against the real 50/50
  // category draw landing on 'luxury goods' instead, rather than a
  // seed-dependent coin flip.
  const record = { id: engine.WorldState.historicalRecords.length + 9000, significance: 100, where_location_id: property.id };
  engine.WorldState.historicalRecords.push(record);
  property.history_ref = record.id;

  const faction = engine.generateFaction({ name: 'Mall Outfit', traitValueFor: () => 80, leaderId: npc.id });
  engine.WorldState.territoryBlocks.push({
    id: engine.WorldState.territoryBlocks.length + 1,
    faction_id: faction.id, city_id: community.city_id, community_id: community.id, status: 'controlled',
  });

  let sawItemMission = false;
  for (let i = 0; i < 10; i += 1) {
    engine.WorldState.tick = i;
    const result = engine.dispatchAction(player.id, { action: 'search-location', propertyId: property.id });
    if (result.result.itemMissionGenerated) {
      sawItemMission = true;
      assert.match(result.result.found.itemName, /mask|wig/);
      assert.match(result.result.itemMissionGenerated.objective, /infiltrate/);
      break;
    }
  }
  assert.ok(sawItemMission, 'expected a real disguise find to surface itemMissionGenerated within this property\'s own finite, measured supply');
});

// ---------------------------------------------------------------------
// maybeTriggerStalledVehicleMission — task #109, "stalled electric/
// autonomous vehicles after the grid goes down (new mission source)."
// See server/vehicles.js's own header for the real grid-dependency
// model this reads.
// ---------------------------------------------------------------------

const vehicles = require('../server/vehicles.js');
const inventory = require('../server/inventory.js');

function withResident(w, { id = 1, communityId = 9, homePropertyId = 501 } = {}) {
  w.npcs = w.npcs || [];
  w.inventory = w.inventory || [];
  w.barterItems = w.barterItems || [];
  w.npcs.push({ id, status: 'active', communityId, home_property_id: homePropertyId, traits: {} });
  return w.npcs[w.npcs.length - 1];
}

test('a real electricity failure in a city with no stranded EV/AV holder triggers nothing', () => {
  const w = baseWorld();
  withResident(w); // no vehicle held at all
  assert.equal(missionTriggers.maybeTriggerStalledVehicleMission(w, 1, { tick: 0 }), null);
});

test('a real resident holding a real electric_car gets a real mission at their own real home', () => {
  const w = baseWorld();
  const npc = withResident(w);
  vehicles.registerElectricVehicleItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'electric_car', tick: 0 });

  const mission = missionTriggers.maybeTriggerStalledVehicleMission(w, 1, { tick: 0 });
  assert.ok(mission);
  assert.equal(mission.location_property_id, 501);
  assert.match(mission.objective, /electric car/);
  assert.equal(mission.reward, require('../server/missionVariety.js').MISSION_STALLED_VEHICLE_REWARD);
});

test('a real resident holding a real autonomous_car is named correctly in the objective', () => {
  const w = baseWorld();
  const npc = withResident(w);
  vehicles.registerElectricVehicleItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'autonomous_car', tick: 0 });

  const mission = missionTriggers.maybeTriggerStalledVehicleMission(w, 1, { tick: 0 });
  assert.match(mission.objective, /autonomous car/);
});

test('an ordinary gas car never counts as stranded -- this is scoped to the electric/autonomous pair', () => {
  const w = baseWorld();
  const npc = withResident(w);
  const salvage = require('../server/salvage.js');
  salvage.registerItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'car', tick: 0 });

  assert.equal(missionTriggers.maybeTriggerStalledVehicleMission(w, 1, { tick: 0 }), null);
});

test('a resident with no real home property is honestly skipped, never thrown', () => {
  const w = baseWorld();
  const npc = withResident(w, { homePropertyId: null });
  vehicles.registerElectricVehicleItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'electric_car', tick: 0 });

  assert.equal(missionTriggers.maybeTriggerStalledVehicleMission(w, 1, { tick: 0 }), null);
});

test('a location already carrying an open mission does not get a second one stacked on top', () => {
  const w = baseWorld();
  const npc = withResident(w);
  vehicles.registerElectricVehicleItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'electric_car', tick: 0 });
  missions.generateMission(w, { locationId: 501, objective: 'Already here' });

  assert.equal(missionTriggers.maybeTriggerStalledVehicleMission(w, 1, { tick: 0 }), null);
});

// -- the real grid-dependency model in vehicles.js itself --------------

test('isStalled is always false for an ordinary gas vehicle, whatever the grid is doing', () => {
  const w = baseWorld();
  withResident(w);
  assert.equal(vehicles.isStalled(w, 1, 'car'), false);
});

test('an electric/autonomous vehicle is not stalled when no real electricity infrastructure exists to ask -- unknown is not a stall', () => {
  const w = baseWorld();
  withResident(w);
  w.infrastructure = [];
  assert.equal(vehicles.isStalled(w, 1, 'electric_car'), false);
  assert.equal(vehicles.gridAvailableIn(w, 1), null);
});

test('an electric/autonomous vehicle stalls once this city\'s real electricity row has actually failed', () => {
  const infrastructure = require('../server/infrastructure.js');
  const w = baseWorld();
  withResident(w);
  w.infrastructure = [];
  const row = infrastructure.generateInfrastructure(w, { cityId: 1, type: 'electricity' });
  infrastructure.failInfrastructure(w, row, { tick: 0 });

  assert.equal(vehicles.gridAvailableIn(w, 1), false);
  assert.equal(vehicles.isStalled(w, 1, 'electric_car'), true);
  assert.equal(vehicles.isStalled(w, 1, 'autonomous_car'), true);
  assert.equal(vehicles.isStalled(w, 1, 'car'), false);
});

test('beginJourney honestly refuses a real electric vehicle with no real grid to charge from', () => {
  const infrastructure = require('../server/infrastructure.js');
  const travel = require('../server/travel.js');
  const w = baseWorld();
  const npc = withResident(w, { id: 2 });
  w.cities.push({ id: 2, region_id: null });
  w.infrastructure = [];
  const row = infrastructure.generateInfrastructure(w, { cityId: 1, type: 'electricity' });
  infrastructure.failInfrastructure(w, row, { tick: 0 });
  vehicles.registerElectricVehicleItems(w);
  inventory.give(w, { entityId: npc.id, itemName: 'electric_car', tick: 0 });
  w.families = []; w.familyMemberships = []; w.journeys = [];

  assert.throws(
    () => travel.beginJourney(w, npc.id, { destinationCityId: 2, vehicleType: 'electric_car' }),
    /no charge to draw on -- the electricity grid is down/,
  );
});
