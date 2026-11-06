// server/events.js — a real geographic anchor on the tick-level
// `events` log, so a player can see what happened nearby, not just
// what named them directly. See its own header for the real substrate
// (`npcs.communityId`, `properties.community_id`, `communities.cityId`,
// `territoryBlocks[].community_id`) and the honest absence when none
// of them resolve.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const events = require('../server/events.js');
const tick = require('../server/tick.js');

let nextId = 700000;

function world() {
  return {
    tick: 0,
    npcs: [],
    organizations: [],
    properties: [],
    communities: [],
    territoryBlocks: [],
    events: [],
  };
}

function community(w, { cityId = 1 } = {}) {
  // `city_id`, snake_case — the real field `territory.generateCommunity`
  // stores, caught live-verifying against a real generated world after
  // this fixture's own first version used the wrong one and could not
  // have caught it, since both sides agreed on the same mistake.
  const c = { id: nextId++, city_id: cityId };
  w.communities.push(c);
  return c;
}

function person(w, { communityId = null } = {}) {
  const npc = { id: nextId++, status: 'active', communityId };
  w.npcs.push(npc);
  return npc;
}

function org(w) {
  const o = { id: nextId++, name: 'Org', type: 'business' };
  w.organizations.push(o);
  return o;
}

// -- locationOfEvent / communityIdForEntity -------------------------------

test('locationOfEvent resolves through the first affected entity with a real communityId', () => {
  const w = world();
  const c = community(w, { cityId: 1 });
  const p = person(w, { communityId: c.id });
  const loc = events.locationOfEvent(w, { affected_entity_ids: [p.id] });
  assert.deepEqual(loc, { communityId: c.id, cityId: 1 });
});

test('locationOfEvent falls through a homeless/no-community entity to the next real one', () => {
  const w = world();
  const c = community(w, { cityId: 2 });
  const homeless = person(w, { communityId: null });
  const housed = person(w, { communityId: c.id });
  const loc = events.locationOfEvent(w, { affected_entity_ids: [homeless.id, housed.id] });
  assert.deepEqual(loc, { communityId: c.id, cityId: 2 });
});

test('locationOfEvent resolves an ORGANIZATION through a property it actually operates', () => {
  const w = world();
  const c = community(w, { cityId: 3 });
  const o = org(w);
  w.properties.push({ id: 1, operating_organization_id: o.id, community_id: c.id });
  const loc = events.locationOfEvent(w, { affected_entity_ids: [o.id] });
  assert.deepEqual(loc, { communityId: c.id, cityId: 3 });
});

test('locationOfEvent is honest null/null when nothing resolves -- never a guessed location', () => {
  const w = world();
  const homeless = person(w, { communityId: null });
  const loc = events.locationOfEvent(w, { affected_entity_ids: [homeless.id] });
  assert.deepEqual(loc, { communityId: null, cityId: null });

  const loc2 = events.locationOfEvent(w, { affected_entity_ids: [] });
  assert.deepEqual(loc2, { communityId: null, cityId: null });
});

test('locationOfEvent prefers an explicit territoryBlockId hint over reaching through the faction entity', () => {
  const w = world();
  const factionCommunity = community(w, { cityId: 4 });
  const blockCommunity = community(w, { cityId: 9 });
  const faction = org(w);
  w.properties.push({ id: 2, operating_organization_id: faction.id, community_id: factionCommunity.id });
  w.territoryBlocks.push({ id: 55, faction_id: faction.id, community_id: blockCommunity.id });

  const loc = events.locationOfEvent(w, {
    affected_entity_ids: [faction.id],
    global_effects: { territoryBlockId: 55 },
  });
  assert.deepEqual(loc, { communityId: blockCommunity.id, cityId: 9 },
    'the block\'s own real community is more direct than the faction\'s operated property');
});

// -- eventsNear -------------------------------------------------------------

function seedEvent(w, overrides = {}) {
  const e = {
    id: nextId++, type: 'crime', severity: 'high', note: null, tick: 0,
    affected_entity_ids: [], global_effects: {}, community_id: null, city_id: null,
    ...overrides,
  };
  w.events.push(e);
  return e;
}

test('eventsNear (scope: city) surfaces an event in the same city, even naming nobody the viewer knows', () => {
  const w = world();
  const c1 = community(w, { cityId: 1 });
  const viewer = person(w, { communityId: c1.id });
  const strangerCommunity = community(w, { cityId: 1 });
  seedEvent(w, { community_id: strangerCommunity.id, city_id: 1 });

  const near = events.eventsNear(w, viewer.id, { scope: 'city' });
  assert.equal(near.length, 1);
});

test('eventsNear (scope: city) excludes an event in a different city', () => {
  const w = world();
  const c1 = community(w, { cityId: 1 });
  const viewer = person(w, { communityId: c1.id });
  const otherCityCommunity = community(w, { cityId: 2 });
  seedEvent(w, { community_id: otherCityCommunity.id, city_id: 2 });

  assert.equal(events.eventsNear(w, viewer.id, { scope: 'city' }).length, 0);
});

test('eventsNear (scope: community) excludes an event in a different community of the SAME city', () => {
  const w = world();
  const c1 = community(w, { cityId: 1 });
  const c2 = community(w, { cityId: 1 });
  const viewer = person(w, { communityId: c1.id });
  seedEvent(w, { community_id: c2.id, city_id: 1 });

  assert.equal(events.eventsNear(w, viewer.id, { scope: 'community' }).length, 0,
    'city-scoped and community-scoped must be genuinely different filters, not the same check twice');
});

test('eventsNear always includes an event that names the viewer directly, regardless of location or scope', () => {
  const w = world();
  const viewer = person(w, { communityId: null }); // homeless -- no resolvable area at all
  seedEvent(w, { affected_entity_ids: [viewer.id], community_id: null, city_id: null });

  const near = events.eventsNear(w, viewer.id, { scope: 'city' });
  assert.equal(near.length, 1);
});

test('eventsNear returns nothing for a homeless viewer beyond events naming them directly', () => {
  const w = world();
  const viewer = person(w, { communityId: null });
  const elsewhere = community(w, { cityId: 1 });
  seedEvent(w, { community_id: elsewhere.id, city_id: 1 }); // not naming the viewer

  assert.equal(events.eventsNear(w, viewer.id, { scope: 'city' }).length, 0,
    'no resolvable area means no guessed inclusion -- the honest null, not a fallback to "everything"');
});

test('eventsNear respects sinceTick', () => {
  const w = world();
  const c = community(w, { cityId: 1 });
  const viewer = person(w, { communityId: c.id });
  seedEvent(w, { community_id: c.id, city_id: 1, tick: 5 });
  seedEvent(w, { community_id: c.id, city_id: 1, tick: 50 });

  const near = events.eventsNear(w, viewer.id, { scope: 'city', sinceTick: 10 });
  assert.equal(near.length, 1);
  assert.equal(near[0].tick, 50);
});

test('eventsNear throws on an unknown scope rather than silently matching everything or nothing', () => {
  const w = world();
  const viewer = person(w);
  assert.throws(() => events.eventsNear(w, viewer.id, { scope: 'planet' }));
});

// -- eventsIn ----------------------------------------------------------------

test('eventsIn filters by an explicit communityId with no entity involved', () => {
  const w = world();
  const c = community(w, { cityId: 1 });
  const other = community(w, { cityId: 1 });
  seedEvent(w, { community_id: c.id, city_id: 1 });
  seedEvent(w, { community_id: other.id, city_id: 1 });

  assert.equal(events.eventsIn(w, { communityId: c.id }).length, 1);
});

test('eventsIn filters by an explicit cityId with no entity involved', () => {
  const w = world();
  const c1 = community(w, { cityId: 1 });
  const c2 = community(w, { cityId: 2 });
  seedEvent(w, { community_id: c1.id, city_id: 1 });
  seedEvent(w, { community_id: c2.id, city_id: 2 });

  assert.equal(events.eventsIn(w, { cityId: 1 }).length, 1);
});

test('eventsIn requires at least one of communityId/cityId', () => {
  const w = world();
  assert.throws(() => events.eventsIn(w, {}));
});

// -- integration: runEventPhase (tick.recordEvents) actually stores it -----

test('tick.recordEvents stamps a real community_id/city_id on every stored event, derived at storage time', () => {
  const w = world();
  const c = community(w, { cityId: 7 });
  const p = person(w, { communityId: c.id });

  const stored = tick.recordEvents(w, [
    { type: 'crime', severity: 'high', tick: 0, affected_entity_ids: [p.id], global_effects: {} },
  ]);

  assert.equal(stored.length, 1);
  assert.equal(stored[0].community_id, c.id);
  assert.equal(stored[0].city_id, 7);
  assert.equal(w.events[w.events.length - 1].community_id, c.id,
    'the stamped location must be on the actual stored row, not just the return value');
});

test('tick.recordEvents stamps honest nulls for an event with no resolvable location, never a guess', () => {
  const w = world();
  const stored = tick.recordEvents(w, [
    { type: 'weather', severity: 'low', tick: 0, affected_entity_ids: [], global_effects: {} },
  ]);
  assert.equal(stored[0].community_id, null);
  assert.equal(stored[0].city_id, null);
});

test('tick.recordEvents resolves location from the entity\'s community AT THAT MOMENT -- a later move does not rewrite history', () => {
  const w = world();
  const c1 = community(w, { cityId: 1 });
  const c2 = community(w, { cityId: 2 });
  const p = person(w, { communityId: c1.id });

  const stored = tick.recordEvents(w, [
    { type: 'crime', severity: 'high', tick: 0, affected_entity_ids: [p.id], global_effects: {} },
  ]);

  p.communityId = c2.id; // the entity moves after the event happened

  assert.equal(stored[0].community_id, c1.id,
    'the event must keep describing where it actually occurred, not wherever the entity is now');
});
