// server/players.js
//
// Citizen-mode player binding — the other half of the locked
// Definition of Done ("a drought-style cascade running through at
// least 4 of the 10 locked systems, WITH A CITIZEN-MODE PLAYER ABLE
// TO OBSERVE AND BE AFFECTED BY IT"). The cascade mechanism itself was
// built and verified in step 8 (dev-docs/phase-8-tick-pipeline/); this
// is what lets a player actually watch it happen.
//
// Scoped to Citizen mode only — CLAUDE.md's locked scope explicitly
// defers Leader/Simulation/Multiplayer modes, and the Build Prompt
// says outright: "Build Citizen mode first — cheapest, a thin
// interaction layer over existing NPC data." A player is never a new
// entity type (Build Prompt, explicit) — just a `players` row
// referencing an existing `npcs` entity via `linked_entity_id`.
//
// Every function here takes `worldState` explicitly, same convention
// as economy.js/worldStore.js/tick.js — engine.js wraps these as the
// bound, convenient API.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');
const economy = require('./economy.js');
const property = require('./property.js');
const behavior = require('./behavior.js');

let nextPlayerId = 1;

// options:
//   linkedEntityId - required, must reference an existing NPC
//                    (players.mode='citizen' binds to an npc per the
//                    schema's own comment; Leader mode would bind to
//                    an organization, but that mode is out of scope)
//   mode           - defaults to 'citizen', the only mode actually
//                    supported by anything built so far. Not
//                    validated against the other 3 enum values —
//                    the schema allows them, but getCitizenDashboard()
//                    below only makes sense for 'citizen'.
function generatePlayer(worldState, options = {}) {
  if (options.linkedEntityId == null) {
    throw new Error('generatePlayer requires options.linkedEntityId (players.linked_entity_id has no schema default, and a player must reference something).');
  }
  const npc = worldState.npcs.find((n) => n.id === options.linkedEntityId);
  if (!npc) {
    throw new Error(`generatePlayer: linkedEntityId ${options.linkedEntityId} is not an existing NPC — Citizen mode binds to an npc entity, per the schema's own comment on players.linked_entity_id.`);
  }

  const player = {
    id: nextPlayerId++,
    mode: options.mode ?? 'citizen',
    linked_entity_id: options.linkedEntityId,
  };
  worldState.players.push(player);
  return player;
}

// The actual "observe and be affected by" mechanism — pulls together
// everything the cascade (step 8) can touch for one NPC, using LIVE
// trait values (getLiveEntity(), the same step-8 correctness fix),
// not the generation-time snapshot.
//
// API_ENDPOINT_MAP.md names this GET /api/players/:id/citizen-dashboard
// — "career, relationships, family, property summary". That route now
// EXISTS (server.js) and is exercised over real HTTP by
// test/routes.test.js. This comment said "no routes file exists to
// actually expose it at that path (flagged since step 1; still true)"
// for some time after it stopped being true — the same
// citation-is-not-presence failure this project keeps finding, running
// in the direction of understating what is built.
//
// propertySummary was null for as long as there was no Property system
// to summarise — flagged here rather than silently omitted, which is
// what made it findable once property.js was built (Phase 2). It is now
// a real rollup over what the citizen currently owns, computed on read
// like family wealth and net worth beside it, never stored.
function getCitizenDashboard(worldState, playerId) {
  const player = worldState.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`getCitizenDashboard: no player with id ${playerId}`);
  }
  if (player.mode !== 'citizen') {
    throw new Error(`getCitizenDashboard: player ${playerId} is in '${player.mode}' mode, not 'citizen' — that mode isn't built (CLAUDE.md defers Leader/Simulation/Multiplayer).`);
  }

  const npcId = player.linked_entity_id;
  const live = getLiveEntity(worldState, npcId);
  if (!live) {
    throw new Error(`getCitizenDashboard: player ${playerId}'s linked NPC ${npcId} no longer exists`);
  }

  const relationships = worldState.relationships.filter(
    (r) => (r.entity_a_id === npcId || r.entity_b_id === npcId) && r.entity_a_id !== r.entity_b_id
  );

  const membership = worldState.familyMemberships.find((m) => m.entity_id === npcId);
  const family = membership ? worldState.families.find((f) => f.id === membership.family_id) : null;

  const recentMemories = worldState.memories
    .filter((m) => m.entity_id === npcId)
    .slice(-10)
    .reverse();

  const recentEvents = worldState.events
    .filter((e) => Array.isArray(e.affected_entity_ids) && e.affected_entity_ids.includes(npcId))
    .slice(-10)
    .reverse();

  const migrationRisk = (worldState.migrationRisk || []).find((r) => r.entity_id === npcId) ?? null;

  const netWorth = economy.getNetWorth(worldState, npcId);

  // Same formula as engine.js#getFamilyWealth() — inlined rather than
  // requiring engine.js here, since engine.js requires this file to
  // expose getCitizenDashboard() (same circular-dependency avoidance
  // tick.js already established in step 8).
  let familyWealth = null;
  if (family) {
    const memberIds = worldState.familyMemberships
      .filter((m) => m.family_id === family.id)
      .map((m) => m.entity_id);
    familyWealth = memberIds.reduce((total, id) => total + economy.getNetWorth(worldState, id), 0);
  }

  // What this citizen owns, as a summary rather than the full holdings
  // list — the dashboard is a glance, and GET /api/entities/:id/holdings
  // is where the detail lives. `totalValue` is the derived value of each
  // property summed on read, not anything stored (standing rule 3).
  const holdings = property.getHoldings(worldState, npcId);
  const propertySummary = {
    count: holdings.count,
    totalValue: holdings.totalValue,
    properties: holdings.properties.map((h) => ({
      id: h.property.id,
      type: h.property.type,
      lifecycleStage: h.property.lifecycle_stage,
      condition: h.property.condition,
      value: h.value,
      acquiredMethod: h.acquired.acquired_method,
      acquiredTick: h.acquired.acquired_tick,
    })),
  };

  return {
    player: { id: player.id, mode: player.mode, linkedEntityId: npcId },
    npc: {
      id: live.id, status: live.status, role: live.role,
      education: live.education, religion: live.religion, generation: live.generation,
    },
    traits: live.traits,
    career: { role: live.role, education: live.education },
    relationships,
    family: family
      ? {
        id: family.id, surname: family.surname, role: membership.role,
        unity: family.unity, reputation: family.reputation, conflict: family.conflict,
        wealth: familyWealth,
      }
      : null,
    propertySummary,
    netWorth,
    // Mood, habits and routine (architecture 4.5). The dashboard is the
    // "observe and be affected by" half of the Definition of Done, and
    // until the Behavior Engine existed it could show what a citizen
    // owned and who they knew but never how they were doing or what
    // they did with their days. `state` is null for somebody nothing
    // has happened to yet -- an unobserved person is not a calm one.
    behavior: behavior.describeBehavior(worldState, npcId),
    recentMemories,
    recentEvents,
    migrationRisk,
  };
}

module.exports = {
  generatePlayer,
  getCitizenDashboard,
};
