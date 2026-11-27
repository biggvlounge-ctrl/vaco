// server/dialogue.js — universal NPC interaction, task #96. See that
// file's own header for the full design and the real tone-band
// mistake caught before it shipped.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const dialogue = require('../server/dialogue.js');
const worldStore = require('../server/worldStore.js');
const economy = require('../server/economy.js');
const behavior = require('../server/behavior.js');

let nextId = 941001;

function world() {
  return {
    tick: 10,
    npcs: [],
    entityTraits: [],
    entityKnowledge: [],
    relationships: [],
    employmentRecords: [],
    entityState: [],
  };
}

function person(w, { communityId = null } = {}) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active', communityId });
  return id;
}

function knows(w, { entityId, subjectEntityId, confidence, content = 'something' }) {
  worldStore.addKnowledge(w, {
    entityId, subjectEntityId, factType: 'rumor', factContent: content,
    confidenceLevel: confidence, sourceEntityId: null, tick: w.tick,
  });
}

// ---------------------------------------------------------------------
// toneFor
// ---------------------------------------------------------------------

test('toneFor reads a brand-new stranger (the real schema default, trust 50/conflict 0) as neutral, never warm', () => {
  const w = world();
  const a = person(w);
  const b = person(w);
  const rel = worldStore.getOrCreateRelationship(w, a, b, 'social');
  assert.equal(dialogue.toneFor(rel), 'neutral');
});

test('toneFor reads real trust grown above the default as warm', () => {
  const rel = { trust: 75, conflict: 0 };
  assert.equal(dialogue.toneFor(rel), 'warm');
});

test('toneFor reads real conflict as hostile', () => {
  const rel = { trust: 50, conflict: 25 };
  assert.equal(dialogue.toneFor(rel), 'hostile');
});

// ---------------------------------------------------------------------
// bestSharableFact
// ---------------------------------------------------------------------

test('bestSharableFact surfaces a real fact the npc holds that the player does not', () => {
  const w = world();
  const npc = person(w);
  const player = person(w);
  const subject = person(w);
  knows(w, { entityId: npc, subjectEntityId: subject, confidence: 70, content: 'runs with a rough crowd' });

  const fact = dialogue.bestSharableFact(w, npc, player);
  assert.ok(fact);
  assert.equal(fact.fact_content, 'runs with a rough crowd');
});

test('bestSharableFact refuses a fact the player already holds at equal or higher confidence -- never stale news', () => {
  const w = world();
  const npc = person(w);
  const player = person(w);
  const subject = person(w);
  knows(w, { entityId: npc, subjectEntityId: subject, confidence: 50 });
  knows(w, { entityId: player, subjectEntityId: subject, confidence: 50 });

  assert.equal(dialogue.bestSharableFact(w, npc, player), null);
});

test('bestSharableFact never offers to tell the player about themselves', () => {
  const w = world();
  const npc = person(w);
  const player = person(w);
  knows(w, { entityId: npc, subjectEntityId: player, confidence: 90 });

  assert.equal(dialogue.bestSharableFact(w, npc, player), null);
});

test('bestSharableFact returns null, never a fabricated placeholder, when the npc genuinely knows nothing', () => {
  const w = world();
  const npc = person(w);
  const player = person(w);
  assert.equal(dialogue.bestSharableFact(w, npc, player), null);
});

// ---------------------------------------------------------------------
// interactWith
// ---------------------------------------------------------------------

test('interactWith refuses talking to yourself', () => {
  const w = world();
  const a = person(w);
  assert.throws(() => dialogue.interactWith(w, { playerEntityId: a, npcEntityId: a }), /cannot talk to yourself/);
});

test('interactWith refuses an entity that is not among the living', () => {
  const w = world();
  const a = person(w);
  assert.throws(
    () => dialogue.interactWith(w, { playerEntityId: a, npcEntityId: 999999 }),
    /not among the living/,
  );
});

test('interactWith assembles a real response from real occupation, mood, tone and a sharable fact, and bumps shared_history -- never trust', () => {
  const w = world();
  const player = person(w);
  const npc = person(w);
  const subject = person(w);
  knows(w, { entityId: npc, subjectEntityId: subject, confidence: 65, content: 'works nights at the warehouse' });
  w.employmentRecords.push({ entity_id: npc, employer_organization_id: 50, status: 'active', position: 'dockworker' });
  w.entityState.push({ entity_id: npc, stress_level: 10 });

  const relBefore = worldStore.getOrCreateRelationship(w, player, npc, 'social');
  const trustBefore = relBefore.trust;
  const sharedBefore = relBefore.shared_history;

  const result = dialogue.interactWith(w, { playerEntityId: player, npcEntityId: npc, tick: 50 });

  assert.equal(result.tone, 'neutral');
  assert.equal(result.occupation.position, 'dockworker');
  assert.equal(result.occupation.organizationId, 50);
  assert.ok(result.sharedFact);
  assert.equal(result.sharedFact.factContent, 'works nights at the warehouse');
  assert.equal(result.tick, 50);

  const relAfter = worldStore.getOrCreateRelationship(w, player, npc, 'social');
  assert.equal(relAfter.shared_history, sharedBefore + 1, 'a real interaction did not grow shared_history');
  assert.equal(relAfter.trust, trustBefore, 'an ordinary talk-to moved trust, which it is deliberately not supposed to do');
});

test('interactWith reports a real null occupation and sharedFact rather than a fabricated one when neither is real', () => {
  const w = world();
  const player = person(w);
  const npc = person(w);

  const result = dialogue.interactWith(w, { playerEntityId: player, npcEntityId: npc });

  assert.equal(result.occupation, null);
  assert.equal(result.sharedFact, null);
});

test('interactWith reports a real mood from behavior.getEntityState, matching that function\'s own computation exactly', () => {
  const w = world();
  const player = person(w);
  const npc = person(w);
  w.entityState.push({ entity_id: npc, stress_level: 5 });

  const result = dialogue.interactWith(w, { playerEntityId: player, npcEntityId: npc });
  const expected = behavior.getEntityState(w, npc);

  assert.equal(result.mood, expected.currentMood);
  assert.ok(result.mood, 'a real observed entity reported no mood at all');
});

test('interactWith reports a real null mood (not a fabricated default) for an entity never observed by behavior.js', () => {
  const w = world();
  const player = person(w);
  const npc = person(w);

  const result = dialogue.interactWith(w, { playerEntityId: player, npcEntityId: npc });
  assert.equal(result.mood, null);
});
