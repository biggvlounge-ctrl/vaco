// server/fraud.js — closes crime.js's own declared `fraud` category.
//
// Fixtures build directly on `engine.WorldState`, the same pattern
// `test/roguePolice.test.js` establishes, with distinct community ids
// per test to avoid cross-test interference within this one file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const fraud = require('../server/fraud.js');
const economy = require('../server/economy.js');
const property = require('../server/property.js');

const w = engine.WorldState;

let nextCommunityId = 8001;

function communityWith(options = {}) {
  const communityId = nextCommunityId += 1;
  const npcs = [];
  for (const spec of options.npcs || []) {
    const npc = engine.generateNPC({
      communityId,
      traitValueFor: (def) => (
        def.family === 'criminal' && def.name === 'Deception' ? (spec.deception ?? 50) : 50
      ),
    });
    if (spec.savings !== undefined) {
      economy.generateIndividualFinances(w, npc.id, { savings: spec.savings, tick: 0 });
    }
    npcs.push(npc);
  }
  for (const propSpec of options.properties || []) {
    const prop = { id: w.properties.length + 100000 + Math.floor(Math.random() * 1e6), community_id: communityId, value: propSpec.value, condition: 100 };
    w.properties.push(prop);
    if (propSpec.ownerId != null) {
      property.recordOwnership(w, {
        entityId: prop.id, ownerEntityId: propSpec.ownerId, ownerType: 'individual',
        acquiredMethod: 'purchased', tick: 0,
      });
    }
  }
  return { communityId, npcs };
}

test('deceptionOf reads the real live criminal.Deception trait', () => {
  const npc = engine.generateNPC({
    traitValueFor: (def) => (def.family === 'criminal' && def.name === 'Deception' ? 88 : 50),
  });
  assert.equal(fraud.deceptionOf(w, npc.id), 88);
});

test('moveSavings debits one side and credits the other, both real rows', () => {
  const a = engine.generateNPC({});
  const b = engine.generateNPC({});
  economy.generateIndividualFinances(w, a.id, { savings: 1000, tick: 0 });
  economy.generateIndividualFinances(w, b.id, { savings: 100, tick: 0 });
  fraud.moveSavings(w, a.id, b.id, 300, 5);
  assert.equal(economy.getLatestFinances(w, a.id).savings, 700);
  assert.equal(economy.getLatestFinances(w, b.id).savings, 400);
});

test('unownedOrOtherOwnedPropertyIn: finds a real property this perpetrator does not hold, never one they do', () => {
  const { communityId, npcs: [perpetrator] } = communityWith({
    npcs: [{}],
    properties: [{ value: 5000, ownerId: null }],
  });
  const found = fraud.unownedOrOtherOwnedPropertyIn(w, communityId, perpetrator.id);
  assert.ok(found);

  // Now give the perpetrator real title to it -- it must no longer qualify.
  property.recordOwnership(w, {
    entityId: found.id, ownerEntityId: perpetrator.id, ownerType: 'individual',
    acquiredMethod: 'purchased', tick: 0,
  });
  assert.equal(fraud.unownedOrOtherOwnedPropertyIn(w, communityId, perpetrator.id), null);
});

test('markIn: a real victim with enough liquid savings, never the perpetrator, never somebody short', () => {
  const { communityId, npcs: [perpetrator, poor, rich] } = communityWith({
    npcs: [{ savings: 50000 }, { savings: 10 }, { savings: 2000 }],
  });
  const found = fraud.markIn(w, communityId, perpetrator.id, 500);
  assert.equal(found.id, rich.id);
  assert.notEqual(found.id, poor.id);
  assert.notEqual(found.id, perpetrator.id);
});

test('runFraud: an honest null when there is no real property, no real mark, or no real deception', () => {
  // No property at all.
  const noProperty = communityWith({ npcs: [{ deception: 95 }, { savings: 10000 }] });
  assert.deepEqual(fraud.runFraud(w, 0).filter((i) => i.community_id === noProperty.communityId), []);

  // A real property, but no mark with enough savings.
  const noMark = communityWith({
    npcs: [{ deception: 95 }, { savings: 1 }],
    properties: [{ value: 100000, ownerId: null }],
  });
  assert.deepEqual(fraud.runFraud(w, 0).filter((i) => i.community_id === noMark.communityId), []);

  // Real property, real mark -- but zero deception.
  const noDeception = communityWith({
    npcs: [{ deception: 0 }, { savings: 10000 }],
    properties: [{ value: 10000, ownerId: null }],
  });
  assert.deepEqual(fraud.runFraud(w, 0).filter((i) => i.community_id === noDeception.communityId), []);
});

test('runFraud: a real scam, correctly wired end to end', () => {
  // A single call's own draw is a real per-tick probability
  // (`BASE_FRAUD_RISK` at Deception 100), not a guarantee -- the same
  // reason `test/crime.test.js`'s own `runDeprivationCrime` tests run
  // hundreds of ticks rather than asserting on one. Looped here until
  // at least one real incident lands.
  const { communityId, npcs: [perpetrator, victim] } = communityWith({
    npcs: [{ deception: 100 }, { savings: 10000000 }],
    properties: [{ value: 20000, ownerId: null }],
  });

  let incident = null;
  for (let tick = 1; tick <= 20000 && !incident; tick += 1) {
    const incidents = fraud.runFraud(w, tick).filter((i) => i.community_id === communityId);
    if (incidents.length > 0) incident = incidents[0];
  }
  assert.ok(incident, 'a Deception-100 perpetrator with a real mark and a real target must eventually defraud');
  assert.equal(incident.category, 'fraud');
  assert.equal(incident.perpetrator_entity_id, perpetrator.id);
  assert.equal(incident.victim_entity_id, victim.id);

  const expectedDeposit = Math.round(20000 * fraud.DEPOSIT_SHARE);
  assert.equal(economy.getLatestFinances(w, perpetrator.id).savings, expectedDeposit);

  // The perpetrator never actually acquired the property -- it stays
  // exactly as unowned as it was before the "sale".
  const target = (w.properties || []).find((p) => p.community_id === communityId);
  assert.equal(property.getCurrentOwner(w, target.id), null);
});

// Mutation-verified: temporarily made `runFraud` skip the seededDraw
// gate entirely (every NPC with any Deception above 0 always
// defrauds), confirmed the "an honest null... zero deception" case
// above still passed (it does not exercise the gate) but the real
// per-tick RATE test below failed by producing far more than one
// incident for a single eligible perpetrator across repeated calls;
// reverted.
test('runFraud only fires probabilistically, not on every eligible call', () => {
  const { communityId, npcs: [perpetrator] } = communityWith({
    npcs: [{ deception: 40 }, { savings: 100000 }],
    properties: [{ value: 20000, ownerId: null }],
  });
  let fires = 0;
  for (let tick = 1; tick <= 50; tick += 1) {
    const incidents = fraud.runFraud(w, tick).filter(
      (i) => i.community_id === communityId && i.perpetrator_entity_id === perpetrator.id,
    );
    fires += incidents.length;
  }
  assert.ok(fires < 50, 'a moderate-Deception perpetrator must not defraud on literally every tick');
});
