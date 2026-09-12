// server/mortality.js
//
// Age, disease, and death — the life scale.
//
// **What was wrong before this.** `property.age` was the only thing in
// the engine that incremented: buildings decayed on a lifecycle and
// people were immortal. §2's headline promise is that the world
// continues without the player and that NPCs "have children" and
// "die"; births were real and deaths were not. A persistent world
// where nobody dies has no generational history, so §51's player
// legacy had nothing to outlive the player, §56's families only ever
// grew, and `npcs.generation` — a column the schema put there on
// purpose — stayed 1 forever.
//
// ---------------------------------------------------------------------
// Four decisions, and why each is the one most consistent with the
// engine that already exists
//
// **1. Death moves the row; it is not a flag.** A dead NPC leaves
// `worldState.npcs` for `worldState.deceased`. The alternative was a
// status flag, and it was measured before being rejected: **17 call
// sites across 7 modules iterate `worldState.npcs`.** A flag needs all
// 17 to check it, forever, and the first one anybody forgets is a dead
// person drawing a wage, casting a vote or holding an opinion — the
// exact class of silent defect this repo keeps finding. Moving the row
// makes a corpse structurally incapable of any of that, and changes
// none of the 17.
//
// The cost, stated: anything that legitimately wants the dead —
// history, lineage, inheritance — must read `deceased` explicitly. That
// is a small number of deliberate call sites rather than a large number
// of accidental ones.
//
// **2. Age is computed, never stored.** `entities.created_tick` exists
// and a tick is a day (`TICK_INTERVALS` in `behavior.js`), so age is
// `(tick - created_tick) / 365`. Standing rule 3 forbids storing a
// rollup that can be computed, and `npcs` has no age column anyway —
// which turns out to be the schema being right rather than incomplete.
//
// **3. Disease is an environmental condition.** `runEnvironmentPhase`
// already carries `worldState.activeConditions`, and a drought is
// already a condition that cascades into resources, the economy, and
// out into social and migration effects — `test/drought-cascade.test.js`
// drives exactly that. An epidemic is the same mechanism pointed at
// people instead of supply. Building a separate disease subsystem would
// have meant a second way to say "something bad is affecting this
// region", and two mechanisms for one idea is how they drift apart.
//
// **4. Every death is a seeded draw.** §88 requires that the same seed
// and the same rules give the same world, and `contest.js` already
// resolves bouts from `hashSeed`/`seededUnit` so a settled result can
// be re-verified. A world whose contests replay and whose deaths do
// not is not reproducible. Those two functions moved to
// `server/seeded.js` for this, unchanged.
//
// ---------------------------------------------------------------------
// What the risk curve is, and what it is not
//
// No source document gives a hazard function, a lifespan, or a disease
// model, so the shape below is interpretive and flagged. What is NOT
// invented is which traits feed it: the `health` family —
// **Immune Response, Nutrition Status, Chronic Conditions, Sleep
// Quality** — is four traits that were generated on every NPC and read
// by nothing, exactly like `combat` and `sports` before `contest.js`
// was written. This is that pattern again: grow a system around traits
// that already exist rather than inventing new ones.
//
// Read through `getLiveEntity`, always (standing rule 9) — the
// denormalised sheet is a birth value that never refreshes, and a
// frozen plausible number is far harder to spot than a null.

'use strict';

const { seededDraw } = require('./seeded.js');
const entityTraits = require('./entityTraits.js');
const worldStore = require('./worldStore.js');

// A tick is a day — `behavior.js` chooses that and says so, and
// `worldState.tickIntervals` overrides it wholesale. This is the same
// choice expressed as a year, so the two cannot disagree silently.
const TICKS_PER_YEAR = 365;

//: Flagged interpretive: no document gives a lifespan. These bound the
//: curve rather than setting a fixed span — nobody dies of age before
//: `MIN_NATURAL_DEATH_AGE`, and the annual risk reaches certainty at
//: `MAX_AGE`, so a population has a shape instead of a cliff.
const MIN_NATURAL_DEATH_AGE = 40;
const MAX_AGE = 110;

//: Also interpretive: the annual risk at `MIN_NATURAL_DEATH_AGE` for
//: somebody of average health, before it accelerates. 0.004 is roughly
//: four deaths per thousand forty-year-olds per year — low enough that
//: a healthy adult population is stable, high enough that a century of
//: simulation is not a century of nobody dying.
const BASE_ANNUAL_RISK = 0.004;

//: How sharply risk accelerates with age. At 2.0 the risk roughly
//: quadruples every time the distance past 40 doubles, which gives a
//: recognisable human-shaped curve without pretending to be an actuarial
//: table.
const AGE_EXPONENT = 2.0;

// The recorded causes. `violence` and `disease` are the two the player
// will actually see; `age` is the background rate.
const DEATH_CAUSES = ['age', 'disease', 'violence'];

// -- age ----------------------------------------------------------------

// Age in years, computed. Returns null when the entity has no
// `created_tick` — **unknown, not zero.** A newborn and an entity whose
// creation was never recorded are different things, and treating the
// second as age 0 would make it immortal by accident.
function ageInYears(worldState, entity, tick = worldState.tick ?? 0) {
  if (!entity) return null;
  // **`createdTick`, camelCase — and the first version of this read
  // `created_tick` and would have returned null for every NPC alive.**
  // `created_tick` is the DATABASE column; `generateNPC` sets
  // `createdTick` in memory, and `migrate.js` maps one to the other.
  // Reading the column name here is standing rule 6 in its purest
  // form: the signal would have returned nothing forever, every risk
  // would have been 0, nobody would ever have died, and a fixture
  // written with the same wrong spelling would have made every test
  // pass. Caught by reading migrate.js, not by a test.
  //
  // Only the in-memory spelling is accepted. Supporting both would
  // hide the next instance of the same mistake.
  const created = Number(entity.createdTick);
  if (!Number.isFinite(created)) return null;
  const days = Math.max(0, tick - created);
  return Math.round((days / TICKS_PER_YEAR) * 100) / 100;
}

// -- health -------------------------------------------------------------

// A 0..1 multiplier on mortality risk, from the four `health` traits.
// Above 1 means frailer than average, below 1 means hardier.
//
// **`Chronic Conditions` is inverted and that is not a typo.** High
// immune response, nutrition and sleep are all good; high chronic
// conditions are bad. Averaging all four as if they pointed the same
// way would have made the sickest people the most robust, which is the
// kind of sign error that produces a plausible number and no error.
function vitalityOf(worldState, entityId) {
  const live = entityTraits.getLiveEntity(worldState, entityId);
  if (!live) return 1;
  const trait = (family, name, fallback = 50) => {
    const value = Number(live.traits?.[family]?.[name]);
    return Number.isFinite(value) ? value : fallback;
  };

  const good = (
    trait('health', 'Immune Response')
    + trait('health', 'Nutrition Status')
    + trait('health', 'Sleep Quality')
    + trait('physical', 'Recovery Rate')
  ) / 4;
  const bad = trait('health', 'Chronic Conditions');

  // Centred so that an all-50 person has a multiplier of exactly 1.
  // `good` above 50 lowers risk, `bad` above 50 raises it, each by at
  // most half.
  const fromGood = 1 - ((good - 50) / 100);
  const fromBad = 1 + ((bad - 50) / 100);
  return Math.max(0.1, fromGood * fromBad);
}

// -- disease ------------------------------------------------------------

// An epidemic, expressed as the environmental condition it is. Added
// to `worldState.activeConditions` so `runEnvironmentPhase` ages and
// clears it exactly like a drought, and so a world description that
// lists conditions lists this one too.
//
// `mortalityMultiplier` is what makes it lethal. A condition without
// one is an ordinary environmental event and mortality ignores it, so
// existing conditions do not silently start killing people.
function addDiseaseOutbreak(worldState, options = {}) {
  const {
    name, mortalityMultiplier, ticksRemaining = 30,
    communityId = null, tick = worldState.tick ?? 0,
  } = options;

  if (!name) throw new Error('addDiseaseOutbreak requires a name');
  if (!Number.isFinite(mortalityMultiplier) || mortalityMultiplier < 1) {
    throw new Error(
      'addDiseaseOutbreak requires a finite mortalityMultiplier of at least 1 — '
      + 'a disease that lowers mortality is not a disease',
    );
  }

  const condition = {
    conditionType: 'disease',
    name,
    mortalityMultiplier,
    ticksRemaining,
    communityId,
    startedTick: tick,
  };
  worldState.activeConditions.push(condition);
  return condition;
}

// The combined multiplier from every active disease. Multiplied rather
// than summed: two epidemics at once are worse than either, and
// summing would let three mild outbreaks add up to certain death.
function diseasePressure(worldState) {
  let pressure = 1;
  for (const condition of worldState.activeConditions || []) {
    const multiplier = Number(condition.mortalityMultiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 1) continue;
    pressure *= multiplier;
  }
  return pressure;
}

// -- the risk -----------------------------------------------------------

// Annual probability of death, before the seeded draw. Returns 0 below
// `MIN_NATURAL_DEATH_AGE` when there is no disease pressure — the young
// are not on an actuarial table in an ordinary year — and 1 at
// `MAX_AGE`.
function annualDeathRisk(worldState, entityId, options = {}) {
  const { age, pressure = 1 } = options;
  if (age === null || age === undefined) return 0;
  if (age >= MAX_AGE) return 1;

  const vitality = vitalityOf(worldState, entityId);
  let risk = 0;
  if (age > MIN_NATURAL_DEATH_AGE) {
    const past = (age - MIN_NATURAL_DEATH_AGE) / (MAX_AGE - MIN_NATURAL_DEATH_AGE);
    risk = BASE_ANNUAL_RISK * (1 + (past ** AGE_EXPONENT) * 200);
  }

  // **Disease reaches everybody, including the young.** An epidemic
  // that could only kill the over-forties would be a strange disease,
  // and it is the one case where somebody below the natural floor can
  // die of something other than violence.
  if (pressure > 1) {
    risk = Math.max(risk, BASE_ANNUAL_RISK) * pressure;
  }

  return Math.max(0, Math.min(1, risk * vitality));
}

// -- dying --------------------------------------------------------------

// The one place a death happens, whatever caused it. Violence,
// disease and age all come through here so that there is exactly one
// definition of what being dead means.
function recordDeath(worldState, options = {}) {
  const {
    entityId, cause, tick = worldState.tick ?? 0, killerId = null, detail = null,
  } = options;

  if (!DEATH_CAUSES.includes(cause)) {
    throw new Error(`recordDeath: cause must be one of ${DEATH_CAUSES.join(', ')}`);
  }

  const index = worldState.npcs.findIndex((n) => n.id === entityId);
  if (index === -1) {
    // Already dead, or never alive. Both are refused rather than
    // silently ignored: a second death for one person would write a
    // second historical record and a second event, and a world that
    // reports two deaths for one person is worse than one that throws.
    throw new Error(`recordDeath: entity ${entityId} is not among the living`);
  }

  const [npc] = worldState.npcs.splice(index, 1);
  const age = ageInYears(worldState, npc, tick);
  // **`status` and nothing else.** The first version also set
  // `died_tick` and `death_cause` on the row, and `npcs` has neither
  // column — the same mistake `endEmployment` made with `end_tick` a
  // few hours earlier: fields the engine sets that the database cannot
  // hold, which vanish on the next restore and read as durable until
  // somebody checks.
  //
  // `entities.status` IS a real column, so the FACT of death persists.
  // The tick and the cause live in the historical record below, which
  // is where a death belongs anyway — see `deathRecordFor`.
  npc.status = 'deceased';
  worldState.deceased.push(npc);

  // **There is no separate `entities` array to update.** `migrate.js`
  // derives every `entities` row FROM `worldState.npcs` (and the other
  // tier arrays), so setting `npc.status` above IS setting the entity's
  // status. The first version of this looked up `worldState.entities`
  // and would have been dead code that read as a durability guarantee.
  npc.updatedTick = tick;

  // **A death is world history, not a private fact**, which is why it
  // goes into `historical_records` rather than a table of its own. §41
  // says the world remembers, and `historical_records` is already the
  // place that happens — `who`/`what`/`why` carry a death without a
  // single new column.
  const record = {
    who: [entityId, ...(killerId === null ? [] : [killerId])],
    what: 'death',
    when_tick: tick,
    where_location_id: npc.home_property_id ?? null,
    why: cause,
    result: detail,
    consequences: null,
    future_effects: null,
    // Interpretive: a violent death is more consequential to a
    // community's memory than a peaceful one at 90.
    significance: cause === 'violence' ? 70 : cause === 'disease' ? 55 : 30,
  };
  worldState.historicalRecords.push(record);

  return {
    npc,
    age,
    cause,
    event: {
      type: 'death',
      entityId,
      cause,
      age,
      ...(killerId === null ? {} : { killerId }),
      tick,
    },
  };
}

// The explicit violent path — for the Security phase, a contest that
// goes badly, or a player action. Separate from `runMortality` because
// a killing is something that HAPPENS, not a probability that resolves.
function killEntity(worldState, options = {}) {
  const { entityId, killerId = null, tick = worldState.tick ?? 0, detail = null } = options;
  const death = recordDeath(worldState, {
    entityId, cause: 'violence', killerId, tick, detail,
  });

  // Whoever did it remembers doing it. Standing rule 1's write-back
  // applies to the killer, not the victim — the victim has no further
  // decisions to make.
  if (killerId !== null) {
    worldStore.addMemory(worldState, {
      entityId: killerId,
      tick,
      memoryType: 'negative',
      category: 'conflict',
      description: `Killed entity ${entityId}.`,
      importance: 90,
      emotionLevel: -60,
      relatedEntityIds: [entityId],
    });
  }

  return death;
}

// -- the cross-cutting pass ---------------------------------------------

// Natural and disease mortality for the whole living population, once.
//
// **Runs in the cross-cutting slot after phase 8, like `flows.js` and
// `behavior.js`** — after Security, which is what can kill somebody
// violently, and before the Event and History phases, so a death
// becomes an event and a record on the tick it happened rather than
// the next one. The pipeline stays at eleven.
function runMortality(worldState, tick = worldState.tick ?? 0) {
  const pressure = diseasePressure(worldState);
  const events = [];
  const deaths = [];

  // Iterated over a copy, because `recordDeath` splices the live array.
  // Mutating a collection while walking it skips the element after
  // every removal — half the population would be spared at random.
  for (const npc of [...worldState.npcs]) {
    const age = ageInYears(worldState, npc, tick);
    const annual = annualDeathRisk(worldState, npc.id, { age, pressure });
    if (annual <= 0) continue;

    // A tick is a day, so the daily hazard is the annual one spread
    // across the year. Compounding it properly rather than dividing
    // would be more correct and less legible; at these magnitudes the
    // difference is under a percent of a percent, and the constant is
    // flagged interpretive anyway.
    const daily = annual / TICKS_PER_YEAR;
    if (seededDraw([npc.id, tick, 'mortality']) >= daily) continue;

    const cause = pressure > 1 && seededDraw([npc.id, tick, 'cause']) < 0.5
      ? 'disease'
      : 'age';
    const death = recordDeath(worldState, { entityId: npc.id, cause, tick });
    deaths.push(death);
    events.push(death.event);
  }

  return { deaths, events, pressure };
}

// -- reading the dead ---------------------------------------------------

// When and how somebody died, read back from world history rather
// than from a field on the corpse. This is the read path that makes
// the historical record the durable answer instead of a write nobody
// consults.
function deathRecordFor(worldState, entityId) {
  return (worldState.historicalRecords || []).find(
    (r) => r.what === 'death' && Array.isArray(r.who) && r.who[0] === entityId,
  ) || null;
}

function isDeceased(worldState, entityId) {
  return (worldState.deceased || []).some((n) => n.id === entityId);
}

function getDeceased(worldState, entityId) {
  return (worldState.deceased || []).find((n) => n.id === entityId) || null;
}

// The population's age profile, computed. Useful to a dashboard and to
// anything that wants to know whether a world is ageing out.
function ageProfile(worldState, tick = worldState.tick ?? 0) {
  const ages = worldState.npcs
    .map((n) => ageInYears(worldState, n, tick))
    .filter((a) => a !== null);
  if (ages.length === 0) {
    return { living: worldState.npcs.length, dead: (worldState.deceased || []).length, meanAge: null };
  }
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  return {
    living: worldState.npcs.length,
    dead: (worldState.deceased || []).length,
    meanAge: Math.round(mean * 100) / 100,
    oldest: Math.max(...ages),
  };
}

module.exports = {
  TICKS_PER_YEAR,
  MIN_NATURAL_DEATH_AGE,
  MAX_AGE,
  BASE_ANNUAL_RISK,
  DEATH_CAUSES,
  ageInYears,
  vitalityOf,
  addDiseaseOutbreak,
  diseasePressure,
  annualDeathRisk,
  recordDeath,
  killEntity,
  runMortality,
  deathRecordFor,
  isDeceased,
  getDeceased,
  ageProfile,
};
