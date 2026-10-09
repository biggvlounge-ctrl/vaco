// VDP — traits.js: VACON-C's real trait sheet and archetype layer,
// pulled in per direct instruction ("bring in all the traits... all
// the things we have from vacancy").

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRAIT_FAMILIES, HIGH, LOW, randomTraitValue, generateTraitSheet,
  readTrait, bumpTrait, topIndividualTrait, tagsFor, citedTraits,
} from '../src/lib/traits.js';

function fixedRng(value) {
  return () => value;
}

test('TRAIT_FAMILIES carries the real 19 families, 98 traits -- VACON-C\'s 20/114 minus Skills', () => {
  const families = Object.keys(TRAIT_FAMILIES);
  assert.equal(families.length, 19);
  assert.ok(!families.includes('skills'), 'Skills is deliberately excluded -- see this module\'s header');
  const total = Object.values(TRAIT_FAMILIES).reduce((n, names) => n + names.length, 0);
  assert.equal(total, 98);
});

test('generateTraitSheet produces every real trait, in range, for an injected rng', () => {
  const sheet = generateTraitSheet(fixedRng(0.5));
  for (const [family, names] of Object.entries(TRAIT_FAMILIES)) {
    for (const name of names) {
      const value = sheet[family][name];
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `${family}.${name} out of range`);
    }
  }
});

test('randomTraitValue is deterministic under a fixed rng and varies under a real one', () => {
  assert.equal(randomTraitValue(fixedRng(0.5)), randomTraitValue(fixedRng(0.5)));
  const values = new Set();
  for (let i = 0; i < 50; i += 1) values.add(randomTraitValue(Math.random));
  assert.ok(values.size > 10, 'a real rng must not collapse to a handful of repeated values');
});

test('readTrait falls back to a neutral 50 for a missing family or trait, never a crash', () => {
  const sheet = generateTraitSheet(fixedRng(0.5));
  assert.equal(readTrait(sheet, 'not-a-real-family', 'x'), 50);
  assert.equal(readTrait(null, 'mental', 'Intelligence'), 50);
});

test('bumpTrait raises a real trait and clamps at 100', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  bumpTrait(sheet, 'behavioral', 'Discipline', 20);
  assert.ok(sheet.behavioral.Discipline > 0);
  sheet.behavioral.Discipline = 95;
  bumpTrait(sheet, 'behavioral', 'Discipline', 20);
  assert.equal(sheet.behavioral.Discipline, 100, 'must clamp rather than overflow');
});

test('topIndividualTrait names the single highest real trait across the whole sheet', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.leadership['Command Presence'] = 100;
  const top = topIndividualTrait(sheet);
  assert.equal(top.family, 'leadership');
  assert.equal(top.name, 'Command Presence');
  assert.equal(top.value, 100);
});

test('citedTraits names only real families and traits -- no archetype cites an invented name', () => {
  for (const [family, name] of citedTraits()) {
    assert.ok(TRAIT_FAMILIES[family], `archetype cites unknown family "${family}"`);
    assert.ok(TRAIT_FAMILIES[family].includes(name), `archetype cites unknown trait "${family}.${name}"`);
  }
  assert.ok(citedTraits().length > 0, 'the citation check itself must see real citations, not an empty predicate list');
});

test('tagsFor is a pure read -- the same sheet always derives the same tags, and nothing is written', () => {
  const sheet = generateTraitSheet(fixedRng(0.5));
  const before = JSON.stringify(sheet);
  const tags1 = tagsFor(sheet);
  const tags2 = tagsFor(sheet);
  assert.deepEqual(tags1.map((t) => t.name), tags2.map((t) => t.name));
  assert.equal(JSON.stringify(sheet), before, 'tagsFor must never mutate the sheet it reads');
});

test('tagsFor derives Natural Leader from high Command Presence + high Charisma', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.leadership['Command Presence'] = HIGH;
  sheet.social.Charisma = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Natural Leader'));
});

test('tagsFor derives Entrepreneur from Risk Appetite + Barter Skill -- adapted off VACON-C\'s excluded Skills family', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.economic['Risk Appetite'] = HIGH;
  sheet.economic['Barter Skill'] = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Entrepreneur'));
});

test('tagsFor derives VDP\'s own Sneaky tag from Stealth + Deception -- the direct answer to "sneakiness"', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.criminal.Stealth = HIGH;
  sheet.criminal.Deception = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Sneaky'));
});

test('tagsFor derives nothing for a perfectly neutral sheet -- every gate stays closed at the midpoint', () => {
  const sheet = {};
  for (const [family, names] of Object.entries(TRAIT_FAMILIES)) {
    sheet[family] = {};
    for (const name of names) sheet[family][name] = 50;
  }
  assert.deepEqual(tagsFor(sheet), [], 'a flat 50 across every trait must earn no HIGH/LOW archetype');
});

test('LOW and HIGH are real, named, and ordered', () => {
  assert.ok(LOW < HIGH);
  assert.equal(HIGH, 70);
  assert.equal(LOW, 30);
});
