// server/landmarkPacks.js
//
// **Real named places, imported per region.**
//
// ---------------------------------------------------------------------
// The system this engine reinvented instead of consuming
// ---------------------------------------------------------------------
// `world-layer/UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` is the parent
// document behind `world-layer/`: one shared Earth model every gameplay
// system reads from, a hero/regional/filler tier vocabulary, a
// `landmarkData` slice on every location, and a runnable UNESCO
// importer. Its own status section ends:
//
//   "**Genuinely unbuilt**: the consumers. VACON-C is paused, so the
//   world model is generated and read by nothing yet."
//
// **VACON-C is not paused**, and `server/landmarks.js` was written here
// — thirty-three categories, its own significance scale, its own
// per-city placement, every landmark anonymous — without anybody
// finding that file. Two disagreeing answers to the same question,
// which is standing rule 3 at the level of whole systems. This module
// is the reconciliation, and it is a READER: `landmarks.js` keeps the
// categories and the significance model, and a pack supplies the real
// names, places and scores that the generated version has to make up.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`: ten apps reference
// `world-layer/` in comments and **none import it across a directory
// boundary**, which is what keeps each app's Docker build context
// valid. So a pack arrives the way `worldState.barterItems` and
// `flows.js`'s templates already do — as data on the world, supplied
// by whoever assembled it. `require('../world-layer')` would deploy
// two apps as one.
//
// ---------------------------------------------------------------------
// St. Louis is the worked example, not a special case
// ---------------------------------------------------------------------
// `AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` is explicit that a
// hand-typed landmark list is the wrong answer and that the real one is
// an automated per-region import — "when Claude Code imports a new
// region (**the same process already used for St. Louis**)". So this
// file knows nothing about St. Louis. It reads a pack; a pack is what
// an import produces; St. Louis is the first one.
//
// **The sources are unreachable from this environment and that is
// reported rather than worked around.** `query.wikidata.org`,
// `whc.unesco.org` and `services1.arcgis.com` (the NRHP feature
// service) all return 403 CONNECT at the agent proxy, re-checked
// directly rather than trusted from `imports/unescoImport.js`'s note.
// Per `/root/.ccr/README.md` that is report-do-not-work-around. The
// pipeline is built and reachable network makes it one fetch.

'use strict';

const landmarks = require('./landmarks.js');

//: A pack's own declaration of where its rows came from. Carried
//: through onto the world so a reader can always tell an imported
//: place from an invented one — which is the distinction
//: `AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` spends most of its
//: length insisting on.
const SOURCES = [
  'unesco-world-heritage-list',
  'national-register-of-historic-places',
  'cesium-osm-buildings',
  // A pack somebody typed. **Not a slur — a label.** It is what the
  // St. Louis sample in this repo is, because the three real sources
  // are blocked at the proxy, and a sample that claimed to be an NRHP
  // import would be the exact dishonesty that document was written to
  // stop.
  'sample',
];

//: `world-layer/locations.js`'s own `LOCATION_TIERS`, not a parallel
//: scale. A pack that came through that module carries its tier and
//: this keeps it rather than recomputing one.
const TIERS = ['hero', 'regional', 'filler'];

// ---------------------------------------------------------------------
// validate — a pack is refused, never partly used
// ---------------------------------------------------------------------
// Standing rule 6's shape: a pack with a category this engine does not
// know would silently place nothing, and a world would come out looking
// generated with no indication that an import had been asked for and
// dropped. So every row is checked before any row is used.
function validatePack(pack) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['a pack must be an object'];
  if (!pack.region) problems.push('pack.region is required — a pack is per-region by definition');
  if (!SOURCES.includes(pack.source)) {
    problems.push(`pack.source must be one of: ${SOURCES.join(', ')}`);
  }
  if (!Array.isArray(pack.locations) || pack.locations.length === 0) {
    problems.push('pack.locations must be a non-empty array');
    return problems;
  }

  pack.locations.forEach((location, i) => {
    const where = `locations[${i}]${location?.name ? ` (${location.name})` : ''}`;
    if (!location?.name) problems.push(`${where}: name is required`);
    if (!landmarks.ALL_CATEGORIES.includes(location?.category)) {
      problems.push(`${where}: "${location?.category}" is not a Key category`);
    }
    if (location.tier !== undefined && !TIERS.includes(location.tier)) {
      problems.push(`${where}: tier "${location.tier}" is not one of ${TIERS.join(', ')}`);
    }
    // Coordinates are optional — the NRHP and UNESCO both give them and
    // a hand-made pack may not, and a landmark with no coordinates is
    // still a landmark. But a HALF pair is a mistake, not a choice.
    const hasLat = location.lat !== undefined && location.lat !== null;
    const hasLng = location.lng !== undefined && location.lng !== null;
    if (hasLat !== hasLng) problems.push(`${where}: lat and lng must be given together`);
    if (hasLat && (!Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng)))) {
      problems.push(`${where}: lat/lng must be numeric`);
    }
    if (location.significance !== undefined && location.significance !== null) {
      const value = Number(location.significance);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        problems.push(`${where}: significance must be 0-100`);
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`landmark pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, because a world with no pack must
// still generate.
function packFor(worldState) {
  return worldState?.landmarkPack ?? null;
}

// ---------------------------------------------------------------------
// significanceFor — a pack's own score, or the category's band
// ---------------------------------------------------------------------
// A pack row may carry a significance; UNESCO inscription is treated as
// 100 by `world-layer/imports/unescoImport.js` and that judgement
// belongs to the importer, not here. Where a row gives none, the
// category's own band is used — so an imported place and a generated
// one are scored on the same scale and `discovery.findsAt`,
// `control.maintenanceFor` and `merchandise.stockOf` all keep working
// without knowing which kind they are looking at.
function significanceFor(location, fallback) {
  const given = Number(location?.significance);
  if (Number.isFinite(given)) return Math.max(0, Math.min(100, given));
  return fallback;
}

// Group a pack's locations by the area they belong to.
//
// **The per-area question, which is the one that was missing.**
// Landmarks were placed per CITY — six of them, drawn without
// replacement — so a world reached 11 of 33 categories and most of the
// Key never appeared anywhere. A pack names the area each place is in
// (`area`), because a real import knows which neighbourhood the
// cathedral is in and a generator does not.
//
// Locations with no area go in a `null` bucket, for the caller to place
// however it likes. That is not a defect in the pack: UNESCO gives a
// country and a coordinate, not a neighbourhood.
function byArea(pack) {
  const out = new Map();
  for (const location of pack.locations) {
    const key = location.area ?? null;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(location);
  }
  return out;
}

// ---------------------------------------------------------------------
// describePack — what an import actually brought
// ---------------------------------------------------------------------
function describePack(pack) {
  if (!pack) return { pack: null };
  const problems = validatePack(pack);
  const categories = new Set(pack.locations?.map((l) => l.category) ?? []);
  return {
    region: pack.region,
    source: pack.source,
    locations: pack.locations?.length ?? 0,
    categories: categories.size,
    // Which of the Key's thirty-three this region actually has. A real
    // city does not have all of them and should not pretend to.
    missingCategories: landmarks.ALL_CATEGORIES.filter((c) => !categories.has(c)),
    areas: [...byArea(pack).keys()].filter((a) => a !== null).length,
    withCoordinates: (pack.locations ?? []).filter((l) => l.lat !== undefined && l.lat !== null).length,
    usable: problems.length === 0,
    problems,
  };
}

module.exports = {
  SOURCES,
  TIERS,
  validatePack,
  assertPack,
  packFor,
  significanceFor,
  byArea,
  describePack,
};
