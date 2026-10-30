// server/landCoverPacks.js
//
// **A real global land-cover classification, stored directly on the
// city — deliberately NOT wired to any behavioral mechanism, and
// deliberately NOT reported through `statistics.js` either.**
//
// ---------------------------------------------------------------------
// Why this reports rather than drives anything
// ---------------------------------------------------------------------
// `world-layer/imports/earthenvImport.js`'s own header says this
// plainly: Consensus Land Cover is "a real, tested transform with no
// current VACON-C consumer" — checked directly (`grep -rn "forest\|
// landCover\|vegetation" server/*.js` returns nothing before this
// file). Every other pack reader in this registry either replaces an
// invented band (`incomePacks.js`, `woodPacks.js`) or narrows an
// existing one (`riskPacks.js`). VACON-C has no invented land-cover
// constant anywhere to replace, and this engine has no terrain or
// vegetation mechanic for a real class to feed — `usgsImport.js`'s own
// elevation import is in exactly the same position for the same
// reason, named in `world-layer/CLAUDE.md`'s own thirtieth standing
// rule. Inventing a causal link from a real class — a crop yield, a
// fire-risk multiplier, a building-material cost — would not be
// closing a gap; it would be fabricating a mechanic this engine was
// never asked to have.
//
// **Stored directly on the city, not reported through `statistics.js`
// — `climatePacks.js`'s own `regions.climate_key` is the precedent
// here, not `politicalPacks.js`'s `political_lean`.** Every unit
// `statistics.js`'s own catalogue uses is numeric or ordinal (count,
// currency, index, share, tier, years — checked directly), and a
// twelve-class categorical label has no honest place in it, the same
// reasoning `server/migrationPathwayPacks.js`'s own header gives for
// keeping a categorical `dominantPathway` out of that catalogue too.
// `city.landCoverClass` is in-memory only, the same known limitation
// as `city.hazardRisk` and `city.politicalLean`, and nothing reads it
// to decide anything else about a generated world.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a county
// ---------------------------------------------------------------------
// A Consensus Land Cover pixel is a real geographic point, not a named
// place an auto-generated city can be matched to. Assigned by the
// city's own position in the generation loop — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['earthenv-consensus-land-cover', 'sample'];

//: `world-layer/imports/earthenvImport.js`'s own `LAND_COVER_CLASSES`
//: — Tuanmu & Jetz's twelve published consensus classes, duplicated
//: here so a pack cannot carry a class this engine does not recognise.
const LAND_COVER_CLASSES = [
  'evergreen-needleleaf-forest',
  'evergreen-broadleaf-forest',
  'deciduous-needleleaf-forest',
  'deciduous-broadleaf-forest',
  'mixed-forest',
  'shrubland',
  'herbaceous-vegetation',
  'cultivated-and-managed',
  'regularly-flooded-vegetation',
  'urban-and-built-up',
  'snow-and-ice',
  'barren',
];

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
  if (!Array.isArray(pack.plots) || pack.plots.length === 0) {
    problems.push('pack.plots must be a non-empty array');
    return problems;
  }

  pack.plots.forEach((plot, i) => {
    const where = `plots[${i}]${plot?.plotId ? ` (${plot.plotId})` : ''}`;
    if (!plot?.plotId) problems.push(`${where}: plotId is required`);
    if (!LAND_COVER_CLASSES.includes(plot?.classKey)) {
      problems.push(`${where}: classKey must be one of the twelve published Consensus Land-Cover classes`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`land cover pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.landCoverPack ?? null;
}

// The plot for a city at this position, cycling if there are fewer
// plots than cities. Null when there is no pack.
function plotFor(pack, position) {
  if (!pack || !Array.isArray(pack.plots) || pack.plots.length === 0) return null;
  const index = ((position % pack.plots.length) + pack.plots.length) % pack.plots.length;
  return pack.plots[index];
}

// A real published land-cover class for this plot, or null — there is
// no invented fallback for a caller to fall back to, because nothing
// in this engine invents one.
function classFor(plot) {
  return LAND_COVER_CLASSES.includes(plot?.classKey) ? plot.classKey : null;
}

module.exports = {
  SOURCES,
  LAND_COVER_CLASSES,
  validatePack,
  assertPack,
  packFor,
  plotFor,
  classFor,
};
