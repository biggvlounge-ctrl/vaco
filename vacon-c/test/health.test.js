// A population's health, and the one reading that was taken back out.
//
// The `health` trait family — Immune Response, Nutrition Status,
// Chronic Conditions, Sleep Quality — has been generated on every NPC
// since traits existed and had exactly one reader in the whole engine:
// `mortality.vitalityOf`, which folds all four into a single multiplier
// on the chance of dying. Nothing could report any of it.
//
// **Three defects came out of building this, and all three were found
// by measuring a running world rather than by a failing assertion.**
// Every one of them is pinned below, because every one of them left the
// code looking correct.
//
//   1. **A temporary condition with a permanent effect.** Every delta a
//      condition applied to a resource was permanent, and every delta in
//      this engine is negative. So `resources.supply` was a one-way
//      ratchet with nothing anywhere raising it: city 1's food went
//      107 → 0 over 200 ticks while demand climbed 101 → 141. Every
//      world this engine had ever run ended in total famine, and the
//      suite was green throughout, because a fixture runs ten ticks and
//      the slope does not show.
//   2. **Scarcity that forgot which city it was in.** `motivation`'s
//      availability map was keyed on resource type alone, so the last
//      food row in the array decided how well fed every person in the
//      world was. Measured: 127 people, two cities, one starving and
//      one comfortable, all 127 reading the same level to the decimal.
//      The identical defect had already been found and fixed one layer
//      down, in `tick.js`'s condition applier, when weather started
//      producing city-scoped droughts.
//   3. **A habit clamped out of its own satisfier.** The food need took
//      `min(eat habit, availability)`. The habit runs 0.54..0.81 and
//      availability sits near 0.50, so the minimum was availability for
//      essentially everybody — the twelfth standing rule's second
//      clause, a computed field above a spread of its own source.
//
// And one statistic that was built, measured and declared absent
// instead: see the `body_composition` section at the end.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const health = require('../server/health.js');
const traits = require('../server/traits.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const economy = require('../server/economy.js');
const motivation = require('../server/motivation.js');
const statistics = require('../server/statistics.js');
const tick = require('../server/tick.js');

// -- the vocabulary is the engine's own -----------------------------------

test('every name this module reads is a real trait', () => {
  // A renamed trait would make `meanHealthTrait` return null forever
  // and nothing would throw — standing rule 6 in the place it is
  // easiest to hit.
  for (const name of health.HEALTH_TRAITS) {
    assert.ok(traits.TRAIT_FAMILIES.health.includes(name),
      `"${name}" is not a health trait`);
  }
  assert.equal(health.HEALTH_TRAITS.length, traits.TRAIT_FAMILIES.health.length,
    'the health family has traits this module does not read');

  assert.throws(() => health.healthValues({}, [], 'Vibes'), /is not a health trait/);
});

// -- defect 1: a condition that ends gives back what it took --------------

test('a condition restores what it took when it expires', () => {
  const w = {
    tick: 0,
    resources: [{ id: 1, city_id: 1, resource_type: 'water', supply: 100, demand: 50 }],
    activeConditions: [],
    properties: [],
  };
  tick.addEnvironmentalCondition(w, {
    conditionType: 'weather', name: 'drought', resourceType: 'water',
    supplyDelta: -3, demandDelta: 2, ticksRemaining: 4, cityId: 1,
  });

  for (let t = 1; t <= 3; t += 1) {
    w.tick = t;
    tick.runEnvironmentPhase(w);
  }
  assert.ok(w.resources[0].supply < 100, 'the drought did nothing while it ran');
  assert.ok(w.resources[0].demand > 50);

  w.tick = 4;
  tick.runEnvironmentPhase(w);
  assert.equal(w.activeConditions.length, 0, 'the drought did not expire');
  assert.equal(w.resources[0].supply, 100, 'the drought left a permanent hole in the supply');
  assert.equal(w.resources[0].demand, 50, 'the drought left the demand permanently raised');
});

test('it gives back what it took, not what it asked for', () => {
  // **The clamp is the whole reason this is a ledger and not a
  // subtraction.** A condition draining a nearly-empty resource takes
  // less than its delta says, and handing back the delta would create
  // supply out of a famine.
  const w = {
    tick: 0,
    resources: [{ id: 1, city_id: 1, resource_type: 'food', supply: 4, demand: 0 }],
    activeConditions: [],
    properties: [],
  };
  tick.addEnvironmentalCondition(w, {
    conditionType: 'weather', name: 'freeze', resourceType: 'food',
    supplyDelta: -3, demandDelta: 0, ticksRemaining: 3,
  });

  for (let t = 1; t <= 3; t += 1) {
    w.tick = t;
    tick.runEnvironmentPhase(w);
  }
  assert.equal(w.resources[0].supply, 4,
    'the freeze took 4 (clamped at zero) and gave back 9, inventing 5 units of food');
});

test('unknown is not average', () => {
  // A population nobody has generated traits for is unmeasured. Every
  // one of these returning a plausible mid-scale number is the failure
  // mode this engine has hit repeatedly.
  const empty = { npcs: [], habits: [], entityTraits: [], needs: [] };
  const strangers = [{ id: 90001 }, { id: 90002 }];
  assert.equal(health.meanHealthTrait(empty, strangers, 'Sleep Quality'), null);
  assert.equal(health.chronicConditionShare(empty, strangers), null);
  assert.equal(health.meanAthleticism(empty, strangers), null);
  assert.equal(health.meanExertion(empty, strangers), null);
  assert.equal(health.harmfulHabitShare(empty, strangers), null);
  assert.equal(health.measuredShare(empty, []), null);
  assert.equal(health.describeHealth(empty, 90001), null);
});

// -- the readings ----------------------------------------------------------
//
// **One long-running world, built once and read by everything below.**
// A tick sweeps every person in the world through eleven phases, so a
// 200-tick world is the expensive thing in this file; building four of
// them put the suite over its own timeout. Node's test runner runs a
// file's tests in order, so the world this builds is the world the
// tests after it read.
//
// **This file generates exactly one world, and that is not a shortcut.**
// `generateWorld` APPENDS to the shared `engine.WorldState` — its own
// header says so, and says why — so a second generation in the same
// process leaves the first world's cities, people and resources in
// place. A test that generated a second world and then read
// `w.communities[0]` would be reading the previous world's community,
// and the two tests at the end of this file, which deliberately drive a
// city into famine, would be poisoning everything measured after them.
// They are last for that reason.
const LONG_RUN = 200;
function buildLongRunWorld() {
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 2, populationPerCommunity: 10, seed: 'body',
  });
  const before = new Map(w.resources.map((r) => [r.id, r.supply]));
  for (let t = 0; t < LONG_RUN; t += 1) engine.advanceTick();
  return { w, before };
}
let longRun = null;

test('a world is not poorer at the end than something happened to it', () => {
  // **The regression that matters.** The defect was invisible to every
  // fixture in this suite because it only shows over hundreds of ticks.
  // So this is measured on a real world, and the assertion is the one
  // that failed before: supply does not trend to zero.
  longRun = buildLongRunWorld();
  const { w, before } = longRun;

  const emptied = w.resources.filter((r) => r.supply === 0);
  assert.deepEqual(emptied.map((r) => `${r.city_id}:${r.resource_type}`), [],
    'a resource was drained to nothing and never recovered');

  // And no essential ended up pinned at maximum scarcity.
  for (const resource of w.resources.filter((r) => r.resource_type === 'food')) {
    assert.ok(economy.getScarcity(resource) < 100,
      `city ${resource.city_id} ended in total famine (supply ${resource.supply}, `
      + `started at ${before.get(resource.id)})`);
  }
});

test('a generated world can say how healthy it is', () => {
  const { w } = longRun ?? (longRun = buildLongRunWorld());
  const profile = statistics.profileFor(w, w.communities[0].id);
  const answered = [
    'mean_nutrition_status', 'mean_sleep_quality', 'mean_immune_response',
    'chronic_condition_rate', 'mean_athleticism', 'mean_physical_exertion',
    'health_measured_share', 'harmful_habit_share', 'mean_need_satisfaction',
    'mean_food_security',
  ];
  for (const key of answered) {
    const cell = profile.statistics[key];
    assert.ok(cell, `${key} is not in the catalogue`);
    assert.equal(cell.known, true, `${key} came back null on a fully generated world`);
  }

  // Indexes are on the schema's own 0..100 scale; shares are 0..1.
  for (const key of answered) {
    const cell = profile.statistics[key];
    const ceiling = cell.unit === 'share' ? 1 : 100;
    assert.ok(cell.value >= 0 && cell.value <= ceiling,
      `${key} = ${cell.value} is outside 0..${ceiling}`);
  }

  // The readings speak for the whole population, or they say so.
  assert.equal(profile.statistics.health_measured_share.value, 1,
    'a generated world has residents with no trait sheet');
});

test('the chronic threshold catches a minority, measured', () => {
  // **Standing rule 12's third clause.** 70 was reused from
  // `archetypes.HIGH` rather than chosen from what a number sounds
  // like, and this is the measurement that says it lands somewhere
  // useful: a real fraction of people carrying something, not nobody
  // and not everybody.
  const { w } = longRun ?? (longRun = buildLongRunWorld());
  const share = health.chronicConditionShare(w, w.npcs);
  assert.ok(share > 0.05 && share < 0.45,
    `${share} of the population carries a chronic condition — the threshold is not `
    + 'separating anybody');
});

test('exertion reads a routine and a body, and neither alone decides it', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 1, communitiesPerCity: 2, populationPerCommunity: 12, seed: 'exert',
  });
  const habits = health.indexHabits(w);
  const worker = w.npcs.find((n) => (habits.get(n.id) ?? []).some((h) => h.habit_name === 'work'));
  const idle = w.npcs.find((n) => !(habits.get(n.id) ?? []).some((h) => h.habit_name === 'work'));
  assert.ok(worker && idle, 'the generated world has nobody on either side of the line');

  assert.ok(health.exertionOf(w, worker.id, habits) > health.exertionOf(w, idle.id, habits),
    'holding a work routine makes no difference to physical exertion');

  // Both halves bounded, both present.
  for (const npc of w.npcs) {
    const value = health.exertionOf(w, npc.id, habits);
    assert.ok(value >= 0 && value <= 1, `exertion ${value} is outside 0..1`);
  }
});

// -- defect 2: scarcity is a fact about a place ---------------------------

test('two cities with different food supply feed their people differently', () => {
  // **Destructive, so it runs after everything that reads.** It drives
  // one of the two cities into famine on purpose, and the world is
  // shared.
  const { w } = longRun ?? (longRun = buildLongRunWorld());

  // One city in plenty, one in famine. Everything else identical.
  for (const resource of w.resources) {
    if (resource.resource_type !== 'food') continue;
    resource.supply = resource.city_id === w.cities[0].id ? 400 : 20;
    resource.demand = 100;
  }
  for (let t = 0; t < 40; t += 1) engine.advanceTick();

  const levelIn = (cityId) => {
    const communities = w.communities.filter((c) => c.city_id === cityId).map((c) => c.id);
    const levels = w.npcs
      .filter((n) => communities.includes(n.communityId))
      .map((n) => motivation.needOf(w, n.id, 'food'))
      .filter((row) => row !== null)
      .map((row) => Number(row.current_level));
    return levels.reduce((a, b) => a + b, 0) / levels.length;
  };

  const fed = levelIn(w.cities[0].id);
  const hungry = levelIn(w.cities[1].id);
  assert.ok(fed > hungry + 10,
    `the well-supplied city read ${fed.toFixed(1)} and the starving one ${hungry.toFixed(1)} — `
    + 'the availability map is keyed on resource type again, so one city feeds the world');
});

// -- defect 3: the habit is live ------------------------------------------

test('whether somebody keeps the routine changes whether they eat', () => {
  const { w } = longRun ?? (longRun = buildLongRunWorld());

  // **Standing rule 8**: the subject is not randomly generated. Two
  // named people from the SAME city — the test above left the two
  // cities with very different food supplies, so picking one from each
  // would be measuring that instead of the habit.
  const first = w.communities.find((c) => c.city_id === w.cities[0].id);
  const [diligent, lax] = w.npcs.filter((n) => n.communityId === first.id);
  assert.ok(diligent && lax, 'the first community has fewer than two residents left');
  for (const [npc, strength] of [[diligent, 95], [lax, 10]]) {
    const habit = (w.habits || []).find((h) => h.entity_id === npc.id && h.habit_name === 'eat');
    assert.ok(habit, 'the generated world gave nobody an eat routine');
    habit.strength = strength;
  }
  for (let t = 0; t < 40; t += 1) engine.advanceTick();

  const levelOf = (npc) => Number(motivation.needOf(w, npc.id, 'food').current_level);
  assert.ok(levelOf(diligent) > levelOf(lax),
    `both read ${levelOf(diligent)} — the eat habit is clamped out of its own satisfier`);
});

// -- what is deliberately NOT here ----------------------------------------

test('body composition is a declared gap, and the declaration says what would close it', () => {
  // **Built, measured, taken back out.** The index it produced tracked
  // employment: 50 of 127 people hold a `work` routine, the intake side
  // is a city average, and the obese band held nobody in any world
  // measured. §9 permits demographic modelling and forbids demographics
  // deciding an NPC's worth — a body reading that is really a jobs
  // reading is on the wrong side of that before anybody uses it.
  const declared = statistics.unavailable().find((e) => e.key === 'body_composition');
  assert.ok(declared, 'body_composition was quietly made answerable');
  assert.match(declared.reason, /per-person consumption record/,
    'the declaration does not say what would close it');

  // And the module does not carry the removed machinery under another
  // name — a `bodyConditionOf` sitting exported and uncalled is exactly
  // the state the eleventh standing rule is about.
  for (const gone of ['bodyConditionOf', 'bodyBandOf', 'bandShareOf', 'OBESE', 'OVERWEIGHT']) {
    assert.equal(health[gone], undefined,
      `health.${gone} still exists, so the declared gap has a computed answer after all`);
  }
});

test('the athleticism caveat says what is true now, not what used to be', () => {
  // **This test used to assert that nothing ever held a contest, and it
  // was right.** `contest.js` was a complete, tested, deterministic
  // resolver and `grep -n contest server/tick.js` returned two matches,
  // both the word "contested" about territory blocks.
  // `server/competition.js` is the occasion, so the old caveat is false
  // and the new one has to be the honest replacement rather than no
  // caveat at all: games happen, competing does grow the traits, and
  // the drift is a fraction of a point a year.
  const definition = statistics.CATALOGUE.find((s) => s.key === 'mean_athleticism');
  assert.equal(/never\s+calls/.test(definition.caveat), false,
    'the caveat still says the tick never runs a contest');
  assert.match(definition.caveat, /48\.92 to 49\.10/,
    'the caveat should carry the measurement rather than a claim about it');

  // And the readings of what a settlement DOES, beside the reading of
  // what it is capable of.
  assert.ok(statistics.KEYS.includes('contests_per_1k'));
  assert.ok(statistics.KEYS.includes('competitor_share'));
});
