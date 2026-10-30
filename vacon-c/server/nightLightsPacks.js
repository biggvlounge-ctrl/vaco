// server/nightLightsPacks.js
//
// **A real global nighttime-light reading, as a SECOND, independent
// multiplier `incomePacks.valueRangeFor` compounds with real income
// and real inequality — the same shape `populationPacks.
// overdoseBaselineFor` already takes compounding with
// `healthBaseline` in `mortality.diseasePressure`, applied here to
// home value instead of disease pressure.**
//
// ---------------------------------------------------------------------
// Why a second input rather than a new mechanism
// ---------------------------------------------------------------------
// `world-layer/imports/earthEngineImport.js`'s own header names the
// real reason this is worth reading at all: nighttime-light radiance
// is a well-cited proxy for local economic activity, used in
// development economics specifically because it is measured
// identically everywhere, independent of whether a government
// publishes a census. `incomePacks.js` already re-centres and
// re-spreads `worldgen.js`'s invented home-value band from real
// Census ACS income and Gini — this is a second, independently
// measured real signal of the same underlying fact (how economically
// active a place is), not a new relationship to invent. Compounding
// it the way `overdoseBaseline` compounds with `healthBaseline`
// (multiply, do not replace) keeps the honest line `incomePacks.js`'s
// own header already draws: real inputs scale an existing band's
// shape, they do not get read as a value directly.
//
// ---------------------------------------------------------------------
// Narrowing, not dominating — a flagged, bounded multiplier
// ---------------------------------------------------------------------
// `earthEngineImport.ACTIVITY_BANDS` has no universal threshold
// behind it either, by that file's own admission. This module clamps
// the resulting multiplier to a real, stated, flagged range
// (`ACTIVITY_MULTIPLIER_BOUNDS`) so a very dark or very bright reading
// narrows the income-based range rather than overwhelming it — the
// same caution `crimeHotspotPacks.weightFor` already applies when
// multiplying a real external weight into an internal one.
//
// ---------------------------------------------------------------------
// Matched to a community by POSITION, same reason as a tract
// ---------------------------------------------------------------------
// A VIIRS composite pixel is a real geographic point, not a named
// place an auto-generated community can be matched to. Assigned by
// the community's own position in the generation loop, the identical
// position `incomePacks.tractFor` already uses — standing rule 8
// (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['viirs-dnb-via-earth-engine', 'sample'];

//: The reference radiance a plot's own real reading is scaled
//: AGAINST — the midpoint of `earthEngineImport.ACTIVITY_BANDS`'
//: own "lit" band (0.5-30 nW/cm²/sr), a flagged, interpretive
//: "ordinary" reference, the same posture `incomePacks.
//: ORDINARY_MEDIAN_INCOME` already takes for its own reference point.
const ORDINARY_RADIANCE_NW_PER_CM2_SR = 5;

//: How far a real reading may move the multiplier away from 1 —
//: narrowing the income-based range, never dominating it. Flagged,
//: interpretive; no document sets this.
const ACTIVITY_MULTIPLIER_BOUNDS = [0.5, 2];

function clamp(value, [low, high]) {
  return Math.min(high, Math.max(low, value));
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
    const radiance = Number(plot?.radianceNanoWattsPerCm2Sr);
    // A real monthly composite CAN read slightly below zero after
    // VIIRS' own stray-light correction — `earthEngineImport.js`'s
    // own header says so — so this validates finiteness, not a floor
    // at zero.
    if (plot?.radianceNanoWattsPerCm2Sr === undefined || plot?.radianceNanoWattsPerCm2Sr === null
      || !Number.isFinite(radiance)) {
      problems.push(`${where}: radianceNanoWattsPerCm2Sr must be a real, finite number`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`night lights pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.nightLightsPack ?? null;
}

// The plot for a community at this position, cycling if there are
// fewer plots than communities. Null when there is no pack.
function plotFor(pack, position) {
  if (!pack || !Array.isArray(pack.plots) || pack.plots.length === 0) return null;
  const index = ((position % pack.plots.length) + pack.plots.length) % pack.plots.length;
  return pack.plots[index];
}

// A real, bounded multiplier for this plot — 1 (no change) when the
// plot has no real reading, never an invented default pretending to
// be a measurement.
function activityMultiplierFor(plot) {
  const radiance = Number(plot?.radianceNanoWattsPerCm2Sr);
  if (!Number.isFinite(radiance)) return 1;
  return clamp(radiance / ORDINARY_RADIANCE_NW_PER_CM2_SR, ACTIVITY_MULTIPLIER_BOUNDS);
}

module.exports = {
  SOURCES,
  ORDINARY_RADIANCE_NW_PER_CM2_SR,
  ACTIVITY_MULTIPLIER_BOUNDS,
  validatePack,
  assertPack,
  packFor,
  plotFor,
  activityMultiplierFor,
};
