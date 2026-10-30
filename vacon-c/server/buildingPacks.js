// server/buildingPacks.js
//
// **A real Overture Maps building footprint, re-centring the invented
// `landSize`/`floors` a generated home has drawn since Phase 1 — the
// one join `world-layer/CLAUDE.md`'s own thirtieth standing rule left
// open because it needed one real row per ordinary generated HOME,
// not one per city or community like every other pack here.**
//
// ---------------------------------------------------------------------
// Why this needed its own round
// ---------------------------------------------------------------------
// Every other pack reader in this registry is assigned at the city or
// community grain — one real tract, county, or plot shared by every
// resident of an area. A building is a fact about ONE structure, and
// `worldgen.js` generates far more homes than it does communities, so
// the §88 position scheme here cycles against a running count of
// homes actually built, not against `c`/`b`. That is the "materially
// larger structural change" `world-layer/CLAUDE.md`'s own thirtieth
// rule named and deferred — built now, on direct request.
//
// ---------------------------------------------------------------------
// A pack is scoped to ONE property type, and the validator holds the line
// ---------------------------------------------------------------------
// `world-layer/imports/overtureImport.js#importOvertureBuildings`
// writes a real `propertyType` (mapped from Overture's own building
// class) onto every building it imports — and that type is a fact
// about the specific real structure, not something a caller can
// safely ignore. Assigning an office building's real footprint to a
// generated HOME would be a genuine mismatch, not a position-cycling
// detail, so a pack declares its own `propertyType` and every building
// in it must either agree or be of unknown type (Overture does not
// classify every building) — `validatePack` refuses a pack with a
// disagreeing building rather than silently using it, the same "a pack
// is refused, never partly used" discipline every reader here holds.
// `world-layer/exportRegionStats.js#exportBuildingPack` is the writer
// that actually filters a region's real buildings down to one type
// before this reader ever sees them.
//
// ---------------------------------------------------------------------
// Height is read by nothing, and that is declared rather than hidden
// ---------------------------------------------------------------------
// Overture also carries a real `heightMetres` per building. VACON-C's
// `property.js` has no height column and nothing in this engine
// currently decides anything from a building's height — wiring it in
// anyway would be the eleventh standing rule's own trap, a real fact
// nothing reads. `heightMetresFor` exists so a FUTURE caller can read
// it without a second import, and it is not stored on the generated
// property record this round. `landSize` and `floors` are wired
// because `property.js`'s own existing fields already consume them
// immediately, the same "replaces an invented value a real consumer
// already reads" shape every other wired pack here takes.
//
// ---------------------------------------------------------------------
// Matched to a home by POSITION, same reason as every other pack —
// just a finer one
// ---------------------------------------------------------------------
// A real Overture building has no name a generated home can be
// matched to. Assigned by a running count of homes actually built in
// the generation loop, cycling if there are fewer real buildings than
// homes — standing rule 8 (§88), one level finer than every pack
// before it.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.

'use strict';

const SOURCES = ['overture-buildings', 'sample'];

//: `property.js`'s own `PROPERTY_TYPES`, duplicated here for the
//: cross-boundary reason above, and cross-checked by this module's
//: own test against that file's copy.
const PROPERTY_TYPES = [
  'residential', 'commercial', 'industrial', 'government', 'agricultural',
  'mixed', 'farm', 'historical_site', 'digital_property', 'virtual_location',
];

function isPositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
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
  if (!PROPERTY_TYPES.includes(pack.propertyType)) {
    problems.push(`pack.propertyType must be one of: ${PROPERTY_TYPES.join(', ')} — a building `
      + 'pack is scoped to one real property type, never mixed');
  }
  if (!Array.isArray(pack.buildings) || pack.buildings.length === 0) {
    problems.push('pack.buildings must be a non-empty array');
    return problems;
  }

  pack.buildings.forEach((building, i) => {
    const where = `buildings[${i}]${building?.buildingId ? ` (${building.buildingId})` : ''}`;
    if (!building?.buildingId) problems.push(`${where}: buildingId is required`);
    // A building of a KNOWN, DISAGREEING type is refused outright —
    // this file's own header on why that is a real mismatch, not a
    // detail. A building with no recorded type is tolerated: Overture
    // does not classify every footprint.
    if (building?.propertyType != null && building.propertyType !== pack.propertyType) {
      problems.push(`${where}: propertyType "${building.propertyType}" disagrees with this `
        + `pack's own "${pack.propertyType}" — a building pack may not mix real property types`);
    }
    if (building?.footprintArea !== undefined && building.footprintArea !== null
      && !isPositive(building.footprintArea)) {
      problems.push(`${where}: footprintArea must be a positive real number of square metres`);
    }
    if (building?.heightMetres !== undefined && building.heightMetres !== null
      && !isPositive(building.heightMetres)) {
      problems.push(`${where}: heightMetres must be a positive real number`);
    }
    if (building?.numFloors !== undefined && building.numFloors !== null
      && !(Number.isInteger(Number(building.numFloors)) && Number(building.numFloors) >= 1)) {
      problems.push(`${where}: numFloors must be a real integer of at least 1`);
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`building pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

// The pack this world was built with, or null for a world that had
// none — which stays the default, since a world with no pack keeps
// the invented `landSize`/`floors` bands it has always had.
function packFor(worldState) {
  return worldState?.buildingPack ?? null;
}

// The building for a home at this position, cycling if there are
// fewer real buildings than homes. Null when there is no pack.
function buildingFor(pack, position) {
  if (!pack || !Array.isArray(pack.buildings) || pack.buildings.length === 0) return null;
  const index = ((position % pack.buildings.length) + pack.buildings.length) % pack.buildings.length;
  return pack.buildings[index];
}

// A real land size in square metres (Overture's own `footprintArea`,
// rounded), or null when the building has none recorded.
function landSizeFor(building) {
  const area = Number(building?.footprintArea);
  return isPositive(area) ? Math.round(area) : null;
}

// A real floor count, or null when the building has none recorded —
// `overtureImport.js`'s own header on why this is never derived from
// `heightMetres`: that needs an assumed storey height this project
// does not invent.
function floorsFor(building) {
  const floors = Number(building?.numFloors);
  return Number.isInteger(floors) && floors >= 1 ? floors : null;
}

// A real height in metres, or null — read by nothing in this engine
// yet. See this file's own header for why it is still exposed here
// rather than silently dropped.
function heightMetresFor(building) {
  const height = Number(building?.heightMetres);
  return isPositive(height) ? height : null;
}

module.exports = {
  SOURCES,
  PROPERTY_TYPES,
  validatePack,
  assertPack,
  packFor,
  buildingFor,
  landSizeFor,
  floorsFor,
  heightMetresFor,
};
