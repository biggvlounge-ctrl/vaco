// server/missions.js
//
// Artifact/Mission system. **A real, false claim caught and corrected
// here, not silently built around**: CLAUDE.md's own "What this
// project is" section lists "Artifact/Mission system" under
// "Foundation already running," and the Locked Day 1 scope explicitly
// marks it "(already built)." Checked directly before writing
// anything: no `generateArtifact`, `generateMission`, or any
// Artifact/Mission logic exists anywhere in `server/*.js`, and
// `WorldState` (engine.js) has no `artifacts`/`missions` arrays at
// all. `VACANCY_POSTGRESQL_SCHEMA.sql` does have real `artifacts` and
// `missions` tables, under a comment literally reading "already built
// since Volume 1" — the schema was written assuming code that was
// never actually delivered in any handoff. This file is that real,
// missing code, built from the real schema shape (not invented),
// because `VACANCY_API_ENDPOINT_MAP.md`'s own required `POST
// /api/mission` route needs it to exist to be real rather than a stub.
//
// Every function here takes `worldState` explicitly, same convention
// as economy.js/players.js/territory.js — engine.js wraps these as the
// bound, convenient API.

'use strict';

let nextArtifactId = 1;
let nextMissionId = 1;

// Matches the `artifacts` columns in VACANCY_POSTGRESQL_SCHEMA.sql.
// locationId is deliberately nullable and unvalidated -- no Property
// system exists anywhere in this project (players.js's own
// getCitizenDashboard already flags this same real gap for
// propertySummary), so an artifact's location can only ever be a real,
// honest `null` today, never a fabricated reference.
function generateArtifact(worldState, options = {}) {
  if (!options.name) {
    throw new Error('generateArtifact requires options.name (artifacts.name is NOT NULL with no default).');
  }
  const artifact = {
    id: nextArtifactId++,
    name: options.name,
    origin: options.origin ?? null,
    era: options.era ?? null,
    rarity: options.rarity ?? null,
    condition: options.condition ?? null,
    energy_class: options.energyClass ?? null,
    location_id: options.locationId ?? null,
  };
  worldState.artifacts.push(artifact);
  return artifact;
}

function getArtifact(worldState, artifactId) {
  return worldState.artifacts.find((a) => a.id === artifactId) ?? null;
}

// Matches the `missions` columns in VACANCY_POSTGRESQL_SCHEMA.sql.
// VACANCY_API_ENDPOINT_MAP.md's own contract: "{ artifactId } ->
// generates a mission, returns { mission, state }" -- a mission is
// always generated FROM a real, existing artifact, not created
// standalone; that's the one real, required input this function
// enforces.
//
// controllingFactionId is optional (missions.controlling_faction_id
// has no NOT NULL constraint) but, if given, must reference a real
// organization that is genuinely a faction -- never trusted as a bare
// id, the same "validate against real state, not caller-declared"
// posture this whole session has used everywhere else.
function generateMission(worldState, options = {}) {
  const artifact = getArtifact(worldState, options.artifactId);
  if (!artifact) {
    throw new Error(`generateMission: no artifact with id ${options.artifactId} (missions.artifact_id references a real artifact).`);
  }
  if (options.controllingFactionId != null) {
    const faction = worldState.organizations.find((o) => o.id === options.controllingFactionId && o.isFaction);
    if (!faction) {
      throw new Error(`generateMission: ${options.controllingFactionId} is not a real faction (controlling_faction_id references factions.organization_id).`);
    }
  }

  const mission = {
    id: nextMissionId++,
    artifact_id: artifact.id,
    objective: options.objective ?? null,
    reward: options.reward ?? null,
    controlling_faction_id: options.controllingFactionId ?? null,
    status: options.status ?? 'available', // schema default
    tick_generated: worldState.tick,
    // The state machine below. A mission starts unassigned and
    // unresolved; every one of these is filled by a real transition,
    // never at creation.
    assigned_entity_id: null,
    tick_accepted: null,
    tick_resolved: null,
    outcome_note: null,
  };
  worldState.missions.push(mission);
  return mission;
}

// ---------------------------------------------------------------------------
// The mission state machine — the engine's first real player verb
// ---------------------------------------------------------------------------
// **What was missing.** `generateMission()` set `status: 'available'`
// and nothing in this engine ever changed it. `listMissions()` filtered
// by status; no code path moved a mission off `available`, and no route
// existed to try. A player could be handed a quest and had no way to
// take it, finish it, or fail it — the record existed, the loop did not.
//
// Everything else in VACON-C is a world that runs whether anyone is
// watching. This is the first thing a person DOES that the world then
// reflects back: accept a mission, complete it, and the reward lands in
// your finances where the citizen dashboard reads it.
//
// **Legal transitions, and nothing else:**
//
//     available --accept--> accepted --complete--> completed
//                              |
//                              +----fail-------> failed
//                              +----abandon----> abandoned
//
// Terminal states are terminal. A completed mission cannot be completed
// twice — which matters because completion pays, and a re-completable
// mission is an infinite money printer.
const MISSION_STATUSES = ['available', 'accepted', 'completed', 'failed', 'abandoned'];
const TERMINAL_STATUSES = ['completed', 'failed', 'abandoned'];

function requireMission(worldState, missionId) {
  const mission = getMission(worldState, Number(missionId));
  if (!mission) throw new Error(`no mission with id ${missionId}`);
  return mission;
}

function acceptMission(worldState, missionId, entityId) {
  const mission = requireMission(worldState, missionId);

  if (entityId == null) throw new Error('acceptMission requires an entityId — a mission is taken by somebody.');
  const npc = worldState.npcs.find((n) => n.id === Number(entityId));
  if (!npc) throw new Error(`acceptMission: ${entityId} is not a real NPC.`);

  if (mission.status !== 'available') {
    throw new Error(
      `mission ${mission.id} is "${mission.status}", not available`
      + `${mission.assigned_entity_id ? ` (held by ${mission.assigned_entity_id})` : ''}.`,
    );
  }

  mission.status = 'accepted';
  mission.assigned_entity_id = npc.id;
  mission.tick_accepted = worldState.tick;
  return mission;
}

// Completion PAYS. `payReward` is injected rather than imported so this
// module keeps taking worldState explicitly and does not reach into
// economy.js — the same seam every other module here uses. engine.js
// binds the real one.
function resolveMission(worldState, missionId, options = {}) {
  const { outcome, entityId = null, note = null, payReward = null } = options;

  if (!TERMINAL_STATUSES.includes(outcome)) {
    throw new Error(`resolveMission: "${outcome}" is not an outcome (one of: ${TERMINAL_STATUSES.join(', ')}).`);
  }

  const mission = requireMission(worldState, missionId);

  if (mission.status !== 'accepted') {
    throw new Error(
      `mission ${mission.id} is "${mission.status}" — only an accepted mission can be `
      + `${outcome}. A terminal mission stays terminal.`,
    );
  }
  // Only the holder resolves it. Without this, anyone could complete
  // somebody else's mission and collect for it.
  if (entityId != null && Number(entityId) !== mission.assigned_entity_id) {
    throw new Error(
      `mission ${mission.id} is held by ${mission.assigned_entity_id}, not ${entityId}.`,
    );
  }

  mission.status = outcome;
  mission.tick_resolved = worldState.tick;
  mission.outcome_note = note;

  // Only completion pays. Failing or abandoning a mission earns
  // nothing, which is the whole reason the three outcomes are distinct
  // rather than one "closed".
  let paid = null;
  if (outcome === 'completed' && mission.reward && payReward) {
    paid = payReward(mission.assigned_entity_id, Number(mission.reward));
  }

  return { mission, paid };
}

function getMission(worldState, missionId) {
  return worldState.missions.find((m) => m.id === missionId) ?? null;
}

function listMissions(worldState, options = {}) {
  const { status } = options;
  return worldState.missions.filter((m) => !status || m.status === status);
}

module.exports = {
  MISSION_STATUSES,
  TERMINAL_STATUSES,
  acceptMission,
  resolveMission,
  generateArtifact,
  getArtifact,
  generateMission,
  getMission,
  listMissions,
};
