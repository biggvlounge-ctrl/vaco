// A real Reform/Conservative/Orthodox/no-particular-branch split,
// drawn only when `npc.religion` resolved to the real `'jewish'`
// tradition — a national Pew survey reference, never a geographic
// pack, and never read by anything that decides an outcome. Read
// `server/jewishObservancePacks.js`'s own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const jewishObservancePacks = require('../server/jewishObservancePacks.js');
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

function cleanup() {
  delete engine.WorldState.religionPack;
}

// ---------------------------------------------------------------------
// The firewall — the same shape test/islamic-sect-packs.test.js holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads jewishObservance', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /jewishObservance/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads jewishObservance. §9 forbids a demographic deciding an `
    + 'outcome; this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read jewishObservance', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /jewishObservance/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures jewishObservance');
  const expected = ['demographics.js', 'engine.js', 'jewishObservancePacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading jewishObservance — that is a decision to take `
    + 'explicitly.');
});

// ---------------------------------------------------------------------
// branchFor
// ---------------------------------------------------------------------

test('branchFor resolves against the real Pew reference shares', () => {
  assert.equal(jewishObservancePacks.branchFor(0.1), 'reform');
  assert.equal(jewishObservancePacks.branchFor(0.5), 'conservative');
  assert.equal(jewishObservancePacks.branchFor(0.6), 'orthodox');
  assert.equal(jewishObservancePacks.branchFor(0.95), 'no-particular-branch');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with an all-"jewish" county draws real branches for every Jewish resident', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'jewish-observance-pack-test',
      religionPack: { region: 'Testville', source: 'sample', counties: [{ countyFips: '29510', shares: { jewish: 1 } }] },
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.every((n) => n.religion === 'jewish'));
    assert.ok(made.every((n) => jewishObservancePacks.BRANCHES.includes(n.jewishObservance)),
      'every Jewish resident should have a real branch drawn');
  } finally {
    cleanup();
  }
});

test('a resident whose religion is not "jewish" always has jewishObservance null', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({
    seed: 'jewish-observance-non-jewish',
    religionPack: { region: 'Testville', source: 'sample', counties: [{ countyFips: '29510', shares: { catholic: 1 } }] },
    communitiesPerCity: 1,
    populationPerCommunity: 10,
  });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.religion === 'catholic' && n.jewishObservance === null));
  cleanup();
});

test('a world with no religion pack never sets jewishObservance, same as before this existed', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-religion-pack-jewish-observance', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.jewishObservance === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports jewishObservance beside religion and islamicSect', () => {
  const residents = [
    { id: 1, religion: 'jewish', jewishObservance: 'reform' },
    { id: 2, religion: 'jewish', jewishObservance: 'reform' },
    { id: 3, religion: 'catholic', jewishObservance: null },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.jewishObservance.distribution.rows.length > 1);
  assert.equal(composition.jewishObservance.dominantShare, 1, 'reform is the only known branch among the two Jewish residents');
});
