// A real county's two-party vote share, imported per region — the
// one pack reader in this registry that reports rather than drives
// anything. Read `server/politicalPacks.js`'s own header before this
// file for why.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const politicalPacks = require('../server/politicalPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const statistics = require('../server/statistics.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    counties: [{ countyFips: '29510', democraticShare: 0.65 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.politicalPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(politicalPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(politicalPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(politicalPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a county needs a countyFips', () => {
  const problems = politicalPacks.validatePack(pack({ counties: [{ democraticShare: 0.5 }] }));
  assert.ok(problems.some((p) => p.includes('countyFips')));
});

test('a democraticShare outside 0..1 is refused, not clamped silently', () => {
  const problems = politicalPacks.validatePack(pack({
    counties: [{ countyFips: 'X', democraticShare: 1.2 }],
  }));
  assert.ok(problems.some((p) => p.includes('democraticShare')));
});

test('an empty counties array is refused', () => {
  const problems = politicalPacks.validatePack(pack({ counties: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// countyFor / leanFor
// ---------------------------------------------------------------------

test('countyFor cycles by position, and is null with no pack', () => {
  const p = pack({ counties: [{ countyFips: 'A' }, { countyFips: 'B' }] });
  assert.equal(politicalPacks.countyFor(p, 0).countyFips, 'A');
  assert.equal(politicalPacks.countyFor(p, 1).countyFips, 'B');
  assert.equal(politicalPacks.countyFor(p, 2).countyFips, 'A', 'position 2 should wrap');
  assert.equal(politicalPacks.countyFor(null, 0), null);
});

test('leanFor reads a real share, and null with no county or no value', () => {
  assert.equal(politicalPacks.leanFor({ countyFips: 'X', democraticShare: 0.42 }), 0.42);
  assert.equal(politicalPacks.leanFor({ countyFips: 'X' }), null);
  assert.equal(politicalPacks.leanFor(null), null);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real political pack sets city.politicalLean, read by statistics.js', () => {
  const w = engine.WorldState;
  try {
    worldgen.generateWorld({
      seed: 'political-pack-test',
      politicalPack: pack({ counties: [{ countyFips: '29510', democraticShare: 0.73 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const city = w.cities[w.cities.length - 1];
    assert.equal(city.politicalLean, 0.73);
    const community = w.communities.find((c) => c.city_id === city.id);
    const profile = statistics.profileFor(w, community.id);
    assert.equal(profile.statistics.political_lean.value, 0.73);
    assert.equal(profile.statistics.political_lean.known, true);
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-political-pack',
      politicalPack: { region: 'X', source: 'sample', counties: [{ countyFips: 'Y', democraticShare: 5 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no political pack leaves political_lean unknown, not an invented default', () => {
  cleanup();
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'no-political-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const city = w.cities[w.cities.length - 1];
  assert.equal(city.politicalLean, undefined);
  const community = w.communities.find((c) => c.city_id === city.id);
  const profile = statistics.profileFor(w, community.id);
  assert.equal(profile.statistics.political_lean.value, null);
  assert.equal(profile.statistics.political_lean.known, false);
  cleanup();
});
