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
const economy = require('./economy.js');
const entityTraits = require('./entityTraits.js');
const worldStore = require('./worldStore.js');

// A tick is a day — `behavior.js` chooses that and says so, and
// `worldState.tickIntervals` overrides it wholesale. This is the same
// choice expressed as a year, so the two cannot disagree silently.
const TICKS_PER_YEAR = 365;

// **There is no minimum age of death, and removing it was a
// correction.** The first version of this file had a
// `MIN_NATURAL_DEATH_AGE` of 40 below which risk was exactly zero, so
// no child could die of anything except violence. That is a rule about
// people, and in a collapse setting the truth is a rule about
// circumstances: a famine kills the young first, an epidemic does not
// check anybody's age, and a settlement with no clean water loses
// infants before it loses elders.
//
// So risk is continuous from birth and every term below is either the
// person's own condition or their environment. The only hard bound
// left is the far end.
const MAX_AGE = 110;

//: Flagged interpretive: the always-present annual risk at any age in a
//: safe, fed, disease-free environment — accident and misadventure.
//: 0.0008 is roughly one in twelve hundred a year, which is small
//: enough that a healthy protected population is stable and large
//: enough that "nobody ever dies for no reason" is not a promise the
//: engine makes.
const BASE_ANNUAL_RISK = 0.0008;

//: How sharply age alone tells. `(age / MAX_AGE) ** 6` is chosen so
//: that the curve is recognisably human without pretending to be an
//: actuarial table: negligible in childhood (1 in 30,000 at 20),
//: noticeable in middle age (1 in 450 at 40), serious in old age (1 in
//: 15 at 70, 1 in 3 at 90) and certain at 110.
const AGE_EXPONENT = 6;

//: How hard a scarce environment kills, per unit of survival pressure.
//: At 0.25 a settlement in total famine (pressure 1.0) carries a 25%
//: annual death risk on top of everything else — severe, survivable
//: for a while, and fatal if it does not end.
const SCARCITY_WEIGHT = 0.25;

//: Which resources are a matter of life and death. Scarcity in
//: anything else is an economic problem; scarcity in these is a
//: mortality one. Named rather than "every resource" because a world
//: short of iron is not a world that is dying.
const SURVIVAL_RESOURCES = ['food', 'water', 'medicine'];

// The recorded causes. `violence` and `disease` are the two the player
// will actually see; `age` is the background rate.
const DEATH_CAUSES = ['age', 'disease', 'deprivation', 'violence'];

// Which of the three passive terms was the biggest contributor. Not a
// draw: the cause should be an explanation of the death, and a
// randomly attributed one makes the world's own history unreliable.
function causeFor({ age, pressure = 1, scarcity = 0 }) {
  const ageRisk = age === null || age === undefined ? 0 : (age / MAX_AGE) ** AGE_EXPONENT;
  const environmentRisk = Math.max(0, Math.min(1, scarcity)) * SCARCITY_WEIGHT;
  // Disease is expressed as a multiplier rather than a term, so its
  // contribution is how much it added to everything else.
  const diseaseRisk = (pressure - 1) * (BASE_ANNUAL_RISK + ageRisk + environmentRisk);

  if (diseaseRisk >= environmentRisk && diseaseRisk >= ageRisk && pressure > 1) return 'disease';
  if (environmentRisk > ageRisk) return 'deprivation';
  return 'age';
}

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

// How short of the essentials a world is, as 0..1. Zero when food,
// water and medicine are all at or better than balance; 1 when they
// are all as scarce as `getScarcity` can report.
//
// **The worst of the three, not the average.** A settlement with
// plenty of food and no water at all is dying, and averaging would
// report it as coping. Scarcity in one essential is not offset by
// abundance in another.
function survivalScarcity(worldState) {
  let worst = 0;
  for (const resource of worldState.resources || []) {
    if (!SURVIVAL_RESOURCES.includes(resource.resource_type)) continue;
    // `getScarcity` is 0..100 with 50 as demand meeting supply, so
    // only the half above balance is a shortage.
    const scarcity = economy.getScarcity(resource);
    const shortage = Math.max(0, (scarcity - 50) / 50);
    if (shortage > worst) worst = shortage;
  }
  return Math.min(1, worst);
}

// Annual probability of death, before the seeded draw.
//
// **Continuous from birth, with no minimum age.** Three additive
// terms, then two multipliers:
//
//   base         accident and misadventure, at any age
//   + age        `(age / MAX_AGE) ** 6`, negligible young, certain at 110
//   + scarcity   the environment: no food, no water, no medicine
//   × disease    an epidemic makes everything more lethal
//   × vitality   the person's own health traits
//
// Every term except the age one is about circumstances rather than
// years, which is what makes a famine kill children and an epidemic
// ignore birthdays.
function annualDeathRisk(worldState, entityId, options = {}) {
  const { age, pressure = 1, scarcity = 0 } = options;
  // Unknown age is unknown risk, not zero risk — but an entity with no
  // recorded creation still faces its environment, so the age term is
  // the only one dropped.
  const years = age === null || age === undefined ? null : age;
  if (years !== null && years >= MAX_AGE) return 1;

  const ageRisk = years === null ? 0 : (years / MAX_AGE) ** AGE_EXPONENT;
  const environmentRisk = Math.max(0, Math.min(1, scarcity)) * SCARCITY_WEIGHT;
  const vitality = vitalityOf(worldState, entityId);

  const risk = (BASE_ANNUAL_RISK + ageRisk + environmentRisk) * pressure * vitality;
  return Math.max(0, Math.min(1, risk));
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
  const scarcity = survivalScarcity(worldState);
  const events = [];
  const deaths = [];

  // Iterated over a copy, because `recordDeath` splices the live array.
  // Mutating a collection while walking it skips the element after
  // every removal — half the population would be spared at random.
  for (const npc of [...worldState.npcs]) {
    const age = ageInYears(worldState, npc, tick);
    const annual = annualDeathRisk(worldState, npc.id, { age, pressure, scarcity });
    if (annual <= 0) continue;

    // A tick is a day, so the daily hazard is the annual one spread
    // across the year. Compounding it properly rather than dividing
    // would be more correct and less legible; at these magnitudes the
    // difference is under a percent of a percent, and the constant is
    // flagged interpretive anyway.
    const daily = annual / TICKS_PER_YEAR;
    if (seededDraw([npc.id, tick, 'mortality']) >= daily) continue;

    // **What killed them, attributed to the largest term.** A death in
    // a famine recorded as "age" would make a starving settlement look
    // like an ageing one, and the historical record is what §41 and
    // §51 read. Disease wins ties because an epidemic is the more
    // specific explanation when both are present.
    const cause = causeFor({ age, pressure, scarcity });
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
  MAX_AGE,
  BASE_ANNUAL_RISK,
  AGE_EXPONENT,
  SCARCITY_WEIGHT,
  SURVIVAL_RESOURCES,
  DEATH_CAUSES,
  causeFor,
  survivalScarcity,
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
