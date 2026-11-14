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
//
// **A second way to direct someone, added later, with no organization
// involved at all.** See `influence.js`'s own header for the full
// design. `directMission` now takes an OPTIONAL `organizationId`: when
// given, everything above is unchanged exactly as built (an org leader
// directing their own real member, compliance gated on that person's
// real `loyalty`); when omitted, compliance is instead gated on the
// pair's own real, growing `relationships.influence` — no organization,
// no membership check, and no invented cutoff on how much influence is
// "enough", for the same reason loyalty was never tested against one.
// Either way, a compliance raises real influence between the two of
// them and a refusal lowers it — directing someone is itself now one
// of the real events that grows or costs you influence, not just a
// consumer of it.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');
const worldStore = require('./worldStore.js');
const membership = require('./membership.js');
const missions = require('./missions.js');
const media = require('./media.js');
const influence = require('./influence.js');
const characterCreation = require('./characterCreation.js');
const heat = require('./heat.js');
const localEvents = require('./events.js');
const { seededDraw } = require('./seeded.js');

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// ---------------------------------------------------------------------
// Assigning a task — not every directive is a mission
// ---------------------------------------------------------------------
// By direct instruction: "you can assign things that can be done from
// your organization tribe... assign them different tasks... depending
// on your leadership, if they will follow." `directMission` already
// covers "go accept this real mission," which needs a real artifact
// or place (`missions.js`'s own "a mission is never about nothing").
// "Take care of the kids," "on security" is a different, lighter kind
// of directive with no artifact at all, and forcing it through the
// mission state machine would be fabricating one to satisfy a rule
// that does not apply here.
//
// **Both real seats this engine already has — `organizations.leader_id`
// and `families.head_npc_id` — can issue one, because the user's own
// words treat them as the same kind of authority ("tribe, organization,
// delegation").** `families.head_npc_id` had no directive of its own
// until now; only `organizations.leader_id` could ever direct anyone.
//
// **No invented vocabulary for either seat — both already have one.**
// `family_memberships.role` is open TEXT in the schema, but its own
// comment names an exact set: "parent|child|grandparent|sibling|
// partner|guardian|mentor|founder|heir|black_sheep|leader|protector|
// caregiver." Seven of those are structural facts this engine already
// computes (kinship itself, succession's `heir`, `head_npc_id`'s own
// `leader`) and are not something a tribe head hands out as a task.
// The remaining five — `guardian`, `mentor`, `protector`, `caregiver`,
// `black_sheep` — are real, functional, and nothing had ever written
// them: a second "defined, never used" gap, the eleventh standing
// rule's own shape, found in the same table `characterCreation.js`
// already writes `parent`/`child` rows into. `protector` is the real
// substrate for "on security," `caregiver` for "take care of the
// kids" — the user's own two examples, not invented to fit them.
// `organizations.membership.role_in_org` is ALSO already open TEXT —
// `membership.js`'s own header says a non-gang organization "stores
// whatever role its own caller passes" — so an organization task
// takes free text, while a family task is checked against the real
// five-value list, because only the family table's comment actually
// names one.
//
// **Refused outright for a gang or faction**, never silently
// overwritten: `membership.assignGangTiers` runs every tick
// (`tick.js`) and recomputes `role_in_org` from real traits for every
// gang/faction member, so a player-assigned role there would be
// clobbered on the very next tick and the refusal says so rather than
// accepting a value that cannot stick.
//
// **The compliance draw is the identical one `directMission` already
// uses** — a subordinate's own real `relationships.loyalty` toward
// whoever is asking, mapped straight to a probability, never an
// invented cutoff (the twenty-sixth standing rule). Reused rather than
// copied: `complianceDraw` is the one function both verbs call.
const ASSIGNABLE_FAMILY_ROLES = ['guardian', 'mentor', 'protector', 'caregiver', 'black_sheep'];

function complianceDraw(worldState, leaderEntityId, subordinateId, tag, tick) {
  const relationship = worldStore.findRelationship(worldState, leaderEntityId, subordinateId);
  const gatingValue = relationship ? Number(relationship.loyalty) : 50;
  const complianceChance = clamp01(gatingValue / 100);
  const draw = seededDraw([
    worldState.seed ?? 'world', tag, leaderEntityId, subordinateId, tick,
  ]);
  return { complied: draw < complianceChance, gatingValue, complianceChance };
}

// By direct instruction: "this allows NPCs to become main characters
// in your tribe through their actions and their usage." The existing
// `mainCharacters.js` already owns the term "main character" for a
// different, specific thing — the four real per-community power-
// hierarchy leaders (criminal/political/religious/business) — so this
// does not reuse that name for a second, disagreeing concept. What it
// gives instead is the real, measured fact the user is actually
// asking for: a running count of how many times a specific person has
// actually been relied on and come through, so a human player can see
// which of their own rank-and-file has a real track record, without
// this file guessing at a threshold for "important" that nobody
// measured. `directMission`, `assignRole`, and `espionage.js#sendSpy`
// are the three real call sites, each incrementing on an actual
// COMPLIED outcome only — a refusal is not usage.
function recordService(worldState, entityId) {
  const record = worldState.serviceRecord || (worldState.serviceRecord = {});
  record[entityId] = (record[entityId] || 0) + 1;
  return record[entityId];
}

function serviceRecordOf(worldState, entityId) {
  return (worldState.serviceRecord || {})[entityId] ?? 0;
}

function assignRole(worldState, leaderEntityId, options = {}) {
  const {
    organizationId = null, familyId = null, subordinateEntityId, role,
    tick = worldState.tick ?? 0,
  } = options;

  if (subordinateEntityId == null) throw new Error('assignRole requires a subordinateEntityId.');
  if (!role) throw new Error('assignRole requires a role.');
  const subordinateId = Number(subordinateEntityId);
  if (subordinateId === Number(leaderEntityId)) {
    throw new Error('assignRole: a leader cannot assign a role to themselves.');
  }
  const subordinate = (worldState.npcs || []).find((n) => n.id === subordinateId);
  if (!subordinate) throw new Error(`assignRole: ${subordinateId} is not among the living.`);
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('assignRole requires exactly one of organizationId or familyId.');
  }

  let basis;
  let apply;

  if (organizationId != null) {
    const organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`assignRole: no organization with id ${organizationId}.`);
    if (organization.leader_id !== Number(leaderEntityId)) {
      throw new Error(
        `assignRole: entity ${leaderEntityId} does not lead organization ${organizationId} `
        + `(organizations.leader_id is ${organization.leader_id ?? 'nobody'}).`,
      );
    }
    if (membership.isGang(organization)) {
      throw new Error(
        `assignRole: organization ${organizationId} is a gang/faction — its role_in_org is `
        + 'computed from real traits every tick (membership.assignGangTiers) and would be '
        + 'overwritten immediately, not assigned.',
      );
    }
    const membershipRow = membership.findMembership(worldState, subordinateId, organization.id);
    if (!membershipRow) {
      throw new Error(
        `assignRole: entity ${subordinateId} is not a member of organization ${organization.id}.`,
      );
    }
    basis = 'organization';
    apply = () => membership.joinOrganization(worldState, {
      entityId: subordinateId, organizationId: organization.id, role, tick,
    });
  } else {
    const family = (worldState.families || []).find((f) => f.id === Number(familyId));
    if (!family) throw new Error(`assignRole: no family with id ${familyId}.`);
    if (family.head_npc_id !== Number(leaderEntityId)) {
      throw new Error(
        `assignRole: entity ${leaderEntityId} does not head family ${familyId} `
        + `(families.head_npc_id is ${family.head_npc_id ?? 'nobody'}).`,
      );
    }
    if (!ASSIGNABLE_FAMILY_ROLES.includes(role)) {
      throw new Error(
        `assignRole: "${role}" is not an assignable family role. The five are: `
        + `${ASSIGNABLE_FAMILY_ROLES.join(', ')}.`,
      );
    }
    const familyRow = (worldState.familyMemberships || []).find(
      (m) => m.entity_id === subordinateId && m.family_id === family.id,
    );
    if (!familyRow) {
      throw new Error(`assignRole: entity ${subordinateId} is not a member of family ${familyId}.`);
    }
    basis = 'family';
    apply = () => { familyRow.role = role; return familyRow; };
  }

  const { complied, gatingValue, complianceChance } = complianceDraw(
    worldState, leaderEntityId, subordinateId, 'assign-role', tick,
  );

  if (complied) {
    influence.raiseInfluence(worldState, leaderEntityId, subordinateId);
  } else {
    influence.lowerInfluence(worldState, leaderEntityId, subordinateId);
    return {
      complied: false, basis, gatingValue, complianceChance, refusedBy: subordinateId, role: null,
    };
  }

  apply();
  recordService(worldState, subordinateId);
  return {
    complied: true, basis, gatingValue, complianceChance, refusedBy: null, role,
  };
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
          // "NPCs become main characters in your tribe through their
          // actions and their usage" — see `recordService`'s own
          // header. A real, measured track record, not a status flag.
          serviceRecord: serviceRecordOf(worldState, m.id),
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
    // Same three fields as players.js#getCitizenDashboard, read live for
    // the same reason — a leader's own standing, family and real
    // per-faction heat are facts about them regardless of which mode
    // they're playing. A leader with enemies on a rival faction's own
    // radar needs to see that as much as a citizen does.
    influenceRating: influence.influenceRatingOf(worldState, entityId),
    extendedFamily: characterCreation.describeFamilyTree(worldState, entityId),
    heat: heat.heatProfile(worldState, entityId),
    // Same field, same real grain, as `players.js#getCitizenDashboard`
    // — a leader needs to see what's happening nearby as much as a
    // citizen does, and `events.js#eventsNear`'s own header on why
    // "city" is the real available grain rather than an invented one.
    nearbyEvents: localEvents.eventsNear(worldState, entityId, { scope: 'city', limit: 10 }),
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
    organizationId = null, subordinateEntityId, objective = null, reward = null,
    artifactId = null, locationId = null, tick = worldState.tick ?? 0,
  } = options;

  if (subordinateEntityId == null) throw new Error('directMission requires a subordinateEntityId.');
  const subordinateId = Number(subordinateEntityId);
  if (subordinateId === Number(leaderEntityId)) {
    throw new Error('directMission: a leader cannot direct themselves — that is just accepting a mission.');
  }
  const subordinate = (worldState.npcs || []).find((n) => n.id === subordinateId);
  if (!subordinate) throw new Error(`directMission: ${subordinateId} is not among the living.`);

  let organization = null;
  let basis;
  let complianceChance;
  let gatingValue;

  if (organizationId != null) {
    // The original path: an organization's own real leader, directing
    // a real member of it. Unchanged.
    organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`directMission: no organization with id ${organizationId}.`);
    if (organization.leader_id !== Number(leaderEntityId)) {
      throw new Error(
        `directMission: entity ${leaderEntityId} does not lead organization ${organizationId} `
        + `(organizations.leader_id is ${organization.leader_id ?? 'nobody'}) — a leader can only `
        + 'direct the organization they actually head.',
      );
    }
    const membershipRow = membership.findMembership(worldState, subordinateId, organization.id);
    if (!membershipRow) {
      throw new Error(
        `directMission: entity ${subordinateId} is not a member of organization ${organization.id} `
        + '— a leader can only direct their own people.',
      );
    }

    // loyalty's real default (50, from worldStore.getOrCreateRelationship)
    // is the unread-relationship fallback here too, so a leader and a
    // subordinate who have never interacted start at an even chance
    // rather than an invented zero.
    const relationship = worldStore.findRelationship(worldState, leaderEntityId, subordinateId);
    basis = 'loyalty';
    gatingValue = relationship ? Number(relationship.loyalty) : 50;
    complianceChance = clamp01(gatingValue / 100);
  } else {
    // The organization-free path — see influence.js's own header and
    // this file's. No membership to check, because there is no
    // organization; the real, growing influence this specific leader
    // already holds over this specific person is the only gate, and it
    // is never tested against an invented cutoff — mapped straight to
    // a probability instead.
    const relationship = worldStore.findRelationship(worldState, leaderEntityId, subordinateId);
    basis = 'influence';
    gatingValue = relationship
      ? Number(relationship.influence)
      : influence.influenceRatingOf(worldState, leaderEntityId);
    complianceChance = clamp01(gatingValue / 100);
  }

  const draw = seededDraw([
    worldState.seed ?? 'world', 'direct-mission', leaderEntityId, subordinateId, tick,
  ]);
  const complied = draw < complianceChance;

  // Directing someone is itself a real event now: a compliance grows
  // real influence between the two of them, a refusal costs it — true
  // on both paths, including the org-leader one, where this is new.
  if (complied) {
    influence.raiseInfluence(worldState, leaderEntityId, subordinateId);
  } else {
    influence.lowerInfluence(worldState, leaderEntityId, subordinateId);
  }

  if (!complied) {
    return {
      complied: false, basis, gatingValue, complianceChance, refusedBy: subordinateId, mission: null,
    };
  }

  // Composes the two real exported mission functions — never reaches
  // into mission internals to fabricate an already-accepted row.
  const mission = missions.generateMission(worldState, { artifactId, locationId, objective, reward });
  missions.acceptMission(worldState, mission.id, subordinateId);
  mission.issued_by_entity_id = Number(leaderEntityId);
  mission.issuing_organization_id = organization ? organization.id : null;
  recordService(worldState, subordinateId);

  return {
    complied: true, basis, gatingValue, complianceChance, refusedBy: null, mission,
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

  const written = media.broadcast(worldState, { ...rest, sourceEntityId: Number(leaderEntityId) });
  // Each real person actually reached (media.js already decided who
  // that is — share, era-gating, the draw against reach) is one more
  // real event raising the leader's real influence over them, at the
  // broadcast's own, lighter weight. See influence.js's header for why
  // this is half a direct interaction's weight rather than the same.
  for (const row of written) {
    if (row.entity_id === Number(leaderEntityId)) continue;
    influence.raiseInfluence(
      worldState, Number(leaderEntityId), row.entity_id, influence.BROADCAST_INFLUENCE_DELTA,
    );
  }
  return written;
}

module.exports = {
  isLeaderOf,
  organizationsLedBy,
  promoteToLeader,
  getLeaderDashboard,
  directMission,
  broadcastMessage,
  assignRole,
  ASSIGNABLE_FAMILY_ROLES,
  complianceDraw,
  recordService,
  serviceRecordOf,
};
