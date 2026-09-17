// server/infrastructure.js
//
// Roads, schools, hospitals, water, power — the built things a place
// runs on.
//
// **Why this exists, and the specific way it was found.** Writing
// `server/statistics.js` I wrote three computations — school capacity
// per 1,000, clinic capacity per 1,000, infrastructure condition — and
// each returned a real-looking **0**. The `infrastructure` table has
// exactly the right columns (type, age, condition, capacity,
// maintenance_level, funding, failure_risk) and **no WorldState array
// at all**: nothing ever created a row, so `worldState.infrastructure`
// was `undefined` everywhere, summing an empty list gave 0 capacity,
// and every area in every world reported "no schools" as a
// measurement.
//
// All three had to be declared unavailable instead. This is the
// module that lets them be answered.
//
// ---------------------------------------------------------------------
// Three things this is careful about
//
// **1. `cities.infrastructure` is a rollup and stays computed.** The
// schema says so in its own comment on the table — "cities.infrastructure
// is a rollup from this" — and standing rule 3 forbids duplicating a
// computable rollup. `generateCity` defaults that column to 50 and
// nothing updates it, which is the same placeholder shape as
// `communities.employment` and `organizations.members`. So
// `cityCondition` computes it and `describeCityDrift` reports the
// stored figure beside the computed one. Nothing writes back.
//
// **2. A `roads` row is not Transportation.** `vacon-c/CLAUDE.md` keeps
// Transportation deferred — movement, vehicles, routes — and that is
// unchanged here. `infrastructure.type` enumerates roads, bridges and
// rail as *things that exist and wear out*, which is inventory and
// condition, not travel. Nothing in this file moves anybody, chooses a
// route, or reads `trade_routes`. The deferral is about the mechanic,
// not about whether a road can be listed.
//
// **3. Decay happens where the physical world changes.** Infrastructure
// ages inside `runEnvironmentPhase`, beside `property.advancePropertyLifecycle`,
// for the reason that phase's comment already gives: it is where the
// physical world changes on its own. The pipeline stays at eleven.
//
// ---------------------------------------------------------------------
// Failure risk is computed, not stored
//
// `infrastructure.failure_risk` is a real NUMERIC column, and it is the
// fourth field in this schema that can be derived from three others —
// age, condition and maintenance. Standing rule 3 applies to it exactly
// as it applies to property value and family wealth, so `failureRisk`
// computes it on read and no code path assigns it. The column is
// written on migrate so a dashboard reading the database directly sees
// the same number, and is ignored on restore.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const { getLiveEntity } = require('./entityTraits.js');

// The schema's own enumeration on `infrastructure.type`, verbatim and
// in its order. Not extended here — a type this list does not have is
// a schema change, not an option.
const INFRASTRUCTURE_TYPES = [
  'roads', 'bridges', 'rail', 'water_systems', 'electricity',
  'internet', 'hospitals', 'schools', 'public_safety', 'waste_management',
];

//: Flagged interpretive. No document gives a decay rate, so these are
//: the shape of the model rather than measured constants, and they are
//: deliberately slower than `property.js`'s: a road outlasts a house.
const ANNUAL_DECAY = 1.2;              // condition points per year at zero maintenance
const MAINTENANCE_OFFSET = 50;         // maintenance_level above this arrests decay
const TICKS_PER_YEAR = 365;

//: Failure risk weights. Condition dominates, age contributes, and
//: funding is what lets maintenance happen at all — a well-funded
//: system with no maintenance is still failing, so funding modulates
//: rather than substitutes.
const AGE_AT_FULL_RISK = 100;          // years

let nextInfrastructureId = 1;

function reseedIds(worldState) {
  nextInfrastructureId = nextAfter(worldState.infrastructure, 'id');
  return { nextInfrastructureId };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

// -- creating -----------------------------------------------------------

function generateInfrastructure(worldState, options = {}) {
  const { cityId, type } = options;

  // `infrastructure.city_id` is NOT NULL with no default, so a piece of
  // infrastructure without a city is a row the database will refuse.
  // Caught here rather than at migrate time, which is the whole
  // difference between an error and a rolled-back migration.
  if (cityId === null || cityId === undefined) {
    throw new Error(
      'generateInfrastructure requires options.cityId (infrastructure.city_id is NOT NULL '
      + 'with no default).',
    );
  }
  if (!worldState.cities.some((c) => c.id === cityId)) {
    throw new Error(`generateInfrastructure: no city ${cityId}`);
  }
  if (!INFRASTRUCTURE_TYPES.includes(type)) {
    throw new Error(
      `generateInfrastructure: "${type}" is not an infrastructure type. The ten are: `
      + `${INFRASTRUCTURE_TYPES.join(', ')}.`,
    );
  }

  const row = {
    id: nextInfrastructureId++,
    city_id: cityId,
    type,
    age: options.age ?? 0,
    condition: options.condition ?? 100,
    // Null rather than 0 by default, and the distinction is the whole
    // reason the statistics that read this were wrong before: a school
    // with unknown capacity and a school with no capacity are
    // different facts, and `per1k` over a 0 reports the second.
    capacity: options.capacity ?? null,
    maintenance_level: options.maintenanceLevel ?? 50,
    // EPSG:4326, so `authority.reachTerm` can ask how far a community
    // is from the nearest station. Null until something places it.
    latitude: options.latitude ?? null,
    longitude: options.longitude ?? null,
    funding: options.funding ?? null,
    // Computed on read — see the header. Present on the object only so
    // the row shape matches the table; never assigned.
    failure_risk: null,
  };
  worldState.infrastructure.push(row);
  return row;
}

// -- reading ------------------------------------------------------------

function infrastructureIn(worldState, cityId, type = undefined) {
  return (worldState.infrastructure || []).filter(
    (i) => i.city_id === cityId && (type === undefined || i.type === type),
  );
}

// Total capacity of one type in a city, or null when nothing of that
// type has a stated capacity.
//
// **Null, not zero, and this is the fix for the original defect.** A
// city with no schools and a city whose schools have no capacity
// recorded are different claims, and both were reported as 0.
function capacityOf(worldState, cityId, type) {
  const rows = infrastructureIn(worldState, cityId, type);
  // **`Number(null)` is 0 and 0 is finite** — CLAUDE.md's corollary,
  // and it bit inside the module written to fix exactly this defect:
  // a school with no stated capacity passed a bare `isFinite(Number(x))`
  // guard as a capacity of zero, and `capacityOf` reported 0 instead
  // of null for the case it exists to distinguish. Null has to be
  // tested for explicitly, before the conversion.
  const stated = rows
    .filter((i) => i.capacity !== null && i.capacity !== undefined)
    .map((i) => Number(i.capacity))
    .filter((c) => Number.isFinite(c));
  if (rows.length === 0) return null;      // nothing of this type exists
  if (stated.length === 0) return null;    // it exists and nobody said how big
  return stated.reduce((a, b) => a + b, 0);
}

// 0..1. Condition dominates, age contributes, maintenance offsets both.
// Computed rather than stored — standing rule 3.
function failureRisk(row) {
  if (!row) return null;
  const condition = clamp(Number(row.condition) || 0) / 100;
  const age = Math.min(1, (Number(row.age) || 0) / AGE_AT_FULL_RISK);
  const maintenance = clamp(Number(row.maintenance_level) ?? 50) / 100;
  const raw = (1 - condition) * 0.6 + age * 0.4;
  return Math.round(Math.max(0, raw * (1 - maintenance * 0.5)) * 10000) / 10000;
}

// Mean condition across a city's infrastructure — what
// `cities.infrastructure` is a rollup OF, per that column's own schema
// comment. Null for a city with none, because a city nobody has built
// anything in has no condition rather than a condition of zero.
function cityCondition(worldState, cityId) {
  const values = infrastructureIn(worldState, cityId)
    .map((i) => Number(i.condition))
    .filter((c) => Number.isFinite(c));
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

// The stored column beside the computed one — same pattern as
// `areaStats.describeDrift` and `membership.describeMemberDrift`, and
// for the same reason: `generateCity` defaults `infrastructure` to 50
// and nothing updates it, so a city reports half-decent infrastructure
// because 50 is the default.
function describeCityDrift(worldState, cityId) {
  const city = worldState.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`describeCityDrift: no city ${cityId}`);
  const stored = city.infrastructure ?? null;
  const computed = cityCondition(worldState, cityId);
  return {
    cityId,
    stored,
    computed,
    drifted: stored !== null && computed !== null
      && Math.abs(Number(stored) - computed) > 0.01,
  };
}

//: **What a well-served city of this size actually has**, per 1,000
//: residents, for the four types that carry a headcount at all.
//:
//: This lived in `worldgen.js` as generation input and nothing could
//: read it back, so `motivation.js` had no way to ask "is this city
//: normally served?" — its first version divided raw capacity by the
//: whole population and read a hospital with 30 beds per 1,000 people
//: as 3% coverage, which collapsed the healthcare need to 0.8 on
//: everybody alive. Beds per head is not the same question as whether
//: care is available.
//:
//: Declared here because this is where infrastructure types live, and
//: `worldgen.js` now builds from it rather than from its own copy — two
//: lists of the same numbers is how they come to disagree.
//:
//: Flagged interpretive: no document sets service levels. What matters
//: is that the generator and the reader use ONE set.
const DESIGN_CAPACITY_PER_1K = {
  schools: 180,
  hospitals: 30,
  public_safety: 25,
  waste_management: 900,
};

// How well a city is served for one type, 0..1, against the design
// baseline above. Null — not zero — when nothing is built or nothing
// states a capacity, because unknown is not unserved and a caller
// should be able to tell the difference.
function serviceLevel(worldState, cityId, type, residents) {
  const baseline = DESIGN_CAPACITY_PER_1K[type];
  if (!baseline) return null;
  const capacity = capacityOf(worldState, cityId, type);
  if (capacity === null || capacity === undefined) return null;
  if (!Number.isFinite(residents) || residents <= 0) return null;
  const perThousand = (Number(capacity) / residents) * 1000;
  return Math.max(0, Math.min(1, perThousand / baseline));
}

//: How much a population's own technical skill raises the effective
//: maintenance of what it has built. At 0.4, a city whose people are
//: expert across the `technology` family maintains its infrastructure
//: as if it were 40 points better funded.
//:
//: **This is the `technology` family's home.** Machinery Aptitude,
//: Electronics Repair, Signal/Comms Literacy and Salvage Engineering
//: are about keeping things working, and keeping things working is
//: what `maintenance_level` means. A world that has lost its engineers
//: watches its water systems fail faster, with no separate mechanism
//: for it.
const TECHNICAL_SKILL_WEIGHT = 0.4;

// The mean technical skill of a city's residents, 0..100.
//
// Null-safe and cheap: a city with nobody in it returns 50, which is
// the neutral value and leaves maintenance exactly as recorded.
function technicalSkillIn(worldState, cityId) {
  const communities = new Set((worldState.communities || [])
    .filter((c) => c.city_id === cityId)
    .map((c) => c.id));
  if (communities.size === 0) return 50;

  const values = [];
  for (const npc of worldState.npcs || []) {
    if (!communities.has(npc.communityId)) continue;
    const live = getLiveEntity(worldState, npc.id);
    const tech = live?.traits?.technology;
    if (!tech) continue;
    const scores = Object.values(tech).map(Number).filter((v) => Number.isFinite(v));
    if (scores.length > 0) values.push(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// What a piece of infrastructure is effectively maintained at: what is
// funded for it, plus what the people around it can do.
function effectiveMaintenance(worldState, row) {
  const recorded = Number(row.maintenance_level) ?? 50;
  const skill = technicalSkillIn(worldState, row.city_id);
  return Math.max(0, Math.min(100, recorded + (skill - 50) * TECHNICAL_SKILL_WEIGHT));
}

// -- decay --------------------------------------------------------------

// One tick of wear on everything standing.
//
// Runs inside `runEnvironmentPhase`, beside the property lifecycle —
// see the header. Returns the events the tick should consider, in the
// same shape every phase returns.
function advanceInfrastructure(worldState, tick = worldState.tick ?? 0) {
  const events = [];

  for (const row of worldState.infrastructure || []) {
    const priorCondition = Number(row.condition) || 0;
    row.age = (Number(row.age) || 0) + 1 / TICKS_PER_YEAR;

    // Maintenance above the offset arrests decay; below it, the
    // shortfall is what wears the thing out. A fully maintained system
    // does not improve on its own — repair is an action somebody
    // takes, not weather.
    const shortfall = Math.max(0, MAINTENANCE_OFFSET - effectiveMaintenance(worldState, row))
      / MAINTENANCE_OFFSET;
    const decay = (ANNUAL_DECAY / TICKS_PER_YEAR) * (0.25 + shortfall);
    // **Not rounded.** The first version rounded to two decimals on
    // every write, and a daily decay of ~0.004 rounded straight back
    // to where it started — infrastructure sat at 100 forever and the
    // decay model was decorative. A value changed by less than its own
    // display precision has to accumulate at full precision and be
    // rounded on READ, which `cityCondition` does.
    row.condition = clamp(priorCondition - decay);

    // **A crossing, not a condition** — standing rule 7. Emitting on
    // "risk is high" would put an identical row in the event log every
    // tick for as long as it stayed high, burying the tick it actually
    // became true.
    const priorRisk = failureRisk({ ...row, condition: priorCondition, age: row.age });
    const risk = failureRisk(row);
    if (priorRisk < 0.5 && risk >= 0.5) {
      events.push({
        type: 'infrastructure_at_risk',
        severity: 'high',
        note: `${row.type} in city ${row.city_id} crossed into failure risk (${risk})`,
        tick,
        affected_entity_ids: [],
        global_effects: { infrastructureId: row.id, type: row.type, failureRisk: risk },
      });
    }
  }

  return events;
}

module.exports = {
  INFRASTRUCTURE_TYPES,
  ANNUAL_DECAY,
  MAINTENANCE_OFFSET,
  AGE_AT_FULL_RISK,
  DESIGN_CAPACITY_PER_1K,
  serviceLevel,
  TECHNICAL_SKILL_WEIGHT,
  technicalSkillIn,
  effectiveMaintenance,
  reseedIds,
  generateInfrastructure,
  infrastructureIn,
  capacityOf,
  failureRisk,
  cityCondition,
  describeCityDrift,
  advanceInfrastructure,
};
