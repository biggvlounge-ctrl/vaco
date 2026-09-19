// Universal World Layer — U.S. Religion Census import.
//
// **`npcs.religion` is a real column that no generated world has ever
// written, and this is the only source in the registry for it.**
//
// ---------------------------------------------------------------------
// What it closes, in the engine's own words
// ---------------------------------------------------------------------
// `vacon-c/server/demographics.js` says it plainly:
//
//     `npcs.religion`   a real TEXT column, set only from an option,
//                       null in every generated world.
//
// `demographics.distributionOf` will report a religion distribution the
// moment there is one, and `beliefs.js` exists. The column has been
// there since the schema was written, with no vocabulary and no source.
//
// The U.S. Religion Census (published by the Association of Statisticians
// of American Religious Bodies, decennially, archived at the Association
// of Religion Data Archives) reports adherents per county for several
// hundred religious bodies. It is the standard source for exactly this.
//
// ---------------------------------------------------------------------
// Two constraints, and both are stronger here than elsewhere
// ---------------------------------------------------------------------
// **Licence.** This is the one source in the registry that is NOT a
// U.S. Government Work or an open data licence. It is an academic
// archive with its own terms of use, and `sources.js` records it as
// encumbered. Redistribution of the underlying tables is restricted;
// deriving a share and shipping THAT is a different question that
// somebody has to answer before this is used in a product.
// `LICENCE_WARNING` is on every record this importer writes so the
// question cannot be lost between here and a build.
//
// **§9.** A religion distribution is a fact about a PLACE. The spec
// permits demographic modelling and forbids demographics determining
// morality, criminality, intelligence or worth — and religion is the
// demographic where that rule is easiest to violate by accident, so
// this importer produces shares only, exactly as `censusImport` and
// `cdcImport` do, and refuses to emit anything per-person.
//
// ---------------------------------------------------------------------
// The vocabulary is the source's, generalised one step and no further
// ---------------------------------------------------------------------
// The Religion Census names several hundred bodies. `npcs.religion` is
// free TEXT with no enumeration, so this could write anything — which
// is exactly why it writes a stated, closed vocabulary instead. A
// hundred denominations in a column nothing enumerates is a column
// nothing can group by.
//
// NETWORK CONSTRAINT, checked directly: `thearda.com` is outside this
// environment's outbound proxy allowlist (403 CONNECT).
// `fetchReligionCensus` throws with that reason.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: The licence note carried on every row. **Not a comment — data**,
//: because a comment in this file does not travel with the world model
//: into whatever reads it next.
const LICENCE_WARNING = 'U.S. Religion Census / ARDA: academic archive terms, NOT public '
  + 'domain and NOT an open data licence. Redistribution of the underlying tables is '
  + 'restricted. Verify terms before shipping anything derived from this.';

//: Religion Census bodies → a closed, stated vocabulary. One step of
//: generalisation: the source's family groupings, not its individual
//: denominations. **A body this does not recognise is counted under
//: `other` and NAMED**, never silently dropped, because "this county is
//: 40% something we do not have a bucket for" is a real finding.
const TRADITION_MAP = {
  evangelicalProtestant: 'protestant',
  mainlineProtestant: 'protestant',
  historicallyBlackProtestant: 'protestant',
  catholic: 'catholic',
  orthodox: 'orthodox',
  easternOrthodox: 'orthodox',
  orientalOrthodox: 'orthodox',
  judaism: 'jewish',
  islam: 'muslim',
  buddhism: 'buddhist',
  hinduism: 'hindu',
  sikhism: 'sikh',
  bahai: 'bahai',
  latterDaySaints: 'latter-day-saints',
  jehovahsWitnesses: 'jehovahs-witnesses',
  otherReligion: 'other',
};

const TRADITIONS = [...new Set(Object.values(TRADITION_MAP))];
const BODY_NAMES = Object.keys(TRADITION_MAP);

//: **Unaffiliated is not a religion and it is not a gap.** The Religion
//: Census reports adherents; everybody else is unclaimed, which in the
//: U.S. is routinely half a county. Modelling that as missing data
//: would make every imported place look unmeasured, and modelling it as
//: a tradition would put a belief in somebody's mouth. It is its own
//: value and `npcs.religion` can hold it.
const UNAFFILIATED = 'unaffiliated';

function traditionFor(body) {
  return TRADITION_MAP[body] ?? null;
}

// Turn a county's adherent counts into a distribution over the stated
// vocabulary, with the unclaimed remainder as `unaffiliated`.
//
// `adherents` is `{ <body>: <count> }`; `population` is the county's
// total. Returns shares summing to 1.
function toDistribution(adherents = {}, population = null) {
  const total = Number(population);
  const byTradition = {};
  const unrecognised = [];
  let claimed = 0;

  for (const [body, count] of Object.entries(adherents)) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) continue;
    const tradition = traditionFor(body);
    if (tradition === null) {
      unrecognised.push({ body, adherents: n });
      byTradition.other = (byTradition.other ?? 0) + n;
    } else {
      byTradition[tradition] = (byTradition[tradition] ?? 0) + n;
    }
    claimed += n;
  }

  if (!Number.isFinite(total) || total <= 0) {
    // **No population means no shares, not shares of the claimed
    // total.** Normalising against the adherents alone would report a
    // county as 100% religious, which is the opposite of what the
    // source says.
    return { shares: null, adherents: byTradition, unrecognised, claimed, population: null };
  }

  const shares = {};
  for (const [tradition, count] of Object.entries(byTradition)) {
    shares[tradition] = Math.round((count / total) * 10000) / 10000;
  }
  // The remainder. Clamped at zero because adherent counts can exceed a
  // population figure from a different year, and a negative share would
  // be arithmetic leaking into the model.
  shares[UNAFFILIATED] = Math.max(0, Math.round((1 - claimed / total) * 10000) / 10000);

  return { shares, adherents: byTradition, unrecognised, claimed, population: total };
}

// Attach a county's religious composition to a location.
function importReligionCensus(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importReligionCensus: no location with id ${locationId}`);
  if (!record.countyFips) {
    throw new Error(
      'importReligionCensus requires record.countyFips — an unattributed religious '
      + 'composition cannot be checked, and this source is licence-encumbered, so where a '
      + 'figure came from is not optional.',
    );
  }

  const distribution = toDistribution(record.adherents ?? {}, record.population);
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    religion: {
      source: 'us-religion-census',
      // **Carried as data, on every row.** See the header.
      licence: 'academic-archive-restricted',
      licenceWarning: LICENCE_WARNING,
      countyFips: record.countyFips,
      countyName: record.countyName ?? null,
      year: record.year ?? null,
      // Shares over the stated vocabulary, `unaffiliated` included.
      shares: distribution.shares,
      // What the map did not recognise, named. A high count here means
      // the vocabulary needs a body added, not that a county is odd.
      unrecognisedBodies: distribution.unrecognised,
      vocabulary: [...TRADITIONS, UNAFFILIATED],
    },
    // §9, and this is the field where it matters most in the registry.
    containsIndividualAttributes: false,
  });
  return location;
}

function describeReligionCoverage(worldLayer) {
  let places = 0;
  let withShares = 0;
  const unrecognised = {};
  for (const location of worldLayer.locations || []) {
    const religion = location.populationData?.religion;
    if (religion?.source !== 'us-religion-census') continue;
    places += 1;
    if (religion.shares) withShares += 1;
    for (const entry of religion.unrecognisedBodies ?? []) {
      unrecognised[entry.body] = (unrecognised[entry.body] ?? 0) + 1;
    }
  }
  return {
    places,
    withShares,
    // A place imported with no population figure, so no shares could be
    // computed. Counted rather than hidden in the difference.
    withoutPopulation: places - withShares,
    unrecognisedBodies: unrecognised,
    vocabulary: [...TRADITIONS, UNAFFILIATED],
    licenceWarning: LICENCE_WARNING,
  };
}

function fetchReligionCensus() {
  throw new Error(
    'fetchReligionCensus is not implemented: thearda.com is outside this environment\'s '
    + 'outbound proxy allowlist (403 CONNECT, checked directly). The U.S. Religion Census '
    + 'is distributed by the Association of Religion Data Archives as downloadable county '
    + 'files. READ THE TERMS FIRST: this is the one encumbered source in the registry. '
    + 'Pass { countyFips, countyName, year, population, adherents } to '
    + `importReligionCensus(worldLayer, locationId, record). Known bodies: ${BODY_NAMES.join(', ')}.`,
  );
}

module.exports = {
  TRADITION_MAP,
  TRADITIONS,
  BODY_NAMES,
  UNAFFILIATED,
  LICENCE_WARNING,
  traditionFor,
  toDistribution,
  importReligionCensus,
  describeReligionCoverage,
  fetchReligionCensus,
};
