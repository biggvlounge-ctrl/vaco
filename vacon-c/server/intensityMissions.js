// server/intensityMissions.js
//
// "I would like how they go into their mission modes. I would like
// ours to naturally go into mission modes. When there's a certain
// intenseness in the game, it automatically goes into mission mode" —
// by direct instruction (task #208), comparing VACON-C against GTA's
// own wanted-level-style escalation into a directed encounter.
//
// ---------------------------------------------------------------------
// The real "intensity," found rather than invented
// ---------------------------------------------------------------------
//
// `crime.dangerByCommunity(worldState, { tick })` already exists and
// is already read exactly this way in three other places —
// `recruitment.js`, `youthPrograms.js`, `leagues.js` — each as
// `someRealRate * dangerScore`. It is a real, bounded (0..1) measure
// of how dangerous a community has actually BEEN over its own recent
// window (`DANGER_WINDOW_TICKS`), shrunk against the world's own rate
// rather than a raw small-sample count — not a decorative "chaos bar,"
// the same number that already decides how hard gangs recruit,
// whether youth programs lose kids to the street, and whether a
// combat league forms. Reusing it here rather than inventing a fourth,
// disagreeing "intensity" score is the third standing rule (CLAUDE.md)
// applied to a player-facing feature instead of an NPC one.
//
// `missionTriggers.MISSION_TRIGGER_CHANCE` (0.1) is reused as the base
// per-tick draw rather than a new constant — it is already the real,
// MEASURED "neither instant nor decorative" rate that file's own
// header worked out (calls-to-first-trigger over 200 draws). Scaling
// it by dangerScore gives the same "chaos-driven rate" shape every
// other danger-gated mechanism in this engine already has, with no
// new number invented anywhere in this file.
//
// ---------------------------------------------------------------------
// What this deliberately does NOT touch
// ---------------------------------------------------------------------
//
// `tick.js#runSecurityPhase`'s own AGGRESSION_FLASHPOINT_RATE /
// `keys.resolveAggression` pipeline is a FOUR-ATTEMPT, measured,
// calibrated mechanism (standing rule 17) that already auto-resolves
// a real confrontation the instant it fires. This file does not
// intercept, gate, or duplicate any part of it — rule 17's own lesson
// is "when a threshold reads several inputs, measure the joint
// population before touching it," and this round did not re-measure
// that system, so it stays exactly as calibrated.
//
// Instead, this is a SEPARATE, additive real trigger scoped to a
// player's own standing danger, not to any one relationship's
// conflict — the GTA-style read of "intensity": the neighborhood
// itself has gotten dangerous enough that something is about to
// happen to YOU specifically, not that a specific fight already
// occurred between two named NPCs. A mission generated here is
// something the player can actually play through (accept, approach,
// resolve) through the real mission state machine `missions.js`
// already has — unlike the flashpoint pipeline, which has no player
// input at all by design.
//
// ---------------------------------------------------------------------
// Why this needs a real place, and why a player with none is skipped
// ---------------------------------------------------------------------
//
// `missions.generateMission` requires a real `artifactId` or a real
// `locationId` — "a mission is never about nothing" (`missions.js`'s
// own comment). `npc.home_property_id` is the one real place this
// engine already associates with a person (`worldgen.js` sets it;
// `mortality.js` already reads it for a death's location). A
// player-linked NPC with no home — a real, honest state this engine
// allows — gets no intensity mission rather than a fabricated
// location, the same "no real place to attach this to" refusal
// `missionTriggers.js`'s own header already documents for
// `practise-habit`.
//
// ---------------------------------------------------------------------
// The one new field, declared the way every other in-memory-only
// field in this registry already is
// ---------------------------------------------------------------------
//
// `mission.trigger_source` is set to `'intensity'` so a client layer
// can tell an ambient job-board pick (`missionTriggers.js`, no field
// set, reads `undefined`) apart from a real auto-triggered encounter
// and open "mission mode" for the latter without the player having to
// browse for it — the literal feature asked for. No schema column
// exists for this (`VACANCY_POSTGRESQL_SCHEMA.sql`'s `missions` table
// has none), the same documented, in-memory-only posture
// `issuing_organization_id`/`issued_by_entity_id` already carry on
// this exact table for the identical reason.

'use strict';

const crime = require('./crime.js');
const missions = require('./missions.js');
const missionTriggers = require('./missionTriggers.js');
const seeded = require('./seeded.js');

// **Mutation-checked and found non-load-bearing, the fourth time this
// exact pattern has turned up (recruitment.js, youthPrograms.js,
// leagues.js already document it once each).** `danger.get(...)`
// returns `0`, never `undefined`, for a community with real
// population and genuinely zero recent incidents — `dangerByCommunity`
// only omits a community entirely when population itself is 0.
// Removing the early skip below and rerunning this file's own test
// suite still passed every test unchanged, because `MISSION_TRIGGER_
// CHANCE * 0` is `0` and a uniform `[0,1)` draw is "`>= 0`" on every
// call regardless. Kept anyway as the same honest early-exit every
// sibling module keeps, not because it changes behavior.
const INTENSITY_SOURCE = 'intensity';

function describeIntensity(dangerScore, place) {
  if (dangerScore >= 0.75) return `Things have boiled over near ${place} — mission mode engaged.`;
  if (dangerScore >= 0.5) return `It's gotten dangerous near ${place} fast — mission mode engaged.`;
  return `Tension near ${place} just tipped into something real — mission mode engaged.`;
}

// Runs once a tick, over every real Citizen/Leader-mode player this
// world actually has — never over NPCs in general, because this is a
// player-facing transition, not an NPC behavior. Returns the
// generated mission events (same `candidateEvents.push(...)` shape
// `leagues.runLeagues`/`recruitment.runChaosRecruitment` already use),
// never writes directly to `worldState.events`.
function runIntensityMissions(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const events = [];
  if (!(worldState.players || []).length) return events;

  const danger = crime.dangerByCommunity(worldState, { tick });

  for (const player of worldState.players) {
    const npc = (worldState.npcs || []).find((n) => n.id === player.linked_entity_id);
    if (!npc || npc.status === 'deceased') continue;
    if (npc.home_property_id == null || npc.communityId == null) continue;

    const dangerScore = danger.get(npc.communityId);
    if (!dangerScore) continue;

    if (missionTriggers.hasOpenMissionAt(worldState, npc.home_property_id)) continue;

    const chance = missionTriggers.MISSION_TRIGGER_CHANCE * dangerScore;
    const roll = seeded.seededDraw(['intensity-mission', tick, player.id]);
    if (roll >= chance) continue;

    const property = (worldState.properties || []).find((p) => p.id === npc.home_property_id);
    const place = property?.name ?? `location ${npc.home_property_id}`;

    const mission = missions.generateMission(worldState, {
      locationId: npc.home_property_id,
      objective: describeIntensity(dangerScore, place),
    });
    mission.trigger_source = INTENSITY_SOURCE;

    events.push({
      type: 'mission_mode_triggered', severity: dangerScore >= 0.75 ? 'high' : 'medium',
      note: mission.objective,
      tick,
      affected_entity_ids: [npc.id],
      global_effects: { missionId: mission.id, dangerScore },
    });
  }

  return events;
}

module.exports = {
  INTENSITY_SOURCE, describeIntensity, runIntensityMissions,
};
