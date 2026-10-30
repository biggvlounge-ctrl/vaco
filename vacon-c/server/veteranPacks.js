// server/veteranPacks.js
//
// **A real tract's veteran share (Census ACS table B21001, civilian
// population 18+), drawn onto a new `npc.veteranStatus` boolean field
// — approved alongside disability/race/marital-status data, the same
// "new per-NPC field" complexity class `ancestryPacks.js` was.**
//
// ---------------------------------------------------------------------
// Drawn only for adults, same shape `maritalStatusFor` takes
// ---------------------------------------------------------------------
// B21001 covers the civilian population 18 and over; a minor cannot
// be a veteran, so `hasVeteranStatusFor` is called only when the
// generated age clears the same adult threshold `worldgen.js` already
// uses for `education` and `maritalStatusPacks.maritalStatusFor`. The
// field is `null` for a child, same meaning `null` already carries for
// `education` there — not "not a veteran", simply a question that does
// not apply yet.
//
// ---------------------------------------------------------------------
// A single real share, not a categorical draw — same shape `disabilityPacks.js` takes
// ---------------------------------------------------------------------
// ACS veteran status is one share — veteran against the civilian
// population 18+ B21001 covers — so this is a weighted coin flip
// against a real local rate, the same mechanism `disabilityPacks
// .hasDisabilityFor` already uses, not the multi-category `cutsFor`
// machinery a real vocabulary of more than two outcomes needs.
//
// ---------------------------------------------------------------------
// §9, carried through exactly as every other per-NPC pack carries it
// ---------------------------------------------------------------------
// `world-layer/imports/censusImport.js` writes a share for a PLACE,
// never a per-person fact. `test/veteran-packs.test.js` holds its own
// copy of `test/ethnicity.test.js`'s forbidden-file scan: nothing in
// this engine's generators may read `veteranStatus` to gate morality,
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

function isShare(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1;
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
    if (tract.veteranShare !== undefined && tract.veteranShare !== null
      && !isShare(tract.veteranShare)) {
      problems.push(`${where}: veteranShare must be a real share (0..1)`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`veteran pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — `npc.veteranStatus` is simply null (unknown) for a world
// with no pack.
function packFor(worldState) {
  return worldState?.veteranPack ?? null;
}

// The tract for a community at this position, cycling if there are
// fewer tracts than communities. Null when there is no pack.
function tractFor(pack, position) {
  if (!pack || !Array.isArray(pack.tracts) || pack.tracts.length === 0) return null;
  const index = ((position % pack.tracts.length) + pack.tracts.length) % pack.tracts.length;
  return pack.tracts[index];
}

// A real boolean draw against this tract's own veteran share, or null
// when the tract has none recorded — unknown is not a `false`, the
// same distinction `disabilityPacks.hasDisabilityFor` draws.
function hasVeteranStatusFor(tract, unit) {
  const share = Number(tract?.veteranShare);
  if (!isShare(share)) return null;
  return unit < share;
}

module.exports = {
  SOURCES,
  validatePack,
  assertPack,
  packFor,
  tractFor,
  hasVeteranStatusFor,
};
