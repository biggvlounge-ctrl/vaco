// server/religionPacks.js
//
// **A real county's religious composition, read onto `npcs.religion`
// — the one column `demographics.js`'s own header named as real and
// set only from an option, in a world that otherwise draws it from a
// name this project invented for the setting.**
//
// ---------------------------------------------------------------------
// This one is not like the others, and the difference is on purpose
// ---------------------------------------------------------------------
// Every other pack in this engine replaces an INVENTED number with a
// REAL one — a wage band, a climate, a disease baseline. `worldgen.js`'s
// religion vocabulary (`'Tidewater', 'Ridge', 'None'`) is invented for a
// different, stated reason: the same file renames its ethnicities too,
// "because borrowing real ethnonyms would attach real-world
// associations to a simulation that models none of them." Wiring the
// U.S. Religion Census's real tradition names (Protestant, Catholic,
// Muslim, Jewish, and so on) onto procedurally generated people who are
// also subject to this engine's own crime, death and disease mechanics
// is exactly the attachment that renaming was written to avoid.
//
// This module exists anyway, on explicit instruction, after that
// tension was raised and the call was made to wire it in directly. It
// does not relax the §9 firewall on the way in — see below — and the
// invented vocabulary stays the default for every world this pack is
// not explicitly supplied to. The judgement about whether to USE this
// on a given world belongs to whoever builds that world, not to this
// reader.
//
// ---------------------------------------------------------------------
// §9, carried through from the import side
// ---------------------------------------------------------------------
// `world-layer/imports/religionImport.js` writes shares for a PLACE,
// never a per-person fact, and says why: religion is "the demographic
// where [the morality/criminality firewall] is easiest to violate by
// accident." This reader's own `religionFor` draws one NPC's value from
// those real local shares — the same mechanism `populationPacks.
// attainmentFor` already uses for educational attainment, at the same
// per-person grain `npcs.religion` has always been read at. The
// firewall itself is downstream of this column, in whatever reads
// `npc.religion` — nothing in this engine's generators uses `religion`
// to gate morality, criminality, intelligence or worth, and this reader
// adds no such read.
//
// ---------------------------------------------------------------------
// The licence is encumbered, and that is carried as data, not a comment
// ---------------------------------------------------------------------
// `sources.js` records `religionCensus` as the one source in the
// registry that is NOT public domain or an open licence — an academic
// archive with restricted redistribution terms. `LICENCE_WARNING` is
// exactly `religionImport.js`'s own text, carried through so the
// question cannot be lost between an import and a build.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a tract
// ---------------------------------------------------------------------
// A county has no name an auto-generated community can be matched to.
// So counties are assigned by POSITION against the community's own
// index in the generation loop, cycling if there are fewer counties
// than communities — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['us-religion-census', 'sample'];

//: `world-layer/imports/religionImport.js`'s own `TRADITIONS` —
//: duplicated for the same deployment reason every other pack
//: duplicates its source vocabulary, and cross-checked by this
//: module's own test.
const TRADITIONS = [
  'protestant', 'catholic', 'orthodox', 'jewish', 'muslim', 'buddhist',
  'hindu', 'sikh', 'bahai', 'latter-day-saints', 'jehovahs-witnesses', 'other',
];

//: `religionImport.js`'s own `UNAFFILIATED` — its own value, not a
//: tradition, and not a gap. See that module's header.
const UNAFFILIATED = 'unaffiliated';

const VOCABULARY = [...TRADITIONS, UNAFFILIATED];

//: `religionImport.js`'s own `LICENCE_WARNING`, verbatim. Carried on
//: every pack this module reads, exactly as the importer carries it on
//: every location it writes.
const LICENCE_WARNING = 'U.S. Religion Census / ARDA: academic archive terms, NOT public '
  + 'domain and NOT an open data licence. Redistribution of the underlying tables is '
  + 'restricted. Verify terms before shipping anything derived from this.';

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
  if (!Array.isArray(pack.counties) || pack.counties.length === 0) {
    problems.push('pack.counties must be a non-empty array');
    return problems;
  }

  pack.counties.forEach((county, i) => {
    const where = `counties[${i}]${county?.countyFips ? ` (${county.countyFips})` : ''}`;
    if (!county?.countyFips) {
      problems.push(`${where}: countyFips is required — this source is licence-encumbered, `
        + 'so where a figure came from is not optional');
    }
    if (county.shares !== undefined && county.shares !== null
      && !isShareObject(county.shares, VOCABULARY)) {
      problems.push(`${where}: shares must be shares (0..1) keyed on ${VOCABULARY.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`religion pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, because a world with no pack keeps
// the invented vocabulary it has always had.
function packFor(worldState) {
  return worldState?.religionPack ?? null;
}

// The county for a community at this position, cycling if there are
// fewer counties than communities. Null when there is no pack.
function countyFor(pack, position) {
  if (!pack || !Array.isArray(pack.counties) || pack.counties.length === 0) return null;
  const index = ((position % pack.counties.length) + pack.counties.length) % pack.counties.length;
  return pack.counties[index];
}

// Cumulative cut points for a weighted pick over the stated vocabulary,
// built from a real share object. Mirrors `populationPacks.cutsFor`.
function cutsFor(shares) {
  let running = 0;
  return VOCABULARY.map((key) => {
    running += Number(shares[key]) || 0;
    return running;
  });
}

// Which tradition a unit draw (0..1) falls into, against a county's
// real shares, or null when the county has none recorded. Returns the
// last vocabulary entry (`unaffiliated`) if the shares do not sum to 1
// and the draw lands past the end — real shares carry rounding.
function religionFor(county, unit) {
  if (!county?.shares) return null;
  const cuts = cutsFor(county.shares);
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
  TRADITIONS,
  UNAFFILIATED,
  VOCABULARY,
  LICENCE_WARNING,
  validatePack,
  assertPack,
  packFor,
  countyFor,
  religionFor,
};
