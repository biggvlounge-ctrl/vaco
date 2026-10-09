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

test('TRAIT_FAMILIES carries the real 20 families, 106 traits -- VACON-C\'s 21/122 minus Skills', () => {
  const families = Object.keys(TRAIT_FAMILIES);
  assert.equal(families.length, 20);
  assert.ok(!families.includes('skills'), 'Skills is deliberately excluded -- see this module\'s header');
  assert.ok(families.includes('efficiency'), 'VACON-C\'s real 21st family, ported');
  const total = Object.values(TRAIT_FAMILIES).reduce((n, names) => n + names.length, 0);
  assert.equal(total, 106);
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

test('tagsFor derives VDP\'s own Efficient tag from the new efficiency family', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.efficiency['Process Optimization'] = HIGH;
  sheet.efficiency['Time Management'] = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Efficient'));
});

test('tagsFor derives VDP\'s own Trickster tag from Deception + Creativity, distinct from Sneaky', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.criminal.Deception = HIGH;
  sheet.mental.Creativity = HIGH;
  sheet.criminal.Stealth = LOW; // Sneaky's own second condition stays closed
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Trickster'));
  assert.ok(!tags.includes('Sneaky'), 'Trickster and Sneaky read different real traits and must not be conflated');
});

test('tagsFor derives Narcissistic from Narcissism alone, the same single-trait shape as Aggressive/Creative', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.psychological.Narcissism = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Narcissistic'));
});

test('tagsFor derives Cheater from low Honesty + high Deception, distinct from Unreliable', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.behavioral.Honesty = LOW;
  sheet.criminal.Deception = HIGH;
  sheet.behavioral.Discipline = HIGH; // Unreliable's own second condition stays closed
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Cheater'));
  assert.ok(!tags.includes('Unreliable'), 'Cheater and Unreliable read different real traits and must not be conflated');
});

test('tagsFor derives Manipulative from high Persuasion + high Deception, distinct from Diplomatic', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.social.Persuasion = HIGH;
  sheet.criminal.Deception = HIGH;
  sheet.behavioral.Patience = LOW; // Diplomatic's own second condition stays closed
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Manipulative'));
  assert.ok(!tags.includes('Diplomatic'), 'Manipulative and Diplomatic read different real traits and must not be conflated');
});

test('tagsFor derives Timid and Shy from low Confidence, each paired with a different real trait so they stay distinct', () => {
  const shy = generateTraitSheet(fixedRng(0));
  shy.social.Charisma = LOW;
  shy.personality.Confidence = LOW;
  shy.behavioral.Recklessness = HIGH; // Timid's own second condition stays closed
  let tags = tagsFor(shy).map((t) => t.name);
  assert.ok(tags.includes('Shy'));
  assert.ok(!tags.includes('Timid'));

  const timid = generateTraitSheet(fixedRng(0));
  timid.personality.Confidence = LOW;
  timid.behavioral.Recklessness = LOW;
  timid.social.Charisma = HIGH; // Shy's own first condition stays closed
  tags = tagsFor(timid).map((t) => t.name);
  assert.ok(tags.includes('Timid'));
  assert.ok(!tags.includes('Shy'));
});

test('tagsFor derives Naive from low Trust Threshold + low Risk Assessment -- the opposite direction from Paranoid', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.psychological['Trust Threshold'] = LOW;
  sheet.mental['Risk Assessment'] = LOW;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Naive'));
  assert.ok(!tags.includes('Paranoid'), 'Naive and Paranoid read Trust Threshold in opposite directions');
});

test('tagsFor derives Devoted ("too loyal") from Group Loyalty + Conformity, distinct from Community Focused', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.social['Group Loyalty'] = HIGH;
  sheet.behavioral.Conformity = HIGH;
  sheet.emotional.Empathy = LOW; // Community Focused's own second condition stays closed
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Devoted'));
  assert.ok(!tags.includes('Community Focused'));
});

test('tagsFor derives Hot-Tempered ("anger") from Aggression + Volatility, richer than the plain Aggressive tag', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.behavioral.Aggression = HIGH;
  sheet.emotional.Volatility = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Hot-Tempered'));
  assert.ok(tags.includes('Aggressive'), 'Aggressive is single-trait and should still fire alongside it');
});

test('tagsFor derives Delusional from Delusion Susceptibility alone -- the honest stand-in, not a literal clinical label', () => {
  const sheet = generateTraitSheet(fixedRng(0));
  sheet.psychological['Delusion Susceptibility'] = HIGH;
  const tags = tagsFor(sheet).map((t) => t.name);
  assert.ok(tags.includes('Delusional'));
});

test('citedTraits now covers every real individual trait except the four health traits, which hospital.js reads instead', () => {
  const allTraits = [];
  for (const [family, names] of Object.entries(TRAIT_FAMILIES)) {
    for (const name of names) allTraits.push(`${family}.${name}`);
  }
  const cited = new Set(citedTraits().map(([family, name]) => `${family}.${name}`));
  const uncited = allTraits.filter((key) => !cited.has(key));
  assert.deepEqual(
    uncited.sort(),
    ['health.Chronic Conditions', 'health.Immune Response', 'health.Nutrition Status', 'health.Sleep Quality'].sort(),
  );
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
