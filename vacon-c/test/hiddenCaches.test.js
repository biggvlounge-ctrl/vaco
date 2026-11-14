// server/hiddenCaches.js — secret compartments, buried caches, and
// stash houses. See that file's own header for the full design:
// landmark properties (especially historic/religious ones) and
// ordinary residential properties both get a real, bounded chance of
// a hidden cache at generation; opening one needs a real key, a real
// architect's own knowledge, or real word-of-mouth knowledge that
// already spread via `media.js`'s own real channel; a reveal produces
// a real mission, never an instant grab.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const hiddenCaches = require('../server/hiddenCaches.js');
const property = require('../server/property.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');
const worldStore = require('../server/worldStore.js');
const membership = require('../server/membership.js');

const w = engine.WorldState;

let nextId = 970001;

function person() {
  return engine.generateNPC();
}

function landmarkProperty(category) {
  return engine.generateProperty({
    type: 'commercial', value: 100000, landmarkCategory: category,
  });
}

function residentialProperty(age = 0) {
  return engine.generateProperty({ type: 'residential', value: 80000, age });
}

function organization(leaderId) {
  return engine.generateOrganization({ name: `Org ${nextId += 1}`, type: 'gang', leaderId });
}

function family(headId) {
  const id = nextId += 1;
  w.families.push({ id, surname: 'Stash', generation: 1, total_members: 1, head_npc_id: headId, updatedTick: w.tick });
  w.familyMemberships.push({ entity_id: headId, family_id: id, role: 'parent', generation_number: 1 });
  return w.families[w.families.length - 1];
}

// ---------------------------------------------------------------------
// generateHiddenCaches
// ---------------------------------------------------------------------

test('generateHiddenCaches: a historic/religious landmark is far more likely to get a cache than an ordinary new house', () => {
  let landmarkHits = 0;
  let residentialHits = 0;
  const trials = 60;
  for (let i = 0; i < trials; i += 1) {
    const historic = landmarkProperty('masonic-building');
    const home = residentialProperty(0);
    hiddenCaches.generateHiddenCaches(w, { tick: i, seed: `cache-rate-${i}` });
    if ((w.hiddenCaches || []).some((c) => c.propertyId === historic.id)) landmarkHits += 1;
    if ((w.hiddenCaches || []).some((c) => c.propertyId === home.id)) residentialHits += 1;
  }
  assert.ok(landmarkHits > residentialHits,
    `a historic landmark (${landmarkHits}/${trials}) must land a cache far more often than a brand-new house (${residentialHits}/${trials})`);
});

test('generateHiddenCaches is idempotent: a property that already has a cache never gets a second one', () => {
  const historic = landmarkProperty('historic-site');
  let created = [];
  for (let i = 0; i < 30 && created.length === 0; i += 1) {
    created = hiddenCaches.generateHiddenCaches(w, { tick: i, seed: `idempotent-${i}` })
      .filter((c) => c.propertyId === historic.id);
  }
  assert.equal(created.length, 1, 'the property must gain a cache at least once across 30 real tries');

  // Re-running many more times must never add a second cache to the
  // same, already-cached property.
  for (let i = 30; i < 60; i += 1) {
    hiddenCaches.generateHiddenCaches(w, { tick: i, seed: `idempotent-${i}` });
  }
  const atThisProperty = (w.hiddenCaches || []).filter((c) => c.propertyId === historic.id);
  assert.equal(atThisProperty.length, 1);
});

test('generateHiddenCaches: a real, unique key item is registered per cache, and given to the property\'s real current owner', () => {
  const home = residentialProperty(50);
  const owner = person();
  property.recordOwnership(w, { entityId: home.id, ownerEntityId: owner.id, ownerType: 'individual', tick: 0 });

  let cache = null;
  for (let i = 0; i < 60 && !cache; i += 1) {
    hiddenCaches.generateHiddenCaches(w, { tick: i, seed: `key-${i}` });
    cache = (w.hiddenCaches || []).find((c) => c.propertyId === home.id);
  }
  assert.ok(cache, 'an old residential property must land a cache within 60 real tries');
  assert.ok(w.barterItems.some((it) => it.name === cache.keyItemName));
  assert.ok(inventory.quantityOf(w, owner.id, cache.keyItemName) > 0, 'the real current owner really holds the real key');
});

test('generateHiddenCaches: a property with no real recorded owner leaves its key honestly unassigned', () => {
  const home = residentialProperty(60);
  let cache = null;
  for (let i = 0; i < 60 && !cache; i += 1) {
    hiddenCaches.generateHiddenCaches(w, { tick: i, seed: `unowned-${i}` });
    cache = (w.hiddenCaches || []).find((c) => c.propertyId === home.id);
  }
  assert.ok(cache, 'an old residential property must land a cache within 60 real tries');
  // Nobody in the world holds this specific key -- confirmed by it not
  // appearing in any real inventory row.
  assert.ok(!(w.inventory || []).some((h) => h.item_name === cache.keyItemName));
});

// ---------------------------------------------------------------------
// The three real gates
// ---------------------------------------------------------------------

test('isArchitect reads real, active employment as a real architect, nothing else', () => {
  const architect = person();
  economy.hireEntity(w, { entityId: architect.id, employerOrganizationId: organization(null).id, wage: 80, position: 'architect', tick: 0 });
  assert.equal(hiddenCaches.isArchitect(w, architect.id), true);

  const ordinary = person();
  assert.equal(hiddenCaches.isArchitect(w, ordinary.id), false);
});

test('hasKey: true only for THIS cache\'s own specific key, never another cache\'s', () => {
  const home = residentialProperty(0);
  const holder = person();
  const cache = { id: 999001, propertyId: home.id, category: 'residential', keyItemName: 'Test Key A' };
  w.barterItems.push({ name: 'Test Key A', category: 'tools', origin: 'remnant' });
  w.barterItems.push({ name: 'Test Key B', category: 'tools', origin: 'remnant' });
  inventory.give(w, { entityId: holder.id, itemName: 'Test Key B', quantity: 1, tick: 0 });

  assert.equal(hiddenCaches.hasKey(w, holder.id, cache), false, 'holding a DIFFERENT cache\'s key does not count');
  inventory.give(w, { entityId: holder.id, itemName: 'Test Key A', quantity: 1, tick: 0 });
  assert.equal(hiddenCaches.hasKey(w, holder.id, cache), true);
});

test('hasWordOfMouthKnowledge: true only after a real entity_knowledge row names this specific cache', () => {
  const listener = person();
  const cache = { id: 999002 };
  assert.equal(hiddenCaches.hasWordOfMouthKnowledge(w, listener.id, cache), false);
  worldStore.addKnowledge(w, {
    entityId: listener.id, factType: 'hidden_cache', factContent: String(cache.id),
    confidenceLevel: 80, sourceEntityId: null, tick: 0,
  });
  assert.equal(hiddenCaches.hasWordOfMouthKnowledge(w, listener.id, cache), true);
});

// ---------------------------------------------------------------------
// revealCache
// ---------------------------------------------------------------------

test('revealCache refuses an entity with no key, no architect\'s eye, and no word of mouth', () => {
  const home = residentialProperty(0);
  const stranger = person();
  w.hiddenCaches.push({
    id: 999003, propertyId: home.id, category: 'residential', keyItemName: 'No Access Key',
    revealed: false, claimed: false, foundBy: null, missionId: null,
  });
  assert.throws(
    () => hiddenCaches.revealCache(w, stranger.id, 999003, { tick: 0 }),
    /has no real key, is not a real architect/,
  );
});

test('revealCache: a real architect opens it with no key at all, producing a real artifact and a real mission', () => {
  const home = residentialProperty(0);
  const architect = person();
  economy.hireEntity(w, { entityId: architect.id, employerOrganizationId: organization(null).id, wage: 80, position: 'architect', tick: 0 });
  w.hiddenCaches.push({
    id: 999004, propertyId: home.id, category: 'residential', keyItemName: 'Architect Test Key',
    revealed: false, claimed: false, foundBy: null, missionId: null,
  });

  const result = hiddenCaches.revealCache(w, architect.id, 999004, { tick: 0 });
  assert.ok(result.artifactId);
  assert.ok(result.missionId);

  const artifact = (w.artifacts || []).find((a) => a.id === result.artifactId);
  assert.equal(artifact.location_id, home.id, 'the artifact really records the real property it came from');

  const mission = (w.missions || []).find((m) => m.id === result.missionId);
  assert.equal(mission.artifact_id, result.artifactId);

  const cache = w.hiddenCaches.find((c) => c.id === 999004);
  assert.equal(cache.revealed, true);
  assert.equal(cache.claimed, true);
  assert.equal(cache.foundBy, architect.id);
});

test('revealCache is a real one-time event per cache: a second attempt (even by someone with real access) returns null, not a second mission', () => {
  const home = residentialProperty(0);
  const architect = person();
  economy.hireEntity(w, { entityId: architect.id, employerOrganizationId: organization(null).id, wage: 80, position: 'architect', tick: 0 });
  w.hiddenCaches.push({
    id: 999005, propertyId: home.id, category: 'residential', keyItemName: 'One Time Key',
    revealed: false, claimed: false, foundBy: null, missionId: null,
  });

  const first = hiddenCaches.revealCache(w, architect.id, 999005, { tick: 0 });
  assert.ok(first);
  const missionsBefore = w.missions.length;

  const second = hiddenCaches.revealCache(w, architect.id, 999005, { tick: 1 });
  assert.equal(second, null);
  assert.equal(w.missions.length, missionsBefore, 'no second mission was ever created');
});

test('revealCache writes real, spreadable word-of-mouth knowledge for the finder', () => {
  const home = residentialProperty(0);
  const finder = person();
  const keyName = 'Spreadable Key';
  w.barterItems.push({ name: keyName, category: 'tools', origin: 'remnant' });
  inventory.give(w, { entityId: finder.id, itemName: keyName, quantity: 1, tick: 0 });
  w.hiddenCaches.push({
    id: 999006, propertyId: home.id, category: 'residential', keyItemName: keyName,
    revealed: false, claimed: false, foundBy: null, missionId: null,
  });

  hiddenCaches.revealCache(w, finder.id, 999006, { tick: 0 });
  const knowledgeRow = w.entityKnowledge.find(
    (k) => k.entity_id === finder.id && k.fact_type === 'hidden_cache' && k.fact_content === '999006',
  );
  assert.ok(knowledgeRow);
  assert.ok(Number(knowledgeRow.spread_rate) > 0, 'the fact must carry a real, positive spread_rate to ever propagate');
});

// ---------------------------------------------------------------------
// designateStashHouse / stashHouseOf
// ---------------------------------------------------------------------

test('designateStashHouse: real validation, and refuses a property whose real owner is not the sponsor\'s own people', () => {
  const leader = person();
  const org = organization(leader.id);
  const stranger = person();
  const strangerProperty = residentialProperty(0);
  property.recordOwnership(w, { entityId: strangerProperty.id, ownerEntityId: stranger.id, ownerType: 'individual', tick: 0 });

  assert.throws(
    () => hiddenCaches.designateStashHouse(w, leader.id, { propertyId: 999999, organizationId: org.id }),
    /no property with id/,
  );
  assert.throws(
    () => hiddenCaches.designateStashHouse(w, leader.id, { propertyId: strangerProperty.id }),
    /requires exactly one of organizationId or familyId/,
  );

  const unownedProperty = residentialProperty(0);
  assert.throws(
    () => hiddenCaches.designateStashHouse(w, leader.id, { propertyId: unownedProperty.id, organizationId: org.id }),
    /no real recorded owner/,
  );

  assert.throws(
    () => hiddenCaches.designateStashHouse(w, leader.id, { propertyId: strangerProperty.id, organizationId: org.id }),
    /is not the sponsor or a real member/,
  );
});

test('designateStashHouse succeeds for the sponsor\'s own property, and for a real member\'s property', () => {
  const leader = person();
  const org = organization(leader.id);
  const leaderProperty = residentialProperty(0);
  property.recordOwnership(w, { entityId: leaderProperty.id, ownerEntityId: leader.id, ownerType: 'individual', tick: 0 });

  const designation = hiddenCaches.designateStashHouse(w, leader.id, { propertyId: leaderProperty.id, organizationId: org.id });
  assert.equal(designation.organizationId, org.id);
  assert.equal(hiddenCaches.stashHouseOf(w, leaderProperty.id).organizationId, org.id);

  const memberNpc = person();
  membership.joinOrganization(w, { entityId: memberNpc.id, organizationId: org.id });
  const memberProperty = residentialProperty(0);
  property.recordOwnership(w, { entityId: memberProperty.id, ownerEntityId: memberNpc.id, ownerType: 'individual', tick: 0 });

  const memberDesignation = hiddenCaches.designateStashHouse(w, leader.id, { propertyId: memberProperty.id, organizationId: org.id });
  assert.equal(memberDesignation.custodianEntityId, memberNpc.id);
});

test('designateStashHouse (family path) works the identical way a family head can', () => {
  const head = person();
  const fam = family(head.id);
  const headProperty = residentialProperty(0);
  property.recordOwnership(w, { entityId: headProperty.id, ownerEntityId: head.id, ownerType: 'individual', tick: 0 });

  const designation = hiddenCaches.designateStashHouse(w, head.id, { propertyId: headProperty.id, familyId: fam.id });
  assert.equal(designation.familyId, fam.id);

  const impostor = person();
  assert.throws(
    () => hiddenCaches.designateStashHouse(w, impostor.id, { propertyId: headProperty.id, familyId: fam.id }),
    /does not head family/,
  );
});

test('stashHouseOf: null for a property nobody has designated', () => {
  const plain = residentialProperty(0);
  assert.equal(hiddenCaches.stashHouseOf(w, plain.id), null);
});
