// Where things are, and how far apart.
//
// **Step 1 of the order of operations this repo wrote for itself.**
// `dev-docs/LAND_AND_MAP_DATA.md` §7: "Decide the geo-reference format
// and write the resolver. Census GEOID is the recommendation for the
// US; whatever you choose, `real_world_geo_ref` and `geography_key`
// need a parser before they need data." And §1 on why it is first:
//
//   "Three of those are free-text keys with no format, no parser and no
//    reader. That is the single most important thing to fix before
//    importing anything, because a geo reference nothing can parse is a
//    string, not a location."
//
// §9's MASTER BLOCK KEY opens with GEOGRAPHIC DATA and names police
// station distance and hospital distance among eight fields. The engine
// answered none of them, because nothing anywhere had a position — and
// that was the reason `authority.reachTerm` was city-scoped and no
// generated world had ever produced a lawless area.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const geo = require('../server/geo.js');
const authority = require('../server/authority.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

// -- the format parses, and refuses ---------------------------------------

test('a reference parses into its tiers', () => {
  const parsed = geo.parseRef('29510/2965000/295101011001/295101011001004');
  assert.equal(parsed.tier, 'block');
  assert.equal(parsed.region, '29510');
  assert.equal(parsed.city, '2965000');
  assert.equal(parsed.community, '295101011001');
  assert.equal(parsed.block, '295101011001004');

  // Partial references are legal — a city IS a location.
  assert.equal(geo.parseRef('R1/C2').tier, 'city');
  assert.equal(geo.parseRef('R1').tier, 'region');
});

test('what is not a reference is refused, which is the entire point', () => {
  // A parser that accepted anything would leave these TEXT columns
  // exactly what they were: strings that nothing could ask a question
  // of.
  for (const bad of ['', '  ', 'a/b/c/d/e', 'a//b', 'has space', 'slash/in\\segment', null, 7, {}]) {
    assert.throws(() => geo.parseRef(bad), /geo\.parseRef/,
      `${JSON.stringify(bad)} was accepted as a location`);
  }
  assert.equal(geo.isRef('R1/C1'), true);
  assert.equal(geo.isRef('R1//C1'), false);
});

test('containment is a path prefix, and a gap in the middle is refused', () => {
  assert.equal(geo.contains('R1', 'R1/C2/B3'), true);
  assert.equal(geo.contains('R1/C2', 'R1/C2/B3'), true);
  assert.equal(geo.contains('R1/C2', 'R1/C3/B3'), false);
  // A reference contains itself, so one function answers "is this in
  // that" whichever tier the caller is holding.
  assert.equal(geo.contains('R1/C2', 'R1/C2'), true);
  // And the deeper one never contains the shallower.
  assert.equal(geo.contains('R1/C2/B3', 'R1/C2'), false);

  assert.equal(geo.parentOf('R1/C2/B3'), 'R1/C2');
  assert.equal(geo.parentOf('R1'), null);

  // `refOf` stops at the first gap rather than producing a reference
  // whose containment would lie.
  assert.equal(geo.refOf({ region: 'R1', community: 'B3' }), 'R1');
  assert.throws(() => geo.refOf({}), /at least a region/);
});

// -- the Census adapter, and the wrinkle the document glosses -------------

test('a Census block GEOID maps in, and a Place is a separate argument', () => {
  // **Why the format is a path and not a fixed-width digit string.**
  // The document maps `cities` to a Census PLACE, and a Place GEOID is
  // state(2)+place(5) — places are not built out of tracts and a place
  // boundary crosses them freely. So `city` is NOT a prefix of
  // `community` in the Census scheme, and a format that assumed it was
  // would be wrong about every real municipality on the first import.
  const ref = geo.fromCensusBlock('295101011001004', '2965000');
  assert.equal(ref, '29510/2965000/295101011001/295101011001004');

  const parsed = geo.parseRef(ref);
  assert.equal(parsed.region, '29510', 'the state+county prefix is the region');
  assert.equal(parsed.community, '295101011001', 'the block group is the community');

  // No Place: the county stands in, which is what an unincorporated
  // area actually is rather than a missing value.
  assert.equal(
    geo.fromCensusBlock('295101011001004'),
    '29510/29510/295101011001/295101011001004',
  );

  assert.throws(() => geo.fromCensusBlock('2951010110'), /15 digits/);
  assert.throws(() => geo.fromCensusBlock('not-digits-here'), /digit string/);
});

// -- distance, and the error §7 names by name -----------------------------

test('distance is metres by haversine, and nothing here measures an area', () => {
  // §7 step 2: "Computing an area in degrees is the classic silent
  // error and it is wrong by a factor that varies with latitude."
  // Haversine is exact on a sphere and returns metres, so the trap is
  // not available to fall into — and there is no area function at all.
  assert.equal(typeof geo.distanceMetres, 'function');
  for (const name of Object.keys(geo)) {
    assert.equal(/area|acres|hectare|squareMetres/i.test(name), false,
      `geo.${name} measures an area; §7 names that as the silent error`);
  }

  // One degree of latitude is about 111 km, everywhere.
  const oneDegreeNorth = geo.distanceMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(oneDegreeNorth - 111195) < 500, `one degree read ${oneDegreeNorth} m`);

  // One degree of LONGITUDE is 111 km at the equator and about half
  // that at 60° — which is the whole reason degrees are not a distance.
  const atEquator = geo.distanceMetres({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  const atSixty = geo.distanceMetres({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
  assert.ok(Math.abs(atSixty - atEquator / 2) < 2000,
    `a degree of longitude read ${atEquator} m at the equator and ${atSixty} m at 60°`);

  // Symmetric, and zero to itself.
  const a = { lat: 38.63, lon: -90.2 };
  const b = { lat: 38.7, lon: -90.3 };
  assert.equal(geo.distanceMetres(a, b), geo.distanceMetres(b, a));
  assert.equal(geo.distanceMetres(a, a), 0);
});

test('an unplaced thing is not at distance zero', () => {
  // The one wrong answer that would look like the right one: a null
  // position arithmetics straight into "right here".
  assert.equal(geo.distanceMetres(null, { lat: 0, lon: 0 }), null);
  assert.equal(geo.distanceMetres({ lat: 0, lon: 0 }, undefined), null);
  assert.equal(geo.distanceMetres({ lat: 200, lon: 0 }, { lat: 0, lon: 0 }), null);
  assert.equal(geo.positionOf({ latitude: null, longitude: null }), null);
  assert.equal(geo.positionOf(null), null);
  assert.equal(geo.positionOf({ latitude: 1.5, longitude: -2.5 }).lat, 1.5);
});

test('positions are validated as EPSG:4326, not as any two numbers', () => {
  assert.equal(geo.isPosition({ lat: 0, lon: 0 }), true);
  assert.equal(geo.isPosition({ lat: 90, lon: 180 }), true);
  assert.equal(geo.isPosition({ lat: 91, lon: 0 }), false);
  assert.equal(geo.isPosition({ lat: 0, lon: 181 }), false);
  assert.equal(geo.isPosition({ lat: '0', lon: 0 }), false, 'a string latitude was accepted');
  assert.throws(() => geo.assertPosition({ lat: 91, lon: 0 }), /EPSG:4326/);
});

// -- a generated world is placed ------------------------------------------

test('a generated world has references that resolve and positions that differ', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 3, populationPerCommunity: 8, seed: 'geo',
  });

  for (const city of w.cities) {
    assert.ok(geo.isRef(city.real_world_geo_ref),
      `city ${city.id} has an unparseable reference "${city.real_world_geo_ref}"`);
    assert.ok(geo.positionOf(city), `city ${city.id} is unplaced`);
    assert.equal(city.geo_source, 'synthetic',
      'provenance is missing — §5 of LAND_AND_MAP_DATA.md is titled "why it is not optional"');
  }

  for (const community of w.communities) {
    assert.ok(geo.isRef(community.geo_ref));
    const city = w.cities.find((c) => c.id === community.city_id);
    assert.equal(geo.contains(city.real_world_geo_ref, community.geo_ref), true,
      `community ${community.id} is not inside the city it belongs to`);
  }

  // Every station is placed, or the distance that drives the writ is
  // null everywhere.
  const stations = w.infrastructure.filter((row) => row.type === 'public_safety');
  assert.ok(stations.length > 0);
  for (const station of stations) assert.ok(geo.positionOf(station));

  // And the distances actually DIFFER, which is the whole point — a
  // world where every block is the same distance from the station
  // measures nothing.
  const distances = w.communities
    .map((c) => geo.nearestInfrastructure(w, c.id, 'public_safety'))
    .filter(Boolean)
    .map((n) => n.metres);
  assert.equal(distances.length, w.communities.length);
  assert.ok(new Set(distances).size > 1,
    'every community is the same distance from a station');
  assert.ok(Math.max(...distances) - Math.min(...distances) > 1000,
    `the spread is only ${Math.max(...distances) - Math.min(...distances)} m — too small to `
    + 'make one neighbourhood policed and the next one not');
});

test('the same seed places the same world', () => {
  // §88. A world that could not replay its own geography could not
  // replay anything computed from it.
  const first = engine.WorldState.communities.map((c) => `${c.latitude},${c.longitude}`);
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 3, populationPerCommunity: 8, seed: 'geo',
  });
  const all = engine.WorldState.communities.map((c) => `${c.latitude},${c.longitude}`);
  // `generateWorld` appends, so the second run's rows are the tail.
  const second = all.slice(-first.length);
  assert.deepEqual(second, first);
});

// -- the reader that needed it --------------------------------------------

test('how far the station is changes how far the state reaches', () => {
  // **This is what the geography was for.** `authority.js` recorded the
  // limitation in its own header: "`reach` is city-scoped — serviceLevel
  // is capacity per resident for a whole CITY and caps at 1, so every
  // block in a city with a working station reads fully policed. That
  // leaves `grip` as the only term that genuinely distinguishes one
  // street from the next."
  const near = { lat: 0, lon: 0 };
  const far = geo.offsetPosition(near, 20000, 0);

  const world = (position) => ({
    tick: 10,
    communities: [{
      id: 9, city_id: 1, latitude: position.lat, longitude: position.lon,
    }],
    cities: [{ id: 1 }],
    npcs: [{ id: 1, communityId: 9 }, { id: 2, communityId: 9 }],
    infrastructure: [{
      id: 1, city_id: 1, type: 'public_safety', capacity: 100, condition: 100,
      maintenance_level: 50, age: 0, latitude: near.lat, longitude: near.lon,
    }],
    territoryBlocks: [], organizations: [], entityTraits: [], beliefs: [],
    publicOpinion: [], governments: [], crimeIncidents: [],
  });

  const onTheDoorstep = authority.reachTerm(world(near), 9);
  const acrossTheCity = authority.reachTerm(world(far), 9);
  assert.ok(onTheDoorstep > acrossTheCity,
    `a block at the station read ${onTheDoorstep} and one 20 km away read ${acrossTheCity}`);

  // Falls off, and never to nothing: a distant station is worse than a
  // near one and is not the same as no station.
  assert.ok(acrossTheCity > 0);
});

test('an unplaced world is fully reached, not unreached', () => {
  // **Standing rule 12's first clause.** Every world this engine
  // generated before `geo.js` was unplaced; scoring an unknown distance
  // as an infinite one would have made every area in every one of them
  // lawless the day this was written.
  const unplaced = {
    communities: [{ id: 9, city_id: 1 }], cities: [{ id: 1 }],
    npcs: [{ id: 1, communityId: 9 }], infrastructure: [],
  };
  assert.equal(geo.nearestInfrastructure(unplaced, 9, 'public_safety'), null);
  assert.equal(authority.proximity(unplaced, 9), 1);
});

test('the two distances §9 asks for by name are answerable', () => {
  const w = engine.WorldState;
  const profile = statistics.profileFor(w, w.communities[0].id);

  for (const key of ['police_station_distance_m', 'hospital_distance_m']) {
    const cell = profile.statistics[key];
    assert.ok(cell, `${key} is not in the catalogue`);
    assert.equal(cell.known, true, `${key} came back null on a placed world`);
    assert.ok(cell.value >= 0);
    // **`count`, so it is reported and never z-scored.** The position
    // behind it is synthetic in every generated world, and ranking
    // areas on a made-up geography would dress it as a finding.
    assert.equal(cell.unit, 'count');
    assert.equal(statistics.UNITS[cell.unit].comparable, false);
    assert.match(cell.caveat, /synthetic/);
  }
});
