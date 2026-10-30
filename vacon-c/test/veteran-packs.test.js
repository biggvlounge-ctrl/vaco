// A real tract's veteran share (Census ACS table B21001, civilian
// population 18+), drawn onto a new `npc.veteranStatus` boolean field
// — drawn only for adults, never read by anything that decides an
// outcome. Read server/veteranPacks.js's own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const veteranPacks = require('../server/veteranPacks.js');
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
    tracts: [{ tractId: 't1', veteranShare: 0.08 }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.veteranPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(veteranPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(veteranPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(veteranPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId and a real share (0..1)', () => {
  const noId = veteranPacks.validatePack(pack({ tracts: [{ veteranShare: 0.1 }] }));
  assert.ok(noId.some((p) => p.includes('tractId')));

  const badShare = veteranPacks.validatePack(pack({ tracts: [{ tractId: 't1', veteranShare: 5 }] }));
  assert.ok(badShare.some((p) => p.includes('veteranShare')));
});

test('an empty tracts array is refused', () => {
  const problems = veteranPacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

// ---------------------------------------------------------------------
// tractFor / hasVeteranStatusFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({ tracts: [{ tractId: 'A', veteranShare: 0.1 }, { tractId: 'B', veteranShare: 0.2 }] });
  assert.equal(veteranPacks.tractFor(p, 0).tractId, 'A');
  assert.equal(veteranPacks.tractFor(p, 1).tractId, 'B');
  assert.equal(veteranPacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(veteranPacks.tractFor(null, 0), null);
});

test('hasVeteranStatusFor is a real weighted coin flip against the tract\'s own share', () => {
  const tract = { tractId: 't1', veteranShare: 0.3 };
  assert.equal(veteranPacks.hasVeteranStatusFor(tract, 0.1), true, 'below the share is "veteran"');
  assert.equal(veteranPacks.hasVeteranStatusFor(tract, 0.9), false, 'above the share is "non-veteran"');
});

test('hasVeteranStatusFor is null (unknown), never false, with no tract or no real share', () => {
  assert.equal(veteranPacks.hasVeteranStatusFor(null, 0.5), null);
  assert.equal(veteranPacks.hasVeteranStatusFor({ tractId: 't1' }, 0.5), null);
});

// ---------------------------------------------------------------------
// The firewall — the same shape test/ethnicity.test.js already holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads veteranStatus', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /veteranStatus/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads veteranStatus. §9 forbids a demographic deciding an `
    + 'outcome; this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read veteranStatus', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /veteranStatus/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures veteranStatus');
  const expected = ['demographics.js', 'engine.js', 'veteranPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading veteranStatus — that is a decision to take `
    + 'explicitly, the same way adding ethnicity was.');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real veteran pack draws a real boolean for every adult', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'veteran-pack-test',
      veteranPack: pack({ tracts: [{ tractId: 't1', veteranShare: 1 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    const adults = made.filter((n) => n.veteranStatus !== null);
    assert.ok(adults.length > 0, 'at least one generated resident should be an adult');
    assert.ok(adults.every((n) => n.veteranStatus === true), 'a 100% share should draw true for every adult');
  } finally {
    cleanup();
  }
});

test('a child never has a real veteranStatus drawn, even with a pack present', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'veteran-status-children-test',
      veteranPack: pack({ tracts: [{ tractId: 't1', veteranShare: 1 }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    const children = made.filter((n) => (engine.WorldState.tick - n.createdTick) / 365 < 18);
    for (const child of children) {
      assert.equal(child.veteranStatus, null, 'a minor should never have a veteran status');
    }
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-veteran-pack',
      veteranPack: { region: 'X', source: 'sample', tracts: [{ tractId: 't1', veteranShare: -1 }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no veteran pack leaves veteranStatus null for everybody', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-veteran-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.veteranStatus === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports veteranStatus, folding a child into "unknown" the same way maritalStatus does', () => {
  const residents = [
    { id: 1, veteranStatus: true },
    { id: 2, veteranStatus: false },
    { id: 3, veteranStatus: null },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.veteranStatus.distribution.rows.length === 3, 'true, false, and unknown should each be a row');
});
