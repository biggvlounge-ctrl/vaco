// server/labourPacks.js
//
// **Real labour-market shapes, imported per region — `landmarkPacks.js`'s
// sibling for jobs and wages.**
//
// ---------------------------------------------------------------------
// The gap this closes
// ---------------------------------------------------------------------
// `occupations.drawOccupation` weights by `1/tier` — a pyramid this
// project picked because the first version gave everybody the best
// post they qualified for. `worldgen.js`'s general hiring loop then
// draws a flat wage, `random.range(8, 90, ...)`, for every hire
// regardless of what they do. `world-layer/imports/blsImport.js`
// already turns real U.S. Bureau of Labor Statistics (OES) data into
// the real employment SHARE and the real median/mean wage per SOC
// major group per metro — exactly the two numbers those invented
// shapes stand in for.
//
// ---------------------------------------------------------------------
// Why this is data and not a require
// ---------------------------------------------------------------------
// Same rule as `landmarkPacks.js` and `populationPacks.js`: no app
// imports `world-layer/` across a directory boundary
// (`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`). A pack arrives as plain
// JSON, assembled by whoever is building this world.
//
// ---------------------------------------------------------------------
// The SOC map is duplicated, on purpose, and checked against the other copy
// ---------------------------------------------------------------------
// `world-layer/imports/blsImport.js`'s `SOC_GROUP_BY_OCCUPATION` is the
// source. It is copied here rather than required, for the same
// deployment reason, and `test/labour-packs.test.js` asserts the two
// copies are identical — the same discipline
// `world-layer/exportRegion.js`'s `KEY_CATEGORIES` and
// `vacon-c/server/landmarks.js`'s category list already hold each
// other to.
//
// ---------------------------------------------------------------------
// One metro per city, assigned by POSITION
// ---------------------------------------------------------------------
// Same reasoning as `populationPacks.js`'s one-tract-per-community: a
// metro's labour market applies at the CITY grain (OES is published
// per metropolitan area), assigned to the city's own position in the
// generation loop, cycling if there are fewer metros than cities.

'use strict';

const SOURCES = ['us-bls-oes', 'sample'];

//: Duplicated from `world-layer/imports/blsImport.js`'s
//: `SOC_GROUP_BY_OCCUPATION`. Keep the two lists identical — see the
//: header.
const SOC_GROUP_BY_OCCUPATION = {
  // `politician` is SOC 11-1031 "Legislators" — real BLS code, same
  // major group 11 as `manager`/`logistician`/`diplomat`.
  manager: '11', logistician: '11', diplomat: '11', politician: '11',
  trader: '13', financier: '13',
  engineer: '17', architect: '17', plumber: '17', electrician: '17',
  scientist: '19', researcher: '19', polymath: '19', agronomist: '19', linguist: '19',
  preacher: '21',
  teacher: '25', librarian: '25',
  // `entertainer` (SOC 27-2000 "Entertainers and Performers, Sports
  // and Media") and `influencer` (closest real BLS category is the
  // same major group's media/communication occupations — there is no
  // distinct "influencer" SOC code as of the 2018 classification) both
  // sit in major group 27 alongside the occupations already there.
  curator: '27', athlete: '27', reporter: '27', entertainer: '27', influencer: '27',
  physician: '29',
  orderly: '31',
  officer: '33', enforcer: '33',
  cook: '35',
  farmer: '45', fisher: '45', hunter: '45',
  labourer: '47', carpenter: '47',
  mechanic: '49',
  tailor: '51', preserver: '51',
  navigator: '53',
};

function groupFor(occupation) {
  return SOC_GROUP_BY_OCCUPATION[occupation] ?? null;
}

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
  if (!Array.isArray(pack.metros) || pack.metros.length === 0) {
    problems.push('pack.metros must be a non-empty array');
    return problems;
  }

  pack.metros.forEach((metro, i) => {
    const where = `metros[${i}]${metro?.areaCode ? ` (${metro.areaCode})` : ''}`;
    if (!metro?.areaCode) problems.push(`${where}: areaCode is required`);
    if (metro.employmentShares !== undefined && metro.employmentShares !== null) {
      for (const [group, share] of Object.entries(metro.employmentShares)) {
        const value = Number(share);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          problems.push(`${where}: employmentShares.${group} must be a share (0..1)`);
        }
      }
    }
    if (metro.wages !== undefined && metro.wages !== null) {
      for (const [group, wage] of Object.entries(metro.wages)) {
        if (wage?.medianWage !== undefined && wage.medianWage !== null && !isPositiveNumber(wage.medianWage)) {
          problems.push(`${where}: wages.${group}.medianWage must be a positive number`);
        }
      }
    }
  });
  return problems;
}

function assertPack(pack) {
  const problems = validatePack(pack);
  if (problems.length > 0) {
    throw new Error(`labour pack is not usable:\n  - ${problems.join('\n  - ')}`);
  }
  return pack;
}

function packFor(worldState) {
  return worldState?.labourPack ?? null;
}

// The metro for a city at this position, cycling if there are fewer
// metros than cities. Null when there is no pack.
function metroFor(pack, position) {
  if (!pack || !Array.isArray(pack.metros) || pack.metros.length === 0) return null;
  const index = ((position % pack.metros.length) + pack.metros.length) % pack.metros.length;
  return pack.metros[index];
}

// The real employment share for an occupation's SOC group in this
// metro, or null when the metro has no real figure for it — an
// occupation the real labour market reports no employment in is a
// real fact, not a reason to invent a share.
function employmentShareFor(metro, occupation) {
  const group = groupFor(occupation);
  if (!group || !metro?.employmentShares) return null;
  const share = Number(metro.employmentShares[group]);
  return Number.isFinite(share) ? share : null;
}

// The real median wage for an occupation's SOC group in this metro, or
// null when none is recorded.
function medianWageFor(metro, occupation) {
  const group = groupFor(occupation);
  if (!group || !metro?.wages) return null;
  const wage = Number(metro.wages[group]?.medianWage);
  return Number.isFinite(wage) ? wage : null;
}

module.exports = {
  SOURCES,
  SOC_GROUP_BY_OCCUPATION,
  groupFor,
  validatePack,
  assertPack,
  packFor,
  metroFor,
  employmentShareFor,
  medianWageFor,
};
