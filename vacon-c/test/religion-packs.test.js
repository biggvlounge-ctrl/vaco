// A real county's religious composition, read onto `npcs.religion` —
// wired in on explicit instruction after the tension with this
// engine's own invented-vocabulary rule was raised. See
// `server/religionPacks.js`'s own header for the full reasoning this
// module does not repeat.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const religionPacks = require('../server/religionPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    counties: [{ countyFips: '29510', countyName: 'St. Louis', shares: { catholic: 0.6, unaffiliated: 0.4 } }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.religionPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(religionPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(religionPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(religionPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a county needs a countyFips — this source is licence-encumbered, so provenance is not optional', () => {
  const problems = religionPacks.validatePack(pack({ counties: [{ shares: { catholic: 1 } }] }));
  assert.ok(problems.some((p) => p.includes('countyFips')));
});

test('an unrecognised tradition is refused, not silently placed', () => {
  const problems = religionPacks.validatePack(pack({
    counties: [{ countyFips: '29510', shares: { zoroastrian: 1 } }],
  }));
  assert.ok(problems.some((p) => p.includes('shares')));
});

test('a share outside 0..1 is refused, not clamped silently', () => {
  const problems = religionPacks.validatePack(pack({
    counties: [{ countyFips: '29510', shares: { catholic: 1.4 } }],
  }));
  assert.ok(problems.some((p) => p.includes('shares')));
});

test('an empty counties array is refused', () => {
  const problems = religionPacks.validatePack(pack({ counties: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// countyFor / religionFor
// ---------------------------------------------------------------------

test('countyFor cycles by position, and is null with no pack', () => {
  const p = pack({
    counties: [{ countyFips: 'A', shares: { catholic: 1 } }, { countyFips: 'B', shares: { muslim: 1 } }],
  });
  assert.equal(religionPacks.countyFor(p, 0).countyFips, 'A');
  assert.equal(religionPacks.countyFor(p, 1).countyFips, 'B');
  assert.equal(religionPacks.countyFor(p, 2).countyFips, 'A', 'position 2 should wrap');
  assert.equal(religionPacks.countyFor(null, 0), null);
});

test('religionFor reads a real share; null with no county or no recorded shares', () => {
  const county = { countyFips: '29510', shares: { catholic: 1 } };
  assert.equal(religionPacks.religionFor(county, 0.5), 'catholic');
  assert.equal(religionPacks.religionFor(null, 0.5), null);
  assert.equal(religionPacks.religionFor({ countyFips: 'X' }, 0.5), null);
});

test('religionFor resolves against real cumulative shares, including unaffiliated', () => {
  const county = { countyFips: '29510', shares: { catholic: 0.6, unaffiliated: 0.4 } };
  assert.equal(religionPacks.religionFor(county, 0.1), 'catholic');
  assert.equal(religionPacks.religionFor(county, 0.9), 'unaffiliated');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with an all-"catholic" county gives every resident the real tradition', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'religion-pack-test',
      religionPack: pack({ counties: [{ countyFips: '29510', shares: { catholic: 1 } }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 20,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.length > 0);
    assert.ok(made.every((n) => n.religion === 'catholic'), 'every resident should read the real county share');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-religion-pack',
      religionPack: { region: 'X', source: 'sample', counties: [{ countyFips: 'Y', shares: { nope: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no religion pack still draws from the invented vocabulary, unchanged', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-religion-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.length >= 10);
  assert.ok(made.every((n) => ['Tidewater', 'Ridge', 'None'].includes(n.religion)),
    'with no pack, religion should still come from the invented vocabulary');
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s vocabulary matches world-layer\'s own TRADITIONS and UNAFFILIATED', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'imports', 'religionImport.js'), 'utf8',
  );
  const block = source.match(/const TRADITION_MAP = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'world-layer/imports/religionImport.js no longer declares TRADITION_MAP');
  const theirs = [...new Set([...block[1].matchAll(/: '([a-z-]+)'/g)].map((m) => m[1]))];
  assert.deepEqual(theirs.slice().sort(), religionPacks.TRADITIONS.slice().sort());
});
