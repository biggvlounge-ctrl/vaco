// server/dialogue.js
//
// Universal NPC interaction — task #96, "procedural dialogue AI."
// Procedural, not generative: this engine has no LLM dependency and
// stays deterministic, so "AI" here means assembled from real,
// already-existing facts about the specific NPC a player talks to,
// never scripted lines and never an external text model. Any living
// NPC can be the subject — the "universal" half of the task — rather
// than only ones a mission or encounter specifically names.
//
// ---------------------------------------------------------------------
// What a response is built from, and why nothing here is invented
// ---------------------------------------------------------------------
// Tone reads the real pair relationship (`worldStore.
// getOrCreateRelationship`, `'social'`, the same generic type
// `attemptInsideJob`'s own loyalty check already uses between two
// otherwise-unrelated people). Mood reads `behavior.getEntityState`'s
// own real `currentMood`, already computed from stress and never
// recomputed a second way here. Occupation reads `economy.
// getEmployment` directly — the real position string a hire already
// writes, not a second vocabulary. An optional shared fact reads
// `worldStore.getKnowledge` on the SPECIFIC npc being talked to (what
// THIS person personally knows), the real per-row structure
// `gossip.js#askAround` already reads community-wide — scoped to one
// informant here rather than aggregated, and only surfaced if it is
// genuinely news: the player holds no real row for that subject, or
// holds one at lower confidence than this NPC's own.
//
// ---------------------------------------------------------------------
// A real mistake caught before it shipped — the twelfth standing
// rule's own shape
// ---------------------------------------------------------------------
// `getOrCreateRelationship`'s own real schema default is `trust: 50,
// conflict: 0`, not zero — so a first version of `toneFor` comparing
// `trust - conflict` against a margin above zero would have read
// EVERY brand-new stranger as "warm" (50 - 0 = 50), the exact
// recalibration mistake the twelfth standing rule already catalogues
// ("a modifier centred on zero recalibrates the world"). `toneFor`
// centres on the real default pair instead: `(trust - 50) - conflict`
// is 0 for two people who have never interacted, so a stranger reads
// as `neutral`, and only real relationship MOVEMENT away from that
// default reads as `warm`/`hostile`.
//
// ---------------------------------------------------------------------
// What this deliberately does not do
// ---------------------------------------------------------------------
// No trust/respect/loyalty change from talking alone — `meetings.js`'s
// own header already argues against inventing a persuasion/trust
// modifier for an ordinary exchange, and a casual, freely-repeatable
// "talk to" is exactly the case that argument protects against; a
// player could otherwise farm trust by talking to the same NPC on
// a loop. `shared_history` DOES move — task #122's own real fix grows
// it on any genuine two-person interaction, never only a self-
// relationship, and this is exactly that: two real people, a real
// exchange. The real "ask them a specific question and get a choice
// of real answers" layer (task #103) and "consult a knowledgeable org
// member" (task #104) are later, separate rounds that build on this
// one rather than being folded into it.

'use strict';

const worldStore = require('./worldStore.js');
const economy = require('./economy.js');
const behavior = require('./behavior.js');

//: Flagged interpretive. No document gives tone bands for an ordinary
//: conversation; centred on the real default pair (see header), the
//: twelfth standing rule's own discipline applied before shipping.
const TONE_WARM_MARGIN = 20;
const TONE_HOSTILE_MARGIN = 20;

function toneFor(rel) {
  const trust = Number(rel.trust) || 0;
  const conflict = Number(rel.conflict) || 0;
  const delta = (trust - 50) - conflict;
  if (delta >= TONE_WARM_MARGIN) return 'warm';
  if (delta <= -TONE_HOSTILE_MARGIN) return 'hostile';
  return 'neutral';
}

// The single most-confident real fact this SPECIFIC npc personally
// holds that is genuinely news to the player — never a blend, never
// a fabricated placeholder, the same "no invented willingness to
// gossip" restraint `gossip.js#askAround` already holds.
function bestSharableFact(worldState, npcEntityId, playerEntityId) {
  const held = worldStore.getKnowledge(worldState, npcEntityId);
  let best = null;
  for (const row of held) {
    if (row.subject_entity_id === playerEntityId) continue; // never "tell you about yourself"
    const confidence = Number(row.confidence_level) || 0;
    if (confidence <= 0) continue;
    const playerKnown = worldStore.getKnowledge(worldState, playerEntityId, row.subject_entity_id);
    const playerBest = playerKnown.reduce((m, r) => Math.max(m, Number(r.confidence_level) || 0), 0);
    if (confidence <= playerBest) continue; // not news to the player
    if (!best || confidence > (Number(best.confidence_level) || 0)) best = row;
  }
  return best;
}

function interactWith(worldState, options = {}) {
  const { playerEntityId, npcEntityId, tick = worldState.tick ?? 0 } = options;
  if (playerEntityId === npcEntityId) {
    throw new Error('interactWith: cannot talk to yourself.');
  }
  const npc = (worldState.npcs || []).find((n) => n.id === npcEntityId);
  if (!npc) throw new Error(`interactWith: entity ${npcEntityId} is not among the living.`);

  const rel = worldStore.getOrCreateRelationship(worldState, playerEntityId, npcEntityId, 'social');
  const tone = toneFor(rel);

  const employment = economy.getEmployment(worldState, npcEntityId);
  const state = behavior.getEntityState(worldState, npcEntityId);
  const sharedFact = bestSharableFact(worldState, npcEntityId, playerEntityId);

  worldStore.adjustRelationship(worldState, playerEntityId, npcEntityId, 'social', { shared_history: 1 });

  return {
    npcEntityId,
    tone,
    trust: Number(rel.trust) || 0,
    conflict: Number(rel.conflict) || 0,
    mood: state?.currentMood ?? null,
    occupation: employment
      ? { position: employment.position, organizationId: employment.employer_organization_id }
      : null,
    sharedFact: sharedFact
      ? {
        subjectEntityId: sharedFact.subject_entity_id,
        factType: sharedFact.fact_type,
        factContent: sharedFact.fact_content,
        confidence: Number(sharedFact.confidence_level) || 0,
      }
      : null,
    tick,
  };
}

module.exports = {
  TONE_WARM_MARGIN,
  TONE_HOSTILE_MARGIN,
  toneFor,
  bestSharableFact,
  interactWith,
};
