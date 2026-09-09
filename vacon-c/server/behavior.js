// server/behavior.js
//
// The Behavior Engine — observable life, as distinct from decisions.
//
// ---------------------------------------------------------------------
// **The gap this closes.**
//
// The architecture document's §4.5 (and Part 15F, which reviewed it)
// draws one distinction and then names exactly three tables that come
// out of it. The distinction is *decisions vs. observable life*: Keys
// decide, and behavior is what a person is actually seen doing. Part
// 15F's own summary is blunt about which parts were already built under
// other names — "Motivation Engine = Value System DNA restated (don't
// duplicate). Communication Style/Lifestyle = Trait Archetypes restated
// (don't duplicate)" — and about which were not:
//
//   > Genuinely new: `schedule_events`, `entity_state`, `habits` tables.
//
// All three have been in `VACANCY_POSTGRESQL_SCHEMA.sql` since the
// schema was written. All three had **zero lines of code** anywhere in
// `server/` until now — checked by grep, not by memory. A person in
// this world had traits, relationships, memories, money, property and a
// job, and no routine, no mood, and no habits.
//
// ---------------------------------------------------------------------
// **Not a twelfth phase.**
//
// The tick pipeline is locked at eleven and this does not change that.
// Behavior is a cross-cutting layer, like `flows.js`, and it runs in
// the same slot: after the eight producing phases, before the Event
// phase, so what it observes is a finished tick and what it notices
// joins the other candidate events.
//
// Position matters in one direction specifically. Stress accumulates
// from what the world just did, and then modulates the NEXT tick's
// decisions — never the same tick's. That is deliberate: a stress
// level that fed the Decision phase it was computed from would be a
// loop with no defined order, and the answer would depend on which
// line ran first.
//
// ---------------------------------------------------------------------
// **Two decisions this file makes that no document made.**
//
// 1. **A tick is a day.** `schedule_events.frequency` is
//    `daily|weekly|monthly|yearly` and *nothing in the entire package
//    says how many ticks a day is* — grepped for it, it is not there.
//    So `TICK_INTERVALS` below chooses 1/7/30/365 and says so out
//    loud, and `worldState.tickIntervals` overrides it wholesale, the
//    same way `worldState.flowTemplates` overrides the built-in flows.
//    When somebody decides a tick is an hour or a year, one constant
//    moves and nothing else does.
//
// 2. **Stress is stored; mood is not.** Standing rule 3 forbids storing
//    a computable rollup, and mood is exactly that — a band label over
//    stress, shifted by Optimism. Stress itself is genuinely stateful:
//    it accumulates and decays, so its value depends on the path taken
//    and cannot be recomputed from a snapshot. This is the same split
//    already made in `property.js`, where `value` is the stored
//    assessment and `currentValue()` is derived and never written back.
//    `entity_state.current_mood` therefore stays NULL in Postgres, on
//    purpose, and `test/migrate.test.js` asserts it.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');

// ---------------------------------------------------------------------------
// How long a recurrence is, in ticks
// ---------------------------------------------------------------------------
// See decision (1) in the header: chosen here, not specified anywhere.
const TICK_INTERVALS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

const FREQUENCIES = Object.keys(TICK_INTERVALS);

function intervals(worldState) {
  return worldState.tickIntervals ?? TICK_INTERVALS;
}

// ---------------------------------------------------------------------------
// Stress
// ---------------------------------------------------------------------------
// Bounds are 0-100 like every other scored value in this engine.
const STRESS_MIN = 0;
const STRESS_MAX = 100;

// A missing trait must not read as a zero — an entity with no Resilience
// row is not maximally fragile, it is unmeasured — so every lookup goes
// through this and callers supply the neutral value explicitly.
function traitOr(live, family, name, fallback) {
  const value = Number(live?.traits?.[family]?.[name]);
  return Number.isFinite(value) ? value : fallback;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round1 = (n) => Math.round(n * 10) / 10;

// Per-tick decay toward calm, before any new load is applied. Resilience
// and Sleep Quality both speed recovery; the base rate means even an
// entity with neither eventually comes down, because a stress level
// that only ever rises is a counter, not a state.
const BASE_RECOVERY = 2;

function recoveryRate(live) {
  const resilience = traitOr(live, 'emotional', 'Resilience', 50);
  const sleep = traitOr(live, 'health', 'Sleep Quality', 50);
  return BASE_RECOVERY + (resilience / 100) * 4 + (sleep / 100) * 2;
}

// Volatility amplifies incoming load, Resilience damps it. A load of 10
// on a calm, resilient person is a smaller event than the same 10 on a
// volatile one, which is the entire point of having traits at all.
function loadMultiplier(live) {
  const volatility = traitOr(live, 'emotional', 'Volatility', 50);
  const resilience = traitOr(live, 'emotional', 'Resilience', 50);
  return clamp(1 + (volatility - resilience) / 100, 0.25, 2);
}

// The bands. Optimism shifts where a given number lands: the same 55
// reads as "strained" to a pessimist and "steady" to an optimist.
const MOOD_BANDS = [
  { max: 20, mood: 'content' },
  { max: 40, mood: 'steady' },
  { max: 60, mood: 'strained' },
  { max: 80, mood: 'distressed' },
  { max: Infinity, mood: 'crisis' },
];

// DERIVED, never stored. See decision (2) in the header.
function moodFor(live, stress) {
  // `Number(null)` is 0, which is finite — so a bare isFinite check
  // would report an unobserved person as "content". That is the
  // unknown-is-not-a-zero rule failing in the one place it matters
  // most, and it shipped here until a test caught it.
  if (stress === null || stress === undefined) return null;
  if (!Number.isFinite(Number(stress))) return null;
  const optimism = traitOr(live, 'emotional', 'Optimism', 50);
  const adjusted = clamp(Number(stress) - (optimism - 50) / 5, STRESS_MIN, STRESS_MAX);
  return MOOD_BANDS.find((b) => adjusted <= b.max).mood;
}

function findState(worldState, entityId) {
  return worldState.entityState.find((s) => s.entity_id === entityId) ?? null;
}

// The read side. Returns null rather than a zeroed row for an entity
// that has never had state — "we have not observed this person" and
// "this person is perfectly calm" are different claims.
function getEntityState(worldState, entityId) {
  const row = findState(worldState, entityId);
  if (!row) return null;
  const live = getLiveEntity(worldState, entityId);
  return {
    entityId: row.entity_id,
    stressLevel: row.stress_level,
    currentMood: moodFor(live, row.stress_level),
    tick: row.tick,
  };
}

// Apply a stress load (positive) or relief (negative) to one entity.
// Creates the row on first contact, because an entity's first stressful
// day is exactly when it starts being worth tracking.
function applyStress(worldState, entityId, delta) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) throw new Error(`applyStress: no entity with id ${entityId}.`);
  const amount = Number(delta);
  if (!Number.isFinite(amount)) {
    throw new Error(`applyStress: delta must be a number, got ${JSON.stringify(delta)}.`);
  }

  let row = findState(worldState, entityId);
  if (!row) {
    row = { entity_id: entityId, current_mood: null, stress_level: 0, tick: worldState.tick };
    worldState.entityState.push(row);
  }

  // Relief is not amplified by Volatility — a volatile person does not
  // calm down harder than anyone else.
  const wasCrisis = moodFor(live, row.stress_level) === 'crisis';
  const scaled = amount > 0 ? amount * loadMultiplier(live) : amount;
  row.stress_level = round1(clamp(row.stress_level + scaled, STRESS_MIN, STRESS_MAX));
  row.tick = worldState.tick;

  // Noticed HERE, not in runBehavior. Stress only ever rises through
  // this function -- the tick's own pass can only lower it -- so this
  // is the one place a crossing into crisis can happen, including one
  // caused by a Key resolver or an API call between ticks. Detecting it
  // inside the tick pass instead would have made exactly those cases
  // silent, which is the interesting half.
  if (!wasCrisis && moodFor(live, row.stress_level) === 'crisis') {
    worldState.pendingObservations.push({
      type: 'entity_in_crisis',
      severity: 'high',
      // `affected_entity_ids`, not `entityId`. runEventPhase copies
      // exactly this field and drops everything else, and players.js
      // filters the citizen dashboard's recent events by it -- so an
      // observation that names the person any other way produces an
      // event about nobody, which is what the first version did.
      affected_entity_ids: [entityId],
      global_effects: { stressLevel: row.stress_level },
    });
  }
  return getEntityState(worldState, entityId);
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------
// `harmful` is a flag on a habit, not a separate table — the schema says
// so in its own comment ("addiction = harmful habit, not a separate
// table") and this follows it rather than inventing an Addiction system.
const HABIT_MIN = 0;
const HABIT_MAX = 100;
const HABIT_DECAY_PER_TICK = 0.5;
// The line above which a harmful habit is worth the world noticing.
const HABIT_ENTRENCHED = 70;

function findHabit(worldState, entityId, name) {
  return worldState.habits.find((h) => h.entity_id === entityId && h.habit_name === name) ?? null;
}

function listHabits(worldState, entityId) {
  return worldState.habits.filter((h) => h.entity_id === entityId);
}

// Reinforce (or create) a habit. Discipline entrenches a deliberate
// habit; Compulsiveness and Impulsivity entrench a harmful one. Reading
// different traits for the two cases is the point — a disciplined person
// keeps up a routine AND resists an addiction, and one number cannot say
// both.
function reinforceHabit(worldState, entityId, name, options = {}) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) throw new Error(`reinforceHabit: no entity with id ${entityId}.`);
  if (!name || typeof name !== 'string') {
    throw new Error('reinforceHabit: a habit needs a name.');
  }
  const { harmful = false, amount = 5 } = options;

  const driver = harmful
    ? (traitOr(live, 'psychological', 'Compulsiveness', 50)
       + traitOr(live, 'psychological', 'Impulsivity', 50)) / 2
    : traitOr(live, 'behavioral', 'Discipline', 50);
  const gain = Number(amount) * (0.5 + driver / 100);

  let habit = findHabit(worldState, entityId, name);
  if (!habit) {
    habit = {
      id: worldState.nextEntityId++,
      entity_id: entityId,
      habit_name: name,
      strength: 0,
      harmful: Boolean(harmful),
      first_observed_tick: worldState.tick,
      last_reinforced_tick: worldState.tick,
    };
    worldState.habits.push(habit);
  }
  const was = habit.strength;
  habit.strength = round1(clamp(habit.strength + gain, HABIT_MIN, HABIT_MAX));
  habit.last_reinforced_tick = worldState.tick;

  // Same reasoning as the crisis crossing above: strength only rises
  // here, so this is where "became entrenched" can be seen at all.
  if (habit.harmful && was < HABIT_ENTRENCHED && habit.strength >= HABIT_ENTRENCHED) {
    worldState.pendingObservations.push({
      type: 'habit_entrenched',
      severity: 'medium',
      note: habit.habit_name,
      affected_entity_ids: [entityId],
      global_effects: { habit: habit.habit_name, strength: habit.strength },
    });
  }
  return habit;
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------
function addScheduleEvent(worldState, entityId, options = {}) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) throw new Error(`addScheduleEvent: no entity with id ${entityId}.`);
  const { eventType, frequency, timeSlot = null, locationPropertyId = null } = options;

  if (!eventType) throw new Error('addScheduleEvent: eventType is required.');
  if (!FREQUENCIES.includes(frequency)) {
    throw new Error(
      `addScheduleEvent: "${frequency}" is not a frequency (one of: ${FREQUENCIES.join(', ')}).`,
    );
  }
  // A schedule pointing at a property that does not exist would send
  // somebody to a building nobody built, and would only surface as a
  // null much later.
  if (locationPropertyId !== null
      && !worldState.properties.some((p) => p.id === locationPropertyId)) {
    throw new Error(`addScheduleEvent: no property with id ${locationPropertyId}.`);
  }

  const event = {
    id: worldState.nextEntityId++,
    entity_id: entityId,
    event_type: eventType,
    frequency,
    time_slot: timeSlot,
    location_property_id: locationPropertyId,
    // NOT the current tick. Seeding this to "now" would mean a new
    // daily routine does not happen until tomorrow, which reads as a
    // bug the first time somebody adds a schedule and ticks once.
    tick_last_occurred: null,
  };
  worldState.scheduleEvents.push(event);
  return event;
}

function listScheduleEvents(worldState, entityId) {
  return worldState.scheduleEvents.filter((e) => e.entity_id === entityId);
}

// Is this event due on this tick? A never-occurred event is due
// immediately; otherwise the interval has to have elapsed.
function isDue(worldState, event) {
  const every = intervals(worldState)[event.frequency];
  if (!Number.isFinite(every)) return false;
  if (event.tick_last_occurred === null) return true;
  return worldState.tick - event.tick_last_occurred >= every;
}

// ---------------------------------------------------------------------------
// runBehavior() — the per-tick pass
// ---------------------------------------------------------------------------
// Returns candidate events, exactly like a phase, so the Event phase
// treats them no differently from anything else.
function runBehavior(worldState) {
  // **Observations are queued at the moment they happen, and drained
  // here.** They are not re-derived from a before/after snapshot of
  // this pass: a harmful habit pushed over the line by a Key resolver,
  // or somebody driven into crisis by an API call, happens BETWEEN
  // ticks and a snapshot taken at the top of this function has already
  // missed it. The first version of this file did exactly that and
  // reported nothing for the cases worth reporting.
  //
  // Queued rather than emitted directly because only the tick may add
  // to the event log — an observation made at 3pm still belongs to the
  // tick that contains 3pm.
  // Stamped with the tick that REPORTS them, not the one they were
  // queued in: runEventPhase copies `candidate.tick` straight through,
  // and an event with no tick is one no history query can place.
  const events = worldState.pendingObservations
    .splice(0)
    .map((o) => ({ ...o, tick: worldState.tick }));

  // 1. Stress decays. This can only LOWER stress, which is why no
  //    crisis crossing can originate here.
  for (const row of worldState.entityState) {
    const live = getLiveEntity(worldState, row.entity_id);
    if (!live) continue;
    const before = row.stress_level;
    row.stress_level = round1(clamp(before - recoveryRate(live), STRESS_MIN, STRESS_MAX));
    if (row.stress_level !== before) row.tick = worldState.tick;
  }

  // 2. Schedules fire, and a kept routine reinforces the habit of it.
  //    This is where routine becomes character rather than a calendar.
  //    Anything it entrenches queues its own observation inside
  //    reinforceHabit, so it is picked up by the NEXT drain — one tick
  //    later, which is when the world could have noticed it anyway.
  for (const event of worldState.scheduleEvents) {
    if (!isDue(worldState, event)) continue;
    event.tick_last_occurred = worldState.tick;
    reinforceHabit(worldState, event.entity_id, event.event_type, { amount: 2 });
  }

  // 3. Habits nobody kept up this tick fade.
  for (const habit of worldState.habits) {
    if (habit.last_reinforced_tick === worldState.tick) continue;
    habit.strength = round1(clamp(habit.strength - HABIT_DECAY_PER_TICK, HABIT_MIN, HABIT_MAX));
  }

  return events;
}

// A read-only summary for the citizen dashboard and the API.
function describeBehavior(worldState, entityId) {
  return {
    entityId,
    state: getEntityState(worldState, entityId),
    habits: listHabits(worldState, entityId).map((h) => ({
      name: h.habit_name,
      strength: h.strength,
      harmful: h.harmful,
      firstObservedTick: h.first_observed_tick,
      lastReinforcedTick: h.last_reinforced_tick,
    })),
    schedule: listScheduleEvents(worldState, entityId).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      frequency: e.frequency,
      timeSlot: e.time_slot,
      locationPropertyId: e.location_property_id,
      tickLastOccurred: e.tick_last_occurred,
      due: isDue(worldState, e),
    })),
  };
}

// ---------------------------------------------------------------------------
// Every trait this file weights must be a real one, checked at require
// time — the flows.js dead-signal lesson, applied a third time. A
// misspelled trait name would fall through to the neutral fallback and
// the engine would run perfectly while quietly ignoring the trait.
// ---------------------------------------------------------------------------
const WEIGHTED_TRAITS = [
  ['emotional', 'Resilience'], ['emotional', 'Volatility'], ['emotional', 'Optimism'],
  ['health', 'Sleep Quality'],
  ['behavioral', 'Discipline'],
  ['psychological', 'Compulsiveness'], ['psychological', 'Impulsivity'],
];

function assertBehaviorReadsRealTraits() {
  const { TRAIT_FAMILIES } = require('./traits.js');
  const bad = [];
  for (const [family, name] of WEIGHTED_TRAITS) {
    const known = TRAIT_FAMILIES[family];
    if (!known) { bad.push(`no trait family "${family}"`); continue; }
    if (!known.includes(name)) bad.push(`${family} has no trait "${name}"`);
  }
  if (bad.length) {
    throw new Error(`behavior.js reads traits that do not exist:\n  ${bad.join('\n  ')}`);
  }
}

assertBehaviorReadsRealTraits();

module.exports = {
  TICK_INTERVALS,
  FREQUENCIES,
  MOOD_BANDS,
  HABIT_ENTRENCHED,
  WEIGHTED_TRAITS,
  moodFor,
  getEntityState,
  applyStress,
  reinforceHabit,
  listHabits,
  addScheduleEvent,
  listScheduleEvents,
  isDue,
  runBehavior,
  describeBehavior,
  assertBehaviorReadsRealTraits,
};
