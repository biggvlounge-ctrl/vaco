// Direct-reuse gameplay missions (recruit/alliance/spy/barter). See
// server/missionVariety.js's own header for why business/drug/
// extortion are NOT here this round -- each needs a real player verb
// built first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const inventory = require('../server/inventory.js');
const produce = require('../server/produce.js');
const economy = require('../server/economy.js');
const vehicles = require('../server/vehicles.js');
const salvage = require('../server/salvage.js');
const camps = require('../server/camps.js');
const travel = require('../server/travel.js');
const missionVariety = require('../server/missionVariety.js');
const businesses = require('../server/businesses.js');
const drugTrade = require('../server/drugTrade.js');
const membership = require('../server/membership.js');

const YEAR = 365;

const SKILL_DEFINITIONS = engine.TRAIT_DEFINITIONS.filter((d) => d.family === 'skills');

// Real employment, the real Combat skill and Tier 2 (hunter's own real
// requirement) -- the same standing-rule-9 discipline `produce.test
// .js`'s own `person()` follows: `npc.traits` is the birth sheet,
// `getLiveEntity` never reads it, only `entity_traits` rows do.
function employAsHunter(worldState, npc) {
  const org = engine.generateOrganization({ name: `Hunting Co ${npc.id}`, type: 'business' });
  economy.hireEntity(worldState, {
    entityId: npc.id, employerOrganizationId: org.id, wage: 20, position: 'hunter', tick: worldState.tick,
  });
  const definition = SKILL_DEFINITIONS.find((d) => d.name === 'Combat');
  worldState.entityTraits.push({
    entity_id: npc.id, trait_id: definition.trait_id,
    base_value: 90, current_value: 90, key_modifier: 0, temporary_modifier: 0,
    permanent_modifier: 0, experience_modifier: 0, environmental_modifier: 0, relationship_modifier: 0,
  });
  return org;
}

function landmark(worldState, id, category, communityId, significance = 80) {
  const record = { id: 95000 + id, significance, where_location_id: id };
  worldState.historicalRecords.push(record);
  worldState.properties.push({
    id,
    type: 'civic',
    landmark_category: category,
    history_ref: record.id,
    condition: 100,
    land_size: 500,
    floors: 1,
    occupants: [],
    community_id: communityId,
    operating_organization_id: null,
    discoveries_taken: 0,
  });
  return worldState.properties[worldState.properties.length - 1];
}

function joinOrg(worldState, entityId, organizationId) {
  worldState.entityOrganizationMemberships.push({
    id: worldState.entityOrganizationMemberships.length + 1,
    entity_id: entityId,
    organization_id: organizationId,
    status: 'active',
  });
}

test('offerRecruitMission names a real eligible non-member resident', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69001;
  engine.WorldState.communities.push({ id: 69001, city_id: 69901 });
  const org = engine.generateOrganization({ name: 'Recruiting Org', type: 'business' });
  joinOrg(engine.WorldState, npc.id, org.id);
  const candidate = engine.generateNPC({ name: 'Eligible Candidate' });
  candidate.communityId = 69001;
  landmark(engine.WorldState, 69101, 'shop', 69001);

  const offer = missionVariety.offerRecruitMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no recruit mission was opened');
  assert.equal(offer.candidateId, candidate.id);
  assert.match(offer.mission.objective, /Eligible Candidate/);
});

test('offerRecruitMission returns null for a citizen with no real organization, even with a real candidate present', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69002;
  engine.WorldState.communities.push({ id: 69002, city_id: 69902 });
  const candidate = engine.generateNPC({ name: 'Unreachable Candidate' });
  candidate.communityId = 69002;
  landmark(engine.WorldState, 69102, 'shop', 69002);
  assert.equal(missionVariety.offerRecruitMission(engine.WorldState, npc.id), null);
});

test('offerAllianceMission names the real OTHER organization with the most real members', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69003;
  engine.WorldState.communities.push({ id: 69003, city_id: 69903 });
  const ownOrg = engine.generateOrganization({ name: 'Own Org', type: 'business' });
  joinOrg(engine.WorldState, npc.id, ownOrg.id);
  const rivalOrg = engine.generateOrganization({ name: 'Rival Crew', type: 'faction' });
  rivalOrg.leader_id = (() => {
    const leader = engine.generateNPC({ name: 'Rival Leader' });
    leader.communityId = 69003;
    joinOrg(engine.WorldState, leader.id, rivalOrg.id);
    return leader.id;
  })();
  landmark(engine.WorldState, 69103, 'shop', 69003);

  const offer = missionVariety.offerAllianceMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no alliance mission was opened');
  assert.equal(offer.organizationId, rivalOrg.id);
  assert.equal(offer.leaderId, rivalOrg.leader_id);
  assert.match(offer.mission.objective, /Rival Crew/);
});

test('offerAllianceMission returns null when no other real organization is present', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69004;
  engine.WorldState.communities.push({ id: 69004, city_id: 69904 });
  landmark(engine.WorldState, 69104, 'shop', 69004);
  assert.equal(missionVariety.offerAllianceMission(engine.WorldState, npc.id), null);
});

test('offerSpyMission names a real family member and a real other community', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69005;
  engine.WorldState.communities.push({ id: 69005, city_id: 69905 });
  engine.WorldState.communities.push({ id: 69006, city_id: 69906 });
  const family = engine.generateFamily({ surname: 'Spyfam' });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const spy = engine.generateNPC({ name: 'Real Spy' });
  engine.addFamilyMember(family.id, spy.id, 'child', 2);
  landmark(engine.WorldState, 69105, 'shop', 69005);

  const offer = missionVariety.offerSpyMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no spy mission was opened');
  assert.equal(offer.spyEntityId, spy.id);
  assert.notEqual(offer.targetCommunityId, npc.communityId, 'a spy mission must never target the asker\'s own real community');
  assert.match(offer.mission.objective, /Real Spy/);
});

test('offerSpyMission returns null for a citizen with no real family or organization', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69007;
  engine.WorldState.communities.push({ id: 69007, city_id: 69907 });
  landmark(engine.WorldState, 69107, 'shop', 69007);
  assert.equal(missionVariety.offerSpyMission(engine.WorldState, npc.id), null);
});

test('offerSpyMission never names a real deceased family member, and returns null when that was the only one', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69010;
  engine.WorldState.communities.push({ id: 69010, city_id: 69910 });
  engine.WorldState.communities.push({ id: 69011, city_id: 69911 });
  const family = engine.generateFamily({ surname: 'Deceasedfam' });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const deceasedChild = engine.generateNPC({ name: 'Late Child' });
  deceasedChild.status = 'deceased';
  engine.addFamilyMember(family.id, deceasedChild.id, 'child', 2);
  landmark(engine.WorldState, 69110, 'shop', 69010);

  assert.equal(missionVariety.offerSpyMission(engine.WorldState, npc.id), null);
});

test('offerTravelMission names the real other city with the greatest real fuel shortfall for a held vehicle', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69013;
  engine.WorldState.communities.push({ id: 69013, city_id: 69913 });
  engine.WorldState.cities.push({ id: 69913, name: 'Origin City', latitude: 38.6, longitude: -90.2 });
  engine.WorldState.cities.push({ id: 69914, name: 'Near City', latitude: 38.7, longitude: -90.3 });
  // Pushed BEFORE the real worst city, with a real but SMALLER
  // shortfall -- a "pick the first qualifying city" bug would wrongly
  // land here instead of on the real worst case.
  engine.WorldState.cities.push({ id: 69920, name: 'Medium City', latitude: 41.3, longitude: -90.2 });
  engine.WorldState.cities.push({ id: 69915, name: 'Far City', latitude: 40.7, longitude: -74.0 });
  salvage.registerItems(engine.WorldState);
  vehicles.registerFuelItem(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: 'scooter', quantity: 1, condition: 100 });
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: vehicles.FUEL_ITEM_NAME, quantity: 1 });
  landmark(engine.WorldState, 69113, 'shop', 69013);

  const offer = missionVariety.offerTravelMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no travel mission opened');
  assert.equal(offer.vehicleType, 'scooter');
  assert.equal(offer.destinationCityId, 69915, 'the farther real city has the greater real fuel shortfall');
  assert.ok(offer.totalDays > offer.fuelHeld, 'the whole point is that fuel held is genuinely not enough');
  assert.match(offer.mission.objective, /Far City/);
});

test('offerTravelMission returns null when the citizen genuinely holds enough fuel for every real reachable city', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69014;
  engine.WorldState.communities.push({ id: 69014, city_id: 69916 });
  engine.WorldState.cities.push({ id: 69916, name: 'Origin City 2', latitude: 38.6, longitude: -90.2 });
  engine.WorldState.cities.push({ id: 69917, name: 'Near City 2', latitude: 38.7, longitude: -90.3 });
  salvage.registerItems(engine.WorldState);
  vehicles.registerFuelItem(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: 'scooter', quantity: 1, condition: 100 });
  inventory.give(engine.WorldState, { entityId: npc.id, itemName: vehicles.FUEL_ITEM_NAME, quantity: 1000 });
  landmark(engine.WorldState, 69114, 'shop', 69014);

  assert.equal(missionVariety.offerTravelMission(engine.WorldState, npc.id), null);
});

test('offerTravelMission returns null for a citizen holding no real vehicle at all', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69015;
  engine.WorldState.communities.push({ id: 69015, city_id: 69918 });
  engine.WorldState.cities.push({ id: 69918, name: 'Origin City 3', latitude: 38.6, longitude: -90.2 });
  engine.WorldState.cities.push({ id: 69919, name: 'Far City 3', latitude: 40.7, longitude: -74.0 });
  landmark(engine.WorldState, 69115, 'shop', 69015);

  assert.equal(missionVariety.offerTravelMission(engine.WorldState, npc.id), null);
});

test('offerNomadicMission points at the real nearest other city for a family whose real head is genuinely at a real camp', () => {
  const head = engine.generateNPC();
  head.communityId = 69021;
  engine.WorldState.communities.push({ id: 69021, city_id: 69921 });
  // Deliberately distinct, unused coordinates -- `worldState.cities`
  // accumulates across every test in this file (no reset between
  // them), so reusing an earlier test's exact origin position would
  // put a real, unrelated, zero-distance city into this scan too.
  engine.WorldState.cities.push({ id: 69921, name: 'Camp City', latitude: 25.0, longitude: -80.0 });
  engine.WorldState.cities.push({ id: 69922, name: 'Nearest City', latitude: 25.1, longitude: -80.1 });
  engine.WorldState.cities.push({ id: 69923, name: 'Farther City', latitude: 47.6, longitude: -122.3 });
  const family = engine.generateFamily({ surname: 'Nomadfam', headNpcId: head.id });
  engine.addFamilyMember(family.id, head.id, 'founder', 1);
  const camp = camps.establishCamp(engine.WorldState, head.id, { communityId: 69021, campType: 'lake' });
  landmark(engine.WorldState, 69121, 'shop', 69021);

  const offer = missionVariety.offerNomadicMission(engine.WorldState, head.id);
  assert.ok(offer, 'no nomadic mission was opened');
  assert.equal(offer.campId, camp.id);
  assert.equal(offer.destinationCityId, 69922, 'the real nearest other city, not the farther one');
  assert.match(offer.mission.objective, /Nearest City/);
});

test('offerNomadicMission returns null for a family whose real head is not nomadic at all', () => {
  const head = engine.generateNPC();
  head.communityId = 69024;
  engine.WorldState.communities.push({ id: 69024, city_id: 69924 });
  engine.WorldState.cities.push({ id: 69924, name: 'Settled City', latitude: 38.6, longitude: -90.2 });
  const family = engine.generateFamily({ surname: 'Settledfam', headNpcId: head.id });
  engine.addFamilyMember(family.id, head.id, 'founder', 1);
  landmark(engine.WorldState, 69124, 'shop', 69024);

  assert.equal(missionVariety.offerNomadicMission(engine.WorldState, head.id), null);
});

test('offerNomadicMission returns null for a family whose real head is on a real journey, not a camp -- a journey status carries no real campId to resolve', () => {
  const head = engine.generateNPC();
  head.communityId = 69025;
  engine.WorldState.communities.push({ id: 69025, city_id: 69925 });
  engine.WorldState.cities.push({ id: 69925, name: 'Departure City', latitude: 38.6, longitude: -90.2 });
  engine.WorldState.cities.push({ id: 69926, name: 'Arrival City', latitude: 40.7, longitude: -74.0 });
  const family = engine.generateFamily({ surname: 'Travelfam', headNpcId: head.id });
  engine.addFamilyMember(family.id, head.id, 'founder', 1);
  travel.beginJourney(engine.WorldState, head.id, { destinationCityId: 69926, tick: engine.WorldState.tick });
  landmark(engine.WorldState, 69125, 'shop', 69025);

  assert.equal(missionVariety.offerNomadicMission(engine.WorldState, head.id), null);
});

test('offerNomadicMission returns null for a citizen with no real family or organization at all', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69026;
  engine.WorldState.communities.push({ id: 69026, city_id: 69927 });
  landmark(engine.WorldState, 69126, 'shop', 69026);

  assert.equal(missionVariety.offerNomadicMission(engine.WorldState, npc.id), null);
});

test('offerBarterMission names a real resident holding the real scarcest survival resource', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69008;
  engine.WorldState.communities.push({ id: 69008, city_id: 69908 });
  engine.WorldState.resources.push({
    id: engine.WorldState.resources.length + 1,
    city_id: 69908, resource_type: 'water', supply: 10, demand: 100,
  });
  const holder = engine.generateNPC({ name: 'Water Holder' });
  holder.communityId = 69008;
  produce.registerItems(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: holder.id, itemName: 'clean_water', quantity: 5 });
  landmark(engine.WorldState, 69108, 'shop', 69008);

  const offer = missionVariety.offerBarterMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no barter mission was opened');
  assert.equal(offer.partnerId, holder.id);
  assert.equal(offer.resourceName, 'water');
  assert.equal(offer.itemName, 'clean_water');
  assert.match(offer.mission.objective, /Water Holder/);
});

test('offerHuntMission opens a real mission for a citizen genuinely employed as a hunter with the real skill/tier', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69011;
  npc.education = 'secondary';
  engine.WorldState.communities.push({ id: 69011, city_id: 69911 });
  employAsHunter(engine.WorldState, npc);
  landmark(engine.WorldState, 69111, 'shop', 69011);

  const offer = missionVariety.offerHuntMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no hunt mission was opened');
  assert.match(offer.mission.objective, /raw_meat/);
  assert.equal(offer.mission.reward, missionVariety.MISSION_HUNT_REWARD);
});

test('offerHuntMission returns null for a citizen not really employed as a hunter, even in a community with a real anchor', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69012;
  npc.education = 'secondary';
  engine.WorldState.communities.push({ id: 69012, city_id: 69912 });
  landmark(engine.WorldState, 69112, 'shop', 69012);

  assert.equal(missionVariety.offerHuntMission(engine.WorldState, npc.id), null);
});

test('offerBarterMission returns null when the city is not really short of anything, even with a real holder present', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69009;
  engine.WorldState.communities.push({ id: 69009, city_id: 69909 });
  engine.WorldState.resources.push({
    id: engine.WorldState.resources.length + 1,
    city_id: 69909, resource_type: 'water', supply: 100, demand: 50,
  });
  const holder = engine.generateNPC({ name: 'Unneeded Holder' });
  holder.communityId = 69009;
  produce.registerItems(engine.WorldState);
  inventory.give(engine.WorldState, { entityId: holder.id, itemName: 'clean_water', quantity: 5 });
  landmark(engine.WorldState, 69109, 'shop', 69009);
  assert.equal(missionVariety.offerBarterMission(engine.WorldState, npc.id), null);
});

// ---------------------------------------------------------------------
// Task #124 -- org expansion, the eighth offer*Mission.
//
// A hand-built, ISOLATED world (not `engine.WorldState`) on purpose --
// this function scans EVERY real city in the world, and
// `engine.WorldState` accumulates cities across every test in this
// file with no reset between them (the same convention
// `offerNomadicMission`'s own tests already warn about). Scanning the
// whole shared world would make "the one real candidate" depend on
// which of dozens of leftover cities happens to compare best, which is
// nothing a test should assert on. `control.test.js`'s and
// `build-barricade.test.js`'s own hand-built `world()` fixtures are
// the precedent: neither `missionVariety.js`'s functions nor
// `control.js`'s are bound to `engine.WorldState` at all.
function expansionWorld(tick = 10000) {
  return {
    tick,
    families: [],
    familyMemberships: [],
    npcs: [],
    entityOrganizationMemberships: [],
    organizations: [],
    properties: [],
    communities: [],
    cities: [],
    inventory: [],
    barterItems: [],
    employmentRecords: [],
    entityTraits: [],
    missions: [],
  };
}

function expansionFounder(w, { npcId, familyId, organizationId, tick }) {
  w.npcs.push({ id: npcId, status: 'alive', createdTick: tick - Math.round(30 * 365) });
  w.families.push({ id: familyId, surname: `Expando ${familyId}`, unity: 100, conflict: 0, head_npc_id: npcId });
  w.familyMemberships.push({ entity_id: npcId, family_id: familyId, role: 'founder', generation_number: 1 });
  w.entityOrganizationMemberships.push({
    id: npcId, entity_id: npcId, organization_id: organizationId, status: 'active',
  });
  w.organizations.push({ id: organizationId, type: 'business', leader_id: npcId });
  // §26 `tools`, the real materiel `TOOLS_PER_HAND` requires -- the
  // same real item `control.test.js`'s own `kit()` uses.
  w.inventory.push({
    id: w.inventory.length + 1, holder_entity_id: npcId, item_name: 'Hammer', quantity: 2, condition: 80,
  });
}

function expansionProperty(w, { id, communityId, operatingOrganizationId = null }) {
  w.properties.push({
    id, type: 'commercial', operating_organization_id: operatingOrganizationId,
    community_id: communityId, condition: 100, land_size: 500, floors: 1, occupants: [], discoveries_taken: 0,
  });
}

test('offerExpansionMission points at a real viable property in a real city the organization does not already reach', () => {
  const w = expansionWorld();
  expansionFounder(w, { npcId: 1, familyId: 900, organizationId: 500, tick: w.tick });

  // Home city -- the real property the organization already operates.
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100, name: 'Home City' });
  expansionProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: 500 });

  // A real, different city the organization does not reach yet, with
  // one real, trivially-capturable property (no holders, no operator).
  w.communities.push({ id: 20, city_id: 200 });
  w.cities.push({ id: 200, name: 'New City' });
  expansionProperty(w, { id: 2000, communityId: 20 });

  const offer = missionVariety.offerExpansionMission(w, 1);
  assert.ok(offer, 'no expansion mission was offered');
  assert.equal(offer.destinationCityId, 200, 'the real city the organization does not already reach');
  assert.equal(offer.locationId, 2000);
  assert.match(offer.mission.objective, /New City/);
  assert.ok(offer.finalSuccessProbability > 0);
});

test('offerExpansionMission keeps scanning past a real but genuinely unviable first-found city, rather than stopping there', () => {
  const w = expansionWorld();
  expansionFounder(w, { npcId: 1, familyId: 900, organizationId: 500, tick: w.tick });

  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100, name: 'Home City' });
  expansionProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: 500 });

  // Checked FIRST (lower id) and genuinely NOT viable: three real
  // holders push the real required force past what a one-person
  // tribe can field, so `compositionRequirementMet` is false and
  // `viableTargetsFor` excludes it outright -- a function that
  // stopped at the first non-home city would see nothing here and
  // return null, never reaching the real opportunity below.
  w.communities.push({ id: 20, city_id: 200 });
  w.cities.push({ id: 200, name: 'Overheld City' });
  for (let i = 0; i < 3; i += 1) {
    w.npcs.push({ id: 100 + i, status: 'alive', createdTick: w.tick - Math.round(30 * 365), home_property_id: 2000 });
  }
  expansionProperty(w, { id: 2000, communityId: 20 });

  // Checked SECOND and genuinely viable: nobody holds it at all --
  // the real "a flat with nobody holding it still takes one person" floor.
  w.communities.push({ id: 30, city_id: 300 });
  w.cities.push({ id: 300, name: 'Open City' });
  expansionProperty(w, { id: 3000, communityId: 30 });

  const offer = missionVariety.offerExpansionMission(w, 1);
  assert.ok(offer, 'the real viable city past the unviable one was missed');
  assert.equal(offer.destinationCityId, 300);
  assert.equal(offer.locationId, 3000);
});

// Pins the one real behaviour left once two cities are BOTH
// genuinely viable for the same tribe at once: every such candidate
// ties at the identical `finalSuccessProbability` (the tribe and tick
// are fixed within one call, and `control.assess`'s own `margin` term
// is provably 1 on every candidate it accepts -- see the function's
// own header), so there is no real "better" to rank, and the function
// stops at the first one found rather than scanning needlessly on.
test('offerExpansionMission picks the first real viable city found when more than one genuinely qualifies', () => {
  const w = expansionWorld();
  expansionFounder(w, { npcId: 1, familyId: 900, organizationId: 500, tick: w.tick });

  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100, name: 'Home City' });
  expansionProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: 500 });

  w.communities.push({ id: 20, city_id: 200 });
  w.cities.push({ id: 200, name: 'First Open City' });
  expansionProperty(w, { id: 2000, communityId: 20 });

  w.communities.push({ id: 30, city_id: 300 });
  w.cities.push({ id: 300, name: 'Second Open City' });
  expansionProperty(w, { id: 3000, communityId: 30 });

  const offer = missionVariety.offerExpansionMission(w, 1);
  assert.ok(offer);
  assert.equal(offer.destinationCityId, 200, 'the first real viable city, not the second');
  assert.equal(offer.locationId, 2000);
});

test('offerExpansionMission returns null for a citizen with no real organization at all', () => {
  const w = expansionWorld();
  w.npcs.push({ id: 1, status: 'alive', createdTick: w.tick - Math.round(30 * 365) });
  w.families.push({ id: 900, surname: 'No Org', unity: 100, conflict: 0, head_npc_id: 1 });
  w.familyMemberships.push({ entity_id: 1, family_id: 900, role: 'founder', generation_number: 1 });
  w.inventory.push({
    id: w.inventory.length + 1, holder_entity_id: 1, item_name: 'Hammer', quantity: 2, condition: 80,
  });
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100, name: 'Only City' });
  // A real UNOPERATED property (`operating_organization_id: null`) --
  // present on purpose, so this actually discriminates the org check.
  // `ownOrganizationIdOf` returning null must not be allowed to match
  // this property's own null `operating_organization_id` in the
  // `homeProperties` filter below and get treated as a real "home";
  // without the explicit early return, that coincidence would make
  // city 100 count as reached and this community's own real viable
  // target in a SECOND city would wrongly be offered to someone with
  // no organization at all.
  expansionProperty(w, { id: 1000, communityId: 10 });
  // A real OTHER organization's property, genuinely unoperated by
  // "no organization" (id 999 is unrelated to this citizen entirely)
  // -- without the early return, this city would wrongly read as a
  // real, trivially-capturable expansion opportunity.
  w.organizations.push({ id: 999, type: 'business', leader_id: null });
  w.communities.push({ id: 20, city_id: 200 });
  w.cities.push({ id: 200, name: 'Other City' });
  expansionProperty(w, { id: 2000, communityId: 20, operatingOrganizationId: 999 });

  assert.equal(missionVariety.offerExpansionMission(w, 1), null);
});

// NOT a mutation-guarded check on `tribeId == null` -- there is no
// family row with `id === null` to match, so `control.assess` (and
// `viableTargetsFor` over it) already excludes every candidate for a
// null tribe on its own; removing the explicit early-return changes
// nothing a mutation test can observe. This asserts the real,
// observable behaviour instead: a real organization member with no
// real family gets no expansion mission, full stop, by whichever real
// path produces that -- the explicit check is kept anyway because it
// fails fast and says why, the same documentation role `assessTakeover`
// /`attemptTakeover`'s own (throwing) family check plays one layer up.
test('offerExpansionMission returns null for a real organization member with no real family of their own', () => {
  const w = expansionWorld();
  w.npcs.push({ id: 1, status: 'alive', createdTick: w.tick - Math.round(30 * 365) });
  w.organizations.push({ id: 500, type: 'business', leader_id: 1 });
  w.entityOrganizationMemberships.push({ id: 1, entity_id: 1, organization_id: 500, status: 'active' });
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100, name: 'Only City' });
  expansionProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: 500 });

  assert.equal(missionVariety.offerExpansionMission(w, 1), null);
});

test('offerExpansionMission returns null for a real organization with no real property anywhere yet -- nothing to expand FROM', () => {
  const w = expansionWorld();
  expansionFounder(w, { npcId: 1, familyId: 900, organizationId: 500, tick: w.tick });
  w.communities.push({ id: 20, city_id: 200 });
  w.cities.push({ id: 200, name: 'Only Other City' });
  expansionProperty(w, { id: 2000, communityId: 20 });

  assert.equal(missionVariety.offerExpansionMission(w, 1), null);
});

test('offerExpansionMission returns null for a world with only the organization\'s own home city -- nothing to expand TO', () => {
  const w = expansionWorld();
  expansionFounder(w, { npcId: 1, familyId: 900, organizationId: 500, tick: w.tick });
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100, name: 'Only City' });
  expansionProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: 500 });

  assert.equal(missionVariety.offerExpansionMission(w, 1), null);
});

// ---------------------------------------------------------------------
// Task #130 -- the ninth offer*Mission, closing the extortion verb gap
// this file's own header named when business/drug/extortion were split
// out of task #118. Same hand-built-isolated-world reasoning as
// `offerExpansionMission` above: `authority.writOf`/`holderOf` read
// REAL territory blocks and infrastructure, and the shared
// `engine.WorldState` accumulates both across every earlier test in
// this file.
// ---------------------------------------------------------------------

const { ORGANIZATION_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

function extortionWorld(tick = 10000) {
  return {
    tick,
    npcs: [],
    entityOrganizationMemberships: [],
    organizations: [],
    properties: [],
    communities: [],
    cities: [],
    territoryBlocks: [],
    infrastructure: [],
    entityTraits: [],
    missions: [],
  };
}

// A real organization with real, live `organization` traits —
// `authority.holderOf` reads `territory`/`power` through
// `getLiveEntity`, never a static field, the identical real
// substrate `test/extortion.test.js`'s own `organization()` helper
// already builds.
function extortionOrg(w, { id, leaderId = null }) {
  const org = { id, type: 'business', leader_id: leaderId };
  w.organizations.push(org);
  w.entityTraits.push(...generateEntityTraits(id, w.tick, ORGANIZATION_DEFINITIONS, () => 50));
  return org;
}

// A real, fortified territory block this faction holds, with no real
// `public_safety` infrastructure at all — the honest `contested`/
// `lawless` substrate `test/extortion.test.js`'s own `heldCommunity`
// helper already establishes, built again here rather than required
// across test files.
function extortionHeldCommunity(w, factionId, { communityId, cityId }) {
  w.cities.push({ id: cityId });
  w.communities.push({ id: communityId, city_id: cityId });
  w.infrastructure.push({
    id: communityId * 10, city_id: cityId, type: 'public_safety', capacity: 1, condition: 0, maintenance_level: 0, age: 0,
  });
  w.territoryBlocks.push({
    id: communityId * 10 + 1, community_id: communityId, faction_id: factionId, status: 'fortified',
  });
}

function extortionTargetProperty(w, { id, communityId, operatingOrganizationId }) {
  w.properties.push({ id, community_id: communityId, operating_organization_id: operatingOrganizationId, condition: 80 });
}

test('offerExtortionMission points at a real target business in a real community the npc\'s own organization genuinely holds', () => {
  const w = extortionWorld();
  w.npcs.push({ id: 1, status: 'alive' });
  const faction = extortionOrg(w, { id: 500, leaderId: 1 });
  extortionHeldCommunity(w, faction.id, { communityId: 10, cityId: 100 });
  const target = extortionOrg(w, { id: 600 });
  target.assets = 1000;
  extortionTargetProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: target.id });

  const result = missionVariety.offerExtortionMission(w, 1);
  assert.ok(result, 'a real leader with a real held community and a real target returned null');
  assert.equal(result.targetOrganizationId, target.id);
  assert.equal(result.factionOrganizationId, faction.id);
  assert.equal(result.communityId, 10);
  assert.match(result.mission.objective, /Demand tribute/);
});

test('offerExtortionMission returns null for an npc who is a real MEMBER but not the real LEADER of an organization', () => {
  // Membership alone (`ownOrganizationIdOf`) is not enough here --
  // `demandTribute`'s own real authority check requires leadership,
  // and offering a mission a player could never actually resolve
  // would be a mission about nothing, this file's own standing rule.
  const w = extortionWorld();
  w.npcs.push({ id: 1, status: 'alive' });
  const faction = extortionOrg(w, { id: 500, leaderId: 2 });
  w.entityOrganizationMemberships.push({ id: 1, entity_id: 1, organization_id: 500, status: 'active' });
  extortionHeldCommunity(w, faction.id, { communityId: 10, cityId: 100 });
  const target = extortionOrg(w, { id: 600 });
  target.assets = 1000;
  extortionTargetProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: target.id });

  assert.equal(missionVariety.offerExtortionMission(w, 1), null);
});

test('offerExtortionMission returns null when the npc\'s organization holds no real ground anywhere', () => {
  const w = extortionWorld();
  w.npcs.push({ id: 1, status: 'alive' });
  extortionOrg(w, { id: 500, leaderId: 1 });
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100 });
  const target = extortionOrg(w, { id: 600 });
  target.assets = 1000;
  extortionTargetProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: target.id });

  assert.equal(missionVariety.offerExtortionMission(w, 1), null);
});

test('offerExtortionMission returns null when the held community has no real extortable target', () => {
  const w = extortionWorld();
  w.npcs.push({ id: 1, status: 'alive' });
  const faction = extortionOrg(w, { id: 500, leaderId: 1 });
  extortionHeldCommunity(w, faction.id, { communityId: 10, cityId: 100 });
  // A real target with zero assets -- extortion.operatingBusinessesIn
  // finds it, but nothing real to demand.
  const target = extortionOrg(w, { id: 600 });
  target.assets = 0;
  extortionTargetProperty(w, { id: 1000, communityId: 10, operatingOrganizationId: target.id });

  assert.equal(missionVariety.offerExtortionMission(w, 1), null);
});

// ---------------------------------------------------------------------
// Task #128 -- the tenth offer*Mission, closing the business verb gap
// this file's own header named alongside the extortion one. A
// hand-built, isolated world again, for the same reason: `economy
// .goingWage` reads EVERY active employment record in the whole
// world, and the shared `engine.WorldState` accumulates them across
// every earlier test in this file.
// ---------------------------------------------------------------------

function businessMissionWorld(tick = 10000) {
  return {
    tick,
    npcs: [],
    organizations: [],
    properties: [],
    communities: [],
    cities: [],
    employmentRecords: [],
    individualFinances: [],
    missions: [],
  };
}

function businessMissionPerson(w, { id, communityId, savings = 0, createdTick }) {
  w.npcs.push({ id, status: 'active', communityId, createdTick });
  economy.generateIndividualFinances(w, id, { savings, tick: w.tick });
}

// A real going wage for `economy.goingWage` to read -- one other real
// organization with one real employee, the identical minimal shape
// `test/businesses.test.js`'s own `foundBusiness` tests already use.
function businessMissionGoingWage(w, wage) {
  w.organizations.push({ id: 9000, type: 'business', assets: 0, income: 0, expenses: 0 });
  businessMissionPerson(w, { id: 9001, communityId: null, createdTick: w.tick - 10000 });
  w.employmentRecords.push({
    id: 9000, entity_id: 9001, employer_organization_id: 9000, wage, status: 'active', position: null,
  });
}

const BUSINESS_WORKING_AGE_CREATED_TICK = (tick) => tick - Math.round((economy.WORKING_AGE + 5) * 365);

test('offerBusinessMission points at founding a real business for a real citizen with real savings to cover it', () => {
  const w = businessMissionWorld();
  businessMissionGoingWage(w, 50);
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100 });
  w.properties.push({ id: 1000, community_id: 10 });
  const capital = 50 * businesses.STARTUP_CAPITAL_WAGE_MULTIPLE;
  businessMissionPerson(w, {
    id: 1, communityId: 10, savings: capital + 1000, createdTick: BUSINESS_WORKING_AGE_CREATED_TICK(w.tick),
  });

  const result = missionVariety.offerBusinessMission(w, 1);
  assert.ok(result, 'a real eligible citizen with real covering savings returned null');
  assert.equal(result.capital, capital);
  assert.match(result.mission.objective, /Found a real business/);
});

test('offerBusinessMission returns null without enough real savings to cover the real startup capital', () => {
  const w = businessMissionWorld();
  businessMissionGoingWage(w, 50);
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100 });
  w.properties.push({ id: 1000, community_id: 10 });
  businessMissionPerson(w, {
    id: 1, communityId: 10, savings: 10, createdTick: BUSINESS_WORKING_AGE_CREATED_TICK(w.tick),
  });

  assert.equal(missionVariety.offerBusinessMission(w, 1), null);
});

test('offerBusinessMission returns null for a real citizen under working age, however rich', () => {
  const w = businessMissionWorld();
  businessMissionGoingWage(w, 50);
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100 });
  w.properties.push({ id: 1000, community_id: 10 });
  // A real 5-year-old, well under economy.WORKING_AGE (16).
  businessMissionPerson(w, {
    id: 1, communityId: 10, savings: 1000000, createdTick: w.tick - Math.round(5 * 365),
  });

  assert.equal(missionVariety.offerBusinessMission(w, 1), null);
});

test('offerBusinessMission returns null for an imprisoned citizen, however rich and however old', () => {
  const w = businessMissionWorld();
  businessMissionGoingWage(w, 50);
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100 });
  w.properties.push({ id: 1000, community_id: 10 });
  businessMissionPerson(w, {
    id: 1, communityId: 10, savings: 1000000, createdTick: BUSINESS_WORKING_AGE_CREATED_TICK(w.tick),
  });
  w.npcs.find((n) => n.id === 1).status = 'imprisoned';

  assert.equal(missionVariety.offerBusinessMission(w, 1), null);
});

test('offerBusinessMission returns null with no real going wage anywhere (no labour market yet)', () => {
  const w = businessMissionWorld();
  w.communities.push({ id: 10, city_id: 100 });
  w.cities.push({ id: 100 });
  w.properties.push({ id: 1000, community_id: 10 });
  businessMissionPerson(w, {
    id: 1, communityId: 10, savings: 1000000, createdTick: BUSINESS_WORKING_AGE_CREATED_TICK(w.tick),
  });

  assert.equal(missionVariety.offerBusinessMission(w, 1), null);
});

// ---------------------------------------------------------------------
// Task #129 -- the eleventh offer*Mission, closing the drug verb gap
// this file's own header named alongside business and extortion.
// Reuses the SHARED `engine.WorldState` directly (the identical
// pattern `offerHuntMission`'s own tests already use), since a real
// gang tier reads live `faction` traits through `getLiveEntity` --
// the same real substrate `engine.generateNPC` already writes,
// never a hand-built isolated world for this one.
// ---------------------------------------------------------------------

function drugGang(leaderId) {
  return engine.generateOrganization({ name: `Drug Gang ${leaderId}`, type: 'gang', leaderId });
}

// A real soldier/associate tier, deterministically -- the identical
// real trait shape `test/drugTrade.test.js`'s own `soldierIn` already
// establishes: Territorial Instinct strictly highest of the four real
// faction dimensions -> `soldier`.
function drugSoldier(gangOrg, communityId) {
  const npc = engine.generateNPC({
    traitValueFor: (def) => {
      if (def.family !== 'faction') return 50;
      if (def.name === 'Territorial Instinct') return 95;
      if (def.name === 'Defection Risk') return 50;
      return 5;
    },
    communityId,
  });
  npc.createdTick = engine.WorldState.tick - 30 * 365;
  membership.joinOrganization(engine.WorldState, { entityId: npc.id, organizationId: gangOrg.id });
  return npc;
}

test('offerDrugMission points at dealing a real held substance for a real gang soldier/associate', () => {
  const leader = engine.generateNPC();
  const org = drugGang(leader.id);
  const dealer = drugSoldier(org, 69021);
  engine.WorldState.communities.push({ id: 69021, city_id: 69921 });
  landmark(engine.WorldState, 69121, 'shop', 69021);
  drugTrade.produceMarijuana(engine.WorldState, dealer.id, { tick: engine.WorldState.tick });

  const offer = missionVariety.offerDrugMission(engine.WorldState, dealer.id);
  assert.ok(offer, 'no drug mission was opened for a real soldier holding a real substance');
  assert.equal(offer.itemName, 'marijuana');
  assert.match(offer.mission.objective, /Deal your real held marijuana/);
  assert.equal(offer.mission.reward, missionVariety.MISSION_DRUG_REWARD);
});

test('offerDrugMission returns null for an entity who is not a real member of any real gang', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69022;
  engine.WorldState.communities.push({ id: 69022, city_id: 69922 });
  landmark(engine.WorldState, 69122, 'shop', 69022);

  assert.equal(missionVariety.offerDrugMission(engine.WorldState, npc.id), null);
});

test('offerDrugMission returns null for a real gang leader/lieutenant/shot_caller tier, holding a real substance notwithstanding', () => {
  const leader = engine.generateNPC({
    traitValueFor: (def) => (def.family === 'faction' && def.name === 'Territorial Instinct' ? 95 : 5),
  });
  leader.communityId = 69023;
  engine.WorldState.communities.push({ id: 69023, city_id: 69923 });
  landmark(engine.WorldState, 69123, 'shop', 69023);
  const org = drugGang(leader.id);
  membership.joinOrganization(engine.WorldState, { entityId: leader.id, organizationId: org.id });
  drugTrade.produceMarijuana(engine.WorldState, leader.id, { tick: engine.WorldState.tick });

  assert.equal(missionVariety.offerDrugMission(engine.WorldState, leader.id), null);
});

test('offerDrugMission returns null for a real soldier/associate holding no real substance at all', () => {
  const leader = engine.generateNPC();
  const org = drugGang(leader.id);
  const dealer = drugSoldier(org, 69024);
  engine.WorldState.communities.push({ id: 69024, city_id: 69924 });
  landmark(engine.WorldState, 69124, 'shop', 69024);

  assert.equal(missionVariety.offerDrugMission(engine.WorldState, dealer.id), null);
});

// ---------------------------------------------------------------------
// offerRailwayMission — task #240, by direct instruction: "the train
// network... getting trains back available... railways back and
// running." See missionVariety.js's own header on this function for
// why this is a real, named override of the Transportation deferral,
// never a silent one, and for why it reuses property.renovateProperty
// (task #239) rather than inventing a second repair mechanic.
// ---------------------------------------------------------------------

test('offerRailwayMission points a real org member at a real degraded train-station in their own city', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69201;
  engine.WorldState.communities.push({ id: 69201, city_id: 69901 });
  const org = engine.generateOrganization({ name: 'Rail Operator', type: 'business' });
  joinOrg(engine.WorldState, npc.id, org.id);
  const station = landmark(engine.WorldState, 69301, 'train-station', 69201);
  station.condition = 40;
  station.operating_organization_id = org.id;

  const offer = missionVariety.offerRailwayMission(engine.WorldState, npc.id);
  assert.ok(offer, 'no railway mission was opened for a real org member at a real degraded station');
  assert.equal(offer.stationPropertyId, station.id);
  assert.match(offer.mission.objective, /railway running again/);
  assert.equal(offer.mission.reward, missionVariety.MISSION_RAILWAY_REWARD);
});

test('offerRailwayMission returns null when the city has no real train-station landmark at all', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69202;
  engine.WorldState.communities.push({ id: 69202, city_id: 69902 });
  landmark(engine.WorldState, 69302, 'shop', 69202);

  assert.equal(missionVariety.offerRailwayMission(engine.WorldState, npc.id), null);
});

test('offerRailwayMission returns null when the city\'s only train-station is already at full condition', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69203;
  engine.WorldState.communities.push({ id: 69203, city_id: 69903 });
  const org = engine.generateOrganization({ name: 'Rail Operator Two', type: 'business' });
  joinOrg(engine.WorldState, npc.id, org.id);
  const station = landmark(engine.WorldState, 69303, 'train-station', 69203);
  station.operating_organization_id = org.id;
  // landmark()'s own default condition is 100 -- left unchanged here.

  assert.equal(missionVariety.offerRailwayMission(engine.WorldState, npc.id), null);
});

test('offerRailwayMission returns null for a citizen with no real stake in the station\'s real operating organization', () => {
  const npc = engine.generateNPC();
  npc.communityId = 69204;
  engine.WorldState.communities.push({ id: 69204, city_id: 69904 });
  const org = engine.generateOrganization({ name: 'Rail Operator Three', type: 'business' });
  const station = landmark(engine.WorldState, 69304, 'train-station', 69204);
  station.condition = 40;
  station.operating_organization_id = org.id;
  // npc is deliberately never joined to `org`.

  assert.equal(missionVariety.offerRailwayMission(engine.WorldState, npc.id), null);
});
