// server/perception.js
//
// How reliably somebody takes a fact in.
//
// **The `special` family's real home**, arrived at after a wrong one.
//
// Artifact Sensitivity, Signal Perception and Anomaly Resistance were
// generated on every NPC in every world this engine has ever run and
// read by nothing. The obvious place to wire them looked like
// `missions.js` — artifacts are the only strange thing in the engine,
// so gate accepting an artifact mission on being able to sense it.
//
// That was wrong, and the test that caught it is worth recording:
// **`generateMission` requires an artifact.** `missions.artifact_id` is
// nullable in the schema, but the engine refuses to create a mission
// without one, so "artifact missions" is not a subset of missions — it
// is all of them. A sensitivity floor on accepting an artifact mission
// is therefore a floor on the engine's ONLY player verb, and somebody
// whose `special` traits rolled low at generation could never accept
// any mission, ever, with no mechanism anywhere that could raise them.
// A quarter of a measured population at the first threshold tried, 2.5%
// at the lowest defensible one — and locking 2.5% of players out of the
// whole game permanently on a hidden roll is not better design than
// locking out 25%, just quieter.
//
// The alternative that looked principled — gate on how strange the
// artifact is — fails standing rule 6: `artifacts.rarity`,
// `condition` and `energy_class` are free TEXT that nothing sets and
// no document enumerates, so a threshold reading them would never fire
// on a real world and would look wired while being inert.
//
// ---------------------------------------------------------------------
// What is actually here
//
// `tick.js` broadcasts a scarcity crossing to every NPC as an
// `entity_knowledge` row at a flat `confidence_level: 0.9`, and
// `politics.js` does the same for an election result. Identical for
// everybody — the sharpest person in the settlement and the one who
// notices nothing take the news in exactly as well.
//
// That flat number is what this module varies, and it is the right
// place for three reasons:
//
//   - It is what the traits say they are. Signal Perception is how
//     well a signal is picked up.
//   - It changes real outcomes with no new mechanism. `knowledgeCharge`
//     in `keys.js` weights every knowledge row by its
//     `confidence_level`, so this feeds ScarcityResponse, Fear and
//     Trust, and through those the `decision_log` and migration.
//   - It vetoes nobody. A person who perceives poorly acts on worse
//     information; they are never barred from acting.
//
// `distortion_level` is the other half and is deliberately left null:
// nothing reads it, and writing a field nothing reads would be the
// same mistake in the other direction.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');

//: How much somebody's own `special` traits move how firmly they hold
//: what they are told. At 0.25, a person at 100 across the family takes
//: a broadcast in a quarter more firmly than an ordinary person, and
//: one at 0 a quarter less.
//:
//: Centred on 50, so an ordinary person receives news at exactly the
//: confidence the broadcaster stated and adding this changed no world's
//: calibration. Flagged interpretive: no document sets a figure.
const PERCEPTION_SWING = 0.25;

// What somebody can pick up, 0..100, where 50 is ordinary.
//
// 50 when there are no trait rows to read — unknown is not a zero, and
// a zero here would say "perceives nothing" about an entity whose
// traits simply have not been generated.
function perceptionOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const special = live?.traits?.special;
  if (!special) return 50;
  // `?? 50` per value rather than `|| 50`: a real 0 is somebody who
  // genuinely notices nothing, and `||` would promote them to average.
  const scores = Object.values(special).map(Number).filter((v) => Number.isFinite(v));
  if (scores.length === 0) return 50;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// The confidence THIS person ends up holding a fact at, given the
// confidence it was broadcast with.
//
// Clamped to [0, 1] because `entity_knowledge.confidence_level` is a
// probability and `knowledgeCharge` sums it directly.
function receivedConfidence(worldState, entityId, broadcast) {
  if (broadcast === undefined || broadcast === null) return null;
  const perception = perceptionOf(worldState, entityId);
  const scaled = Number(broadcast) * (1 + ((perception - 50) / 50) * PERCEPTION_SWING);
  return Math.max(0, Math.min(1, scaled));
}

module.exports = {
  PERCEPTION_SWING,
  perceptionOf,
  receivedConfidence,
};
