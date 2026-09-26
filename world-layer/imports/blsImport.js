// Universal World Layer — U.S. Bureau of Labor Statistics import.
//
// ---------------------------------------------------------------------
// The document this replaces is gone; the data it was about is not
// ---------------------------------------------------------------------
// `REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` is named by
// `VACANCY_MASTER_SESSION_INDEX.md`, described as "real BLS labor data
// methodology", recorded as written, and **not in this repository** —
// one of sixty-eight documents the manifest confirms are not coming.
//
// The methodology cannot be recovered. The dataset it was reasoning
// about is free, public domain, and still published. This is the
// importer that lets somebody rebuild the reasoning against the real
// numbers rather than from memory of a lost file.
//
// ---------------------------------------------------------------------
// What it replaces in the engine, specifically
// ---------------------------------------------------------------------
// Two invented distributions, both of which this project has already
// flagged as guesses in their own files:
//
//   **Who does what.** `vacon-c/server/occupations.js#drawOccupation`
//   weights by `1/tier` — a pyramid chosen because the first version
//   gave everybody the best post they qualified for (measured: 28 of 54
//   at Tier 4, eight engineers and eight navigators in 153 people, no
//   labourers at all). The pyramid is better and it is still a shape
//   this project picked. OES publishes the real employment count per
//   occupation per metropolitan area.
//
//   **What it pays.** `vacon-c/server/economy.js` draws wages from a
//   band. OES publishes real median and mean wages per occupation per
//   metro.
//
// ---------------------------------------------------------------------
// The mapping is to SOC groups, not to individual SOC codes
// ---------------------------------------------------------------------
// The Standard Occupational Classification has 800-odd detailed
// occupations; `occupations.js` has thirty-four. Mapping code-to-code
// would be a thousand-line table that is wrong the moment SOC revises,
// so this maps the engine's occupations onto SOC **major groups** —
// twenty-three two-digit families that are stable across revisions.
//
// A group covers several engine occupations and that is correct rather
// than lossy: the point is the SHAPE of a labour market — how much of
// it is construction, how much healthcare — not a per-title census.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: `occupations.js`'s thirty-four → SOC major groups. **Every engine
//: occupation appears exactly once**, and the test asserts it: an
//: occupation with no group is an occupation real employment data can
//: never inform, which would leave part of the labour market on the
//: invented pyramid with nothing to show which part.
const SOC_GROUP_BY_OCCUPATION = {
  // 11-0000 Management
  manager: '11', logistician: '11', diplomat: '11',
  // 13-0000 Business and financial
  trader: '13', financier: '13',
  // 17-0000 Architecture and engineering
  engineer: '17', architect: '17', plumber: '17', electrician: '17',
  // 19-0000 Life, physical and social science
  scientist: '19', researcher: '19', polymath: '19', agronomist: '19', linguist: '19',
  // 21-0000 Community and social service
  preacher: '21',
  // 25-0000 Educational instruction and library
  teacher: '25', librarian: '25',
  // 27-0000 Arts, design, entertainment, sports and media
  curator: '27', athlete: '27', reporter: '27',
  // 29-0000 Healthcare practitioners. `psychiatrist` (29-1223 in the
  // real SOC) added 26 Sep 2026 alongside vacon-c/server/occupations.js.
  physician: '29', psychiatrist: '29',
  // 31-0000 Healthcare support
  orderly: '31',
  // 33-0000 Protective service
  officer: '33', enforcer: '33',
  // 35-0000 Food preparation and serving
  cook: '35',
  // 45-0000 Farming, fishing and forestry
  farmer: '45', fisher: '45', hunter: '45',
  // 47-0000 Construction and extraction
  labourer: '47', carpenter: '47',
  // 49-0000 Installation, maintenance and repair
  mechanic: '49',
  // 51-0000 Production
  tailor: '51', preserver: '51',
  // 53-0000 Transportation and material moving
  navigator: '53',
};

//: The SOC major groups this engine's occupations actually land in,
//: with their published names. Groups SOC defines and nothing here maps
//: to — legal, office administration, personal care, computing,
//: cleaning — are absent on purpose: a collapsed world has no
//: paralegals, and listing an empty group would imply the engine models
//: something it does not.
//:
//: **The first version of this map was written from memory of the
//: occupation list rather than from the list**, and carried ten
//: occupations that do not exist (`banker`, `programmer`, `nurse`,
//: `smith`, `miner`...) while leaving seven real ones unmapped. It was
//: caught by the test below, which is why that test compares against
//: `occupations.OCCUPATION_NAMES` rather than against a count.
const SOC_GROUP_NAMES = {
  11: 'Management',
  13: 'Business and Financial Operations',
  17: 'Architecture and Engineering',
  19: 'Life, Physical, and Social Science',
  21: 'Community and Social Service',
  25: 'Educational Instruction and Library',
  27: 'Arts, Design, Entertainment, Sports, and Media',
  29: 'Healthcare Practitioners and Technical',
  31: 'Healthcare Support',
  33: 'Protective Service',
  35: 'Food Preparation and Serving Related',
  45: 'Farming, Fishing, and Forestry',
  47: 'Construction and Extraction',
  49: 'Installation, Maintenance, and Repair',
  51: 'Production',
  53: 'Transportation and Material Moving',
};

// The SOC major group for an engine occupation, or null.
function groupFor(occupation) {
  return SOC_GROUP_BY_OCCUPATION[occupation] ?? null;
}

// Every engine occupation in a given SOC group.
function occupationsIn(group) {
  return Object.keys(SOC_GROUP_BY_OCCUPATION)
    .filter((occupation) => SOC_GROUP_BY_OCCUPATION[occupation] === group);
}

// Turn OES rows into the employment SHAPE of a labour market.
//
// `rows` are OES records: `{ socGroup, employment, medianWage,
// meanWage }`. Returns the share of employment per group, which is what
// `drawOccupation`'s pyramid is currently standing in for.
//
// **Shares again, not counts.** A metro has a million jobs and a
// generated city has fifty; the distribution transfers, the headcount
// does not.
function toEmploymentShape(rows) {
  if (!Array.isArray(rows)) throw new Error('toEmploymentShape requires an array of OES rows');
  const byGroup = {};
  let total = 0;
  const unmapped = [];

  for (const row of rows) {
    const group = String(row?.socGroup ?? '').slice(0, 2);
    const employment = Number(row?.employment) || 0;
    if (!SOC_GROUP_NAMES[group]) {
      // A real SOC group this engine does not model — legal, office
      // administration, personal care. Named rather than dropped
      // silently, because the share of a labour market this engine
      // cannot represent is a fact worth knowing about the model.
      if (employment > 0) unmapped.push({ group, employment });
      continue;
    }
    byGroup[group] = (byGroup[group] ?? 0) + employment;
    total += employment;
  }

  if (total === 0) return null;
  const shares = {};
  for (const [group, employment] of Object.entries(byGroup)) {
    shares[group] = Math.round((employment / total) * 10000) / 10000;
  }
  return {
    shares,
    unmodelledGroups: unmapped,
    // How much of the real labour market this engine can represent at
    // all. A low number is not an error; it is the model's scope,
    // stated.
    modelledShare: Math.round((total / (total + unmapped.reduce((a, u) => a + u.employment, 0))) * 10000) / 10000,
  };
}

// Wages per SOC group, kept as published.
//
// **Median and mean are both kept and neither is derived.** Wage
// distributions are strongly skewed, so a mean without a median hides
// exactly the thing a game economy cares about, and computing one from
// the other is not possible.
function toWageTable(rows) {
  if (!Array.isArray(rows)) throw new Error('toWageTable requires an array of OES rows');
  const out = {};
  for (const row of rows) {
    const group = String(row?.socGroup ?? '').slice(0, 2);
    if (!SOC_GROUP_NAMES[group]) continue;
    out[group] = {
      name: SOC_GROUP_NAMES[group],
      medianWage: Number(row?.medianWage) || null,
      meanWage: Number(row?.meanWage) || null,
      occupations: occupationsIn(group),
    };
  }
  return out;
}

// Attach a metro's labour market to a location — normally a city
// produced by `overtureImport.importOvertureDivisions`.
function importOesMetro(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importOesMetro: no location with id ${locationId}`);
  if (!record.areaCode) {
    throw new Error('importOesMetro requires record.areaCode — an unattributed statistic cannot be checked');
  }

  const shape = toEmploymentShape(record.rows ?? []);
  const existing = location.economicData ?? {};
  setLocationData(worldLayer, locationId, 'economicData', {
    ...existing,
    labourMarket: {
      source: 'us-bls-oes',
      areaCode: record.areaCode,
      areaName: record.areaName ?? null,
      year: record.year ?? null,
      employmentShares: shape?.shares ?? null,
      wages: toWageTable(record.rows ?? []),
      unmodelledGroups: shape?.unmodelledGroups ?? [],
      modelledShare: shape?.modelledShare ?? null,
    },
  });
  return location;
}

function fetchOesData() {
  throw new Error(
    'fetchOesData is not implemented: api.bls.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly 18 Sep 2026). The intended path is '
    + 'the BLS Public Data API (OES series, or the annual flat files at '
    + 'bls.gov/oes/tables.htm, which need no key) for a metropolitan area code. Pass the '
    + 'rows to importOesMetro(worldLayer, locationId, record).',
  );
}

module.exports = {
  SOC_GROUP_BY_OCCUPATION,
  SOC_GROUP_NAMES,
  groupFor,
  occupationsIn,
  toEmploymentShape,
  toWageTable,
  importOesMetro,
  fetchOesData,
};
