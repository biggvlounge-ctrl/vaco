// A real disguise — masks, wigs, a change of clothing — by direct
// instruction: "disguise / notoriety-reduction mechanic." Read
// `server/disguise.js`'s own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const disguise = require('../server/disguise.js');
const policing = require('../server/policing.js');
const crime = require('../server/crime.js');
const territory = require('../server/territory.js');
const economy = require('../server/economy.js');
const inventory = require('../server/inventory.js');
const salvage = require('../server/salvage.js');

function world({ tick = 100 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    communities: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityTraits: [],
    entityKnowledge: [],
    entityState: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    crimeIncidents: [],
    resources: [],
    marketListings: [],
    inventory: [],
    barterItems: [],
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  crime.reseedIds(worldState);
  return worldState;
}

let nextId = 1;
function person(worldState, { communityId = null } = {}) {
  const npc = { id: nextId++, status: 'active', communityId, home_property_id: null };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings: 100, tick: worldState.tick });
  return npc;
}

// ---------------------------------------------------------------------
// isDisguised
// ---------------------------------------------------------------------

test('isDisguised is false with nothing equipped', () => {
  const w = world();
  const p = person(w);
  assert.equal(disguise.isDisguised(w, p.id), false);
});

test('isDisguised is true only when a real disguise item is EQUIPPED, not merely held', () => {
  const w = world();
  const p = person(w);
  salvage.registerItems(w);
  inventory.give(w, { entityId: p.id, itemName: 'mask', quantity: 1, equipped: false });
  assert.equal(disguise.isDisguised(w, p.id), false, 'a mask in a bag disguises nobody');

  inventory.give(w, { entityId: p.id, itemName: 'wig', quantity: 1, equipped: true });
  assert.equal(disguise.isDisguised(w, p.id), true);
});

test('ordinary clothing does not count as a disguise', () => {
  const w = world();
  const p = person(w);
  salvage.registerItems(w);
  inventory.give(w, { entityId: p.id, itemName: 'woven_garment', quantity: 1, equipped: true });
  assert.equal(disguise.isDisguised(w, p.id), false, 'the clothing CATEGORY is not the disguise list');
});

// ---------------------------------------------------------------------
// policing.evasionOf
// ---------------------------------------------------------------------

test('evasionOf is raised by the real disguise bonus when disguised, bounded to 1', () => {
  const w = world();
  const p = person(w);
  const plain = policing.evasionOf(w, p.id);

  salvage.registerItems(w);
  inventory.give(w, { entityId: p.id, itemName: 'mask', quantity: 1, equipped: true });
  const disguisedEvasion = policing.evasionOf(w, p.id);

  assert.ok(disguisedEvasion > plain);
  assert.equal(
    Math.round((disguisedEvasion - plain) * 100) / 100,
    disguise.DISGUISE_EVASION_BONUS,
  );
  assert.ok(disguisedEvasion <= 1);
});

// ---------------------------------------------------------------------
// Reaches crime.js's victim/witness confidence and policing's clearance
// through the one real evasionOf consumer, not a second check.
// ---------------------------------------------------------------------

test('a disguised perpetrator leaves the victim less confident, through the same evasionOf path', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  salvage.registerItems(w);
  inventory.give(w, { entityId: perpetrator.id, itemName: 'mask', quantity: 1, equipped: true });

  const incident = crime.recordCrime(w, { category: 'theft', perpetratorId: perpetrator.id, victimId: victim.id });
  const knowledge = w.entityKnowledge.find(
    (k) => k.entity_id === victim.id && k.subject_entity_id === perpetrator.id,
  );
  assert.ok(knowledge);
  // identifiable = 1 - evasionOf, so a higher evasionOf (disguised) means
  // lower confidence than the plain, undisguised baseline (0.5 exactly).
  assert.ok(knowledge.confidence_level < 0.5);
});

test('a real disguise lowers clearanceChance, through the same evasionOf path policing already reads', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });

  const incident = crime.recordCrime(w, { category: 'theft', perpetratorId: perpetrator.id, victimId: victim.id });
  const plainChance = policing.clearanceChance(w, incident, { capacity: 1 });

  salvage.registerItems(w);
  inventory.give(w, { entityId: perpetrator.id, itemName: 'mask', quantity: 1, equipped: true });
  const disguisedChance = policing.clearanceChance(w, incident, { capacity: 1 });

  assert.ok(disguisedChance < plainChance);
});

// ---------------------------------------------------------------------
// Mutation check: zeroing DISGUISE_EVASION_BONUS at the module level
// would remove the real effect this round adds.
// ---------------------------------------------------------------------

test('mutation check: DISGUISE_EVASION_BONUS is a real, non-zero, load-bearing constant', () => {
  assert.ok(disguise.DISGUISE_EVASION_BONUS > 0);
  const w = world();
  const p = person(w);
  salvage.registerItems(w);
  inventory.give(w, { entityId: p.id, itemName: 'mask', quantity: 1, equipped: true });
  const withDisguise = policing.evasionOf(w, p.id);
  const bare = 0.5; // an average, trait-less person's own baseline
  assert.ok(withDisguise > bare, 'the real bonus must move evasionOf above the undisguised baseline');
});
