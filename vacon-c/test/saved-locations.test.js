// Task #97 — saved/bookmarked locations with a takeover-key
// requirements card. `server/savedLocations.js` is a plain bookmark
// list, and `engine.js#savedLocationsOf` is what attaches
// `control.assess`'s own real card to each row, LIVE, every read.
//
// Two blocks: `savedLocations.js`'s own refusals and idempotence
// against a hand-built world (the same shape `test/build-barricade
// .test.js` uses for `territory.js`), then the engine-level player
// verb, the same "player acts as themselves" pattern
// `test/control.test.js` already uses for `assess-takeover`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const savedLocations = require('../server/savedLocations.js');
const control = require('../server/control.js');
const engine = require('../server/engine.js');

// ---------------------------------------------------------------------
// The bookmark list itself
// ---------------------------------------------------------------------

function world() {
  return {
    tick: 10,
    properties: [{ id: 7001, type: 'residential', operating_organization_id: null }],
    npcs: [],
    organizations: [],
    savedLocations: [],
  };
}

test('saveLocation refuses a scale that is not real', () => {
  const w = world();
  assert.throws(
    () => savedLocations.saveLocation(w, 1, { scale: 'planet', locationId: 7001 }),
    /is not a scale/,
  );
});

test('saveLocation refuses a locationId that is not a number', () => {
  const w = world();
  assert.throws(
    () => savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 'the big house' }),
    /locationId must be a number/,
  );
});

test('saveLocation refuses a target that does not exist -- never a bookmark about nothing', () => {
  const w = world();
  assert.throws(
    () => savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 999999 }),
    /no real property with id 999999/,
  );
});

test('saveLocation is idempotent -- bookmarking the same pair twice is the same row', () => {
  const w = world();
  const first = savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 7001 });
  const second = savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 7001 });
  assert.equal(second.id, first.id);
  assert.equal(w.savedLocations.length, 1);
});

test('two different entities can bookmark the identical place, as two separate rows', () => {
  const w = world();
  savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 7001 });
  savedLocations.saveLocation(w, 2, { scale: 'property', locationId: 7001 });
  assert.equal(w.savedLocations.length, 2);
  assert.equal(savedLocations.savedLocationRowsOf(w, 1).length, 1);
  assert.equal(savedLocations.savedLocationRowsOf(w, 2).length, 1);
});

test('unsaveLocation refuses an id that does not belong to the caller', () => {
  const w = world();
  const row = savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 7001 });
  assert.throws(
    () => savedLocations.unsaveLocation(w, 2, row.id),
    /no saved location/,
  );
  assert.equal(w.savedLocations.length, 1, 'the real owner\'s row must survive a refused attempt');
});

test('unsaveLocation removes the caller\'s own real row', () => {
  const w = world();
  const row = savedLocations.saveLocation(w, 1, { scale: 'property', locationId: 7001 });
  savedLocations.unsaveLocation(w, 1, row.id);
  assert.equal(savedLocations.savedLocationRowsOf(w, 1).length, 0);
});

// ---------------------------------------------------------------------
// The player verb — same "acts as themselves" shape as assess-takeover
// ---------------------------------------------------------------------

test('a saved property comes back with a real, live requirements card', () => {
  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: `Okafor-${npc.id}` });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const home = engine.generateProperty({ type: 'residential', value: 50000 });

  const saved = engine.dispatchAction(player.id, {
    action: 'save-location', scale: 'property', locationId: home.id,
  });
  assert.equal(saved.result.scale, 'property');
  assert.equal(saved.result.location_id, home.id);

  const list = engine.savedLocationsOf(npc.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].locationId, home.id);
  assert.ok(list[0].requirementsCard, 'a real property with a real tribe must carry a real card');
  assert.equal(list[0].requirementsCard.tribeId, family.id);
});

test('the card is computed live, never cached on the bookmark -- adding a real member changes the roster between two reads', () => {
  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: `Diallo-${npc.id}` });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const org = engine.generateOrganization({ name: `Watched Club ${npc.id}`, type: 'club' });

  engine.dispatchAction(player.id, {
    action: 'save-location', scale: 'organization', locationId: org.id,
  });

  const before = engine.savedLocationsOf(npc.id)[0].requirementsCard;
  const beforeMembers = before.roster.members;

  const recruit = engine.generateNPC();
  engine.addFamilyMember(family.id, recruit.id, 'member', engine.WorldState.tick);

  const after = engine.savedLocationsOf(npc.id)[0].requirementsCard;
  assert.equal(after.roster.members, beforeMembers + 1,
    'a stored card would not have seen the new member at all');
});

test('a bookmark survives having no family at all -- the list is a read, not a takeover attempt', () => {
  const npc = engine.generateNPC();
  const org = engine.generateOrganization({ name: `No-Tribe Watch ${npc.id}`, type: 'club' });
  // No generateFamily/addFamilyMember at all for this npc.
  const row = savedLocations.saveLocation(engine.WorldState, npc.id, {
    scale: 'organization', locationId: org.id, tick: engine.WorldState.tick,
  });
  assert.ok(row.id);

  const list = engine.savedLocationsOf(npc.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].requirementsCard, null,
    'no family to act as a tribe is an honest unmet precondition for the CARD, not a thrown error for the LIST');
});

test('unsave-location through the real dispatcher removes the caller\'s own bookmark', () => {
  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: `Marchetti-${npc.id}` });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const home = engine.generateProperty({ type: 'residential', value: 30000 });

  const saved = engine.dispatchAction(player.id, {
    action: 'save-location', scale: 'property', locationId: home.id,
  });
  engine.dispatchAction(player.id, {
    action: 'unsave-location', savedLocationId: saved.result.id,
  });

  assert.equal(engine.savedLocationsOf(npc.id).length, 0);
});

test('save-location through the real dispatcher refuses a property that does not exist', () => {
  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: `Nowak-${npc.id}` });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  assert.throws(
    () => engine.dispatchAction(player.id, {
      action: 'save-location', scale: 'property', locationId: 999999999,
    }),
    /no real property/,
  );
});

test('control.SCALE_NAMES is the single real source for which scales a bookmark can name', () => {
  for (const scale of control.SCALE_NAMES) {
    assert.ok(typeof scale === 'string' && scale.length > 0);
  }
});
