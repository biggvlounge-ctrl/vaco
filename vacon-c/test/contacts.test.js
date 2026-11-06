// server/contacts.js — friends, classmates, associates and family,
// searched for before ever being generated. See its own header for the
// worked example (a cousin outside the player's home city standing in
// for a real distribution contact) and the real vocabulary reused
// rather than invented (`friend|business|educational|neighbor|student`,
// VACANCY_POSTGRESQL_SCHEMA.sql's own enum comment).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const contacts = require('../server/contacts.js');
const worldStore = require('../server/worldStore.js');

// Two real communities in two real, different cities — same convention
// test/characterCreation.test.js already uses against engine.js's own
// singleton, needed here for the same reason: "outside home city" has
// to have a real second city to mean anything.
const cityA = engine.WorldState.cities.push({ id: 910001, name: 'Contactville' }) && engine.WorldState.cities[engine.WorldState.cities.length - 1];
const cityB = engine.WorldState.cities.push({ id: 910002, name: 'Faraway' }) && engine.WorldState.cities[engine.WorldState.cities.length - 1];
const communityA = engine.generateCommunity({ cityId: cityA.id, name: 'Home Block' });
const communityB = engine.generateCommunity({ cityId: cityB.id, name: 'Out-of-Town Block' });

function person(communityId = communityA.id) {
  const npc = engine.generateNPC({ communityId });
  engine.generateIndividualFinances(npc.id, { savings: 100 });
  return npc;
}

// -- vocabulary -------------------------------------------------------

test('findOrCreateContact refuses an invented relationship type rather than a real one', () => {
  const me = person();
  assert.throws(
    () => engine.findOrCreateContact(me.id, { relationshipTypes: ['classmate'] }),
    /not a real contact relationship type/,
  );
});

// -- real search first --------------------------------------------------

test('a real existing friend is found before anything is generated', () => {
  const me = person();
  const buddy = person();
  worldStore.adjustRelationship(engine.WorldState, me.id, buddy.id, 'friend', { trust: 10 });

  const result = engine.findOrCreateContact(me.id, {});
  assert.equal(result.generated, false);
  assert.equal(result.contactId, buddy.id);
  assert.equal(result.relationshipType, 'friend');
});

test('the highest-trust real candidate is preferred over a weaker one, the same shape meetings.js#deepestTrade already picks a best candidate by', () => {
  const me = person();
  const weak = person();
  const strong = person();
  worldStore.adjustRelationship(engine.WorldState, me.id, weak.id, 'business', { trust: -40 });
  worldStore.adjustRelationship(engine.WorldState, me.id, strong.id, 'business', { trust: 40 });

  const result = engine.findOrCreateContact(me.id, {});
  assert.equal(result.contactId, strong.id);
});

test('only the real, requested relationship types count as candidates', () => {
  const me = person();
  const enemy = person();
  worldStore.adjustRelationship(engine.WorldState, me.id, enemy.id, 'enemy', { trust: 90 });

  // Nobody qualifies -- an enemy is not a friend/classmate/associate --
  // so this must generate rather than silently returning the enemy.
  const result = engine.findOrCreateContact(me.id, {});
  assert.equal(result.generated, true);
  assert.notEqual(result.contactId, enemy.id);
});

// -- the worked example: real extended family counts too ----------------

test('a real existing cousin outside the home city is found before a new contact is generated -- the exact worked example', () => {
  const me = person(communityA.id);
  const created = engine.createCharacter({ name: 'Cousin Haver' });
  // Force this specific run's player into the SAME home community as
  // `me`, and move a real generated cousin to the OTHER real city --
  // asserting the mechanism, not hoping a random draw already agrees.
  const meNpc = engine.WorldState.npcs.find((n) => n.id === me.id);
  meNpc.communityId = communityA.id;

  const tree = engine.getFamilyTree(created.player.id);
  const player = engine.WorldState.npcs.find((n) => n.id === created.player.id);
  player.communityId = communityA.id;

  // Re-point whichever real family link already exists between `me`
  // and the created character onto a real cousin, if createCharacter's
  // own random draw produced one; otherwise seed the real family link
  // directly, same `relationship_type: 'family'` cousinsThroughParent
  // itself reads.
  let cousinId = tree.cousins[0]?.children?.[0]?.id ?? null;
  if (cousinId === null) {
    const cousin = engine.generateNPC({ communityId: communityB.id });
    const parentId = tree.parents[0]?.entityId;
    if (parentId) {
      const auntUncleFamily = engine.generateFamily({ surname: 'Faraway', headNpcId: cousin.id });
      engine.addFamilyMember(auntUncleFamily.id, cousin.id, 'parent', 0);
      worldStore.adjustRelationship(engine.WorldState, parentId, cousin.id, 'family', {});
      cousinId = cousin.id;
    }
  } else {
    const cousinNpc = engine.WorldState.npcs.find((n) => n.id === cousinId);
    if (cousinNpc) cousinNpc.communityId = communityB.id;
  }

  assert.ok(cousinId, 'this test needs a real cousin to exist to make its point');

  const result = engine.findOrCreateContact(created.player.id, { outsideHomeCity: true });
  assert.equal(result.generated, false, 'a real cousin outside the home city must be found, not generated past');
  assert.equal(result.contactId, cousinId);
  assert.equal(result.relationshipType, 'family');
});

// -- generation, only once nothing qualifies ----------------------------

test('a brand-new contact is really generated when nobody qualifies, placed in a real different city', () => {
  const me = person(communityA.id);
  const result = engine.findOrCreateContact(me.id, { outsideHomeCity: true });

  assert.equal(result.generated, true);
  const contactNpc = engine.WorldState.npcs.find((n) => n.id === result.contactId);
  assert.ok(contactNpc, 'a real NPC must exist for the generated contact');
  const contactCommunity = engine.WorldState.communities.find((c) => c.id === contactNpc.communityId);
  assert.equal(contactCommunity.city_id, communityB.city_id, 'placed in the real other city, not the home one');

  const rel = worldStore.findRelationship(engine.WorldState, me.id, result.contactId);
  assert.ok(rel, 'a real relationship row must back the generated contact');
  assert.equal(rel.relationship_type, result.relationshipType);
});

test('generation without options.generators is refused rather than silently producing nothing', () => {
  const me = person(communityA.id);
  const freshWorld = {
    tick: 0, npcs: engine.WorldState.npcs.filter((n) => n.id === me.id),
    organizations: [], families: [], familyMemberships: [], relationships: [],
    communities: engine.WorldState.communities, cities: engine.WorldState.cities,
    individualFinances: [],
  };
  assert.throws(
    () => contacts.findOrCreateContact(freshWorld, me.id, {}),
    /requires options\.generators/,
  );
});

test('requesting an outside contact in a world with only one real city is refused, not silently given a home-city contact', () => {
  const soloWorld = {
    tick: 0,
    npcs: [{ id: 1, status: 'active', communityId: 1 }],
    organizations: [], families: [], familyMemberships: [], relationships: [],
    communities: [{ id: 1, city_id: 1 }], cities: [{ id: 1 }],
    individualFinances: [],
  };
  assert.throws(
    () => contacts.findOrCreateContact(soloWorld, 1, {
      outsideHomeCity: true,
      generators: {
        generateNpc: () => { throw new Error('should never reach generation in a world with no other city'); },
      },
    }),
    /no other real city/,
  );
});
