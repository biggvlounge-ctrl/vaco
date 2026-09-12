// server/beliefs.js
//
// What people believe, and how strongly — the `beliefs` table.
//
// **Why this exists now rather than as its own system.** Building
// politics left one loop deliberately open, and this closes it.
// `public_opinion`'s schema comment says approval is a
// "Rollup from **beliefs**/entity_knowledge on a topic". Beliefs was a
// dead table at the time, so `computeApproval` read live traits
// instead and its own header recorded the cost: **approval did not
// depend on what a law said**, because knowledge only establishes that
// somebody has heard of a government, never whether they like it.
//
// The note there said that when a source document specified law
// favourability, that is where it would go — and then observed that
// adding a `valence` column to `entity_knowledge` would be the way.
// That was the wrong conclusion: **the schema already had the field.**
// `beliefs.strength` is a valenced position on a named subject, which
// is exactly what was missing. No extension needed; the table was
// simply unbuilt.
//
// ---------------------------------------------------------------------
// What this does NOT invent, and the line it will not cross
//
// **Nothing here decides whether a law is good.** `enactLaw` takes an
// optional caller-declared `favourability`; with none, a law spreads
// knowledge and shifts no belief, exactly as before. The mechanism is
// built; the judgement stays with whoever has a reason for it. Deciding
// that a `criminal` law pleases one NPC and offends another is game
// design no source document specifies, and `actions.js` already
// declined that line for the same reason.
//
// **`values_db` is deliberately still untouched**, and it is the other
// half of this schema section. It has no column defaults and no source
// document gives value distributions, priorities or influence weights —
// so a generator for it would be fifteen invented numbers per person.
// CRUD that nothing calls is not progress either: it would turn a
// visibly dead table into a table that looks alive and holds nothing,
// which is harder to notice. It stays `schemaOnly` in
// `urbanSystems.js` until something needs it.

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextBeliefId = 1;

// Verbatim from `beliefs.belief_type`'s own enumeration comment.
const BELIEF_TYPES = [
  'religious', 'philosophical', 'political', 'scientific', 'cultural', 'personal',
];

//: Flagged interpretive: the schema gives `strength` no bounds and no
//: default. 0..100 matches every other strength-like column in this
//: engine (trait values, community health, approval), so a belief
//: strength reads on the same scale as everything else rather than
//: needing its own mental conversion.
const MIN_STRENGTH = 0;
const MAX_STRENGTH = 100;

//: **The neutral point, and it is load-bearing.** A belief at 50 is
//: "no view either way", which is what lets an absent belief and an
//: indifferent one mean the same thing to a rollup. Anything else and
//: the population's default position would be silently for or against.
const NEUTRAL_STRENGTH = 50;

function clampStrength(value) {
  return Math.max(MIN_STRENGTH, Math.min(MAX_STRENGTH, value));
}

function assertType(beliefType) {
  if (!BELIEF_TYPES.includes(beliefType)) {
    throw new Error(`beliefType must be one of ${BELIEF_TYPES.join(', ')}`);
  }
}

// -- reading ------------------------------------------------------------

function getBeliefs(worldState, entityId, options = {}) {
  const { beliefType = null } = options;
  return worldState.beliefs.filter(
    (b) => b.entity_id === entityId && (beliefType === null || b.belief_type === beliefType),
  );
}

function findBelief(worldState, entityId, beliefName) {
  return worldState.beliefs.find(
    (b) => b.entity_id === entityId && b.belief_name === beliefName,
  ) || null;
}

// **Returns null for "has no view", not the neutral number.** A caller
// that wants to treat absence as neutral can, and one that wants to
// exclude the uninformed can too — which is the whole basis of the
// spread floor in `politics.js`. Collapsing the two here would take
// that choice away from every caller at once, and it is the same
// unknown-is-not-zero distinction `moodFor()` got wrong.
function beliefStrength(worldState, entityId, beliefName) {
  const belief = findBelief(worldState, entityId, beliefName);
  return belief ? belief.strength : null;
}

// -- writing ------------------------------------------------------------

// One belief per (entity, name). A second row for the same named
// belief would be two simultaneous positions on one question, and a
// rollup averaging them would report a person as ambivalent when they
// are not.
function adoptBelief(worldState, options = {}) {
  const {
    entityId, beliefType, beliefName,
    strength = NEUTRAL_STRENGTH, tick = worldState.tick ?? 0,
  } = options;

  if (!entityId) throw new Error('adoptBelief requires an entityId');
  if (!beliefName) throw new Error('adoptBelief requires a beliefName');
  assertType(beliefType);
  if (!Number.isFinite(strength)) {
    throw new Error('adoptBelief requires a finite strength');
  }

  const existing = findBelief(worldState, entityId, beliefName);
  if (existing) {
    throw new Error(
      `adoptBelief: entity ${entityId} already holds "${beliefName}" `
      + `at strength ${existing.strength}. Use shiftBelief to change it.`,
    );
  }

  const belief = {
    id: nextBeliefId++,
    entity_id: entityId,
    belief_type: beliefType,
    belief_name: beliefName,
    strength: clampStrength(strength),
    tick,
  };
  worldState.beliefs.push(belief);
  return belief;
}

// Moves a belief by a delta, adopting it at neutral first if the person
// had no view. **Beliefs change rather than being replaced**, so a
// strongly held position does not flip on one event — the delta is
// applied to what was there, and the result is clamped.
function shiftBelief(worldState, options = {}) {
  const {
    entityId, beliefType, beliefName, delta, tick = worldState.tick ?? 0,
  } = options;

  if (!Number.isFinite(delta)) throw new Error('shiftBelief requires a finite delta');
  assertType(beliefType);

  let belief = findBelief(worldState, entityId, beliefName);
  if (!belief) {
    belief = adoptBelief(worldState, {
      entityId, beliefType, beliefName, strength: NEUTRAL_STRENGTH, tick,
    });
  }
  belief.strength = clampStrength(belief.strength + delta);
  belief.tick = tick;
  return belief;
}

// Everyone in the world moves on one named belief. Used by
// `politics.js` when a law is enacted with a declared favourability —
// the population's view of the government shifts, and how far is the
// caller's number rather than this module's opinion.
function shiftPopulationBelief(worldState, options = {}) {
  const {
    beliefType, beliefName, delta, tick = worldState.tick ?? 0,
  } = options;
  const shifted = [];
  for (const npc of worldState.npcs) {
    shifted.push(shiftBelief(worldState, {
      entityId: npc.id, beliefType, beliefName, delta, tick,
    }));
  }
  return shifted;
}

// -- rollup -------------------------------------------------------------

// The mean strength of a named belief across everyone who holds it,
// with the share of the population that does.
//
// Null when nobody holds it, for the same reason `beliefStrength`
// returns null: a rollup over nothing is unknown, and reporting it as
// 0 would mean unanimous opposition.
function summariseBelief(worldState, beliefName) {
  const held = worldState.beliefs.filter((b) => b.belief_name === beliefName);
  const people = worldState.npcs.length;
  if (held.length === 0) {
    return { beliefName, mean: null, holders: 0, share: people === 0 ? null : 0 };
  }
  const mean = held.reduce((a, b) => a + Number(b.strength), 0) / held.length;
  return {
    beliefName,
    mean: Math.round(mean * 100) / 100,
    holders: held.length,
    share: people === 0 ? null : Math.round((held.length / people) * 10000) / 10000,
  };
}

function reseedIds(worldState) {
  nextBeliefId = nextAfter(worldState.beliefs);
  return { nextBeliefId };
}

module.exports = {
  BELIEF_TYPES,
  MIN_STRENGTH,
  MAX_STRENGTH,
  NEUTRAL_STRENGTH,
  getBeliefs,
  findBelief,
  beliefStrength,
  adoptBelief,
  shiftBelief,
  shiftPopulationBelief,
  summariseBelief,
  reseedIds,
};
