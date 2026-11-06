// server/bluff.js — bluffing and its exposure. See that file's own
// header for the two real mechanisms this reuses (`weapons
// .isFunctioningFirearm` as ground truth, `perception.receivedConfidence`
// as the belief model) rather than inventing a second, disagreeing one
// of either.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const bluff = require('../server/bluff.js');
const weapons = require('../server/weapons.js');
const influence = require('../server/influence.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');
const worldStore = require('../server/worldStore.js');
const { getTraitId } = require('../server/traitDefinitions.js');

let nextId = 800000;

function world({ tick = 36500 } = {}) {
  const w = {
    tick,
    seed: 'bluff-test',
    npcs: [],
    deceased: [],
    organizations: [],
    inventory: [],
    barterItems: [],
    properties: [],
    cities: [],
    regions: [],
    communities: [],
    families: [],
    familyMemberships: [],
    employmentRecords: [],
    individualFinances: [],
    civilizations: [],
    technologyEras: [],
    civilizationTechnologyProgress: [],
    entityTraits: [],
    entityKnowledge: [],
    memories: [],
    activeConditions: [],
    resources: [],
    marketListings: [],
    relationships: [],
    historicalRecords: [],
    crimeIncidents: [],
    nextEntityId: 1,
  };
  economy.reseedIds(w);
  inventory.reseedIds(w);
  return w;
}

function person(w) {
  const npc = { id: nextId++, status: 'active', communityId: null, traits: {} };
  w.npcs.push(npc);
  return npc;
}

function setTrait(w, entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  if (!traitId) throw new Error(`fixture names a trait that does not exist: ${family}.${name}`);
  w.entityTraits.push({
    entity_id: entityId, trait_id: traitId, current_value: value, base_value: value, key_modifier: 0,
  });
}

// A persuasive bluffer: all three real traits `persuasivenessOf` reads,
// maxed, so `believedPct` clears the 50 floor against an ordinary
// (unset, perception 50) target regardless of float rounding.
function makePersuasive(w, entityId) {
  setTrait(w, entityId, 'criminal', 'Deception', 100);
  setTrait(w, entityId, 'social', 'Charisma', 100);
  setTrait(w, entityId, 'social', 'Persuasion', 100);
}

function equipGun(w, entityId, { loaded = false } = {}) {
  weapons.registerItems(w);
  inventory.give(w, { entityId, itemName: 'pistol' });
  inventory.equip(w, { entityId, itemName: 'pistol' });
  if (loaded) inventory.give(w, { entityId, itemName: 'pistol_rounds', quantity: 5 });
}

// ---------------------------------------------------------------------
// persuasivenessOf
// ---------------------------------------------------------------------

test('persuasivenessOf centres on 50 for an entity with no generated trait rows', () => {
  const w = world();
  const nobody = person(w);
  assert.equal(bluff.persuasivenessOf(w, nobody.id), 50);
});

test('persuasivenessOf rises with real Deception/Charisma/Persuasion', () => {
  const w = world();
  const smooth = person(w);
  makePersuasive(w, smooth.id);
  assert.equal(bluff.persuasivenessOf(w, smooth.id), 100);
});

// ---------------------------------------------------------------------
// fearOf
// ---------------------------------------------------------------------

test('fearOf is 0 when no relationship has ever been created', () => {
  const w = world();
  const a = person(w);
  const b = person(w);
  assert.equal(bluff.fearOf(w, a.id, b.id), 0);
});

// ---------------------------------------------------------------------
// intimidate
// ---------------------------------------------------------------------

test('intimidate refuses an actor with nothing equipped to brandish', () => {
  const w = world();
  const bare = person(w);
  const target = person(w);
  const result = bluff.intimidate(w, { actorId: bare.id, targetId: target.id });
  assert.equal(result.intimidated, false);
  assert.match(result.reason, /nothing equipped/);
  assert.equal(bluff.fearOf(w, target.id, bare.id), 0);
});

test('intimidate refuses self-targeting', () => {
  const w = world();
  const p = person(w);
  equipGun(w, p.id);
  const result = bluff.intimidate(w, { actorId: p.id, targetId: p.id });
  assert.equal(result.intimidated, false);
  assert.match(result.reason, /yourself/);
});

test('intimidate with no persuasive edge over an ordinary target raises no fear -- the honest default', () => {
  const w = world();
  const bluffer = person(w);
  const target = person(w);
  equipGun(w, bluffer.id); // empty -- never checked here
  const result = bluff.intimidate(w, { actorId: bluffer.id, targetId: target.id });
  assert.equal(result.intimidated, true);
  // broadcastConfidence 0.5 against an ordinary (perception 50) target
  // scales to exactly 0.5 -- not > the real FEAR_BELIEF_FLOOR of 50.
  assert.equal(result.fearDelta, 0);
  assert.equal(bluff.fearOf(w, target.id, bluffer.id), 0);
});

test('a persuasive bluffer with an empty gun raises real fear in an ordinary target', () => {
  const w = world();
  const bluffer = person(w);
  const target = person(w);
  equipGun(w, bluffer.id); // NOT loaded -- this is the bluff
  makePersuasive(w, bluffer.id);
  const result = bluff.intimidate(w, { actorId: bluffer.id, targetId: target.id });
  assert.equal(result.intimidated, true);
  assert.ok(result.fearDelta > 0, 'a maximally persuasive bluffer must move real fear');
  assert.equal(bluff.fearOf(w, target.id, bluffer.id), result.fearDelta);
  // The ground truth is real and untouched by the bluff succeeding.
  assert.equal(weapons.isFunctioningFirearm(w, bluffer.id), false);
});

test('intimidate works identically whether the gun is real or empty -- it never checks', () => {
  const w = world();
  const bluffer = person(w);
  const target = person(w);
  equipGun(w, bluffer.id, { loaded: true }); // a REAL threat, not a bluff
  makePersuasive(w, bluffer.id);
  const result = bluff.intimidate(w, { actorId: bluffer.id, targetId: target.id });
  assert.ok(result.fearDelta > 0);
  assert.equal(weapons.isFunctioningFirearm(w, bluffer.id), true);
});

// ---------------------------------------------------------------------
// assessThreat -- read-only, and never the ground truth
// ---------------------------------------------------------------------

test('assessThreat reports only the real standing fear value, and nothing about ground truth', () => {
  const w = world();
  const bluffer = person(w);
  const target = person(w);
  equipGun(w, bluffer.id);
  makePersuasive(w, bluffer.id);
  bluff.intimidate(w, { actorId: bluffer.id, targetId: target.id });

  const assessment = bluff.assessThreat(w, { entityId: target.id, targetId: bluffer.id });
  assert.equal(assessment.fear, bluff.fearOf(w, target.id, bluffer.id));
  assert.ok(assessment.fear > 0);
  // The whole point: this call must carry nothing else. A key named
  // anything about armed status here would collapse the mechanic.
  assert.deepEqual(Object.keys(assessment), ['fear']);
});

// ---------------------------------------------------------------------
// callBluff -- deterministic, real, and asymmetric both ways
// ---------------------------------------------------------------------

test('callBluff with no standing fear refuses outright', () => {
  const w = world();
  const a = person(w);
  const b = person(w);
  const result = bluff.callBluff(w, { challengerId: a.id, targetId: b.id });
  assert.equal(result.called, false);
});

test('calling a real bluff (empty gun) exposes it -- fear resets and the bluffer\'s standing with the challenger falls', () => {
  const w = world();
  const bluffer = person(w);
  const challenger = person(w);
  equipGun(w, bluffer.id); // empty
  makePersuasive(w, bluffer.id);
  bluff.intimidate(w, { actorId: bluffer.id, targetId: challenger.id });
  assert.ok(bluff.fearOf(w, challenger.id, bluffer.id) > 0);

  // The bluff's own `intimidate` already created this real pair (via
  // `raiseFear`'s own `getOrCreateRelationship`), at the schema's
  // generic `influence: 0` -- so this is an EXISTING relationship by
  // the time `callBluff` touches it, and `lowerInfluence` only ever
  // subtracts from what is actually stored, never reseeds it.
  const before = Number(worldStore.findRelationship(w, bluffer.id, challenger.id)?.influence) || 0;
  const result = bluff.callBluff(w, { challengerId: challenger.id, targetId: bluffer.id });

  assert.equal(result.called, true);
  assert.equal(result.bluffExposed, true);
  assert.equal(result.realThreat, false);
  assert.equal(bluff.fearOf(w, challenger.id, bluffer.id), 0, 'exposing the bluff must reset the fear it created');

  const rel = worldStore.findRelationship(w, bluffer.id, challenger.id);
  assert.equal(Number(rel.influence), Math.max(0, before - influence.INFLUENCE_DELTA));
});

test('calling a REAL armed threat is not a bluff at all -- it escalates through the real crime mechanism instead', () => {
  const w = world();
  const threat = person(w);
  const challenger = person(w);
  equipGun(w, threat.id, { loaded: true }); // genuinely armed
  makePersuasive(w, threat.id);
  bluff.intimidate(w, { actorId: threat.id, targetId: challenger.id });
  assert.ok(bluff.fearOf(w, challenger.id, threat.id) > 0);

  const before = w.crimeIncidents.length;
  const result = bluff.callBluff(w, { challengerId: challenger.id, targetId: threat.id });

  assert.equal(result.called, true);
  assert.equal(result.bluffExposed, false);
  assert.equal(result.realThreat, true);
  assert.equal(w.crimeIncidents.length, before + 1, 'a real threat called must produce a real crime incident');
  assert.equal(result.incident.category, 'gun');
  assert.equal(result.incident.perpetrator_entity_id, threat.id);
  assert.equal(result.incident.victim_entity_id, challenger.id);
});
