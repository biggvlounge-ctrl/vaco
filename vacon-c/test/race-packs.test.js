// A real tract's race composition (Census ACS table B02001), read
// onto a new `npc.race` field — distinct from `npc.ethnicity`, never
// read by anything that decides an outcome. Read
// server/racePacks.js's own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const racePacks = require('../server/racePacks.js');
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
    tracts: [{ tractId: 't1', shares: { white: 0.6, 'black-or-african-american': 0.4 } }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.racePack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(racePacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(racePacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(racePacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId and real shares keyed on the seven real categories', () => {
  const noId = racePacks.validatePack(pack({ tracts: [{ shares: { white: 1 } }] }));
  assert.ok(noId.some((p) => p.includes('tractId')));

  const badShares = racePacks.validatePack(pack({ tracts: [{ tractId: 't1', shares: { martian: 1 } }] }));
  assert.ok(badShares.some((p) => p.includes('shares')));
});

test('an empty tracts array is refused', () => {
  const problems = racePacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('every real published category is accepted in a shares object', () => {
  for (const category of racePacks.CATEGORIES) {
    assert.deepEqual(racePacks.validatePack(pack({ tracts: [{ tractId: 't1', shares: { [category]: 1 } }] })), []);
  }
});

// ---------------------------------------------------------------------
// tractFor / raceFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({ tracts: [{ tractId: 'A', shares: { white: 1 } }, { tractId: 'B', shares: { asian: 1 } }] });
  assert.equal(racePacks.tractFor(p, 0).tractId, 'A');
  assert.equal(racePacks.tractFor(p, 1).tractId, 'B');
  assert.equal(racePacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(racePacks.tractFor(null, 0), null);
});

test('raceFor resolves against the tract\'s own real shares', () => {
  const tract = { tractId: 't1', shares: { white: 0.5, asian: 0.5 } };
  assert.equal(racePacks.raceFor(tract, 0.1), 'white');
  assert.equal(racePacks.raceFor(tract, 0.9), 'asian');
});

test('raceFor is null with no tract, no shares, or a zero total', () => {
  assert.equal(racePacks.raceFor(null, 0.5), null);
  assert.equal(racePacks.raceFor({ tractId: 't1' }, 0.5), null);
  assert.equal(racePacks.raceFor({ tractId: 't1', shares: {} }, 0.5), null);
});

// ---------------------------------------------------------------------
// The firewall — the same shape test/ethnicity.test.js already holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads race', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /\brace\b/.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads race. §9 forbids a demographic deciding an outcome; `
    + 'this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read race', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /\brace\b/.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures race');
  const expected = ['demographics.js', 'engine.js', 'racePacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading race — that is a decision to take explicitly, `
    + 'the same way adding ethnicity was.');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real race pack draws a real race for every resident', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'race-pack-test',
      racePack: pack({ tracts: [{ tractId: 't1', shares: { asian: 1 } }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.every((n) => n.race === 'asian'));
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-race-pack',
      racePack: { region: 'X', source: 'sample', tracts: [{ tractId: 't1', shares: { martian: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no race pack leaves race null, not an invented default', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-race-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.race === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports race beside ethnicity, never conflated with it', () => {
  const residents = [
    { id: 1, ethnicity: 'mexican', race: 'white' },
    { id: 2, ethnicity: 'mexican', race: 'white' },
    { id: 3, ethnicity: 'german', race: 'two-or-more-races' },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.race.distribution.rows.length > 1);
  assert.ok(composition.ethnicity.distribution.rows.length > 1);
  assert.equal(composition.race.dominantShare, 0.6667);
});
