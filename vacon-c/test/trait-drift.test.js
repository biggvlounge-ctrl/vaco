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
    drift.runTraitDrift(w, { tick: w.tick + t, scarcityByCommunity: new Map(), crimeByCommunity: new Map() });
  }

  for (const before of snapshot) {
    const now = w.entityTraits.find(
      (r) => r.entity_id === id && r.trait_id === before.trait_id,
    );
    assert.equal(now.current_value, before.current_value,
      `${getDefinition(before.trait_id).name} drifted with no habits, no danger and no scarcity`);
  }
});

test('a shortage in one city does not press trait drift in another', () => {
  // The same bug `runMortality`/`runBirths`/`runDeprivationCrime`/
  // `runMarket` had, one file over: `scarcity` used to be a single
  // number computed once for the whole world (`mortality.
  // survivalScarcity(worldState)`, no city) and applied to every
  // community's trait drift alike — so a famine in one city wore down
  // people living through no shortage at all.
  //
  // **No seeded draw sits between `pressuresFor` and
  // `driftEnvironment`**, unlike the crime/births/market versions of
  // this test, so this does not need a statistical sample — the
  // comparison is exact every run.
  const mortality = require('../server/mortality.js');
  const economy = require('../server/economy.js');

  const w = world({
    communities: [{ id: 1, city_id: 1 }, { id: 2, city_id: 2 }],
    resources: [],
  });
  const starving = person(w, 50, { communityId: 1 });
  const fine = person(w, 50, { communityId: 2 });
  economy.generateResource(w, { cityId: 1, resourceType: 'food', supply: 1, demand: 1000 });

  const starvingBefore = valueOf(w, starving, 'emotional', 'Optimism').environmental_modifier;
  const fineBefore = valueOf(w, fine, 'emotional', 'Optimism').environmental_modifier;

  // Built the way `tick.js` builds it: each community's own city.
  const scarcityByCommunity = new Map(w.communities.map(
    (c) => [c.id, mortality.survivalScarcity(w, c.city_id)],
  ));
  for (let t = 0; t < 20; t += 1) {
    drift.runTraitDrift(w, {
      tick: w.tick + t, scarcityByCommunity, crimeByCommunity: new Map(),
    });
  }

  const starvingAfter = valueOf(w, starving, 'emotional', 'Optimism').environmental_modifier;
  const fineAfter = valueOf(w, fine, 'emotional', 'Optimism').environmental_modifier;

  assert.ok(starvingAfter < starvingBefore,
    'the real shortage should have worn down the person actually living through it');
  assert.equal(fineAfter, fineBefore,
    'a person in a city with no shortage of its own drifted anyway');
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

// -- groupCohesionMultiplierFor ------------------------------------------
//
// "a progression of a person could depend on who they're around... a
// small organization that is congruent and all act as one is more
// valuable than a large organization... that don't act as one." Rate,
// not direction — see this function's own header in traitDrift.js for
// why it does not widen `driftRelationships`'s own narrower claim.

const familyTraits = require('../server/familyTraits.js');
const organizationTraits = require('../server/organizationTraits.js');
const membership = require('../server/membership.js');
const { ORGANIZATION_DEFINITIONS } = require('../server/traitDefinitions.js');

function orgEntity(w, loyalty = 50) {
  const id = nextId += 1;
  w.entityTraits.push(...generateEntityTraits(
    id, w.tick, ORGANIZATION_DEFINITIONS, (def) => (def.name === 'internalLoyalty' ? loyalty : 50),
  ));
  w.organizations.push({ id, type: 'club' });
  return id;
}

test('groupCohesionMultiplierFor is 1 for a person in no family and no organization', () => {
  const w = world({ familyMemberships: [], entityOrganizationMemberships: [] });
  const id = person(w, 50);
  assert.equal(drift.groupCohesionMultiplierFor(w, id), 1);
});

test('groupCohesionMultiplierFor is 0.5 + cohesion for a person whose only group is their family', () => {
  const w = world({
    families: [{ id: 1, unity: 80, conflict: 0 }],
    familyMemberships: [],
    entityOrganizationMemberships: [],
  });
  const id = person(w, 50);
  w.familyMemberships.push({ entity_id: id, family_id: 1 });
  // cohesionOf: cooperation defaults to 50 (no `family cooperation` trait
  // generated on this bare fixture), pull = ((80+50)/2)/100 = 0.65, drag = 1.
  const expected = 0.5 + familyTraits.cohesionOf(w, 1);
  assert.equal(drift.groupCohesionMultiplierFor(w, id), expected);
  assert.equal(Math.round(expected * 100) / 100, 1.15);
});

test('groupCohesionMultiplierFor is 0.5 + cohesion for a person whose only group is an organization', () => {
  const w = world({ familyMemberships: [], entityOrganizationMemberships: [] });
  const id = person(w, 50);
  const orgId = orgEntity(w, 20);
  membership.joinOrganization(w, { entityId: id, organizationId: orgId });
  const expected = 0.5 + organizationTraits.cohesionOf(w, orgId);
  assert.equal(drift.groupCohesionMultiplierFor(w, id), expected);
  assert.equal(Math.round(expected * 100) / 100, 0.85);
});

test('groupCohesionMultiplierFor takes the MAX cohesion across every group, never an average', () => {
  const w = world({
    families: [{ id: 1, unity: 10, conflict: 0 }],
    familyMemberships: [],
    entityOrganizationMemberships: [],
  });
  const id = person(w, 50);
  w.familyMemberships.push({ entity_id: id, family_id: 1 });
  const orgId = orgEntity(w, 100);
  membership.joinOrganization(w, { entityId: id, organizationId: orgId });

  const familyScore = familyTraits.cohesionOf(w, 1);
  const orgScore = organizationTraits.cohesionOf(w, orgId);
  assert.ok(orgScore > familyScore, 'the org must be the more cohesive group for this test to prove MAX, not something else');
  assert.equal(drift.groupCohesionMultiplierFor(w, id), 0.5 + orgScore,
    'a loose family must not drag down the benefit of a genuinely tight-knit organization');
});

// -- driftExperience actually reads the multiplier -----------------------

test('a cohesive group makes practice pay off faster -- same habit, same ticks, bigger gain', () => {
  const lowW = world();
  const lowId = person(lowW, 50);
  lowW.habits.push({ entity_id: lowId, habit_name: 'work', strength: 100, harmful: false });

  const highW = world();
  const highId = person(highW, 50);
  highW.habits.push({ entity_id: highId, habit_name: 'work', strength: 100, harmful: false });

  for (let t = 0; t < 60; t += 1) {
    drift.driftExperience(lowW, lowId, lowW.tick + t, null, 0.5);
    drift.driftExperience(highW, highId, highW.tick + t, null, 1.5);
  }

  const lowGain = valueOf(lowW, lowId, 'physical', 'Endurance').experience_modifier;
  const highGain = valueOf(highW, highId, 'physical', 'Endurance').experience_modifier;
  assert.ok(lowGain > 0 && highGain > 0, 'both should still grow — only the RATE should differ');
  assert.ok(highGain > lowGain,
    `a 1.5x group multiplier (${highGain}) did not outgrow a 0.5x one (${lowGain})`);
});

test('groupMultiplier defaults to 1 when omitted -- every existing call site is unaffected', () => {
  const w = world();
  const id = person(w, 50);
  w.habits.push({ entity_id: id, habit_name: 'work', strength: 100, harmful: false });
  for (let t = 0; t < 60; t += 1) drift.driftExperience(w, id, w.tick + t);
  const defaultGain = valueOf(w, id, 'physical', 'Endurance').experience_modifier;

  const w2 = world();
  const id2 = person(w2, 50);
  w2.habits.push({ entity_id: id2, habit_name: 'work', strength: 100, harmful: false });
  for (let t = 0; t < 60; t += 1) drift.driftExperience(w2, id2, w2.tick + t, null, 1);
  const explicitOneGain = valueOf(w2, id2, 'physical', 'Endurance').experience_modifier;

  assert.equal(defaultGain, explicitOneGain, 'an omitted multiplier must behave exactly like an explicit 1');
});

test('the group multiplier speeds up PRACTICE, not forgetting -- the decay step is identical regardless of multiplier', () => {
  // Two people with the IDENTICAL starting experience_modifier (set
  // directly, not grown, so the comparison isn't confounded by two
  // different starting points) and no habit at all -- only the fade
  // path can run. One ticks at groupMultiplier 1, the other at 1.5.
  const w1 = world();
  const id1 = person(w1, 50);
  valueOf(w1, id1, 'physical', 'Endurance').experience_modifier = 5;
  drift.driftExperience(w1, id1, w1.tick, null, 1);
  const afterOne = valueOf(w1, id1, 'physical', 'Endurance').experience_modifier;

  const w2 = world();
  const id2 = person(w2, 50);
  valueOf(w2, id2, 'physical', 'Endurance').experience_modifier = 5;
  drift.driftExperience(w2, id2, w2.tick, null, 1.5);
  const afterOnePointFive = valueOf(w2, id2, 'physical', 'Endurance').experience_modifier;

  assert.ok(afterOne < 5, 'fading did not happen at all');
  assert.equal(afterOne, afterOnePointFive,
    'the decay step moved by a different amount under a different group multiplier -- it must not');
});
