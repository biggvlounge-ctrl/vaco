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
const missionVariety = require('../server/missionVariety.js');

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
