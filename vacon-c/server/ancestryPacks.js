// server/ancestryPacks.js
//
// **A real tract's ancestry/national-origin composition, read onto
// `npc.ethnicity` — the field `worldgen.js` otherwise draws from a
// name this project invented so it would not borrow real ethnonyms.**
//
// ---------------------------------------------------------------------
// This one is not like most others, and the tension is religionPacks.js's
// ---------------------------------------------------------------------
// Read `religionPacks.js`'s own header first — this is the same shape,
// one field over. `worldgen.js`'s ethnicity vocabulary (`'Riverborn',
// 'Highland', 'Coastwise', 'Outlander'`) is invented for a stated
// reason: borrowing real ethnonyms attaches real-world associations to
// a simulation that models none of them. Wiring real ancestry-group
// names onto procedurally generated people who are also subject to
// this engine's own crime, death and disease mechanics is exactly that
// attachment.
//
// This module exists anyway, on the same explicit instruction that
// wired `religionPacks.js` in: asked directly for real community
// character (Somali/Minneapolis, Bosnian/St. Louis, Jewish/New York
// style composition), the real answer is Census ACS ancestry data, and
// the call to wire it in was made after that tension was raised. The
// invented vocabulary stays the default for every world this pack is
// not explicitly supplied to.
//
// ---------------------------------------------------------------------
// §9, carried through from the import side — and easier to hold here
// ---------------------------------------------------------------------
// `world-layer/imports/ancestryImport.js` writes shares for a PLACE,
// never a per-person fact. This reader's `ethnicityFor` draws one
// NPC's value from those real local shares — the same mechanism
// `populationPacks.attainmentFor` and `religionPacks.religionFor`
// already use. §9 is actually easier to keep here than for religion:
// `test/ethnicity.test.js` already asserts, and keeps asserting, that
// NOTHING in this engine reads `npc.ethnicity` to decide an outcome.
// This reader changes what fills that field; it adds no new reader of
// it, and `demographics.js`'s composition statistic is still the only
// thing that looks at it.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as a tract
// ---------------------------------------------------------------------
// A tract has no name an auto-generated community can be matched to.
// Tracts are assigned by POSITION against the community's own index
// in the generation loop, cycling if there are fewer tracts than
// communities — standing rule 8 (§88). Same grain `populationPacks.js`
// uses, since both read the same ACS tract geography.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['us-census-acs-ancestry', 'sample'];

//: `world-layer/imports/ancestryImport.js`'s own `GROUPS` — duplicated
//: for the same deployment reason every other pack duplicates its
//: source vocabulary, and cross-checked by this module's own test.
//: Somali and Bosnian are their own groups, not folded into a region —
//: see that importer's header for why.
const GROUPS = [
  'german', 'irish', 'english', 'italian', 'polish', 'french', 'scottish',
  'dutch', 'norwegian', 'swedish', 'russian', 'ukrainian', 'greek',
  'portuguese', 'hungarian', 'czech', 'swiss', 'welsh', 'lithuanian',
  'arab', 'somali', 'bosnian', 'nigerian', 'ethiopian', 'ghanaian',
  'kenyan', 'subsaharan-african', 'west-indian', 'jamaican', 'haitian',
  'vietnamese', 'chinese', 'filipino', 'asian-indian', 'mexican',
  'guatemalan', 'honduran', 'salvadoran', 'israeli',
  // Added for `countryPacks.js`'s Venezuela/Cuba/Colombia/Dominican-
  // Republic/Iran gap. `cuban`, `dominican`, `colombian` and
  // `venezuelan` are real, specific detailed-origin categories
  // Census publishes in table B03001 ("Hispanic or Latino Origin by
  // Specific Origin") — the same real government source family
  // `mexican`/`guatemalan`/`honduran`/`salvadoran` already draw their
  // group names from, confirmed by direct variable lookup for
  // `cuban` (B03001_006E). `iranian` is a real B04006 ("People
  // Reporting Ancestry") code instead, confirmed the same way
  // `israeli` was — variable B04006_048E, present across every ACS
  // vintage checked from 2005 through 2024. See
  // `world-layer/imports/ancestryImport.js`'s header for the full
  // finding, including which of the seven countries this round
  // considered have NO real code and stay out.
  'cuban', 'dominican', 'colombian', 'venezuelan', 'iranian',
  // `egyptian` is the real B04006 code for the Arab-group row this
  // module's own prior round declined to add "this round too" for
  // lack of confidence in the research, not for lack of a real code
  // — B04006_007E, confirmed the same way `israeli`/`iranian` were.
  // See `countryPacks.js`'s own comment near its Egypt/Saudi-Arabia
  // decline for the full re-check; Saudi Arabian stays declined, no
  // matching B04006 row exists for it.
  'egyptian',
  'american', 'other',
];

//: `ancestryImport.js`'s own `UNSPECIFIED` — its own value, not a
//: group, and not a gap. See that module's header.
const UNSPECIFIED = 'unspecified';

const VOCABULARY = [...GROUPS, UNSPECIFIED];

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
    throw new Error(`ancestry pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, because a world with no pack keeps
// the invented vocabulary it has always had.
function packFor(worldState) {
  return worldState?.ancestryPack ?? null;
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
// `religionPacks.cutsFor` / `populationPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return VOCABULARY.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which ancestry group a unit draw (0..1) falls into, against a
// tract's real shares, or null when the tract has none recorded.
// Returns the last vocabulary entry (`unspecified`) if the shares do
// not sum to 1 and the draw lands past the end — real shares carry
// rounding and suppression.
function ethnicityFor(tract, unit) {
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
  GROUPS,
  UNSPECIFIED,
  VOCABULARY,
  validatePack,
  assertPack,
  packFor,
  tractFor,
  ethnicityFor,
};
