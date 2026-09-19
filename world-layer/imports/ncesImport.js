// Universal World Layer — NCES (CCD and IPEDS) import.
//
// **A real pupil-to-teacher ratio, for a mechanism that currently has
// no idea how big a school is.**
//
// ---------------------------------------------------------------------
// What it closes
// ---------------------------------------------------------------------
// `vacon-c/server/statecraft.js#runSchooling` advances people up
// `demographics.EDUCATION_LEVELS` from what a city funds. It reads the
// `funding` column its budget pass writes, and it knows nothing about
// the school itself — how many pupils are in it, how many teachers it
// has, whether it is a two-room building or a comprehensive.
//
// `hifldImport` already places public schools and colleges with an
// enrolment figure. NCES is where the rest of the school comes from,
// and it is the difference between a building and an institution:
//
//   CCD     every public elementary and secondary school in the
//           United States — enrolment, teachers (FTE), grade span,
//           locale, free-lunch eligibility.
//   IPEDS   every degree-granting institution — enrolment, staff,
//           admissions, completions, sector.
//
// Both are collected by the National Center for Education Statistics
// and published as U.S. Government Works: public domain, no key.
//
// ---------------------------------------------------------------------
// The ratio is the deliverable, and it is derived once, here
// ---------------------------------------------------------------------
// A pupil-to-teacher ratio is the one figure that transfers to a
// generated world unchanged. Enrolment does not — a generated
// community has thirty people, not nine hundred — but **how many
// pupils one teacher carries is scale-free**, which is the same
// argument `blsImport` makes for employment shares over head counts.
//
// It is also exactly what `control.maintenanceFor` needs: a school's
// crew is sized from how big the thing is, and for a school "how big"
// means pupils per teacher, not floor area.
//
// NETWORK CONSTRAINT, checked directly: `nces.ed.gov` is outside this
// environment's outbound proxy allowlist (403 CONNECT). `fetchNces`
// throws with that reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: The two NCES collections, and what each one is about. **The
//: collection must be named** — CCD and IPEDS have different schemas,
//: different identifiers and different meanings for "enrolment", and
//: guessing which one a row came from is how a primary school ends up
//: counted as a university.
const COLLECTIONS = {
  ccd: {
    label: 'Common Core of Data',
    covers: 'public elementary and secondary schools',
    idField: 'ncessch',
    category: 'school',
  },
  ipeds: {
    label: 'Integrated Postsecondary Education Data System',
    covers: 'degree-granting postsecondary institutions',
    idField: 'unitid',
    category: 'university',
  },
};

const COLLECTION_NAMES = Object.keys(COLLECTIONS);

//: CCD grade spans → the rungs of `demographics.EDUCATION_LEVELS` a
//: school actually serves. **Mapped rather than assumed**: a K-8 school
//: and a 9-12 school are both "a school" to `hifldImport` and serve
//: completely different parts of the ladder, which is the thing
//: `runSchooling` would need to know to place somebody correctly.
const GRADE_SPAN_LEVELS = {
  'PK-05': ['primary'],
  'KG-05': ['primary'],
  'KG-06': ['primary'],
  'KG-08': ['primary', 'secondary'],
  '06-08': ['secondary'],
  '07-08': ['secondary'],
  '09-12': ['secondary'],
  'KG-12': ['primary', 'secondary'],
};

//: IPEDS sectors this maps onto the one rung above secondary. The
//: engine's ladder has a single post-secondary step, so distinguishing
//: a community college from a research university here would be
//: producing detail nothing can read.
const IPEDS_LEVELS = ['tertiary'];

function collectionFor(collection) {
  return COLLECTIONS[collection] ?? null;
}

function levelsFor(gradeSpan) {
  if (typeof gradeSpan !== 'string') return null;
  return GRADE_SPAN_LEVELS[gradeSpan.trim().toUpperCase()] ?? null;
}

// Pupils per teacher, or null.
//
// **Null rather than a default, and the reason is the `Number(null)`
// corollary.** NCES suppresses staff counts for small schools, and a
// school with no reported teachers is not a school with no teachers.
// A ratio of Infinity or zero is worse than no ratio.
function pupilTeacherRatio(enrolment, teachers) {
  const pupils = Number(enrolment);
  const staff = Number(teachers);
  if (!Number.isFinite(pupils) || pupils <= 0) return null;
  if (!Number.isFinite(staff) || staff <= 0) return null;
  return Math.round((pupils / staff) * 10) / 10;
}

// Import one NCES collection's records.
//
// `records`: `{ name, enrolment, teachers, gradeSpan, locale, lat, lng,
// ncessch | unitid }`. Attaches to existing locations where an id
// matches, and is otherwise an attachment call away — see
// `importInstitution`.
function importNces(worldLayer, collection, records) {
  const definition = collectionFor(collection);
  if (!definition) {
    throw new Error(
      `importNces: "${collection}" is not an NCES collection. `
      + `Known: ${COLLECTION_NAMES.join(', ')}. CCD and IPEDS have different schemas and `
      + 'different meanings for enrolment, so which one a row came from cannot be guessed.',
    );
  }
  if (!Array.isArray(records)) {
    throw new Error('importNces requires an array of records');
  }

  const imported = [];
  const skipped = [];
  for (const record of records) {
    const id = record?.[definition.idField] ?? record?.id ?? null;
    if (!id) {
      skipped.push({ record, reason: `no ${definition.idField}` });
      continue;
    }
    // A record can only attach to a location somebody has already
    // placed — this importer deepens an institution, it does not site
    // one. `hifldImport` and `gnisImport` put schools on the map.
    const location = (worldLayer.locations || []).find(
      (l) => l.buildingData?.ncesId === id
        || (record?.name && l.name === record.name),
    );
    if (!location) {
      skipped.push({ id, name: record?.name ?? null, reason: 'no matching placed location' });
      continue;
    }
    importInstitution(worldLayer, location.id, collection, record);
    imported.push(location);
  }
  return { imported, skipped };
}

// Attach one institution's figures to a location that already exists.
function importInstitution(worldLayer, locationId, collection, record = {}) {
  const definition = collectionFor(collection);
  if (!definition) {
    throw new Error(
      `importInstitution: "${collection}" is not an NCES collection `
      + `(${COLLECTION_NAMES.join(', ')}).`,
    );
  }
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importInstitution: no location with id ${locationId}`);

  const enrolment = Number(record.enrolment);
  const teachers = Number(record.teachers);
  const ratio = pupilTeacherRatio(enrolment, teachers);
  const levels = collection === 'ipeds' ? IPEDS_LEVELS : levelsFor(record.gradeSpan);

  const existing = location.buildingData ?? {};
  setLocationData(worldLayer, locationId, 'buildingData', {
    ...existing,
    source: 'nces',
    licence: 'public-domain',
    collection,
    ncesId: record[definition.idField] ?? record.id ?? null,
    infrastructureType: 'schools',
    // The capacity figure, which `hifldImport` also carries. Kept in
    // the same shape so a consumer does not have to know which source
    // placed the school.
    capacity: Number.isFinite(enrolment) && enrolment > 0 ? enrolment : null,
    capacityUnit: collection === 'ipeds' ? 'students' : 'pupils',
    capacityReported: Number.isFinite(enrolment) && enrolment > 0,
    // The part NCES adds and nothing else has.
    teachersFte: Number.isFinite(teachers) && teachers > 0 ? teachers : null,
    pupilTeacherRatio: ratio,
    // **Which rungs of the ladder this place actually serves.** Null
    // where the grade span is unrecognised, never defaulted to the
    // whole ladder.
    educationLevels: levels,
    gradeSpan: record.gradeSpan ?? null,
    locale: record.locale ?? null,
  });
  return location;
}

// ---------------------------------------------------------------------
// describeSchoolCoverage — and how much of it is the ratio
// ---------------------------------------------------------------------
function describeSchoolCoverage(worldLayer) {
  const ratios = [];
  let schools = 0;
  let withRatio = 0;
  let withLevels = 0;
  for (const location of worldLayer.locations || []) {
    const data = location.buildingData;
    if (data?.source !== 'nces') continue;
    schools += 1;
    if (data.pupilTeacherRatio !== null && data.pupilTeacherRatio !== undefined) {
      withRatio += 1;
      ratios.push(data.pupilTeacherRatio);
    }
    if (Array.isArray(data.educationLevels) && data.educationLevels.length > 0) withLevels += 1;
  }
  ratios.sort((a, b) => a - b);
  return {
    schools,
    // **The headline, separated from the head count.** A school with an
    // enrolment and no staff figure is placed and still leaves the
    // ratio to a band, which is the number this import exists for.
    withRatio,
    withoutRatio: schools - withRatio,
    withEducationLevels: withLevels,
    medianRatio: ratios.length ? ratios[Math.floor(ratios.length / 2)] : null,
    lowestRatio: ratios[0] ?? null,
    highestRatio: ratios[ratios.length - 1] ?? null,
  };
}

function fetchNces() {
  throw new Error(
    'fetchNces is not implemented: nces.ed.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly). Both collections need no key: CCD '
    + 'publishes annual flat files per school year, IPEDS publishes complete data files and '
    + 'a custom-table tool. Pass rows to importNces(worldLayer, collection, records) or '
    + 'importInstitution(worldLayer, locationId, collection, record). Collections: '
    + `${COLLECTION_NAMES.join(', ')}.`,
  );
}

module.exports = {
  COLLECTIONS,
  COLLECTION_NAMES,
  GRADE_SPAN_LEVELS,
  IPEDS_LEVELS,
  collectionFor,
  levelsFor,
  pupilTeacherRatio,
  importNces,
  importInstitution,
  describeSchoolCoverage,
  fetchNces,
};
