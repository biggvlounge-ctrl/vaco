// A real tract's nativity/citizenship-status composition (Census ACS
// table B05001), read onto a new `npc.nativity` field — distinct from
// `npc.ethnicity` and `npc.race`, never read by anything that decides
// an outcome. Read server/nativityPacks.js's own header before this
// file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const nativityPacks = require('../server/nativityPacks.js');
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
    tracts: [{ tractId: 't1', shares: { 'us-born': 0.6, 'non-citizen': 0.4 } }],
    ...overrides,
  };
}

function cleanup() {
  delete engine.WorldState.nativityPack;
}

// ---------------------------------------------------------------------
// A pack is refused, never partly used
// ---------------------------------------------------------------------

test('a well-formed pack validates', () => {
  assert.deepEqual(nativityPacks.validatePack(pack()), []);
});

test('a pack must say where it came from, and a region it is of', () => {
  assert.ok(nativityPacks.validatePack(pack({ source: 'vibes' })).some((p) => p.includes('source')));
  assert.ok(nativityPacks.validatePack(pack({ region: undefined })).some((p) => p.includes('region')));
});

test('a tract needs a tractId and real shares keyed on the five real categories', () => {
  const noId = nativityPacks.validatePack(pack({ tracts: [{ shares: { 'us-born': 1 } }] }));
  assert.ok(noId.some((p) => p.includes('tractId')));

  const badShares = nativityPacks.validatePack(pack({ tracts: [{ tractId: 't1', shares: { martian: 1 } }] }));
  assert.ok(badShares.some((p) => p.includes('shares')));
});

test('an empty tracts array is refused', () => {
  const problems = nativityPacks.validatePack(pack({ tracts: [] }));
  assert.ok(problems.some((p) => p.includes('non-empty')));
});

test('every real published category is accepted in a shares object', () => {
  for (const category of nativityPacks.CATEGORIES) {
    assert.deepEqual(nativityPacks.validatePack(pack({ tracts: [{ tractId: 't1', shares: { [category]: 1 } }] })), []);
  }
});

// ---------------------------------------------------------------------
// tractFor / nativityFor
// ---------------------------------------------------------------------

test('tractFor cycles by position, and is null with no pack', () => {
  const p = pack({ tracts: [{ tractId: 'A', shares: { 'us-born': 1 } }, { tractId: 'B', shares: { 'non-citizen': 1 } }] });
  assert.equal(nativityPacks.tractFor(p, 0).tractId, 'A');
  assert.equal(nativityPacks.tractFor(p, 1).tractId, 'B');
  assert.equal(nativityPacks.tractFor(p, 2).tractId, 'A', 'position 2 should wrap');
  assert.equal(nativityPacks.tractFor(null, 0), null);
});

test('nativityFor resolves against the tract\'s own real shares', () => {
  const tract = { tractId: 't1', shares: { 'us-born': 0.5, 'naturalized-citizen': 0.5 } };
  assert.equal(nativityPacks.nativityFor(tract, 0.1), 'us-born');
  assert.equal(nativityPacks.nativityFor(tract, 0.9), 'naturalized-citizen');
});

test('nativityFor is null with no tract, no shares, or a zero total', () => {
  assert.equal(nativityPacks.nativityFor(null, 0.5), null);
  assert.equal(nativityPacks.nativityFor({ tractId: 't1' }, 0.5), null);
  assert.equal(nativityPacks.nativityFor({ tractId: 't1', shares: {} }, 0.5), null);
});

// ---------------------------------------------------------------------
// The firewall — the same shape test/ethnicity.test.js already holds
// ---------------------------------------------------------------------

test('no generator of outcomes reads nativity', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /\bnativity\b/.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads nativity. §9 forbids a demographic deciding an outcome — `
    + 'this is the one dimension standing in for immigration status, and the stakes of this '
    + 'firewall holding are exactly why it exists to be counted, never to decide.');
});

test('exactly the expected modules read nativity', () => {
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /\bnativity\b/.test(codeOf(f)));
  assert.ok(readers.includes('demographics.js'), 'nothing measures nativity');
  const expected = ['demographics.js', 'engine.js', 'nativityPacks.js', 'worldgen.js'];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading nativity — that is a decision to take explicitly, `
    + 'the same way adding race was.');
});

// ---------------------------------------------------------------------
// A world built from it
// ---------------------------------------------------------------------

test('a world built with a real nativity pack draws a real category for every resident', () => {
  const w = engine.WorldState;
  const before = w.npcs.length;
  try {
    worldgen.generateWorld({
      seed: 'nativity-pack-test',
      nativityPack: pack({ tracts: [{ tractId: 't1', shares: { 'non-citizen': 1 } }] }),
      communitiesPerCity: 1,
      populationPerCommunity: 10,
    });
    const made = w.npcs.slice(before);
    assert.ok(made.every((n) => n.nativity === 'non-citizen'));
  } finally {
    cleanup();
  }
});

test('a bad pack is refused at generation, not half-applied', () => {
  cleanup();
  assert.throws(
    () => worldgen.generateWorld({
      seed: 'bad-nativity-pack',
      nativityPack: { region: 'X', source: 'sample', tracts: [{ tractId: 't1', shares: { martian: 1 } }] },
    }),
    /not usable/,
  );
  cleanup();
});

test('a world with no nativity pack leaves nativity null, not an invented default', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({ seed: 'no-nativity-pack', communitiesPerCity: 1, populationPerCommunity: 10 });
  const made = w.npcs.slice(before);
  assert.ok(made.every((n) => n.nativity === null));
  cleanup();
});

test('nativity applies at any age, unlike maritalStatus/veteranStatus -- a child gets a real draw too', () => {
  cleanup();
  const w = engine.WorldState;
  const before = w.npcs.length;
  worldgen.generateWorld({
    seed: 'nativity-children',
    nativityPack: pack({ tracts: [{ tractId: 't1', shares: { 'us-born': 1 } }] }),
    communitiesPerCity: 1,
    populationPerCommunity: 15,
  });
  const made = w.npcs.slice(before);
  const children = made.filter((n) => (w.tick - n.createdTick) / 365 < 16);
  assert.ok(children.length > 0, 'this seed should produce at least one child to check');
  assert.ok(children.every((n) => n.nativity === 'us-born'), 'a child must get a real nativity draw too, not null');
  cleanup();
});

// ---------------------------------------------------------------------
// Measured like every other demographic dimension
// ---------------------------------------------------------------------

test('compositionOf reports nativity beside race and ethnicity, never conflated with either', () => {
  const residents = [
    { id: 1, ethnicity: 'mexican', race: 'white', nativity: 'non-citizen' },
    { id: 2, ethnicity: 'mexican', race: 'white', nativity: 'non-citizen' },
    { id: 3, ethnicity: 'german', race: 'two-or-more-races', nativity: 'us-born' },
  ];
  const composition = demographics.compositionOf({ npcs: [], languages: [] }, residents);
  assert.ok(composition.nativity.distribution.rows.length > 1);
  assert.ok(composition.race.distribution.rows.length > 1);
  assert.ok(composition.ethnicity.distribution.rows.length > 1);
  assert.equal(composition.nativity.dominantShare, 0.6667);
});

// ---------------------------------------------------------------------
// The two sides must not drift
// ---------------------------------------------------------------------

test('this module\'s categories match world-layer\'s own NATIVITY_CATEGORIES, exactly', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'world-layer', 'imports', 'censusImport.js'), 'utf8',
  );
  const block = source.match(/const NATIVITY_CATEGORIES = \[([\s\S]*?)\];/);
  assert.ok(block, 'world-layer/imports/censusImport.js no longer declares NATIVITY_CATEGORIES');
  const theirs = [...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(theirs, nativityPacks.CATEGORIES);
});

// ---------------------------------------------------------------------
// What this round deliberately did not attempt, stated rather than
// silently skipped
// ---------------------------------------------------------------------

test('year-of-entry was not built this round, and nativity is not persisted to Postgres -- the same real gap race/maritalStatus/disability/veteranStatus already have', () => {
  // `migrate.js`/`restore.js` carry `ethnicity` by column name (the
  // first of these fields, added before this registry's newer fields
  // existed) but none of `race`, `maritalStatus`, `disability`,
  // `veteranStatus` or now `nativity` — there is no `npcs` schema
  // column for any of the five, so none round-trips through a real
  // checkpoint. This is the EXISTING shape of every one of those four
  // sibling fields, not a new gap this round introduced.
  const migrateSource = fs.readFileSync(path.join(SERVER, 'migrate.js'), 'utf8');
  assert.ok(!/\bnativity\b/.test(migrateSource), 'migrate.js should not yet carry nativity, same as its siblings');
});
