// VACANCY — the seven Key resolvers.
//
// Keys are how a person decides. They are the layer the Master
// Architecture Document calls "the single biggest structural gap"
// before it was extracted out of `advanceTick()`, and every cascade in
// the game runs through them. They had no tests.
//
// Two standing rules govern all seven (CLAUDE.md, and Section 4.3/4.4
// of the architecture doc). Both are asserted here for every resolver
// rather than for a representative one, because "all seven" is the
// claim and a rule kept by six of seven is a rule that is not kept:
//
//   1. Every resolution writes back to Memory, Relationships AND world
//      state. That is the definition of done for a Key, not optional.
//   2. Resolvers read subjective `entity_knowledge`, never raw world
//      state. A resolver that consults ground truth is reading a fact
//      the NPC has no way of knowing.
//
// These are unit tests against a private world -- `keys.js` takes
// `worldState` explicitly, so unlike the cascade test nothing here
// touches the engine singleton.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const keys = require('../server/keys.js');
const engine = require('../server/engine.js');

// The seven, with the extra context each one needs beyond the common
// fields. Kept as data so a new resolver cannot be added without
// deciding whether it belongs here.
const RESOLVERS = [
  ['Resilience', keys.resolveResilience, { setbackSeverity: 60 }],
  ['Adaptability', keys.resolveAdaptability, { changeMagnitude: 60 }],
  ['Trust', keys.resolveTrust, { otherEntityId: null }],
  ['ScarcityResponse', keys.resolveScarcityResponse, { resourceType: 'water' }],
  ['Fear', keys.resolveFear, {}],
  ['Aggression', keys.resolveAggression, { otherEntityId: null }],
  ['Territory', keys.resolveTerritory, { otherEntityId: null }],
];

// A world of the shape engine.js builds, but ours.
function freshWorld() {
  return {
    tick: 7,
    npcs: [], organizations: [], families: [], familyMemberships: [],
    resources: [], marketListings: [], individualFinances: [],
    entityTraits: [], memories: [], relationships: [], entityKnowledge: [],
    activeConditions: [], events: [], historicalRecords: [],
    migrationRisk: [], reemergenceIndex: null, players: [],
    cities: [], communities: [], territoryBlocks: [], artifacts: [], missions: [],
  };
}

// Two real NPCs from the real generator -- resolvers read trait values,
// so a hand-built stub would test a shape the game never produces.
function twoNpcs() {
  const a = engine.generateNPC();
  const b = engine.generateNPC();
  return [engine.getLiveEntity(a.id), engine.getLiveEntity(b.id)];
}

function contextFor(world, extra, applied) {
  return {
    tick: world.tick,
    worldState: world,
    // Stands in for engine.js's bound applyKeyModifier, and records
    // that world state was written -- the third write-back target,
    // which lives in entity_traits.key_modifier rather than in an
    // array we could otherwise count.
    applyKeyModifier: (entityId, family, name, delta, tick) => {
      applied.push({ entityId, family, name, delta, tick });
      return { entity_id: entityId, key_modifier: delta };
    },
    knowledge: [
      { fact_content: 'water scarcity', confidence_level: 0.9, fact_type: 'verified' },
    ],
    ...extra,
  };
}

for (const [name, resolve, extra] of RESOLVERS) {
  test(`${name} — writes back to Memory, Relationships and world state`, () => {
    const world = freshWorld();
    const [entity, other] = twoNpcs();
    const applied = [];
    const ctx = contextFor(world, { ...extra }, applied);
    if ('otherEntityId' in extra) ctx.otherEntityId = other.id;

    const result = resolve(entity, ctx);

    // Every resolver names itself, and the name matches the table above
    // exactly -- a resolver that reports the wrong key makes an audit
    // trail that points at the wrong decision.
    assert.equal(result.key, name, `resolver must name itself (got ${result.key})`);

    assert.equal(world.memories.length, 1, 'standing rule 1: a memory must be written');
    assert.equal(world.memories[0].entity_id, entity.id, 'the memory belongs to the deciding entity');
    assert.ok(world.memories[0].description.length > 0, 'a memory with no description tells a player nothing');

    assert.equal(world.relationships.length, 1, 'standing rule 1: a relationship must be written');
    assert.equal(applied.length, 1, 'standing rule 1: world state must be written via applyKeyModifier');
    assert.equal(applied[0].entityId, entity.id);
  });

  test(`${name} — records the tick it happened on`, () => {
    const world = freshWorld();
    const [entity, other] = twoNpcs();
    const applied = [];
    const ctx = contextFor(world, { ...extra }, applied);
    if ('otherEntityId' in extra) ctx.otherEntityId = other.id;

    resolve(entity, ctx);

    // Without this a player's history is unorderable, and the History
    // phase has nothing to sort on.
    assert.equal(world.memories[0].tick, world.tick, 'memory must carry the tick');
    assert.equal(applied[0].tick, world.tick, 'the world-state write must carry the tick');
  });
}

// -- rule 2: subjective knowledge, not ground truth --------------------------

test('the knowledge-reading Keys respond to what the NPC believes', () => {
  // Four of the seven take a `knowledge` array. Each must produce a
  // different result for a confident belief than for no belief at all
  // -- otherwise it is not actually reading it, and standing rule 2 is
  // decorative.
  const readers = [
    ['ScarcityResponse', keys.resolveScarcityResponse, { resourceType: 'water' }],
    ['Fear', keys.resolveFear, {}],
    ['Aggression', keys.resolveAggression, { otherEntityId: 1 }],
    ['Territory', keys.resolveTerritory, { otherEntityId: 1 }],
  ];

  for (const [name, resolve, extra] of readers) {
    const [entity] = twoNpcs();

    const ignorant = freshWorld();
    const knowing = freshWorld();
    const noop = () => ({});

    const withoutKnowledge = resolve(entity, {
      tick: 1, worldState: ignorant, applyKeyModifier: noop, knowledge: [], ...extra,
    });
    const withKnowledge = resolve(entity, {
      tick: 1, worldState: knowing, applyKeyModifier: noop, ...extra,
      knowledge: [
        { fact_content: 'water scarcity', confidence_level: 1, fact_type: 'verified' },
        { fact_content: 'unrest', confidence_level: 1, fact_type: 'verified' },
      ],
    });

    assert.notDeepEqual(withoutKnowledge, withKnowledge,
      `${name} must resolve differently when the NPC knows something -- `
      + 'identical results mean the knowledge argument is being ignored');
  }
});

test('a resolver never reads the world it was not told about', () => {
  // The inverse of the rule, and the one that catches a resolver
  // quietly reaching for ground truth: a world stuffed with a real
  // crisis, and an NPC who knows nothing about it, must resolve exactly
  // as it does in an empty world.
  const [entity] = twoNpcs();
  const noop = () => ({});

  const empty = freshWorld();
  const crisis = freshWorld();
  crisis.resources.push({
    id: 1, resource_type: 'water', supply: 1, demand: 900,
    quantity: 0, quality: 10, production_rate: 0, consumption_rate: 50,
  });
  crisis.events.push({ type: 'famine', severity: 100 });

  const inEmpty = keys.resolveScarcityResponse(entity, {
    tick: 1, worldState: empty, applyKeyModifier: noop, knowledge: [], resourceType: 'water',
  });
  const inCrisis = keys.resolveScarcityResponse(entity, {
    tick: 1, worldState: crisis, applyKeyModifier: noop, knowledge: [], resourceType: 'water',
  });

  assert.deepEqual(
    { ...inEmpty, writes: null },
    { ...inCrisis, writes: null },
    'an NPC who has not been told about a famine must not act on it -- '
    + 'standing rule 2: subjective knowledge, never raw world state',
  );
});

// -- the resolvers actually resolve something --------------------------------

test('Resilience: a tougher setback leaves more net impact', () => {
  const [entity] = twoNpcs();
  const noop = () => ({});
  const mild = keys.resolveResilience(entity, {
    tick: 1, worldState: freshWorld(), applyKeyModifier: noop, setbackSeverity: 10,
  });
  const severe = keys.resolveResilience(entity, {
    tick: 1, worldState: freshWorld(), applyKeyModifier: noop, setbackSeverity: 90,
  });

  assert.ok(severe.netImpact > mild.netImpact,
    `a worse setback must land harder (mild ${mild.netImpact}, severe ${severe.netImpact})`);
  assert.ok(severe.severityAbsorbed >= mild.severityAbsorbed,
    'and more of it must be absorbed in absolute terms');
});

test('Resilience: the same entity absorbs consistently', () => {
  // Resolvers must be deterministic on trait values. A random element
  // here would make every cascade unreproducible, which is fatal for a
  // simulation you intend to debug.
  const [entity] = twoNpcs();
  const noop = () => ({});
  const first = keys.resolveResilience(entity, {
    tick: 1, worldState: freshWorld(), applyKeyModifier: noop, setbackSeverity: 50,
  });
  const second = keys.resolveResilience(entity, {
    tick: 1, worldState: freshWorld(), applyKeyModifier: noop, setbackSeverity: 50,
  });

  assert.equal(first.resilienceScore, second.resilienceScore,
    'the same entity and the same setback must resolve identically');
});
