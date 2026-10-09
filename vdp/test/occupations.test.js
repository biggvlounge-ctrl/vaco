'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OCCUPATIONS, OCCUPATION_NAMES, pickOldWorldOccupation, oldWorldSkillsFor, OLD_WORLD_SKILL_LEVEL,
} from '../src/lib/occupations.js';
import { SKILL_NAMES } from '../src/lib/skills.js';

test('every real occupation names a real, flat tier number and a real VDP skill', () => {
  for (const name of OCCUPATION_NAMES) {
    const occupation = OCCUPATIONS[name];
    assert.ok(Number.isInteger(occupation.tier) && occupation.tier >= 1 && occupation.tier <= 5, `${name} has no real tier`);
    assert.ok(SKILL_NAMES.includes(occupation.skill), `${name}'s skill "${occupation.skill}" is not one of VDP's real skills`);
    assert.ok(occupation.source, `${name} has no real source`);
  }
});

test('OCCUPATIONS carries exactly the real 27-occupation subset ported from VACON-C', () => {
  assert.equal(OCCUPATION_NAMES.length, 27);
  // Spot-check a few real, exact ports against VACON-C's own values.
  assert.deepEqual(OCCUPATIONS.physician, { tier: 4, skill: 'Medicine', source: 'medicine' });
  assert.deepEqual(OCCUPATIONS.teacher, { tier: 3, skill: 'Communication', source: 'implied' });
  assert.deepEqual(OCCUPATIONS.farmer, { tier: 2, skill: 'Agriculture', source: 'farming' });
  assert.deepEqual(OCCUPATIONS.diplomat, { tier: 5, skill: 'Communication', source: 'diplomacy' });
  // And confirm the real, named exclusions never made it in (no VDP skill).
  assert.ok(!OCCUPATION_NAMES.includes('mechanic'));
  assert.ok(!OCCUPATION_NAMES.includes('scientist'));
  assert.ok(!OCCUPATION_NAMES.includes('librarian'));
});

test('pickOldWorldOccupation biases an affluent arrival toward the real top two tiers', () => {
  for (let i = 0; i < 50; i += 1) {
    const occupation = pickOldWorldOccupation({ wealthTier: 'affluent', rng: () => i / 50 });
    assert.ok(occupation.tier >= 4 && occupation.tier <= 5, `affluent draw returned tier ${occupation.tier}`);
  }
});

test('pickOldWorldOccupation biases a general arrival toward the real bottom three tiers', () => {
  for (let i = 0; i < 50; i += 1) {
    const occupation = pickOldWorldOccupation({ wealthTier: 'general', rng: () => i / 50 });
    assert.ok(occupation.tier >= 1 && occupation.tier <= 3, `general draw returned tier ${occupation.tier}`);
  }
});

test('pickOldWorldOccupation draws from the full real range for family-sponsored or an unknown tier', () => {
  const sponsored = pickOldWorldOccupation({ wealthTier: 'family-sponsored', rng: () => 0 });
  assert.ok(OCCUPATION_NAMES.includes(sponsored.name));
  const unknown = pickOldWorldOccupation({ rng: () => 0.99 });
  assert.ok(OCCUPATION_NAMES.includes(unknown.name));
});

test('pickOldWorldOccupation is deterministic given the same injected rng', () => {
  const a = pickOldWorldOccupation({ wealthTier: 'general', rng: () => 0.5 });
  const b = pickOldWorldOccupation({ wealthTier: 'general', rng: () => 0.5 });
  assert.deepEqual(a, b);
});

test('oldWorldSkillsFor seeds exactly one real skill, at the flagged-interpretive level, from one real occupation', () => {
  const { occupation, skills } = oldWorldSkillsFor({ wealthTier: 'affluent', rng: () => 0 });
  assert.ok(OCCUPATION_NAMES.includes(occupation.name));
  assert.deepEqual(skills, { [occupation.skill]: OLD_WORLD_SKILL_LEVEL });
  assert.equal(Object.keys(skills).length, 1);
});
