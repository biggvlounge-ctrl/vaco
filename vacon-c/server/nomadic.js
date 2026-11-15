// server/nomadic.js
//
// By direct instruction: "a lot of groups and families and
// organizations will become nomadic after the chaos hits." Real,
// computed, never stored (standing rule 3) — a family or organization
// is nomadic right now when its own real head/leader is on a real
// active journey (`travel.js`) or at a real active camp
// (`camps.js`) — the exact two mechanics this round built for exactly
// this, never a third, invented "nomadic" flag or lifestyle field.
//
// **Checked against the family's own `head_npc_id`/the organization's
// own `leader_id`, not every member individually.** This engine's
// travel/camp "group" is the leader plus whoever actually joined their
// party (`party.partyOf`) — never required to be a family or
// organization's full roster — so the honest question this file
// answers is "is the real person who would actually call
// `beginJourney`/`establishCamp` for this group currently doing
// exactly that," not an invented headcount threshold over members who
// may never have been asked to come along.
//
// **Deliberately NOT folded into `statistics.js`'s own catalogue.**
// Every entry there is a community-scoped aggregate over residents; a
// family or organization is neither grain, the same "a different
// grain" reasoning `migrationPathwayPacks.js`'s own `dominantPathway`
// already gives for staying out of it. This is a direct, real,
// computed read instead, the same posture `getNetWorth`/`getPartyOf`/
// `getActiveJourney`/`getActiveCamp` already hold.

'use strict';

const travel = require('./travel.js');
const camps = require('./camps.js');

// What a real entity is doing right now, in the one vocabulary this
// file actually needs — never a third status alongside `activeJourneyFor`/`activeCampFor`'s own real objects.
function nomadicStatusOf(worldState, entityId) {
  const journey = travel.activeJourneyFor(worldState, entityId);
  if (journey) return { nomadic: true, reason: 'journey', journeyId: journey.id };
  const camp = camps.activeCampFor(worldState, entityId);
  if (camp) return { nomadic: true, reason: 'camp', campId: camp.id };
  return { nomadic: false, reason: null };
}

// `null` for a family with no real head at all — unknown, not false,
// the same "unobserved is not a zero" discipline this registry holds
// everywhere else.
function isNomadicFamily(worldState, familyId) {
  const family = (worldState.families || []).find((f) => f.id === Number(familyId));
  if (!family) throw new Error(`isNomadicFamily: no real family ${familyId}.`);
  if (family.head_npc_id == null) return null;
  return nomadicStatusOf(worldState, family.head_npc_id).nomadic;
}

function isNomadicOrganization(worldState, organizationId) {
  const org = (worldState.organizations || []).find((o) => o.id === Number(organizationId));
  if (!org) throw new Error(`isNomadicOrganization: no real organization ${organizationId}.`);
  if (org.leader_id == null) return null;
  return nomadicStatusOf(worldState, org.leader_id).nomadic;
}

module.exports = {
  nomadicStatusOf,
  isNomadicFamily,
  isNomadicOrganization,
};
