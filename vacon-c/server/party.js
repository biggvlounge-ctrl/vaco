// server/party.js
//
// By direct instruction: "you also can have them all walk with you or
// escort each other, however many you need to come on a mission with
// you. You can have them come with you or escort you or play
// different roles as you go... depending on your leadership, it'll
// show you that you can take NPCs with you and control them, or at
// least have a system to what you're going to do as a group."
//
// ---------------------------------------------------------------------
// Persistent, not one-shot — the one real way this differs from every
// earlier crew mechanic this session built
// ---------------------------------------------------------------------
// `heists.js#attemptHeist` and `espionage.js#sendSpy` both assemble a
// one-time crew that exists only for the single call. This is the
// generalized, standing version the user asked for here and that
// `espionage.js`'s own header explicitly declared out of scope at the
// time ("accompany" was not built then) — a real roster that persists
// across missions until the leader releases someone or assembles them
// again. `assembleParty` reuses the identical real authority and
// compliance shape those two files already established
// (`leadership.complianceDraw` against `relationships.loyalty`,
// exactly one of `organizationId`/`familyId`, a real membership check
// under that sponsor) rather than inventing a second one.
//
// ---------------------------------------------------------------------
// "Play different roles as you go" is `leadership.assignRole`, not a
// second role vocabulary
// ---------------------------------------------------------------------
// This file adds no role field of its own. `assignPartyRole` is a
// thin gate — the target must currently be a real member of this
// leader's own party — that then delegates entirely to the real,
// already-built `leadership.assignRole` (organization free-text roles,
// or the real five-value family list, each with its own compliance
// draw and its own influence consequence). A second, disagreeing role
// system here would be the third standing rule's shape one file over.
//
// ---------------------------------------------------------------------
// A person can only ever be in one party at a time
// ---------------------------------------------------------------------
// "Escort each other" describes a real constraint, not just a
// permission: a person physically travelling with one leader's group
// cannot simultaneously be travelling with another's. Attempting to
// add someone already escorting a DIFFERENT leader does not ask them
// to comply or refuse — loyalty has nothing to do with it — it is
// reported as `unavailable`, a distinct real reason from a refusal,
// the same care `heists.js` already takes keeping success and
// detection as two separate real questions rather than collapsing them
// into one.
//
// ---------------------------------------------------------------------
// In-memory only, not a new schema table — the same declared posture
// `heat.js`'s `relationships.conflict` reuse avoided needing, and
// `city.healthBaseline`/`city.hazardRisk` already hold for a real but
// unscheduled extension
// ---------------------------------------------------------------------
// `worldState.partyMemberships` is a new array this file owns outright
// (nothing else reads or writes it), not a reuse of an existing
// schema table the way `heat.js` reused `relationships`. No column in
// `VACANCY_POSTGRESQL_SCHEMA.sql` holds it, and a world restored from
// Postgres loses an active party the same documented way a restored
// world loses `city.healthBaseline` — stated here rather than
// silently assumed to persist.

'use strict';

const leadership = require('./leadership.js');
const membership = require('./membership.js');

let nextPartyMembershipId = 1;

function sponsorBasis(worldState, leaderEntityId, options) {
  const { organizationId = null, familyId = null } = options;
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('assembleParty requires exactly one of organizationId or familyId.');
  }

  if (organizationId != null) {
    const organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`assembleParty: no organization with id ${organizationId}.`);
    if (organization.leader_id !== Number(leaderEntityId)) {
      throw new Error(
        `assembleParty: entity ${leaderEntityId} does not lead organization ${organizationId}.`,
      );
    }
    return {
      organizationId: organization.id,
      familyId: null,
      membershipCheck: (id) => !!membership.findMembership(worldState, id, organization.id),
    };
  }

  const family = (worldState.families || []).find((f) => f.id === Number(familyId));
  if (!family) throw new Error(`assembleParty: no family with id ${familyId}.`);
  if (family.head_npc_id !== Number(leaderEntityId)) {
    throw new Error(`assembleParty: entity ${leaderEntityId} does not head family ${familyId}.`);
  }
  return {
    organizationId: null,
    familyId: family.id,
    membershipCheck: (id) => (worldState.familyMemberships || []).some(
      (m) => m.entity_id === id && m.family_id === family.id,
    ),
  };
}

function partyRowFor(worldState, leaderEntityId, memberEntityId) {
  return (worldState.partyMemberships || []).find(
    (row) => row.leaderEntityId === Number(leaderEntityId)
      && row.memberEntityId === Number(memberEntityId),
  );
}

function escortLeaderOf(worldState, memberEntityId) {
  const row = (worldState.partyMemberships || [])
    .find((r) => r.memberEntityId === Number(memberEntityId));
  return row ? row.leaderEntityId : null;
}

function partyOf(worldState, leaderEntityId) {
  const ids = (worldState.partyMemberships || [])
    .filter((r) => r.leaderEntityId === Number(leaderEntityId))
    .map((r) => r.memberEntityId);
  return (worldState.npcs || []).filter((n) => ids.includes(n.id));
}

function assembleParty(worldState, leaderEntityId, options = {}) {
  const {
    memberEntityIds = [], tick = worldState.tick ?? 0,
  } = options;
  if (!Array.isArray(memberEntityIds) || memberEntityIds.length === 0) {
    throw new Error('assembleParty requires a non-empty memberEntityIds array.');
  }

  const { organizationId, familyId, membershipCheck } = sponsorBasis(
    worldState, leaderEntityId, options,
  );

  worldState.partyMemberships = worldState.partyMemberships || [];

  const candidateIds = [...new Set(memberEntityIds.map(Number))]
    .filter((id) => id !== Number(leaderEntityId));
  for (const id of candidateIds) {
    if (!membershipCheck(id)) {
      throw new Error(`assembleParty: entity ${id} is not a real member under this sponsor's authority.`);
    }
  }

  const complied = [];
  const refused = [];
  const unavailable = [];

  for (const id of candidateIds) {
    const existingHere = partyRowFor(worldState, leaderEntityId, id);
    if (existingHere) { complied.push(id); continue; }

    const existingElsewhere = escortLeaderOf(worldState, id);
    if (existingElsewhere != null) { unavailable.push(id); continue; }

    const { complied: didComply } = leadership.complianceDraw(
      worldState, leaderEntityId, id, 'assemble-party', tick,
    );
    if (!didComply) { refused.push(id); continue; }

    worldState.partyMemberships.push({
      id: nextPartyMembershipId++,
      leaderEntityId: Number(leaderEntityId),
      memberEntityId: id,
      organizationId,
      familyId,
      tick,
    });
    leadership.recordService(worldState, id);
    complied.push(id);
  }

  return { complied, refused, unavailable, party: partyOf(worldState, leaderEntityId).map((n) => n.id) };
}

function releaseFromParty(worldState, leaderEntityId, memberEntityId) {
  const row = partyRowFor(worldState, leaderEntityId, memberEntityId);
  if (!row) {
    throw new Error(
      `releaseFromParty: entity ${memberEntityId} is not currently escorting ${leaderEntityId}.`,
    );
  }
  worldState.partyMemberships = (worldState.partyMemberships || [])
    .filter((r) => r !== row);
  return { released: row.memberEntityId };
}

function assignPartyRole(worldState, leaderEntityId, memberEntityId, role, tick) {
  const row = partyRowFor(worldState, leaderEntityId, memberEntityId);
  if (!row) {
    throw new Error(
      `assignPartyRole: entity ${memberEntityId} is not currently escorting ${leaderEntityId}.`,
    );
  }
  return leadership.assignRole(worldState, leaderEntityId, {
    organizationId: row.organizationId,
    familyId: row.familyId,
    subordinateEntityId: memberEntityId,
    role,
    tick: tick ?? worldState.tick ?? 0,
  });
}

module.exports = {
  assembleParty,
  releaseFromParty,
  assignPartyRole,
  partyOf,
  escortLeaderOf,
};
