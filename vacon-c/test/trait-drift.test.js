// Whether a person can change.
//
// **Measured, and the answer was no.** Over 200 ticks of a real world,
// across 17,358 `entity_traits` rows, six of the seven contributing
// columns never moved at all — only Key resolvers wrote anything, to
// their own column, on 2.3% of rows. A forty-year-old who had spent
// every tick working was, trait for trait, the person they were born
// as. And `trait_definitions.growth_rate`/`decay_rate` had been on
// every row since the schema was written, applied by nothing.
//
// The tests below are shaped by the three ways this went wrong while
// being built, because each one leaves working-looking code that does
// nothing:
//
//   1. **An invented citation.** Eleven of the trait names first
//      written here did not exist — `skills.Work Ethic`,
//      `social.Cooperation`, a whole `cognitive` family. Every one
//      would have silently exercised nothing forever. Standing rule 6.
//   2. **A step below the stored resolution.** Drift rounded to two
//      decimals while `environmental_modifier` moved 0.004 per tick, so
//      it rounded to zero every single tick and the column never
//      changed. A per-tick step smaller than the resolution of the
//      field it writes is no effect at all.
//   3. **An uncentred driver.** The twelfth standing rule: an ordinary
//      person in an ordinary place must not drift, or reading a trait
//      recalibrates the whole world.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const drift = require('../server/traitDrift.js');
const behavior = require('../server/behavior.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const { TRAIT_FAMILIES } = require('../server/traits.js');
const { INDIVIDUAL_DEFINITIONS, getDefinition } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 700000;

function world(extra = {}) {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    families: [],
    entityTraits: [],
    habits: [],
    relationships: [],
    entityState: [],
    communities: [],
    ...extra,
  };
}

function person(w, value = 50, extra = {}) {
  const id = nextId += 1;
  w.entityTraits.push(...generateEntityTraits(
    id, w.tick, INDIVIDUAL_DEFINITIONS, () => value,
  ));
  w.npcs.push({ id, status: 'active', traits: {}, createdTick: 0, ...extra });
  return id;
}

function valueOf(w, entityId, family, name) {
  const row = w.entityTraits.find((r) => {
    const def = getDefinition(r.trait_id);
    return r.entity_id === entityId && def && def.family === family && def.name === name;
  });
  return row ?? null;
}

// -- citations ----------------------------------------------------------

test('every trait this module says it exercises actually exists', () => {
  // **The test that caught eleven invented names**, and the reason the
  // mapping is a table rather than string literals at the call sites.
  // A trait that does not exist is not an error anywhere — the lookup
  // returns null, the drift is skipped, and the mechanism quietly does
  // nothing for the life of the project.
  const cited = [];
  for (const targets of Object.values(drift.EXERCISES)) {
    for (const [family, name] of targets) cited.push([family, name, 'EXERCISES']);
  }
  for (const effect of drift.ENVIRONMENT_EFFECTS) {
    for (const [family, name] of effect.traits) cited.push([family, name, effect.name]);
  }
  for (const [family, name] of drift.CONTAGIOUS) cited.push([family, name, 'CONTAGIOUS']);
  for (const [family, name] of drift.STRAIN_DEPRESSES) {
    cited.push([family, name, 'STRAIN_DEPRESSES']);
  }

  const bad = cited.filter(([family, name]) => !(TRAIT_FAMILIES[family] || []).includes(name));
  assert.deepEqual(bad, [], `invented trait citations: ${bad.map((b) => b.join('.')).join(', ')}`);
  assert.ok(cited.length > 15, 'the mapping shrank — is a whole source of change gone?');
});

test('every habit a routine can seed is exercised by something', () => {
  // The other direction: a routine that grows nothing is a calendar
  // entry, not a life.
  for (const eventType of Object.keys(behavior.SLOT_FOR_EVENT)) {
    assert.ok(drift.EXERCISES[eventType],
      `\`${eventType}\` is a routine the world seeds and it exercises nothing`);
  }
  assert.ok(drift.EXERCISES[behavior.HARMFUL_HABIT],
    'the harmful habit the world forms exercises nothing, so it costs nobody anything');
});

// -- resolution ---------------------------------------------------------

test('a drift smaller than a hundredth of a point still accumulates', () => {
  // **Shape 2, pinned.** The first version rounded to two decimals and
  // `environmental_modifier` moved 0.004 per tick, so every tick
  // rounded to zero, the lost fraction was never carried, and a
  // mechanism running on every person every tick measured as one
  // nobody had written.
  const w = world({ communities: [{ id: 1, city_id: 1 }] });
  const id = person(w, 50, { communityId: 1 });

  const before = valueOf(w, id, 'emotional', 'Optimism').environmental_modifier;
  for (let t = 0; t < 10; t += 1) {
    drift.driftEnvironment(w, id, w.tick + t, { scarcity: 1, danger: 0, decay: 0 });
  }
  const after = valueOf(w, id, 'emotional', 'Optimism').environmental_modifier;
  assert.ok(after < before, `ten ticks of total scarcity moved Optimism from ${before} to ${after}`);
});

// -- centring -----------------------------------------------------------

test('an ordinary person in an ordinary place does not drift', () => {
  // The twelfth standing rule, applied to a whole population at once.
  // A world where everybody's Endurance climbs every tick is not a
  // deeper simulation, it is a broken one.
  const w = world({ communities: [{ id: 1, city_id: 1 }] });
  const id = person(w, 50, { communityId: 1 });
  const snapshot = w.entityTraits
    .filter((r) => r.entity_id === id)
    .map((r) => ({ ...r }));

  for (let t = 0; t < 50; t += 1) {
    drift.runTraitDrift(w, { tick: w.tick + t, scarcity: 0, crimeByCommunity: new Map() });
  }

  for (const before of snapshot) {
    const now = w.entityTraits.find(
      (r) => r.entity_id === id && r.trait_id === before.trait_id,
    );
    assert.equal(now.current_value, before.current_value,
      `${getDefinition(before.trait_id).name} drifted with no habits, no danger and no scarcity`);
  }
});

test('a place better than ordinary drifts people the other way', () => {
  // `decay` is the one two-sided pressure, and it has to work in both
  // directions or "where you live changes you" is only true of
  // disasters.
  const build = (condition) => {
    const w = world({ communities: [{ id: 1, city_id: 1 }] });
    const id = person(w, 50, { communityId: 1 });
    for (let t = 0; t < 40; t += 1) {
      drift.driftEnvironment(w, id, w.tick + t, { scarcity: 0, danger: 0, decay: condition });
    }
    return valueOf(w, id, 'mental', 'Focus').environmental_modifier;
  };
  assert.ok(build(1) < 0, 'a crumbling place did not wear anybody down');
  assert.ok(build(-1) > 0, 'a well-kept place did nothing for anybody');
  assert.equal(build(0), 0, 'an ordinary place moved somebody');
});

// -- what each column is for --------------------------------------------

test('practising a habit grows what it exercises, at the definition rate', () => {
  const w = world();
  const id = person(w, 50);
  w.habits.push({
    entity_id: id, habit_name: 'work', strength: 100, harmful: false,
  });

  for (let t = 0; t < 60; t += 1) drift.driftExperience(w, id, w.tick + t);

  const endurance = valueOf(w, id, 'physical', 'Endurance');
  assert.ok(endurance.experience_modifier > 0,
    'sixty ticks of constant work grew nothing');
  // Grew the column it is supposed to, and no other.
  assert.equal(endurance.environmental_modifier, 0);
  assert.equal(endurance.relationship_modifier, 0);
  assert.equal(endurance.base_value, 50, 'base_value moved — base is what you were born with');
  assert.equal(endurance.current_value, 50 + endurance.experience_modifier);
});

test('what somebody stops doing fades back, and no further', () => {
  const w = world();
  const id = person(w, 50);
  w.habits.push({ entity_id: id, habit_name: 'work', strength: 100, harmful: false });
  for (let t = 0; t < 60; t += 1) drift.driftExperience(w, id, w.tick + t);

  const grown = valueOf(w, id, 'physical', 'Endurance').experience_modifier;
  assert.ok(grown > 0);

  // The habit stops.
  w.habits.length = 0;
  for (let t = 0; t < 1000; t += 1) drift.driftExperience(w, id, w.tick + t);

  const faded = valueOf(w, id, 'physical', 'Endurance').experience_modifier;
  assert.ok(faded < grown, 'an abandoned habit kept its gains forever');
  assert.equal(faded, 0, `decay overshot zero and went to ${faded} — an unused trait `
    + 'should return to where it started, not fall below it');
});

test('a harmful habit costs something, which is what makes it harmful', () => {
  const w = world();
  const id = person(w, 50);
  w.habits.push({
    entity_id: id, habit_name: behavior.HARMFUL_HABIT, strength: 100, harmful: true,
  });
  for (let t = 0; t < 60; t += 1) drift.driftExperience(w, id, w.tick + t);

  assert.ok(valueOf(w, id, 'behavioral', 'Discipline').experience_modifier < 0,
    'the only habit the schema flags as harmful had no cost at all');
});

test('close relations pull somebody toward them, and stop when they match', () => {
  const w = world();
  const quiet = person(w, 20);
  const loud = person(w, 80);
  w.relationships.push({
    entity_a_id: quiet, entity_b_id: loud, trust: 90, relationship_type: 'friend',
  });

  const values = new Map();
  for (const row of w.entityTraits) {
    const def = getDefinition(row.trait_id);
    values.set(`${row.entity_id} ${def.family} ${def.name}`, row.current_value);
  }
  for (let t = 0; t < 100; t += 1) drift.driftRelationships(w, quiet, w.tick + t, values);

  const loyalty = valueOf(w, quiet, 'social', 'Group Loyalty');
  assert.ok(loyalty.relationship_modifier > 0, 'a close friend changed nobody');
  assert.ok(loyalty.current_value < 80,
    `pulled past the person doing the pulling, to ${loyalty.current_value}`);
});

test('acute strain depresses, and recovers on its own', () => {
  const w = world();
  const id = person(w, 50);

  for (let t = 0; t < 30; t += 1) drift.driftTemporary(w, id, w.tick + t, 100);
  const strained = valueOf(w, id, 'mental', 'Focus').temporary_modifier;
  assert.ok(strained < 0, 'a person at maximum stress was unaffected');

  // **Recovers with no expiry column**, which is the whole reason this
  // is `temporary_modifier` and not `permanent_modifier`: the schema
  // offers no expiry field, and a modifier that returns to zero on its
  // own does not need one.
  for (let t = 0; t < 200; t += 1) drift.driftTemporary(w, id, w.tick + t, 0);
  const recovered = valueOf(w, id, 'mental', 'Focus').temporary_modifier;
  assert.ok(Math.abs(recovered) < Math.abs(strained), 'strain never lifted');
  assert.ok(recovered <= 0, 'recovery overshot into a bonus');
});

test('no column can run away over a lifetime', () => {
  // Ceilings, because these apply every tick for eighty years. Without
  // one, `experience_modifier` alone would pin every working adult at
  // the top of the scale and the column would stop carrying
  // information — the exact failure habits.strength had.
  const w = world();
  const id = person(w, 50);
  w.habits.push({ entity_id: id, habit_name: 'work', strength: 100, harmful: false });
  for (let t = 0; t < 20000; t += 1) drift.driftExperience(w, id, w.tick + t);

  const row = valueOf(w, id, 'physical', 'Endurance');
  assert.ok(row.experience_modifier <= drift.DRIFT_CEILING,
    `${row.experience_modifier} exceeds the ceiling of ${drift.DRIFT_CEILING}`);
  assert.ok(row.current_value <= 100, 'current_value left the 0-100 scale');
});

test('current_value is recomputed from every column, not just the one that moved', () => {
  // `entity_traits.current_value` is a plain stored column — Postgres
  // does not maintain it — so anything writing a modifier must
  // recompute or the sum stops matching its parts.
  const row = {
    trait_id: 1, base_value: 40,
    temporary_modifier: -1, permanent_modifier: 2, experience_modifier: 3,
    environmental_modifier: -0.5, relationship_modifier: 1.5, key_modifier: 0,
    current_value: 0,
  };
  drift.recompute(row);
  assert.equal(row.current_value, 45);
});

// -- the real pipeline --------------------------------------------------

test('a world that runs changes the people in it', () => {
  // Standing rule 6's shape. Everything above builds its own world;
  // this runs the real one and looks at what came out.
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 15, seed: 'drift' });
  const before = new Map(w.entityTraits.map((r) => [`${r.entity_id}:${r.trait_id}`, { ...r }]));
  for (let t = 0; t < 120; t += 1) engine.advanceTick();

  const moved = { experience_modifier: 0, environmental_modifier: 0, relationship_modifier: 0 };
  for (const row of w.entityTraits) {
    const was = before.get(`${row.entity_id}:${row.trait_id}`);
    if (!was) continue;
    for (const column of Object.keys(moved)) {
      if (row[column] !== was[column]) moved[column] += 1;
    }
  }
  for (const [column, count] of Object.entries(moved)) {
    assert.ok(count > 0, `${column} never moved in a real world — nothing reaches it`);
  }
});
