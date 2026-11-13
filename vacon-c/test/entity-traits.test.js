// test/entity-traits.test.js
//
// `entityTraits.js` had no test file of its own before this one, the
// same gap the twenty-sixth standing rule found and closed for
// `server/seeded.js` — "imported by seven modules... had no test file
// at all." This one is imported by 31. These tests hold the one real
// property this round's fix depends on: the per-world trait index
// stays correct across real growth, and stays cheap across repeated
// reads of an unchanged world. See `entityTraits.js`'s own header for
// the full account of the bug this closes — `test/worldgen.test.js`
// genuinely hanging (100%+ CPU, never completing) because its own
// module-global world accumulates across every test in the file with
// no reset, and one test runs 60 real ticks over whatever had
// accumulated by the time it ran.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const entityTraits = require('../server/entityTraits.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');

function fakeWorld() {
  return { entityTraits: [] };
}

test('getEntityTraitsForEntity returns exactly one entity\'s own rows, nobody else\'s', () => {
  const w = fakeWorld();
  w.entityTraits.push(...entityTraits.generateEntityTraits(1, 0, INDIVIDUAL_DEFINITIONS.slice(0, 3)));
  w.entityTraits.push(...entityTraits.generateEntityTraits(2, 0, INDIVIDUAL_DEFINITIONS.slice(0, 3)));

  const rowsFor1 = entityTraits.getEntityTraitsForEntity(w, 1);
  const rowsFor2 = entityTraits.getEntityTraitsForEntity(w, 2);
  assert.equal(rowsFor1.length, 3);
  assert.equal(rowsFor2.length, 3);
  assert.ok(rowsFor1.every((r) => r.entity_id === 1));
  assert.ok(rowsFor2.every((r) => r.entity_id === 2));
});

test('an entity with no rows at all gets an empty array, not a crash', () => {
  const w = fakeWorld();
  assert.deepEqual(entityTraits.getEntityTraitsForEntity(w, 999), []);
});

test('a world with no entityTraits array at all still returns an empty array', () => {
  assert.deepEqual(entityTraits.getEntityTraitsForEntity({}, 1), []);
});

test('the real bug this round fixed: a row added AFTER the index was already built is still found — the cache invalidates on real growth, not just at first read', () => {
  const w = fakeWorld();
  w.entityTraits.push(...entityTraits.generateEntityTraits(1, 0, INDIVIDUAL_DEFINITIONS.slice(0, 2)));

  // Warm the cache for a DIFFERENT entity — this is the exact shape
  // that broke under the mutation tried against this fix: build the
  // index once, then grow the array, then read the NEW entity.
  entityTraits.getEntityTraitsForEntity(w, 1);

  w.entityTraits.push(...entityTraits.generateEntityTraits(2, 0, INDIVIDUAL_DEFINITIONS.slice(0, 4)));
  const rowsFor2 = entityTraits.getEntityTraitsForEntity(w, 2);
  assert.equal(rowsFor2.length, 4, 'a row pushed after the cache was warmed must still be visible');
});

test('a full entityTraits array replacement (the restore.js shape) invalidates the cache too, not just a plain append', () => {
  const w = fakeWorld();
  w.entityTraits.push(...entityTraits.generateEntityTraits(1, 0, INDIVIDUAL_DEFINITIONS.slice(0, 2)));
  entityTraits.getEntityTraitsForEntity(w, 1); // warm it

  // Simulate restore.js assigning a brand-new array object rather than
  // pushing into the existing one.
  w.entityTraits = entityTraits.generateEntityTraits(5, 0, INDIVIDUAL_DEFINITIONS.slice(0, 6));
  assert.deepEqual(entityTraits.getEntityTraitsForEntity(w, 1), [],
    'entity 1 no longer exists in the replaced array and must not be served from a stale index');
  assert.equal(entityTraits.getEntityTraitsForEntity(w, 5).length, 6);
});

test('an in-place write to an already-indexed row needs no invalidation — the index holds the same row objects, not copies', () => {
  const w = fakeWorld();
  w.entityTraits.push(...entityTraits.generateEntityTraits(1, 0, INDIVIDUAL_DEFINITIONS.slice(0, 1)));
  const [row] = entityTraits.getEntityTraitsForEntity(w, 1);
  row.current_value = 12345;
  const [rowAgain] = entityTraits.getEntityTraitsForEntity(w, 1);
  assert.equal(rowAgain.current_value, 12345, 'the index must return the live object, not a stale copy');
  assert.equal(row, rowAgain, 'same object reference, not a clone');
});

test('the index is reused, not rebuilt, across repeated reads of an unchanged world — the actual performance fix, checked structurally rather than by timing', () => {
  const w = fakeWorld();
  for (let i = 0; i < 50; i += 1) {
    w.entityTraits.push(...entityTraits.generateEntityTraits(i, 0, INDIVIDUAL_DEFINITIONS.slice(0, 5)));
  }
  // Reading the same unchanged array many times must not rebuild the
  // index each time. There is no exported hook to count rebuilds
  // directly, so this checks the only externally-observable proxy: the
  // returned row arrays are the SAME array instances across repeated
  // calls (a rebuild would still return rows with equal content but
  // via Array.prototype.find/filter on the flat array every time,
  // never the SAME nested array object from a cached Map value).
  const first = entityTraits.getEntityTraitsForEntity(w, 10);
  for (let i = 0; i < 1000; i += 1) {
    const again = entityTraits.getEntityTraitsForEntity(w, 10);
    assert.equal(again, first, 'a cached read must return the identical array instance, proving the Map was reused, not rebuilt');
  }
});

test('findEntityTraitRow still finds the right row by family/name through the same index', () => {
  const w = fakeWorld();
  const defs = INDIVIDUAL_DEFINITIONS.slice(0, 3);
  w.entityTraits.push(...entityTraits.generateEntityTraits(1, 0, defs));
  const target = defs[1];
  const row = entityTraits.applyKeyModifier(w, 1, target.family, target.name, 0, 0);
  assert.ok(row, 'applyKeyModifier (which goes through findEntityTraitRow) must find the real row');
  assert.equal(row.trait_id, target.trait_id);
});

test('getLiveEntity composes the same index — a live NPC carries its real, current traits', () => {
  const w = { entityTraits: [], npcs: [], organizations: [], families: [] };
  const defs = INDIVIDUAL_DEFINITIONS.slice(0, 2);
  w.npcs.push({ id: 7, name: 'test-npc' });
  w.entityTraits.push(...entityTraits.generateEntityTraits(7, 0, defs, () => 42));

  const live = entityTraits.getLiveEntity(w, 7);
  assert.ok(live);
  assert.equal(live.id, 7);
  const family = defs[0].family;
  const name = defs[0].name;
  assert.equal(live.traits[family][name], 42);
});
