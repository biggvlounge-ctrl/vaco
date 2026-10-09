// VDP — animals.js: imported livestock, native discoveries, breeding,
// and real overhunting regulation.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAnimalsStore, importAnimal, discoverNativeAnimal, claimNativeAnimal, breedAnimals, growUp,
  listAnimalsOwnedBy, listWildAnimals, getAnimal, isHuntingRegulated, regulatedHuntYield,
  MATURATION_MS, HUNTING_REGULATION_THRESHOLD, REGULATED_HUNT_YIELD_FRACTION,
} from '../src/lib/animals.js';

test('importAnimal brings over a real, already-adult animal owned by a real settler', () => {
  const store = createAnimalsStore();
  const animal = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  assert.equal(animal.source, 'imported');
  assert.equal(animal.stage, 'adult');
  assert.equal(animal.ownerId, 'alice');
  assert.deepEqual(listAnimalsOwnedBy(store, 'alice'), [animal]);
});

test('importAnimal requires a real species and ownerId', () => {
  const store = createAnimalsStore();
  assert.throws(() => importAnimal(store, { ownerId: 'alice' }), /requires a species/);
  assert.throws(() => importAnimal(store, { species: 'goat' }), /requires an ownerId/);
});

test('discoverNativeAnimal records a real, unowned wild find', () => {
  const store = createAnimalsStore();
  const animal = discoverNativeAnimal(store, { species: 'tundra hare', discoveredBy: 'bob' });
  assert.equal(animal.source, 'native');
  assert.equal(animal.ownerId, null);
  assert.deepEqual(listWildAnimals(store), [animal]);
});

test('claimNativeAnimal moves a real wild find into real ownership, once', () => {
  const store = createAnimalsStore();
  const animal = discoverNativeAnimal(store, { species: 'tundra hare', discoveredBy: 'bob' });
  const claimed = claimNativeAnimal(store, animal.id, { ownerId: 'bob' });
  assert.equal(claimed.ownerId, 'bob');
  assert.equal(listWildAnimals(store).length, 0);
  assert.throws(() => claimNativeAnimal(store, animal.id, { ownerId: 'carol' }), /already claimed/);
});

test('claimNativeAnimal refuses an imported animal -- claiming is only for real wild finds', () => {
  const store = createAnimalsStore();
  const animal = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  assert.throws(() => claimNativeAnimal(store, animal.id, { ownerId: 'bob' }), /was not a native discovery/);
});

test('breedAnimals requires both real parents to be the same species, adult, and owned by the real breeder', () => {
  const store = createAnimalsStore();
  const goatA = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  const goatB = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  const sheep = importAnimal(store, { species: 'sheep', ownerId: 'alice' });
  const bobsGoat = importAnimal(store, { species: 'goat', ownerId: 'bob' });

  assert.throws(
    () => breedAnimals(store, { parentAId: goatA.id, parentBId: sheep.id, ownerId: 'alice' }),
    /not the same species/,
  );
  assert.throws(
    () => breedAnimals(store, { parentAId: goatA.id, parentBId: bobsGoat.id, ownerId: 'alice' }),
    /does not own both real parents/,
  );

  const offspring = breedAnimals(store, { parentAId: goatA.id, parentBId: goatB.id, ownerId: 'alice' });
  assert.equal(offspring.species, 'goat');
  assert.equal(offspring.stage, 'juvenile');
  assert.deepEqual(offspring.parentIds, [goatA.id, goatB.id]);
});

test('breedAnimals refuses a juvenile parent', () => {
  const store = createAnimalsStore();
  const goatA = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  const goatB = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  const kid = breedAnimals(store, { parentAId: goatA.id, parentBId: goatB.id, ownerId: 'alice' });
  assert.throws(
    () => breedAnimals(store, { parentAId: goatA.id, parentBId: kid.id, ownerId: 'alice' }),
    /must be adult/,
  );
});

test('growUp refuses an animal that is not old enough yet, and matures it once it is', () => {
  const store = createAnimalsStore();
  const goatA = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  const goatB = importAnimal(store, { species: 'goat', ownerId: 'alice' });
  const bornAt = Date.now();
  const kid = breedAnimals(store, { parentAId: goatA.id, parentBId: goatB.id, ownerId: 'alice', now: bornAt });

  assert.throws(() => growUp(store, kid.id, { now: bornAt + 1000 }), /not old enough yet/);
  const grown = growUp(store, kid.id, { now: bornAt + MATURATION_MS });
  assert.equal(grown.stage, 'adult');
  assert.throws(() => growUp(store, kid.id), /already adult/);
});

test('getAnimal/breedAnimals refuse an unknown animal id', () => {
  const store = createAnimalsStore();
  assert.equal(getAnimal(store, 999), null);
  assert.throws(() => breedAnimals(store, { parentAId: 999, parentBId: 1, ownerId: 'alice' }), /no animal #999/);
});

// -- real overhunting regulation --------------------------------------

test('isHuntingRegulated/regulatedHuntYield are false/unchanged below the real threshold', () => {
  assert.equal(isHuntingRegulated(HUNTING_REGULATION_THRESHOLD - 1), false);
  assert.equal(regulatedHuntYield(HUNTING_REGULATION_THRESHOLD - 1, 5), 5);
});

test('isHuntingRegulated/regulatedHuntYield kick in once the real cumulative kill count crosses the threshold', () => {
  assert.equal(isHuntingRegulated(HUNTING_REGULATION_THRESHOLD), true);
  assert.equal(regulatedHuntYield(HUNTING_REGULATION_THRESHOLD, 5), Math.round(5 * REGULATED_HUNT_YIELD_FRACTION));
});

test('regulatedHuntYield treats a missing totalGameProduced as zero, not a crash', () => {
  assert.equal(regulatedHuntYield(undefined, 5), 5);
});
