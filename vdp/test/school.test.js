// VDP — school. The silent-no-op-with-no-trait-change bug and the
// double-attendance-same-day bug this file asserts against were both
// watched failing against the pre-fix code before being trusted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSchoolStore, attendSchool, attendancesFor,
  EDUCATIONAL_TRAITS, EDUCATION_BUMP_AMOUNT, ATTEND_COOLDOWN_MS,
} from '../src/lib/school.js';
import { generateTraitSheet } from '../src/lib/traits.js';

test('attendSchool requires a studentId and traits', () => {
  const store = createSchoolStore();
  const traits = generateTraitSheet(() => 0.5);
  assert.throws(() => attendSchool(store, { traits }), /studentId/);
  assert.throws(() => attendSchool(store, { studentId: 'alice' }), /traits/);
});

test('attendSchool bumps every real educational trait up by the same flagged-interpretive amount, free of charge', () => {
  const store = createSchoolStore();
  const traits = generateTraitSheet(() => 0); // every trait starts at 0

  const attendance = attendSchool(store, { studentId: 'alice', traits });

  for (const name of EDUCATIONAL_TRAITS) {
    assert.equal(attendance.effect.before[name], 0);
    assert.equal(attendance.effect.after[name], EDUCATION_BUMP_AMOUNT);
    assert.equal(traits.educational[name], EDUCATION_BUMP_AMOUNT);
  }
});

test('attendSchool refuses a second attendance within the same real school day', () => {
  const store = createSchoolStore();
  const traits = generateTraitSheet(() => 0.5);
  const now = Date.now();

  attendSchool(store, { studentId: 'alice', traits, now });
  assert.throws(
    () => attendSchool(store, { studentId: 'alice', traits, now: now + 1000 }),
    /already attended within the last real school day/,
  );
});

test('attendSchool allows a new attendance once the real cooldown has fully elapsed', () => {
  const store = createSchoolStore();
  const traits = generateTraitSheet(() => 0.5);
  const now = Date.now();

  attendSchool(store, { studentId: 'alice', traits, now });
  const second = attendSchool(store, { studentId: 'alice', traits, now: now + ATTEND_COOLDOWN_MS });
  assert.ok(second);
  assert.equal(attendancesFor(store, 'alice').length, 2);
});

test('attendancesFor only returns a given student\'s own attendances', () => {
  const store = createSchoolStore();
  const aliceTraits = generateTraitSheet(() => 0.5);
  const bobTraits = generateTraitSheet(() => 0.5);
  attendSchool(store, { studentId: 'alice', traits: aliceTraits });
  attendSchool(store, { studentId: 'bob', traits: bobTraits });

  assert.equal(attendancesFor(store, 'alice').length, 1);
  assert.equal(attendancesFor(store, 'bob').length, 1);
});
