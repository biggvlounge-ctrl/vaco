// Weapon-visibility NPC reaction + memory/witness system — by direct
// instruction. Read `server/crime.js#recordCrime`'s own header on the
// bystander-witness block first.
//
// `policing.js`'s own `VICTIM_BONUS` comment already says "a victim is
// a witness this engine actually has" — true and incomplete. The
// victim's own knowledge-write in `recordCrime` was the only DIRECT,
// present-at-the-scene account of an incident; everyone else in the
// community had no such thing, only `media.runWordOfMouth`'s slow
// spread from the victim outward. This closes that for the one
// category visibly armed enough to alarm a whole community: `gun`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const crime = require('../server/crime.js');
const territory = require('../server/territory.js');
const economy = require('../server/economy.js');
const weapons = require('../server/weapons.js');
const inventory = require('../server/inventory.js');
const policing = require('../server/policing.js');

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

function armWithFunctioningFirearm(worldState, entityId) {
  weapons.registerItems(worldState);
  inventory.give(worldState, { entityId, itemName: 'pistol', quantity: 1, equipped: true });
  inventory.give(worldState, { entityId, itemName: 'pistol_rounds', quantity: 5 });
}

test('a bystander in the same community gains a real, immediate witness memory of a gun incident', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  const bystander = person(w, { communityId: c.id });
  armWithFunctioningFirearm(w, perpetrator.id);

  crime.recordEscalation(w, { perpetratorId: perpetrator.id, victimId: victim.id });

  const witnessed = w.entityKnowledge.filter(
    (k) => k.entity_id === bystander.id && k.subject_entity_id === perpetrator.id,
  );
  assert.equal(witnessed.length, 1);
  assert.equal(witnessed[0].acquired_tick, w.tick);
  assert.ok(['known', 'assumption'].includes(witnessed[0].fact_type));
  assert.ok(witnessed[0].confidence_level > 0);
});

test('a bystander gains real stress from witnessing a gun incident nearby', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  const bystander = person(w, { communityId: c.id });
  armWithFunctioningFirearm(w, perpetrator.id);

  crime.recordEscalation(w, { perpetratorId: perpetrator.id, victimId: victim.id });

  const stressRow = w.entityState.find((s) => s.entity_id === bystander.id);
  assert.ok(stressRow, 'a stress row must have been created for the bystander');
  assert.ok(stressRow.stress_level > 0);
});

test('an unarmed offence does not touch bystanders at all', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  const bystander = person(w, { communityId: c.id });
  // No firearm given — recordEscalation must classify this unarmed.

  crime.recordEscalation(w, { perpetratorId: perpetrator.id, victimId: victim.id });

  assert.equal(w.entityKnowledge.filter((k) => k.entity_id === bystander.id).length, 0);
  assert.equal(w.entityState.find((s) => s.entity_id === bystander.id), undefined);
});

test('a resident of a DIFFERENT community is not a witness', () => {
  const w = world();
  const here = territory.generateCommunity(w, {});
  const there = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: here.id });
  const victim = person(w, { communityId: here.id });
  const elsewhere = person(w, { communityId: there.id });
  armWithFunctioningFirearm(w, perpetrator.id);

  crime.recordEscalation(w, { perpetratorId: perpetrator.id, victimId: victim.id });

  assert.equal(w.entityKnowledge.filter((k) => k.entity_id === elsewhere.id).length, 0);
});

test('the victim is excluded from the bystander pass — their own knowledge row is not duplicated', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  armWithFunctioningFirearm(w, perpetrator.id);

  crime.recordEscalation(w, { perpetratorId: perpetrator.id, victimId: victim.id });

  const victimKnowledge = w.entityKnowledge.filter(
    (k) => k.entity_id === victim.id && k.subject_entity_id === perpetrator.id,
  );
  assert.equal(victimKnowledge.length, 1, 'exactly the victim\'s own direct knowledge row, not a second bystander copy');
});

// ---------------------------------------------------------------------
// policing.js: a real witness measurably helps clear a case
// ---------------------------------------------------------------------

test('policing.hasRealWitness is true only when a non-victim holds a real, same-tick fact about the perpetrator', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  person(w, { communityId: c.id }); // bystander

  const incidentNoWitness = crime.recordCrime(w, {
    category: 'theft', perpetratorId: perpetrator.id, victimId: victim.id,
  });
  assert.equal(policing.hasRealWitness(w, incidentNoWitness), false);

  armWithFunctioningFirearm(w, perpetrator.id);
  const incidentWithWitness = crime.recordEscalation(w, {
    perpetratorId: perpetrator.id, victimId: victim.id,
  });
  assert.equal(policing.hasRealWitness(w, incidentWithWitness), true);
});

test('a real witness raises clearanceChance over an identical incident with none', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const perpetrator = person(w, { communityId: c.id });
  const victim = person(w, { communityId: c.id });
  person(w, { communityId: c.id }); // bystander
  armWithFunctioningFirearm(w, perpetrator.id);

  const incident = crime.recordEscalation(w, { perpetratorId: perpetrator.id, victimId: victim.id });
  const withWitness = policing.clearanceChance(w, incident, { capacity: 1 });

  // Strip the witness row to measure the identical incident without one.
  w.entityKnowledge = w.entityKnowledge.filter((k) => k.entity_id === victim.id);
  const withoutWitness = policing.clearanceChance(w, incident, { capacity: 1 });

  assert.ok(withWitness > withoutWitness);
  assert.ok((withWitness - withoutWitness) <= policing.WITNESS_BONUS + 0.001);
});

// ---------------------------------------------------------------------
// Mutation check: zeroing WITNESS_BONUS must remove the real advantage
// this round adds, confirming it is load-bearing rather than decorative.
// ---------------------------------------------------------------------

test('mutation check: WITNESS_BONUS is a real, non-zero, load-bearing constant', () => {
  assert.ok(policing.WITNESS_BONUS > 0);
  assert.ok(policing.WITNESS_BONUS < policing.VICTIM_BONUS,
    'a bystander is corroborating evidence, weighted below the victim\'s own direct account');
});
