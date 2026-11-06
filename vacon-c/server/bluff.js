// server/bluff.js
//
// Bluffing and its exposure — by direct instruction: "a lot of the
// initial power will come from people thinking there are guns and
// ammunition... people will try to fake it. But a lot of people will
// realize the con, and that's when things will change."
//
// ---------------------------------------------------------------------
// The real divergence this models, and the two real mechanisms it
// reuses rather than duplicates
// ---------------------------------------------------------------------
// `weapons.isFunctioningFirearm` is the real, VERIFIED ground truth for
// "is this person actually armed" (equipped gun AND a held round of its
// own real ammunition — see that file's own header). A bluff is exactly
// the gap between that real fact and what somebody else BELIEVES about
// it, and this file never touches or duplicates that function's own
// question; it only ever reads its answer.
//
// What creates the belief is not a new persuasion system. `perception
// .receivedConfidence(worldState, entityId, broadcast)` already answers
// "the confidence THIS person ends up holding a fact at, given the
// confidence it was broadcast with" — built for `tick.js`'s scarcity
// broadcasts and `politics.js`'s election results, and it is exactly
// the right question for a bluff too: `intimidate` below treats the
// bluffer's own real persuasiveness as the broadcast confidence and
// lets `perception.js`'s own calibrated math (never re-derived here)
// decide how much of it the target actually takes in. `meetings.js`'s
// own header already argues against inventing an unmeasured persuasion
// modifier for exactly this reason, and this file holds that line by
// reusing the one real modifier that already exists instead of adding
// a second, disagreeing one.
//
// ---------------------------------------------------------------------
// `relationships.fear` — real, already-written, and already carrying
// the exact directed meaning this needs
// ---------------------------------------------------------------------
// `keys.js#resolveFear` already writes "entity's fear of a named source
// entity" onto this real column, `relationship_type: 'social'`, the
// moment a source entity is known (its own comment: "the relationship
// write-back targets that entity's `fear` column directly instead of a
// self-relationship"). That is the one real precedent for exactly what
// a bluff needs to raise, so `raiseFear`/`lowerFear` below follow it —
// same field, same relationship type, same clamp discipline `heat.js`'s
// `raiseHeat` already established for a different relationship
// dimension on the identical pair shape.
//
// **A real, already-accepted limitation carried over, not newly
// introduced here**: `fear`, like `influence`/`trust`/`respect`, is a
// SINGLE SHARED VALUE per pair (`influence.js`'s own header states this
// for influence; the schema gives `fear` no second column either). So
// "how much A fears B" and "how much B fears A" are the same stored
// number. That is a real simplification this engine already lives with
// everywhere else a relationship has one field for what is, in life,
// two directions — not a new one invented for bluffing.
//
// ---------------------------------------------------------------------
// Creating a bluff, and calling one
// ---------------------------------------------------------------------
// `intimidate` requires a real, equipped firearm (`weapons
// .equippedFirearm`) — brandishing something, loaded or not, is the
// real act; an unarmed person has nothing to brandish and this function
// refuses them outright rather than inventing a bare-handed threat.
// Whether the gun is actually loaded is never asked here — that is the
// whole point of a bluff, and `isFunctioningFirearm` is reserved for
// the moment the bluff is actually called.
//
// `callBluff` is that moment, and it is deterministic, not a second
// draw: the real fact (`isFunctioningFirearm`) either holds or it does
// not, and the two branches are real and asymmetric, exactly as asked
// ("a lot of people will realize the con, and that's when things will
// change" implies a real cost to being exposed — and calling a REAL
// threat's bluff should plausibly go badly, not just fail quietly):
//
//   - **Not actually armed**: the bluff is exposed. The challenger's
//     own standing fear of the bluffer resets (they no longer find the
//     threat credible), and the bluffer's real, social standing with
//     the challenger takes a real hit — `influence.lowerInfluence`, the
//     one real "this specific relationship's standing fell" mechanism
//     this engine already has, at `influence.INFLUENCE_DELTA`, the same
//     magnitude every other single real social event here already
//     uses, not a second number invented for this file.
//   - **Actually armed**: there was no bluff, and the challenge becomes
//     a real, live confrontation — `crime.recordEscalation`, the exact
//     real mechanism `tick.js#runSecurityPhase` already uses for an
//     armed escalation between two people, reused rather than building
//     a second combat outcome that would disagree with it.
//
// ---------------------------------------------------------------------
// What this file deliberately does NOT do
// ---------------------------------------------------------------------
// `assessThreat` is read-only and reports ONLY the real standing `fear`
// value already on record — never `weapons.isFunctioningFirearm`'s
// ground truth. Revealing the real answer there would collapse the
// entire mechanic: a player could always check first and the bluff
// would never be a bluff. `assess-takeover`'s own precedent is "look
// before you commit" at the level of odds, never at the level of the
// hidden roll itself, and this follows the identical line.
//
// No new random draw is introduced. `intimidate`'s outcome is fully
// determined by real traits run through `perception.js`'s own already-
// calibrated math; `callBluff`'s outcome is fully determined by the
// real, already-written ground truth. Per the seventeenth standing
// rule's four-attempt case study, a threshold invented and asserted
// without that kind of measurement is exactly the mistake to avoid, so
// none is added here — this file introduces zero new probabilities.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');
const weapons = require('./weapons.js');
const perception = require('./perception.js');
const worldStore = require('./worldStore.js');
const influence = require('./influence.js');
const crime = require('./crime.js');

// The real traits a bluff's persuasiveness is read from — `Deception`
// (criminal) alongside `Charisma`/`Persuasion` (social), the same two
// families `meetings.js` and `crime.js#advanceFriction`/`policing
// .evasionOf` already read for "how convincingly this person presents
// something that is not quite what it looks like." Centred on 50, the
// same discipline `perception.perceptionOf` already holds, so somebody
// with no generated trait rows reads as ordinary rather than as having
// zero presence.
function persuasivenessOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const traits = live?.traits;
  const deception = Number(traits?.criminal?.Deception ?? 50);
  const charisma = Number(traits?.social?.Charisma ?? 50);
  const persuasion = Number(traits?.social?.Persuasion ?? 50);
  const values = [deception, charisma, persuasion].filter((v) => Number.isFinite(v));
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// The one real shared number the pair (a, b) already carries — see
// this file's own header on why it is shared, not directed. 0 when no
// relationship has ever been created, the same "never noticed" default
// `heat.js#heatWith` already uses for its own relationship dimension.
function fearOf(worldState, entityAId, entityBId) {
  const rel = worldStore.findRelationship(worldState, entityAId, entityBId);
  if (!rel) return 0;
  return Number(rel.fear) || 0;
}

// Reuses `keys.js#resolveFear`'s own threshold and magnitude (fear
// above 50 moves the relationship by fear/10) rather than inventing a
// second figure for the identical underlying quantity.
const FEAR_BELIEF_FLOOR = 50;
const FEAR_DELTA_DIVISOR = 10;

function clamp0to100(x) {
  return Math.max(0, Math.min(100, x));
}

function raiseFear(worldState, entityAId, entityBId, delta) {
  const rel = worldStore.getOrCreateRelationship(worldState, entityAId, entityBId, 'social');
  rel.fear = clamp0to100(Number(rel.fear) + delta);
  return rel;
}

function lowerFear(worldState, entityAId, entityBId, delta) {
  return raiseFear(worldState, entityAId, entityBId, -Math.abs(delta));
}

// ---------------------------------------------------------------------
// Create a bluff (or a real threat — this function cannot tell the
// difference, which is the entire point)
// ---------------------------------------------------------------------
function intimidate(worldState, { actorId, targetId, tick = worldState.tick ?? 0 }) {
  if (actorId === targetId) {
    return { intimidated: false, reason: 'cannot intimidate yourself' };
  }
  const gun = weapons.equippedFirearm(worldState, actorId);
  if (!gun) {
    return { intimidated: false, reason: 'nothing equipped to brandish' };
  }

  const broadcastConfidence = persuasivenessOf(worldState, actorId) / 100;
  const believed = perception.receivedConfidence(worldState, targetId, broadcastConfidence) ?? 0;
  const believedPct = believed * 100;
  const fearDelta = believedPct > FEAR_BELIEF_FLOOR
    ? Math.round(believedPct / FEAR_DELTA_DIVISOR)
    : 0;

  if (fearDelta > 0) raiseFear(worldState, targetId, actorId, fearDelta);

  return {
    intimidated: true, gun, believedThreat: believed, fearDelta, tick,
  };
}

// ---------------------------------------------------------------------
// Look before committing — see this file's own header for why ground
// truth is never revealed here.
// ---------------------------------------------------------------------
function assessThreat(worldState, { entityId, targetId }) {
  return { fear: fearOf(worldState, entityId, targetId) };
}

// ---------------------------------------------------------------------
// Call it. Deterministic, real, and asymmetric both ways.
// ---------------------------------------------------------------------
function callBluff(worldState, { challengerId, targetId, tick = worldState.tick ?? 0 }) {
  const currentFear = fearOf(worldState, challengerId, targetId);
  if (currentFear <= 0) {
    return { called: false, reason: 'no standing fear of this entity to call' };
  }

  const reallyArmed = weapons.isFunctioningFirearm(worldState, targetId);

  if (reallyArmed) {
    const incident = crime.recordEscalation(worldState, {
      perpetratorId: targetId,
      victimId: challengerId,
      tick,
      responseLevel: currentFear,
    });
    return { called: true, bluffExposed: false, realThreat: true, incident };
  }

  lowerFear(worldState, challengerId, targetId, currentFear);
  const relation = influence.lowerInfluence(worldState, targetId, challengerId, influence.INFLUENCE_DELTA);
  return { called: true, bluffExposed: true, realThreat: false, relation };
}

module.exports = {
  FEAR_BELIEF_FLOOR,
  FEAR_DELTA_DIVISOR,
  persuasivenessOf,
  fearOf,
  raiseFear,
  lowerFear,
  intimidate,
  assessThreat,
  callBluff,
};
