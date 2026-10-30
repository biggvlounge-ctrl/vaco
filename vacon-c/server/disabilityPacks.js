// server/disabilityPacks.js
//
// **A real tract's disability share (Census ACS table B18101), drawn
// onto a new `npc.disability` boolean field — approved alongside
// veteran/race/marital-status data, the same "new per-NPC field"
// complexity class `ancestryPacks.js` was.**
//
// ---------------------------------------------------------------------
// A single real share, not a categorical draw
// ---------------------------------------------------------------------
// Unlike race or marital status, ACS disability status is reported as
// one share — "with a disability" against the total population B18101
// covers — so this is a weighted coin flip against a real local rate,
// the same shape `nightLightsPacks.activityMultiplierFor` and
// `populationPacks.overdoseBaselineFor` already take reading a single
// real number per place, not the multi-category `cutsFor` machinery
// `racePacks.js`/`maritalStatusPacks.js` use for a real vocabulary of
// more than two outcomes.
//
// ---------------------------------------------------------------------
// §9, carried through exactly as every other per-NPC pack carries it
// ---------------------------------------------------------------------
// `world-layer/imports/censusImport.js` writes a share for a PLACE,
// never a per-person fact. `hasDisabilityFor` draws one NPC's boolean
// from that real local share. `test/disability-packs.test.js` holds
// its own copy of `test/ethnicity.test.js`'s forbidden-file scan:
// nothing in this engine's generators may read `disability` to gate
// morality, criminality, intelligence or worth, and `demographics.js`'s
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
    if (tract.disabilityShare !== undefined && tract.disabilityShare !== null
      && !isShare(tract.disabilityShare)) {
      problems.push(`${where}: disabilityShare must be a real share (0..1)`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`disability pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — `npc.disability` is simply null (unknown) for a world with no
// pack.
function packFor(worldState) {
  return worldState?.disabilityPack ?? null;
}

// The tract for a community at this position, cycling if there are
// fewer tracts than communities. Null when there is no pack.
function tractFor(pack, position) {
  if (!pack || !Array.isArray(pack.tracts) || pack.tracts.length === 0) return null;
  const index = ((position % pack.tracts.length) + pack.tracts.length) % pack.tracts.length;
  return pack.tracts[index];
}

// A real boolean draw against this tract's own disability share, or
// null when the tract has none recorded — unknown is not a `false`,
// the same distinction `effectiveTreeCoverPct` draws between an
// unobserved reading and a real zero.
function hasDisabilityFor(tract, unit) {
  const share = Number(tract?.disabilityShare);
  if (!isShare(share)) return null;
  return unit < share;
}

module.exports = {
  SOURCES,
  validatePack,
  assertPack,
  packFor,
  tractFor,
  hasDisabilityFor,
};
