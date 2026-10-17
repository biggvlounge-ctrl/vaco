// server/infrastructurePacks.js
//
// **Real facility capacities, imported per region — `landmarkPacks.js`'s
// sibling for roads, hospitals, water, and the rest of the ten.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `worldgen.js` builds every city's infrastructure with a capacity
// drawn from `DESIGN_CAPACITY_PER_1K * cityPopulation / 1000` — a
// per-capita BAND this project chose. `world-layer/imports/
// hifldImport.js`'s own header calls the match between HIFLD Open's
// layers and `infrastructure.INFRASTRUCTURE_TYPES` "unusually exact":
// a real hospital's bed count, a real water system's population
// served, a real power plant's generating capacity — the number those
// bands stand in for.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as the other two pack readers: no app imports
// `world-layer/` across a directory boundary
// (`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`). A pack arrives as plain
// JSON.
//
// ---------------------------------------------------------------------
// One real facility per city per type, assigned by POSITION
// ---------------------------------------------------------------------
// A region's HIFLD import can carry several real facilities of the
// same type (several real hospitals). Each generated city of that type
// draws the facility at its own position in the generation loop,
// cycling if there are fewer real facilities than cities — the same
// "seed on position" rule the other two readers follow, and the
// honest alternative to averaging several real hospitals into one
// invented "typical" bed count that corresponds to no real place.

'use strict';

const SOURCES = ['hifld-open', 'sample'];

//: `infrastructure.INFRASTRUCTURE_TYPES`, duplicated for the same
//: deployment reason the other two pack readers duplicate their
//: source vocabularies. `test/infrastructure-packs.test.js` asserts
//: this matches the real list.
const INFRASTRUCTURE_TYPES = [
  'roads', 'bridges', 'rail', 'water_systems', 'electricity', 'internet',
  'hospitals', 'schools', 'public_safety', 'waste_management',
];

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
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
  if (!pack.facilitiesByType || typeof pack.facilitiesByType !== 'object') {
    problems.push('pack.facilitiesByType must be an object keyed on infrastructure type');
    return problems;
  }

  const entries = Object.entries(pack.facilitiesByType);
  if (entries.length === 0) {
    problems.push('pack.facilitiesByType must carry at least one type');
  }
  for (const [type, capacities] of entries) {
    if (!INFRASTRUCTURE_TYPES.includes(type)) {
      problems.push(`facilitiesByType.${type}: "${type}" is not an infrastructure type. The ten are: `
        + `${INFRASTRUCTURE_TYPES.join(', ')}.`);
      continue;
    }
    if (!Array.isArray(capacities) || capacities.length === 0) {
      problems.push(`facilitiesByType.${type} must be a non-empty array of real capacities`);
      continue;
    }
    capacities.forEach((capacity, i) => {
      if (!isPositiveNumber(capacity)) {
        problems.push(`facilitiesByType.${type}[${i}]: capacity must be a positive number`);
      }
    });
  }
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`infrastructure pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.infrastructurePack ?? null;
}

// The real capacity for one type at this position, cycling through
// however many real facilities of that type the pack carries. Null
// when there is no pack, or the pack has nothing for this type — the
// caller's own per-capita band is the fallback, not this module's.
function capacityFor(pack, type, position) {
  const capacities = pack?.facilitiesByType?.[type];
  if (!Array.isArray(capacities) || capacities.length === 0) return null;
  const index = ((position % capacities.length) + capacities.length) % capacities.length;
  const capacity = Number(capacities[index]);
  return Number.isFinite(capacity) ? capacity : null;
}

module.exports = {
  SOURCES,
  INFRASTRUCTURE_TYPES,
  validatePack,
  assertPack,
  packFor,
  capacityFor,
};
