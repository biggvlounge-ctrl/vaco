// server/politicalPacks.js
//
// **A real county's two-party vote share, reported as a place-level
// statistic — deliberately NOT wired to any behavioral mechanism.**
//
// ---------------------------------------------------------------------
// Why this reports rather than drives anything
// ---------------------------------------------------------------------
// Every other pack reader in this registry either replaces an invented
// band (`incomePacks.js` on home values, `natalityPacks.js` on birth
// rates) or narrows an existing one (`riskPacks.js` on weather odds).
// VACON-C has no invented political-lean constant anywhere to replace
// — `politics.js`'s elections are a procedural mechanism (candidates,
// votes cast by generated citizens), not a real-world left/right
// baseline. So there is nothing here to close in the twenty-seventh
// rule's shape.
//
// Reading a real Democratic/Republican vote share and then inventing a
// causal link from it — a crime-rate bias, a law-strictness
// multiplier, a policing-intensity term — would not be closing a gap;
// it would be fabricating a political claim this project has no
// research backing for and no business asserting. That is a different
// and worse mistake than the ones the twenty-seventh/twenty-eighth
// rules catalogue, because those are all real facts sitting unread —
// this is a real fact that has nothing honest to be read INTO. So
// `political_lean` is a reported `statistics.js` entry
// (`city.politicalLean`, in-memory only — see the twenty-eighth rule's
// `healthBaseline` for the same known limitation) and nothing reads it
// to decide anything else about a generated world.
//
// ---------------------------------------------------------------------
// Matched to a city by POSITION, same reason as a tract or jurisdiction
// ---------------------------------------------------------------------
// A county has no name an auto-generated city can be matched to.
// Counties are assigned by POSITION against the city's own index in
// the generation loop — standing rule 8 (§88).
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as every other pack reader: `dev-docs/
// DEPLOYMENT_FILE_PLACEMENT.md` forbids an app importing `world-layer/`
// across the directory boundary. A pack arrives as plain JSON.
//
// §9 applies here exactly as on the import side: a county's vote
// share is a fact about the PLACE, never about any one generated
// citizen — nothing here produces or implies an NPC's political
// affiliation.

'use strict';

const SOURCES = ['mit-election-lab', 'sample'];

//: `world-layer/imports/electionImport.js`'s own `SHARE_BOUNDS`.
const SHARE_BOUNDS = [0, 1];

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
  if (!Array.isArray(pack.counties) || pack.counties.length === 0) {
    problems.push('pack.counties must be a non-empty array');
    return problems;
  }

  pack.counties.forEach((c, i) => {
    const where = `counties[${i}]${c?.countyFips ? ` (${c.countyFips})` : ''}`;
    if (!c?.countyFips) problems.push(`${where}: countyFips is required`);
    if (c.democraticShare !== undefined && c.democraticShare !== null) {
      const share = Number(c.democraticShare);
      if (!Number.isFinite(share) || share < SHARE_BOUNDS[0] || share > SHARE_BOUNDS[1]) {
        problems.push(`${where}: democraticShare must be between ${SHARE_BOUNDS[0]} and ${SHARE_BOUNDS[1]}`);
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`political pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.politicalPack ?? null;
}

// The county for a city at this position, cycling if there are fewer
// counties than cities. Null when there is no pack.
function countyFor(pack, position) {
  if (!pack || !Array.isArray(pack.counties) || pack.counties.length === 0) return null;
  const index = ((position % pack.counties.length) + pack.counties.length) % pack.counties.length;
  return pack.counties[index];
}

// A real two-party Democratic vote share for this county, or null —
// there is no invented fallback for a caller to fall back to, because
// nothing in this engine invents one.
function leanFor(county) {
  const value = Number(county?.democraticShare);
  return Number.isFinite(value) ? value : null;
}

module.exports = {
  SOURCES,
  SHARE_BOUNDS,
  validatePack,
  assertPack,
  packFor,
  countyFor,
  leanFor,
};
