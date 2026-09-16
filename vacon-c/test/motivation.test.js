// What somebody wants.
//
// **Three tables defined in the schema with no array and no code.**
// `needs`, `values_db` and `goals` measured as "no store" against a
// built world — the engine could say what a person was capable of, what
// they had done and who they knew, and nothing about what they were
// trying to get.
//
// §4.5 is why this is one module rather than three: "Motivation Engine
// = Value System DNA restated (don't duplicate)". And every vocabulary
// is the package's own — the 15 values are
// `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`'s list, the 15 need types and
// 7 timeframes are the schema's own column comments — so the tests
// below check the code against those lists rather than against a
// second copy written here.
//
// Two model errors shaped this file, both found by measuring a real
// world rather than by a failing assertion:
//
//   1. **A need with no possible satisfier.** The first version fed a
//      handful of needs from habits and let the rest decay. Water sat
//      at 0.0 on every person alive, because nothing anywhere looked at
//      the water resource — and each starving need opened a goal that
//      could never close, 2.1 of them per person.
//   2. **An equilibrium nobody could reach.** The second version moved
//      a need by `rate * (supply * 1.25 - 1)`, which holds steady only
//      at supply ≥ 0.8. Habit strength settles near 0.70 BY DESIGN, so
//      food and sleep read 0.0 across the population while the routine
//      feeding them was kept every single day.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const motivation = require('../server/motivation.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_POSTGRESQL_SCHEMA.sql'), 'utf8',
);

let nextId = 600000;

function world(extra = {}) {
  const w = {
    tick: 10,
    npcs: [],
    organizations: [],
    families: [],
    entityTraits: [],
    needs: [],
    valuesDb: [],
    goals: [],
    habits: [],
    relationships: [],
    employmentRecords: [],
    familyMemberships: [],
    historicalRecords: [],
    resources: [],
    communities: [],
    cities: [],
    infrastructure: [],
    crimeIncidents: [],
    individualFinances: [],
    ...extra,
  };
  motivation.reseedIds(w);
  return w;
}

function person(w, extra = {}) {
  const id = nextId += 1;
  w.npcs.push({ id, status: 'active', traits: {}, createdTick: 0, ...extra });
  return id;
}

// -- the vocabularies are the document's --------------------------------

test('every value, need type and timeframe comes from the schema', () => {
  // **The check that matters for a module built from enumerations.**
  // Each of these three lists exists in the schema as a column comment,
  // so a list that drifted from it would be this module inventing a
  // vocabulary while claiming not to.
  for (const value of motivation.VALUES) {
    assert.ok(SCHEMA.includes(value), `values_db has no "${value}" in its enumeration`);
  }
  for (const need of motivation.NEED_TYPES) {
    assert.ok(SCHEMA.includes(need), `needs has no "${need}" in its enumeration`);
  }
  for (const timeframe of motivation.TIMEFRAMES) {
    assert.ok(SCHEMA.includes(timeframe), `goals has no "${timeframe}" in its enumeration`);
  }
  assert.equal(motivation.VALUES.length, 15);
  assert.equal(motivation.NEED_TYPES.length, 15);
  assert.equal(motivation.TIMEFRAMES.length, 7);
});

test('every value has a display label, and every need a satisfier entry', () => {
  // A value with no label, or a need with no entry in SATISFIERS, would
  // be silently skipped forever — standing rule 6's shape.
  for (const value of motivation.VALUES) {
    assert.ok(motivation.VALUE_LABELS[value], `${value} has no label`);
  }
  for (const need of motivation.NEED_TYPES) {
    assert.ok(need in motivation.SATISFIERS,
      `${need} has no satisfier — it would deplete forever with nothing able to meet it`);
  }
});

// -- values --------------------------------------------------------------

test('a person gets one row per value, ranked by what they care about', () => {
  const w = world();
  const id = person(w);
  const strengths = { power: 90, peace: 10 };
  motivation.generateValues(w, id, { strengthFor: (name) => strengths[name] ?? 50 });

  assert.equal(motivation.valuesOf(w, id).length, 15);
  assert.equal(motivation.topValue(w, id).value_name, 'power');
  assert.equal(motivation.valueOf(w, id, 'power').priority, 1);
  assert.equal(motivation.valueOf(w, id, 'peace').priority, 15);

  // What somebody cares most about weighs most on a decision.
  assert.ok(motivation.valueOf(w, id, 'power').influence_weight
    > motivation.valueOf(w, id, 'peace').influence_weight);
});

test('generating twice does not give somebody two sets of values', () => {
  // The primary key is (entity_id, value_name); duplicating it would be
  // two answers to one question.
  const w = world();
  const id = person(w);
  motivation.generateValues(w, id);
  motivation.generateValues(w, id);
  assert.equal(motivation.valuesOf(w, id).length, 15);
});

test('a value drifts toward a life, and never past it', () => {
  const row = {
    entity_id: 1, value_name: 'security', current_strength: 20, change_rate: 0.2,
  };
  for (let t = 0; t < 200; t += 1) motivation.driftValue(row, 80);
  assert.ok(row.current_strength > 20, 'a value never moved');
  assert.ok(row.current_strength <= 80.0001,
    `drifted past the target to ${row.current_strength}`);
});

test('nobody who was given no values has a top value', () => {
  // Unknown is not "family first".
  const w = world();
  const id = person(w);
  assert.equal(motivation.topValue(w, id), null);

  // Described, but with nulls rather than invented defaults — the
  // difference between "values nothing recorded" and "values family
  // most" is the whole point of returning null.
  const described = motivation.describeMotivation(w, id);
  assert.equal(described.values, null);
  assert.equal(described.needs, null);
  assert.equal(described.caresMostAbout, null);
  assert.equal(motivation.describeMotivation(w, 999999), null, 'no entity, no description');
});

// -- needs ---------------------------------------------------------------

test('a need starts unsatisfied-by-nobody rather than satisfied now', () => {
  // `last_satisfied_tick` null says "nobody has met this yet"; stamping
  // it at generation would claim somebody had.
  const w = world();
  const id = person(w);
  motivation.generateNeeds(w, id);
  assert.equal(motivation.needsOf(w, id).length, 15);
  for (const row of motivation.needsOf(w, id)) {
    assert.equal(row.last_satisfied_tick, null);
  }
});

test('priority runs from the physical to the existential', () => {
  // Taken from the position in NEED_TYPES rather than a second list
  // that could disagree with the first.
  assert.ok(motivation.defaultPriority('food') < motivation.defaultPriority('legacy'));
  assert.equal(motivation.defaultPriority('food'), 1);
  assert.equal(motivation.defaultPriority('not-a-need'), motivation.NEED_TYPES.length);
});

test('satisfying a need stamps the tick only when something moved', () => {
  const w = world();
  const id = person(w);
  motivation.generateNeeds(w, id, { levelFor: () => 100 });

  // Already full: nothing moves, so nothing is claimed to have happened.
  motivation.satisfyNeed(w, id, 'food', { amount: 10, tick: 55 });
  assert.equal(motivation.needOf(w, id, 'food').last_satisfied_tick, null);

  motivation.needOf(w, id, 'food').current_level = 20;
  motivation.satisfyNeed(w, id, 'food', { amount: 10, tick: 55 });
  assert.equal(motivation.needOf(w, id, 'food').last_satisfied_tick, 55);
});

test('the most pressing need weighs how unmet it is against its priority', () => {
  const w = world();
  const id = person(w);
  motivation.generateNeeds(w, id, { levelFor: (n) => (n === 'food' ? 10 : 90) });
  assert.equal(motivation.mostPressing(w, id).need_type, 'food');

  // Nobody with no needs recorded gets a made-up one.
  assert.equal(motivation.mostPressing(w, person(w)), null);
});

// -- the model errors, pinned --------------------------------------------

test('a fully supplied need settles high, not at break-even', () => {
  // **Model error 2.** A need converges on `supply * 100`, so a routine
  // kept at 0.7 settles near 70 rather than collapsing to zero.
  const w = world();
  const id = person(w, { home_property_id: null, communityId: null });
  motivation.generateNeeds(w, id, { levelFor: () => 50 });
  w.habits.push({ entity_id: id, habit_name: 'rest', strength: 70, harmful: false });

  for (let t = 0; t < 400; t += 1) motivation.runMotivation(w, { tick: w.tick + t });

  const sleep = motivation.needOf(w, id, 'sleep').current_level;
  assert.ok(sleep > 60 && sleep < 80,
    `a routine kept at 70 settled sleep at ${sleep}, not near 70`);
});

test('a need nothing can supply falls, and one nothing models holds', () => {
  // **Model error 1**, both halves. `water` with no water in the world
  // falls to nothing — that is a real hardship. `freedom` has no
  // substrate in this engine at all, and holds where it started rather
  // than decaying to zero and dragging every population reading down.
  const w = world();
  const id = person(w);
  motivation.generateNeeds(w, id, { levelFor: () => 60 });

  for (let t = 0; t < 400; t += 1) motivation.runMotivation(w, { tick: w.tick + t });

  // A world that tracks no water at all HOLDS the need — unknown is
  // not "no water", and reading an untracked resource as perfect supply
  // is the bug this pins: the first version reported everybody watered
  // in a world with no water in it.
  assert.equal(motivation.needOf(w, id, 'water').current_level, 60,
    'an untracked resource moved the need it supplies');

  // A world that DOES track water and has none is a real drought.
  const dry = world({ resources: [{ resource_type: 'water', supply: 0, demand: 100 }] });
  const thirsty = person(dry);
  motivation.generateNeeds(dry, thirsty, { levelFor: () => 60 });
  for (let t = 0; t < 400; t += 1) motivation.runMotivation(dry, { tick: dry.tick + t });
  assert.equal(motivation.needOf(dry, thirsty, 'water').current_level, 0,
    'a settlement with no water left somebody watered');
  assert.equal(motivation.needOf(w, id, 'freedom').current_level, 60,
    'freedom is a declared absence and must hold, not decay');
  assert.equal(motivation.SATISFIERS.freedom(), null,
    'freedom claims a satisfier — this engine models no such thing');
});

// -- goals ---------------------------------------------------------------

test('a goal needs an entity, a description and a real timeframe', () => {
  const w = world();
  assert.throws(() => motivation.addGoal(w, { description: 'x', timeframe: 'daily' }),
    /requires an entityId/);
  assert.throws(() => motivation.addGoal(w, { entityId: 1, timeframe: 'daily' }),
    /requires a description/);
  assert.throws(() => motivation.addGoal(w, { entityId: 1, description: 'x', timeframe: 'soon' }),
    /is not a timeframe/);
});

test('a goal about a fast need is immediate and one about legacy is generational', () => {
  // The two enumerations lined up against each other rather than a
  // third hand-written mapping.
  assert.equal(motivation.timeframeFor('food'), 'immediate');
  assert.equal(motivation.timeframeFor('income'), 'monthly');
  assert.equal(motivation.timeframeFor('legacy'), 'generational');
  for (const need of motivation.NEED_TYPES) {
    assert.ok(motivation.TIMEFRAMES.includes(motivation.timeframeFor(need)),
      `${need} maps to a timeframe the schema does not have`);
  }
});

test('one goal per need, however long somebody goes wanting', () => {
  // **The seventh standing rule.** A goal opened on a condition rather
  // than a crossing would give somebody hungry for a hundred ticks a
  // hundred identical goals.
  const w = world();
  const id = person(w);
  motivation.generateValues(w, id);
  motivation.generateNeeds(w, id, { levelFor: () => 5 });

  for (let t = 0; t < 100; t += 1) motivation.runMotivation(w, { tick: w.tick + t });

  const byNeed = new Map();
  for (const goal of motivation.goalsOf(w, id, { status: 'active' })) {
    byNeed.set(goal.about_need, (byNeed.get(goal.about_need) ?? 0) + 1);
  }
  for (const [need, count] of byNeed) {
    assert.equal(count, 1, `${count} open goals about ${need}`);
  }
});

test('a goal closes when the need it is about is met', () => {
  const w = world();
  const id = person(w);
  motivation.generateValues(w, id);
  motivation.generateNeeds(w, id, { levelFor: () => 5 });
  motivation.runMotivation(w, { tick: w.tick });

  const goal = motivation.goalsOf(w, id, { status: 'active' })[0];
  assert.ok(goal, 'a starving person formed no goal at all');

  motivation.needOf(w, id, goal.about_need).current_level = 99;
  const events = motivation.runMotivation(w, { tick: w.tick + 1 });

  assert.equal(motivation.goalsOf(w, id).find((g) => g.id === goal.id).status, 'met');
  assert.ok(events.some((e) => e.type === 'goal_met'), 'nothing in the world noticed');
});

test('a goal names what it is for, and can be refused a bad status', () => {
  const w = world();
  const id = person(w);
  const goal = motivation.addGoal(w, {
    entityId: id, description: 'secure food', timeframe: 'immediate',
  });
  assert.equal(goal.status, 'active');
  assert.equal(goal.resolved_tick, null);

  assert.throws(() => motivation.resolveGoal(w, goal.id, 'finished'), /is not a status/);
  assert.throws(() => motivation.resolveGoal(w, 99999, 'met'), /no goal 99999/);

  motivation.resolveGoal(w, goal.id, 'abandoned', 77);
  assert.equal(goal.status, 'abandoned');
  assert.equal(goal.resolved_tick, 77);
});

// -- the real pipeline ---------------------------------------------------

test('a running world wants things, and gets some of them', () => {
  // Standing rule 6's shape: everything above builds its own world.
  // This runs the real one and looks at what came out — which is how
  // both model errors were found in the first place.
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 15, seed: 'want' });
  assert.ok(w.needs.length > 0, 'a generated world has nobody wanting anything');
  assert.ok(w.valuesDb.length > 0, 'a generated world has nobody valuing anything');

  for (let t = 0; t < 120; t += 1) engine.advanceTick();

  assert.ok(w.goals.length > 0, 'a world ran for 120 ticks and nobody wanted anything');
  assert.ok(w.goals.some((g) => g.status === 'met'),
    'every goal ever formed is still open — nothing can close one');

  // And no need is pinned at either end across the whole population,
  // which is what "the level IS how well it is supplied" should produce.
  const levels = new Map();
  for (const row of w.needs) {
    const list = levels.get(row.need_type) ?? [];
    list.push(Number(row.current_level));
    levels.set(row.need_type, list);
  }
  const means = [...levels.entries()].map(([need, list]) => [
    need, list.reduce((a, b) => a + b, 0) / list.length,
  ]);
  const spread = new Set(means.map(([, mean]) => Math.round(mean / 10)));
  assert.ok(spread.size > 2,
    `every need in the world sits in the same band: ${means.map(([n, m]) => `${n} ${m.toFixed(0)}`).join(', ')}`);
});

test('the world can say why somebody is doing anything', () => {
  const w = engine.WorldState;
  const npc = w.npcs[0];
  const described = motivation.describeMotivation(w, npc.id);

  assert.equal(described.entityId, npc.id);
  assert.ok(described.caresMostAbout, 'nobody in a generated world cares about anything');
  assert.ok(Array.isArray(described.values) && described.values.length === 3);
  assert.ok(described.needs.mostPressing);
  assert.ok(Array.isArray(described.pursuing));
});

test('ids survive a reseed', () => {
  const w = world();
  w.goals.push({ id: 40, entity_id: 1, status: 'active' });
  assert.deepEqual(motivation.reseedIds(w), { nextGoalId: 41 });
  assert.equal(
    motivation.addGoal(w, { entityId: 1, description: 'x', timeframe: 'daily' }).id, 41,
  );
});
