// Why somebody did what they did.
//
// **`decision_log` is one of the most specific tables in the whole
// schema and had no WorldState array at all** — not `schemaOnly` in
// `urbanSystems.js`, not carried by `migrate.js`, simply absent. It
// asks for situation, available options, what was chosen, what was
// expected, confidence, which traits, which keys, which memories, and
// what actually followed. That is not a log line, it is an
// explanation — and every Key resolver already held all of it and
// discarded it on every resolution.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const decisions = require('../server/decisions.js');
const keys = require('../server/keys.js');
const engine = require('../server/engine.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits, getLiveEntity } = require('../server/entityTraits.js');

const KEYS_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'keys.js'), 'utf8',
);

const RESOLVERS = [
  'resolveResilience', 'resolveAdaptability', 'resolveTrust',
  'resolveScarcityResponse', 'resolveFear', 'resolveAggression', 'resolveTerritory',
];

let nextId = 800000;

function world() {
  const worldState = {
    tick: 5,
    npcs: [],
    organizations: [],
    families: [],
    entityTraits: [],
    memories: [],
    relationships: [],
    entityKnowledge: [],
    decisionLog: [],
  };
  decisions.reseedIds(worldState);
  return worldState;
}

function person(worldState, value = 60) {
  const id = nextId++;
  worldState.entityTraits.push(
    ...generateEntityTraits(id, worldState.tick, INDIVIDUAL_DEFINITIONS, () => value),
  );
  worldState.npcs.push({ id, status: 'active', traits: {} });
  return getLiveEntity(worldState, id);
}

function context(worldState) {
  return {
    tick: worldState.tick,
    worldState,
    applyKeyModifier: () => null,
    otherEntityId: 999,
    knowledge: [],
  };
}

// -- every Key says why -------------------------------------------------

test('all seven resolvers record a decision', () => {
  // **The claim that matters, and it is held here rather than trusted.**
  // A Key that resolves without saying why would work perfectly and
  // just make the log shorter than it should be — invisible in every
  // other test.
  const w = world();
  const live = person(w);
  for (const resolver of RESOLVERS) keys[resolver](live, context(w));
  assert.equal(w.decisionLog.length, RESOLVERS.length);

  // And each names the key it went through, so a caller can ask "show
  // me every aggression decision" rather than parsing a sentence.
  const recorded = new Set(w.decisionLog.flatMap((d) => d.keys_used));
  assert.deepEqual([...recorded].sort(), [
    'Adaptability', 'Aggression', 'Fear', 'Resilience',
    'ScarcityResponse', 'Territory', 'Trust',
  ]);
});

test('every resolver in keys.js passes a decision to writeBack', () => {
  // Structural, because the runtime check above only covers the seven
  // that exist today. An eighth resolver added without a decision
  // block would pass that test by not being in the list.
  const resolverCount = (KEYS_SOURCE.match(/^function resolve\w+\(/gm) || []).length;
  const decisionCount = (KEYS_SOURCE.match(/^\s{4}decision: \{$/gm) || []).length;
  assert.equal(resolverCount, RESOLVERS.length, 'a resolver was added or removed');
  assert.equal(decisionCount, resolverCount,
    `${resolverCount} resolvers and ${decisionCount} decision blocks — a Key resolves silently`);
});

test('a decision names the traits that actually decided it', () => {
  // The point of `traits_used`: not that a decision happened, but
  // which parts of this person made it. A resolver that recorded the
  // wrong trait would be worse than one recording none.
  const w = world();
  const live = person(w, 72);
  keys.resolveAggression(live, context(w));

  const row = w.decisionLog[0];
  assert.deepEqual(row.traits_used, [
    { family: 'behavioral', name: 'Aggression', value: 72 },
    { family: 'combat', name: 'Tactical Awareness', value: 72 },
  ]);
  assert.deepEqual(row.available_options, ['let it go', 'escalate']);
  assert.ok(row.selected_option);
  assert.ok(row.expected_result);
});

test('the memory a resolution wrote is the memory the decision used', () => {
  // Standing rule 1 has every Key write to Memory. That memory is what
  // the entity draws on next time, so it IS what this decision rests
  // on — linking them costs nothing and makes `memory_used` real
  // rather than an empty array forever.
  const w = world();
  const live = person(w);
  keys.resolveFear(live, context(w));

  const row = w.decisionLog[0];
  assert.equal(row.memory_used.length, 1);
  assert.equal(row.memory_used[0], w.memories[0].id);
});

// -- the shape ----------------------------------------------------------

test('a decision needs an entity, because the column is NOT NULL', () => {
  assert.throws(() => decisions.record(world(), { situation: 'something' }),
    /requires an entityId/);
});

test('the JSONB fields default to empty rather than null', () => {
  // A decision that used no traits and one nobody recorded the traits
  // for are different facts. `[]` says the first, null says the second.
  const w = world();
  const row = decisions.record(w, { entityId: 1, situation: 'a choice' });
  assert.deepEqual(row.traits_used, []);
  assert.deepEqual(row.keys_used, []);
  assert.deepEqual(row.available_options, []);
  assert.deepEqual(row.memory_used, []);
});

test('outcome starts null and is filled when the world settles', () => {
  // **The one field a resolver cannot fill**, and the reason this is a
  // table rather than a line in `memories`. A memory is what somebody
  // believes happened; a decision record is what they chose and what
  // followed, and the gap between the two is the interesting part.
  const w = world();
  const row = decisions.record(w, {
    entityId: 1, situation: 'a choice', selectedOption: 'go', expectedResult: 'arrive',
  });
  assert.equal(row.outcome, null);
  assert.equal(decisions.explain(w, row.id).settled, false);

  decisions.recordOutcome(w, row.id, 'arrive');
  assert.equal(decisions.explain(w, row.id).settled, true);
  assert.throws(() => decisions.recordOutcome(w, 9999, 'x'), /no decision 9999/);
});

test('reliability is unknown until something has settled, not zero', () => {
  const w = world();
  assert.equal(decisions.reliabilityOf(w, 1), null);

  const a = decisions.record(w, { entityId: 1, expectedResult: 'arrive' });
  const b = decisions.record(w, { entityId: 1, expectedResult: 'arrive' });
  assert.equal(decisions.reliabilityOf(w, 1), null, 'unsettled decisions produced a rate');

  decisions.recordOutcome(w, a.id, 'arrive');
  decisions.recordOutcome(w, b.id, 'lost');
  assert.equal(decisions.reliabilityOf(w, 1), 0.5);
});

test('an explanation is assembled from the fields, not stored as a sentence', () => {
  // A stored sentence would go stale the moment a resolver's weighting
  // changed. This cannot.
  const w = world();
  const live = person(w, 80);
  keys.resolveTerritory(live, context(w));

  const explained = decisions.explain(w, w.decisionLog[0].id);
  assert.match(explained.because, /faction\.Territorial Instinct 80/);
  assert.equal(explained.through, 'Territory');
  assert.ok(['concede', 'contest'].includes(explained.chose));
  assert.equal(decisions.explain(w, 9999), null);
});

test('decisions can be read back by person and by key', () => {
  const w = world();
  const live = person(w);
  keys.resolveFear(live, context(w));
  keys.resolveAggression(live, context(w));

  assert.equal(decisions.decisionsBy(w, live.id).length, 2);
  assert.equal(decisions.decisionsBy(w, live.id, { key: 'Fear' }).length, 1);
  assert.equal(decisions.decisionsBy(w, live.id, { sinceTick: 99 }).length, 0);
  assert.equal(decisions.decisionsBy(w, 999999).length, 0);
});

// -- wiring -------------------------------------------------------------

test('the WorldState the engine ships carries a decision log', () => {
  assert.ok(Array.isArray(engine.WorldState.decisionLog));
});

test('ids survive a reseed', () => {
  const w = world();
  w.decisionLog.push({ id: 40, entity_id: 1, tick: 1 });
  assert.deepEqual(decisions.reseedIds(w), { nextDecisionId: 41 });
  assert.equal(decisions.record(w, { entityId: 1 }).id, 41);
});

test('a running world records why people did things', () => {
  // Standing rule 6's shape: the unit tests above all build their own
  // world. This one runs the real pipeline and looks at what came out.
  const worldgen = require('../server/worldgen.js');
  const w = engine.WorldState;
  const before = w.decisionLog.length;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 12, seed: 'decide' });
  for (let t = 0; t < 40; t += 1) engine.advanceTick();

  const fresh = w.decisionLog.slice(before);
  assert.ok(fresh.length > 0, 'a world ran for 40 ticks and nobody decided anything');
  for (const row of fresh) {
    assert.ok(row.keys_used.length > 0, 'a decision was recorded with no key');
    assert.ok(row.traits_used.length > 0, 'a decision was recorded with no traits');
    assert.ok(Number.isFinite(row.tick));
  }
});
