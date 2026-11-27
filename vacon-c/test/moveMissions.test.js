// server/moveMissions.js — event-triggered mission generation, task
// #98. See that file's own header for the full design and what three
// real event types were curated (and why `takeover_unlocked`/
// `chaos_recruitment` were deliberately excluded).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const moveMissions = require('../server/moveMissions.js');
const engine = require('../server/engine.js');

function world() {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    properties: [],
    missions: [],
    artifacts: [],
  };
}

function org(w, { id, isFaction = false, name = `Org ${id}` }) {
  const o = { id, name, isFaction, type: isFaction ? 'gang' : 'business' };
  w.organizations.push(o);
  return o;
}

function property(w, { id, communityId, name = `Property ${id}` }) {
  const p = { id, community_id: communityId, name };
  w.properties.push(p);
  return p;
}

function event({
  id, type, communityId, affectedEntityIds,
}) {
  return { id, type, community_id: communityId, affected_entity_ids: affectedEntityIds };
}

// ---------------------------------------------------------------------
// organizationIdFor / propertyIn
// ---------------------------------------------------------------------

test('organizationIdFor reads the real first affected entity id', () => {
  assert.equal(moveMissions.organizationIdFor({ affected_entity_ids: [50, 7] }), 50);
});

test('organizationIdFor returns a real null, never a fabricated id, for an event naming nobody', () => {
  assert.equal(moveMissions.organizationIdFor({ affected_entity_ids: [] }), null);
  assert.equal(moveMissions.organizationIdFor({}), null);
});

test('propertyIn returns a real null when the community has no real properties', () => {
  const w = world();
  assert.equal(moveMissions.propertyIn(w, 1, ['seed']), null);
});

test('propertyIn picks a real property that is actually IN the named community', () => {
  const w = world();
  property(w, { id: 10, communityId: 1 });
  property(w, { id: 11, communityId: 2 });
  const picked = moveMissions.propertyIn(w, 2, ['seed']);
  assert.equal(picked.id, 11);
});

// ---------------------------------------------------------------------
// runMoveMissions
// ---------------------------------------------------------------------

test('runMoveMissions ignores an event type that is not a real curated "move"', () => {
  const w = world();
  org(w, { id: 1, isFaction: true });
  property(w, { id: 10, communityId: 1 });
  const generated = moveMissions.runMoveMissions(w, [
    event({ id: 900, type: 'crime', communityId: 1, affectedEntityIds: [1] }),
  ]);
  assert.deepEqual(generated, []);
});

test('runMoveMissions ignores a real event with no real community resolved', () => {
  const w = world();
  org(w, { id: 1, isFaction: true });
  const generated = moveMissions.runMoveMissions(w, [
    event({ id: 901, type: 'dominant_power_claims_ground', communityId: null, affectedEntityIds: [1] }),
  ]);
  assert.deepEqual(generated, []);
});

test('runMoveMissions ignores an event whose named organization is not real', () => {
  const w = world();
  property(w, { id: 10, communityId: 1 });
  const generated = moveMissions.runMoveMissions(w, [
    event({ id: 902, type: 'dominant_power_claims_ground', communityId: 1, affectedEntityIds: [999] }),
  ]);
  assert.deepEqual(generated, []);
});

test('runMoveMissions skips a community already carrying a real open mission at its picked property', () => {
  const w = world();
  org(w, { id: 1, isFaction: true });
  property(w, { id: 10, communityId: 1 });
  // Find the real property runMoveMissions would deterministically
  // pick for this exact event id, then occupy it first.
  const picked = moveMissions.propertyIn(w, 1, ['move-mission-location', 903]);
  w.missions.push({ location_property_id: picked.id, status: 'available' });

  let tick = 0;
  let generated = [];
  // The open-mission check is unconditional (not gated on the real
  // trigger draw), so this must refuse regardless of the seeded roll.
  for (; tick < 50; tick += 1) {
    generated = moveMissions.runMoveMissions(w, [
      event({ id: 903, type: 'dominant_power_claims_ground', communityId: 1, affectedEntityIds: [1] }),
    ]);
    if (generated.length) break;
  }
  assert.deepEqual(generated, []);
});

test('runMoveMissions generates a real mission with a real controllingFactionId for a real faction organization, found across real seeded event ids', () => {
  let row = null;
  for (let eventId = 1000; eventId < 1000 + 500 && !row; eventId += 1) {
    const w = world();
    org(w, { id: 1, isFaction: true, name: 'Real Faction' });
    property(w, { id: 10, communityId: 1 });
    const generated = moveMissions.runMoveMissions(w, [
      event({ id: eventId, type: 'dominant_power_claims_ground', communityId: 1, affectedEntityIds: [1] }),
    ]);
    if (generated.length) {
      row = generated[0];
      assert.equal(row.controlling_faction_id, 1);
      assert.equal(row.location_property_id, 10);
      assert.ok(row.objective.includes('Real Faction'));
      assert.equal(typeof row.reward, 'number');
      assert.ok(w.missions.includes(row));
    }
  }
  assert.ok(row, 'no real mission was ever generated across 500 real seeded event ids');
});

test('runMoveMissions attaches a real non-faction organization via issuing_organization_id, never a fabricated controllingFactionId', () => {
  let row = null;
  for (let eventId = 2000; eventId < 2000 + 500 && !row; eventId += 1) {
    const w = world();
    org(w, { id: 2, isFaction: false, name: 'Real Government' });
    property(w, { id: 20, communityId: 5 });
    const generated = moveMissions.runMoveMissions(w, [
      event({ id: eventId, type: 'rogue_security_force_formed', communityId: 5, affectedEntityIds: [2, 99] }),
    ]);
    if (generated.length) {
      row = generated[0];
      assert.equal(row.controlling_faction_id, null);
      assert.equal(row.issuing_organization_id, 2);
    }
  }
  assert.ok(row, 'no real mission was ever generated across 500 real seeded event ids');
});

test('runMoveMissions covers all three real curated move types', () => {
  assert.deepEqual(
    moveMissions.TRIGGERING_TYPES.sort(),
    ['dominant_power_claims_ground', 'rogue_security_force_formed', 'territory_status_change'].sort(),
  );
});

// ---------------------------------------------------------------------
// Opt-in wiring — confirmed live, through the real engine.advanceTick()
// ---------------------------------------------------------------------

test('engine.advanceTick() runs with the opt-in flag unset (the default -- byte-for-byte unchanged behavior) and with it explicitly set, neither ever throwing', () => {
  const w = engine.WorldState;
  assert.equal(w.eventTriggeredMissions, undefined, 'a prior test left this opted in');
  assert.doesNotThrow(() => engine.advanceTick());

  w.eventTriggeredMissions = true;
  assert.doesNotThrow(() => engine.advanceTick());
  w.eventTriggeredMissions = undefined;
});
