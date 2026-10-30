// server/woodPacks.js
//
// **A real global forest-cover reading, re-centering and re-spreading
// the invented `wood` resource supply band — the twenty-seventh
// standing rule's own shape, found a round later than it could have
// been.**
//
// ---------------------------------------------------------------------
// The gap this closes, and the comment that hid it
// ---------------------------------------------------------------------
// `worldgen.js`'s own city-resource loop draws every city's `wood`
// supply from `random.range(60, 140, 'res', c, resourceType)` — a flat
// band, identical in every city in every world, with no citation.
// That same file's header carries a comment naming `timber` as an
// example — "this was `['food','water','medicine','energy','timber']`
// ... and `timber` is not a §28 resource type at all (the spec says
// `wood`)." The canonical resource type is, and has always been,
// `wood` (`CITY_RESOURCES`), not `timber` — checked directly before
// writing this file, rather than trusted from that comment, which is
// itself a `citation is not presence` artefact one level further in:
// a stale example name, still sitting in a comment, describing a
// resource type this engine never actually used.
//
// `world-layer/imports/gladImport.js` (University of Maryland GLAD
// lab's Global Forest Change dataset — real annual tree-cover loss,
// 2001-present, from a real 2000 baseline) has carried a real,
// per-location forest-cover reading since it was built, with no
// VACON-C reader at all until this file.
//
// ---------------------------------------------------------------------
// Why this re-centres the supply band rather than replacing it
// ---------------------------------------------------------------------
// `incomePacks.js`'s own header already makes this argument once:
// there is no published ratio between a real percentage and this
// engine's own invented unit scale for a resource's `quantity`/
// `supply`, so the honest move is to scale the EXISTING band's shape
// by a real signal rather than invent a second relationship between
// a real percentage and an invented unit. Applied here the same way.
//
// ---------------------------------------------------------------------
// A real, stated choice for `lost-forest`: the stock is gone, so the
// year-2000 baseline is not used as if it still stood
// ---------------------------------------------------------------------
// `gladImport.classifyForestStatus` reports three real statuses:
// `intact-forest`, `lost-forest`, `non-forest`. A `lost-forest` plot's
// own `treeCoverPct2000` describes forest that existed in 2000 and was
// cleared since — using that figure as today's real wood supply would
// overstate a stock that is no longer standing. `effectiveTreeCoverPct`
// treats a cleared plot as 0% for this purpose, the same honest
// distinction `gladImport.js`'s own header draws between a pixel with
// no RECORDED loss and one recorded as lost.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a county or a tract
// ---------------------------------------------------------------------
// A GLAD plot is a real geographic point, not a named place an
// auto-generated city can be matched to. Assigned by the city's own
// position in the generation loop — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['glad-global-forest-change', 'sample'];
const FOREST_STATUSES = ['intact-forest', 'lost-forest', 'non-forest'];

//: `worldgen.js`'s own invented band for `wood` supply — duplicated
//: here so a real reading can scale its shape proportionally rather
//: than this module inventing a second relationship.
const INVENTED_WOOD_SUPPLY_RANGE = [60, 140];

//: The reference tree-cover percentage a plot's own real figure is
//: scaled AGAINST to move the invented band's centre — a flagged,
//: interpretive "moderate forest cover" reference, the same posture
//: `incomePacks.ORDINARY_MEDIAN_INCOME` already takes for its own
//: reference point. No document gives one; a caller with a better
//: regional reference should pass its own.
const ORDINARY_TREE_COVER_PCT = 50;

function isPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
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
  if (!Array.isArray(pack.plots) || pack.plots.length === 0) {
    problems.push('pack.plots must be a non-empty array');
    return problems;
  }

  pack.plots.forEach((plot, i) => {
    const where = `plots[${i}]${plot?.plotId ? ` (${plot.plotId})` : ''}`;
    if (!plot?.plotId) problems.push(`${where}: plotId is required`);
    if (!isPercent(plot?.treeCoverPct2000)) {
      problems.push(`${where}: treeCoverPct2000 must be a real percentage (0..100)`);
    }
    if (!FOREST_STATUSES.includes(plot?.status)) {
      problems.push(`${where}: status must be one of: ${FOREST_STATUSES.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`wood pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.woodPack ?? null;
}

// The plot for a city at this position, cycling if there are fewer
// plots than cities. Null when there is no pack.
function plotFor(pack, position) {
  if (!pack || !Array.isArray(pack.plots) || pack.plots.length === 0) return null;
  const index = ((position % pack.plots.length) + pack.plots.length) % pack.plots.length;
  return pack.plots[index];
}

// A real effective tree-cover percentage for TODAY, not for the
// plot's own 2000 baseline — see this file's own header on why
// `lost-forest` reads as 0 rather than its stale baseline.
function effectiveTreeCoverPct(plot) {
  if (!isPercent(plot?.treeCoverPct2000)) return null;
  if (plot.status === 'lost-forest') return 0;
  return Number(plot.treeCoverPct2000);
}

// A real [low, high] wood-supply range for this plot — the invented
// band, re-centred on a real effective tree-cover reading — or null
// when the plot has none. `worldgen.js` draws within this range
// exactly as it draws within the invented one.
//
// `options.landCoverMultiplier` is `landCoverPacks.woodMultiplierFor`'s
// own real, bounded nudge — a SECOND, independent real signal
// corroborating or damping the GLAD reading above, the same
// "compound, don't replace" shape `incomePacks.valueRangeFor` already
// takes with `nightLightsPacks.activityMultiplierFor`. Defaults to 1
// (no change), and is only applied when a real GLAD reading already
// produced a centre — land cover alone, with no wood pack, invents
// nothing.
function woodSupplyRangeFor(plot, options = {}) {
  const { landCoverMultiplier = 1 } = options;
  const effective = effectiveTreeCoverPct(plot);
  if (effective === null) return null;

  const [inventedLow, inventedHigh] = INVENTED_WOOD_SUPPLY_RANGE;
  const inventedCentre = (inventedLow + inventedHigh) / 2;
  const inventedHalfWidth = (inventedHigh - inventedLow) / 2;
  const landCover = Number.isFinite(landCoverMultiplier) ? landCoverMultiplier : 1;

  // A real zero (non-forest, or forest that was lost) scales the
  // centre to zero rather than to the invented floor — a place with
  // no real standing forest has no real wood supply to report, and a
  // non-zero floor here would quietly re-invent the fact this reading
  // was built to replace. The land-cover nudge multiplies the same way
  // zero stays zero either way.
  const centre = inventedCentre * (effective / ORDINARY_TREE_COVER_PCT) * landCover;
  const halfWidth = inventedHalfWidth * (effective / ORDINARY_TREE_COVER_PCT) * landCover;

  const low = Math.max(0, Math.round(centre - halfWidth));
  const high = Math.max(low, Math.round(centre + halfWidth));
  return [low, high];
}

module.exports = {
  SOURCES,
  FOREST_STATUSES,
  INVENTED_WOOD_SUPPLY_RANGE,
  ORDINARY_TREE_COVER_PCT,
  validatePack,
  assertPack,
  packFor,
  plotFor,
  effectiveTreeCoverPct,
  woodSupplyRangeFor,
};
