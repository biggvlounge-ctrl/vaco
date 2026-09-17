// `keys_log` — the numeric half of the audit trail.
//
// ---------------------------------------------------------------------
// What this closes
//
// `keys_log` was one of the last tables in the schema with no
// WorldState array, no code and no rows — `dev-docs/GAME_COMPLETENESS.md`
// scored it "no store". Part of the reason is that it could not be
// written: `keys_log.key_id` references `key_definitions`, and although
// `server/completeness.js` declared that table "a module constant
// (keys.js), not per-world state", **the constant did not exist.** You
// cannot log which Key resolved without a stable id per Key.
//
// It is not a duplicate of `decision_log`, and the schema is precise
// about the difference: `decision_log` is why somebody did something,
// in words. `keys_log` is what one Key computed and — per
// `context_json`'s own column comment — the "snapshot of
// entity_knowledge/relationships read at resolution time".
//
// **That distinction is `contest.verifyContest`'s lesson generalised.**
// That function's stated purpose was that anybody could check a
// settlement without trusting whoever reported it, and it did not work,
// because it re-ran the bout against the LIVE world: a day later the
// tick had moved, the entrants had drifted, and an honest settlement
// failed its own audit. Every Key resolution had the same problem.
// `decision_log` records a confidence; it does not record the traits
// that produced the number, and they have since drifted. A log that
// cannot be recomputed is a claim, not a record.
//
// ---------------------------------------------------------------------
// And the measurement it made possible on the first run
//
// 300 ticks of a generated world, by `key_id`:
//
//     1 Resilience         2
//     2 Adaptability    1530
//     3 Trust              0
//     4 ScarcityResponse 2398
//     5 Fear             2398
//     6 Aggression       4555
//     7 Territory           0
//
// `Territory` is deliberately unwired and `tick.js` says so in as many
// words. **`Trust` is not.** One of the seven Keys — the whole Social
// category — resolves zero times in a generated world, and
// `Resilience` twice in 300 ticks. That is the eleventh standing rule
// again, surfaced by the table that was built to make resolutions
// checkable. It is recorded here and in `urbanSystems.js` rather than
// fixed in the same commit, because the cause is a separate finding:
// nothing in this engine writes a knowledge row whose SUBJECT is a
// person, and `resolveTrust` only runs when the actor holds a fact
// about the other party.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const keys = require('../server/keys.js');
const keysLog = require('../server/keysLog.js');
const engine = require('../server/engine.js');

function freshWorld() {
  return {
    tick: 10,
    memories: [], relationships: [], entityKnowledge: [], entityTraits: [],
    decisionLog: [], keysLog: [], npcs: [],
  };
}

// ---------------------------------------------------------------------
// key_definitions
// ---------------------------------------------------------------------

test('there is one definition per resolver, and the ids are stable', () => {
  // A resolver with no definition cannot be logged; a definition with
  // no resolver is a dangling `key_id`.
  const resolverNames = Object.keys(keys)
    .filter((k) => k.startsWith('resolve'))
    .map((k) => k.replace(/^resolve/, ''));
  assert.deepEqual([...keys.KEY_NAMES].sort(), resolverNames.sort());

  // 1-based and contiguous, mirroring BIGSERIAL — a stable id assigned
  // once, not reshuffled when a resolver moves in the file.
  assert.deepEqual(
    keys.KEY_DEFINITIONS.map((d) => d.key_id),
    keys.KEY_DEFINITIONS.map((_, i) => i + 1),
  );
});

test('every definition carries the columns the schema declares', () => {
  // `category`'s own schema comment enumerates these five.
  const categories = new Set(['human', 'social', 'economic', 'power', 'world']);
  for (const definition of keys.KEY_DEFINITIONS) {
    assert.ok(categories.has(definition.category),
      `${definition.name} has category "${definition.category}", not one of the schema's five`);
    assert.ok(Array.isArray(definition.inputs) && definition.inputs.length > 0,
      `${definition.name} declares no inputs`);
    // §4.3's three-way write-back plus the decision log, which
    // `writeBack` supplies for every resolver.
    assert.deepEqual(definition.outputs, ['memory', 'relationship', 'world', 'decision']);
  }
  // All five categories of §4.1 are represented, which is the check
  // that would have caught a resolver filed under the wrong one.
  assert.deepEqual(
    [...new Set(keys.KEY_DEFINITIONS.map((d) => d.category))].sort(),
    ['economic', 'human', 'power', 'social', 'world'],
  );
});

test('a name that is not a Key throws rather than logging a dangling id', () => {
  assert.throws(() => keys.keyIdFor('Charisma'), /is not a Key/);
  assert.equal(keys.keyIdFor('Aggression'), 6);
});

// ---------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------

test('every resolver logs its own resolution, with the number it produced', () => {
  const world = freshWorld();
  const npc = engine.generateNPC();
  const entity = engine.getLiveEntity(npc.id);
  world.npcs.push(npc);
  const applyKeyModifier = () => ({});

  const cases = [
    ['Resilience', keys.resolveResilience, { setbackSeverity: 60 }, 'resilienceScore'],
    ['Adaptability', keys.resolveAdaptability, { changeMagnitude: 60 }, 'adaptabilityScore'],
    ['Trust', keys.resolveTrust, { otherEntityId: npc.id + 1 }, 'newTrust'],
    ['ScarcityResponse', keys.resolveScarcityResponse, { resourceType: 'water' }, 'perceivedScarcity'],
    ['Fear', keys.resolveFear, {}, 'fearLevel'],
    ['Aggression', keys.resolveAggression, { otherEntityId: npc.id + 1 }, 'responseLevel'],
    ['Territory', keys.resolveTerritory, { claimStrength: 60 }, 'defenseLevel'],
  ];

  for (const [name, resolve, extra, headline] of cases) {
    const before = world.keysLog.length;
    const outcome = resolve(entity, {
      tick: world.tick, worldState: world, applyKeyModifier,
      knowledge: [{ fact_content: 'a thing', confidence_level: 0.8, fact_type: 'verified' }],
      ...extra,
    });
    assert.equal(world.keysLog.length, before + 1, `${name} logged no resolution`);

    const row = world.keysLog[world.keysLog.length - 1];
    assert.equal(row.key_id, keys.keyIdFor(name));
    assert.equal(row.entity_id, npc.id);
    assert.equal(row.tick, world.tick);
    // **The number, not a sentence about it.** This is the whole
    // difference from `decision_log`, whose `expected_result` is text.
    assert.equal(row.resolved_value, outcome[headline],
      `${name} logged a value that is not the one it returned`);
  }

  // One row per resolution, paired with the decision log rather than
  // replacing it.
  assert.equal(world.keysLog.length, cases.length);
  assert.equal(world.decisionLog.length, cases.length);
});

test('the context snapshot records what the resolution read', () => {
  // `context_json`'s own schema comment: "snapshot of
  // entity_knowledge/relationships read at resolution time".
  const world = freshWorld();
  const npc = engine.generateNPC();
  const other = engine.generateNPC();
  world.npcs.push(npc, other);

  keys.resolveAggression(engine.getLiveEntity(npc.id), {
    tick: world.tick, worldState: world, applyKeyModifier: () => ({}),
    otherEntityId: other.id, knowledge: [], grievance: 30,
  });

  const [row] = world.keysLog;
  assert.ok(Array.isArray(row.context_json.traits) && row.context_json.traits.length > 0,
    'the traits the resolver named were not captured');
  for (const trait of row.context_json.traits) {
    assert.ok(trait.family && trait.name && Number.isFinite(Number(trait.value)),
      'a captured trait has no value to recompute from');
  }
  assert.equal(row.context_json.relationship.otherEntityId, other.id);
});

test('an unresolvable value is null, not zero', () => {
  // `Number(null)` is 0 and 0 is finite — CLAUDE.md's corollary, and
  // the defect that shipped in `moodFor`. A Key that produced no value
  // did not produce a value of none.
  const world = freshWorld();
  const row = keysLog.record(world, { entityId: 1, keyId: 5, resolvedValue: null });
  assert.equal(row.resolved_value, null);
  assert.equal(keysLog.record(world, { entityId: 1, keyId: 5, resolvedValue: 0 }).resolved_value, 0);
  assert.equal(
    keysLog.record(world, { entityId: 1, keyId: 5, resolvedValue: NaN }).resolved_value, null,
  );
});

test('a row without an entity or a key is refused', () => {
  const world = freshWorld();
  assert.throws(() => keysLog.record(world, { keyId: 1 }), /entity_id is NOT NULL/);
  assert.throws(() => keysLog.record(world, { entityId: 1 }), /key_id is NOT NULL/);
});

// ---------------------------------------------------------------------
// Verification — the property the table exists for
// ---------------------------------------------------------------------

test('a resolution can be re-derived from the snapshot recorded with it', () => {
  // **Against the SNAPSHOT, not the live world**, which is exactly
  // what `verifyContest` failed to do: it re-ran the bout against
  // whatever the world looked like now, so a result could only be
  // verified in the instant it was produced.
  const world = freshWorld();
  const npc = engine.generateNPC();
  const other = engine.generateNPC();
  world.npcs.push(npc, other);

  keys.resolveAggression(engine.getLiveEntity(npc.id), {
    tick: world.tick, worldState: world, applyKeyModifier: () => ({}),
    otherEntityId: other.id, knowledge: [], grievance: 30,
  });
  const [row] = world.keysLog;

  // The arithmetic lives in keys.js; `verify` only hands over the
  // snapshot. Rebuilt here from the recorded traits, which is the
  // point — nothing reads the live entity.
  const recompute = (context) => {
    const at = (family, name) => Number(
      context.traits.find((t) => t.family === family && t.name === name)?.value,
    );
    return Math.round(
      at('behavioral', 'Aggression') * 0.6
      + 30 * 0.4
      - at('combat', 'Tactical Awareness') * 0.15,
    );
  };
  const result = keysLog.verify(world, row.id, recompute);
  assert.equal(result.verified, true,
    `recorded ${result.recorded} but recomputed ${result.recomputed} from its own inputs`);

  // **And the traits drifting does not break it**, which is the whole
  // reason the snapshot is stored rather than re-read.
  const live = engine.getLiveEntity(npc.id);
  live.traits.behavioral.Aggression = 5;
  assert.equal(keysLog.verify(world, row.id, recompute).verified, true);
});

test('a resolution nobody snapshotted is unverifiable, not wrong', () => {
  // Null is a different statement from `verified: false`. One says
  // nobody can check this; the other says it disagrees with its own
  // inputs, which would be a bug in the engine.
  const world = freshWorld();
  const row = keysLog.record(world, {
    entityId: 1, keyId: 5, resolvedValue: 40, context: null,
  });
  assert.equal(keysLog.verify(world, row.id, () => 40), null);
});

test('a resolution that disagrees with its own inputs is caught', () => {
  const world = freshWorld();
  const row = keysLog.record(world, {
    entityId: 1, keyId: 5, resolvedValue: 40, context: { traits: [] },
  });
  const result = keysLog.verify(world, row.id, () => 12);
  assert.equal(result.verified, false);
  assert.equal(result.recorded, 40);
  assert.equal(result.recomputed, 12);
});

test('verify refuses to guess the arithmetic', () => {
  const world = freshWorld();
  const row = keysLog.record(world, {
    entityId: 1, keyId: 5, resolvedValue: 40, context: { traits: [] },
  });
  assert.throws(() => keysLog.verify(world, row.id), /the arithmetic lives in keys.js/);
  assert.throws(() => keysLog.verify(world, 9999, () => 1), /no resolution 9999/);
});

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

test('resolutions can be read per entity and per Key', () => {
  const world = freshWorld();
  keysLog.record(world, { entityId: 1, keyId: 5, resolvedValue: 10, tick: 1 });
  keysLog.record(world, { entityId: 1, keyId: 6, resolvedValue: 20, tick: 2 });
  keysLog.record(world, { entityId: 2, keyId: 6, resolvedValue: 30, tick: 3 });

  assert.equal(keysLog.resolutionsBy(world, 1).length, 2);
  assert.equal(keysLog.resolutionsBy(world, 1, 6).length, 1);
  // Newest first — what a Key has been doing lately, which
  // `decision_log` cannot answer because it holds the Key's NAME in a
  // JSONB array rather than as a queryable column.
  assert.deepEqual(keysLog.resolutionsOf(world, 6).map((r) => r.tick), [3, 2]);
});

test('a GENERATED world logs every resolution, and this is what holds the wiring', () => {
  // **Standing rule 11's answer, not a throw.** `writeBack` skips the
  // log when a world has no `keysLog` array, because a hand-made
  // fixture that exercises a resolver should not have to know about
  // logging — and `writeBack` is the funnel all seven go through, so
  // throwing there would mean most of the suite. The risk of an
  // optional audit is that it silently does nothing in a real world,
  // and this is the assertion that catches that: a world built the way
  // worlds are built, with every resolution paired against the
  // decision log.
  const worldgen = require('../server/worldgen.js');
  const w = engine.WorldState;
  const before = { keys: w.keysLog.length, decisions: w.decisionLog.length };
  worldgen.generateWorld({ seed: 'keys-log', cities: 1, communitiesPerCity: 2, populationPerCommunity: 12 });
  for (let t = 0; t < 40; t += 1) engine.advanceTick();

  const keysWritten = w.keysLog.length - before.keys;
  const decisionsWritten = w.decisionLog.length - before.decisions;
  assert.ok(keysWritten > 0, 'a generated world resolved Keys and logged none of them');
  // Every resolution writes both. A divergence means one of the five
  // write-backs is being skipped somewhere.
  assert.equal(keysWritten, decisionsWritten,
    `${keysWritten} key resolutions against ${decisionsWritten} decisions`);

  const fresh = w.keysLog.slice(before.keys);
  for (const row of fresh) {
    assert.ok(keys.KEY_DEFINITIONS.some((d) => d.key_id === row.key_id),
      `logged key_id ${row.key_id} is not a Key`);
    assert.ok(row.context_json !== null, 'a resolution was logged with no snapshot');
  }
});

test('the id sequence survives a reseed', () => {
  // Without this the counter restarts at 1 against restored rows that
  // already use those ids, and two rows share a primary key with
  // nothing thrown.
  const world = freshWorld();
  const row = keysLog.record(world, { entityId: 1, keyId: 1, resolvedValue: 1 });
  assert.equal(keysLog.reseedIds(world).nextKeysLogId, row.id + 1);
});
