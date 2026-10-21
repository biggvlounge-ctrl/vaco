// A real Sunni/Shia/unaffiliated split, drawn only when `npc.religion`
// resolved to the real `'muslim'` tradition — a national Pew survey
// reference, never a geographic pack, and never read by anything
// that decides an outcome. Read `server/islamicSectPacks.js`'s own
// header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const islamicSectPacks = require('../server/islamicSectPacks.js');
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
// The firewall — the same shape test/ethnicity.test.js already holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads islamicSect', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /islamicSect/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads islamicSect. §9 forbids a demographic deciding an `
    + 'outcome; this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read islamicSect', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /islamicSect/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures islamicSect');
  const expected = ['demographics.js', 'engine.js', 'islamicSectPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading islamicSect — that is a decision to take `
    + 'explicitly, the same way adding ethnicity was.');
});

// ---------------------------------------------------------------------
// sectFor
// ---------------------------------------------------------------------

test('sectFor resolves against the real Pew reference shares', () => {
  assert.equal(islamicSectPacks.sectFor(0.1), 'sunni');
  assert.equal(islamicSectPacks.sectFor(0.6), 'shia');
  assert.equal(islamicSectPacks.sectFor(0.8), 'unaffiliated-muslim');
  assert.equal(islamicSectPacks.sectFor(0.95), 'other');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with an all-"muslim" county draws real sects for every Muslim resident', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'islamic-sect-pack-test',
      religionPack: { region: 'Testville', source: 'sample', counties: [{ countyFips: '29510', shares: { muslim: 1 } }] },
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.every((n) => n.religion === 'muslim'));
    assert.ok(made.every((n) => islamicSectPacks.SECTS.includes(n.islamicSect)),
      'every Muslim resident should have a real sect drawn');
  } finally {
    cleanup();
  }
});

test('a resident whose religion is not "muslim" always has islamicSect null', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({
    seed: 'islamic-sect-non-muslim',
    religionPack: { region: 'Testville', source: 'sample', counties: [{ countyFips: '29510', shares: { catholic: 1 } }] },
    communitiesPerCity: 1,
    populationPerCommunity: 10,
  });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.religion === 'catholic' && n.islamicSect === null));
  cleanup();
});

test('a world with no religion pack never sets islamicSect, same as before this existed', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-religion-pack-islamic-sect', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.islamicSect === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports islamicSect beside religion and ethnicity', () => {
  const residents = [
    { id: 1, religion: 'muslim', islamicSect: 'sunni' },
    { id: 2, religion: 'muslim', islamicSect: 'sunni' },
    { id: 3, religion: 'catholic', islamicSect: null },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.islamicSect.distribution.rows.length > 1);
  assert.equal(composition.islamicSect.dominantShare, 1, 'sunni is the only known sect among the two Muslims');
});
