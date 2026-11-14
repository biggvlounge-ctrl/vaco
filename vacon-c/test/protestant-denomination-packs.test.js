// A real Baptist/nondenominational/other-Protestant split, drawn only
// when `npc.religion` resolved to the real `'protestant'` tradition —
// a national Pew survey reference, never a geographic pack, and never
// read by anything that decides an outcome. Read
// `server/protestantDenominationPacks.js`'s own header before this
// file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const protestantDenominationPacks = require('../server/protestantDenominationPacks.js');
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
// The firewall — the same shape test/ethnicity.test.js / islamic-sect
// -packs.test.js already hold
// ---------------------------------------------------------------------

test('no generator of outcomes reads protestantDenomination', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /protestantDenomination/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads protestantDenomination. §9 forbids a demographic `
    + 'deciding an outcome; this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read protestantDenomination', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /protestantDenomination/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures protestantDenomination');
  const expected = ['demographics.js', 'engine.js', 'protestantDenominationPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading protestantDenomination — that is a decision `
    + 'to take explicitly, the same way adding islamicSect was.');
});

// ---------------------------------------------------------------------
// denominationFor
// ---------------------------------------------------------------------

test('denominationFor resolves against the real Pew reference shares', () => {
  assert.equal(protestantDenominationPacks.denominationFor(0.1), 'baptist');
  assert.equal(protestantDenominationPacks.denominationFor(0.4), 'nondenominational');
  assert.equal(protestantDenominationPacks.denominationFor(0.8), 'other-protestant');
});

test('PEW_REFERENCE shares are derived from the real published shareOfAllAdults figures', () => {
  const { shareOfAllAdults, shares } = protestantDenominationPacks.PEW_REFERENCE;
  assert.equal(shares.baptist, shareOfAllAdults.baptist / shareOfAllAdults.protestantOverall);
  assert.equal(shares.nondenominational, shareOfAllAdults.nondenominational / shareOfAllAdults.protestantOverall);
  const total = shares.baptist + shares.nondenominational + shares['other-protestant'];
  assert.ok(Math.abs(total - 1) < 1e-9, 'the three shares should exhaust the Protestant population');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with an all-"protestant" county draws a real denomination for every Protestant resident', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'protestant-denomination-pack-test',
      religionPack: { region: 'Testville', source: 'sample', counties: [{ countyFips: '29510', shares: { protestant: 1 } }] },
      communitiesPerCity: 1,
      populationPerCommunity: 30,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.every((n) => n.religion === 'protestant'));
    assert.ok(made.every((n) => protestantDenominationPacks.DENOMINATIONS.includes(n.protestantDenomination)),
      'every Protestant resident should have a real denomination drawn');
  } finally {
    cleanup();
  }
});

test('a resident whose religion is not "protestant" always has protestantDenomination null', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({
    seed: 'protestant-denomination-non-protestant',
    religionPack: { region: 'Testville', source: 'sample', counties: [{ countyFips: '29510', shares: { catholic: 1 } }] },
    communitiesPerCity: 1,
    populationPerCommunity: 10,
  });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.religion === 'catholic' && n.protestantDenomination === null));
  cleanup();
});

test('a world with no religion pack never sets protestantDenomination, same as before this existed', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-religion-pack-protestant-denomination', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.protestantDenomination === null));
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports protestantDenomination beside religion and islamicSect', () => {
  const residents = [
    { id: 1, religion: 'protestant', protestantDenomination: 'baptist' },
    { id: 2, religion: 'protestant', protestantDenomination: 'baptist' },
    { id: 3, religion: 'catholic', protestantDenomination: null },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.protestantDenomination.distribution.rows.length > 1);
  assert.equal(composition.protestantDenomination.dominantShare, 1, 'baptist is the only known denomination among the two Protestants');
});
