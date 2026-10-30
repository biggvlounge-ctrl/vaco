// A real tract's disability share (Census ACS table B18101), drawn
// onto a new `npc.disability` boolean field — a weighted coin flip
// against a real local rate, never read by anything that decides an
// outcome. Read server/disabilityPacks.js's own header before this
// file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const disabilityPacks = require('../server/disabilityPacks.js');
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
    tracts: [{ tractId: 't1', disabilityShare: 0.15 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.disabilityPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(disabilityPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(disabilityPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(disabilityPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId and a real share (0..1)', () => {
  const noId = disabilityPacks.validatePack(pack({ tracts: [{ disabilityShare: 0.1 }] }));
  assert.ok(noId.some((p) => p.includes('tractId')));

  const badShare = disabilityPacks.validatePack(pack({ tracts: [{ tractId: 't1', disabilityShare: 5 }] }));
  assert.ok(badShare.some((p) => p.includes('disabilityShare')));
});

test('an empty tracts array is refused', () => {
  const problems = disabilityPacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// tractFor / hasDisabilityFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({ tracts: [{ tractId: 'A', disabilityShare: 0.1 }, { tractId: 'B', disabilityShare: 0.2 }] });
  assert.equal(disabilityPacks.tractFor(p, 0).tractId, 'A');
  assert.equal(disabilityPacks.tractFor(p, 1).tractId, 'B');
  assert.equal(disabilityPacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(disabilityPacks.tractFor(null, 0), null);
});

test('hasDisabilityFor is a real weighted coin flip against the tract\'s own share', () => {
  const tract = { tractId: 't1', disabilityShare: 0.3 };
  assert.equal(disabilityPacks.hasDisabilityFor(tract, 0.1), true, 'below the share is "with disability"');
  assert.equal(disabilityPacks.hasDisabilityFor(tract, 0.9), false, 'above the share is "without"');
});

test('hasDisabilityFor is null (unknown), never false, with no tract or no real share', () => {
  assert.equal(disabilityPacks.hasDisabilityFor(null, 0.5), null);
  assert.equal(disabilityPacks.hasDisabilityFor({ tractId: 't1' }, 0.5), null);
});

// ---------------------------------------------------------------------
// The firewall — the same shape test/ethnicity.test.js already holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads disability', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /disability/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads disability. §9 forbids a demographic deciding an outcome; `
    + 'this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read disability', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /disability/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures disability');
  const expected = ['demographics.js', 'engine.js', 'disabilityPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading disability — that is a decision to take `
    + 'explicitly, the same way adding ethnicity was.');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real disability pack draws a real boolean for every resident', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'disability-pack-test',
      disabilityPack: pack({ tracts: [{ tractId: 't1', disabilityShare: 1 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.every((n) => n.disability === true), 'a 100% share should draw true for everybody');
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-disability-pack',
      disabilityPack: { region: 'X', source: 'sample', tracts: [{ tractId: 't1', disabilityShare: -1 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no disability pack leaves disability null for everybody', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-disability-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.disability === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports disability as its own real boolean distribution', () => {
  const residents = [
    { id: 1, disability: true },
    { id: 2, disability: false },
    { id: 3, disability: false },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.disability.distribution.rows.length === 2, 'true and false should each be a real row');
  assert.equal(composition.disability.dominantShare, 0.6667);
});
