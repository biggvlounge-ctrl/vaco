// server/nativityPacks.js
//
// **A real tract's nativity/citizenship-status composition (Census ACS
// table B05001, "Nativity and Citizenship Status in the United
// States"), read onto a new `npc.nativity` field — the Census ACS
// nativity/year-of-entry/citizenship-status source CLAUDE.md's thirty-
// third standing rule already approved, alongside ancestry, and
// deferred for the same reason: a new per-NPC field, not a re-centred
// existing one.**
//
// ---------------------------------------------------------------------
// The honest substitute for "ICE records and immigration status"
// ---------------------------------------------------------------------
// Individual immigration-enforcement records are not public, and a
// per-NPC "immigration status" field pulled from nowhere would be
// exactly the §9 violation this registry exists to avoid — a fact
// about one simulated person that no real source actually reports at
// that grain. What IS real and public is the same shape every other
// demographic field in this registry already uses: a PLACE's real
// composition, from the Census Bureau's own nativity/citizenship
// question. `npc.nativity` is drawn from that, the same way
// `npc.ethnicity` is drawn from ancestry and `npc.race` from race —
// never a record of one person's real-world status, because no such
// record exists to draw from.
//
// ---------------------------------------------------------------------
// Distinct from `npc.ethnicity` and `npc.race`, on purpose
// ---------------------------------------------------------------------
// Nativity/citizenship is its own real ACS question with its own
// table and its own categories — where somebody was born and whether
// they hold citizenship, not what ancestry or race they report. A
// person can answer "Mexican" to the ancestry question, "White" to
// the race question, and "U.S. citizen by naturalization" to this one;
// none of the three answers the other two. This module does not touch
// `npc.ethnicity` or `npc.race`; it gives nativity its own field, the
// same way `racePacks.js` gave race its own field alongside ethnicity.
//
// ---------------------------------------------------------------------
// §9, carried through exactly as `racePacks.js` carries it
// ---------------------------------------------------------------------
// `world-layer/imports/censusImport.js` writes shares for a PLACE,
// never a per-person fact. `nativityFor` draws one NPC's value from
// those real local shares — the same mechanism `racePacks.raceFor`
// already uses. `test/nativity-packs.test.js` holds its own copy of
// `test/ethnicity.test.js`'s forbidden-file scan: nothing in this
// engine's generators may read `nativity` to gate morality,
// criminality, intelligence or worth, and `demographics.js`'s
// composition statistic is the only reader.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as every ACS tract
// ---------------------------------------------------------------------
// A tract has no name an auto-generated community can be matched to.
// Tracts are assigned by POSITION against the community's own index in
// the generation loop, cycling if there are fewer tracts than
// communities — standing rule 8 (§88). Same grain `populationPacks.js`,
// `ancestryPacks.js` and `racePacks.js` use, since all four read the
// same ACS tract geography.
//
// ---------------------------------------------------------------------
// Year-of-entry is a declared gap, not a silent omission
// ---------------------------------------------------------------------
// CLAUDE.md's own approval named three things: nativity, year-of-
// entry, and citizenship status. B05001 gives the first and third
// together, in one real, clean table — a person's nativity and
// citizenship status are in practice one Census question with five
// answers, not two separate facts to force into two fields. Year-of-
// entry (B05005, "Period of Immigration") is a REAL, separate table
// this round did not build: it only applies to the foreign-born slice
// of a tract's population, needs its own real vocabulary of entry-
// period buckets, and is honestly a second module's worth of work, not
// a field this one can absorb without inventing a correspondence
// between two tables nobody asked this round to build. Left unbuilt
// and said so, same as `countryPacks.js` leaving eating-conditions and
// cultures unbuilt rather than filled with an invented placeholder.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['us-census-acs', 'sample'];

//: Census ACS table B05001's own five real categories (the sixth row,
//: "Total population", is the universe, not a category), duplicated
//: here for the cross-boundary reason above, and cross-checked by this
//: module's own test against `world-layer/imports/censusImport.js`'s
//: copy.
const CATEGORIES = [
  'us-born', 'born-in-territory', 'born-abroad-american-parent',
  'naturalized-citizen', 'non-citizen',
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
    throw new Error(`nativity pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, since `npc.nativity` is simply null
// (unknown) for a world with no pack, the same posture `race`/
// `islamicSect`/`jewishObservance` take rather than falling back to an
// invented one.
function packFor(worldState) {
  return worldState?.nativityPack ?? null;
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

// Which nativity/citizenship-status category a unit draw (0..1) falls
// into, against a tract's real shares, or null when the tract has none
// recorded or the shares do not sum to a positive total. Same
// no-residual-bucket shape as `racePacks.raceFor`: `non-citizen` is the
// last real category, so a draw landing past a rounding-short total
// still resolves to it rather than to an invented residual.
function nativityFor(tract, unit) {
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
  nativityFor,
};
