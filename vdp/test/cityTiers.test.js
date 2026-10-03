'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CITY_TIERS, AMENITY_CATEGORIES, AMENITY_SOURCES, WORLD_AESTHETIC,
  getTier, tierIsSatisfiedBy, classifyComplex, describeCoverage,
  needsRideshare, classifyMeridian,
} from '../src/lib/cityTiers.js';

test('there are real 5, 10, 15, 20, and 30 minute tiers, smallest to largest', () => {
  const minutes = CITY_TIERS.map((t) => t.minutes);
  assert.deepEqual(minutes, [5, 10, 15, 20, 30]);
});

test('radius grows strictly with minutes, from a real walking-speed basis', () => {
  for (let i = 1; i < CITY_TIERS.length; i += 1) {
    assert.ok(CITY_TIERS[i].radiusMeters > CITY_TIERS[i - 1].radiusMeters);
  }
  // ~5 km/h (83 m/min) is the real basis -- a 30-minute radius should
  // land near 2.5km, not an arbitrary number.
  const thirtyMinute = getTier(5);
  assert.ok(thirtyMinute.radiusMeters > 2400 && thirtyMinute.radiusMeters < 2600);
});

test('amenity requirements are cumulative -- a bigger tier never requires less than a smaller one', () => {
  for (let i = 1; i < CITY_TIERS.length; i += 1) {
    const smaller = new Set(CITY_TIERS[i - 1].requiredAmenities);
    const bigger = new Set(CITY_TIERS[i].requiredAmenities);
    for (const category of smaller) {
      assert.ok(bigger.has(category), `tier ${CITY_TIERS[i].id} dropped ${category} from tier ${CITY_TIERS[i - 1].id}`);
    }
  }
});

test('the largest tier requires every real amenity category, with real depth (2+ sources each)', () => {
  const largest = getTier(5);
  assert.deepEqual([...largest.requiredAmenities].sort(), [...AMENITY_CATEGORIES].sort());
  assert.equal(largest.minSourcesPerAmenity, 2);
});

test('tierIsSatisfiedBy refuses a tier when a required amenity has no real source', () => {
  const tier = getTier(1); // residential, shopping, dining
  const incomplete = { residential: ['My Home panel'], shopping: ['CHOPZ Shorts'] }; // dining missing
  assert.equal(tierIsSatisfiedBy(tier, incomplete), false);
});

test('classifyComplex returns the highest real tier actually satisfied, not just any satisfied one', () => {
  const onlyBasics = { residential: ['x'], shopping: ['x'], dining: ['x'] };
  assert.equal(classifyComplex(onlyBasics).id, 1);

  const full = Object.fromEntries(AMENITY_CATEGORIES.map((c) => [c, ['a', 'b']]));
  assert.equal(classifyComplex(full).id, 5);
});

test('classifyComplex returns null when even the smallest tier is unsatisfied', () => {
  assert.equal(classifyComplex({ residential: ['x'] }), null);
});

test('describeCoverage reports every category with its real source list', () => {
  const coverage = describeCoverage({ dining: ['Food District'] });
  const dining = coverage.find((c) => c.category === 'dining');
  const social = coverage.find((c) => c.category === 'social');
  assert.equal(dining.covered, true);
  assert.deepEqual(dining.sources, ['Food District']);
  assert.equal(social.covered, false);
});

test('needsRideshare only flags a trip past the resident\'s own tier radius', () => {
  const tier1 = getTier(1); // 5 min, ~415m
  assert.equal(needsRideshare(100, 1), false);
  assert.equal(needsRideshare(tier1.radiusMeters + 1, 1), true);
});

test('needsRideshare refuses an unknown tier rather than guessing', () => {
  assert.throws(() => needsRideshare(100, 99), /no such tier/);
});

test('only the two largest tiers get farm distribution', () => {
  const flags = CITY_TIERS.map((t) => t.hasFarmDistribution);
  assert.deepEqual(flags, [false, false, false, true, true]);
});

test('only the largest tier gets real fishing spots', () => {
  const flags = CITY_TIERS.map((t) => t.hasFishing);
  assert.deepEqual(flags, [false, false, false, false, true]);
});

test('water features escalate, one real distinct feature per tier, ending in a fishing lagoon', () => {
  const features = CITY_TIERS.map((t) => t.waterFeature);
  assert.equal(new Set(features).size, 5, 'each tier should have its own distinct water feature');
  assert.equal(features[4], 'Fishing Lagoon');
});

test('trail miles grow strictly with tier size, derived from the real radius', () => {
  for (let i = 1; i < CITY_TIERS.length; i += 1) {
    assert.ok(CITY_TIERS[i].trailMiles > CITY_TIERS[i - 1].trailMiles);
  }
});

test('the world aesthetic is futuristic buildings over a natural landscape, for every tier', () => {
  assert.equal(WORLD_AESTHETIC.buildingStyle, 'futuristic');
  assert.match(WORLD_AESTHETIC.landscapeStyle, /natural/);
});

test('hotel count scales from exactly 1 at the smallest tier to exactly 3 at the largest', () => {
  const counts = CITY_TIERS.map((t) => t.maxHotels);
  assert.equal(counts[0], 1);
  assert.equal(counts[4], 3);
  for (let i = 1; i < counts.length; i += 1) {
    assert.ok(counts[i] >= counts[i - 1], 'hotel cap must never shrink going up a tier');
  }
});

test('casino eligibility is not gated to the largest tier -- the real St. Charles precedent is a small complex', () => {
  assert.ok(CITY_TIERS.every((t) => t.casinoEligible === true));
});

test('building height escalates, one distinct real label per tier', () => {
  const heights = CITY_TIERS.map((t) => t.buildingHeightTier);
  assert.equal(new Set(heights).size, 5);
  assert.equal(heights[0], 'Low-Rise');
  assert.equal(heights[4], 'Skyline Tower');
});

test('classifyMeridian reflects the real, currently-built feature set, not an assertion', () => {
  const tier = classifyMeridian();
  assert.ok(tier, 'Meridian must classify into a real tier given AMENITY_SOURCES');
  // Meridian already has a real source for all 6 categories (My Home,
  // CHOPZ Shorts/Fashion, Food District, DREAMS, Village District, The
  // Vavlt/VACAY) -- this is a live readout of that, not a fixed label.
  const coverage = describeCoverage(AMENITY_SOURCES);
  assert.ok(coverage.every((c) => c.covered), 'every amenity category should have a named real source');
});
