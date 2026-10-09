// VDP — school. "Then we will need also school. We will do mostly
// online school, but we need to set up some type of schooling
// program" (9 Oct 2026, direct instruction). "Mostly online" is why
// `attendSchool` below takes no `transferFn` and no district-presence
// check -- the real schooling program is a server-side action any
// enrolled player can take regardless of where their avatar is
// standing, a deliberate reading of "mostly online," not an oversight.
// A `teacher` job (see `jobs.js`) still staffs the physical School
// district for players who want an in-person role, reusing
// VACON-C's own real tier-3 `teacher` occupation (`skill:
// 'Communication', employers: ['school']`) -- an exact match, so no
// new skill is added for it.
//
// `attendSchool` is the real, and first, reader of the `educational`
// trait family (`traits.js`'s own `Literacy`, `Technical Knowledge`,
// `Historical Knowledge`, `Self-Taught Aptitude`) -- a family that has
// existed with zero readers anywhere in VDP since it was ported (see
// VDP_FOUNDING.md's own dated note on `efficiency` for the precedent
// of calling this out rather than leaving it silent). Free and
// government-funded -- "mostly online school" reads as no per-lesson
// tuition the way a VENVS textbook has a real price, so no VCoin
// moves here at all. `EDUCATION_BUMP_AMOUNT` and `ATTEND_COOLDOWN_MS`
// are both flagged interpretive: no source document gives a real
// amount or cadence, so one real school day (24h) is used as the
// smallest honest unit rather than an unbounded same-tick farm.

import { bumpTrait } from './traits.js';

export const EDUCATIONAL_TRAITS = ['Literacy', 'Technical Knowledge', 'Historical Knowledge', 'Self-Taught Aptitude'];
export const EDUCATION_BUMP_AMOUNT = 6; // interpretive
export const ATTEND_COOLDOWN_MS = 24 * 60 * 60 * 1000; // interpretive -- one real school day

export function createSchoolStore() {
  return { lastAttendedAt: {}, attendances: [], nextAttendanceId: 1 };
}

export function attendSchool(store, { studentId, traits, now = Date.now() } = {}) {
  if (!studentId) throw new Error('attendSchool requires a studentId');
  if (!traits) throw new Error("attendSchool requires the student's traits");

  const last = store.lastAttendedAt[studentId];
  if (last !== undefined && now - last < ATTEND_COOLDOWN_MS) {
    const retryAfterMs = ATTEND_COOLDOWN_MS - (now - last);
    throw new Error(`attendSchool: "${studentId}" already attended within the last real school day (retry in ${retryAfterMs}ms)`);
  }

  const before = {};
  const after = {};
  for (const name of EDUCATIONAL_TRAITS) {
    before[name] = Number(traits?.educational?.[name]) || 0;
    after[name] = bumpTrait(traits, 'educational', name, EDUCATION_BUMP_AMOUNT);
  }

  // Recorded AFTER the trait bump, same ordering as every other
  // mutation in this module: a crash mid-bump leaves the cooldown
  // unset, so the student can simply attend again rather than being
  // locked out of a lesson that didn't actually finish applying.
  store.lastAttendedAt[studentId] = now;
  const attendance = {
    id: store.nextAttendanceId++, studentId, attendedAt: now, effect: { before, after },
  };
  store.attendances.push(attendance);
  return attendance;
}

export function attendancesFor(store, studentId) {
  return store.attendances.filter((a) => a.studentId === studentId);
}
