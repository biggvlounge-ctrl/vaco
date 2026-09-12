// server/demographics.js
//
// What a population is made of — language, religion, education — and
// the one constraint the spec puts on measuring it.
//
// **§9's clause, first, because it shapes the whole file.** "The system
// supports demographic modeling without making demographics determine
// an NPC's morality, criminality, intelligence, or worth." That draws a
// line in a specific place: **composition is a legitimate area
// statistic; a demographic that predicts behaviour is what is
// forbidden.** So this module computes distributions and exposes
// nothing any decision path can read. No Key resolver, no contest, no
// crime generator and no fertility model takes an input from here, and
// `test/demographics.test.js` holds that by checking the source of
// every module that decides anything.
//
// ---------------------------------------------------------------------
// Why these three and not the obvious ones
//
// `statistics.js` declared `demographic_composition` unavailable with
// the reason "no demographic fields exist on an NPC at all". That was
// true of the fields people usually mean and **not true of three the
// schema already carries**:
//
//   `languages` + `entity_languages`  two real tables, with
//                                     proficiency and is_primary, and
//                                     zero lines of code touching
//                                     either — `urbanSystems.js` did
//                                     not even list them.
//   `npcs.religion`                   a real TEXT column, set only
//                                     from an option, null in every
//                                     generated world.
//   `npcs.education`                  the same.
//
// Race and ethnicity are **deliberately not added**. No column exists,
// no document in the package asks for one, and §9's clause makes
// inventing one a decision to take deliberately and explicitly rather
// than as a side effect of wanting a composition statistic. Language,
// religion and education are what the schema actually models, they are
// what a world can be seeded with from real data (see
// `dev-docs/LAND_AND_MAP_DATA.md`), and they are enough to answer the
// question the catalogue was asking.
//
// ---------------------------------------------------------------------
// A composition is not a comparable number, so both are produced
//
// A distribution — 60% one language, 30% another, 10% a third — cannot
// be z-scored against another area. Two scalars can, and both are
// standard:
//
//   **diversity**      1 - Σ(share²), the Simpson index. 0 when
//                      everybody shares one value, approaching 1 as a
//                      population fragments. Comparable anywhere.
//   **dominant share** the largest single share. Says something
//                      different from diversity — two areas can have
//                      the same diversity with a majority in one and
//                      no majority in the other.
//
// `statistics.js` carries the scalars; `compositionOf` returns the full
// distribution for anything that wants to show it.

'use strict';

const { nextAfter } = require('./nextAfter.js');

//: Flagged interpretive. `npcs.education` is TEXT with no comment and
//: no enumeration anywhere in the package — unlike almost every other
//: TEXT column in that schema, which carries its values in a comment.
//: §25's knowledge tiers are the system that would define these
//: properly and are unbuilt, so these are attainment BANDS, ordered,
//: and deliberately generic enough to map onto real data (the US ACS
//: educational-attainment tables, say) rather than onto one country's
//: school system.
const EDUCATION_LEVELS = ['none', 'basic', 'secondary', 'vocational', 'higher', 'advanced'];

let nextLanguageId = 1;

function reseedIds(worldState) {
  nextLanguageId = nextAfter(worldState.languages, 'id');
  return { nextLanguageId };
}

// -- languages ----------------------------------------------------------

function generateLanguage(worldState, options = {}) {
  const { name } = options;
  // `languages.name` is NOT NULL with no default.
  if (!name) {
    throw new Error('generateLanguage requires options.name (languages.name is NOT NULL).');
  }
  const parentId = options.parentLanguageId ?? null;
  if (parentId !== null && !worldState.languages.some((l) => l.id === parentId)) {
    throw new Error(`generateLanguage: no parent language ${parentId}`);
  }

  const language = {
    id: nextLanguageId++,
    name,
    // A language descended from another — the column exists and says
    // exactly this. Nothing reads the chain yet; it is written because
    // a world seeded from real data has one.
    parent_language_id: parentId,
    region_id: options.regionId ?? null,
  };
  worldState.languages.push(language);
  return language;
}

function findSpeaker(worldState, entityId, languageId) {
  return (worldState.entityLanguages || []).find(
    (r) => r.entity_id === entityId && r.language_id === languageId,
  ) || null;
}

// **Exactly one primary language per entity**, enforced rather than
// assumed: `entity_languages.is_primary` is a plain BOOLEAN with no
// constraint behind it, so two primaries is a row the database accepts
// and every composition statistic then double-counts that person.
function speakLanguage(worldState, options = {}) {
  const { entityId, languageId, proficiency = 100, isPrimary = false } = options;

  const npc = worldState.npcs.find((n) => n.id === entityId);
  if (!npc) throw new Error(`speakLanguage: ${entityId} is not among the living`);
  if (!worldState.languages.some((l) => l.id === languageId)) {
    throw new Error(`speakLanguage: no language ${languageId}`);
  }

  const existing = findSpeaker(worldState, entityId, languageId);
  const row = existing || {
    entity_id: entityId,
    language_id: languageId,
    proficiency: null,
    is_primary: false,
  };
  row.proficiency = proficiency;

  if (isPrimary) {
    for (const other of worldState.entityLanguages || []) {
      if (other.entity_id === entityId) other.is_primary = false;
    }
    row.is_primary = true;
  }

  if (!existing) worldState.entityLanguages.push(row);
  return row;
}

function languagesOf(worldState, entityId) {
  const rows = (worldState.entityLanguages || []).filter((r) => r.entity_id === entityId);
  return rows.map((r) => ({
    ...r,
    language: worldState.languages.find((l) => l.id === r.language_id) || null,
  }));
}

function primaryLanguageOf(worldState, entityId) {
  const row = (worldState.entityLanguages || []).find(
    (r) => r.entity_id === entityId && r.is_primary,
  );
  if (!row) return null;
  return worldState.languages.find((l) => l.id === row.language_id) || null;
}

// -- composition --------------------------------------------------------

// The distribution of one attribute across a set of people.
//
// **People with no value are counted as `unknown` rather than dropped
// or bucketed into a default.** A block where nobody's religion has
// been recorded and a block that is uniformly one religion are
// opposite findings, and silently dropping the unknowns makes the
// first look like the second.
function distributionOf(people, valueOf) {
  const counts = new Map();
  for (const person of people) {
    const value = valueOf(person);
    const key = value === null || value === undefined || value === '' ? 'unknown' : value;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = people.length;
  const rows = [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count,
      share: total === 0 ? null : Math.round((count / total) * 10000) / 10000,
    }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  return { total, rows };
}

// Simpson diversity: 1 - Σ(share²). 0 when everybody shares one value,
// approaching 1 as a population fragments.
//
// **`unknown` is excluded from the index and kept in the
// distribution.** Counting it as a category would make an unrecorded
// population read as a diverse one, which is the same unknown-is-not-a
// -value failure one level up.
function diversityOf(distribution) {
  const known = distribution.rows.filter((r) => r.value !== 'unknown');
  const total = known.reduce((a, r) => a + r.count, 0);
  if (total === 0) return null;
  const sum = known.reduce((a, r) => a + (r.count / total) ** 2, 0);
  return Math.round((1 - sum) * 10000) / 10000;
}

function dominantShareOf(distribution) {
  const known = distribution.rows.filter((r) => r.value !== 'unknown');
  const total = known.reduce((a, r) => a + r.count, 0);
  if (total === 0) return null;
  return Math.round((known[0].count / total) * 10000) / 10000;
}

// Every composition for one set of residents, in one pass.
function compositionOf(worldState, residents) {
  const language = distributionOf(residents, (n) => {
    const primary = primaryLanguageOf(worldState, n.id);
    return primary ? primary.name : null;
  });
  const religion = distributionOf(residents, (n) => n.religion ?? null);
  const education = distributionOf(residents, (n) => n.education ?? null);

  return {
    language: {
      distribution: language,
      diversity: diversityOf(language),
      dominantShare: dominantShareOf(language),
    },
    religion: {
      distribution: religion,
      diversity: diversityOf(religion),
      dominantShare: dominantShareOf(religion),
    },
    education: {
      distribution: education,
      diversity: diversityOf(education),
      dominantShare: dominantShareOf(education),
      // Ordered, so an average attainment is meaningful in a way an
      // average religion would not be. This is the one composition
      // here whose values have a direction.
      meanLevel: (() => {
        const known = residents
          .map((n) => EDUCATION_LEVELS.indexOf(n.education))
          .filter((i) => i >= 0);
        if (known.length === 0) return null;
        return Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 100) / 100;
      })(),
    },
  };
}

module.exports = {
  EDUCATION_LEVELS,
  reseedIds,
  generateLanguage,
  speakLanguage,
  findSpeaker,
  languagesOf,
  primaryLanguageOf,
  distributionOf,
  diversityOf,
  dominantShareOf,
  compositionOf,
};
