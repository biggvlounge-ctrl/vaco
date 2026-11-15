// server/travel.js — Oregon Trail-style group travel. See that file's
// own header for the full design: a real haversine distance between
// two real generated cities, a real cited historical pace, real
// food/water consumption from whatever the leader and their real
// party carry, an additional real deprivation-risk draw on a day with
// neither, and a real `migration.relocate` on arrival (or, for a
// round trip, nothing to relocate at all on the way home).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const travel = require('../server/travel.js');
const geo = require('../server/geo.js');
const inventory = require('../server/inventory.js');
const party = require('../server/party.js');
const worldStore = require('../server/worldStore.js');

const w = engine.WorldState;

function leaderInCity(cityId) {
  return (w.npcs || []).find((n) => travel.cityOf(w, n.id) === cityId && !travel.activeJourneyFor(w, n.id));
}

// ---------------------------------------------------------------------
// beginJourney — real validation, real distance, real group
// ---------------------------------------------------------------------

test('beginJourney requires a real destinationCityId', () => {
  worldgen.generateWorld({ seed: 'travel-begin-1', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const leader = leaderInCity(w.cities[w.cities.length - 2].id);
  assert.throws(() => travel.beginJourney(w, leader.id, {}), /requires options\.destinationCityId/);
});

test('beginJourney refuses a non-living entity', () => {
  worldgen.generateWorld({ seed: 'travel-begin-2', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const destCity = w.cities[w.cities.length - 1];
  assert.throws(
    () => travel.beginJourney(w, 999999999, { destinationCityId: destCity.id }),
    /is not among the living/,
  );
});

test('beginJourney refuses a destination that is the real entity\'s own current city', () => {
  worldgen.generateWorld({ seed: 'travel-begin-3', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const originCity = w.cities[w.cities.length - 2];
  const leader = leaderInCity(originCity.id);
  assert.throws(
    () => travel.beginJourney(w, leader.id, { destinationCityId: originCity.id }),
    /same real city/,
  );
});

test('beginJourney refuses an entity already on a real journey', () => {
  worldgen.generateWorld({ seed: 'travel-begin-4', cities: 3, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-3);
  const leader = leaderInCity(cities[0].id);
  travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0 });
  assert.throws(
    () => travel.beginJourney(w, leader.id, { destinationCityId: cities[2].id, tick: 0 }),
    /already on a real journey/,
  );
});

test('beginJourney computes a real distance and a real day count from it, at the cited historical pace', () => {
  worldgen.generateWorld({ seed: 'travel-begin-5', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-2);
  const leader = leaderInCity(cities[0].id);
  const journey = travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0 });

  const realDistance = geo.distanceMetres(geo.positionOf(cities[0]), geo.positionOf(cities[1]));
  assert.equal(journey.distanceMetres, realDistance);
  assert.equal(journey.totalDays, Math.max(1, Math.ceil(realDistance / travel.METRES_PER_DAY)));
  assert.equal(journey.status, 'traveling');
  assert.equal(journey.leg, 'outbound');
  assert.equal(journey.daysElapsed, 0);
});

test('beginJourney\'s group is the leader plus their real, already-assembled party -- never a second roster', () => {
  worldgen.generateWorld({ seed: 'travel-begin-6', cities: 2, communitiesPerCity: 1, populationPerCommunity: 6 });
  const cities = w.cities.slice(-2);
  const originCommunity = w.communities.find((c) => c.city_id === cities[0].id);
  const residents = w.npcs.filter((n) => n.communityId === originCommunity.id);
  const [leader, member] = residents;

  const fam = { id: 9000001, surname: 'Wagon', generation: 1, total_members: 2, head_npc_id: leader.id, updatedTick: w.tick };
  w.families.push(fam);
  w.familyMemberships.push({ entity_id: leader.id, family_id: fam.id, role: 'parent', generation_number: 1 });
  w.familyMemberships.push({ entity_id: member.id, family_id: fam.id, role: 'child', generation_number: 1 });
  worldStore.getOrCreateRelationship(w, leader.id, member.id, 'social').loyalty = 100;
  let joined = false;
  for (let tick = 0; tick < 20 && !joined; tick += 1) {
    const result = party.assembleParty(w, leader.id, { familyId: fam.id, memberEntityIds: [member.id], tick });
    if (result.complied.includes(member.id)) joined = true;
  }
  assert.ok(joined, 'the real member must comply at least once across 20 real tries at full loyalty');

  const journey = travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0 });
  assert.deepEqual([...journey.memberEntityIds].sort((a, b) => a - b), [leader.id, member.id].sort((a, b) => a - b));
});

// ---------------------------------------------------------------------
// advanceJourneys — real consumption, real arrival, real round trip
// ---------------------------------------------------------------------

test('advanceJourneys consumes one real food item and one real water item per travelling day', () => {
  worldgen.generateWorld({ seed: 'travel-advance-1', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-2);
  const leader = leaderInCity(cities[0].id);
  inventory.give(w, { entityId: leader.id, itemName: 'bread', quantity: 10, tick: 0 });
  inventory.give(w, { entityId: leader.id, itemName: 'bottled_water', quantity: 10, tick: 0 });
  travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0 });

  travel.advanceJourneys(w, 0);
  assert.equal(inventory.quantityOf(w, leader.id, 'bread'), 9);
  assert.equal(inventory.quantityOf(w, leader.id, 'bottled_water'), 9);

  travel.advanceJourneys(w, 1);
  assert.equal(inventory.quantityOf(w, leader.id, 'bread'), 8);
  assert.equal(inventory.quantityOf(w, leader.id, 'bottled_water'), 8);
});

test('advanceJourneys: a fully-supplied one-way journey arrives and relocates every real survivor via migration.relocate', () => {
  worldgen.generateWorld({ seed: 'travel-advance-2', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-2);
  const leader = leaderInCity(cities[0].id);
  const journey = travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0 });
  inventory.give(w, { entityId: leader.id, itemName: 'bread', quantity: journey.totalDays + 5, tick: 0 });
  inventory.give(w, { entityId: leader.id, itemName: 'bottled_water', quantity: journey.totalDays + 5, tick: 0 });

  let events = [];
  for (let t = 0; t < journey.totalDays + 2; t += 1) {
    events = events.concat(travel.advanceJourneys(w, t));
  }

  assert.ok(events.some((e) => e.type === 'journey-arrived' && e.roundTrip === false));
  const after = w.npcs.find((n) => n.id === leader.id);
  assert.ok(after, 'the fully-supplied traveler must still be alive');
  const arrivedCommunity = w.communities.find((c) => c.id === after.communityId);
  assert.equal(arrivedCommunity.city_id, cities[1].id);
  assert.equal(after.home_property_id, null, 'arriving fresh has no real property yet -- the honest homelessness-substrate landing, not a second status');

  const row = w.migrationEvents.find((r) => r.entity_id === leader.id);
  assert.equal(row.migration_type, 'exploration');
  assert.equal(row.to_location_id, after.communityId);
});

test('advanceJourneys: a round trip comes home with no second real migration event -- there is nothing to move', () => {
  worldgen.generateWorld({ seed: 'travel-advance-3', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-2);
  const leader = leaderInCity(cities[0].id);
  const homeCommunityId = leader.communityId;
  const journey = travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0, roundTrip: true });
  inventory.give(w, { entityId: leader.id, itemName: 'bread', quantity: journey.totalDays * 2 + 10, tick: 0 });
  inventory.give(w, { entityId: leader.id, itemName: 'bottled_water', quantity: journey.totalDays * 2 + 10, tick: 0 });

  let events = [];
  for (let t = 0; t < journey.totalDays * 2 + 2; t += 1) {
    events = events.concat(travel.advanceJourneys(w, t));
  }

  assert.ok(events.some((e) => e.type === 'journey-leg-complete'));
  assert.ok(events.some((e) => e.type === 'journey-arrived' && e.roundTrip === true));
  const after = w.npcs.find((n) => n.id === leader.id);
  assert.equal(after.communityId, homeCommunityId, 'a round trip must bring the real traveler back to their own real, unchanged home');

  const rowsForLeader = w.migrationEvents.filter((r) => r.entity_id === leader.id);
  assert.equal(rowsForLeader.length, 0, 'a round trip\'s outbound leg never actually arrives (it turns around), so it writes no real migration event either');
});

test('advanceJourneys: deprivation is real and kills, through the one real mortality.recordDeath choke point', () => {
  worldgen.generateWorld({ seed: 'travel-deprivation-sweep', cities: 10, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-10);

  const started = [];
  for (const origin of cities) {
    for (const destination of cities) {
      if (origin.id === destination.id) continue;
      const leader = leaderInCity(origin.id);
      if (!leader) continue;
      travel.beginJourney(w, leader.id, { destinationCityId: destination.id, tick: 0 });
      started.push(leader.id);
    }
  }
  assert.ok(started.length > 5, 'need several real, independent zero-supply journeys for this to be a real statistical test');

  let deprivationDeaths = 0;
  for (let t = 0; t < 900 && deprivationDeaths === 0; t += 1) {
    const events = travel.advanceJourneys(w, t);
    deprivationDeaths += events.filter((e) => e.type === 'death' && e.cause === 'deprivation').length;
  }
  assert.ok(deprivationDeaths > 0,
    'at least one of many zero-supply travelers should have been recorded dead of deprivation within 900 real days');
});

test('activeJourneyFor / journeyOf: real reads, null for anyone not actually travelling', () => {
  worldgen.generateWorld({ seed: 'travel-reads-1', cities: 2, communitiesPerCity: 1, populationPerCommunity: 5 });
  const cities = w.cities.slice(-2);
  const leader = leaderInCity(cities[0].id);
  assert.equal(travel.activeJourneyFor(w, leader.id), null);
  const journey = travel.beginJourney(w, leader.id, { destinationCityId: cities[1].id, tick: 0 });
  assert.equal(travel.activeJourneyFor(w, leader.id).id, journey.id);
  assert.equal(travel.journeyOf(w, journey.id).id, journey.id);
  assert.equal(travel.journeyOf(w, 999999999), null);
});
