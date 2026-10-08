// VDP — local materials and the old-world import stock.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESOURCE_TYPES, DIG_COOLDOWN_MS, STARTING_OLD_WORLD_STOCK,
  createResourcesStore, materialsFor, canDig, digForResources, spendMaterials, undoSpend,
  grantMaterials,
} from '../src/lib/resources.js';

function fixedRng(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('digForResources yields a real resource type and amount, and records the inventory', () => {
  const store = createResourcesStore();
  const result = digForResources(store, { entityId: 'alice', now: 1000, rng: fixedRng(0) });

  assert.ok(RESOURCE_TYPES.includes(result.type));
  assert.ok(result.amount > 0, 'a dig must yield a positive amount');
  assert.equal(materialsFor(store, 'alice')[result.type], result.amount);
});

test('a roll of 0 always lands on the first (most common) row — wood', () => {
  // The weighted pick walks the table in order, so rng()=0 (roll=0)
  // must land in the first row every time — pinning the table's
  // ordering as well as the draw, not just that *some* type comes back.
  const store = createResourcesStore();
  const result = digForResources(store, { entityId: 'alice', now: 1000, rng: fixedRng(0) });
  assert.equal(result.type, 'wood');
});

test('digging again before the cooldown elapses is refused', () => {
  const store = createResourcesStore();
  digForResources(store, { entityId: 'alice', now: 1000, rng: fixedRng(0.1) });
  assert.equal(canDig(store, 'alice', 1000 + DIG_COOLDOWN_MS - 1), false);
  assert.throws(
    () => digForResources(store, { entityId: 'alice', now: 1000 + 1, rng: fixedRng(0.1) }),
    /must wait/,
  );
  assert.equal(canDig(store, 'alice', 1000 + DIG_COOLDOWN_MS), true);
  // And once the cooldown has elapsed, digging again does not throw.
  digForResources(store, { entityId: 'alice', now: 1000 + DIG_COOLDOWN_MS, rng: fixedRng(0.1) });
});

test('digging is per-person — one player\'s cooldown does not gate another', () => {
  const store = createResourcesStore();
  digForResources(store, { entityId: 'alice', now: 1000, rng: fixedRng(0.1) });
  assert.equal(canDig(store, 'bob', 1000), true);
  digForResources(store, { entityId: 'bob', now: 1000, rng: fixedRng(0.1) });
});

test('spendMaterials draws from a player\'s own dug materials first, with no import drawdown', () => {
  const store = createResourcesStore();
  store.materials.alice = { wood: 5, stone: 0, clay: 0, ore: 0 };
  const result = spendMaterials(store, 'alice', { wood: 3 });

  assert.equal(materialsFor(store, 'alice').wood, 2);
  assert.equal(result.fromOldWorldStock, 0);
  assert.equal(store.oldWorldStock, STARTING_OLD_WORLD_STOCK, 'no local materials spent should never touch the import stock');
});

test('spendMaterials falls back to the old-world stock only for the real shortfall, and the stock only ever goes down', () => {
  const store = createResourcesStore();
  store.materials.alice = { wood: 2, stone: 0, clay: 0, ore: 0 };
  const result = spendMaterials(store, 'alice', { wood: 5 });

  assert.equal(materialsFor(store, 'alice').wood, 0, 'local materials are spent down to zero before any import is touched');
  assert.equal(result.fromOldWorldStock, 3, 'only the real shortfall (5 - 2) should draw from the import stock');
  assert.equal(store.oldWorldStock, STARTING_OLD_WORLD_STOCK - 3);
});

test('undoSpend restores exactly what spendMaterials took, local and old-world both', () => {
  const store = createResourcesStore();
  store.materials.alice = { wood: 2, stone: 4, clay: 0, ore: 0 };
  const result = spendMaterials(store, 'alice', { wood: 5, stone: 1 });
  assert.equal(materialsFor(store, 'alice').wood, 0);
  assert.equal(materialsFor(store, 'alice').stone, 3);
  assert.equal(result.fromOldWorldStock, 3);

  undoSpend(store, 'alice', result);

  assert.deepEqual(materialsFor(store, 'alice'), { wood: 2, stone: 4, clay: 0, ore: 0 });
  assert.equal(store.oldWorldStock, STARTING_OLD_WORLD_STOCK, 'undoSpend must restore the old-world stock exactly, not leave it short or over-credit it');
});


test('spendMaterials refuses a request the import stock cannot cover, and changes nothing', () => {
  const store = createResourcesStore();
  store.oldWorldStock = 2;
  store.materials.alice = { wood: 0, stone: 0, clay: 0, ore: 0 };

  assert.throws(() => spendMaterials(store, 'alice', { wood: 5 }), /short/);
  assert.equal(store.oldWorldStock, 2, 'a refused spend must not partially apply');
  assert.equal(materialsFor(store, 'alice').wood, 0);
});

test('the old-world stock never goes up — nothing in this module replenishes it', () => {
  const store = createResourcesStore();
  store.materials.alice = { wood: 0, stone: 0, clay: 0, ore: 0 };
  spendMaterials(store, 'alice', { wood: 10 });
  const after1 = store.oldWorldStock;
  digForResources(store, { entityId: 'alice', now: Date.now(), rng: fixedRng(0) });
  assert.ok(store.oldWorldStock <= after1, 'digging must never raise the old-world stock');
});

test('grantMaterials is a real, produced yield, and never touches the old-world stock', () => {
  const store = createResourcesStore();
  const result = grantMaterials(store, 'alice', { game: 5, crop: 3 });

  assert.equal(result.game, 5);
  assert.equal(result.crop, 3);
  assert.equal(materialsFor(store, 'alice').game, 5);
  assert.equal(store.oldWorldStock, STARTING_OLD_WORLD_STOCK);
});

test('grantMaterials adds to, rather than replaces, what a player already holds', () => {
  const store = createResourcesStore();
  store.materials.alice = { wood: 0, stone: 0, clay: 0, ore: 0, game: 2, crop: 0 };
  grantMaterials(store, 'alice', { game: 5 });
  assert.equal(materialsFor(store, 'alice').game, 7);
});

test('game, crop and water are real resource types a dig never turns up', () => {
  assert.ok(RESOURCE_TYPES.includes('game'));
  assert.ok(RESOURCE_TYPES.includes('crop'));
  assert.ok(RESOURCE_TYPES.includes('water'));
  const store = createResourcesStore();
  const seenTypes = new Set();
  for (let i = 0; i < 50; i += 1) {
    const result = digForResources(store, { entityId: 'alice', now: i * DIG_COOLDOWN_MS, rng: fixedRng(i / 50) });
    seenTypes.add(result.type);
  }
  assert.ok(
    !seenTypes.has('game') && !seenTypes.has('crop') && !seenTypes.has('water'),
    'digging is earth and stone, not a hunt, a harvest, or clean water from a real plant',
  );
});
