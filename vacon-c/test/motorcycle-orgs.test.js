// server/orgArchetypes.js's two new entries -- 'outlaw motorcycle
// gang' and 'motorcycle club' -- and worldgen.js's opt-in founding of
// one of each per city. See CLAUDE.md's own standing rule for this
// round for the full DOJ/ATF-cited reasoning.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const orgArchetypes = require('../server/orgArchetypes.js');
const occupations = require('../server/occupations.js');
const worldgen = require('../server/worldgen.js');
const engine = require('../server/engine.js');

test('outlaw motorcycle gang: type gang, isFaction true -- the real criterion this file already uses for a body that holds ground by force', () => {
  const definition = orgArchetypes.definitionOf('outlaw motorcycle gang');
  assert.equal(definition.type, 'gang');
  assert.equal(definition.isFaction, true);
  assert.ok(definition.posts.every((p) => occupations.definitionOf(p)));
});

test('motorcycle club: type club, no isFaction -- the identical real criterion that keeps a non-territorial civil-society body out of type gang', () => {
  const definition = orgArchetypes.definitionOf('motorcycle club');
  assert.equal(definition.type, 'club');
  assert.ok(!definition.isFaction);
  assert.ok(definition.posts.length > 0);
  assert.ok(definition.posts.every((p) => occupations.definitionOf(p)));
});

test('outlaw motorcycle gang must be founded as a faction, the same real contract every isFaction archetype holds', () => {
  assert.throws(
    () => orgArchetypes.found(engine.WorldState, {
      archetype: 'outlaw motorcycle gang', name: 'Test OMG', generateOrganization: engine.generateOrganization,
    }),
    /must be made with/,
  );
});

test('motorcycleOrganizations defaults to false -- every existing call to generateWorld() is byte-for-byte unaffected', () => {
  const withoutFlag = worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 12, seed: 'motorcycle-off' });
  assert.equal(withoutFlag.organizations > 0, true);
  const hasAny = engine.WorldState.organizations.some(
    (o) => o.archetype === 'outlaw motorcycle gang' || o.archetype === 'motorcycle club',
  );
  assert.equal(hasAny, false, 'no motorcycle organization exists unless the flag is explicitly turned on');
});

test('motorcycleOrganizations: true founds exactly one real outlaw motorcycle gang AND one real motorcycle club per city', () => {
  const before = {
    omg: engine.WorldState.organizations.filter((o) => o.archetype === 'outlaw motorcycle gang').length,
    club: engine.WorldState.organizations.filter((o) => o.archetype === 'motorcycle club').length,
    cities: engine.WorldState.cities.length,
  };
  const added = worldgen.generateWorld({
    communitiesPerCity: 2, populationPerCommunity: 12, seed: 'motorcycle-on', motorcycleOrganizations: true,
  });
  const newCities = engine.WorldState.cities.length - before.cities;
  const newOmg = engine.WorldState.organizations.filter((o) => o.archetype === 'outlaw motorcycle gang').length - before.omg;
  const newClub = engine.WorldState.organizations.filter((o) => o.archetype === 'motorcycle club').length - before.club;
  assert.ok(newCities > 0, 'this call must have founded at least one real city');
  assert.equal(newOmg, newCities, 'exactly one real outlaw motorcycle gang per newly founded city');
  assert.equal(newClub, newCities, 'exactly one real motorcycle club per newly founded city');
  assert.ok(added.organizations > 0);
});

test('motorcycleOrganizations: a founded city carries the real in-memory idempotence marker, the identical shape city.drugOrgFounded already holds', () => {
  const before = engine.WorldState.cities.length;
  worldgen.generateWorld({
    communitiesPerCity: 2, populationPerCommunity: 12, seed: 'motorcycle-marker', motorcycleOrganizations: true,
  });
  const newCities = engine.WorldState.cities.slice(before);
  assert.ok(newCities.length > 0);
  assert.ok(newCities.every((c) => c.motorcycleOrgsFounded === true));
});
