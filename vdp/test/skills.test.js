'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKILL_NAMES, JOB_SHIFT_GAIN, TEXTBOOK_GAIN, CONVERSATION_GAIN,
  createSkills, gainFromShift, gainFromTextbook, gainFromConversation, fadeSkills,
} from '../src/lib/skills.js';

test('a fresh skill sheet starts every named skill at zero', () => {
  const skills = createSkills();
  for (const name of SKILL_NAMES) assert.equal(skills[name], 0);
});

test('each real source applies its own real gain amount', () => {
  const skills = createSkills();
  assert.equal(gainFromShift(skills, 'Business'), JOB_SHIFT_GAIN);
  assert.equal(gainFromTextbook(skills, 'Crafting'), TEXTBOOK_GAIN);
  assert.equal(gainFromConversation(skills, 'Communication'), CONVERSATION_GAIN);
});

test('a skill clamps at 100 and never goes negative', () => {
  const skills = createSkills();
  skills.Business = 99;
  assert.equal(gainFromShift(skills, 'Business'), 100);
  for (let i = 0; i < 5000; i += 1) fadeSkills(skills);
  assert.ok(skills.Business >= 0);
});

test('an unknown skill name throws rather than silently creating a new field', () => {
  const skills = createSkills();
  assert.throws(() => gainFromShift(skills, 'Charisma'), /not a known skill/);
});

test('createSkills seeds real old-world characteristics when given, and clamps them', () => {
  const skills = createSkills({ Combat: 35, Agriculture: 999 });
  assert.equal(skills.Combat, 35);
  assert.equal(skills.Agriculture, 100, 'a seeded value is clamped the same as any other gain');
  assert.equal(skills.Business, 0, 'an unseeded skill still starts at zero');
});

test('fadeSkills moves every skill toward zero, not just the touched one', () => {
  const skills = createSkills();
  gainFromTextbook(skills, 'Crafting');
  const before = skills.Crafting;
  fadeSkills(skills);
  assert.ok(skills.Crafting < before, 'an unused skill slowly recedes, so it is not a one-way ratchet');
});
