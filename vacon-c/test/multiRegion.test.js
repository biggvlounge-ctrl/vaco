// Task #110: multi-region worlds -- "so Gaza, Nepal, Brazil, Spain,
// Haiti, UK can all be real, distinct, simultaneous locations."
//
// ---------------------------------------------------------------------
// What was actually missing
//
// `migration.generateRegion` already pushed onto `worldState.regions`
// rather than replacing it, and `worldgen.js`'s own header already
// said `engine.WorldState` is shared and a second `generateWorld` call
// APPENDS -- this file was already built to tolerate being called more
// than once in the same process. So the real gap was never "can a
// second region exist" (it already could); it was that nothing had
// ever actually done it, and three real places still assumed, when
// they read `worldState.civilizations`, that there could only ever be
// one:
//
//   - `statecraft.stateOf`/`budgetOf` answered "the first civilization"
//     / "every city's mean economy" -- correct for the one-civilization
//     world every existing test and every real world this engine had
//     ever generated, and wrong the instant a second civilization
//     exists: Brazil's state budget has no business moving because
//     Haiti's cities got poorer. Fixed in `statecraft.js` and tested
//     directly in `test/statecraft.test.js`.
//   - `media.eraReached` checked "has ANY civilization anywhere
//     reached this era" -- so a Brazilian civilization reaching
//     `writing` would hand a Haitian city a bulletin channel it had
//     not earned. Fixed in `media.js` and tested directly in
//     `test/media.test.js`.
//   - `weapons.regionHasTrackedMilitaryCapability` read
//     `region.country_key` (snake case) against a field
//     `migration.generateRegion` has only ever written as
//     `region.countryKey` (camel case) -- always `undefined`, so
//     `machine_gun` could never be found anywhere in ANY world, single
//     or multi-region, and the project's own test fixture built the
//     same wrong field name, so a green suite never caught it. Fixed
//     in `weapons.js` and tested directly in `test/weapons.test.js`.
//
// This file is the integration point: six real, named, distinct
// locations, built the real way `worldgen.js` already supports,
// coexisting in one world, ticked together, with nothing crashing and
// nothing blending.
//
// **Standing rule 8, the shape `test/worldgen.test.js` itself uses**:
// `engine.WorldState` is one shared singleton and `generateWorld`
// APPENDS to it, so calling the real generator once per test in this
// file would silently accumulate every earlier test's cities and
// civilizations into the next one's assertions. The fix used there,
// and here, is the same: build the real six-region world exactly ONCE
// at module scope, before any `test()` runs, and have every test read
// from that one build rather than rebuilding it.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const worldgen = require('../server/worldgen.js');
const migration = require('../server/migration.js');
const statecraft = require('../server/statecraft.js');
const engine = require('../server/engine.js');
const tick = require('../server/tick.js');

// Six real, checked `countryPacks.js` keys standing in for the six
// named locations -- `israeli` carries this engine's own real,
// current Gaza war `conflictLevel` (see `countryPacks.js`'s own
// header), and `english` is the real ACS ancestry key the UK's own
// nations are split into (`ancestryPacks.GROUPS`), the same reasoning
// `countryPacks.js` already gives for having no single unified
// "united-kingdom" entry.
const REGIONS = [
  { name: 'Gaza Strip', countryKey: 'israeli', civilizationName: 'Gaza' },
  { name: 'Kathmandu Valley', countryKey: 'nepal', civilizationName: 'Nepal' },
  { name: 'Sao Paulo Metro', countryKey: 'brazil', civilizationName: 'Brazil' },
  { name: 'Catalonia', countryKey: 'spain', civilizationName: 'Spain' },
  { name: 'Port-au-Prince Area', countryKey: 'haitian', civilizationName: 'Haiti' },
  { name: 'Greater London', countryKey: 'english', civilizationName: 'United Kingdom' },
];

const w = engine.WorldState;
const summaries = REGIONS.map((region) => worldgen.generateWorld({
  seed: `multi-region-${region.countryKey}`,
  cities: 1,
  communitiesPerCity: 1,
  populationPerCommunity: 6,
  regionName: region.name,
  countryKey: region.countryKey,
  civilizationName: region.civilizationName,
  // Keep each build small and fast -- this test is about the SIX
  // REGIONS COEXISTING, not about any one of them being deep.
  landmarksPerCity: 1,
  shopsPerArea: 1,
  artifacts: 1,
  startingInvestmentsPerCity: 0,
  marketListings: 1,
}));

// Every assertion below is scoped to exactly these ids, not to
// `w.cities`/`w.regions`/`w.civilizations` wholesale -- those stay
// correct only for THIS file, run alone, with nothing built before
// it; scoping to the real ids each `generateWorld` call actually
// returned is what keeps every assertion true regardless of run
// order or of what else shares the process.
const cityIds = summaries.map((s) => s.cities[0]);
const regionIds = summaries.map((s) => s.regionId);
const civIds = summaries.map((s) => s.civilizationId);

test('six real, named countries can be generated into one world without colliding on any id', () => {
  assert.equal(new Set(civIds).size, 6, 'civilization ids must not collide');
  assert.equal(new Set(regionIds).size, 6, 'region ids must not collide');
  assert.equal(new Set(cityIds).size, 6, 'city ids must not collide');
});

test('each region carries its own real country\'s own real facts, not a shared or blended one', () => {
  const regionsByCountryKey = new Map(
    REGIONS.map((region, i) => [
      region.countryKey,
      w.regions.find((r) => r.id === regionIds[i]),
    ]),
  );
  assert.equal(regionsByCountryKey.get('israeli').conflictLevel, 'active-armed-conflict', 'Gaza\'s own real, current war status');
  assert.equal(regionsByCountryKey.get('nepal').incomeLevel, 'low-income');
  assert.ok(regionsByCountryKey.get('brazil').incomeLevel, 'brazil should carry a real income level');
  assert.ok(regionsByCountryKey.get('spain').incomeLevel, 'spain should carry a real income level');
  assert.ok(regionsByCountryKey.get('haitian').incomeLevel, 'haiti should carry a real income level');
  assert.ok(regionsByCountryKey.get('english').incomeLevel, 'the UK (via the real english ancestry key) should carry a real income level');
  // Six distinct countryKeys were actually resolved -- not six
  // regions quietly all pointing at the same one real country pack.
  assert.equal(new Set(regionsByCountryKey.values()).size, 6);
});

test('each city resolves to its OWN civilization through migration.civilizationOfCity, never the first one built', () => {
  for (const cityId of cityIds) {
    const region = migration.regionOfCity(w, cityId);
    assert.ok(region, `city ${cityId} should have a real region`);
    const civ = migration.civilizationOfCity(w, cityId);
    assert.ok(civ, `city ${cityId} should resolve to a real civilization`);
    assert.equal(civ.id, region.civilization_id, 'resolved civilization must be the one this city\'s own region actually names');
  }
  // And every one of these six cities resolved to a DIFFERENT
  // civilization -- the whole point of six distinct regions.
  const resolved = cityIds.map((id) => migration.civilizationOfCity(w, id).id);
  assert.equal(new Set(resolved).size, 6);
});

test('statecraft.budgetOf, scoped per civilization, differs across the six real regions and never blends them', () => {
  for (let i = 0; i < REGIONS.length; i += 1) {
    const civId = civIds[i];
    const city = w.cities.find((c) => c.id === cityIds[i]);
    // Scoped budgets are each read from exactly one city (cities: 1
    // per region in this fixture), so each must equal that one
    // city's own economy -- not the six-city world mean, which is
    // what a blended (unscoped) read would have produced instead.
    assert.equal(statecraft.budgetOf(w, civId), Math.round(city.economy));
  }
  // And at least one pair of the six real civilizations actually
  // reads a DIFFERENT budget -- the claim this whole file exists to
  // check, not just that each number is internally consistent.
  const budgets = civIds.map((id) => statecraft.budgetOf(w, id));
  assert.ok(new Set(budgets).size > 1, 'six independently-drawn cities should not all land on the same economy');
});

test('advanceTick runs cleanly across a real six-civilization world with nothing crashing', () => {
  // Not a deep claim about what happens inside the tick -- just the
  // honest floor every real multi-region claim depends on: the engine
  // that was built assuming one civilization has to actually run with
  // six of them in the world at once.
  assert.doesNotThrow(() => tick.advanceTick(w));
  assert.doesNotThrow(() => tick.advanceTick(w));
});
