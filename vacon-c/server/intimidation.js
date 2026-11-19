// server/intimidation.js
//
// Witness intimidation — by direct instruction: "witnesses, stakeouts,
// and safe-cracking/intimidation variance."
//
// ---------------------------------------------------------------------
// Two real traits, generated on every NPC, read by nothing
// ---------------------------------------------------------------------
// `traits.js`'s `reputation` family has carried `Fear Factor` and
// `Notoriety` since it was written — checked directly (`grep -rn
// "'Fear Factor'\|'Notoriety'" server/*.js` before this returned only
// their own definition) — the eleventh standing rule's own shape, two
// columns over. `Fear Factor` is exactly "how intimidating this person
// reads to somebody else"; `Notoriety` is exactly "how known this
// person already is for this kind of thing" — an amplifier on the
// same threat, not a second, disagreeing mechanic.
//
// ---------------------------------------------------------------------
// The real counter-term, and why it is the witness's, not the
// intimidator's
// ---------------------------------------------------------------------
// `emotional.Resilience` is the real trait this engine already reads
// elsewhere (`behavior.js#loadMultiplier`) as how hard somebody is to
// rattle. A frightening, notorious person intimidating a resilient
// witness is a real, different fact from the same person intimidating
// a fragile one, and this is the one real place that distinction
// belongs.
//
// Centred on an average person vs. an average person — the twelfth
// standing rule's own discipline: `intimidationChanceFor(50, 50, 50)`
// must return exactly 0.5, so an ordinary intimidator against an
// ordinary witness is a coin flip, never a certainty either way.
// Weights measured against a real 180-NPC generated population before
// being chosen: Fear Factor/Notoriety/Resilience each run min ~10,
// median ~50-56, p90 82-91 — an ordinary spread around 50, so no
// recalibration of the whole population was needed the way the
// twelfth standing rule's own case study found necessary elsewhere.
//
// ---------------------------------------------------------------------
// What a successful intimidation actually does — suppresses
// confidence, never erases ground truth
// ---------------------------------------------------------------------
// `crime.recordCrime`'s own witness rows (task #35) are the real thing
// this reaches: `confidence_level` is reduced by a real, bounded
// fraction (`INTIMIDATION_SUPPRESSION`) rather than zeroed — a
// frightened witness is less willing to assert what they know, not
// suddenly ignorant of it. `distortion_level` moves with it, the same
// `1 - confidence` relationship `crime.js` already holds. The row is
// never deleted: this engine's own standing discipline treats a
// knowledge row as a point-in-time record, and erasing one would lose
// real history rather than honestly describing what intimidation does
// to it.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');
const { seededDraw } = require('./seeded.js');
const worldStore = require('./worldStore.js');

const INTIMIDATION_FEAR_WEIGHT = 0.5;
const INTIMIDATION_NOTORIETY_WEIGHT = 0.3;
const INTIMIDATION_RESILIENCE_WEIGHT = 0.4;

const INTIMIDATION_SUPPRESSION = 0.7;

const INTIMIDATION_STRESS = 10;

function reputationTrait(worldState, entityId, name) {
  const live = getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.reputation?.[name] ?? 50);
  return Number.isFinite(value) ? value : 50;
}

function resilienceOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.emotional?.Resilience ?? 50);
  return Number.isFinite(value) ? value : 50;
}

function intimidationChanceFor(worldState, intimidatorId, witnessId) {
  const fear = reputationTrait(worldState, intimidatorId, 'Fear Factor');
  const notoriety = reputationTrait(worldState, intimidatorId, 'Notoriety');
  const resilience = resilienceOf(worldState, witnessId);
  const chance = 0.5
    + ((fear - 50) / 100) * INTIMIDATION_FEAR_WEIGHT
    + ((notoriety - 50) / 100) * INTIMIDATION_NOTORIETY_WEIGHT
    - ((resilience - 50) / 100) * INTIMIDATION_RESILIENCE_WEIGHT;
  return Math.max(0, Math.min(1, chance));
}

function intimidateWitness(worldState, options = {}) {
  const {
    intimidatorId, witnessId, aboutPerpetratorId, tick = worldState.tick ?? 0,
  } = options;
  if (intimidatorId == null || witnessId == null || aboutPerpetratorId == null) {
    throw new Error('intimidateWitness requires intimidatorId, witnessId and aboutPerpetratorId.');
  }
  if (Number(intimidatorId) === Number(witnessId)) {
    throw new Error('intimidateWitness: an entity cannot intimidate itself.');
  }

  const chance = intimidationChanceFor(worldState, intimidatorId, witnessId);
  const succeeded = seededDraw([
    worldState.seed ?? 'world', 'intimidate-witness', intimidatorId, witnessId, aboutPerpetratorId, tick,
  ]) < chance;

  // **Real, immediate stress either way** — being confronted is itself
  // the event, whether or not it changes what the witness is willing
  // to say.
  // eslint-disable-next-line global-require
  const behavior = require('./behavior.js');
  behavior.applyStress(worldState, Number(witnessId), INTIMIDATION_STRESS);
  worldStore.addMemory(worldState, {
    entityId: Number(witnessId),
    tick,
    memoryType: 'negative',
    category: 'conflict',
    description: `Was intimidated by entity ${intimidatorId}${succeeded ? '' : ', and did not back down'}.`,
    importance: succeeded ? 60 : 40,
    emotionLevel: succeeded ? -30 : -15,
    relatedEntityIds: [Number(intimidatorId)],
  });

  if (!succeeded) {
    return { succeeded: false, chance, suppressed: [] };
  }

  const suppressed = worldStore.getKnowledge(worldState, Number(witnessId), Number(aboutPerpetratorId));
  for (const row of suppressed) {
    row.confidence_level = Math.round(
      Number(row.confidence_level ?? 0) * (1 - INTIMIDATION_SUPPRESSION) * 10000,
    ) / 10000;
    row.distortion_level = Math.round((1 - row.confidence_level) * 10000) / 10000;
  }

  return { succeeded: true, chance, suppressed };
}

module.exports = {
  INTIMIDATION_FEAR_WEIGHT,
  INTIMIDATION_NOTORIETY_WEIGHT,
  INTIMIDATION_RESILIENCE_WEIGHT,
  INTIMIDATION_SUPPRESSION,
  INTIMIDATION_STRESS,
  intimidationChanceFor,
  intimidateWitness,
};
