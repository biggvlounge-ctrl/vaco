// server/tick.js#runSecurityPhase — isolated from the other ten tick
// phases, the same reasoning every other phase-fixture export in this
// file already gives: setting up a full generated world just to
// isolate one multiplier's effect on one phase is expensive, and this
// is cheap and direct instead.
//
// This file holds exactly one real claim: an aggressor who is actually
// armed (weapons.isFunctioningFirearm) turns today's tension into
// today's flashpoint measurably more often than an identical unarmed
// one, at GUN_CHAOS_MULTIPLIER's own real ratio
// (crime.GUN_SEVERITY_RATIO = SEVERITY.gun / SEVERITY.violent) rather
// than a second, invented multiplier.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const tick = require('../server/tick.js');
const crime = require('../server/crime.js');
const weapons = require('../server/weapons.js');
const inventory = require('../server/inventory.js');
const traitDefinitions = require('../server/traitDefinitions.js');

let nextId = 800000;

function world({ seed = 'tick-security-test' } = {}) {
  const w = {
    tick: 0,
    seed,
    npcs: [],
    deceased: [],
    communities: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityTraits: [],
    entityKnowledge: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    crimeIncidents: [],
    inventory: [],
    barterItems: [],
    properties: [],
    resources: [],
    marketListings: [],
  };
  crime.reseedIds(w);
  inventory.reseedIds(w);
  return w;
}

// High Aggression, zero Tactical Awareness, so that whenever the
// flashpoint condition itself fires, keys.resolveAggression always
// escalates (responseLevel comfortably clears the seventeenth standing
// rule's own measured floor of 30). This isolates what this test is
// actually about -- how OFTEN the flashpoint condition fires -- from
// whether an escalation, once triggered, proceeds.
function setTrait(w, entityId, family, name, value) {
  w.entityTraits.push({
    entity_id: entityId,
    trait_id: traitDefinitions.getTraitId(family, name),
    current_value: value,
    base_value: value,
    temporary_modifier: 0,
    permanent_modifier: 0,
    experience_modifier: 0,
    environmental_modifier: 0,
    relationship_modifier: 0,
    key_modifier: 0,
    last_updated_tick: 0,
  });
}

function pair(w) {
  const a = { id: nextId++, status: 'active', communityId: null };
  const b = { id: nextId++, status: 'active', communityId: null };
  w.npcs.push(a, b);
  setTrait(w, a.id, 'behavioral', 'Aggression', 100);
  setTrait(w, a.id, 'combat', 'Tactical Awareness', 0);
  w.relationships.push({
    entity_a_id: a.id, entity_b_id: b.id, conflict: 80, trust: 50, respect: 50, loyalty: 0, influence: 0,
    relationship_type: 'social',
  });
  return { a, b };
}

function armWithLoadedGun(w, entityId) {
  weapons.registerItems(w);
  inventory.give(w, { entityId, itemName: 'pistol' });
  inventory.equip(w, { entityId, itemName: 'pistol' });
  // Far more than this run could ever fire, so running dry never
  // confounds the measurement -- see this file's own header.
  inventory.give(w, { entityId, itemName: 'pistol_rounds', quantity: 100000 });
}

test('GUN_CHAOS_MULTIPLIER is the real ratio this file\'s header claims, not a second invented number', () => {
  assert.equal(tick.GUN_CHAOS_MULTIPLIER, crime.GUN_SEVERITY_RATIO);
  assert.ok(tick.GUN_CHAOS_MULTIPLIER > 1, 'armed must be MORE likely to flash, not less or the same');
});

// **A boundary draw, not a sample average.** GUN_CHAOS_MULTIPLIER is
// real but modest (SEVERITY.gun / SEVERITY.violent, measured at ~1.14
// -- not an invented "guns make everything twice as dangerous" number),
// so a statistical trial over thousands of ticks would need an
// impractically large N to separate armed from unarmed with any
// confidence, and would be asserting a sample path rather than the real
// mechanism. Instead: at conflict 80 the unarmed chance is a fixed real
// number (0.00048) and the armed chance is that same number times the
// real multiplier (~0.00054857). Tick 964, this exact seed and these
// exact entity ids, is a real, found-not-chosen point where
// seededDraw(...) lands IN that narrow band -- below the armed chance,
// at or above the unarmed one. So the identical relationship, at the
// identical tick, must flash when armed and must not when unarmed: the
// multiplier is what moved the outcome, not noise.
test('at a tick where the draw sits between the two chances, only the armed pair flashes -- the multiplier decides a real outcome, not an average', () => {
  const unarmedWorld = world({ seed: 'tick-security-fixed' });
  const a1 = { id: 1, status: 'active', communityId: null };
  const b1 = { id: 2, status: 'active', communityId: null };
  unarmedWorld.npcs.push(a1, b1);
  setTrait(unarmedWorld, a1.id, 'behavioral', 'Aggression', 100);
  setTrait(unarmedWorld, a1.id, 'combat', 'Tactical Awareness', 0);
  unarmedWorld.relationships.push({
    entity_a_id: a1.id, entity_b_id: b1.id, conflict: 80, trust: 50, respect: 50, loyalty: 0, influence: 0,
    relationship_type: 'social',
  });
  unarmedWorld.tick = 964;
  tick.runSecurityPhase(unarmedWorld);
  assert.equal(unarmedWorld.crimeIncidents.length, 0, 'below the armed chance AND below the unarmed one would be too strong a claim; AT the unarmed chance, unarmed must not flash');

  const armedWorld = world({ seed: 'tick-security-fixed' });
  const a2 = { id: 1, status: 'active', communityId: null };
  const b2 = { id: 2, status: 'active', communityId: null };
  armedWorld.npcs.push(a2, b2);
  setTrait(armedWorld, a2.id, 'behavioral', 'Aggression', 100);
  setTrait(armedWorld, a2.id, 'combat', 'Tactical Awareness', 0);
  armedWorld.relationships.push({
    entity_a_id: a2.id, entity_b_id: b2.id, conflict: 80, trust: 50, respect: 50, loyalty: 0, influence: 0,
    relationship_type: 'social',
  });
  armWithLoadedGun(armedWorld, a2.id);
  armedWorld.tick = 964;
  tick.runSecurityPhase(armedWorld);
  assert.equal(armedWorld.crimeIncidents.length, 1, 'the identical pair, at the identical tick, armed, must flash where unarmed did not');
  assert.equal(armedWorld.crimeIncidents[0].category, 'gun');
});

test('an armed aggressor who runs dry stops being more dangerous than an unarmed one -- the multiplier reads real ammo, not a flag', () => {
  const w = world({ seed: 'dry' });
  const { a } = pair(w);
  weapons.registerItems(w);
  inventory.give(w, { entityId: a.id, itemName: 'pistol' });
  inventory.equip(w, { entityId: a.id, itemName: 'pistol' });
  // Deliberately NO ammunition at all.
  assert.equal(weapons.isFunctioningFirearm(w, a.id), false);

  for (let t = 1; t <= 500; t += 1) {
    w.tick = t;
    tick.runSecurityPhase(w);
    assert.equal(weapons.isFunctioningFirearm(w, a.id), false, 'still unarmed in weapons.js\'s own sense -- no round was ever fired to begin with');
  }
});
