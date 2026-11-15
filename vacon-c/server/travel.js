// server/travel.js
//
// By direct instruction: Oregon Trail-style group travel, "resource
// consumption over distance/time." Two already-real things compose
// into this rather than a new one being invented: `geo.distanceMetres`/
// `positionOf`'s real haversine distance between two generated cities
// (each drawn at an independently scattered, believable global
// position — `geo.js`'s own header) and `party.partyOf`'s real,
// persistent escort roster — "group" is this engine's own party,
// never reinvented.
//
// ---------------------------------------------------------------------
// The real historical pace
// ---------------------------------------------------------------------
// The National Park Service / Oregon-California Trails Association's
// own documented figure: a wagon train covering the roughly 3,200 km
// (2,000 mile) Oregon Trail in four to six months averaged close to
// 15 miles (24 km) a day. Flagged interpretive the same way
// `geo.CITY_SPREAD_M` is — a real, cited historical pace borrowed as
// this engine's own travel-speed CONSTANT, never a claim that any
// generated world's own terrain or trail conditions were measured.
// Carry weight, vehicles and terrain difficulty are all explicitly
// out of scope here — see `VACANCY_INVENTORY.md`'s own notes on the
// still-unbuilt carry-capacity and vehicle systems.
//
// ---------------------------------------------------------------------
// Consumption: real items, real categories, no ration invented
// ---------------------------------------------------------------------
// Each traveling day, every real, still-living party member (the
// leader included) consumes one real unit from any item they hold
// whose real `items.js` category is `food`, and separately one of
// `water` — the exact category vocabulary `produce.js`/`salvage.js`
// already register their real items under (bread, canned food,
// clean water, bottled water, and so on), never a second "ration"
// item invented for this. One unit per category per day is flagged
// interpretive, the same honest-default posture `discovery.js`'s own
// `FINDS_PER_SIGNIFICANCE` takes: no document gives a real caloric or
// hydration value for any item this catalogue defines.
//
// ---------------------------------------------------------------------
// Running out does not kill outright — it is an ADDITIONAL hazard
// ---------------------------------------------------------------------
// A traveler's `npc.communityId` (and the risk `mortality.runMortality`
// already reads from it every tick) does not change just because they
// are on the road — their home city's own ordinary scarcity, disease
// pressure and age risk keep applying regardless. So a day with no
// food or water does not reuse `mortality.annualDeathRisk` wholesale
// (which would double-count the base/age/disease terms `runMortality`
// already applies this same tick); it reuses exactly the two real
// building blocks that describe TOTAL deprivation —
// `mortality.scarcityRisk(1)` and that entity's own real
// `mortality.hardinessFactor` — as one additional, independent daily
// draw, through the one real choke point every other death in this
// engine already goes through: `mortality.recordDeath`, cause
// `'deprivation'`, the identical cause `mortality.js`'s own header
// already named as the real, reusable "ran out of supplies" value
// rather than an eighth invented cause.
//
// ---------------------------------------------------------------------
// Arrival reuses `migration.relocate`, never a second move mechanism
// ---------------------------------------------------------------------
// A one-way journey's real survivors are relocated into a real,
// seeded-pick community of the destination city through
// `migration.relocate` — the identical real function
// `migration.runMigration`'s own push-driven moves already use.
// Arriving with no `toPropertyId` is not a gap papered over: a
// migrant with nowhere real to live yet is exactly the condition
// `populationPacks.homelessnessRateFor`'s own real statistics already
// describe, which is the honest, already-real place this lands rather
// than a second invented status.
//
// **A round trip closes a real, declared gap, for the first time.**
// `migration.js`'s own `TYPES_NOT_MODELLED.temporary` says plainly:
// "nothing in the engine returns somebody to where they came from."
// `roundTrip: true` is the first thing in this engine that actually
// does — the party turns around at the destination and the SECOND leg
// ends with every real survivor simply arriving back at their own
// unchanged home, no `migration.relocate` call at all, because there
// is nothing to move: `toCommunityId` would just be the community
// they already live in. No `migration_events` row is written for that
// second leg, because this schema's own definition of a migration
// event is a move, and a return to an unchanged home is not one — the
// real outcome (the traveler is actually home) is what the gap asked
// for, not a log entry.

'use strict';

const geo = require('./geo.js');
const party = require('./party.js');
const inventory = require('./inventory.js');
const items = require('./items.js');
const mortality = require('./mortality.js');
const migration = require('./migration.js');
const { seededDraw } = require('./seeded.js');

//: See this file's own header. A real, cited historical pace, not a
//: measurement of any generated world's own geography.
const KM_PER_DAY = 24;
const METRES_PER_DAY = KM_PER_DAY * 1000;

//: The two real item categories `produce.js`/`salvage.js` already
//: register survival goods under. Not exported as a gate anywhere else
//: reads — this file is the only consumer, the same posture
//: `mortality.SURVIVAL_RESOURCES` holds for the community-level term.
const SURVIVAL_CATEGORIES = ['food', 'water'];

let nextJourneyId = 1;

function cityOf(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === Number(entityId));
  if (!npc) return null;
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  return community?.city_id ?? null;
}

// One real journey is the most any entity can be on at a time — the
// identical real constraint `party.js`'s own header gives for
// escorting two leaders at once, applied to the road instead of the
// roster.
function activeJourneyFor(worldState, entityId) {
  return (worldState.journeys || []).find(
    (j) => j.status === 'traveling' && j.memberEntityIds.includes(Number(entityId)),
  ) ?? null;
}

// The leader plus their real, already-assembled party — never a
// second roster invented here. A leader with no assembled party still
// travels, alone, which is a real, smaller case of the same mechanic
// rather than a refusal.
function membersFor(worldState, leaderEntityId) {
  const partyIds = party.partyOf(worldState, leaderEntityId).map((n) => n.id);
  return [...new Set([Number(leaderEntityId), ...partyIds])];
}

function journeyOf(worldState, journeyId) {
  return (worldState.journeys || []).find((j) => j.id === Number(journeyId)) ?? null;
}

function beginJourney(worldState, leaderEntityId, options = {}) {
  const { destinationCityId, tick = worldState.tick ?? 0, roundTrip = false } = options;
  if (destinationCityId == null) {
    throw new Error('beginJourney requires options.destinationCityId.');
  }

  const leader = (worldState.npcs || []).find((n) => n.id === Number(leaderEntityId));
  if (!leader) throw new Error(`beginJourney: entity ${leaderEntityId} is not among the living.`);

  const members = membersFor(worldState, leaderEntityId);
  for (const id of members) {
    if (activeJourneyFor(worldState, id)) {
      throw new Error(`beginJourney: entity ${id} is already on a real journey.`);
    }
  }

  const originCityId = cityOf(worldState, leaderEntityId);
  if (originCityId == null) {
    throw new Error(`beginJourney: entity ${leaderEntityId} has no real current city to leave from.`);
  }
  if (originCityId === Number(destinationCityId)) {
    throw new Error('beginJourney: origin and destination are the same real city.');
  }

  const originCity = (worldState.cities || []).find((c) => c.id === originCityId);
  const destinationCity = (worldState.cities || []).find((c) => c.id === Number(destinationCityId));
  if (!destinationCity) throw new Error(`beginJourney: no real city ${destinationCityId}.`);

  const distanceMetres = geo.distanceMetres(geo.positionOf(originCity), geo.positionOf(destinationCity));
  if (distanceMetres === null) {
    throw new Error('beginJourney: one of these two real cities has no real geographic position to measure a distance from.');
  }

  const totalDays = Math.max(1, Math.ceil(distanceMetres / METRES_PER_DAY));

  worldState.journeys = worldState.journeys || [];
  const journey = {
    id: nextJourneyId++,
    leaderEntityId: Number(leaderEntityId),
    memberEntityIds: members,
    originCityId,
    destinationCityId: Number(destinationCityId),
    distanceMetres,
    totalDays,
    daysElapsed: 0,
    roundTrip: !!roundTrip,
    leg: 'outbound',
    status: 'traveling',
    startedTick: tick,
  };
  worldState.journeys.push(journey);
  return journey;
}

// Takes one real unit from any held item of this category. `false`
// when nobody holds one — the caller decides what that means, this
// function only ever reports the real fact.
function consumeOneUnitOfCategory(worldState, entityId, category) {
  const holding = inventory.holdingsOf(worldState, entityId).find(
    (h) => Number(h.quantity) > 0 && items.findItem(worldState, h.item_name)?.category === category,
  );
  if (!holding) return false;
  const result = inventory.take(worldState, { entityId, itemName: holding.item_name, quantity: 1 });
  return result.short === 0;
}

// The one additional hazard a day with nothing to eat or drink adds —
// see this file's own header for why this is `scarcityRisk(1)`
// (total deprivation) rather than `annualDeathRisk`'s full formula.
function deprivationDrawHits(worldState, entityId, journeyId, tick) {
  const environmentRisk = mortality.scarcityRisk(1) * mortality.hardinessFactor(worldState, entityId);
  const daily = environmentRisk / mortality.TICKS_PER_YEAR;
  if (daily <= 0) return false;
  return seededDraw([worldState.seed ?? 'world', 'travel-deprivation', journeyId, entityId, tick]) < daily;
}

function arriveInCity(worldState, entityId, cityId, tick) {
  const destinationCommunities = (worldState.communities || []).filter((c) => c.city_id === cityId);
  if (destinationCommunities.length === 0) {
    throw new Error(`travel: destination city ${cityId} has no real community to arrive into.`);
  }
  const draw = seededDraw([worldState.seed ?? 'world', 'journey-arrival', cityId, entityId]);
  const pick = destinationCommunities[Math.min(
    destinationCommunities.length - 1,
    Math.floor(draw * destinationCommunities.length),
  )];
  return migration.relocate(worldState, {
    entityId,
    toCommunityId: pick.id,
    toPropertyId: null,
    migrationType: 'exploration',
    reason: 'overland journey',
    tick,
  });
}

// One real day of every active journey — the cross-cutting pass this
// file's own header describes. Runs in `tick.js` right after
// `mortality.runMortality`, so a member mortality already took this
// same tick is gone from `worldState.npcs` (and so from "still
// living") before travel ever touches them, and a death travel itself
// causes becomes an event and a historical record on the tick it
// happened, the identical ordering `mortality.js`'s own header argues
// for its own place in the pipeline.
function advanceJourneys(worldState, tick = worldState.tick ?? 0) {
  worldState.journeys = worldState.journeys || [];
  const events = [];

  for (const journeyEntry of worldState.journeys) {
    if (journeyEntry.status !== 'traveling') continue;

    const living = journeyEntry.memberEntityIds.filter(
      (id) => (worldState.npcs || []).some((n) => n.id === id),
    );

    const lost = [];
    for (const id of living) {
      const hadFood = consumeOneUnitOfCategory(worldState, id, 'food');
      const hadWater = consumeOneUnitOfCategory(worldState, id, 'water');
      if (hadFood && hadWater) continue;
      if (!deprivationDrawHits(worldState, id, journeyEntry.id, tick)) continue;

      const shortage = !hadFood && !hadWater ? 'food and water' : !hadFood ? 'food' : 'water';
      const death = mortality.recordDeath(worldState, {
        entityId: id,
        cause: 'deprivation',
        tick,
        detail: `ran out of ${shortage} travelling to city ${journeyEntry.destinationCityId}`,
      });
      events.push(death.event);
      lost.push(id);
    }
    if (lost.length > 0) {
      journeyEntry.memberEntityIds = journeyEntry.memberEntityIds.filter((id) => !lost.includes(id));
    }

    journeyEntry.daysElapsed += 1;
    if (journeyEntry.daysElapsed < journeyEntry.totalDays) continue;

    if (journeyEntry.memberEntityIds.length === 0) {
      journeyEntry.status = 'abandoned';
      events.push({ type: 'journey-abandoned', journeyId: journeyEntry.id, tick });
      continue;
    }

    if (journeyEntry.leg === 'outbound' && journeyEntry.roundTrip) {
      const { originCityId, destinationCityId } = journeyEntry;
      journeyEntry.originCityId = destinationCityId;
      journeyEntry.destinationCityId = originCityId;
      journeyEntry.leg = 'return';
      journeyEntry.daysElapsed = 0;
      events.push({
        type: 'journey-leg-complete', journeyId: journeyEntry.id, atCityId: destinationCityId, tick,
      });
      continue;
    }

    if (journeyEntry.leg === 'return') {
      // Home. Nothing real to relocate TO — see this file's own header
      // on why that is the point of a round trip, not a gap in it.
      journeyEntry.status = 'arrived';
      events.push({
        type: 'journey-arrived', journeyId: journeyEntry.id, atCityId: journeyEntry.destinationCityId, roundTrip: true, tick,
      });
      continue;
    }

    for (const id of journeyEntry.memberEntityIds) {
      arriveInCity(worldState, id, journeyEntry.destinationCityId, tick);
    }
    journeyEntry.status = 'arrived';
    events.push({
      type: 'journey-arrived', journeyId: journeyEntry.id, atCityId: journeyEntry.destinationCityId, roundTrip: false, tick,
    });
  }

  return events;
}

module.exports = {
  KM_PER_DAY,
  METRES_PER_DAY,
  SURVIVAL_CATEGORIES,
  cityOf,
  activeJourneyFor,
  membersFor,
  journeyOf,
  beginJourney,
  advanceJourneys,
};
