// server/terrainPacks.js
//
// **A real USGS 3DEP elevation-derived terrain classification, re-
// centring and re-spreading the invented residential construction-
// cost band `construction.js#costFor` draws from — added 30 Oct 2026
// by direct request, after a question about what mechanic terrain
// should feed was put back to the person who asked for it, rather
// than invented here.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `world-layer/imports/usgsImport.js`'s own header names the exact
// problem: "`locations.generateLocation` takes a `terrainType` and
// every caller in this repository passes `null`... so every place in
// every world is equally flat." `classifyTerrain` has been real,
// tested, and read by nothing in VACON-C since it was written —
// `usgsImport.js`'s own four relief bands (`flat`, `rolling`, `hilly`,
// `mountainous`) are duplicated here for the same cross-boundary
// reason every other pack duplicates its source vocabulary.
//
// ---------------------------------------------------------------------
// Why construction cost, and why `construction.js#costFor` specifically
// ---------------------------------------------------------------------
// `construction.js`'s own header is explicit that its cost is NOT
// invented twice: it draws a new home's cost from the identical
// `[4000, 60000]` band `worldgen.js` already draws from at generation,
// "so a house built mid-world costs what the same house would have
// cost if `worldgen` had built it at the start." That invented band,
// shared by both call sites, is exactly the kind of number this
// registry's other packs re-centre with a real reading rather than
// replace outright — the same posture `incomePacks.js` takes with
// real income and `woodPacks.js` takes with real tree cover. There is
// no cited ratio between terrain steepness and construction cost, so
// — like every other re-centred band here — the multiplier below is
// flagged interpretive, chosen against what site-difficulty premiums
// (foundation work, grading, retaining walls, access) are commonly
// described as in construction-cost literature, not measured from one
// specific study.
//
// `worldgen.js`'s own generation-time home/premises construction is
// deliberately NOT touched: both are created already in
// `lifecycle_stage: 'operation'`, bypassing the planning/construction
// timer entirely, so there is no real "this house was built on a
// slope" event to price there. `construction.js#runConstruction` is
// the only place in this engine a property is actually CONSTRUCTED —
// `advancePropertyLifecycle` walks it through `planning` and
// `construction` on `BUILD_TICKS`, picking up what this file starts —
// so it is the one real consumer this signal has.
//
// ---------------------------------------------------------------------
// Resolved once per city, read every tick — same shape as `city.hazardRisk`
// ---------------------------------------------------------------------
// `environment.js#drawWeather` already reads `city.hazardRisk`, set
// once at generation, on every tick for the life of the world — the
// established pattern for a real signal a RUNTIME system (not just
// generation) needs. `city.terrainClass` is the same shape: assigned
// once in `worldgen.js`'s city loop, read by `construction.js` on
// every tick `runConstruction` fires, for exactly the city the builder
// lives in.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a county or a tract
// ---------------------------------------------------------------------
// A 3DEP sample is a real geographic point, not a named place an
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

const SOURCES = ['usgs-3dep', 'sample'];

//: `world-layer/imports/usgsImport.js`'s own `RELIEF_BANDS` terrain
//: names, duplicated here for the cross-boundary reason above.
const TERRAIN_CLASSES = ['flat', 'rolling', 'hilly', 'mountainous'];

//: Flagged interpretive — see this file's own header. `flat` is the
//: baseline (no change), matching every other re-centred band in this
//: registry using its own ordinary reference as 1.
const CONSTRUCTION_COST_MULTIPLIER = {
  flat: 1,
  rolling: 1.15,
  hilly: 1.35,
  mountainous: 1.6,
};

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
    if (!TERRAIN_CLASSES.includes(plot?.terrain)) {
      problems.push(`${where}: terrain must be one of: ${TERRAIN_CLASSES.join(', ')}`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`terrain pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.terrainPack ?? null;
}

// The plot for a city at this position, cycling if there are fewer
// plots than cities. Null when there is no pack.
function plotFor(pack, position) {
  if (!pack || !Array.isArray(pack.plots) || pack.plots.length === 0) return null;
  const index = ((position % pack.plots.length) + pack.plots.length) % pack.plots.length;
  return pack.plots[index];
}

// A real published terrain class for this plot, or null — there is no
// invented fallback for a caller to fall back to, because nothing in
// this engine invents one.
function classFor(plot) {
  return TERRAIN_CLASSES.includes(plot?.terrain) ? plot.terrain : null;
}

// A bounded, flagged-interpretive construction-cost multiplier for
// this class — `1` (no change) for a null or unrecognised class.
function constructionCostMultiplierFor(classKey) {
  if (!TERRAIN_CLASSES.includes(classKey)) return 1;
  return CONSTRUCTION_COST_MULTIPLIER[classKey];
}

module.exports = {
  SOURCES,
  TERRAIN_CLASSES,
  CONSTRUCTION_COST_MULTIPLIER,
  validatePack,
  assertPack,
  packFor,
  plotFor,
  classFor,
  constructionCostMultiplierFor,
};
