// Real, cited national foreign-born shares for specific real
// occupations — reported through `statistics.js` only, never a
// per-NPC field. Read `server/workforceNativityPacks.js`'s own header
// before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workforceNativityPacks = require('../server/workforceNativityPacks.js');
const occupations = require('../server/occupations.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

test('every covered occupation is a real one', () => {
  for (const name of workforceNativityPacks.OCCUPATIONS_COVERED) {
    assert.ok(occupations.definitionOf(name), `${name} is not a real occupation`);
  }
});

test('nativityContextFor is null for an occupation this pack does not cover', () => {
  assert.equal(workforceNativityPacks.nativityContextFor('plumber'), null);
  assert.equal(workforceNativityPacks.nativityContextFor('martian'), null);
});

test('every covered occupation has a real share, real origin countries, and a cited source', () => {
  for (const name of workforceNativityPacks.OCCUPATIONS_COVERED) {
    const context = workforceNativityPacks.nativityContextFor(name);
    assert.ok(context.foreignBornSharePct > 0 && context.foreignBornSharePct < 100, name);
    assert.ok(Array.isArray(context.topOriginCountries) && context.topOriginCountries.length > 0, name);
    assert.ok(typeof context.source === 'string' && context.source.length > 0, name);
  }
});

test('estimatedForeignBornWorkers is null for an occupation this pack does not cover', () => {
  const w = engine.WorldState;
  assert.equal(workforceNativityPacks.estimatedForeignBornWorkers(w, 1, 'plumber'), null);
});

test('estimatedForeignBornWorkers reads a real community\'s own real occupation headcount', () => {
  const w = engine.WorldState;
  const before = w.properties.length;
  worldgen.generateWorld({
    seed: 'workforce-nativity-test', cities: 1, communitiesPerCity: 1,
    populationPerCommunity: 400, institutionStaffing: true,
  });
  const community = w.communities[w.communities.length - 1];
  const result = workforceNativityPacks.estimatedForeignBornWorkers(w, community.id, 'physician');
  assert.ok(result);
  assert.ok(result.realWorkers >= 0);
  assert.ok(result.estimatedForeignBorn <= result.realWorkers,
    'the estimate can never exceed the real headcount it is drawn from');
  assert.deepEqual(result.topOriginCountries, workforceNativityPacks.WORKFORCE_NATIVITY.physician.topOriginCountries);
  void before;
});

// ---------------------------------------------------------------------
// §9: the same forbidden-file scan every real demographic field here
// already holds, pointed at this module's own real sources — nothing
// in server/ may read WORKFORCE_NATIVITY to decide who gets hired,
// promoted, or how any one NPC behaves. Unlike `npc.ethnicity`, this
// module writes no per-NPC field at all, so the scan is narrower: it
// checks that nothing outside `statistics.js` even requires this file.
// ---------------------------------------------------------------------

test('only statistics.js reads workforceNativityPacks.js — a national statistic, never a per-NPC decision', () => {
  const root = path.join(__dirname, '..', 'server');
  const readers = fs.readdirSync(root)
    .filter((name) => name.endsWith('.js') && name !== 'workforceNativityPacks.js')
    .filter((name) => fs.readFileSync(path.join(root, name), 'utf8').includes('workforceNativityPacks'));
  assert.deepEqual(readers, ['statistics.js']);
});
