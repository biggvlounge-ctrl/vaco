// server/landCoverPacks.js
//
// **A real global land-cover classification, stored directly on the
// city, and — added 30 Oct 2026 by direct request after the fact was
// raised that it drove nothing — two narrow, bounded nudges onto two
// existing mechanisms it corroborates or qualifies. Still deliberately
// NOT reported through `statistics.js`.**
//
// ---------------------------------------------------------------------
// Why this was reported-only, and what changed
// ---------------------------------------------------------------------
// `world-layer/imports/earthenvImport.js`'s own header said this
// plainly: Consensus Land Cover was "a real, tested transform with no
// current VACON-C consumer." That was true until two uses were asked
// for directly, and both were picked because they are the two places
// this engine already has a mechanism a land-cover class can
// legitimately speak to without inventing a new one:
//
// - **`woodMultiplierFor`** nudges `woodPacks.woodSupplyRangeFor`'s
//   own real GLAD tree-cover reading — a forest-classified plot
//   corroborates "there is real standing wood here" and a non-forest
//   one damps it, bounded to ±15% so the GLAD percentage (continuous,
//   and already the primary signal) still does almost all of the
//   work. This is two real datasets describing the same underlying
//   fact — forest extent — the same "second, independent real
//   signal" shape `nightLightsPacks.js` already takes compounding
//   into `incomePacks.valueRangeFor`, not a new causal claim.
// - **`homeValueMultiplierFor`** nudges `incomePacks.valueRangeFor`'s
//   real income-based home-value centre, and only for three classes
//   with a well-established, one-directional real-estate effect:
//   `urban-and-built-up` (developed infrastructure and amenities)
//   raises it; `regularly-flooded-vegetation` (a real flood-plain
//   discount: flood insurance, building restriction) and
//   `snow-and-ice`/`barren` (extreme or undeveloped terrain) lower it.
//   Every other class — forest, shrubland, herbaceous vegetation,
//   cultivated land — stays at the neutral `1`, because whether a
//   wooded or rural setting raises or lowers a home's value is not a
//   well-established one-directional fact the way those three are;
//   inventing a direction for them would be exactly the mistake this
//   file's own prior header warned against.
//
// Inventing a causal link beyond these two — a crop yield, a fire-risk
// multiplier, a building-material cost — remains out of scope; nothing
// here asked for those, and `usgsImport.js`'s own elevation import is
// still in the position named in `world-layer/CLAUDE.md`'s thirtieth
// standing rule, real and unconsumed.
//
// **Still stored directly on the city, not reported through
// `statistics.js` — `climatePacks.js`'s own `regions.climate_key` is
// the precedent here, not `politicalPacks.js`'s `political_lean`.**
// Every unit `statistics.js`'s own catalogue uses is numeric or
// ordinal (count, currency, index, share, tier, years — checked
// directly), and a twelve-class categorical label has no honest place
// in it, the same reasoning `server/migrationPathwayPacks.js`'s own
// header gives for keeping a categorical `dominantPathway` out of that
// catalogue too. `city.landCoverClass` is in-memory only, the same
// known limitation as `city.hazardRisk` and `city.politicalLean`.
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

//: The five of twelve published classes a forest canopy actually
//: describes — duplicated from `woodPacks.js`'s own reasoning, not
//: from that file, so this module stays self-contained.
const FOREST_CLASSES = [
  'evergreen-needleleaf-forest',
  'evergreen-broadleaf-forest',
  'deciduous-needleleaf-forest',
  'deciduous-broadleaf-forest',
  'mixed-forest',
];

//: Narrow on purpose — the real GLAD tree-cover percentage
//: (`woodPacks.effectiveTreeCoverPct`) is the primary, continuous
//: signal; this is a corroborating or damping NUDGE on top of it, not
//: a second vote of equal weight.
const WOOD_MULTIPLIER_BOUNDS = [0.85, 1.15];

// A bounded wood-supply nudge for this class — this file's own header
// explains why forest classes corroborate (the upper bound) and every
// other class damps (the lower bound) rather than a continuous scale:
// there is no published ratio between a land-cover class and a wood
// yield to scale by. `1` (no change) for a null/unrecognised class.
function woodMultiplierFor(classKey) {
  if (!LAND_COVER_CLASSES.includes(classKey)) return 1;
  return FOREST_CLASSES.includes(classKey) ? WOOD_MULTIPLIER_BOUNDS[1] : WOOD_MULTIPLIER_BOUNDS[0];
}

//: The two directions this file's header argues are real and
//: well-established, and nothing else — see that header for why
//: forest/shrubland/herbaceous/cultivated classes stay neutral.
const HOME_VALUE_RAISING_CLASSES = ['urban-and-built-up'];
const HOME_VALUE_LOWERING_CLASSES = ['regularly-flooded-vegetation', 'snow-and-ice', 'barren'];
const HOME_VALUE_MULTIPLIER_BOUNDS = [0.85, 1.15];

// A bounded home-value nudge for this class — `1` (no change) for a
// null, unrecognised, or deliberately-neutral class. See this file's
// own header for which three classes move and why the other nine do
// not.
function homeValueMultiplierFor(classKey) {
  if (!LAND_COVER_CLASSES.includes(classKey)) return 1;
  if (HOME_VALUE_RAISING_CLASSES.includes(classKey)) return HOME_VALUE_MULTIPLIER_BOUNDS[1];
  if (HOME_VALUE_LOWERING_CLASSES.includes(classKey)) return HOME_VALUE_MULTIPLIER_BOUNDS[0];
  return 1;
}

module.exports = {
  SOURCES,
  LAND_COVER_CLASSES,
  FOREST_CLASSES,
  WOOD_MULTIPLIER_BOUNDS,
  HOME_VALUE_RAISING_CLASSES,
  HOME_VALUE_LOWERING_CLASSES,
  HOME_VALUE_MULTIPLIER_BOUNDS,
  validatePack,
  assertPack,
  packFor,
  plotFor,
  classFor,
  woodMultiplierFor,
  homeValueMultiplierFor,
};
