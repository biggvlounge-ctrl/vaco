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

//: When in a day something happens. `schedule_events.time_slot` is a
//: bare TEXT column with no comment and no enumeration anywhere in the
//: package — unlike `frequency`, which the schema enumerates in its own
//: comment. So this list is chosen here and flagged, the same way
//: `TICK_INTERVALS` is.
//:
//: It was null on all 352 routines in a built world before this: a
//: column carried through generation, migration and restore with
//: nothing ever in it.
const TIME_SLOTS = ['morning', 'midday', 'evening', 'night'];

//: Which slot each routine falls in. Derived from what the routine IS
//: rather than drawn at random — a person sleeps at night and works in
//: the morning, and a random assignment would make the column noise
//: instead of information.
const SLOT_FOR_EVENT = {
  rest: 'night',
  eat: 'midday',
  work: 'morning',
  gathering: 'evening',
};

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
//: How fast a habit fades, as a share of what is there, per tick.
//:
//: **Proportional, not flat, and the difference is that weekly routines
//: exist at all.** This was a flat 0.5 a tick, and flat decay against a
//: periodic reinforcement is the same step function `applyStress`
//: already argues against fifty lines below: anything practised more
//: often than the decay rate finds a balance, and anything practised
//: less often falls to zero and stays there. There is no middle.
//:
//: Measured on a 200-tick world, that is exactly what had happened:
//:
//:   rest / eat / work   daily     p50 75.3
//:   gathering           weekly    p50  0.3
//:
//: Seventeen people held a `gathering` schedule, it fired every seventh
//: tick for +2, and 3.5 of decay took it away in between. So the weekly
//: frequency was wired, firing, and inert — and this file's own header
//: had recorded making it real, because a schedule that fires looks
//: exactly like a habit that forms. Downstream, `traitDrift` weights a
//: habit's effect by `strength / 100`, so `gathering`'s two social
//: traits drifted by 0.003 of their rate, and
//: `motivation.SATISFIERS.friendship` read a habit strength of 0.003.
//:
//: With decay proportional, a habit settles where reinforcement and
//: fading balance, and that point now reflects how often it is
//: practised as well as who is practising it:
//:
//:   daily        ~80        weekly       ~36        fortnightly  ~22
//:
//: **The number is unchanged on purpose.** 0.5 was the flat amount and
//: is now the percent; changing the shape and the magnitude in one step
//: would make it impossible to say which caused what. The one real
//: consequence is that an abandoned habit now fades exponentially
//: rather than linearly — a half-life of about 139 ticks instead of a
//: hard floor at 150 — which is what `HABIT_ENTRENCHED` already implies
//: a habit is.
const HABIT_DECAY_PER_TICK = 0.5;
// The line above which a harmful habit is worth the world noticing.
const HABIT_ENTRENCHED = 70;

//: How much of a habit's remaining room a reinforcement closes.
//:
//: **This constant is what makes `habits.strength` mean anything.**
//: Measured on a built world, the first version put every habit in the
//: world at exactly 100: a daily routine fires every tick, each firing
//: added a flat 1-3, decay only applied on ticks with no firing, so
//: every habit ratcheted to the ceiling within about forty ticks and
//: stayed. 365 rows, min 100, median 100, max 100 — a column that
//: costs storage and carries no information about anybody.
//:
//: With gain scaled by the room left (`1 - strength/MAX`) and decay
//: applied every tick, a habit settles where reinforcement and decay
//: balance, and that point is set by the person's own trait:
//:
//:   Discipline    0 → ~50      100 → ~83      50 → ~75
//:
//: So habit strength becomes a reading of who somebody is rather than
//: of how long the world has been running, and a habit that stops
//: being practised decays away instead of standing at 100 forever.
//: Diminishing returns is also simply what habit formation is — the
//: first week of a routine changes more than the fiftieth.
const HABIT_ROOM_FACTOR = 1;

//: The stress above which somebody starts leaning on something to
//: cope. 60 is the top of the `strained` band and the bottom of
//: `distressed` in MOOD_BANDS — so this is not a new threshold, it is
//: the one the mood model already draws, reused rather than invented.
const HARMFUL_HABIT_STRESS = 60;

//: What that coping is called. **Flagged interpretive, and deliberately
//: one neutral name rather than a list.** The schema gives no
//: vocabulary for habit names at all, and inventing a menu of specific
//: vices would be writing content into an engine — a world that wants
//: its own can change this one constant or call `reinforceHabit`
//: directly with any name it likes.
const HARMFUL_HABIT = 'self-medicating';

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
  const existing = findHabit(worldState, entityId, name);
  // Diminishing returns — see HABIT_ROOM_FACTOR. Read before the row
  // is created so a brand-new habit gets the full first step.
  const room = 1 - (Number(existing?.strength ?? 0) / HABIT_MAX) * HABIT_ROOM_FACTOR;
  const gain = Number(amount) * (0.5 + driver / 100) * Math.max(0, room);

  let habit = existing;
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
// **Death ends a routine.** Moving the row out of `worldState.npcs`
// makes a corpse structurally incapable of being iterated as a person,
// and it does not reach into the three tables this module owns — the
// same gap `membership.releaseDeceased` closes for organization
// rosters. A schedule left behind fires forever for somebody who is
// not there, and the first world that ran long enough for a person
// with a routine to die crashed on exactly that.
//
// `|| []` throughout, for the reason every reader in this engine has
// it: `mortality.recordDeath` calls this on any world that records a
// death, and plenty of worlds — fixtures, scenarios, a scenario that
// only cares about employment — never declare the three tables this
// module owns. Reading an array a caller has not declared throws on a
// world that is otherwise perfectly valid, which is standing rule 6
// arriving from the other direction.
function releaseDeceased(worldState, entityId) {
  const schedules = worldState.scheduleEvents || [];
  const habitRows = worldState.habits || [];
  const stateRows = worldState.entityState || [];
  const released = {
    scheduleEvents: schedules.filter((e) => e.entity_id === entityId).length,
    habits: habitRows.filter((h) => h.entity_id === entityId).length,
    entityState: stateRows.filter((s) => s.entity_id === entityId).length,
  };
  worldState.scheduleEvents = schedules.filter((e) => e.entity_id !== entityId);
  worldState.habits = habitRows.filter((h) => h.entity_id !== entityId);
  worldState.entityState = stateRows.filter((s) => s.entity_id !== entityId);
  return released;
}

// ---------------------------------------------------------------------------
// What the world does to people
// ---------------------------------------------------------------------------
// **The edge this engine did not have.** `entity_state`, `habits` and
// `schedule_events` were the three tables §4.5 named as genuinely new,
// all three were built here, and all three were **empty in every
// running world** — measured: 0 rows each after 300 ticks of a
// 150-person world. `applyStress` was reachable only through the API,
// `runBehavior` decays what is already there and creates nothing, and
// no schedule was ever added by anything.
//
// So the Behavior Engine was complete and never engaged. A person's
// mood, stress, routine and habits — everything that makes an NPC
// somebody rather than a trait sheet — sat at null forever unless a
// human poked the API.
//
// This is what feeds it: the events the tick has just produced. Not a
// new source of truth and not a new phase — a reading of what already
// happened, applied to the people it happened to.
//
// //: INTERPRETIVE. No document gives stress values. These are ordered
// //: by how much the thing would actually disrupt a life, and the
// //: ordering is the part worth defending: losing a family member
// //: outweighs being robbed, which outweighs missing a wage.
// //:
// //: `applyStress` already scales a positive load by the person's own
// //: Volatility and Resilience, so these are the world's side of it
// //: and the person's side is applied for us.
const STRESS_BY_EVENT = {
  death: 30,
  crime: 12,
  crime_cleared: -6,
  payroll_missed: 10,
  scarcity: 4,
  infrastructure_at_risk: 3,
  conflict_escalation: 14,
  birth: -10,
  partnership_formed: -8,
  fear_spike: 6,
  // Added 26 Sep 2026 alongside server/drugs.js. Between `scarcity` (a
  // shortage of something everybody needs) and `crime` (having been
  // victimized) in size — dependency without access is a real load,
  // and this file already has both numbers to anchor it against rather
  // than inventing a third scale.
  withdrawal: 8,
  // Added the same day alongside server/gambling.js. A notable loss is
  // sized like `scarcity`; a notable win is `partnership_formed`'s own
  // relief figure, halved — good news, not the best news anybody gets.
  gambling_loss: 4,
  gambling_win: -4,
  // Added the same day alongside server/warfare.js. `war_casualty`
  // (somebody died) sits just under `death` itself — the winner
  // witnessed it and did it, which is not quite the same load as losing
  // someone close, and `war_battle` (nobody died) is sized like
  // `conflict_escalation`: real violence, survived.
  war_battle: 14,
  war_casualty: 26,
  // Added the same day alongside births.js's Libido/Fidelity mechanic.
  // Sized against `crime`'s own 12 — a discovered betrayal by someone
  // close is a comparable blow to being victimized by a stranger.
  infidelity_discovered: 18,
};

// Apply this tick's events to the people they happened to.
//
// **Reads `affected_entity_ids`, which every phase already sets.** A
// second list of "who was involved" would be a second source of truth
// about the same fact, and the two would drift the first time somebody
// added an event type.
function applyEventStress(worldState, events, tick = worldState.tick ?? 0) {
  const touched = new Set();
  const living = new Set(worldState.npcs.map((n) => n.id));

  for (const event of events || []) {
    const delta = STRESS_BY_EVENT[event.type];
    if (delta === undefined) continue;
    for (const entityId of event.affected_entity_ids || []) {
      // The dead are past being stressed, and `applyStress` throws on
      // an entity it cannot find — a death event names the person who
      // died, so this is the common case rather than an edge one.
      if (!living.has(entityId)) continue;
      applyStress(worldState, entityId, delta);
      touched.add(entityId);
    }
  }

  void tick;
  return { touched: touched.size };
}

// Give somebody the routine their situation implies.
//
// **Derived, not invented.** A person with a job has somewhere to be
// daily; everybody rests and eats. Nothing here decides what a person
// LIKES — habits form from what they actually keep up, which is
// `runBehavior`'s job and was already built.
// Where somebody sleeps. `npcs.home_property_id` is set by `worldgen`
// for every resident, so this is a real building rather than an
// invented one — and null for a person assembled some other way, which
// `addScheduleEvent` accepts.
function homeOf(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  const home = npc?.home_property_id ?? null;
  if (home === null) return null;
  return (worldState.properties || []).some((p) => p.id === home) ? home : null;
}

// Where somebody works: the building their employer operates out of.
// `properties.operating_organization_id` is the schema's own link and
// this is the only thing that reads it.
function workplaceOf(worldState, entityId) {
  const job = (worldState.employmentRecords || []).find(
    (r) => r.entity_id === entityId && r.status === 'active',
  );
  if (!job) return null;
  const site = (worldState.properties || []).find(
    (p) => p.operating_organization_id === job.employer_organization_id,
  );
  return site ? site.id : null;
}

// The routine somebody keeps. **Every field the schema offers is
// filled where the world can say what it should be**, which before
// this meant: event type and frequency only, with `time_slot` and
// `location_property_id` null on all 352 rows in a built world while
// 185 properties stood in it. Nobody went anywhere, and nothing
// happened at any particular time of day.
function seedRoutine(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const added = [];

  const has = (type) => worldState.scheduleEvents.some(
    (e) => e.entity_id === entityId && e.event_type === type,
  );
  const add = (eventType, frequency, locationPropertyId = null) => {
    if (has(eventType)) return;
    added.push(addScheduleEvent(worldState, entityId, {
      eventType,
      frequency,
      timeSlot: SLOT_FOR_EVENT[eventType] ?? null,
      locationPropertyId,
    }));
  };

  const home = homeOf(worldState, entityId);
  add('rest', 'daily', home);
  add('eat', 'daily', home);

  const employed = (worldState.employmentRecords || []).some(
    (r) => r.entity_id === entityId && r.status === 'active',
  );
  if (employed) add('work', 'daily', workplaceOf(worldState, entityId));

  // **A weekly routine, and the one the world can actually justify.**
  // `schedule_events.frequency` enumerates daily|weekly|monthly|yearly
  // and only `daily` was ever used, so three quarters of the column's
  // own vocabulary was dead. Belonging to an organization is real
  // substrate — `entity_organization_memberships` has rows in every
  // built world — and an organization whose members never convene is
  // a membership list rather than an organization. Nothing else here
  // has a defensible period, so nothing else gets one.
  const belongs = (worldState.entityOrganizationMemberships || []).some(
    (m) => m.entity_id === entityId && m.status !== 'left',
  );
  if (belongs) add('gathering', 'weekly', null);

  void tick;
  return added;
}

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
    // **Proportional, not a flat subtraction, and the difference is
    // the whole shape of the model.** Flat decay against a steady load
    // is a step function: any load above the recovery rate ratchets to
    // 100 and any load below it falls to 0, with no equilibrium in
    // between. Measured with ongoing conditions feeding it, that gave
    // 142 people at exactly 0 and six pinned at 97 — a world with no
    // middle.
    //
    // Shedding a share of what is actually there settles a person
    // where their circumstances put them: a constant load L comes to
    // rest at `100 * L / rate`, so being poor and out of work reads as
    // strained rather than as either fine or ruined.
    row.stress_level = round1(clamp(
      before - recoveryRate(live) * (before / STRESS_MAX), STRESS_MIN, STRESS_MAX,
    ));
    if (row.stress_level !== before) row.tick = worldState.tick;
  }

  // 2. Schedules fire, and a kept routine reinforces the habit of it.
  //    This is where routine becomes character rather than a calendar.
  //    Anything it entrenches queues its own observation inside
  //    reinforceHabit, so it is picked up by the NEXT drain — one tick
  //    later, which is when the world could have noticed it anyway.
  const living = new Set(worldState.npcs.map((n) => n.id));
  for (const event of worldState.scheduleEvents) {
    // **A schedule can outlive its owner**, and this threw the first
    // time a world ran long enough for somebody with a routine to die:
    // `reinforceHabit` goes through `getLiveEntity`, which cannot find
    // a corpse. `mortality.recordDeath` now releases a dead person's
    // routine, and this stays as the guard for a world assembled some
    // other way — a restore, a fixture, a scenario.
    if (!living.has(event.entity_id)) continue;
    if (!isDue(worldState, event)) continue;
    event.tick_last_occurred = worldState.tick;
    reinforceHabit(worldState, event.entity_id, event.event_type, { amount: 2 });
  }

  // 3. Sustained strain becomes a way of coping.
  //
  // **The `harmful` half of the habits table, which nothing wrote.**
  // The schema names it in its own comment — "addiction = harmful
  // habit, not a separate table" — and `reinforceHabit` has always
  // read Compulsiveness and Impulsivity for exactly this case, with no
  // caller anywhere that passed `harmful: true`. A whole modelled
  // mechanism, tested and green, that no world had ever reached.
  //
  // Driven by stress rather than by a draw, because stress is the only
  // thing in this engine that represents somebody being under
  // sustained pressure, and it is already shaped by their traits on
  // the way in. Who then forms the habit, and how fast, is
  // `reinforceHabit`'s existing psychological read — so nothing new is
  // invented about who is vulnerable.
  for (const row of worldState.entityState) {
    if (Number(row.stress_level) < HARMFUL_HABIT_STRESS) continue;
    if (!living.has(row.entity_id)) continue;
    reinforceHabit(worldState, row.entity_id, HARMFUL_HABIT, {
      harmful: true, amount: 1,
    });
  }

  // 4. Every habit fades a little, kept up or not.
  //
  // **Not "habits nobody kept up this tick fade", which is what this
  // was.** A daily routine fires every tick, so under that rule a
  // daily habit never decayed once, gain was unopposed, and every
  // habit in every world ratcheted to exactly 100. Decay has to be
  // unconditional for reinforcement to balance against it — that
  // balance point, set by the person's own Discipline, is the entire
  // information content of `habits.strength`. See HABIT_ROOM_FACTOR.
  //
  // Applied after the reinforcement pass so a habit kept up today nets
  // out positive while it still has room, and negative once it does
  // not — which is what a plateau is.
  // A share of what is there, not a flat subtraction — see
  // HABIT_DECAY_PER_TICK for the measurement that changed this and for
  // what a flat rate did to every routine practised less than daily.
  for (const habit of worldState.habits) {
    const fade = (HABIT_DECAY_PER_TICK / 100) * habit.strength;
    habit.strength = round1(clamp(habit.strength - fade, HABIT_MIN, HABIT_MAX));
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
  TIME_SLOTS,
  SLOT_FOR_EVENT,
  HABIT_ROOM_FACTOR,
  HARMFUL_HABIT_STRESS,
  HARMFUL_HABIT,
  homeOf,
  workplaceOf,
  TICK_INTERVALS,
  FREQUENCIES,
  MOOD_BANDS,
  HABIT_ENTRENCHED,
  WEIGHTED_TRAITS,
  moodFor,
  getEntityState,
  applyStress,
  releaseDeceased,
  STRESS_BY_EVENT,
  applyEventStress,
  seedRoutine,
  reinforceHabit,
  listHabits,
  addScheduleEvent,
  listScheduleEvents,
  isDue,
  runBehavior,
  describeBehavior,
  assertBehaviorReadsRealTraits,
};
