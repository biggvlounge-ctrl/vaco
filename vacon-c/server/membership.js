// server/membership.js
//
// Who belongs to which organization — the join table that was in the
// schema from the start and had no code.
//
// **What this unlocks, and why it is worth its own file.**
// `entity_organization_memberships` has been in
// `VACANCY_POSTGRESQL_SCHEMA.sql` since the first version, and
// `server/urbanSystems.js` listed it as `schemaOnly` — the label for a
// table the engine names as evidence and never touches. It is the
// missing link behind two whole §9 statistic blocks:
//
//   **GANG** — `territory_blocks.faction_id` says which faction holds
//   a block, so faction CONTROL of an area is real. Gang MEMBERSHIP
//   per area was not derivable at all, because nothing connected a
//   resident to a faction. `areaStats.UNAVAILABLE.gangMembership` said
//   exactly that. A membership row plus a resident's community is the
//   whole answer.
//
//   **ORGANIZATION** — §9 asks for "organization presence, leadership,
//   members, influence, territory" per area. Leadership, influence and
//   territory were readable from `organizations` and
//   `territory_blocks`; presence and members were not, because an
//   organization has no location and its people had no way to be
//   counted in one.
//
// ---------------------------------------------------------------------
// `organizations.members` is a stored rollup, and this does not write
// to it
//
// The column exists, defaults to 0, and is set by
// `generateOrganization` from its options. It is the same class of
// field as `communities.employment` — a seed placeholder that nothing
// updates, which reads as a measurement.
//
// Standing rule 3 forbids duplicating a computable rollup, so
// `memberCount` computes it from the rows and `describeMemberDrift`
// reports the stored figure beside the computed one, exactly as
// `areaStats.describeDrift` does for a community. Nothing here writes
// the answer back into the column.
//
// ---------------------------------------------------------------------
// A gang is an organization type, not a separate thing
//
// Standing rule 4: Organization is the parent table and Faction,
// Business and Government are subtypes. `organizations.type` lists
// `gang` among its values and `factions` is the territorial-conflict
// subtype, and the two are not the same claim — a gang that holds no
// territory is still a gang, and a faction can be a militia or a
// company town.
//
// So `isGang` reads BOTH: an organization whose `type` is 'gang', or
// one that is a faction. Reading only `type` would miss every faction
// the engine generates (`generateFaction` sets `isFaction`, and the
// type it is given varies); reading only `isFaction` would miss a gang
// with no blocks. Which one matched is reported rather than collapsed,
// because "criminal organizations present" and "armed factions
// present" are different statistics that happen to overlap.

'use strict';

// The roles the schema's own comment does not enumerate —
// `role_in_org` is open TEXT with no comment at all, unlike most
// columns in that file. So this validates nothing and stores what it
// is given; inventing a role enum here would be inventing design.
// The one rule enforced is that a membership is unique per pair, which
// the schema itself states: PRIMARY KEY (entity_id, organization_id).

function findMembership(worldState, entityId, organizationId) {
  return (worldState.entityOrganizationMemberships || []).find(
    (m) => m.entity_id === entityId && m.organization_id === organizationId,
  ) || null;
}

function joinOrganization(worldState, options = {}) {
  const { entityId, organizationId, role = null, tick = worldState.tick ?? 0 } = options;

  const organization = worldState.organizations.find((o) => o.id === organizationId);
  if (!organization) throw new Error(`joinOrganization: no organization ${organizationId}`);

  // The living only. A membership held by a corpse would be counted
  // by every "members per area" statistic forever — the exact class of
  // thing `mortality.js` moved the dead out of `npcs` to make
  // structurally impossible.
  const npc = worldState.npcs.find((n) => n.id === entityId);
  if (!npc) throw new Error(`joinOrganization: ${entityId} is not among the living`);

  const existing = findMembership(worldState, entityId, organizationId);
  if (existing) {
    // Not an error and not a second row: the schema's primary key
    // forbids the duplicate, so a re-join updates the role instead.
    if (role !== null) existing.role_in_org = role;
    return existing;
  }

  const membership = {
    entity_id: entityId,
    organization_id: organizationId,
    role_in_org: role,
    joined_tick: tick,
  };
  worldState.entityOrganizationMemberships.push(membership);
  return membership;
}

function leaveOrganization(worldState, entityId, organizationId) {
  const rows = worldState.entityOrganizationMemberships || [];
  const index = rows.findIndex(
    (m) => m.entity_id === entityId && m.organization_id === organizationId,
  );
  if (index === -1) return null;
  return rows.splice(index, 1)[0];
}

// **Membership does not survive death, and this is the call that has
// to be made explicitly.** `recordDeath` moves the row out of `npcs`,
// which stops a corpse being iterated — it does not reach into other
// tables. Leaving the membership row behind would leave a dead person
// counted in every organization headcount.
function releaseDeceased(worldState, entityId) {
  const rows = worldState.entityOrganizationMemberships || [];
  const released = rows.filter((m) => m.entity_id === entityId);
  worldState.entityOrganizationMemberships = rows.filter((m) => m.entity_id !== entityId);
  return released;
}

// -- reading ------------------------------------------------------------

function membersOf(worldState, organizationId) {
  const ids = new Set((worldState.entityOrganizationMemberships || [])
    .filter((m) => m.organization_id === organizationId)
    .map((m) => m.entity_id));
  return worldState.npcs.filter((n) => ids.has(n.id));
}

function organizationsOf(worldState, entityId) {
  const ids = new Set((worldState.entityOrganizationMemberships || [])
    .filter((m) => m.entity_id === entityId)
    .map((m) => m.organization_id));
  return worldState.organizations.filter((o) => ids.has(o.id));
}

function memberCount(worldState, organizationId) {
  return (worldState.entityOrganizationMemberships || [])
    .filter((m) => m.organization_id === organizationId).length;
}

// See the header: `organizations.members` is a stored placeholder and
// this reports the gap rather than closing it by writing back.
function describeMemberDrift(worldState, organizationId) {
  const organization = worldState.organizations.find((o) => o.id === organizationId);
  if (!organization) throw new Error(`describeMemberDrift: no organization ${organizationId}`);
  const stored = organization.members ?? null;
  const computed = memberCount(worldState, organizationId);
  return {
    organizationId,
    stored,
    computed,
    drifted: stored !== null && Number(stored) !== computed,
  };
}

// Both readings, reported separately — see the header.
function isGang(organization) {
  if (!organization) return false;
  return organization.type === 'gang' || organization.isFaction === true;
}

// -- the per-area statistics this exists for ----------------------------

// Every organization with at least one resident member in this
// community, with how many. **Presence is defined by people, not by
// address**, because an organization has no location column anywhere in
// the schema — and defining it by people is the more useful definition
// anyway: an organization with forty members on a block is present
// there whatever its registered office says.
function organizationPresence(worldState, communityId) {
  const residents = new Set(worldState.npcs
    .filter((n) => n.communityId === communityId)
    .map((n) => n.id));

  const byOrg = new Map();
  for (const m of worldState.entityOrganizationMemberships || []) {
    if (!residents.has(m.entity_id)) continue;
    byOrg.set(m.organization_id, (byOrg.get(m.organization_id) || 0) + 1);
  }

  const rows = [];
  for (const [organizationId, members] of byOrg) {
    const organization = worldState.organizations.find((o) => o.id === organizationId);
    rows.push({
      organizationId,
      type: organization?.type ?? null,
      members,
      isGang: isGang(organization),
      // `influence` is a real organization column with a real value,
      // unlike `members`. Reported as-is rather than scaled by local
      // headcount, which would be inventing a model of local influence
      // that no document describes.
      influence: organization?.influence ?? null,
    });
  }
  return rows.sort((a, b) => b.members - a.members || a.organizationId - b.organizationId);
}

// The share of an area's residents who belong to a gang or faction.
// **A share, not a count** — the same normalisation every cross-area
// statistic in this project uses, because a 40-person block and a
// 4,000-person district cannot be ranked on totals. An area with no
// residents returns null, not 0.
function gangMembershipRate(worldState, communityId) {
  const residents = worldState.npcs.filter((n) => n.communityId === communityId);
  if (residents.length === 0) return null;

  const gangIds = new Set(worldState.organizations.filter(isGang).map((o) => o.id));
  const ids = new Set(residents.map((n) => n.id));
  const affiliated = new Set();
  for (const m of worldState.entityOrganizationMemberships || []) {
    if (gangIds.has(m.organization_id) && ids.has(m.entity_id)) affiliated.add(m.entity_id);
  }
  // Counted per PERSON, not per membership: somebody in two factions
  // is one gang member, and counting rows would let a rate exceed 1.
  return Math.round((affiliated.size / residents.length) * 10000) / 10000;
}

module.exports = {
  findMembership,
  joinOrganization,
  leaveOrganization,
  releaseDeceased,
  membersOf,
  organizationsOf,
  memberCount,
  describeMemberDrift,
  isGang,
  organizationPresence,
  gangMembershipRate,
};
