// VACANCY — the Behavior Engine: routine, mood, habits.
//
// **What this covers.** The architecture document's §4.5 named exactly
// three tables as genuinely new rather than restatements of systems
// already built — `schedule_events`, `entity_state`, `habits`. All
// three were in the schema from the start. All three had zero lines of
// code anywhere in `server/` until 29 Aug 2026, so a person in this
// world had traits, money, property, relationships and a job, and no
// routine, no mood and no habits.
//
// Four properties matter more than the arithmetic:
//
//   1. **Stress is stored, mood is derived.** Standing rule 3. Mood is
//      a band over stress and storing it would be the drift the rule
//      exists to prevent.
//   2. **Unknown is not a zero.** An entity nobody has observed has no
//      state — not a calm one. A missing trait falls back to neutral,
//      not to 0.
//   3. **Events fire on the crossing, not the condition.** Otherwise a
//      habit at 100 emits an identical event every tick forever.
//   4. **Traits read are real traits.** The flows.js dead-signal
//      failure, guarded a third time.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const behavior = require('../server/behavior.js');
const engine = require('../server/engine.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// Set a real entity_traits row. An entity_traits row is
// `{ entity_id, trait_id, current_value, base_value, ...modifiers }` —
// there is no `trait_name` and no `value`, and a helper that looks one
// up by name finds nothing and silently sets nothing. That mistake cost
// four failing tests in contest.test.js, so this throws on a miss.
function setTrait(entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`no such trait: ${family}.${name}`);
  const row = engine.WorldState.entityTraits.find(
    (r) => r.entity_id === entityId && r.trait_id === traitId,
  );
  if (!row) throw new Error(`entity ${entityId} carries no ${family}.${name} row`);
  row.current_value = value;
  row.base_value = value;
}

function person(overrides = {}) {
  const npc = engine.generateNPC();
  for (const [family, traits] of Object.entries(overrides)) {
    for (const [name, value] of Object.entries(traits)) setTrait(npc.id, family, name, value);
  }
  return npc;
}

// ---------------------------------------------------------------------------
// The traits are real
// ---------------------------------------------------------------------------

test('every trait the Behavior Engine reads is a real trait in a real family', () => {
  assert.doesNotThrow(() => behavior.assertBehaviorReadsRealTraits());
  assert.ok(behavior.WEIGHTED_TRAITS.length >= 7);
});

test('WEIGHTED_TRAITS covers every trait the file actually reads', () => {
  // assertBehaviorReadsRealTraits() only checks the traits on the LIST.
  // A new `traitOr(live, 'emotional', 'Serenety', 50)` added tomorrow
  // would fall through to the neutral fallback, the engine would run
  // perfectly, and the trait would be silently ignored forever — the
  // flows.js dead-signal failure with one more step of indirection.
  // So the list is checked against the source, not trusted.
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'server', 'behavior.js'), 'utf8',
  );
  const read = [...src.matchAll(/traitOr\(\s*live\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g)]
    .map((m) => `${m[1]}.${m[2]}`);
  assert.ok(read.length > 0, 'the scanner found no trait reads at all — it is broken');

  const registered = new Set(behavior.WEIGHTED_TRAITS.map(([f, n]) => `${f}.${n}`));
  const unregistered = [...new Set(read)].filter((t) => !registered.has(t));
  assert.deepEqual(unregistered, [],
    'these traits are read but not in WEIGHTED_TRAITS, so nothing checks they exist');
});

test('the fixture actually sets the traits it claims to set', () => {
  // Every comparison below rests on this. Without it a "resilient" and a
  // "fragile" person would both be whatever random generation produced.
  const p = person({ emotional: { Resilience: 90, Volatility: 10, Optimism: 50 } });
  const live = require('../server/entityTraits.js').getLiveEntity(engine.WorldState, p.id);
  assert.equal(live.traits.emotional.Resilience, 90);
  assert.equal(live.traits.emotional.Volatility, 10);
  assert.throws(() => person({ emotional: { Serenity: 50 } }), /no such trait/);
});

// ---------------------------------------------------------------------------
// Unknown is not a zero
// ---------------------------------------------------------------------------

test('an entity nobody has observed has no state, not a calm one', () => {
  // The distinction the whole engine keeps making. A zeroed row here
  // would claim, on no evidence, that this person is perfectly serene.
  const p = person();
  assert.equal(behavior.getEntityState(engine.WorldState, p.id), null);
  const described = behavior.describeBehavior(engine.WorldState, p.id);
  assert.equal(described.state, null);
  assert.deepEqual(described.habits, []);
  assert.deepEqual(described.schedule, []);
});

test('stress can be applied to a real entity and only a real entity', () => {
  const p = person();
  const state = behavior.applyStress(engine.WorldState, p.id, 30);
  assert.ok(state.stressLevel > 0);
  assert.throws(() => behavior.applyStress(engine.WorldState, 999999, 10), /no entity/);
  assert.throws(() => behavior.applyStress(engine.WorldState, p.id, 'a lot'), /must be a number/);
});

// ---------------------------------------------------------------------------
// Mood is derived, never stored
// ---------------------------------------------------------------------------

test('mood is a band over stress and moves when stress does', () => {
  const p = person({ emotional: { Optimism: 50, Resilience: 50, Volatility: 50 } });
  assert.equal(behavior.applyStress(engine.WorldState, p.id, 10).currentMood, 'content');
  assert.equal(behavior.applyStress(engine.WorldState, p.id, 25).currentMood, 'steady');
  assert.equal(behavior.applyStress(engine.WorldState, p.id, 20).currentMood, 'strained');
  assert.equal(behavior.applyStress(engine.WorldState, p.id, 20).currentMood, 'distressed');
  assert.equal(behavior.applyStress(engine.WorldState, p.id, 30).currentMood, 'crisis');
});

test('the same stress reads as a different mood to an optimist and a pessimist', () => {
  // If Optimism did not shift the band, this system would be a
  // thermometer with a label on it rather than a model of a person.
  const optimist = person({ emotional: { Optimism: 100, Resilience: 50, Volatility: 50 } });
  const pessimist = person({ emotional: { Optimism: 0, Resilience: 50, Volatility: 50 } });
  behavior.applyStress(engine.WorldState, optimist.id, 41);
  behavior.applyStress(engine.WorldState, pessimist.id, 41);
  assert.equal(behavior.getEntityState(engine.WorldState, optimist.id).currentMood, 'steady');
  assert.equal(behavior.getEntityState(engine.WorldState, pessimist.id).currentMood, 'strained');
});

test('the stored row carries stress and never a computed mood', () => {
  // Standing rule 3, at the place it would actually be broken.
  const p = person();
  behavior.applyStress(engine.WorldState, p.id, 50);
  const row = engine.WorldState.entityState.find((s) => s.entity_id === p.id);
  assert.equal(typeof row.stress_level, 'number', 'stress IS stored — it is path-dependent');
  assert.equal(row.current_mood, null, 'mood is derived on read and must never be written');
});

test('a mood cannot be given for a stress level nobody has', () => {
  assert.equal(behavior.moodFor({ traits: {} }, null), null);
  assert.equal(behavior.moodFor({ traits: {} }, undefined), null);
});

// ---------------------------------------------------------------------------
// Traits change how stress lands
// ---------------------------------------------------------------------------

test('the same blow lands harder on a volatile person than a resilient one', () => {
  const steady = person({ emotional: { Resilience: 100, Volatility: 0, Optimism: 50 } });
  const brittle = person({ emotional: { Resilience: 0, Volatility: 100, Optimism: 50 } });
  const a = behavior.applyStress(engine.WorldState, steady.id, 20).stressLevel;
  const b = behavior.applyStress(engine.WorldState, brittle.id, 20).stressLevel;
  assert.ok(b > a, `volatile ${b} should exceed resilient ${a} from the same 20`);
});

test('relief is not amplified — a volatile person does not calm down harder', () => {
  const brittle = person({ emotional: { Resilience: 0, Volatility: 100, Optimism: 50 } });
  behavior.applyStress(engine.WorldState, brittle.id, 40);
  const before = behavior.getEntityState(engine.WorldState, brittle.id).stressLevel;
  const after = behavior.applyStress(engine.WorldState, brittle.id, -10).stressLevel;
  assert.equal(Math.round((before - after) * 10) / 10, 10, 'relief is applied at face value');
});

test('stress stays inside its bounds however hard it is pushed', () => {
  const p = person();
  behavior.applyStress(engine.WorldState, p.id, 5000);
  assert.equal(behavior.getEntityState(engine.WorldState, p.id).stressLevel, 100);
  behavior.applyStress(engine.WorldState, p.id, -5000);
  assert.equal(behavior.getEntityState(engine.WorldState, p.id).stressLevel, 0);
});

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

test('a schedule event is refused unless it is real in every field', () => {
  const p = person();
  assert.throws(() => behavior.addScheduleEvent(engine.WorldState, 999999,
    { eventType: 'x', frequency: 'daily' }), /no entity/);
  assert.throws(() => behavior.addScheduleEvent(engine.WorldState, p.id,
    { frequency: 'daily' }), /eventType is required/);
  assert.throws(() => behavior.addScheduleEvent(engine.WorldState, p.id,
    { eventType: 'x', frequency: 'fortnightly' }), /not a frequency/);
  // A routine pointing at a building nobody built would surface as a
  // null somewhere much later.
  assert.throws(() => behavior.addScheduleEvent(engine.WorldState, p.id,
    { eventType: 'x', frequency: 'daily', locationPropertyId: 999999 }), /no property/);
});

test('a new routine happens immediately, not tomorrow', () => {
  // tick_last_occurred seeded to "now" would mean adding a daily
  // routine and ticking once does nothing — which reads as a bug the
  // first time anybody tries it.
  const p = person();
  const event = behavior.addScheduleEvent(engine.WorldState, p.id,
    { eventType: 'morning shift', frequency: 'daily' });
  assert.equal(event.tick_last_occurred, null, 'never occurred is not "occurred just now"');
  assert.equal(behavior.isDue(engine.WorldState, event), true);
});

test('frequency actually governs how often something happens', () => {
  const p = person();
  const daily = behavior.addScheduleEvent(engine.WorldState, p.id,
    { eventType: 'shift', frequency: 'daily' });
  const weekly = behavior.addScheduleEvent(engine.WorldState, p.id,
    { eventType: 'market', frequency: 'weekly' });

  const start = engine.WorldState.tick;
  for (let i = 0; i < 7; i += 1) engine.advanceTick();

  assert.equal(daily.tick_last_occurred, engine.WorldState.tick, 'a daily event ran on the last tick');
  // Weekly fires on the first tick (never occurred) and then not again
  // until seven have passed.
  assert.ok(
    weekly.tick_last_occurred <= start + 1,
    `a weekly event should not have re-fired inside seven ticks (fired at ${weekly.tick_last_occurred}, started ${start})`,
  );
});

test('a tick is a day here because nothing in the package says otherwise', () => {
  // Documented as a decision this file makes rather than one it found.
  assert.deepEqual(behavior.TICK_INTERVALS, {
    daily: 1, weekly: 7, monthly: 30, yearly: 365,
  });
  assert.deepEqual(behavior.FREQUENCIES, ['daily', 'weekly', 'monthly', 'yearly']);
});

test('the interval table can be overridden wholesale, like flow templates', () => {
  // So that deciding a tick is an hour moves one constant and nothing
  // else. Restored afterwards — a test that leaves the world reconfigured
  // breaks whichever test happens to run next.
  const p = person();
  const event = behavior.addScheduleEvent(engine.WorldState, p.id,
    { eventType: 'rare rite', frequency: 'yearly' });
  engine.WorldState.tickIntervals = { daily: 1, weekly: 7, monthly: 30, yearly: 2 };
  try {
    const anchor = engine.WorldState.tick;
    event.tick_last_occurred = anchor;
    assert.equal(behavior.isDue(engine.WorldState, event), false, 'not due on the tick it just ran');
    engine.advanceTick();
    assert.equal(event.tick_last_occurred, anchor, 'still not due one tick into a two-tick year');
    engine.advanceTick();
    // Asserted on tick_last_occurred rather than isDue(): the tick's own
    // pass FIRES a due event and stamps it, so by the time the assertion
    // runs it is correctly no longer due. Checking isDue() here would be
    // checking that the thing already happened, and would read as a
    // failure.
    assert.equal(event.tick_last_occurred, anchor + 2,
      'a 2-tick year fires on the second tick');
  } finally {
    delete engine.WorldState.tickIntervals;
  }
});

// ---------------------------------------------------------------------------
// Habits — where routine becomes character
// ---------------------------------------------------------------------------

test('keeping a routine builds the habit of it', () => {
  const p = person({ behavioral: { Discipline: 50 } });
  behavior.addScheduleEvent(engine.WorldState, p.id, { eventType: 'training', frequency: 'daily' });
  assert.equal(behavior.listHabits(engine.WorldState, p.id).length, 0, 'no habit before it is kept');

  for (let i = 0; i < 5; i += 1) engine.advanceTick();

  const habit = behavior.listHabits(engine.WorldState, p.id).find((h) => h.habit_name === 'training');
  assert.ok(habit, 'a kept routine becomes a habit');
  assert.ok(habit.strength > 0);
  assert.equal(habit.harmful, false);
});

test('discipline builds a deliberate habit and compulsiveness builds a harmful one', () => {
  // Reading different traits for the two cases is the point: a
  // disciplined person keeps a routine AND resists an addiction, and
  // one number cannot say both.
  const disciplined = person({
    behavioral: { Discipline: 100 },
    psychological: { Compulsiveness: 0, Impulsivity: 0 },
  });
  const compulsive = person({
    behavioral: { Discipline: 0 },
    psychological: { Compulsiveness: 100, Impulsivity: 100 },
  });

  const a = behavior.reinforceHabit(engine.WorldState, disciplined.id, 'practice', { amount: 10 });
  const b = behavior.reinforceHabit(engine.WorldState, compulsive.id, 'practice', { amount: 10 });
  assert.ok(a.strength > b.strength, 'discipline drives a deliberate habit');

  const c = behavior.reinforceHabit(engine.WorldState, disciplined.id, 'gambling', { amount: 10, harmful: true });
  const d = behavior.reinforceHabit(engine.WorldState, compulsive.id, 'gambling', { amount: 10, harmful: true });
  assert.ok(d.strength > c.strength, 'compulsiveness drives a harmful one');
});

test('a habit nobody keeps up fades', () => {
  const p = person();
  const habit = behavior.reinforceHabit(engine.WorldState, p.id, 'whittling', { amount: 40 });
  const before = habit.strength;
  for (let i = 0; i < 4; i += 1) engine.advanceTick();
  assert.ok(habit.strength < before, `${habit.strength} should be below ${before} after four unkept ticks`);
});

test('a habit is named once and reinforced, not duplicated', () => {
  const p = person();
  behavior.reinforceHabit(engine.WorldState, p.id, 'smoking', { harmful: true, amount: 10 });
  behavior.reinforceHabit(engine.WorldState, p.id, 'smoking', { harmful: true, amount: 10 });
  const rows = behavior.listHabits(engine.WorldState, p.id).filter((h) => h.habit_name === 'smoking');
  assert.equal(rows.length, 1, 'one habit, reinforced twice — not two habits');
  assert.equal(rows[0].first_observed_tick <= rows[0].last_reinforced_tick, true);
});

test('a habit needs a name and a real entity', () => {
  const p = person();
  assert.throws(() => behavior.reinforceHabit(engine.WorldState, 999999, 'x'), /no entity/);
  assert.throws(() => behavior.reinforceHabit(engine.WorldState, p.id, ''), /needs a name/);
});

test('habit strength stays inside its bounds', () => {
  const p = person();
  const h = behavior.reinforceHabit(engine.WorldState, p.id, 'obsession', { amount: 10000 });
  assert.equal(h.strength, 100);
});

// ---------------------------------------------------------------------------
// What the world notices — on the crossing, not the condition
// ---------------------------------------------------------------------------

test('an entrenched harmful habit is reported once, not every tick forever', () => {
  // Two failures guarded at once.
  //
  // The first: a habit sitting at 100 satisfies "entrenched" on every
  // tick, and reporting it each time buries the tick it actually
  // happened on under however many identical rows follow.
  //
  // The second, which the first version of this file actually had: the
  // crossing was derived from a before/after snapshot taken inside the
  // tick's own pass, so a habit pushed over the line by a Key resolver
  // or an API call BETWEEN ticks was never reported at all — silencing
  // exactly the interesting case. The crossing is now noticed where
  // strength rises and queued for the next tick to drain.
  const p = person({ psychological: { Compulsiveness: 100, Impulsivity: 100 } });
  behavior.reinforceHabit(engine.WorldState, p.id, 'the bottle', { harmful: true, amount: 100 });

  const perTick = [];
  for (let i = 0; i < 6; i += 1) {
    perTick.push(engine.advanceTick().events
      .filter((e) => e.type === 'habit_entrenched' && e.affected_entity_ids.includes(p.id)).length);
  }
  assert.deepEqual(perTick, [1, 0, 0, 0, 0, 0],
    'reported on the first tick after it crossed, and never again while it sits there');

  // And one that crosses mid-run is reported exactly once, on the tick
  // that follows the crossing.
  const q = person({ psychological: { Compulsiveness: 100, Impulsivity: 100 } });
  behavior.reinforceHabit(engine.WorldState, q.id, 'the tables', { harmful: true, amount: 20 });
  let crossings = 0;
  for (let i = 0; i < 8; i += 1) {
    behavior.reinforceHabit(engine.WorldState, q.id, 'the tables', { harmful: true, amount: 10 });
    crossings += engine.advanceTick().events
      .filter((e) => e.type === 'habit_entrenched' && e.affected_entity_ids.includes(q.id)).length;
  }
  assert.equal(crossings, 1, 'reported when it became entrenched, and only then');
});

test('a harmless habit is never reported as entrenched however strong', () => {
  const p = person();
  behavior.reinforceHabit(engine.WorldState, p.id, 'reading', { amount: 100 });
  const events = engine.advanceTick().events
    .filter((e) => e.type === 'habit_entrenched' && e.affected_entity_ids.includes(p.id));
  assert.deepEqual(events, [], 'a strong good habit is not a crisis');
});

test('entering crisis is reported once, and recovery re-arms it', () => {
  const p = person({ emotional: { Resilience: 50, Volatility: 50, Optimism: 50 } });
  behavior.applyStress(engine.WorldState, p.id, 100);

  const perTick = [];
  for (let i = 0; i < 3; i += 1) {
    perTick.push(engine.advanceTick().events
      .filter((e) => e.type === 'entity_in_crisis' && e.affected_entity_ids.includes(p.id)).length);
  }
  assert.deepEqual(perTick, [1, 0, 0],
    'reported when they went under, not on every tick they stay under');

  // Recovery re-arms it: somebody who came back and then broke down
  // again is a second event, not a continuation of the first.
  behavior.applyStress(engine.WorldState, p.id, -100);
  engine.advanceTick();
  behavior.applyStress(engine.WorldState, p.id, 100);
  const again = engine.advanceTick().events
    .filter((e) => e.type === 'entity_in_crisis' && e.affected_entity_ids.includes(p.id));
  assert.equal(again.length, 1, 'crossing back into crisis is a new event');
});

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

test('stress comes down on its own over time', () => {
  // A stress level that only ever rises is a counter, not a state.
  const p = person({ emotional: { Resilience: 50, Volatility: 50, Optimism: 50 } });
  behavior.applyStress(engine.WorldState, p.id, 60);
  const before = behavior.getEntityState(engine.WorldState, p.id).stressLevel;
  engine.advanceTick();
  const after = behavior.getEntityState(engine.WorldState, p.id).stressLevel;
  assert.ok(after < before, `${after} should be below ${before} after a tick of recovery`);
});

test('a resilient, well-rested person recovers faster than a fragile sleepless one', () => {
  const rested = person({
    emotional: { Resilience: 100, Volatility: 50, Optimism: 50 },
    health: { 'Sleep Quality': 100 },
  });
  const wrecked = person({
    emotional: { Resilience: 0, Volatility: 50, Optimism: 50 },
    health: { 'Sleep Quality': 0 },
  });
  // Set both to the same starting point rather than applying the same
  // load, since Resilience also damps the load itself.
  behavior.applyStress(engine.WorldState, rested.id, 60);
  behavior.applyStress(engine.WorldState, wrecked.id, 60);
  const rowA = engine.WorldState.entityState.find((s) => s.entity_id === rested.id);
  const rowB = engine.WorldState.entityState.find((s) => s.entity_id === wrecked.id);
  rowA.stress_level = 80;
  rowB.stress_level = 80;

  engine.advanceTick();
  assert.ok(rowA.stress_level < rowB.stress_level,
    `rested ${rowA.stress_level} should be below wrecked ${rowB.stress_level}`);
});

test('behavior runs inside the tick, not as a twelfth phase', () => {
  // The pipeline is locked at eleven. Behavior is a cross-cutting layer
  // in the same slot as flows: its output joins the candidate events.
  const tickSource = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'server', 'tick.js'), 'utf8',
  );
  assert.match(tickSource, /behavior\.runBehavior\(worldState\)/);
  // And it must come after the Decision phase, so stress modulates the
  // NEXT tick rather than the one it was computed from.
  assert.ok(
    tickSource.indexOf('runDecisionPhase(worldState)')
      < tickSource.lastIndexOf('behavior.runBehavior(worldState)'),
    'behavior must run after Decision, or stress feeds the phase that produced it',
  );
});

test('what the world notices about a citizen reaches that citizen\'s dashboard', () => {
  // The reason the emitted shape matters. `runEventPhase` copies
  // `affected_entity_ids` and drops every other field, and
  // `players.js` filters the dashboard's recent events by exactly that
  // array -- so an observation naming its subject any other way becomes
  // an event about nobody. The first version of this file used
  // `entityId` and produced precisely that: real events, correctly
  // timed, attached to no one, invisible to the only person they were
  // about.
  // Traits fixed, not rolled. The first version of this test used a
  // raw generateNPC() and passed or failed on the dice: loadMultiplier
  // bottoms out at 0.25 for a resilient, non-volatile person, so a
  // stress of 100 can land at 25 and never reach crisis at all. It went
  // green eleven times and red on the twelfth. A test whose subject is
  // randomly generated is not testing what it says it is.
  const npc = person({ emotional: { Resilience: 50, Volatility: 50, Optimism: 50 } });
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  engine.applyStress(npc.id, 100);
  engine.advanceTick();

  const dash = engine.getCitizenDashboard(player.id);
  const mine = dash.recentEvents.filter((e) => e.type === 'entity_in_crisis');
  assert.equal(mine.length, 1, 'the citizen can see that they went under');
  assert.ok(mine[0].affected_entity_ids.includes(npc.id));
});

test('the engine exposes behavior bound to its own WorldState', () => {
  const p = engine.generateNPC();
  assert.equal(engine.getEntityState(p.id), null);
  engine.applyStress(p.id, 25);
  assert.ok(engine.getEntityState(p.id).stressLevel > 0);
  engine.addScheduleEvent(p.id, { eventType: 'rounds', frequency: 'daily' });
  assert.equal(engine.listScheduleEvents(p.id).length, 1);
  engine.reinforceHabit(p.id, 'pacing');
  assert.equal(engine.listHabits(p.id).length, 1);
  assert.ok(engine.describeBehavior(p.id).state.currentMood);
  // runBehavior is deliberately NOT re-exported: advancing behavior
  // without advancing the tick would age somebody's habits outside time.
  assert.equal(engine.runBehavior, undefined);
});
