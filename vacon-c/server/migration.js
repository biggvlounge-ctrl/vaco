// server/migration.js
//
// People actually moving.
//
// **What was here before.** `runMigrationPhase` computed a "migration
// risk" per person from Volatility and Resource Hoarding, emitted an
// event whose own text said "no relocation system built yet", and
// nobody ever went anywhere. `migration_events` and `regions` were both
// tables with no store. `tick.js`'s header named the gap plainly:
// "properties exist to move into, but nothing chooses a destination".
//
// ---------------------------------------------------------------------
// Circumstances push; disposition only decides who goes
//
// The old risk was computed from two traits and nothing else, which is
// the same model §9 forbids for crime — a reading of who somebody IS
// rather than what they are living through. It was also inert for the
// exact reason that makes such a model wrong: traits barely move, so
// the same people were "at risk" on tick 1 and every tick after, which
// is what made migration the largest single source of noise in the
// event log (11,809 events in 300 ticks) before a crossing was added.
//
// `needs` changed what is available. An unmet housing, safety, income
// or food need is not a personality reading — it is a reason to leave,
// and it is already measured for every person every tick. So:
//
//   PUSH   comes from unmet needs. Why somebody would go.
//   PULL   comes from comparing where they are to where they could be.
//          Whether there is anywhere better, with a home free in it.
//   WHO    is where traits come in, and only here: two people under
//          identical pressure do not both leave.
//
// ---------------------------------------------------------------------
// Four of the schema's seven types are grounded; three are declared
//
// `migration_events.migration_type` enumerates
// `daily|temporary|seasonal|permanent|forced|economic|exploration`.
// Four of those describe a relocation this engine can actually observe
// the cause of. The other three describe patterns it has no substrate
// for — there is no commute, no season and no temporary absence — and
// inventing them would put three kinds of movement in the log that
// nothing could ever have produced.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const { getLiveEntity } = require('./entityTraits.js');
const areaStats = require('./areaStats.js');
const crime = require('./crime.js');
const motivation = require('./motivation.js');
const { seededUnit } = require('./seeded.js');

let nextMigrationId = 1;
let nextRegionId = 1;

function reseedIds(worldState) {
  nextMigrationId = nextAfter(worldState.migrationEvents, 'id');
  nextRegionId = nextAfter(worldState.regions, 'id');
  return { nextMigrationId, nextRegionId };
}

// ---------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------

// `migration_events.migration_type`'s own enumeration, in its order.
const MIGRATION_TYPES = [
  'daily', 'temporary', 'seasonal', 'permanent', 'forced', 'economic', 'exploration',
];

//: The three this engine cannot honestly produce, with why. Named so
//: the absence is data rather than a silence, and so a later system
//: that builds the substrate knows what it would unlock.
const TYPES_NOT_MODELLED = {
  daily: 'no commute — `schedule_events` has a workplace but moving to it is not a relocation',
  temporary: 'nothing in the engine returns somebody to where they came from',
  seasonal: 'no seasons — the engine has no climate state to turn',
};

const TYPES_MODELLED = MIGRATION_TYPES.filter((t) => !TYPES_NOT_MODELLED[t]);

//: Which unmet need produces which kind of move, and how hard it
//: pushes. Drawn from what the type words mean rather than invented:
//: losing your housing or your safety is `forced`, chasing income is
//: `economic`, and a general dissatisfaction is `permanent`.
//:
//: `exploration` is the one with no push at all — it is somebody
//: leaving a place that is fine, which is why it reads from the
//: `mental.Curiosity` trait in `willingness` instead.
const PUSH_BY_NEED = {
  housing: { type: 'forced', weight: 1 },
  safety: { type: 'forced', weight: 1 },
  income: { type: 'economic', weight: 0.8 },
  food: { type: 'economic', weight: 0.6 },
};

//: How unmet a need has to be before it is a reason to leave, and how
//: much better somewhere else has to be before going is worth it.
//:
//: **Two thresholds, not one** — the seventh standing rule. Without the
//: gap, somebody sitting on the line would move back and forth every
//: tick and fill the log with it.
//:
//: ---------------------------------------------------------------------
//: **Both of these were picked from what a number sounds like, and both
//: are measurably wrong. Neither has been changed yet, on purpose.**
//: ---------------------------------------------------------------------
//: Standing rule 12's third clause says to measure the population a
//: cutoff will be applied to before choosing it. Measured, on 400 ticks
//: of a generated world (`seed: playtest`), sampling every person under
//: push on every tick — 22,297 person-decisions:
//:
//:     destinations clearing current + PULL_MARGIN
//:       zero: 22,286 decisions
//:       one:       11 decisions
//:       two or more: never
//:
//:     best available edge (score - current)
//:       p50 0.036   p90 0.101   p99 0.146   max 0.182
//:
//: `PULL_MARGIN` is 0.15, which sits **above the 99th percentile of the
//: distribution it filters**, and the largest gap between any two
//: communities ever observed is 0.182. Communities in a generated world
//: are not fifteen points of desirability apart; 0.15 sounds like
//: "meaningfully better" on a 0..1 scale and is in practice a closed
//: door. 0.05% of decisions clear it.
//:
//: `PUSH_FLOOR` fails the same test from the other side: 397 of 400
//: ticks had somebody under push, peaking at **150 of 150 people**. A
//: threshold the whole population is permanently past carries no
//: information either. The world is 150 people who always want to
//: leave and 21 who ever do.
//:
//: Together they are why migration arrives in bursts. The margin is a
//: threshold on a WORLD-level quantity, so on the rare tick some
//: community's edge crosses it, it crosses for everybody at once —
//: eleven people leaving together, into the one destination that
//: qualifies. The histogram above is the proof: the acceptable set is
//: never larger than one, which is also why adding a weighted draw to
//: `destinationFor` changed nothing.
//:
//: **They are left alone because fixing them is rule 17's trap.** That
//: rule cost four wrong answers in a row to learn, and its lesson is
//: that a snapshot percentile does not survive repeated sampling: every
//: pushed person gets a draw every tick, so a margin set at today's p95
//: would not stay a p95 gate. Choosing these two numbers is a real
//: modelling decision that wants its own measurement of the JOINT
//: behaviour over time, and it must separate the threshold from the
//: rate — conflating those is exactly what produced the warzone in
//: `resolveAggression`. The measurement above is what that decision
//: needs; making the decision is not this commit.
//:
//: One caveat on the numbers, stated rather than buried: the probe
//: samples the world AFTER `advanceTick`, so it is not bit-identical to
//: the snapshot `runMigration` decides from mid-tick. The shape of the
//: distribution is the finding; the counts are indicative.
const PUSH_FLOOR = 30;
const PULL_MARGIN = 0.15;

//: How often somebody under real pressure actually goes, per tick, at
//: full willingness. Flagged interpretive: no document sets a rate.
//: Low because a tick is a day, and a population where everybody under
//: strain moves within a week is a refugee crisis rather than a city.
const MOVE_CHANCE = 0.02;

//: How long somebody stays put after moving. **This is what stops
//: churn, and without it the model produced 993 moves in 300 ticks for
//: a hundred people** — roughly ten relocations each.
//:
//: The cause is worth recording because it is structural rather than a
//: bad constant: a move changes WHERE somebody is and not whether they
//: have work, so an income-driven mover arrives still pushed. Meanwhile
//: the destination's work share falls as they arrive, so the "best"
//: community keeps changing and everybody chases it. Any model whose
//: push survives the action it motivates will do this.
//:
//: Six months of ticks. Moving is disruptive and people do not do it
//: fortnightly, and no new state is needed to enforce it —
//: `migration_events.tick` already records when somebody last went.
const SETTLING_TICKS = 180;

// ---------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------

// A region groups cities, which is what gives `exploration` a meaning
// distinct from any other move: going somewhere genuinely elsewhere.
//
// `geography_key` and `climate_key` are free TEXT with no enumeration
// anywhere in the package, so a caller supplies them or they stay null.
// Inventing a climate vocabulary here would be the mistake the weather
// table is still open for.
function generateRegion(worldState, options = {}) {
  const {
    name, civilizationId = null, geographyKey = null, climateKey = null,
  } = options;
  if (!name) {
    throw new Error('migration.generateRegion requires options.name (regions.name is NOT NULL)');
  }
  const region = {
    id: nextRegionId++,
    name,
    civilization_id: civilizationId,
    geography_key: geographyKey,
    climate_key: climateKey,
  };
  (worldState.regions || (worldState.regions = [])).push(region);
  return region;
}

function regionOfCity(worldState, cityId) {
  const city = (worldState.cities || []).find((c) => c.id === cityId);
  if (!city || city.region_id === undefined || city.region_id === null) return null;
  return (worldState.regions || []).find((r) => r.id === city.region_id) ?? null;
}

// ---------------------------------------------------------------------
// Why somebody would leave
// ---------------------------------------------------------------------

// How hard this person is being pushed out, 0..1, and what kind of move
// it would be. Null when they have no needs recorded — unknown is not
// contentment.
function pushFor(worldState, entityId) {
  const rows = motivation.needsOf(worldState, entityId);
  if (rows.length === 0) return null;

  let worst = null;
  for (const row of rows) {
    const push = PUSH_BY_NEED[row.need_type];
    if (!push) continue;
    const level = Number(row.current_level);
    if (!Number.isFinite(level) || level >= PUSH_FLOOR) continue;
    const pressure = ((PUSH_FLOOR - level) / PUSH_FLOOR) * push.weight;
    if (!worst || pressure > worst.pressure) {
      worst = { pressure: Math.max(0, Math.min(1, pressure)), type: push.type, need: row.need_type };
    }
  }
  return worst;
}

// How willing this person is to act on it, 0..1.
//
// **The only place traits enter**, and centred on 50 so an ordinary
// person is neither more nor less likely to move than the model's base
// rate — the twelfth standing rule. Adaptability makes a move
// thinkable; Group Loyalty makes leaving people behind harder.
function willingness(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) return 0;
  const trait = (family, name) => {
    const raw = Number(live.traits?.[family]?.[name] ?? 50);
    return Number.isFinite(raw) ? raw : 50;
  };
  const eagerness = (trait('mental', 'Adaptability') + trait('mental', 'Curiosity')) / 2;
  const roots = trait('social', 'Group Loyalty');
  return Math.max(0, Math.min(1, 1 + ((eagerness - roots) / 100)));
}

// ---------------------------------------------------------------------
// Where they would go
// ---------------------------------------------------------------------

//: How much work counts against safety in deciding where to go.
//: Equal, because the two push factors this engine can observe —
//: `forced` (housing, safety) and `economic` (income, food) — are about
//: equally common, and weighting one over the other would be choosing
//: which kind of hardship matters more with nothing to base it on.
const WORK_WEIGHT = 0.5;

// How good a community is to live in, 0..1. Higher is better.
//
// **Work is half of it, and leaving it out made the model
// incoherent.** The first version scored only danger — so somebody
// pushed out by unmet INCOME moved somewhere safer, arrived with no
// more work than before, and was pushed again. Measured: 37 moves in
// 300 ticks, every one of them `economic`, and the two destination
// communities gained people without gaining jobs. A pull that does not
// answer the push is a treadmill.
//
// Both halves come from what the engine already measures rather than a
// new score: crime per resident, and jobs per resident.
function desirability(worldState, communityId, shared) {
  const vacant = (shared.vacancies.get(communityId) ?? []).length;
  // Nowhere to live is not somewhere to move to, whatever else is true.
  if (vacant === 0) return null;

  const danger = shared.danger.get(communityId) ?? 0;
  const work = shared.work.get(communityId) ?? 0;
  return Math.max(0, Math.min(1,
    (1 - danger) * (1 - WORK_WEIGHT) + work * WORK_WEIGHT));
}

// Jobs per resident in each community, capped at 1. A community where
// everybody who lives there has work scores 1; one with none scores 0.
function workByCommunity(worldState) {
  const employed = new Set(
    (worldState.employmentRecords || [])
      .filter((r) => r.status === 'active')
      .map((r) => r.entity_id),
  );
  const totals = new Map();
  const working = new Map();
  for (const npc of worldState.npcs || []) {
    if (npc.communityId === undefined || npc.communityId === null) continue;
    totals.set(npc.communityId, (totals.get(npc.communityId) ?? 0) + 1);
    if (employed.has(npc.id)) working.set(npc.communityId, (working.get(npc.communityId) ?? 0) + 1);
  }

  const share = new Map();
  for (const [communityId, total] of totals) {
    // **An empty community is unknown, not jobless.** Absent from the
    // map rather than 0, so `desirability` reads `?? 0` only for a
    // community that really has people and no work.
    if (total === 0) continue;
    share.set(communityId, Math.max(0, Math.min(1, (working.get(communityId) ?? 0) / total)));
  }
  return share;
}

// Homes standing empty in each community, by id. A destination has to
// have one — moving somebody into an occupied dwelling would silently
// create a household nobody chose.
function vacanciesByCommunity(worldState) {
  const taken = new Set(
    (worldState.npcs || []).map((n) => n.home_property_id).filter((id) => id != null),
  );
  const vacant = new Map();
  for (const property of worldState.properties || []) {
    if (property.type !== 'residential') continue;
    if (taken.has(property.id)) continue;
    const list = vacant.get(property.community_id) ?? [];
    list.push(property.id);
    vacant.set(property.community_id, list);
  }
  // Sorted, so the same seed picks the same home — §88.
  for (const list of vacant.values()) list.sort((a, b) => a - b);
  return vacant;
}

// Where this person would go, or null if nowhere is enough better to be
// worth it.
//
// ---------------------------------------------------------------------
// It is a DRAW, not an argmax, and that is the whole of this function
// ---------------------------------------------------------------------
// The first version returned the highest-scoring acceptable community.
// Every term it reads — danger, vacancies, work — lives on `shared`,
// which `runMigration` builds once for the whole pass. So every person
// pushed on the same tick computed the same number and got the same
// answer: `willingness` and `MOVE_CHANCE` vary WHETHER somebody goes,
// and nothing at all varied WHERE.
//
// Measured on a 600-tick world (seed `playtest`):
//
//     total person-moves: 21, on exactly TWO ticks out of 600
//     tick 295: 11 moves, every one of them into c5
//     tick 453: 10 moves, every one of them c3 -> c2
//     c1 and c4: no arrival and no departure in 600 ticks
//
// That is not a migration system, it is two evacuations. A mechanism
// that fires on 0.33% of ticks and empties one neighbourhood wholesale
// into another is indistinguishable, to a player, from a scripted
// event — and `SETTLING_TICKS` then locks the whole cohort at once,
// which preserves the synchronisation rather than breaking it.
//
// That reads exactly like `drawOccupation`'s old mistake one file over
// — take the top instead of weighting and drawing — which this
// repository had already diagnosed and fixed once, and the general
// form is worth stating either way: a per-person decision computed
// from a per-world snapshot is not a per-person decision.
//
// So the acceptable destinations are weighted by how much better they
// are than here — `score - current`, which is already the quantity
// `PULL_MARGIN` is a threshold on, so no new number is introduced — and
// one is drawn. The best place is still the most likely place. It is
// just no longer the only one.
//
// ---------------------------------------------------------------------
// **And on a real world this changed NOTHING, which is recorded here
// rather than quietly left out.**
// ---------------------------------------------------------------------
// Re-measured on the same 600-tick world: byte-for-byte identical.
// Same two ticks, same eleven and ten moves, same destinations. A draw
// and an argmax agree when there is only one thing to choose between.
//
// That is the twentieth standing rule turned on the fix rather than on
// a guard — a change whose effect was argued instead of measured, and
// the measurement says zero. The draw is kept because the argmax is
// wrong in principle and the tests for it are real, but **it is not
// the fix for the herd and this comment must not be read as claiming
// it is.**
//
// If the acceptable set has one member whenever anybody decides, the
// herd belongs to the SCORE. `desirability` is two coarse terms, both
// read from a snapshot shared by every person alive, with no
// per-person component at all — while `pushFor` already knows which
// need is driving this particular person out and nothing consults it.
// See `dev-docs/PLAYTEST_19_SEP_2026.md` finding 5.
//
// `draw` is a unit value in [0,1). Without one the old ranking is
// returned unchanged, because a caller asking "where is best" is a
// different question from "where does this person go" and both are
// worth being able to ask.
function destinationFor(worldState, npc, shared, options = {}) {
  const { draw = null } = options;
  const here = desirability(worldState, npc.communityId, shared);
  // Somewhere with no vacancy of its own still has a "here" worth
  // comparing against — a person living in a full block can still
  // leave it.
  const current = here === null
    ? (1 - (shared.danger.get(npc.communityId) ?? 0)) * (1 - WORK_WEIGHT)
      + (shared.work.get(npc.communityId) ?? 0) * WORK_WEIGHT
    : here;

  const options_ = [];
  for (const community of worldState.communities || []) {
    if (community.id === npc.communityId) continue;
    const score = desirability(worldState, community.id, shared);
    if (score === null) continue;
    if (score < current + PULL_MARGIN) continue;
    options_.push({ community, score, edge: score - current });
  }
  if (options_.length === 0) return null;
  // Sorted by id so the weighting walks the same order every time —
  // §88 reaches derived choices too.
  options_.sort((a, b) => a.community.id - b.community.id);

  if (draw === null || !Number.isFinite(draw)) {
    return options_.reduce((best, o) => (!best || o.score > best.score ? o : best), null);
  }

  const total = options_.reduce((sum, o) => sum + o.edge, 0);
  // Every edge is at least PULL_MARGIN by the filter above, so the
  // total cannot be zero and this is not the degenerate case the
  // occupation draw has to guard for.
  let cut = Math.max(0, Math.min(1, draw)) * total;
  for (const o of options_) {
    cut -= o.edge;
    if (cut <= 0) return o;
  }
  return options_[options_.length - 1];
}

// ---------------------------------------------------------------------
// The move
// ---------------------------------------------------------------------

function record(worldState, options = {}) {
  const {
    entityId, fromLocationId = null, toLocationId = null,
    migrationType, reason = null, tick = worldState.tick ?? 0,
  } = options;

  if (entityId === undefined || entityId === null) {
    throw new Error('migration.record requires an entityId (migration_events.entity_id is NOT NULL)');
  }
  if (!MIGRATION_TYPES.includes(migrationType)) {
    throw new Error(
      `migration.record: "${migrationType}" is not a type (one of: ${MIGRATION_TYPES.join(', ')})`,
    );
  }
  if (TYPES_NOT_MODELLED[migrationType]) {
    // Refused rather than allowed, because a `seasonal` row in the log
    // would be a kind of movement this engine cannot have produced and
    // a later reader would have no way to tell.
    throw new Error(
      `migration.record: "${migrationType}" is not modelled — ${TYPES_NOT_MODELLED[migrationType]}`,
    );
  }

  const row = {
    id: nextMigrationId++,
    entity_id: entityId,
    from_location_id: fromLocationId,
    to_location_id: toLocationId,
    migration_type: migrationType,
    reason,
    tick,
  };
  (worldState.migrationEvents || (worldState.migrationEvents = [])).push(row);
  return row;
}

// Actually move somebody, and record it. Returns the row.
//
// Everything downstream follows from the two fields this writes:
// `households.syncHouseholds` rebuilds the household on both ends,
// `areaStats` counts them in the new block, and `motivation`'s housing
// and safety needs read the new home.
function relocate(worldState, options = {}) {
  const {
    entityId, toCommunityId, toPropertyId, migrationType, reason = null,
    tick = worldState.tick ?? 0,
  } = options;

  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) throw new Error(`migration.relocate: no living entity ${entityId}`);

  const from = npc.communityId ?? null;
  areaStats.placeInCommunity(worldState, {
    entityId,
    communityId: toCommunityId,
    homePropertyId: toPropertyId ?? null,
  });

  return record(worldState, {
    entityId,
    fromLocationId: from,
    toLocationId: toCommunityId,
    migrationType,
    reason,
    tick,
  });
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

// One tick of people leaving. Returns events for the tick pipeline.
//
// Seeded on position and tick rather than on identity, per §88 — the id
// of a person born mid-run depends on what was built before them.
function runMigration(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, seed = worldState.seed ?? 'migration' } = options;
  const events = [];

  const shared = {
    danger: crime.dangerByCommunity(worldState),
    vacancies: vacanciesByCommunity(worldState),
    work: workByCommunity(worldState),
  };

  // When each person last moved, built once for the pass.
  const lastMove = new Map();
  for (const row of worldState.migrationEvents || []) {
    const previous = lastMove.get(row.entity_id);
    if (previous === undefined || row.tick > previous) lastMove.set(row.entity_id, row.tick);
  }

  (worldState.npcs || []).forEach((npc, index) => {
    const push = pushFor(worldState, npc.id);
    if (!push || push.pressure <= 0) return;

    // Still settling in from the last move — see SETTLING_TICKS.
    const previous = lastMove.get(npc.id);
    if (previous !== undefined && tick - previous < SETTLING_TICKS) return;

    // A separate draw from the one that decides whether they go, so
    // turning the move chance up does not also change where people
    // end up — the seventeenth standing rule's lesson, where a floor
    // and a rate were conflated and produced a warzone.
    const destination = destinationFor(worldState, npc, shared, {
      draw: seededUnit(seed, 'destination', tick, index),
    });
    if (!destination) return;

    const homes = shared.vacancies.get(destination.community.id) ?? [];
    if (homes.length === 0) return;

    const chance = MOVE_CHANCE * push.pressure * willingness(worldState, npc.id);
    if (seededUnit(seed, 'migrate', tick, index) >= chance) return;

    const home = homes.shift();
    const row = relocate(worldState, {
      entityId: npc.id,
      toCommunityId: destination.community.id,
      toPropertyId: home,
      migrationType: push.type,
      reason: `unmet ${push.need}`,
      tick,
    });

    events.push({
      type: 'migration',
      severity: push.type === 'forced' ? 'moderate' : 'low',
      note: `left for community ${destination.community.id} — unmet ${push.need}`,
      tick,
      affected_entity_ids: [npc.id],
      global_effects: {
        migrationId: row.id,
        from: row.from_location_id,
        to: row.to_location_id,
        migrationType: row.migration_type,
      },
    });
  });

  return events;
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

function movesIn(worldState, communityId, options = {}) {
  const { sinceTick = null } = options;
  return (worldState.migrationEvents || []).filter(
    (m) => (m.to_location_id === communityId || m.from_location_id === communityId)
      && (sinceTick === null || m.tick >= sinceTick),
  );
}

//: The window a migration RATE is measured over. A cumulative count is
//: not a rate — the same reasoning `crime.DANGER_WINDOW_TICKS` records.
const RATE_WINDOW_TICKS = 365;

// Net moves per 1,000 residents over the last year, or null when the
// area has nobody in it. Positive means people are arriving.
function netRatePer1k(worldState, communityId, options = {}) {
  const { tick = worldState.tick ?? 0, window = RATE_WINDOW_TICKS } = options;
  const population = areaStats.residentsOf(worldState, communityId).length;
  if (population === 0) return null;

  const recent = movesIn(worldState, communityId, { sinceTick: tick - window });
  const arrived = recent.filter((m) => m.to_location_id === communityId).length;
  const left = recent.filter((m) => m.from_location_id === communityId).length;
  return Math.round(((arrived - left) / population) * 1000 * 100) / 100;
}

module.exports = {
  MIGRATION_TYPES,
  TYPES_NOT_MODELLED,
  TYPES_MODELLED,
  PUSH_BY_NEED,
  PUSH_FLOOR,
  PULL_MARGIN,
  MOVE_CHANCE,
  SETTLING_TICKS,
  RATE_WINDOW_TICKS,
  reseedIds,
  generateRegion,
  regionOfCity,
  pushFor,
  willingness,
  WORK_WEIGHT,
  desirability,
  workByCommunity,
  vacanciesByCommunity,
  destinationFor,
  record,
  relocate,
  runMigration,
  movesIn,
  netRatePer1k,
};
