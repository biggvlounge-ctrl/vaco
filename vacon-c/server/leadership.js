// server/leadership.js
//
// Leader mode, reopened by explicit instruction after being correctly
// deferred since CLAUDE.md's Day 1 scope lock. The direction asked
// for, verbatim: pick ONE avatar and stay with it; as a leader or
// influencer, that avatar can direct or influence other characters.
//
// **The schema's own one-line plan for this mode said something
// different** — `players.linked_entity_id`'s comment reads "npc for
// Citizen mode, organization for Leader mode". That was never built
// against (`grep -rn "leader-dashboard" server/*.js` returns nothing),
// so it is a plan, not a shipped contract, and this deliberately
// diverges from it: `linked_entity_id` stays an NPC in Leader mode too.
// The player does not become an abstract organization — they stay the
// one embodied person they always were, who now happens to hold a real
// seat of authority. Nothing else in the engine has to learn a second
// kind of player, and `getLiveEntity()`/the whole Citizen-mode
// dashboard shape keeps meaning the same thing.
//
// **"Leader" is not a new column — it is `organizations.leader_id`,
// already real, already written at generation (`engine.js`), already
// moved on takeover (`control.js`) and cleared on death
// (`succession.js`).** Becoming a leader is holding that seat; losing
// it is the same real column changing under you, read live on every
// call rather than cached on the player record. No new "is this person
// a leader" flag exists anywhere here, on purpose — the ninth standing
// rule (read live traits through `getLiveEntity()`, never a frozen
// sheet) applies to authority exactly the way it applies to traits.
//
// **"Influencer" is not a separate character type either** — it is the
// same seat, on an organization whose `type` happens to be `media`.
// `server/media.js` already has real outlets, real channels and a real
// awareness/spread mechanic; the only thing missing was a way for a
// PLAYER to be the `sourceEntityId` instead of only the government's
// automatic broadcast. `broadcastMessage` below is that, and nothing
// else in media.js changes.
//
// **Directing someone is not guaranteed, and that is the design, not a
// gap.** The obvious build is a command that always succeeds — this
// project's own meetings.js header already argued against the
// equivalent shortcut for persuasion ("it invents no modifier, and
// that is the whole design"). The same argument applies to orders: a
// subordinate's own `relationships.loyalty` toward their leader (a
// real column, default 50) decides whether they comply, mapped
// directly to a probability rather than a pass/fail cutoff nobody
// measured — the twenty-sixth standing rule's lesson, applied before
// the mistake could be made rather than after. Compliance is a
// `seededDraw`, so it replays exactly like every other determined-but-
// uncertain outcome in this engine (contests, weather, migration).
//
// **A directed mission is still a mission, not a second system.**
// `directMission` composes the exact two exported functions
// `missions.js` already has — `generateMission` then `acceptMission`
// — rather than reaching into mission internals to fabricate an
// already-accepted row by hand. The only new fields are bookkeeping
// (`issued_by_entity_id`, `issuing_organization_id`), so a directed
// mission still goes through the one real state machine
// (`accepted -> completed/failed/abandoned`) and still pays through
// the one real `payReward` path `engine.js#resolveMission` already
// wires. "A mission is never about nothing" (missions.js's own rule)
// is unchanged: an order still needs a real artifact or a real place.
//
// **A known, stated limitation, same posture as this project's other
// declared gaps**: there is no automatic demotion back to Citizen mode
// when a leader is overthrown, succeeded, or their organization
// dissolves. `getLeaderDashboard` re-checks `organizations.leader_id`
// live on every call and throws a clear, specific error the moment it
// no longer holds true, rather than showing stale command — but
// `player.mode` itself stays `'leader'` until something explicit moves
// it. Wiring that into `succession.js`'s own leader_id-clearing path is
// real, separate, future work, named here rather than silently
// assumed.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');
const worldStore = require('./worldStore.js');
const membership = require('./membership.js');
const missions = require('./missions.js');
const media = require('./media.js');
const { seededDraw } = require('./seeded.js');

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// ---------------------------------------------------------------------
// Who leads what — pure reads over the real column
// ---------------------------------------------------------------------

function isLeaderOf(worldState, entityId, organizationId) {
  const organization = (worldState.organizations || [])
    .find((o) => o.id === Number(organizationId));
  return !!organization && organization.leader_id === Number(entityId);
}

function organizationsLedBy(worldState, entityId) {
  return (worldState.organizations || [])
    .filter((o) => o.leader_id === Number(entityId));
}

// ---------------------------------------------------------------------
// Entering Leader mode — granted, never requested into existing
// ---------------------------------------------------------------------
// Player-id-keyed, same convention as players.js's own
// generatePlayer/getCitizenDashboard (a player record is addressed by
// its own id, never by the entity it happens to be linked to).
function promoteToLeader(worldState, playerId) {
  const player = (worldState.players || []).find((p) => p.id === Number(playerId));
  if (!player) throw new Error(`promoteToLeader: no player with id ${playerId}.`);
  if (player.mode === 'leader') return player;
  if (player.mode !== 'citizen') {
    throw new Error(
      `promoteToLeader: player ${playerId} is in '${player.mode}' mode, not 'citizen' — `
      + 'only a citizen-mode player can be promoted.',
    );
  }

  const led = organizationsLedBy(worldState, player.linked_entity_id);
  if (led.length === 0) {
    throw new Error(
      `promoteToLeader: entity ${player.linked_entity_id} does not lead any real organization `
      + '(organizations.leader_id) — Leader mode is granted by actually holding that seat, '
      + 'never on request.',
    );
  }

  player.mode = 'leader';
  return player;
}

// The "observe and be affected by" half for Leader mode, same shape as
// players.js#getCitizenDashboard. Re-verifies leadership live rather
// than trusting player.mode — see the header's stated limitation on
// automatic demotion.
function getLeaderDashboard(worldState, playerId) {
  const player = (worldState.players || []).find((p) => p.id === Number(playerId));
  if (!player) throw new Error(`getLeaderDashboard: no player with id ${playerId}.`);
  if (player.mode !== 'leader') {
    throw new Error(`getLeaderDashboard: player ${playerId} is in '${player.mode}' mode, not 'leader'.`);
  }

  const entityId = player.linked_entity_id;
  const live = getLiveEntity(worldState, entityId);
  if (!live) {
    throw new Error(`getLeaderDashboard: player ${playerId}'s linked NPC ${entityId} no longer exists.`);
  }

  const led = organizationsLedBy(worldState, entityId);
  if (led.length === 0) {
    throw new Error(
      `getLeaderDashboard: entity ${entityId} no longer leads any organization — this `
      + 'player\'s leadership has lapsed (ousted, succeeded, or the organization is gone). '
      + 'Demotion back to citizen mode is not automatic; see this file\'s own header.',
    );
  }

  const organizations = led.map((org) => {
    const members = membership.membersOf(worldState, org.id)
      .filter((m) => m.id !== entityId)
      .map((m) => {
        const rel = worldStore.findRelationship(worldState, entityId, m.id);
        const roleRow = membership.findMembership(worldState, m.id, org.id);
        return {
          id: m.id,
          status: m.status,
          roleInOrg: roleRow ? roleRow.role_in_org : null,
          loyalty: rel ? Number(rel.loyalty) : null,
        };
      });

    const directedMissions = (worldState.missions || [])
      .filter((m) => m.issuing_organization_id === org.id)
      .map((m) => ({
        id: m.id, status: m.status, assignedEntityId: m.assigned_entity_id,
        objective: m.objective, reward: m.reward,
      }));

    return {
      id: org.id,
      name: org.name,
      type: org.type,
      influence: org.influence,
      members,
      directedMissions,
      canBroadcast: org.type === 'media',
    };
  });

  return {
    player: { id: player.id, mode: player.mode, linkedEntityId: entityId },
    npc: { id: live.id, status: live.status, role: live.role },
    organizations,
  };
}

// ---------------------------------------------------------------------
// Directing — a command to one of your own people
// ---------------------------------------------------------------------
// entityId-keyed, same convention as the other player VERBS in
// actions.js (attemptTakeover, holdMeeting) — a player acts as
// themselves, through the actor their own record names.
function directMission(worldState, leaderEntityId, options = {}) {
  const {
    organizationId, subordinateEntityId, objective = null, reward = null,
    artifactId = null, locationId = null, tick = worldState.tick ?? 0,
  } = options;

  if (organizationId == null) throw new Error('directMission requires an organizationId.');
  if (subordinateEntityId == null) throw new Error('directMission requires a subordinateEntityId.');

  const organization = (worldState.organizations || [])
    .find((o) => o.id === Number(organizationId));
  if (!organization) throw new Error(`directMission: no organization with id ${organizationId}.`);
  if (organization.leader_id !== Number(leaderEntityId)) {
    throw new Error(
      `directMission: entity ${leaderEntityId} does not lead organization ${organizationId} `
      + `(organizations.leader_id is ${organization.leader_id ?? 'nobody'}) — a leader can only `
      + 'direct the organization they actually head.',
    );
  }

  const subordinateId = Number(subordinateEntityId);
  if (subordinateId === Number(leaderEntityId)) {
    throw new Error('directMission: a leader cannot direct themselves — that is just accepting a mission.');
  }

  const membershipRow = membership.findMembership(worldState, subordinateId, organization.id);
  if (!membershipRow) {
    throw new Error(
      `directMission: entity ${subordinateId} is not a member of organization ${organization.id} `
      + '— a leader can only direct their own people.',
    );
  }
  const subordinate = (worldState.npcs || []).find((n) => n.id === subordinateId);
  if (!subordinate) throw new Error(`directMission: ${subordinateId} is not among the living.`);

  // Compliance — see the header. loyalty's real default (50, from
  // worldStore.getOrCreateRelationship) is the unread-relationship
  // fallback here too, so a leader and a subordinate who have never
  // interacted start at an even chance rather than an invented zero.
  const relationship = worldStore.findRelationship(worldState, leaderEntityId, subordinateId);
  const loyalty = relationship ? Number(relationship.loyalty) : 50;
  const complianceChance = clamp01(loyalty / 100);
  const draw = seededDraw([
    worldState.seed ?? 'world', 'direct-mission', leaderEntityId, subordinateId, tick,
  ]);
  const complied = draw < complianceChance;

  if (!complied) {
    return {
      complied: false, loyalty, complianceChance, refusedBy: subordinateId, mission: null,
    };
  }

  // Composes the two real exported mission functions — never reaches
  // into mission internals to fabricate an already-accepted row.
  const mission = missions.generateMission(worldState, { artifactId, locationId, objective, reward });
  missions.acceptMission(worldState, mission.id, subordinateId);
  mission.issued_by_entity_id = Number(leaderEntityId);
  mission.issuing_organization_id = organization.id;

  return {
    complied: true, loyalty, complianceChance, refusedBy: null, mission,
  };
}

// ---------------------------------------------------------------------
// Influencing at scale — your own outlet, not a meeting
// ---------------------------------------------------------------------
// One-on-one persuasion already exists (meetings.js's `negotiate`/
// `recruit`, open to every mode). This is the thing a citizen cannot
// do: put a fact in front of a whole audience through a real outlet,
// because only a media organization's leader has one.
function broadcastMessage(worldState, leaderEntityId, options = {}) {
  const { organizationId, ...rest } = options;
  if (organizationId == null) throw new Error('broadcastMessage requires an organizationId.');

  const organization = (worldState.organizations || [])
    .find((o) => o.id === Number(organizationId));
  if (!organization) throw new Error(`broadcastMessage: no organization with id ${organizationId}.`);
  if (organization.leader_id !== Number(leaderEntityId)) {
    throw new Error(
      `broadcastMessage: entity ${leaderEntityId} does not lead organization ${organizationId} `
      + `(organizations.leader_id is ${organization.leader_id ?? 'nobody'}).`,
    );
  }
  if (organization.type !== 'media') {
    throw new Error(
      `broadcastMessage: organization ${organizationId} is type "${organization.type}", not `
      + '"media" — only a media organization\'s leader can broadcast through it.',
    );
  }

  return media.broadcast(worldState, { ...rest, sourceEntityId: Number(leaderEntityId) });
}

module.exports = {
  isLeaderOf,
  organizationsLedBy,
  promoteToLeader,
  getLeaderDashboard,
  directMission,
  broadcastMessage,
};
