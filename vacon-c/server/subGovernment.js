// server/subGovernment.js
//
// By direct instruction: "sub-governments for orgs/tribes/gangs/
// towns, cohesion scaling with organization level" — task #46 of
// "the next 5 tasks."
//
// ---------------------------------------------------------------------
// Two of the four named kinds already have a real sub-government —
// checked directly before building anything, rather than assumed
// ---------------------------------------------------------------------
// **Towns** already have one: `politics.foundGovernment`'s real
// `scope_type: 'city'` government row (added for "the full political
// hierarchy (town/city/state/country)") is literally a government
// whose jurisdiction is narrower than the civilization-wide one — a
// sub-government in the exact sense this task names, already built,
// already tested, nothing to add here.
//
// **Gangs** already have one too: `membership.gangTierFor`'s own
// comment names `lieutenant` and `shot_caller` as "the rank[s] most
// trusted with command" among its six real tiers, re-derived every
// tick from live traits (`assignGangTiers`). That IS a gang's real
// internal command structure — this file reads it rather than
// building a second one, and never calls `leadership.assignRole` for
// a gang, because that function already refuses one outright (a
// player-assigned role there would be overwritten the very next tick).
//
// What is genuinely missing is the other two: an ORDINARY organization
// (a tribe, a business) has no formal sub-leader layer at all — only
// `leadership.assignRole`'s single, flat, one-role-at-a-time
// assignment and now `playbook.js`'s bulk functional categories,
// neither of which names an AUTHORITY tier the way a gang's tiers or a
// city's government do.
//
// ---------------------------------------------------------------------
// Sub-leaders for an ordinary organization — the same bulk-assignment
// shape `playbook.js` already established, a different real vocabulary
// ---------------------------------------------------------------------
// `SUBGOVERNMENT_ROLES` is flagged interpretive — no document fixes
// one — and deliberately a different, smaller vocabulary than
// `playbook.PLAYBOOK_CATEGORIES`: a playbook category is a FUNCTION
// ("what you work on"), a sub-government role is AUTHORITY ("who
// answers to the leader directly and who answers to them"). Conflating
// the two would let a single person hold two disagreeing kinds of
// standing under one field. `assignSubLeaders` is the identical
// per-member try/catch bulk wrapper `playbook.js#assignToPlaybook`
// already established over the same real `leadership.assignRole`
// primitive — never a second compliance mechanism, never a second
// write path to `role_in_org` — so it inherits that function's own
// real gang refusal rather than re-deciding it.
//
// ---------------------------------------------------------------------
// "Cohesion scaling with organization level" — level is real size,
// scaling is real structural coverage against it
// ---------------------------------------------------------------------
// "Organization level" is `membership.memberCount` — the identical
// real, already-used measure of organization size `influence.js`'s
// own `influenceRatingOf` already reads for the same reason (a bigger
// real roster is a bigger real fact about an organization, not a
// second invented "level" column). `MEMBERS_PER_SUBLEADER` is flagged
// interpretive — no document gives a real span-of-control number —
// and `subGovernmentCoverageOf` is the real ratio of actual sub-leaders
// (or, for a gang, actual command-tier members) against how many that
// real size calls for, clamped to 1 so an over-staffed organization
// does not report MORE than fully covered.
//
// `organizationCohesionOf` is the real cohesion figure, and it is
// deliberately NOT a copy of `familyTraits.cohesionOf`'s shape, stated
// here rather than silently diverging: that function blends a real
// PULL (family unity + cooperation) against a real DRAG (family
// conflict) because `families.conflict` is a real, written column.
// Organizations have no equivalent conflict column — checked directly,
// `traitDefinitions.ORGANIZATION_DEFINITIONS` names nine dimensions and
// none of them is one — so inventing a drag term here would be a
// second, disagreeing number with nothing real behind it. The real
// organization-side pull is `internalLoyalty` (the real org trait this
// vocabulary's own name already means), and the real second term this
// file DOES have is structural: `subGovernmentCoverageOf`. Cohesion is
// the real loyalty pull, narrowed toward half its value the less that
// real size is actually answered for — flagged interpretive
// (`UNCOVERED_COHESION_PENALTY`), the same honestly-labelled blend
// weight `influence.js`'s own three-component rating already uses.

'use strict';

const membership = require('./membership.js');
const leadership = require('./leadership.js');
const { getLiveEntity } = require('./entityTraits.js');

const SUBGOVERNMENT_ROLES = ['lieutenant', 'council_member', 'deputy'];

// `membership.gangTierFor`'s own named command tiers — read, never
// reassigned here (see this file's own header on why `assignRole`
// never touches a gang).
const GANG_COMMAND_TIERS = ['lieutenant', 'shot_caller'];

const MEMBERS_PER_SUBLEADER = 10;

// How much of `organizationCohesionOf`'s real loyalty pull survives
// at zero real sub-government coverage — the other half is earned
// back as coverage rises to 1.
const UNCOVERED_COHESION_PENALTY = 0.5;

function requiredSubLeadersFor(worldState, organizationId) {
  const count = membership.memberCount(worldState, organizationId);
  return Math.floor(count / MEMBERS_PER_SUBLEADER);
}

// Every real member currently holding a real command/sub-leader role
// -- the gang's own real tier names for a gang/faction organization,
// this file's own real vocabulary for an ordinary one. Never both at
// once: an organization is one or the other (`membership.isGang`).
function currentSubLeadersOf(worldState, organizationId) {
  const organization = (worldState.organizations || []).find((o) => o.id === organizationId);
  const commandRoles = membership.isGang(organization) ? GANG_COMMAND_TIERS : SUBGOVERNMENT_ROLES;
  return (worldState.entityOrganizationMemberships || [])
    .filter((m) => m.organization_id === organizationId && commandRoles.includes(m.role_in_org))
    .map((m) => m.entity_id);
}

// 1 for an organization too small to structurally need a sub-leader
// at all -- there is nothing uncovered to report, the same "no real
// term, no penalty" posture `familyTraits.cohesionOf` already applies
// when a real input is absent rather than measured as a deficient 0.
function subGovernmentCoverageOf(worldState, organizationId) {
  const required = requiredSubLeadersFor(worldState, organizationId);
  if (required <= 0) return 1;
  const actual = currentSubLeadersOf(worldState, organizationId).length;
  return Math.max(0, Math.min(1, actual / required));
}

function organizationCohesionOf(worldState, organizationId) {
  const organization = (worldState.organizations || []).find((o) => o.id === organizationId);
  if (!organization) return null;

  const live = getLiveEntity(worldState, organizationId);
  const internalLoyalty = Number(live?.traits?.organization?.internalLoyalty);
  const pull = (Number.isFinite(internalLoyalty) ? internalLoyalty : 50) / 100;
  const coverage = subGovernmentCoverageOf(worldState, organizationId);
  const cohesion = pull * (UNCOVERED_COHESION_PENALTY + (1 - UNCOVERED_COHESION_PENALTY) * coverage);
  return Math.round(Math.max(0, Math.min(1, cohesion)) * 10000) / 10000;
}

// Bulk sub-leader assignment for an ORDINARY organization — the
// identical per-member try/catch shape `playbook.js#assignToPlaybook`
// already established over the same real `leadership.assignRole`
// primitive, a different bounded vocabulary. A gang organization is
// refused by `assignRole` itself, per member, for the real reason
// stated there -- never re-decided here.
function assignSubLeaders(worldState, leaderEntityId, options = {}) {
  const {
    organizationId, subordinateEntityIds, role, tick = worldState.tick ?? 0,
  } = options;

  if (!SUBGOVERNMENT_ROLES.includes(role)) {
    throw new Error(
      `assignSubLeaders: "${role}" is not a real sub-government role. The `
      + `${SUBGOVERNMENT_ROLES.length} are: ${SUBGOVERNMENT_ROLES.join(', ')}.`,
    );
  }
  if (!Array.isArray(subordinateEntityIds) || subordinateEntityIds.length === 0) {
    throw new Error('assignSubLeaders requires a non-empty subordinateEntityIds list.');
  }

  return subordinateEntityIds.map((subordinateEntityId) => {
    try {
      const result = leadership.assignRole(worldState, leaderEntityId, {
        organizationId, subordinateEntityId, role, tick,
      });
      return { subordinateEntityId, ...result, refusalReason: null };
    } catch (err) {
      return {
        subordinateEntityId, complied: false, refusedBy: subordinateEntityId,
        role: null, refusalReason: err.message,
      };
    }
  });
}

module.exports = {
  SUBGOVERNMENT_ROLES,
  GANG_COMMAND_TIERS,
  MEMBERS_PER_SUBLEADER,
  UNCOVERED_COHESION_PENALTY,
  requiredSubLeadersFor,
  currentSubLeadersOf,
  subGovernmentCoverageOf,
  organizationCohesionOf,
  assignSubLeaders,
};
