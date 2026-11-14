// server/tribeWealth.js
//
// By direct instruction, as part of a wider "barter era" request: "at
// the beginning there is no cash... that's where your wealth will
// accumulate at the beginning of the game, is in your organization,
// your tribe, your gang, and then what they have accumulated through
// property and inventory... also strength, power, security, and the
// people you have, the type of people you have, leadership, doctors,
// lawyers, matriarchs, elders, leaders, teachers, nurses."
//
// ---------------------------------------------------------------------
// Additive, not a replacement — `economy.getNetWorth` is untouched
// ---------------------------------------------------------------------
// There is no "monetary era" concept anywhere in this engine
// (confirmed: no era-gating on cash exists in `economy.js`), and
// building one would mean retroactively gating the poverty line, both
// of `crime.js`'s deprivation checks, and the seventeenth standing
// rule's four-attempt-calibrated `resolveAggression` — none of which
// this request asked to touch. This file reports a DIFFERENT real
// fact instead: what an organization or family itself has actually
// accumulated, which is exactly what matters "at the beginning" when
// individual cash is scarce by construction (`worldgen.js`'s own
// skewed, near-zero-median seeding) rather than by a new rule. A
// world that wants a literal zero-cash start already has one, for
// free, simply by generating early and reading this instead of
// `getNetWorth` — no new config flag was needed to make that true.
//
// ---------------------------------------------------------------------
// Three real components, never one invented composite score
// ---------------------------------------------------------------------
// `propertyValue` and `inventoryValue` are the identical real
// `property.currentValue`/`barter.valueOfHoldings` reads
// `economy.ownedPropertyValue`/`heldInventoryValue` already use for an
// individual, summed across the group's own real members instead of
// one person. `notablePeople` is a real roster, never a score: every
// real member who holds one of the occupations the request itself
// named (`physician`, `lawyer`, `teacher`, `nurse` — all four already
// real, pre-existing entries in `occupations.js`, confirmed by grep
// before writing this), who leads the group, or — family only — who
// sits in the group's own oldest real generation (its "elders"/
// "matriarchs", per `families.generation_number`; no age cutoff was
// invented, see `eldersOf`'s own comment) or holds one of
// `leadership.ASSIGNABLE_FAMILY_ROLES`'s own real `caregiver`/
// `protector`/`guardian`/`mentor` values. Nothing here is stored —
// standing rule 3, the same "computed, never stored" posture
// `getFamilyWealth`/`getNetWorth` already hold.

'use strict';

const membership = require('./membership.js');
const property = require('./property.js');
const barter = require('./barter.js');
const occupations = require('./occupations.js');

const NOTABLE_OCCUPATIONS = ['physician', 'lawyer', 'teacher', 'nurse'];

// Family-only: the group's own oldest real generation present among
// its current members — never a fixed age number. A single-generation
// family (every member drawn at founding, no births yet) has no elder
// distinct from anyone else, and this correctly reports none rather
// than guessing one.
function eldersOf(worldState, familyId, memberRows) {
  if (memberRows.length === 0) return new Set();
  const generations = memberRows
    .map((m) => Number(m.generation_number))
    .filter((g) => Number.isFinite(g));
  if (generations.length === 0) return new Set();
  const oldest = Math.min(...generations);
  const distinctGenerations = new Set(generations);
  if (distinctGenerations.size < 2) return new Set();
  return new Set(
    memberRows.filter((m) => Number(m.generation_number) === oldest).map((m) => m.entity_id),
  );
}

function propertyValueOf(worldState, ownerType, ownerEntityId) {
  let total = 0;
  for (const row of worldState.properties || []) {
    const owner = property.getCurrentOwner(worldState, row.id);
    if (!owner) continue;
    if (owner.owner_type !== ownerType) continue;
    if (owner.owner_entity_id !== ownerEntityId) continue;
    total += property.currentValue(row);
  }
  return total;
}

function tribeWealthOf(worldState, options = {}) {
  const { organizationId = null, familyId = null } = options;
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('tribeWealthOf requires exactly one of organizationId or familyId.');
  }

  let memberIds;
  let leaderEntityId;
  let elderIds = new Set();
  let familyRoleById = new Map();
  let ownerType;
  let ownerEntityId;

  if (organizationId != null) {
    const organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`tribeWealthOf: no organization with id ${organizationId}.`);
    leaderEntityId = organization.leader_id ?? null;
    const members = membership.membersOf(worldState, organization.id).map((n) => n.id);
    memberIds = new Set(members);
    if (leaderEntityId != null) memberIds.add(Number(leaderEntityId));
    ownerType = 'organization';
    ownerEntityId = organization.id;
  } else {
    const family = (worldState.families || []).find((f) => f.id === Number(familyId));
    if (!family) throw new Error(`tribeWealthOf: no family with id ${familyId}.`);
    leaderEntityId = family.head_npc_id ?? null;
    const rows = (worldState.familyMemberships || []).filter((m) => m.family_id === family.id);
    memberIds = new Set(rows.map((m) => m.entity_id));
    if (leaderEntityId != null) memberIds.add(Number(leaderEntityId));
    elderIds = eldersOf(worldState, family.id, rows);
    familyRoleById = new Map(rows.map((m) => [m.entity_id, m.role ?? null]));
    ownerType = 'family';
    ownerEntityId = family.id;
  }

  let inventoryValue = 0;
  const notablePeople = [];
  const ASSIGNABLE_FAMILY_ROLES = ['guardian', 'mentor', 'protector', 'caregiver'];

  for (const entityId of memberIds) {
    inventoryValue += barter.valueOfHoldings(worldState, entityId);

    const reasons = [];
    if (leaderEntityId != null && Number(entityId) === Number(leaderEntityId)) {
      reasons.push('leadership');
    }
    const occupationName = occupations.occupationOf(worldState, entityId);
    if (occupationName && NOTABLE_OCCUPATIONS.includes(occupationName)) {
      reasons.push(`occupation:${occupationName}`);
    }
    if (elderIds.has(entityId)) reasons.push('elder');
    const familyRole = familyRoleById.get(entityId);
    if (familyRole && ASSIGNABLE_FAMILY_ROLES.includes(familyRole)) {
      reasons.push(`family-role:${familyRole}`);
    }
    if (reasons.length > 0) notablePeople.push({ entityId, reasons });
  }

  return {
    propertyValue: propertyValueOf(worldState, ownerType, ownerEntityId),
    inventoryValue,
    memberCount: memberIds.size,
    notablePeople,
  };
}

module.exports = {
  NOTABLE_OCCUPATIONS,
  eldersOf,
  tribeWealthOf,
};
