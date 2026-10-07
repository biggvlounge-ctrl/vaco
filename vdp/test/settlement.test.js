'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISTRICT_UNLOCK_TIER, requiredTierFor, isDistrictUnlocked, getUnlockedDistrictIds,
} from '../src/lib/settlement.js';
import { DISTRICTS } from '../src/lib/world.js';

test('every real district in world.js has a real settlement tier assigned -- no silent gaps', () => {
  const missing = DISTRICTS.filter((d) => !DISTRICT_UNLOCK_TIER[d.id]);
  assert.deepEqual(missing.map((d) => d.id), []);
});

test('the Village District is the real seed -- unlocked from population zero', () => {
  assert.equal(requiredTierFor('village'), 'Hamlet');
  assert.equal(isDistrictUnlocked('village', 0), true);
});

test('an unknown district is refused rather than defaulted open or closed', () => {
  assert.throws(() => requiredTierFor('not-a-real-district'), /no real unlock tier assigned/);
});

test('unlocking is cumulative -- nothing locks again at a higher real population', () => {
  const populations = [0, 5, 10, 25, 50, 150, 200, 500, 1000, 5000];
  for (const id of Object.keys(DISTRICT_UNLOCK_TIER)) {
    let wasUnlocked = false;
    for (const pop of populations) {
      const unlocked = isDistrictUnlocked(id, pop);
      if (wasUnlocked) assert.ok(unlocked, `${id} locked again going from a lower to a higher real population`);
      wasUnlocked = wasUnlocked || unlocked;
    }
  }
});

test('at population 0 (Hamlet), only the seed district is real and open', () => {
  const ids = DISTRICTS.map((d) => d.id);
  assert.deepEqual(getUnlockedDistrictIds(0, ids), ['village']);
});

test('at a real population of 1000+ (Metropolis), every real district is open', () => {
  const ids = DISTRICTS.map((d) => d.id);
  assert.deepEqual(getUnlockedDistrictIds(1000, ids).sort(), [...ids].sort());
});

test("Meridian's real default NPC seed (14) already clears Hamlet, matching the instruction that NPCs alone don't finish settling the world", () => {
  const ids = DISTRICTS.map((d) => d.id);
  const unlocked = getUnlockedDistrictIds(14, ids);
  assert.ok(unlocked.length > 1, '14 NPCs should open more than just the seed');
  assert.ok(unlocked.length < ids.length, 'but real players, not NPCs alone, should be needed to finish settling it');
});
