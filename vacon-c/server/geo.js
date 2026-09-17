// server/geo.js
//
// Where things are, and how far apart.
//
// **This is step 1 of the order of operations this repo already wrote
// for itself.** `dev-docs/LAND_AND_MAP_DATA.md` §7:
//
//   "1. Decide the geo-reference format and write the resolver. Census
//    GEOID is the recommendation for the US; whatever you choose,
//    `real_world_geo_ref` and `geography_key` need a parser before they
//    need data."
//
// and §1, on the three free-text keys the schema already carries:
//
//   "Three of those are free-text keys with no format, no parser and no
//    reader. **That is the single most important thing to fix before
//    importing anything**, because a geo reference nothing can parse is
//    a string, not a location — the same 'set by something, read by
//    nothing' shape this repo keeps finding."
//
// So: a format, a parser that refuses a malformed one, containment, and
// distance. No import — there is no network here and §4 of that document
// is a licensing minefield — and nothing in this file pretends to be
// real-world data.
//
// ---------------------------------------------------------------------
// Why this is the largest thing outstanding
//
// §9's MASTER BLOCK KEY opens with GEOGRAPHIC DATA and names eight
// fields: block size, alley access, highway distance, rail access,
// river/lake proximity, industrial access, **police station distance,
// hospital distance**. The engine answers none of them, and three
// separate declared absences say the same thing in different words —
// `statistics.terrain_and_water`, `statistics.pollution`, and
// `authority.js`'s note that its `reach` term is city-scoped so "every
// block in a city with a working station reads fully policed", which is
// why no generated world has ever produced a lawless area.
//
// Distance from the station is the missing term. It needs positions.
//
// ---------------------------------------------------------------------
// The format: a PATH, not a prefix-packed integer
//
// The recommendation in the document is a Census GEOID, and a GEOID is
// a fixed-width digit string whose prefixes are its parents — 15 digits
// for a block, of which the first 12 are its block group, the first 11
// its tract, the first 5 its county, the first 2 its state.
//
// **That does not survive contact with this engine's tiers, and the
// reason is worth writing down rather than discovering later.** The
// document maps `cities` to a Census PLACE. A Place GEOID is
// state(2) + place(5), and places are not built out of tracts — a place
// boundary crosses them freely. So `city` is not a prefix of
// `community` in the Census scheme, and strict prefix containment
// city → community is simply false. A format that assumed it would be
// wrong about every real municipality on the first import.
//
// So the format is a path of tier-tagged segments, slash-separated, in
// tier order:
//
//   region/city/community/block
//   "29510/2965000/295101011001/295101011001004"
//
// Containment is structural — a prefix of the PATH, not of a digit
// string — which is true by construction for any hierarchy anybody
// imports. A Census import writes exactly the segments above and loses
// nothing. A generated world writes synthetic tokens of the same shape.
// `SOURCE` says which, because §5 of that document is titled
// "Provenance, and why it is not optional here".
//
// ---------------------------------------------------------------------
// Coordinates, and the error §7 names
//
// §7 step 2: "Store in EPSG:4326. Measure — area, distance, density —
// in a projected CRS appropriate to the region. **Computing an area in
// degrees is the classic silent error** and it is wrong by a factor
// that varies with latitude."
//
// Positions are stored as EPSG:4326 latitude and longitude, and the
// only measurement here is DISTANCE, by haversine, in metres. Haversine
// is exact on a sphere and needs no projection, so the degrees trap
// cannot be fallen into by this file.
//
// **Area is deliberately absent.** `properties.land_size` exists and is
// the column an area would go in; computing one needs a projected CRS
// and a real parcel boundary, and this file has neither. A `land_size`
// derived from two coordinates would be the exact error §7 warns about
// wearing a helpful name.

'use strict';

const { seededDraw } = require('./seeded.js');

// ---------------------------------------------------------------------
// The format
// ---------------------------------------------------------------------

//: The tiers, in containment order. This IS the format: a reference is
//: a slash-separated path with one segment per tier, and a reference
//: with more segments is contained by one with fewer.
const TIERS = ['region', 'city', 'community', 'block'];

//: Where a reference came from. Provenance is not optional (§5), and
//: the distinction that matters is between a synthetic world and one
//: built from a real import — a statistic computed over the first must
//: never be reported as a fact about the second.
const SOURCES = ['synthetic', 'census', 'imported'];

//: A segment is digits and letters, no separators. Deliberately narrow:
//: a Census GEOID is digits, and anything with a slash in it would
//: break containment silently rather than loudly.
const SEGMENT = /^[0-9A-Za-z_-]+$/;

// Parse a reference into its tiers, or throw.
//
// **Refusing is the point.** The three keys this replaces were TEXT
// columns that anything could be written into, so "a geo reference
// nothing can parse is a string, not a location". A parser that
// accepted anything would leave them strings.
function parseRef(ref) {
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new Error('geo.parseRef: a reference is a non-empty string');
  }
  const segments = ref.split('/');
  if (segments.length > TIERS.length) {
    throw new Error(
      `geo.parseRef: "${ref}" has ${segments.length} segments; the tiers are `
      + `${TIERS.join(' > ')}`,
    );
  }
  for (const segment of segments) {
    if (!SEGMENT.test(segment)) {
      throw new Error(
        `geo.parseRef: "${segment}" is not a segment — digits, letters, _ and - only, `
        + 'and never a separator',
      );
    }
  }
  const parsed = { ref, tier: TIERS[segments.length - 1], segments };
  TIERS.forEach((tier, i) => { parsed[tier] = segments[i] ?? null; });
  return parsed;
}

function isRef(ref) {
  try { parseRef(ref); return true; } catch { return false; }
}

// Build a reference from its parts, skipping nothing. A gap in the
// middle would make containment lie.
function refOf(parts = {}) {
  const segments = [];
  for (const tier of TIERS) {
    const value = parts[tier];
    if (value === null || value === undefined || value === '') break;
    segments.push(String(value));
  }
  if (segments.length === 0) throw new Error('geo.refOf: needs at least a region');
  const ref = segments.join('/');
  parseRef(ref);
  return ref;
}

// Does `outer` contain `inner`? Containment is a path prefix, which is
// true by construction rather than by assumption about digit widths.
//
// A reference contains itself, which is what makes "is this block in
// this city" answerable with one function whichever tier you hold.
function contains(outer, inner) {
  const a = parseRef(outer);
  const b = parseRef(inner);
  if (a.segments.length > b.segments.length) return false;
  return a.segments.every((segment, i) => segment === b.segments[i]);
}

// The reference of the tier above, or null at the top.
function parentOf(ref) {
  const parsed = parseRef(ref);
  if (parsed.segments.length <= 1) return null;
  return parsed.segments.slice(0, -1).join('/');
}

// ---------------------------------------------------------------------
// The Census adapter
// ---------------------------------------------------------------------

//: A 15-digit block GEOID's internal widths. Named rather than inlined
//: because getting one of them wrong produces a reference that parses,
//: contains the wrong things, and is wrong in a way nothing would catch.
const CENSUS_WIDTHS = { state: 2, county: 3, tract: 6, blockGroup: 1, block: 3 };
const CENSUS_BLOCK_LENGTH = 15;

// Turn a Census block GEOID into a reference in this format.
//
// **`placeGeoid` is a separate argument and that is the whole point of
// the adapter.** A Place does not nest inside the tract chain — see the
// header — so the city segment cannot be cut out of the block GEOID and
// has to be supplied by whatever knows which municipality the block is
// in. Passing none produces a three-tier reference with the county
// standing in as the city, which is honest for an unincorporated area
// and is exactly what a real import of one would want.
function fromCensusBlock(blockGeoid, placeGeoid = null) {
  if (typeof blockGeoid !== 'string' || !/^\d+$/.test(blockGeoid)) {
    throw new Error('geo.fromCensusBlock: a block GEOID is a digit string');
  }
  if (blockGeoid.length !== CENSUS_BLOCK_LENGTH) {
    throw new Error(
      `geo.fromCensusBlock: a block GEOID is ${CENSUS_BLOCK_LENGTH} digits, `
      + `got ${blockGeoid.length} ("${blockGeoid}")`,
    );
  }
  const county = blockGeoid.slice(0, CENSUS_WIDTHS.state + CENSUS_WIDTHS.county);
  const blockGroup = blockGeoid.slice(
    0,
    CENSUS_WIDTHS.state + CENSUS_WIDTHS.county + CENSUS_WIDTHS.tract + CENSUS_WIDTHS.blockGroup,
  );
  return refOf({
    region: county,
    city: placeGeoid === null ? county : placeGeoid,
    community: blockGroup,
    block: blockGeoid,
  });
}

// ---------------------------------------------------------------------
// Position and distance
// ---------------------------------------------------------------------

const EARTH_RADIUS_M = 6371008.8;   // IUGG mean radius
const toRadians = (degrees) => (degrees * Math.PI) / 180;

function isPosition(position) {
  if (!position || typeof position !== 'object') return false;
  const { lat, lon } = position;
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function assertPosition(position, what = 'position') {
  if (!isPosition(position)) {
    throw new Error(
      `geo: ${what} is not an EPSG:4326 position — needs finite lat in -90..90 and `
      + 'lon in -180..180',
    );
  }
  return position;
}

// Great-circle distance in METRES.
//
// **Haversine, and no projection anywhere in this file.** §7 step 2
// names computing in degrees as the classic silent error; haversine is
// exact on a sphere and returns metres directly, so the trap is not
// available to fall into. Null when either end is unplaced — an
// unplaced thing is not at distance zero, which is the one wrong answer
// that would look like the right one.
function distanceMetres(a, b) {
  if (!isPosition(a) || !isPosition(b)) return null;

  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

// The position of a row, whatever kind it is. One reader, so a caller
// never has to know which column a given table put it in.
function positionOf(row) {
  if (!row) return null;
  // **`Number(null)` is 0 and `{lat: 0, lon: 0}` is a valid position** —
  // so mapping before checking puts every unplaced row at Null Island,
  // which is this file's own `SYNTHETIC_ORIGIN`. An unplaced city would
  // have read as sitting exactly where a generated world starts, and
  // every distance measured from it would have been a real number
  // computed from nothing. CLAUDE.md's corollary, caught by the test
  // that asserts an unplaced thing is not at distance zero.
  const { latitude, longitude } = row;
  if (latitude === null || latitude === undefined) return null;
  if (longitude === null || longitude === undefined) return null;
  const position = { lat: Number(latitude), lon: Number(longitude) };
  return isPosition(position) ? position : null;
}

// ---------------------------------------------------------------------
// Placing a generated world
// ---------------------------------------------------------------------

//: Where a generated world sits. **Flagged synthetic, and the flag is
//: load-bearing**: nothing computed over these coordinates is a fact
//: about anywhere real, and `SOURCE` on every row says so. A world built
//: from a real import overwrites both the reference and the position and
//: the flag changes with them.
//:
//: The origin is deliberately in open ocean off West Africa — 0°N 0°E,
//: Null Island. A synthetic world that placed itself on a real city
//: would produce screenshots and statistics that look like claims about
//: that city.
const SYNTHETIC_ORIGIN = { lat: 0, lon: 0 };

//: How far apart a generated world's places sit. Cities a few tens of
//: kilometres apart, communities a few kilometres inside one, which is
//: the scale at which "distance to the station" is a real difference
//: rather than rounding. Interpretive like every other composition
//: number in `worldgen`.
const CITY_SPREAD_M = 40000;
const COMMUNITY_SPREAD_M = 6000;

// Metres to degrees at a given latitude. Longitude degrees shrink with
// latitude and this is the one place that conversion happens — it is
// used to PLACE things, never to measure them, and measurement stays
// haversine.
function offsetPosition(origin, eastMetres, northMetres) {
  const latDegrees = northMetres / 111320;
  const lat = origin.lat + latDegrees;
  const shrink = Math.cos(toRadians(lat));
  const lonDegrees = eastMetres / (111320 * (Math.abs(shrink) < 1e-9 ? 1e-9 : shrink));
  return {
    lat: Math.round((lat) * 1e6) / 1e6,
    lon: Math.round((origin.lon + lonDegrees) * 1e6) / 1e6,
  };
}

// A seeded position within `spread` metres of an origin. §88: seeded on
// POSITION in the world's structure, never on an id, because ids come
// from a counter whose state depends on what was built before.
function scatter(origin, spread, parts) {
  const angle = seededDraw([...parts, 'angle']) * 2 * Math.PI;
  // Square root keeps the draw uniform over the DISC rather than over
  // the radius, which would cluster everything at the centre.
  const radius = Math.sqrt(seededDraw([...parts, 'radius'])) * spread;
  return offsetPosition(origin, Math.cos(angle) * radius, Math.sin(angle) * radius);
}

// ---------------------------------------------------------------------
// Reading a world
// ---------------------------------------------------------------------

// The nearest thing of a kind to a community, in metres, with what it
// was. Null when the community is unplaced or nothing of that kind is
// placed in reach — **not Infinity and not zero**, both of which a
// caller would arithmetic straight into a wrong answer.
function nearestInfrastructure(worldState, communityId, type) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  const from = positionOf(community);
  if (!from) return null;

  let best = null;
  for (const row of worldState.infrastructure || []) {
    if (row.type !== type) continue;
    const to = positionOf(row);
    if (!to) continue;
    const metres = distanceMetres(from, to);
    if (metres === null) continue;
    if (best === null || metres < best.metres) best = { metres, infrastructureId: row.id, type };
  }
  return best;
}

// Everything placed within `metres` of a community, by kind. The read a
// hotspot or a catchment needs, and the reason `nearestInfrastructure`
// is not the only accessor.
function withinMetres(worldState, communityId, metres, type = null) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  const from = positionOf(community);
  if (!from) return [];

  const found = [];
  for (const row of worldState.infrastructure || []) {
    if (type !== null && row.type !== type) continue;
    const distance = distanceMetres(from, positionOf(row));
    if (distance === null || distance > metres) continue;
    found.push({ infrastructureId: row.id, type: row.type, metres: distance });
  }
  return found.sort((a, b) => a.metres - b.metres);
}

function describeGeo(worldState, communityId) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community) return null;
  const city = (worldState.cities || []).find((c) => c.id === community.city_id) ?? null;
  return {
    communityId,
    ref: community.geo_ref ?? null,
    source: community.geo_source ?? null,
    position: positionOf(community),
    cityRef: city?.real_world_geo_ref ?? null,
    inCity: city?.real_world_geo_ref && community.geo_ref
      ? contains(city.real_world_geo_ref, community.geo_ref)
      : null,
    nearestStation: nearestInfrastructure(worldState, communityId, 'public_safety'),
    nearestHospital: nearestInfrastructure(worldState, communityId, 'hospitals'),
  };
}

module.exports = {
  TIERS,
  SOURCES,
  SEGMENT,
  CENSUS_WIDTHS,
  CENSUS_BLOCK_LENGTH,
  SYNTHETIC_ORIGIN,
  CITY_SPREAD_M,
  COMMUNITY_SPREAD_M,
  EARTH_RADIUS_M,
  parseRef,
  isRef,
  refOf,
  contains,
  parentOf,
  fromCensusBlock,
  isPosition,
  assertPosition,
  distanceMetres,
  positionOf,
  offsetPosition,
  scatter,
  nearestInfrastructure,
  withinMetres,
  describeGeo,
};
