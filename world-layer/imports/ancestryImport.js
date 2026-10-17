// Universal World Layer — U.S. Census ACS Ancestry (Table B04006) import.
//
// **Real national-origin/ancestry composition, for the field
// `worldgen.js` draws from a vocabulary this project invented so it
// would not borrow real ethnonyms. Read this header, and
// `server/ancestryPacks.js`'s, before using this.**
//
// ---------------------------------------------------------------------
// This one is not like most others, and the tension is the same as
// religionImport.js's
// ---------------------------------------------------------------------
// `worldgen.js`'s ethnicity vocabulary (`'Riverborn', 'Highland',
// 'Coastwise', 'Outlander'`) is invented on purpose — the same file's
// own comment says borrowing real ethnonyms would attach real-world
// associations to a simulation that models none of them, and
// `demographics.js`'s header independently calls race/ethnicity
// "deliberately not added... no document in the package asks for
// one." Writing real ancestry-group names (Somali, Bosnian, German,
// and so on) onto procedurally generated people who are also subject
// to this engine's own crime, death and disease mechanics is exactly
// that attachment.
//
// This importer exists anyway, on the same explicit instruction that
// wired `religionImport.js` in: asked directly for real community
// character — "Somali community in Minnesota," "Bosnian community in
// St. Louis," "Jewish community in New York" — the real answer is
// this table, and it was raised and approved rather than wired in
// silently. The invented vocabulary stays the default for every world
// this pack is not explicitly supplied to. The judgement about
// whether to USE this on a given world belongs to whoever builds that
// world, same as `religionPacks.js`.
//
// ---------------------------------------------------------------------
// The vocabulary is the source's, generalised one step and no further
// ---------------------------------------------------------------------
// B04006 enumerates roughly ninety specific ancestry codes. This
// importer keeps the two groups the request named BY NAME rather than
// folding them into a regional bucket — `somali` and `bosnian` are
// each their own group, not "subsaharan-african" or "other-european"
// — because collapsing the two specific examples the request gave
// into a generic bucket would defeat the entire point of importing
// this. Every other code maps to one of a fixed set of major groups,
// or to `other` if this map does not recognise it — named, never
// silently dropped, same as `religionImport.js`'s `unrecognisedBodies`.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does in religionImport.js
// ---------------------------------------------------------------------
// A distribution for a PLACE, never a per-person fact. §9 is actually
// easier to keep here than for religion: `test/ethnicity.test.js`
// already asserts, and will keep asserting, that NOTHING in this
// engine reads `npc.ethnicity` to decide an outcome — this importer
// changes what fills a measured-but-unread field, not what reads it.
//
// NETWORK CONSTRAINT, checked directly: data.census.gov is outside
// this environment's outbound proxy allowlist (403 CONNECT).
// `fetchAncestryTable` throws with that reason; the transform is the
// tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: B04006 ancestry codes → a closed, stated vocabulary. Somali and
//: Bosnian are kept as their own groups rather than folded into a
//: regional bucket — see the header for why. A code this does not
//: recognise is counted under `other` and named, never silently
//: dropped.
const GROUP_MAP = {
  german: 'german',
  irish: 'irish',
  english: 'english',
  italian: 'italian',
  polish: 'polish',
  french: 'french',
  frenchCanadian: 'french',
  scottish: 'scottish',
  scotchIrish: 'scottish',
  dutch: 'dutch',
  norwegian: 'norwegian',
  swedish: 'swedish',
  russian: 'russian',
  ukrainian: 'ukrainian',
  greek: 'greek',
  portuguese: 'portuguese',
  hungarian: 'hungarian',
  czech: 'czech',
  slovak: 'czech',
  swiss: 'swiss',
  welsh: 'welsh',
  lithuanian: 'lithuanian',
  arab: 'arab',
  somali: 'somali',
  bosnian: 'bosnian',
  nigerian: 'subsaharan-african',
  ethiopian: 'subsaharan-african',
  ghanaian: 'subsaharan-african',
  kenyan: 'subsaharan-african',
  subsaharanAfricanOther: 'subsaharan-african',
  jamaican: 'west-indian',
  haitian: 'west-indian',
  westIndianOther: 'west-indian',
  vietnamese: 'vietnamese',
  chinese: 'chinese',
  filipino: 'filipino',
  asianIndian: 'asian-indian',
  mexican: 'mexican',
  american: 'american',
};

const GROUPS = [...new Set(Object.values(GROUP_MAP))];
const CODE_NAMES = Object.keys(GROUP_MAP);

//: **Unspecified is not "no ancestry" and it is not a gap.** B04006
//: counts people who reported a specific ancestry; a real share of any
//: tract reports none or something this table does not itemise
//: separately. Modelling that as missing would make every imported
//: tract look unmeasured; modelling it as a group would invent one.
//: Mirrors `religionImport.UNAFFILIATED`'s role exactly.
const UNSPECIFIED = 'unspecified';

function groupFor(code) {
  return GROUP_MAP[code] ?? null;
}

// Turn a tract's ancestry-group counts into a distribution over the
// stated vocabulary, with the unclaimed remainder as `unspecified`.
//
// `counts` is `{ <code>: <count> }`; `population` is the tract's
// total. Returns shares summing to 1.
function toDistribution(counts = {}, population = null) {
  const total = Number(population);
  const byGroup = {};
  const unrecognised = [];
  let claimed = 0;

  for (const [code, count] of Object.entries(counts)) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) continue;
    const group = groupFor(code);
    if (group === null) {
      unrecognised.push({ code, count: n });
      byGroup.other = (byGroup.other ?? 0) + n;
    } else {
      byGroup[group] = (byGroup[group] ?? 0) + n;
    }
    claimed += n;
  }

  if (!Number.isFinite(total) || total <= 0) {
    // **No population means no shares, not shares of the claimed
    // total** — same rule `religionImport.toDistribution` holds, for
    // the same reason: normalising against the counted ancestries
    // alone would silently claim full tract coverage.
    return { shares: null, counts: byGroup, unrecognised, claimed, population: null };
  }

  const shares = {};
  for (const [group, count] of Object.entries(byGroup)) {
    shares[group] = Math.round((count / total) * 10000) / 10000;
  }
  shares[UNSPECIFIED] = Math.max(0, Math.round((1 - claimed / total) * 10000) / 10000);

  return { shares, counts: byGroup, unrecognised, claimed, population: total };
}

// Attach a tract's ancestry composition to a location.
function importAncestryTract(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importAncestryTract: no location with id ${locationId}`);
  if (!record.tractId) {
    throw new Error(
      'importAncestryTract requires record.tractId — an unattributed composition cannot be '
      + 'checked against the published table.',
    );
  }

  const distribution = toDistribution(record.counts ?? {}, record.population);
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    ancestry: {
      source: 'us-census-acs-ancestry',
      licence: 'public-domain',
      tractId: record.tractId,
      year: record.year ?? null,
      shares: distribution.shares,
      unrecognisedCodes: distribution.unrecognised,
      vocabulary: [...GROUPS, UNSPECIFIED],
    },
    containsIndividualAttributes: false,
  });
  return location;
}

function describeAncestryCoverage(worldLayer) {
  let tracts = 0;
  let withShares = 0;
  const unrecognised = {};
  for (const location of worldLayer.locations || []) {
    const ancestry = location.populationData?.ancestry;
    if (ancestry?.source !== 'us-census-acs-ancestry') continue;
    tracts += 1;
    if (ancestry.shares) withShares += 1;
    for (const entry of ancestry.unrecognisedCodes ?? []) {
      unrecognised[entry.code] = (unrecognised[entry.code] ?? 0) + 1;
    }
  }
  return {
    tracts,
    withShares,
    withoutPopulation: tracts - withShares,
    unrecognisedCodes: unrecognised,
    vocabulary: [...GROUPS, UNSPECIFIED],
  };
}

function fetchAncestryTable() {
  throw new Error(
    'fetchAncestryTable is not implemented: data.census.gov is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, checked directly). ACS Table B04006 is '
    + 'published via the Census Bureau API, no key required for public tables. Pass '
    + `{ tractId, year, population, counts } to importAncestryTract(worldLayer, locationId, `
    + `record). Known codes: ${CODE_NAMES.join(', ')}.`,
  );
}

module.exports = {
  GROUP_MAP,
  GROUPS,
  CODE_NAMES,
  UNSPECIFIED,
  groupFor,
  toDistribution,
  importAncestryTract,
  describeAncestryCoverage,
  fetchAncestryTable,
};
