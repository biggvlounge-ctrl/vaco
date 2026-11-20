// server/students.js
//
// By direct instruction, continuing "the next five": university
// students as a real population, not employees.
//
// ---------------------------------------------------------------------
// The real gap, named by this engine's own spec and its own code
// ---------------------------------------------------------------------
// `VACANCY_CONSOLIDATED_MASTER_SPEC.md` §65 EDUCATION SYSTEM: "Tracks
// schools, teachers, students, libraries, books, knowledge, literacy,
// specialized education." Teachers are real (`occupations.js`,
// `landmarks.crewFor`'s `learning`/`schoolhouse` crews). `statecraft
// .runSchooling` already moves every resident up a real six-rung
// education ladder (`demographics.EDUCATION_LEVELS`) on a blanket,
// city-wide `schools` infrastructure check. **Students, as a real
// population actually attached to a real building, were never built**
// — a `university` landmark (task #69's own multi-role staffing round)
// gets real STAFF via `config.institutionStaffing`, and nothing in
// this engine had ever generated the much larger real population a
// real university's own building implies: the students themselves.
//
// ---------------------------------------------------------------------
// Why this is not an organization membership
// ---------------------------------------------------------------------
// The obvious build is `membership.joinOrganization(..., role:
// 'student')` on the university's own `operating_organization_id` —
// and that id is the real, measured, SAME organization
// `landmarks.KEY_BUILDING_TYPES.university`'s `propertyType:
// 'government'` already points every real university's operator at
// (the region/civilization government, identical to a prison or a
// government building). `membership.memberCount`/`membersOf` are read
// by real, already-calibrated mechanics that were never measured
// against a membership this large: `control.js#compositionFor`'s own
// takeover DEFENDER count for the government itself, and `subGovernment
// .organizationCohesionOf`'s own "organization level IS memberCount"
// (hundred-and-twenty-seventh standing rule's own sibling round).
// Joining thousands of real students onto the government's own real
// membership roster would make a city's own government functionally
// un-takeable and silently collapse its real sub-government coverage
// ratio — the seventeenth standing rule's own dilution trap, caught
// here before it shipped rather than after. So enrollment is its own
// real, in-memory, per-NPC field (`npc.enrolledUniversityId`), the
// identical declared posture `npc.schoolEnrolled`
// (`statecraft.runSchooling`) and `worldState.familyTerritory`
// (hundred-and-twenty-seventh standing rule) already hold — a real
// fact this engine needs to detect a CROSSING with, never a schema
// addition and never a second use of an existing mechanism calibrated
// for something else.
//
// ---------------------------------------------------------------------
// The real population size: NCES, not a guess
// ---------------------------------------------------------------------
// NCES's own College Enrollment Rates indicator (nces.ed.gov/programs
// /coe/indicator/cpb, last updated May 2024): **39% of 18-to-24-year-
// olds** were enrolled in a degree-granting postsecondary institution
// or graduate school in 2022 (down from 41% in 2012). Used here as a
// real, cited target SHARE of each city's own real eligible-age
// population — never a per-person probability, and never a one-time
// snap to the national figure: `runEnrollment` recomputes real
// eligibility and real capacity fresh every tick, filling open real
// seats from the real pool a city actually has, the same "recompute,
// never cache" shape `statecraft.runSchooling` already established.
//
// ---------------------------------------------------------------------
// "Not employees," read literally
// ---------------------------------------------------------------------
// An active employment record anywhere (`economy.getEmployment`)
// disqualifies a resident from this population outright, on both
// sides of the crossing — becoming employed while enrolled is a real,
// honest `dropped_out`, not a status this engine tracks as both at
// once. A stated simplification, not a silent one: a real working
// student is a real person this engine does not yet model as both:
// the task's own name for this population is "not employees," and
// this file holds that line rather than quietly blurring it.
'use strict';

const demographics = require('./demographics.js');
const economy = require('./economy.js');
const mortality = require('./mortality.js');

// **Flagged interpretive.** The lower bound is the standard US
// college-entry age; the upper bound reuses `statecraft.js`'s own real
// `SCHOOL_AGE_MAX` (30) rather than inventing a second one.
const COLLEGE_AGE_MIN = 18;
const COLLEGE_AGE_MAX = 30;

// NCES College Enrollment Rates indicator, 2022 data (last updated May
// 2024): 39% of 18-24-year-olds enrolled in a degree-granting
// postsecondary institution or graduate school. Real, cited, not
// invented -- see this file's own header.
const NCES_COLLEGE_ENROLLMENT_RATE = 0.39;

function universitiesInCity(worldState, cityId) {
  return (worldState.properties || []).filter(
    (p) => p.landmark_category === 'university' && p.city_id === cityId,
  );
}

function isEnrolled(npc) {
  return npc.enrolledUniversityId !== null && npc.enrolledUniversityId !== undefined;
}

// Real eligibility, recomputed fresh every call, never cached: old
// enough, not already enrolled, not an active employee anywhere (this
// file's own "not employees" line), and has real room left on
// `demographics.EDUCATION_LEVELS` at or above `secondary` -- a real
// college student has finished secondary school and has not yet
// reached the top rung.
function eligibleForEnrollment(worldState, npc, tick) {
  if (isEnrolled(npc)) return false;
  if (economy.getEmployment(worldState, npc.id)) return false;
  const age = mortality.ageInYears(worldState, npc, tick);
  if (age === null || age < COLLEGE_AGE_MIN || age > COLLEGE_AGE_MAX) return false;
  const levels = demographics.EDUCATION_LEVELS;
  const at = levels.indexOf(npc.education);
  const secondaryAt = levels.indexOf('secondary');
  return at >= secondaryAt && at < levels.length - 1;
}

function studentsOf(worldState, universityPropertyId) {
  return (worldState.npcs || []).filter((n) => n.enrolledUniversityId === universityPropertyId);
}

// One real tick of enrollment: departures (graduation or lost
// eligibility) freeing real seats, then real new enrollment filling
// whatever capacity a city's own real university(ies) still have open.
// Returns real, typed events (`events.type`), the identical shape
// `births.advanceBonds`'s own `partnership_formed` rows already use --
// never a crime (`crime.recordCrime`), since neither enrolling nor
// graduating is an offence.
function runEnrollment(worldState, tick = worldState.tick ?? 0) {
  const emitted = [];
  const levels = demographics.EDUCATION_LEVELS;
  const top = levels.length - 1;

  const byCity = new Map();
  for (const npc of worldState.npcs || []) {
    const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
    const cityId = community ? community.city_id : null;
    if (cityId === null || cityId === undefined) continue;
    if (!byCity.has(cityId)) byCity.set(cityId, []);
    byCity.get(cityId).push(npc);
  }

  for (const [cityId, residents] of byCity) {
    const universities = universitiesInCity(worldState, cityId);

    // Real departures first, so a freed seat can be refilled the same
    // tick. Two different, real, honest reasons -- reaching the top
    // rung is a real graduation; losing eligibility while still short
    // of it (aged out, took a job, or the city's last real university
    // is gone) is a real, honest exit, never folded into the same
    // label.
    for (const npc of residents) {
      if (!isEnrolled(npc)) continue;
      const universityId = npc.enrolledUniversityId;
      const at = levels.indexOf(npc.education);
      const age = mortality.ageInYears(worldState, npc, tick);
      const stillHasRealUniversity = universities.some((u) => u.id === universityId);

      if (at >= top) {
        npc.enrolledUniversityId = null;
        emitted.push({
          type: 'student_graduated',
          severity: 'low',
          note: `Entity ${npc.id} graduated from university ${universityId}`,
          tick,
          affected_entity_ids: [npc.id],
          global_effects: {},
        });
      } else if (!stillHasRealUniversity || age === null || age > COLLEGE_AGE_MAX
        || economy.getEmployment(worldState, npc.id)) {
        npc.enrolledUniversityId = null;
        emitted.push({
          type: 'student_dropped_out',
          severity: 'low',
          note: `Entity ${npc.id} is no longer enrolled at university ${universityId}`,
          tick,
          affected_entity_ids: [npc.id],
          global_effects: {},
        });
      }
    }

    if (universities.length === 0) continue;

    const ageBandCount = residents.filter((n) => {
      const age = mortality.ageInYears(worldState, n, tick);
      return age !== null && age >= COLLEGE_AGE_MIN && age <= COLLEGE_AGE_MAX;
    }).length;
    const capacity = Math.round(ageBandCount * NCES_COLLEGE_ENROLLMENT_RATE);
    const currentlyEnrolled = residents.filter((n) => isEnrolled(n)).length;
    let openSeats = capacity - currentlyEnrolled;
    if (openSeats <= 0) continue;

    const eligiblePool = residents.filter((n) => eligibleForEnrollment(worldState, n, tick));
    for (let i = 0; i < eligiblePool.length && openSeats > 0; i += 1) {
      const npc = eligiblePool[i];
      const university = universities[i % universities.length];
      npc.enrolledUniversityId = university.id;
      emitted.push({
        type: 'student_enrolled',
        severity: 'low',
        note: `Entity ${npc.id} enrolled at university ${university.id}`,
        tick,
        affected_entity_ids: [npc.id],
        global_effects: {},
      });
      openSeats -= 1;
    }
  }

  return emitted;
}

module.exports = {
  COLLEGE_AGE_MIN,
  COLLEGE_AGE_MAX,
  NCES_COLLEGE_ENROLLMENT_RATE,
  universitiesInCity,
  isEnrolled,
  eligibleForEnrollment,
  studentsOf,
  runEnrollment,
};
