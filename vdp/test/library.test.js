'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createLibrary, applyBookEffect, listLibrary, TEXTBOOK_BELIEF_SHIFT } from '../src/lib/library.js';
import { createSkills } from '../src/lib/skills.js';
import { createBeliefs, getBelief } from '../src/lib/beliefs.js';

function fakePlayer() {
  return { skills: createSkills(), beliefs: createBeliefs() };
}

test('a practical textbook bumps the matching skill, once', () => {
  const library = createLibrary();
  const player = fakePlayer();
  const result = applyBookEffect(library, player, { orderId: 'o1', title: 'Cooking 101', skillSubject: 'Crafting' });
  assert.equal(result.applied, true);
  assert.equal(result.effect.kind, 'skill');
  assert.ok(player.skills.Crafting > 0);
});

test('an influence book moves the matching belief, not a skill', () => {
  const library = createLibrary();
  const player = fakePlayer();
  const result = applyBookEffect(library, player, {
    orderId: 'o1', title: 'The Secret', beliefTopic: 'positive-thinking', beliefType: 'philosophical',
  });
  assert.equal(result.effect.kind, 'belief');
  assert.equal(getBelief(player.beliefs, 'positive-thinking', 'philosophical'), TEXTBOOK_BELIEF_SHIFT);
});

test('the same order id never applies twice -- VENVS retrying a delivery must not double-bump', () => {
  const library = createLibrary();
  const player = fakePlayer();
  applyBookEffect(library, player, { orderId: 'o1', title: 'Cooking 101', skillSubject: 'Crafting' });
  const levelAfterFirst = player.skills.Crafting;
  const second = applyBookEffect(library, player, { orderId: 'o1', title: 'Cooking 101', skillSubject: 'Crafting' });
  assert.equal(second.applied, false);
  assert.equal(player.skills.Crafting, levelAfterFirst, 'a retried order must not bump the skill a second time');
});

test('a book must name either a skillSubject or a full belief tag, never neither', () => {
  const library = createLibrary();
  const player = fakePlayer();
  assert.throws(() => applyBookEffect(library, player, { orderId: 'o1', title: 'Untitled' }));
});

test('listLibrary reflects every applied book, in order', () => {
  const library = createLibrary();
  const player = fakePlayer();
  applyBookEffect(library, player, { orderId: 'o1', title: 'Cooking 101', skillSubject: 'Crafting' });
  applyBookEffect(library, player, { orderId: 'o2', title: 'The Bible', beliefTopic: 'faith', beliefType: 'religious' });
  assert.deepEqual(listLibrary(library).map((b) => b.title), ['Cooking 101', 'The Bible']);
});
