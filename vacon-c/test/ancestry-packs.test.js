// A real tract's ancestry composition, read onto `npc.ethnicity` —
// wired in on explicit instruction after the same tension
// `religionPacks.js` already raised was raised a second time. See
// `server/ancestryPacks.js`'s own header for the full reasoning this
// module does not repeat.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ancestryPacks = require('../server/ancestryPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function pack(overrides = {}) {
  return {
    region: 'Minneapolis, Minnesota',
    source: 'sample',
    tracts: [{ tractId: '27053001100', shares: { somali: 0.6, unspecified: 0.4 } }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.ancestryPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(ancestryPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(ancestryPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(ancestryPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId', () => {
  const problems = ancestryPacks.validatePack(pack({ tracts: [{ shares: { somali: 1 } }] }));
  assert.ok(problems.some((p) => p.includes('tractId')));
});

test('an unrecognised ancestry group is refused, not silently placed', () => {
  const problems = ancestryPacks.validatePack(pack({
    tracts: [{ tractId: 'X', shares: { martian: 1 } }],
  }));
  assert.ok(problems.some((p) => p.includes('shares')));
});

test('a share outside 0..1 is refused, not clamped silently', () => {
  const problems = ancestryPacks.validatePack(pack({
    tracts: [{ tractId: 'X', shares: { somali: 1.4 } }],
  }));
  assert.ok(problems.some((p) => p.includes('shares')));
});

test('an empty tracts array is refused', () => {
  const problems = ancestryPacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// tractFor / ethnicityFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({
    tracts: [{ tractId: 'A', shares: { somali: 1 } }, { tractId: 'B', shares: { bosnian: 1 } }],
  });
  assert.equal(ancestryPacks.tractFor(p, 0).tractId, 'A');
  assert.equal(ancestryPacks.tractFor(p, 1).tractId, 'B');
  assert.equal(ancestryPacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(ancestryPacks.tractFor(null, 0), null);
});

test('ethnicityFor reads a real share; null with no tract or no recorded shares', () => {
  const tract = { tractId: '27053001100', shares: { somali: 1 } };
  assert.equal(ancestryPacks.ethnicityFor(tract, 0.5), 'somali');
  assert.equal(ancestryPacks.ethnicityFor(null, 0.5), null);
  assert.equal(ancestryPacks.ethnicityFor({ tractId: 'X' }, 0.5), null);
});

test('ethnicityFor resolves against real cumulative shares, including unspecified', () => {
  const tract = { tractId: '27053001100', shares: { somali: 0.6, unspecified: 0.4 } };
  assert.equal(ancestryPacks.ethnicityFor(tract, 0.1), 'somali');
  assert.equal(ancestryPacks.ethnicityFor(tract, 0.9), 'unspecified');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with an all-"somali" tract gives every resident the real ancestry group', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'ancestry-pack-test',
      ancestryPack: pack({ tracts: [{ tractId: '27053001100', shares: { somali: 1 } }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 20,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.length > 0);
    assert.ok(made.every((n) => n.ethnicity === 'somali'), 'every resident should read the real tract share');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-ancestry-pack',
      ancestryPack: { region: 'X', source: 'sample', tracts: [{ tractId: 'Y', shares: { nope: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no ancestry pack still draws from the invented vocabulary, unchanged', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-ancestry-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.length >= 10);
  assert.ok(
    made.every((n) => ['Riverborn', 'Highland', 'Coastwise', 'Outlander'].includes(n.ethnicity)),
    'with no pack, ethnicity should still come from the invented vocabulary',
  );
  cleanup();
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s vocabulary matches world-layer\'s own GROUPS and UNSPECIFIED', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'imports', 'ancestryImport.js'), 'utf8',
  );
  const block = source.match(/const GROUP_MAP = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'world-layer/imports/ancestryImport.js no longer declares GROUP_MAP');
  const theirs = [...new Set([...block[1].matchAll(/: '([a-z-]+)'/g)].map((m) => m[1]))];
  assert.deepEqual(theirs.slice().sort(), ancestryPacks.GROUPS.filter((g) => g !== 'other').slice().sort());
});
