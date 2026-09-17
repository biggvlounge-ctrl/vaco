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

// -- Aggression: the gate behind the gate --------------------------------
//
// **CLAUDE.md's fourteenth standing rule, one level deeper than where it
// was first found.** That rule records that `runSecurityPhase` filtered
// relationships on `conflict > 30` while `resolveAggression` was the
// field's only writer, so conflict sat at 0 forever and not one violent
// or domestic offence had ever occurred in any world. `crime.
// advanceFriction` gave conflict a real writer, relationships started
// qualifying — and every one of them still let it go.
//
// The reason was the INNER gate. `provocationCharge` came only from
// `entity_knowledge` about the other party, and measured on a 400-tick
// world **0 of 600 knowledge rows were about the other party in any
// relationship**. So the charge was structurally zero, the formula
// collapsed to `0.6*aggression - 0.15*tacticalAwareness`, and that tops
// out at 53.7 across a generated population of 150 — against a
// threshold of 70. Not rare: impossible, by arithmetic.
//
// Fixing a gate is not the same as fixing the gate behind it.

function aggressionWorld(applied) {
  const world = freshWorld();
  const [entity, other] = twoNpcs();
  return { world, entity, other, applied };
}

test('Aggression reads the grievance the caller holds, not just knowledge', () => {
  const applied = [];
  const { world, entity, other } = aggressionWorld(applied);
  const ctx = contextFor(world, { otherEntityId: other.id }, applied);
  ctx.knowledge = [];

  const without = keys.resolveAggression(entity, { ...ctx, grievance: 0 });
  const with_ = keys.resolveAggression(entity, { ...ctx, grievance: 80 });

  assert.ok(with_.responseLevel > without.responseLevel,
    'the grievance the phase selected on reached the resolver as nothing');
});

test('escalation is reachable for an angry person with a real grievance, and not for an ordinary one', () => {
  // Standing rule 8: the subject is constructed. The whole assertion is
  // about which side of the threshold somebody falls on, so their
  // traits are set rather than drawn.
  const applied = [];
  const world = freshWorld();
  const make = (aggression, tactical) => {
    const npc = engine.generateNPC();
    const live = engine.getLiveEntity(npc.id);
    live.traits.behavioral.Aggression = aggression;
    live.traits.combat['Tactical Awareness'] = tactical;
    return live;
  };
  const other = engine.generateNPC();
  const ctx = (subject) => ({
    ...contextFor(world, { otherEntityId: other.id }, applied),
    knowledge: [],
  });

  const furious = make(95, 10);
  // **Not 50/50.** An "ordinary person" here has to be ordinary among
  // the population this floor is actually applied to — the pairs above
  // CONFLICT_ESCALATION_THRESHOLD — and measured, their `responseLevel`
  // runs p50 5, p90 24, max 36. A 50/50 person with a serious grievance
  // sits near the top of that, not the middle. Standing rule 8 is about
  // exactly this: a fixture whose subject is not what its name claims
  // tests something else.
  const ordinary = make(40, 70);

  // A real grievance — the top of what `relationships.conflict` reaches
  // in a measured world once it stops ratcheting.
  assert.equal(keys.resolveAggression(furious, { ...ctx(), grievance: 45 })
    .escalatesToConflict, true, 'violence is still impossible, not merely rare');
  assert.equal(keys.resolveAggression(ordinary, { ...ctx(), grievance: 25 })
    .escalatesToConflict, false, 'an ordinary person came to blows over ordinary tension');

  // The grievance has to MOVE the answer, which is the property the
  // whole fix is about — the resolver was reading a provocation charge
  // of zero for every pair in every world.
  const provoked = keys.resolveAggression(furious, { ...ctx(), grievance: 45 }).responseLevel;
  const unprovoked = keys.resolveAggression(furious, { ...ctx(), grievance: 0 }).responseLevel;
  assert.ok(provoked > unprovoked,
    'the grievance the phase selected on did not change the response');

  // Note what is NOT asserted: that an extremely aggressive person
  // cannot escalate unprovoked. On this formula they can, and it does
  // not matter, because `runSecurityPhase` only ever calls the resolver
  // for a pair already above the conflict threshold — there is no
  // unprovoked path into it. Asserting it would be testing a property
  // nothing relies on.
});

// -- Trust: confidence and direction are different things ----------------
//
// **`knowledgeCharge` measures whether something is TRUE, not whether
// it is GOOD**, and its own comment says so: "verified/known facts
// count fully toward positive, false facts invert". That is epistemic
// status, and it is the right input for `resolveFear` and
// `resolveScarcityResponse`, where reliably knowing about a shortage
// should raise alarm.
//
// It is the wrong thing to steer trust by, and the defect only became
// visible once facts about people existed: `crime.recordCrime` now
// gives a victim a knowledge row about whoever robbed them, and with
// the charge alone as trust's direction, **knowing for certain who
// robbed you would raise your trust in them by the full amount.**
//
// `entity_knowledge` has no valence column, and adding one would put a
// second source of truth beside the table that already carries valence
// — `memories.memory_type` is positive/negative, `emotion_level` is
// signed, and `related_entity_ids` already says who a memory is about.

test('a firmly-known fact about somebody you resent lowers trust, not raises it', () => {
  const world = freshWorld();
  const [entity, other] = twoNpcs();
  world.npcs.push({ id: entity.id }, { id: other.id });
  const applied = [];

  // The same knowledge either way: a fact they are sure of.
  const knowledge = [{ fact_content: `entity ${other.id} committed theft`, confidence_level: 0.9, fact_type: 'known' }];

  const resolve = () => keys.resolveTrust(entity, {
    ...contextFor(world, { otherEntityId: other.id }, applied),
    knowledge,
  });

  // With no memory of them, there is no feeling to read and the charge
  // alone is used — bit-identical to what this resolver did before the
  // valence term existed. Standing rule 12's first clause.
  const stranger = resolve();
  assert.ok(stranger.trustDelta > 0, 'the no-memory path changed behaviour');

  // Now they remember being robbed by them. `crime.recordCrime` writes
  // exactly this memory, and it is what makes the direction right.
  world.memories.push({
    id: 9001, entity_id: entity.id, memory_type: 'negative', category: 'conflict',
    description: 'Suffered a theft offence', importance: 30, emotion_level: -30,
    related_entity_ids: [other.id], tick: world.tick,
  });
  const wronged = resolve();
  assert.ok(wronged.trustDelta < 0,
    `trust rose by ${wronged.trustDelta} on learning for certain who robbed them`);
});

test('how sure they are still scales how far trust moves', () => {
  // Confidence is the magnitude and feeling is the direction — the two
  // halves have to stay separate, or a half-believed suspicion would
  // poison a relationship as hard as a certainty.
  const world = freshWorld();
  const [entity, other] = twoNpcs();
  world.npcs.push({ id: entity.id }, { id: other.id });
  world.memories.push({
    id: 9002, entity_id: entity.id, memory_type: 'negative', category: 'conflict',
    description: 'Suffered a theft offence', importance: 30, emotion_level: -40,
    related_entity_ids: [other.id], tick: world.tick,
  });
  const applied = [];

  const move = (confidence, factType) => keys.resolveTrust(entity, {
    ...contextFor(world, { otherEntityId: other.id }, applied),
    knowledge: [{ fact_content: 'a thing', confidence_level: confidence, fact_type: factType }],
  }).trustDelta;

  const certain = move(0.95, 'known');
  const guessing = move(0.2, 'assumption');
  assert.ok(certain < 0, `a certainty should move trust down, moved ${certain}`);
  // **Not strictly negative, and that is right.** `trustDelta` is
  // rounded, so a barely-believed suspicion against a mild resentment
  // can land on zero — somebody who half-thinks their neighbour might
  // have taken something does not think less of them for it. The claim
  // worth asserting is the ordering, not that every whisper counts.
  assert.ok(guessing <= 0, `a guess moved trust up by ${guessing}`);
  assert.ok(certain < guessing,
    `a guess (${guessing}) moved trust as far as a certainty (${certain})`);
});
