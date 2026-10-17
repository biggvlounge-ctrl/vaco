// Universal World Layer — county presidential election returns import.
//
// **A real civic fact about a place, reported — not a behavioral
// mechanism.**
//
// ---------------------------------------------------------------------
// What this is, and what it deliberately is not
// ---------------------------------------------------------------------
// The MIT Election Lab's county presidential election returns
// (2000-2020, CC0) are the standard, citable, public-domain source
// for "how did this county vote" at the one grain that matches a
// generated community. This importer turns real Democratic/Republican
// vote counts into a two-party Democratic vote share per county —
// nothing invented, nothing modelled, a real number from a real table.
//
// It is deliberately NOT a behavioral mechanism. Every other real
// source in this registry either replaces an invented band
// (`incomePacks.js`, `natalityPacks.js`) or narrows an existing one
// (`riskPacks.js` on weather odds). Political lean has no existing
// invented stand-in anywhere in VACON-C — there is no mechanic that
// reads "how conservative is this place" today — and inventing one
// (a crime-rate bias, a law-strictness multiplier, anything that
// claims a political lean CAUSES a behavior) would be exactly the
// mistake this registry's own discipline exists to avoid: a real fact
// does not license an invented causal claim riding on top of it. See
// `server/politicalPacks.js`'s own header for how VACON-C reports this
// as a place-level statistic with no behavioral tie-in, and why that
// is the correct scope rather than an oversight.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as everywhere else in this registry
// ---------------------------------------------------------------------
// A share of a COUNTY's votes, never an attribute of any one person.
// Nothing here produces or implies an individual's vote, party, or
// political identity.
//
// NETWORK CONSTRAINT, checked directly: the MIT Election Lab's
// dataset is distributed via Harvard Dataverse (dataverse.harvard.edu),
// outside this environment's outbound proxy allowlist (403 CONNECT).
// `fetchCountyReturns` throws with that reason; the transform is the
// tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: A two-party vote share is a fraction by construction; bounded here
//: anyway to catch a units mistake (a raw vote count passed as a
//: share, for instance) rather than to narrow real variation — no real
//: county's share falls outside [0, 1].
const SHARE_BOUNDS = [0, 1];

function isRealCount(value) {
  // **`Number(null)` is 0 and 0 is finite**, so missing is checked
  // first — a county with no reported return is not a county where
  // zero people voted for a party.
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

// Turn a county's real Democratic/Republican vote counts into a
// two-party Democratic vote share. Returns null when either count is
// missing or both are zero — a share against an unknown or empty base
// is not a share, it is an invented denominator.
function toDemocraticShare(democraticVotes, republicanVotes) {
  const dem = isRealCount(democraticVotes);
  const rep = isRealCount(republicanVotes);
  if (dem === null || rep === null) return null;
  const total = dem + rep;
  if (total <= 0) return null;
  const share = dem / total;
  return share >= SHARE_BOUNDS[0] && share <= SHARE_BOUNDS[1]
    ? Math.round(share * 1000000) / 1000000
    : null;
}

// Attach a county's real two-party vote share to a location.
//
// `record`: `{ countyFips, countyName, year, democraticVotes,
// republicanVotes }`.
function importCountyReturns(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importCountyReturns: no location with id ${locationId}`);
  if (!record.countyFips) {
    throw new Error(
      'importCountyReturns requires record.countyFips — an unattributed return cannot be '
      + 'checked against the published table.',
    );
  }

  const democraticShare = toDemocraticShare(record.democraticVotes, record.republicanVotes);
  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    politicalLean: {
      source: 'mit-election-lab',
      licence: 'cc0',
      countyFips: record.countyFips,
      countyName: record.countyName ?? null,
      year: record.year ?? null,
      democraticVotes: isRealCount(record.democraticVotes),
      republicanVotes: isRealCount(record.republicanVotes),
      // The real share `politicalPacks.leanFor` reads. Republican
      // share is the complement by construction (two-party), so it is
      // not stored separately — storing a derived complement invites
      // the two numbers drifting apart on a bad edit.
      democraticShare,
    },
    containsIndividualAttributes: false,
  });
  return location;
}

function describeElectionCoverage(worldLayer) {
  let counties = 0;
  let withShare = 0;
  const shares = [];
  for (const location of worldLayer.locations || []) {
    const data = location.populationData?.politicalLean;
    if (data?.source !== 'mit-election-lab') continue;
    counties += 1;
    if (data.democraticShare !== null) {
      withShare += 1;
      shares.push(data.democraticShare);
    }
  }
  shares.sort((a, b) => a - b);
  return {
    counties,
    withShare,
    withoutShare: counties - withShare,
    medianDemocraticShare: shares.length ? shares[Math.floor(shares.length / 2)] : null,
  };
}

function fetchCountyReturns() {
  throw new Error(
    'fetchCountyReturns is not implemented: dataverse.harvard.edu is outside this '
    + 'environment\'s outbound proxy allowlist (403 CONNECT, checked directly). The MIT '
    + 'Election Lab publishes county presidential returns (2000-2020, CC0) as a downloadable '
    + 'table, no key. Pass { countyFips, countyName, year, democraticVotes, republicanVotes } '
    + 'to importCountyReturns(worldLayer, locationId, record).',
  );
}

module.exports = {
  SHARE_BOUNDS,
  toDemocraticShare,
  importCountyReturns,
  describeElectionCoverage,
  fetchCountyReturns,
};
