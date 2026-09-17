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

const { seededDraw } = require('./seeded.js');

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
    // Down since when, and how long it takes to come back. Null when
    // the thing is running, which is not the same as "repaired at tick
    // 0" — see `isFailed`.
    failed_since_tick: options.failedSinceTick ?? null,
    repair_ticks: options.repairTicks ?? null,
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

    // **And now it can actually fail.** The risk above was computed,
    // crossed and consumed by nothing — see the header on
    // OUTAGE_EFFECTS. A failure is a seeded draw against it, so §88's
    // replay guarantee holds: the same world and the same seed break
    // the same pipes on the same day.
    if (isFailed(row)) {
      if (tick - Number(row.failed_since_tick) >= Number(row.repair_ticks ?? MIN_OUTAGE_TICKS)) {
        const repaired = repairInfrastructure(worldState, row, { tick });
        events.push({
          type: 'infrastructure_repaired',
          severity: 'low',
          note: `${row.type} in city ${row.city_id} is back`,
          tick,
          affected_entity_ids: [],
          global_effects: { ...repaired },
        });
      }
      continue;
    }

    // **Seeded on the city and the type, not on the row id.** The first
    // version used `row.id` and argued that this module's own counter
    // was safe because `worldgen` builds in a fixed order. It is not:
    // the counter is module-level and its state depends on everything
    // built in the process before it, so the same world generated
    // second broke different things on different days. §88's corollary
    // — seed on POSITION, never on identity — and the determinism test
    // is what found it, which is the whole reason that test asserts
    // equality rather than just that something broke.
    //
    // A city has at most one row per type, so city+type identifies this
    // system without depending on anything built earlier.
    const draw = seededDraw([worldState.seed ?? 'infra', 'fail', row.city_id, row.type, tick]);
    if (draw >= risk * DAILY_FAILURE_RATE) continue;
    const failure = failInfrastructure(worldState, row, { tick });
    if (failure) {
      events.push({
        type: 'infrastructure_failure',
        // A failure nothing feels is worth less noise than one that
        // takes the water off.
        severity: failure.felt ? 'high' : 'moderate',
        note: `${row.type} in city ${row.city_id} failed`
          + `${failure.felt ? '' : ' (nothing in the engine consumes this type yet)'}`,
        tick,
        affected_entity_ids: [],
        global_effects: { ...failure, failureRisk: risk },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------
// Failure — and the fact that nothing ever failed
// ---------------------------------------------------------------------
//
// **`failureRisk` was computed, crossed and consumed by nothing.** It
// had exactly two readers: one statistic, and the `infrastructure_at_risk`
// event directly above, which fires once when the risk crosses 0.5 and
// then never again. A system at risk 0.95 behaved identically to one at
// 0.05 — the water kept running either way. `funding` had no reader
// anywhere in the engine at all.
//
// So §7's Energy was `slot` ("Storage exists and nothing reads it"),
// Waste was `slot`, Water was `partial` on the strength of the resource
// rather than the pipes, and Fire & Emergency was `slot` sharing the
// public_safety row with policing. Four systems, one missing mechanism.
//
// ---------------------------------------------------------------------
// An outage is an ordinary condition, not a second effect channel
//
// The same decision `environment.js` made about severe weather, for the
// same reason: everything that already reads `activeConditions` picks
// this up for free, the Environment phase ages and expires it, and
// since 17 Sep it gives back exactly what it took when it does. A
// parallel mechanism doing the same job is how two systems come to
// disagree about the state of the world.
//
// **What each failure actually does, and the four that do nothing.**
// Every effect below goes through a mechanism that already exists:
//
//   water_systems     the water supply drops. `water` is a real
//                     resource and `motivation.SATISFIERS.water` reads
//                     it, so a burst main is felt by every person in
//                     the city rather than by a statistic.
//   electricity       the energy supply drops. §40 names electricity as
//                     the head of the whole bottleneck chain.
//   waste_management  disease. Sanitation failing is the oldest
//                     epidemic there is, and `mortality.addDiseaseOutbreak`
//                     is the channel — `diseasePressure` reads the
//                     `mortalityMultiplier` it carries.
//   hospitals         the same channel, because a hospital that is not
//                     running is felt as the disease it is not treating.
//
//   schools           **declared.** Education is `partial` and there is
//                     no per-tick education mechanism for an outage to
//                     interrupt — `npcs.education` is set at generation
//                     and never moves.
//   roads, bridges,
//   rail, internet    **declared.** Transportation is on CLAUDE.md's
//                     do-not-touch list and Communication is `partial`;
//                     an outage with nothing to interrupt would be an
//                     event in a log and nothing else.
//   public_safety     **already felt, and deliberately not doubled.**
//                     `authority.reachTerm` reads the condition of a
//                     city's public_safety rows directly, so a station
//                     falling apart already thins the state's writ. An
//                     outage condition on top would count it twice.
//                     That is also why Fire & Emergency stays `slot`:
//                     it shares the row with policing and nothing in the
//                     schema separates them.
const OUTAGE_EFFECTS = {
  water_systems: { resourceType: 'water', supplyDelta: -4, demandDelta: 0 },
  electricity: { resourceType: 'energy', supplyDelta: -4, demandDelta: 0 },
  waste_management: { disease: 'sanitation failure', mortalityMultiplier: 1.4 },
  hospitals: { disease: 'untreated illness', mortalityMultiplier: 1.3 },
};

//: How long an outage runs before repair even begins to be possible,
//: and how much of the risk becomes a failure on any given day.
//:
//: **Flagged interpretive, and chosen against a measured risk rather
//: than from what a number sounds like.** `failureRisk` on a generated
//: world sits low — maintenance defaults to 50, which arrests most of
//: the decay — so a daily draw straight against the risk would fail
//: everything constantly. At 0.002 a system sitting at risk 0.5 fails
//: about once every three years, and one at 0.9 about once every
//: twenty months, which is a utility that is unreliable rather than one
//: that is broken.
const DAILY_FAILURE_RATE = 0.002;

//: The shortest an outage can last. Repair takes as long as the city's
//: funding and its people's skill make it take, and this is the floor
//: under that — nothing is fixed the same afternoon.
const MIN_OUTAGE_TICKS = 3;
const MAX_OUTAGE_TICKS = 60;

// How long this city takes to fix this thing, in ticks.
//
// **`funding`'s first reader in the engine.** A funded system in a city
// with people who know how it works comes back quickly; an unfunded one
// in a city that has lost the knowledge stays down. Both halves already
// exist — `funding` on the row and `technicalSkillIn` over the city —
// and neither was read by anything.
//
// Null funding is not zero funding: a system nobody recorded a budget
// for is unknown, and reads as the midpoint rather than as abandoned.
function repairTicks(worldState, row) {
  const funded = row.funding === null || row.funding === undefined
    ? 50
    : clamp(Number(row.funding));
  const skill = technicalSkillIn(worldState, row.city_id);
  const capability = clamp((funded + skill) / 2) / 100;
  const span = MAX_OUTAGE_TICKS - MIN_OUTAGE_TICKS;
  return Math.round(MIN_OUTAGE_TICKS + span * (1 - capability));
}

// Is this row currently down?
function isFailed(row) {
  return row?.failed_since_tick !== null && row?.failed_since_tick !== undefined;
}

function failedIn(worldState, cityId) {
  return infrastructureIn(worldState, cityId).filter(isFailed);
}

// Put a system down and hang the consequence off the existing channel.
// Exported so a scenario can fail something deliberately, which is the
// same courtesy `mortality.addDiseaseOutbreak` extends.
function failInfrastructure(worldState, row, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  if (isFailed(row)) return null;

  const ticks = repairTicks(worldState, row);
  row.failed_since_tick = tick;
  row.repair_ticks = ticks;

  const effect = OUTAGE_EFFECTS[row.type] ?? null;
  if (effect && effect.disease) {
    // Required lazily: `mortality.js` does not depend on this file, and
    // keeping the import local keeps the dependency one-way.
    const mortality = require('./mortality.js');
    mortality.addDiseaseOutbreak(worldState, {
      name: effect.disease,
      mortalityMultiplier: effect.mortalityMultiplier,
      ticksRemaining: ticks,
      tick,
    });
  } else if (effect) {
    (worldState.activeConditions || (worldState.activeConditions = [])).push({
      conditionType: 'outage',
      name: `${row.type} failure`,
      resourceType: effect.resourceType,
      supplyDelta: effect.supplyDelta,
      demandDelta: effect.demandDelta,
      ticksRemaining: ticks,
      cityId: row.city_id,
      communityId: null,
      startedTick: tick,
    });
  }

  return {
    infrastructureId: row.id, type: row.type, cityId: row.city_id, repairTicks: ticks,
    felt: Boolean(effect),
  };
}

// Bring it back.
//
// **A repair restores SERVICE, not condition, and that took two wrong
// answers to get to.** The worry was real — a system coming back in
// exactly the state that broke it breaks again immediately, which would
// be the fifth one-way ratchet this engine has had after resources,
// habits, buildings and conditions — and the first two answers to it
// were both worse than the problem.
//
// Restoring 25 points made a neglected bridge climb from condition 55
// to 100 over 6,000 ticks: it got BETTER the more often it broke, and
// `infrastructure-demographics.test.js`'s assertion that the at-risk
// crossing fires exactly once started reporting zero, because the
// bridge could no longer reach the band at all. Dropping to 5 was the
// same defect smaller — measured over the same run, 7 failures gained
// 35 points against 20 points of decay, so it still climbed.
//
// The size cannot be fixed by choosing a better number, because any
// gain is coupled to how often the thing fails: the failure rate
// depends on the condition, which the gain then changes. **So the gain
// is zero and the model says why.** Fixing a burst main does not make
// the pipe new, and the inverse of wear already exists and is not this
// — `effectiveMaintenance` arrests most of the decay for a system a
// city actually funds and has people skilled enough to service.
//
// A city that never maintains anything ends up with everything broken.
// That is the correct outcome for this setting and it needs no constant
// to produce it.
function repairInfrastructure(worldState, row, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  if (!isFailed(row)) return null;
  row.failed_since_tick = null;
  row.repair_ticks = null;
  return { infrastructureId: row.id, type: row.type, cityId: row.city_id, tick };
}

module.exports = {
  OUTAGE_EFFECTS,
  DAILY_FAILURE_RATE,
  MIN_OUTAGE_TICKS,
  MAX_OUTAGE_TICKS,
  repairTicks,
  isFailed,
  failedIn,
  failInfrastructure,
  repairInfrastructure,
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
