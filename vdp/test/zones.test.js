// VDP — zones.js: real, distinct named areas inside the frontier and
// the underground world.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { FRONTIER_ZONES, UNDERGROUND_ZONES, pickZone } from '../src/lib/zones.js';

test('FRONTIER_ZONES and UNDERGROUND_ZONES are real, distinct, non-empty lists', () => {
  assert.ok(FRONTIER_ZONES.length > 1);
  assert.ok(UNDERGROUND_ZONES.length > 1);
  const names = new Set([...FRONTIER_ZONES, ...UNDERGROUND_ZONES].map((z) => z.name));
  assert.equal(names.size, FRONTIER_ZONES.length + UNDERGROUND_ZONES.length, 'every zone name must be distinct');
});

test('pickZone deterministically picks by the real injected rng', () => {
  assert.equal(pickZone(FRONTIER_ZONES, () => 0), FRONTIER_ZONES[0]);
  assert.equal(pickZone(FRONTIER_ZONES, () => 0.999), FRONTIER_ZONES[FRONTIER_ZONES.length - 1]);
});

test('pickZone refuses an empty real zone list', () => {
  assert.throws(() => pickZone([]), /non-empty real zone list/);
});

test('FRONTIER_ZONES carries a real, separate fish bias for a water-heavy world, distinct from the water bias', () => {
  const fish = FRONTIER_ZONES.find((z) => z.bias === 'fish');
  const water = FRONTIER_ZONES.find((z) => z.bias === 'water');
  assert.ok(fish, 'a fish-biased zone must exist');
  assert.ok(water, 'a water-biased zone must exist');
  assert.notEqual(fish.name, water.name);
});
