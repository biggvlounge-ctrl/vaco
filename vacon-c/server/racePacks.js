// server/racePacks.js
//
// **A real tract's race composition (Census ACS table B02001), read
// onto a new `npc.race` field — approved alongside veteran/disability/
// marital-status data, deferred once already for the same complexity
// reason `ancestryPacks.js` was: a new per-NPC field, not a re-centred
// existing one.**
//
// ---------------------------------------------------------------------
// Distinct from `npc.ethnicity`, on purpose
// ---------------------------------------------------------------------
// `ancestryPacks.js` already reads real Census ACS ancestry/national-
// origin data (table B04006 — German, Somali, Mexican, and so on) onto
// `npc.ethnicity`. Race (White, Black or African American, Asian, and
// so on) is a SEPARATE ACS question with its own table and its own
// categories — a person who answers "Mexican" to the ancestry question
// and "White" to the race question is answering two different real
// Census questions, not contradicting one. This module does not touch
// `npc.ethnicity`; it gives race its own field, the same way
// `jewishObservancePacks.js` gave branch its own field alongside
// `religion` rather than overloading it.
//
// ---------------------------------------------------------------------
// §9, carried through exactly as `ancestryPacks.js` carries it
// ---------------------------------------------------------------------
// `world-layer/imports/censusImport.js` writes shares for a PLACE,
// never a per-person fact. `raceFor` draws one NPC's value from those
// real local shares — the same mechanism `ancestryPacks.ethnicityFor`
// already uses. `test/race-packs.test.js` holds its own copy of
// `test/ethnicity.test.js`'s forbidden-file scan, the same way
// `test/islamic-sect-packs.test.js` and `test/jewish-observance-
// packs.test.js` already do for their own fields: nothing in this
// engine's generators may read `race` to gate morality, criminality,
// intelligence or worth, and `demographics.js`'s composition statistic
// is the only reader.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as every ACS tract
// ---------------------------------------------------------------------
// A tract has no name an auto-generated community can be matched to.
// Tracts are assigned by POSITION against the community's own index in
// the generation loop, cycling if there are fewer tracts than
// communities — standing rule 8 (§88). Same grain `populationPacks.js`
// and `ancestryPacks.js` use, since all three read the same ACS tract
// geography.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['us-census-acs', 'sample'];

//: Census ACS table B02001's own seven categories, duplicated here for
//: the cross-boundary reason above, and cross-checked by this module's
//: own test against `world-layer/imports/censusImport.js`'s copy.
const CATEGORIES = [
  'white', 'black-or-african-american', 'american-indian-or-alaska-native',
  'asian', 'native-hawaiian-or-pacific-islander', 'some-other-race', 'two-or-more-races',
];

const VOCABULARY = [...CATEGORIES];

function isShareObject(value, keys) {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) return false;
    const share = Number(value[key]);
    if (!Number.isFinite(share) || share < 0 || share > 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// validate — a pack is refused, never partly used
// ---------------------------------------------------------------------
function validatePack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['a pack must be an object'];
  if (!pack.region) problems.push('pack.region is required — a pack is per-region by definition');
  if (!SOURCES.includes(pack.source)) {
    problems.push(`pack.source must be one of: ${SOURCES.join(', ')}`);
  }
  if (!Array.isArray(pack.tracts) || pack.tracts.length === 0) {
    problems.push('pack.tracts must be a non-empty array');
    return problems;
  }

  pack.tracts.forEach((tract, i) => {
    const where = `tracts[${i}]${tract?.tractId ? ` (${tract.tractId})` : ''}`;
    if (!tract?.tractId) problems.push(`${where}: tractId is required`);
    if (tract.shares !== undefined && tract.shares !== null
      && !isShareObject(tract.shares, VOCABULARY)) {
      problems.push(`${where}: shares must be shares (0..1) keyed on ${VOCABULARY.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`race pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, since `npc.race` is simply null
// (unknown) for a world with no pack, the same posture `islamicSect`/
// `jewishObservance` take rather than falling back to an invented one.
function packFor(worldState) {
  return worldState?.racePack ?? null;
}

// The tract for a community at this position, cycling if there are
// fewer tracts than communities. Null when there is no pack.
function tractFor(pack, position) {
  if (!pack || !Array.isArray(pack.tracts) || pack.tracts.length === 0) return null;
  const index = ((position % pack.tracts.length) + pack.tracts.length) % pack.tracts.length;
  return pack.tracts[index];
}

// Cumulative cut points for a weighted pick over the stated
// vocabulary, built from a real share object. Mirrors
// `ancestryPacks.cutsFor` / `religionPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return VOCABULARY.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which race category a unit draw (0..1) falls into, against a
// tract's real shares, or null when the tract has none recorded or the
// shares do not sum to a positive total. Unlike `ethnicityFor`'s
// `unspecified` catch-all, there is no seventh bucket to fall into
// past the end — `two-or-more-races` is the last real category, so a
// draw landing past a rounding-short total still resolves to it rather
// than to an invented residual.
function raceFor(tract, unit) {
  if (!tract?.shares) return null;
  const cuts = cutsFor(tract.shares);
  const total = cuts[cuts.length - 1];
  if (total <= 0) return null;
  const scaled = unit * total;
  for (let i = 0; i < VOCABULARY.length; i += 1) {
    if (scaled < cuts[i]) return VOCABULARY[i];
  }
  return VOCABULARY[VOCABULARY.length - 1];
}

module.exports = {
  SOURCES,
  CATEGORIES,
  VOCABULARY,
  validatePack,
  assertPack,
  packFor,
  tractFor,
  raceFor,
};
