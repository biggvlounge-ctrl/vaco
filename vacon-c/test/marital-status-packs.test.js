// A real tract's marital-status composition (Census ACS table B12001,
// population 15+), read onto a new `npc.maritalStatus` field — drawn
// only for adults, never read by anything that decides an outcome.
// Read server/maritalStatusPacks.js's own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const maritalStatusPacks = require('../server/maritalStatusPacks.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const demographics = require('../server/demographics.js');

const SERVER = path.join(__dirname, '..', 'server');

function codeOf(file) {
  const source = fs.readFileSync(path.join(SERVER, file), 'utf8');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function pack(overrides = {}) {
  return {
    region: 'Testville',
    source: 'sample',
    tracts: [{ tractId: 't1', shares: { 'now-married': 0.6, 'never-married': 0.4 } }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.maritalStatusPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(maritalStatusPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(maritalStatusPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(maritalStatusPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId and real shares keyed on the five real categories', () => {
  const noId = maritalStatusPacks.validatePack(pack({ tracts: [{ shares: { 'now-married': 1 } }] }));
  assert.ok(noId.some((p) => p.includes('tractId')));

  const badShares = maritalStatusPacks.validatePack(pack({ tracts: [{ tractId: 't1', shares: { eloped: 1 } }] }));
  assert.ok(badShares.some((p) => p.includes('shares')));
});

test('an empty tracts array is refused', () => {
  const problems = maritalStatusPacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('every real published category is accepted in a shares object', () => {
  for (const category of maritalStatusPacks.CATEGORIES) {
    assert.deepEqual(
      maritalStatusPacks.validatePack(pack({ tracts: [{ tractId: 't1', shares: { [category]: 1 } }] })),
      [],
    );
  }
});

// ---------------------------------------------------------------------
// tractFor / maritalStatusFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({
    tracts: [{ tractId: 'A', shares: { divorced: 1 } }, { tractId: 'B', shares: { widowed: 1 } }],
  });
  assert.equal(maritalStatusPacks.tractFor(p, 0).tractId, 'A');
  assert.equal(maritalStatusPacks.tractFor(p, 1).tractId, 'B');
  assert.equal(maritalStatusPacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(maritalStatusPacks.tractFor(null, 0), null);
});

test('maritalStatusFor resolves against the tract\'s own real shares', () => {
  const tract = { tractId: 't1', shares: { 'now-married': 0.5, divorced: 0.5 } };
  assert.equal(maritalStatusPacks.maritalStatusFor(tract, 0.1), 'now-married');
  assert.equal(maritalStatusPacks.maritalStatusFor(tract, 0.9), 'divorced');
});

test('maritalStatusFor is null with no tract, no shares, or a zero total', () => {
  assert.equal(maritalStatusPacks.maritalStatusFor(null, 0.5), null);
  assert.equal(maritalStatusPacks.maritalStatusFor({ tractId: 't1' }, 0.5), null);
  assert.equal(maritalStatusPacks.maritalStatusFor({ tractId: 't1', shares: {} }, 0.5), null);
});

// ---------------------------------------------------------------------
// The firewall — the same shape test/ethnicity.test.js already holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads maritalStatus', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /maritalStatus/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads maritalStatus. §9 forbids a demographic deciding an `
    + 'outcome; this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read maritalStatus', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /maritalStatus/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures maritalStatus');
  const expected = ['demographics.js', 'engine.js', 'maritalStatusPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading maritalStatus — that is a decision to take `
    + 'explicitly, the same way adding ethnicity was.');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real marital-status pack draws a real status for every adult', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'marital-status-pack-test',
      maritalStatusPack: pack({ tracts: [{ tractId: 't1', shares: { divorced: 1 } }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    const adults = made.filter((n) => n.maritalStatus !== null);
    assert.ok(adults.length > 0, 'at least one generated resident should be an adult');
    assert.ok(adults.every((n) => n.maritalStatus === 'divorced'));
  } finally {
    cleanup();
  }
});

test('a child never has a real maritalStatus drawn, even with a pack present', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'marital-status-children-test',
      maritalStatusPack: pack({ tracts: [{ tractId: 't1', shares: { divorced: 1 } }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    const children = made.filter((n) => (engine.WorldState.tick - n.createdTick) / 365 < 18);
    for (const child of children) {
      assert.equal(child.maritalStatus, null, 'a minor should never have a marital status');
    }
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-marital-status-pack',
      maritalStatusPack: { region: 'X', source: 'sample', tracts: [{ tractId: 't1', shares: { eloped: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no marital-status pack leaves maritalStatus null for everybody', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-marital-status-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.maritalStatus === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports maritalStatus, folding a child into "unknown" the same way education does', () => {
  const residents = [
    { id: 1, maritalStatus: 'now-married' },
    { id: 2, maritalStatus: 'now-married' },
    { id: 3, maritalStatus: null },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.maritalStatus.distribution.rows.length > 1);
  assert.equal(composition.maritalStatus.dominantShare, 1, 'the two known adults are the whole of the KNOWN population');
});
