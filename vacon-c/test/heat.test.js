// server/heat.js — real, independent per-faction heat. See its own
// header for the real substrate (the shared entities(id) space between
// people and organizations, `relationships.conflict` reused rather than
// a new field, `justice.answerByGroup` as the one real trigger) and the
// deliberate scope boundary (no heat with the government/police, whose
// own real conviction pipeline already answers that case more strongly).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const heat = require('../server/heat.js');
const justice = require('../server/justice.js');
const worldStore = require('../server/worldStore.js');

let nextId = 900000;

function world() {
  return {
    tick: 0,
    npcs: [],
    organizations: [],
    relationships: [],
    memories: [],
    inventory: [],
    barterItems: [],
    entityOrganizationMemberships: [],
  };
}

function person(w) {
  const npc = { id: nextId++, status: 'active' };
  w.npcs.push(npc);
  return npc;
}

function faction(w) {
  const org = { id: nextId++, name: 'Holders', type: 'gang', isFaction: true };
  w.organizations.push(org);
  return org;
}

// -- heatWith / raiseHeat -------------------------------------------------

test('heatWith is a real zero, not null, for a person who has never been on any faction\'s radar', () => {
  const w = world();
  const p = person(w);
  const f = faction(w);
  assert.equal(heat.heatWith(w, p.id, f.id), 0);
});

test('raiseHeat creates a real enemy-typed relationship and reads back through heatWith', () => {
  const w = world();
  const p = person(w);
  const f = faction(w);
  heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: f.id, amount: 20 });
  assert.equal(heat.heatWith(w, p.id, f.id), 20);
  const rel = worldStore.findRelationship(w, p.id, f.id);
  assert.equal(rel.relationship_type, heat.HEAT_RELATIONSHIP_TYPE);
});

test('raiseHeat clamps at 100 and never overshoots, the identical clamp shape answerByGroup\'s own feud write already uses', () => {
  const w = world();
  const p = person(w);
  const f = faction(w);
  heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: f.id, amount: 95 });
  heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: f.id, amount: 95 });
  assert.equal(heat.heatWith(w, p.id, f.id), 100);
});

test('raiseHeat defaults to the real HEAT_GAIN, which is justice.GROUP_FEUD_GAIN -- the same real magnitude, not a second invented one', () => {
  assert.equal(heat.HEAT_GAIN, justice.GROUP_FEUD_GAIN);
  const w = world();
  const p = person(w);
  const f = faction(w);
  heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: f.id });
  assert.equal(heat.heatWith(w, p.id, f.id), justice.GROUP_FEUD_GAIN);
});

// -- heatProfile: independent per faction, never one scalar ---------------

test('heatProfile tracks multiple factions independently -- raising heat with one never moves another', () => {
  const w = world();
  const p = person(w);
  const gangA = faction(w);
  const gangB = faction(w);
  heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: gangA.id, amount: 30 });

  assert.equal(heat.heatWith(w, p.id, gangA.id), 30);
  assert.equal(heat.heatWith(w, p.id, gangB.id), 0, 'heat with one faction must not leak into another');

  const profile = heat.heatProfile(w, p.id);
  assert.deepEqual(profile, [{ factionOrganizationId: gangA.id, heat: 30 }]);

  heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: gangB.id, amount: 10 });
  const profile2 = heat.heatProfile(w, p.id).sort((a, b) => a.factionOrganizationId - b.factionOrganizationId);
  assert.deepEqual(
    profile2.sort((a, b) => a.heat - b.heat),
    [{ factionOrganizationId: gangB.id, heat: 10 }, { factionOrganizationId: gangA.id, heat: 30 }]
      .sort((a, b) => a.heat - b.heat),
  );
});

test('heatProfile never confuses an ordinary person-to-person "enemy" relationship for faction heat', () => {
  const w = world();
  const p = person(w);
  const rival = person(w);
  worldStore.adjustRelationship(w, p.id, rival.id, 'enemy', { conflict: 40 });
  assert.deepEqual(heat.heatProfile(w, p.id), [],
    'an enemy relationship with another PERSON is ordinary interpersonal conflict, not faction heat');
});

test('heatProfile excludes a faction heat reached and then reduced back to zero', () => {
  const w = world();
  const p = person(w);
  const f = faction(w);
  const rel = heat.raiseHeat(w, { entityId: p.id, factionOrganizationId: f.id, amount: 10 });
  rel.conflict = 0;
  assert.deepEqual(heat.heatProfile(w, p.id), []);
});

// -- the real trigger: justice.answerByGroup -------------------------------

function groupLawWorld() {
  const w = world();
  const offender = person(w);
  const victim = person(w);
  const holder = faction(w);
  return { w, offender, victim, holder };
}

test('justice.answerByGroup raises real heat with the real holder once it actually acts', () => {
  const { w, offender, victim, holder } = groupLawWorld();
  w.inventory.push({
    id: 1, holder_entity_id: offender.id, item_name: 'blade', quantity: 1, condition: 100, equipped: false,
  });
  w.barterItems.push({ name: 'blade', category: 'protection', origin: 'producible' });

  const incident = { id: 1, perpetrator_entity_id: offender.id, victim_entity_id: victim.id, category: 'theft' };
  const answered = justice.answerByGroup(w, { incident, holderId: holder.id, communityId: 5, tick: 0 });

  assert.ok(answered, 'restitution had a real holding and a real living victim to go to');
  assert.ok(heat.heatWith(w, offender.id, holder.id) > 0,
    'the offender must now have real heat with the holder that just dealt with them');
});

test('justice.answerByGroup raises NO heat when it genuinely does nothing -- heat is not omniscience about every offence in a faction\'s territory', () => {
  const { w, offender, holder } = groupLawWorld();
  // No victim, no holdings, not a member -- none of the three real
  // levers fire, exactly the "some things simply go unanswered" case
  // justice.js's own header names.
  const incident = { id: 2, perpetrator_entity_id: offender.id, victim_entity_id: null, category: 'property' };
  const answered = justice.answerByGroup(w, { incident, holderId: holder.id, communityId: 5, tick: 0 });

  assert.equal(answered, null);
  assert.equal(heat.heatWith(w, offender.id, holder.id), 0,
    'nothing really happened, so the offender must not be on this faction\'s real radar');
});

test('two different factions dealing with the same offender build independent heat -- the actual "not just one wanted scalar" claim', () => {
  const w = world();
  const offender = person(w);
  const victimA = person(w);
  const victimB = person(w);
  const gangA = faction(w);
  const gangB = faction(w);
  w.inventory.push(
    { id: 1, holder_entity_id: offender.id, item_name: 'blade', quantity: 2, condition: 100, equipped: false },
  );
  w.barterItems.push({ name: 'blade', category: 'protection', origin: 'producible' });

  justice.answerByGroup(w, {
    incident: { id: 1, perpetrator_entity_id: offender.id, victim_entity_id: victimA.id, category: 'theft' },
    holderId: gangA.id, communityId: 5, tick: 0,
  });
  justice.answerByGroup(w, {
    incident: { id: 2, perpetrator_entity_id: offender.id, victim_entity_id: victimB.id, category: 'theft' },
    holderId: gangB.id, communityId: 9, tick: 1,
  });

  assert.ok(heat.heatWith(w, offender.id, gangA.id) > 0);
  assert.ok(heat.heatWith(w, offender.id, gangB.id) > 0);
  assert.equal(heat.heatProfile(w, offender.id).length, 2, 'both factions must track this offender independently, on their own radar each');
});
