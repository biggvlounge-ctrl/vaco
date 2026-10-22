// The real, nonpartisan substitute for "different types of American
// politicians... neocons, Republicans, different organizations" —
// Pew Research's Political Typology (ninth edition, 2026), drawn
// unconditionally for every resident, never read by anything that
// decides an outcome. Read `server/politicalTypologyPacks.js`'s own
// header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const politicalTypologyPacks = require('../server/politicalTypologyPacks.js');
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

// ---------------------------------------------------------------------
// The firewall — the same shape test/ethnicity.test.js and
// test/islamic-sect-packs.test.js already hold
// ---------------------------------------------------------------------

test('no generator of outcomes reads politicalTypology', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
    'authority.js', 'statecraft.js', 'politics.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /politicalTypology/i.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads politicalTypology. §9 forbids a demographic deciding `
    + 'an outcome; this field exists to be counted, not to decide anything.');
});

test('exactly the expected modules read politicalTypology', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /politicalTypology/i.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures politicalTypology');
  const expected = ['demographics.js', 'engine.js', 'politicalTypologyPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading politicalTypology — that is a decision to `
    + 'take explicitly, the same way adding ethnicity was.');
});

// ---------------------------------------------------------------------
// groupFor
// ---------------------------------------------------------------------

test('groupFor resolves against the real Pew 2026 reference shares', () => {
  assert.equal(politicalTypologyPacks.groupFor(0.03), 'leftward-progressives');
  assert.equal(politicalTypologyPacks.groupFor(0.99), 'no-apologies-right');
});

test('every real group is in GROUPS and has a description', () => {
  for (const key of politicalTypologyPacks.GROUPS) {
    const described = politicalTypologyPacks.describeGroup(key);
    assert.ok(described, `${key} has no description`);
    assert.ok(described.shareOfPublic > 0);
  }
  assert.equal(politicalTypologyPacks.describeGroup('made-up-group'), null);
});

test('the shares cited sum close to 1 (Pew\'s own rounding, not an error introduced here)', () => {
  const total = Object.values(politicalTypologyPacks.PEW_REFERENCE.shares)
    .reduce((a, b) => a + b, 0);
  assert.ok(total > 0.95 && total < 1.05, `shares summed to ${total}`);
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a generated world draws a real Pew group for every resident, unconditionally', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({
    seed: 'political-typology-pack-test',
    communitiesPerCity: 1,
    populationPerCommunity: 30,
  });
  const made = w.npcs.slice(before);
  assert.ok(made.length > 0);
  assert.ok(made.every((n) => politicalTypologyPacks.GROUPS.includes(n.politicalTypology)),
    'every resident should have a real Pew political-typology group drawn');
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports politicalTypology beside religion and ethnicity', () => {
  const residents = [
    { id: 1, politicalTypology: 'loyal-liberals' },
    { id: 2, politicalTypology: 'loyal-liberals' },
    { id: 3, politicalTypology: 'no-apologies-right' },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.politicalTypology.distribution.rows.length > 1);
  assert.ok(composition.politicalTypology.dominantShare > 0.5);
});
