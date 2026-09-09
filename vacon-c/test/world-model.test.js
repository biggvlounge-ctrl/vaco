// VACANCY — families, territory, and the write-back stores.
//
// The parts of the world model a player inherits, lives in, and
// remembers. These run against the engine singleton where the function
// is bound to it (families) and against a private world where the
// module takes one explicitly (territory, worldStore).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const territory = require('../server/territory.js');
const worldStore = require('../server/worldStore.js');

function freshWorld() {
  return {
    tick: 0, npcs: [], organizations: [], families: [], familyMemberships: [],
    resources: [], marketListings: [], individualFinances: [], entityTraits: [],
    memories: [], relationships: [], entityKnowledge: [],
    cities: [], communities: [], territoryBlocks: [],
  };
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

test('a family must have a surname', () => {
  assert.throws(() => engine.generateFamily({}), /surname/);
});

test('members join a family and the family knows them', () => {
  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: 'Okonkwo' });

  engine.addFamilyMember(family.id, npc.id, 'head', 1);

  const memberships = engine.WorldState.familyMemberships
    .filter((m) => m.family_id === family.id);
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0].entity_id, npc.id);
  assert.equal(memberships[0].role, 'head');
});

test('adding a member to a family that does not exist is refused', () => {
  const npc = engine.generateNPC();
  assert.throws(() => engine.addFamilyMember(999999, npc.id, 'head', 1), /no family/);
});

test('family wealth is computed from members, never stored', () => {
  // Standing rule 3: never duplicate a computable rollup. Family wealth
  // is a sum over members' finances, so it must change when a member's
  // money changes -- without anybody writing to the family.
  const a = engine.generateNPC();
  const b = engine.generateNPC();
  const family = engine.generateFamily({ surname: 'Reyes' });
  engine.addFamilyMember(family.id, a.id, 'head', 1);

  engine.generateIndividualFinances(a.id, { savings: 300 });
  const withOne = engine.getFamilyWealth(family.id);

  engine.addFamilyMember(family.id, b.id, 'child', 2);
  engine.generateIndividualFinances(b.id, { savings: 200 });
  const withTwo = engine.getFamilyWealth(family.id);

  assert.ok(Number.isFinite(withOne) && Number.isFinite(withTwo));
  assert.ok(withTwo > withOne,
    `wealth must follow the members (one: ${withOne}, two: ${withTwo})`);
  assert.equal(family.wealth, undefined,
    'a computed rollup must not also be stored on the row -- standing rule 3');
});

test('an empty family is worth zero, not NaN', () => {
  const family = engine.generateFamily({ surname: 'Nobody' });
  assert.equal(engine.getFamilyWealth(family.id), 0);
});

// ---------------------------------------------------------------------------
// Territory
// ---------------------------------------------------------------------------

test('a city must be named', () => {
  assert.throws(() => territory.generateCity(freshWorld(), {}), /name/);
});

test('a territory block must belong to a real faction, not any organization', () => {
  // territory_blocks.faction_id references factions specifically. An
  // ordinary organization holding territory would be a category error
  // the schema does not permit.
  const w = freshWorld();
  assert.throws(() => territory.generateTerritoryBlock(w, {}), /factionId/);

  w.organizations.push({ id: 42, name: 'A Bakery', isFaction: false });
  assert.throws(
    () => territory.generateTerritoryBlock(w, { factionId: 42 }),
    /not an existing faction/,
  );
});

test('communities default to the block tier', () => {
  const w = freshWorld();
  const c = territory.generateCommunity(w, { population: 250 });

  assert.equal(c.tier, 'block', 'block-tier is the locked Phase 1 scope');
  assert.equal(w.communities.length, 1, 'the community must be in the world, not just returned');
});

test('control resolution survives a faction that no longer exists', () => {
  // A faction can be destroyed mid-simulation. The tick must not die
  // with it -- a crash here would take down the whole world, not one
  // block.
  const w = freshWorld();
  const orphan = { id: 7, faction_id: 999999, control_level: 50 };

  assert.doesNotThrow(() => territory.resolveTerritoryControl(w, orphan, 1));
  assert.equal(orphan.control_level, 50, 'an orphaned block is left as it was');
});

// ---------------------------------------------------------------------------
// The write-back stores
// ---------------------------------------------------------------------------

test('memories record who, when, and what happened', () => {
  const w = freshWorld();
  worldStore.addMemory(w, {
    entityId: 1, memoryType: 'negative', category: 'failure',
    description: 'The well ran dry.', importance: 80, emotionLevel: 70, tick: 12,
  });

  const [m] = w.memories;
  assert.equal(m.entity_id, 1);
  assert.equal(m.tick, 12);
  assert.equal(m.description, 'The well ran dry.');
  assert.ok(m.id, 'every memory needs an id to be referenced later');
});

test('a relationship between two entities is found in either direction', () => {
  // Relationships are undirected in storage. If A->B and B->A produced
  // two rows, trust would silently fork into two disagreeing values.
  const w = freshWorld();
  const created = worldStore.getOrCreateRelationship(w, 1, 2, 'neighbour');
  const foundForward = worldStore.findRelationship(w, 1, 2);
  const foundBackward = worldStore.findRelationship(w, 2, 1);

  assert.equal(w.relationships.length, 1, 'one relationship, not two');
  assert.equal(foundForward.id, created.id);
  assert.equal(foundBackward.id, created.id,
    'the same relationship must be found from either side');
});

test('getOrCreateRelationship is idempotent', () => {
  const w = freshWorld();
  worldStore.getOrCreateRelationship(w, 1, 2, 'neighbour');
  worldStore.getOrCreateRelationship(w, 1, 2, 'neighbour');
  worldStore.getOrCreateRelationship(w, 2, 1, 'neighbour');

  assert.equal(w.relationships.length, 1,
    'asking twice must not create a second relationship');
});

test('knowledge is subjective: it carries confidence and when it was learned', () => {
  const w = freshWorld();
  worldStore.addKnowledge(w, {
    entityId: 1, factType: 'rumour', factContent: 'the river is poisoned',
    confidenceLevel: 0.3, tick: 5,
  });

  const [k] = w.entityKnowledge;
  assert.equal(k.confidence_level, 0.3, 'a rumour is not a certainty');
  assert.equal(k.acquired_tick, 5, 'when it was learned is part of what it is');
  assert.equal(k.fact_type, 'rumour');
});

test('two entities can hold the same fact with different confidence', () => {
  // The whole point of subjective knowledge: the world has one truth
  // and the people in it have their own versions of it.
  const w = freshWorld();
  worldStore.addKnowledge(w, {
    entityId: 1, factType: 'verified', factContent: 'water scarcity',
    confidenceLevel: 0.95, tick: 1,
  });
  worldStore.addKnowledge(w, {
    entityId: 2, factType: 'rumour', factContent: 'water scarcity',
    confidenceLevel: 0.2, tick: 1,
  });

  const [certain, doubtful] = w.entityKnowledge;
  assert.equal(certain.fact_content, doubtful.fact_content, 'same fact');
  assert.notEqual(certain.confidence_level, doubtful.confidence_level, 'different beliefs');
});
