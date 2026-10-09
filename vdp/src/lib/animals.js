// VDP — Animals: imported livestock, native discoveries, breeding,
// and real overhunting regulation.
//
// Per direct instruction (9 Oct 2026, later): "people will be
// importing animals from the old world... breeding and start to grow
// and breed new things. Also there will be different animals that
// will already be here that will be discovered in the new world as
// well, do a mixture on those." Two real sources, one real record --
// `source` tells them apart, not two parallel shapes, the same
// "two entry methods, one real record" discipline `immigration.js`
// already uses for legal/illegal arrivals.
//
// `species` is free text, same discipline as `immigration.js`'s
// `originRegion`/`smuggledGoods`: naming a closed, invented species
// list here would be exactly the kind of fact this project refuses to
// assert, and the instruction itself names no real species.
//
// **"Certain people will take advantage of that and do too much
// killing... everything will get regulated."** `isHuntingRegulated`/
// `regulatedHuntYield` read `resources.js`'s own real, already-tracked
// `totalProduced.game` -- never a second, invented kill count. Once
// the settlement's real cumulative hunting yield crosses a real
// threshold, every future hunting shift's yield is reduced, read by
// `jobs.js`'s `clockOutAndPay` through an injected `regulateYieldFn`
// (see that file) rather than this module reaching into jobs.js
// directly -- the same decoupled-by-injection shape every other
// cross-module call in this directory already uses.
//
// `MATURATION_MS`/`HUNTING_REGULATION_THRESHOLD`/
// `REGULATED_HUNT_YIELD_FRACTION` are flagged interpretive numbers,
// the same footing `resources.js`'s own `DIG_COOLDOWN_MS`/
// `BASE_EXOTIC_VALUE` already stand on.

export const ANIMAL_SOURCES = ['imported', 'native'];
export const ANIMAL_STAGES = ['juvenile', 'adult'];

export const MATURATION_MS = 24 * 60 * 60 * 1000;
export const HUNTING_REGULATION_THRESHOLD = 200;
export const REGULATED_HUNT_YIELD_FRACTION = 0.4;

export function createAnimalsStore() {
  return { animals: [], nextAnimalId: 1 };
}

function requireRealAnimal(store, animalId, fnName) {
  const animal = store.animals.find((a) => a.id === animalId);
  if (!animal) throw new Error(`${fnName}: no animal #${animalId}`);
  return animal;
}

// Brought over already grown -- a real, one-time import, the same
// "left to their own real stock" shape `resources.js`'s own
// `oldWorldStock` already models for goods rather than animals.
export function importAnimal(store, { species, ownerId, now = Date.now() } = {}) {
  if (!species) throw new Error('importAnimal requires a species');
  if (!ownerId) throw new Error('importAnimal requires an ownerId');
  const animal = {
    id: store.nextAnimalId++,
    species,
    source: 'imported',
    stage: 'adult',
    ownerId,
    parentIds: [],
    bornAt: now,
  };
  store.animals.push(animal);
  return animal;
}

// A real, wild find -- unowned until someone real actually claims it,
// the same "found vs. a separate later real act" shape
// `immigration.js`'s `reportSmugglingSpot`/`sealSmugglingSpot` already
// use for a different discovery.
export function discoverNativeAnimal(store, { species, discoveredBy, now = Date.now() } = {}) {
  if (!species) throw new Error('discoverNativeAnimal requires a species');
  const animal = {
    id: store.nextAnimalId++,
    species,
    source: 'native',
    stage: 'adult',
    ownerId: null,
    discoveredBy: discoveredBy || null,
    parentIds: [],
    bornAt: now,
  };
  store.animals.push(animal);
  return animal;
}

export function claimNativeAnimal(store, animalId, { ownerId, now = Date.now() } = {}) {
  const animal = requireRealAnimal(store, animalId, 'claimNativeAnimal');
  if (animal.source !== 'native') throw new Error(`claimNativeAnimal: animal #${animalId} was not a native discovery`);
  if (animal.ownerId) throw new Error(`claimNativeAnimal: animal #${animalId} is already claimed`);
  animal.ownerId = ownerId;
  animal.claimedAt = now;
  return animal;
}

// Real breeding: both real parents, both adult, both the same species,
// both already owned by the same real owner -- a player cannot breed
// an animal they do not own, imported or native alike.
export function breedAnimals(store, { parentAId, parentBId, ownerId, now = Date.now() } = {}) {
  const parentA = requireRealAnimal(store, parentAId, 'breedAnimals');
  const parentB = requireRealAnimal(store, parentBId, 'breedAnimals');
  if (parentA.species !== parentB.species) {
    throw new Error(`breedAnimals: "${parentA.species}" and "${parentB.species}" are not the same species`);
  }
  if (parentA.stage !== 'adult' || parentB.stage !== 'adult') {
    throw new Error('breedAnimals: both real parents must be adult');
  }
  if (parentA.ownerId !== ownerId || parentB.ownerId !== ownerId) {
    throw new Error(`breedAnimals: "${ownerId}" does not own both real parents`);
  }
  const offspring = {
    id: store.nextAnimalId++,
    species: parentA.species,
    source: parentA.source,
    stage: 'juvenile',
    ownerId,
    parentIds: [parentAId, parentBId],
    bornAt: now,
  };
  store.animals.push(offspring);
  return offspring;
}

export function growUp(store, animalId, { now = Date.now() } = {}) {
  const animal = requireRealAnimal(store, animalId, 'growUp');
  if (animal.stage === 'adult') throw new Error(`growUp: animal #${animalId} is already adult`);
  if (now - animal.bornAt < MATURATION_MS) {
    throw new Error(`growUp: animal #${animalId} is not old enough yet`);
  }
  animal.stage = 'adult';
  animal.maturedAt = now;
  return animal;
}

export function listAnimalsOwnedBy(store, ownerId) {
  return store.animals.filter((a) => a.ownerId === ownerId);
}

export function listWildAnimals(store) {
  return store.animals.filter((a) => a.source === 'native' && !a.ownerId);
}

export function getAnimal(store, animalId) {
  return store.animals.find((a) => a.id === animalId) || null;
}

// The real regulation `jobs.js`'s hunter shift reads -- see header.
export function isHuntingRegulated(totalGameProduced) {
  return (totalGameProduced || 0) >= HUNTING_REGULATION_THRESHOLD;
}

export function regulatedHuntYield(totalGameProduced, baseYield) {
  return isHuntingRegulated(totalGameProduced)
    ? Math.round(baseYield * REGULATED_HUNT_YIELD_FRACTION)
    : baseYield;
}
