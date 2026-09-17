// server/health.js
//
// What a body is doing, as distinct from what a person is capable of.
//
// **The gap.** The `health` family — Immune Response, Nutrition Status,
// Chronic Conditions, Sleep Quality — has been generated on every NPC
// since traits existed, and exactly one thing read it:
// `mortality.vitalityOf`, which folds all four into a single multiplier
// on the chance of dying. So a population's health existed only as a
// number nobody could see, and a settlement could not answer the
// plainest questions anybody asks about one: how well fed are these
// people, how many are carrying something chronic, do they sleep.
//
// The `sports` family was the same story with one reader
// (`server/contest.js`) that the tick pipeline never called, so its
// reading here was of a capability rather than of anything anybody had
// ever done with it. `server/competition.js` closed that: settlements
// hold games, and competing grows Speed and Coordination. What has not
// changed is the SIZE of it — see `meanAthleticism` below.
//
// ---------------------------------------------------------------------
// Obesity, and why it is a DECLARED ABSENCE rather than a statistic
//
// Body composition is the question that prompted this file, and the
// honest answer is that this engine cannot yet measure it. It was
// built, measured, and taken back out, and the measurements are written
// down here so that nobody rebuilds it on the same substrate.
//
// There is no weight, no height and no body composition anywhere in the
// schema. Inventing three columns to answer one statistic is out on
// standing rule 3, so the first version derived an index from the two
// sides of the balance the engine does have — `motivation`'s `food`
// need as intake, and a `work` routine plus `sports` traits as
// exertion. It ran. It produced bands. Three measurements killed it:
//
//   * **Intake had no spread between people.** The food need converges
//     on the city's food availability, and `availabilityOf` was keyed on
//     resource type alone, so one city's food row decided how well fed
//     every person in the world was. 127 people, two cities, one of them
//     in famine: all 127 read the same level to the decimal. Fixed in
//     `motivation.js` — the map is keyed by city now — and the need's
//     two halves multiply instead of taking the lower, because the `eat`
//     habit was being clamped away in every world where supply was the
//     binding side. Intake has a real spread now, 27..43.
//   * **Exertion is mostly an employment flag.** 50 of 127 people hold a
//     `work` routine; the rest are children, the unemployed and the
//     retired. So the exertion half splits the population in two at the
//     same line employment does, and any index built on it says "not
//     employed" in medical language. §9 permits demographic modelling
//     and forbids demographics deciding what a person is worth; a body
//     reading that is really a jobs reading is on the wrong side of that
//     line even before anybody uses it for anything.
//   * **The upper band was unreachable.** Intake is a product of two
//     sub-unit quantities and settles near 0.36; exertion subtracts.
//     Across every world measured, the `obese` band held nobody and the
//     `overweight` band held people whose only distinguishing feature
//     was having no job. A statistic that can only ever report zero is
//     worse than a declared gap, because a gap is visible.
//
// So `statistics.js` carries `body_composition` as unavailable, naming
// what it would take: a per-person consumption record. `inventory.js`
// can hold food and nothing consumes it; the moment somebody eats from
// a holding rather than from a city average, intake becomes a fact
// about a person and this becomes answerable.
//
// What survives is `exertionOf`, under its own name. How much physical
// work a population's life contains is a real reading of real
// substrate, and it is only misleading when it is called something
// else.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');

//: The level of `health.Chronic Conditions` above which somebody is
//: counted as carrying one. The trait is 0..100 like every other, and
//: 70 is the same threshold `archetypes.js` uses for "high" — reused
//: rather than chosen again, so the two cannot disagree about what a
//: high trait means.
//:
//: Measured against a real population before being kept: 20.8% of 144
//: people clear it, which is a minority carrying something rather than
//: either a curiosity or a plague. The twelfth standing rule's third
//: clause is why that sentence exists — a threshold picked from what a
//: number sounds like is a guess.
const CHRONIC_THRESHOLD = 70;

//: The `health` trait names this module reads. Listed rather than
//: spelled at each call site so a rename in `traits.js` fails loudly in
//: one place instead of quietly returning null in four.
const HEALTH_TRAITS = ['Immune Response', 'Nutrition Status', 'Chronic Conditions', 'Sleep Quality'];

// -- one person -----------------------------------------------------------

// Index the habits once for a whole population rather than filtering
// per person — `traitDrift.indexRows` learned that the expensive way.
function indexHabits(worldState) {
  const index = new Map();
  for (const habit of worldState.habits || []) {
    const list = index.get(habit.entity_id);
    if (list) list.push(habit);
    else index.set(habit.entity_id, [habit]);
  }
  return index;
}

// How much physical exertion this person's life actually contains,
// 0..1.
//
// Two halves, both real: whether they keep a `work` routine at all, and
// what their `sports` traits say about how much they can move. Read for
// what it is — a measure of physical activity — and not as an input to
// a body reading, for the reason the header gives at length.
function exertionOf(worldState, entityId, habitsByEntity = null) {
  const habits = habitsByEntity
    ? (habitsByEntity.get(entityId) ?? [])
    : (worldState.habits || []).filter((h) => h.entity_id === entityId);

  const work = habits.find((h) => h.habit_name === 'work');
  const fromWork = work ? Math.max(0, Math.min(1, Number(work.strength) / 100)) : 0;

  const live = getLiveEntity(worldState, entityId);
  const sports = live?.traits?.sports;
  // **0.5, not 0, when there are no traits to read.** A person with no
  // `entity_traits` rows is unmeasured, and treating them as incapable
  // would drag a whole population's reading down by however many people
  // nobody has generated traits for.
  let fromBody = 0.5;
  if (sports) {
    const scores = Object.values(sports).map(Number).filter(Number.isFinite);
    if (scores.length > 0) fromBody = scores.reduce((a, b) => a + b, 0) / scores.length / 100;
  }

  return Math.max(0, Math.min(1, (fromWork + fromBody) / 2));
}

// -- population readings --------------------------------------------------

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// Every live value of one `health` trait across a population.
function healthValues(worldState, residents, name) {
  if (!HEALTH_TRAITS.includes(name)) {
    throw new Error(
      `health: "${name}" is not a health trait (one of: ${HEALTH_TRAITS.join(', ')})`,
    );
  }
  const values = [];
  for (const npc of residents) {
    const live = getLiveEntity(worldState, npc.id);
    const raw = Number(live?.traits?.health?.[name]);
    if (Number.isFinite(raw)) values.push(raw);
  }
  return values;
}

// Mean of one `health` trait across a population, 0..100, or null when
// nobody in it has traits. **Null rather than 50**: a population nobody
// has generated traits for is unmeasured, not average.
function meanHealthTrait(worldState, residents, name) {
  const values = healthValues(worldState, residents, name);
  if (values.length === 0) return null;
  return roundTo(values.reduce((a, b) => a + b, 0) / values.length, 2);
}

// Share carrying a chronic condition, or null.
function chronicConditionShare(worldState, residents) {
  const values = healthValues(worldState, residents, 'Chronic Conditions');
  if (values.length === 0) return null;
  const carrying = values.filter((v) => v >= CHRONIC_THRESHOLD).length;
  return roundTo(carrying / values.length, 4);
}

// Mean athleticism across a population, 0..100, or null.
//
// The `sports` family, which `contest.js` rates a bout from. Games are
// held now — `server/competition.js` runs in the cross-cutting slot —
// so this is no longer a reading of a capability that nothing ever
// exercises.
//
// **But it is still mostly a reading of what people were born with, and
// that is worth stating rather than implying otherwise.** The same world
// run twice off one seed, differing only in whether games happen, moved
// this from 48.92 to 49.10 over 600 ticks. Real, reproducible, and a
// fraction of a point a year. `competition.contestRatePer1k` and
// `competitorShare` are the readings of what a settlement DOES; this is
// the reading of what it can do.
function meanAthleticism(worldState, residents) {
  const values = [];
  for (const npc of residents) {
    const live = getLiveEntity(worldState, npc.id);
    const sports = live?.traits?.sports;
    if (!sports) continue;
    const scores = Object.values(sports).map(Number).filter(Number.isFinite);
    if (scores.length > 0) values.push(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  if (values.length === 0) return null;
  return roundTo(values.reduce((a, b) => a + b, 0) / values.length, 2);
}

// Mean physical exertion across a population, 0..100.
//
// Null when nobody in the population has either a habit or a trait
// sheet, because `exertionOf` falls back to a neutral body reading and
// a population of pure fallbacks is not a measurement.
function meanExertion(worldState, residents) {
  const habits = indexHabits(worldState);
  const measured = residents.filter(
    (npc) => habits.has(npc.id) || getLiveEntity(worldState, npc.id)?.traits?.sports,
  );
  if (measured.length === 0) return null;
  const total = measured.reduce((a, npc) => a + exertionOf(worldState, npc.id, habits), 0);
  return roundTo((total / measured.length) * 100, 2);
}

// Share of a population keeping a harmful habit, or null when nobody
// has habits recorded.
//
// `habits.harmful` is the schema's own flag — "addiction = harmful
// habit, not a separate table" — and `behavior.js` forms one from
// sustained stress. This is the honest reading of substance use in this
// engine, and it is worth knowing that it runs LOW: measured at 4.9% of
// a settled population, because stress peaks around 55 against a
// threshold of 60 and a calm world produces almost none. That is a fact
// about the stress model rather than about this statistic, and it is
// the reason the statistic carries a caveat in the catalogue.
function harmfulHabitShare(worldState, residents) {
  const all = worldState.habits || [];
  const withHarmful = new Set(all.filter((h) => h.harmful).map((h) => h.entity_id));
  const known = new Set(all.map((h) => h.entity_id));
  const measured = residents.filter((npc) => known.has(npc.id));
  if (measured.length === 0) return null;
  return roundTo(measured.filter((npc) => withHarmful.has(npc.id)).length / measured.length, 4);
}

// How much of a population this file can speak for at all — the same
// job `observed_share` does for `mean_stress`. A health figure drawn
// from 3 of 400 residents is not wrong, it is thin, and the difference
// is invisible unless something reports it.
function measuredShare(worldState, residents) {
  if (residents.length === 0) return null;
  const measured = residents.filter(
    (npc) => getLiveEntity(worldState, npc.id)?.traits?.health,
  ).length;
  return roundTo(measured / residents.length, 4);
}

// Everything this module knows about one person.
function describeHealth(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const health = live?.traits?.health;
  if (!health) return null;
  return {
    entityId,
    immuneResponse: health['Immune Response'] ?? null,
    nutritionStatus: health['Nutrition Status'] ?? null,
    chronicConditions: health['Chronic Conditions'] ?? null,
    sleepQuality: health['Sleep Quality'] ?? null,
    carryingChronicCondition: Number(health['Chronic Conditions']) >= CHRONIC_THRESHOLD,
    exertion: roundTo(exertionOf(worldState, entityId), 3),
  };
}

module.exports = {
  CHRONIC_THRESHOLD,
  HEALTH_TRAITS,
  indexHabits,
  exertionOf,
  healthValues,
  meanHealthTrait,
  chronicConditionShare,
  meanAthleticism,
  meanExertion,
  harmfulHabitShare,
  measuredShare,
  describeHealth,
};
