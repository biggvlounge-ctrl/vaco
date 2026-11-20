// server/playbook.js
//
// By direct instruction: "playbook/role-allocation system (assign N
// members to strategy/security/etc.)" — task #45 of "the next 5
// tasks."
//
// ---------------------------------------------------------------------
// This is the already-built task-delegation primitive, bulked and
// bounded — not a second role-assignment mechanism
// ---------------------------------------------------------------------
// Task #44 is `leadership.js#assignRole` — a real leader assigns ONE
// real subordinate ONE role, gated on that subordinate's own real
// `relationships.loyalty` (`complianceDraw`, the identical compliance
// mechanism `directMission` already uses), writing the real
// `entityOrganizationMemberships.role_in_org` column
// (`membership.joinOrganization`). It already refuses a gang/faction
// organization outright, because `membership.assignGangTiers` runs
// every tick and would clobber a player-assigned role immediately.
//
// "A playbook" is exactly this, asked for in bulk and from a real,
// BOUNDED vocabulary rather than `assignRole`'s own free text for
// organizations — the task's own examples name "strategy/security/
// etc.", not an open string. `assignToPlaybook` loops real subordinate
// ids through `leadership.assignRole` directly — never a second
// compliance draw, never a second write path to `role_in_org` — and
// `playbookOf` is a real, computed-never-stored rollup (standing rule
// 3) over `membership.membersOf`/`findMembership`, the same posture
// `businesses.js#market_share`/`families.wealth` already take rather
// than a second count stored and allowed to drift from the real rows.
//
// ---------------------------------------------------------------------
// One member's refusal does not erase what happened to the others
// ---------------------------------------------------------------------
// `assignRole` throws on a real refusal condition (not a member, the
// leader naming themselves, a gang organization). A naive `Array.
// prototype.map` over N subordinates would let the FIRST thrown error
// abort the whole batch and discard the real, already-applied outcome
// for every member processed before it — not a half-applied state
// (each individual `assignRole` call is still atomic), but a REPORTED
// one that would hide real successes behind one real failure.
// `assignToPlaybook` catches per member, so "six complied, one was
// refused, one was not a real member" is the honest, complete report
// a bulk operation owes its caller.
//
// `PLAYBOOK_CATEGORIES` is flagged interpretive — no document fixes a
// playbook vocabulary, and checked directly before writing it:
// `traitDefinitions.ORGANIZATION_DEFINITIONS` names nine real
// dimensions (`power`, `membership`, `production`, `territory`,
// `resources`, `leadershipQuality`, `internalLoyalty`, `diplomacy`,
// `growthPotential`) and none of them is "security" or "operations" —
// so this vocabulary is not read off that sheet, only kept to the
// task's own two named examples (`strategy`, `security`) plus two
// further functional areas (`operations`, `recruitment`) small enough
// to stay honestly invented rather than dressed up as derived from a
// real trait family that does not actually name them.

'use strict';

const leadership = require('./leadership.js');
const membership = require('./membership.js');

const PLAYBOOK_CATEGORIES = ['strategy', 'security', 'operations', 'recruitment'];

function assignToPlaybook(worldState, leaderEntityId, options = {}) {
  const {
    organizationId, subordinateEntityIds, category, tick = worldState.tick ?? 0,
  } = options;

  if (!PLAYBOOK_CATEGORIES.includes(category)) {
    throw new Error(
      `assignToPlaybook: "${category}" is not a real playbook category. The `
      + `${PLAYBOOK_CATEGORIES.length} are: ${PLAYBOOK_CATEGORIES.join(', ')}.`,
    );
  }
  if (!Array.isArray(subordinateEntityIds) || subordinateEntityIds.length === 0) {
    throw new Error('assignToPlaybook requires a non-empty subordinateEntityIds list.');
  }

  return subordinateEntityIds.map((subordinateEntityId) => {
    try {
      const result = leadership.assignRole(worldState, leaderEntityId, {
        organizationId, subordinateEntityId, role: category, tick,
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

// Every real current member of this organization, grouped by their
// own real, live `role_in_org` -- never a second tally kept in sync
// by hand. A member whose role is unset, or set to something outside
// the real bounded vocabulary (free text `assignRole` still allows
// directly), is reported as unassigned rather than silently dropped.
function playbookOf(worldState, organizationId) {
  const breakdown = {};
  for (const category of PLAYBOOK_CATEGORIES) breakdown[category] = [];
  const unassigned = [];

  for (const member of membership.membersOf(worldState, organizationId)) {
    const row = membership.findMembership(worldState, member.id, organizationId);
    const role = row?.role_in_org ?? null;
    if (role !== null && PLAYBOOK_CATEGORIES.includes(role)) {
      breakdown[role].push(member.id);
    } else {
      unassigned.push(member.id);
    }
  }
  return { breakdown, unassigned };
}

module.exports = {
  PLAYBOOK_CATEGORIES,
  assignToPlaybook,
  playbookOf,
};
