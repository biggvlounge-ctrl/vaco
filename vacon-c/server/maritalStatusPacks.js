// server/maritalStatusPacks.js
//
// **A real tract's marital-status composition (Census ACS table
// B12001, population 15+), read onto a new `npc.maritalStatus` field —
// approved alongside race/veteran/disability data, the same "new
// per-NPC field" complexity class `ancestryPacks.js` and
// `islamicSectPacks.js` were.**
//
// ---------------------------------------------------------------------
// Drawn only for adults, same shape `education` already takes
// ---------------------------------------------------------------------
// ACS reports marital status for the population 15 and over; this
// engine has no concept of a 15-year-old being married in its own
// generators, and drawing a status for a child would assert a fact
// ACS itself does not measure. `worldgen.js` already gates `education`
// the same way ("set below, but only for adults") — `maritalStatusFor`
// is called only when the generated age clears the same adult
// threshold, and the field is `null` otherwise, same meaning `null`
// already carries for `education` on a child: not unmarried, simply
// not a question that applies yet.
//
// ---------------------------------------------------------------------
// §9, carried through exactly as `racePacks.js` carries it
// ---------------------------------------------------------------------
// `world-layer/imports/censusImport.js` writes shares for a PLACE,
// never a per-person fact. `maritalStatusFor` draws one NPC's value
// from those real local shares — the same mechanism every categorical
// pack reader in this registry already uses.
// `test/marital-status-packs.test.js` holds its own copy of
// `test/ethnicity.test.js`'s forbidden-file scan: nothing in this
// engine's generators may read `maritalStatus` to gate morality,
// criminality, intelligence or worth, and `demographics.js`'s
// composition statistic is the only reader.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as every ACS tract
// ---------------------------------------------------------------------
// A tract has no name an auto-generated community can be matched to.
// Tracts are assigned by POSITION against the community's own index in
// the generation loop, cycling if there are fewer tracts than
// communities — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['us-census-acs', 'sample'];

//: Census ACS table B12001's own five categories for population 15+,
//: duplicated here for the cross-boundary reason above, and cross-
//: checked by this module's own test against
//: `world-layer/imports/censusImport.js`'s copy.
const CATEGORIES = ['never-married', 'now-married', 'separated', 'widowed', 'divorced'];

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
    throw new Error(`marital status pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — `npc.maritalStatus` is simply null (unknown) for a world
// with no pack, same posture `race` takes above.
function packFor(worldState) {
  return worldState?.maritalStatusPack ?? null;
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
// `racePacks.cutsFor` / `ancestryPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return VOCABULARY.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which marital-status category a unit draw (0..1) falls into, against
// a tract's real shares, or null when the tract has none recorded, the
// shares do not sum to a positive total, or the person is not an
// adult — see this file's own header on why a child's status is
// `null` rather than guessed. `divorced` is the last real category, so
// a rounding-short draw resolves to it rather than to an invented
// residual, same posture `racePacks.raceFor` takes.
function maritalStatusFor(tract, unit) {
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
  maritalStatusFor,
};
