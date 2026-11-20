// server/missionVariety.js
//
// Direct-reuse gameplay missions, by direct instruction ("It should be
// a business mission. It should be a barter mission... recruiting
// mission. It should be a spy mission... collaboration mission with
// another crew or organization"). Checked each one against the real
// engine before writing anything — the nineteenth standing rule's own
// discipline, applied here a third time.
//
// Three of the seven named in that instruction (business, drug,
// extortion) are NOT thin wrappers the way the other four are: checked
// directly, `businesses.foundBusiness`, `drugTrade.produceMarijuana`/
// `convertCrack`/`importSubstance`, and `extortion.runExtortion` all
// have no real player-facing verb at all — `grep -rn "foundBusiness\|
// produceMarijuana\|convertCrack\|importSubstance" server/actions.js
// server/engine.js` returns nothing. A "business mission" or "drug
// mission" that pointed at them would be pointing at a verb a player
// cannot actually call, which is the eleventh standing rule's own
// trap one layer up (a generator nothing calls, here a mission over a
// verb nothing routes to). Those three are left for their own round,
// named rather than silently skipped — see CLAUDE.md's own entry for
// this file.
//
// The four built here each route to a REAL, ALREADY player-facing
// verb, checked one at a time rather than assumed:
//   - recruit    → `call-meeting` with purpose `'recruit'` (real,
//                  `meetings.js`'s own PURPOSES table)
//   - alliance   → `call-meeting` with purpose `'form alliance'`
//                  (same table, same verb)
//   - spy        → `send-spy` (real, `espionage.sendSpy`)
//   - barter     → `trade` (real, `barter.exchange`) — the player's
//                  own existing trade path; this file's only addition
//                  is NAMING a real opportunity to use it on, not a
//                  new trade mechanic.
//
// Every function here follows the identical shape every other
// offer*Mission in this codebase already uses: returns `null` on an
// honest unmet precondition, never throws except for a bad entity id,
// and anchors at a real property via `missions.generateMission`
// (never a mission "about nothing").

const missions = require('./missions.js');
const membership = require('./membership.js');
const recruitment = require('./recruitment.js');
const mortality = require('./mortality.js');
const economy = require('./economy.js');
const inventory = require('./inventory.js');
const items = require('./items.js');

const MISSION_RECRUIT_REWARD = 40;
const MISSION_ALLIANCE_REWARD = 40;
const MISSION_SPY_REWARD = 40;
const MISSION_BARTER_REWARD = 40;

function communityAnchor(worldState, communityId) {
  return (worldState.properties || []).find((p) => p.community_id === communityId) ?? null;
}

function ownOrganizationIdOf(worldState, npcId) {
  const row = (worldState.entityOrganizationMemberships || [])
    .find((m) => m.entity_id === npcId);
  return row ? row.organization_id : null;
}

function ownFamilyIdOf(worldState, npcId) {
  const row = (worldState.familyMemberships || []).find((m) => m.entity_id === npcId);
  return row ? row.family_id : null;
}

// Real recruiting — names the single real, eligible, non-member
// resident of the citizen's own community `recruitment
// .eligibleCandidates` already computes (chaos recruitment's own
// candidate pool, read here for naming rather than for an automatic
// draw). Requires the citizen to actually hold a real organization to
// recruit INTO — recruiting for no organization is not a real mission.
function offerRecruitMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerRecruitMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const organizationId = options.organizationId ?? ownOrganizationIdOf(worldState, npcId);
  if (organizationId == null) return null;

  const candidates = recruitment.eligibleCandidates(worldState, organizationId, npc.communityId)
    .filter((n) => n.id !== npcId);
  if (candidates.length === 0) return null;
  const candidate = candidates[0];

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Recruit ${candidate.name ?? `entity ${candidate.id}`} — call a meeting with them, purpose recruit`,
    reward: options.reward ?? MISSION_RECRUIT_REWARD,
  });
  return { mission, candidateId: candidate.id, organizationId };
}

// Real alliance-forming — names the single real OTHER organization
// with the most real members present in the citizen's own community
// (`membership.organizationPresence`, the identical real rollup
// `familyDominance.dominantFamilyOf` already established for
// families). Never the citizen's own organization — proposing an
// alliance with yourself is not a real mission.
function offerAllianceMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerAllianceMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const ownOrgId = ownOrganizationIdOf(worldState, npcId);
  const rows = membership.organizationPresence(worldState, npc.communityId)
    .filter((r) => r.organizationId !== ownOrgId)
    .sort((a, b) => b.members - a.members);
  if (rows.length === 0) return null;
  const target = rows[0];
  const organization = (worldState.organizations || [])
    .find((o) => o.id === target.organizationId);
  if (!organization || organization.leader_id == null) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Propose an alliance with ${organization.name ?? `organization ${organization.id}`} — call a meeting with their leader, purpose form alliance`,
    reward: options.reward ?? MISSION_ALLIANCE_REWARD,
  });
  return { mission, organizationId: organization.id, leaderId: organization.leader_id };
}

// Real espionage — names a real spy (the citizen's own living family
// or organization member, `sendSpy`'s own required distinction) and a
// real OTHER community to send them to. `sendSpy` itself refuses a
// sponsor sending themselves and requires exactly one of
// organizationId/familyId — both checked here before naming anything,
// not re-validated a second way.
function offerSpyMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerSpyMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const organizationId = ownOrganizationIdOf(worldState, npcId);
  const familyId = organizationId == null ? ownFamilyIdOf(worldState, npcId) : null;
  if (organizationId == null && familyId == null) return null;

  let spyPool;
  if (organizationId != null) {
    spyPool = (worldState.entityOrganizationMemberships || [])
      .filter((m) => m.organization_id === organizationId)
      .map((m) => (worldState.npcs || []).find((n) => n.id === m.entity_id));
  } else {
    spyPool = (worldState.familyMemberships || [])
      .filter((m) => m.family_id === familyId)
      .map((m) => (worldState.npcs || []).find((n) => n.id === m.entity_id));
  }
  const spy = spyPool.find((n) => n && n.id !== npcId && n.status !== 'deceased');
  if (!spy) return null;

  const targetCommunity = (worldState.communities || [])
    .find((c) => c.id !== npc.communityId);
  if (!targetCommunity) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Send ${spy.name ?? `entity ${spy.id}`} to watch community ${targetCommunity.id} for real`,
    reward: options.reward ?? MISSION_SPY_REWARD,
  });
  return {
    mission, spyEntityId: spy.id, targetCommunityId: targetCommunity.id, organizationId, familyId,
  };
}

// Real bartering — names a real OTHER resident of the citizen's own
// community who actually holds a real unit of the single real survival
// resource (`mortality.SURVIVAL_RESOURCES`) the city is shortest on,
// the identical real `economy.getScarcity` reading `mortality
// .survivalScarcity` already reduces to one worst figure for Chain
// #3's own `offerSurvivalMission` — read per-resource here instead,
// since a barter needs an actual item NAME, not just a severity.
function offerBarterMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerBarterMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const cityId = (worldState.communities || [])
    .find((c) => c.id === npc.communityId)?.city_id ?? null;
  if (cityId == null) return null;

  const cityResources = (worldState.resources || []).filter((r) => r.city_id === cityId
    && mortality.SURVIVAL_RESOURCES.includes(r.resource_type));
  let shortest = null;
  for (const resource of cityResources) {
    const scarcity = economy.getScarcity(resource);
    if (scarcity > 50 && (shortest === null || scarcity > shortest.scarcity)) {
      shortest = { resourceName: resource.resource_type, scarcity };
    }
  }
  if (!shortest) return null;
  const { resourceName } = shortest;

  // The resource type ('water') and the item catalogue ('clean_water',
  // 'bottled_water') are two different real vocabularies — matched
  // here by each item's own real `category`, never assumed to share a
  // literal name.
  const itemNames = items.itemsFor(worldState)
    .filter((i) => i.category === resourceName)
    .map((i) => i.name);
  if (itemNames.length === 0) return null;

  const residents = (worldState.npcs || [])
    .filter((n) => n.communityId === npc.communityId && n.id !== npcId && n.status !== 'deceased');
  const holder = residents.find((n) => itemNames
    .some((name) => inventory.quantityOf(worldState, n.id, name) > 0));
  if (!holder) return null;
  const heldItemName = itemNames
    .find((name) => inventory.quantityOf(worldState, holder.id, name) > 0);

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Barter with ${holder.name ?? `entity ${holder.id}`} for their real ${heldItemName} — the city is genuinely short of ${resourceName}`,
    reward: options.reward ?? MISSION_BARTER_REWARD,
  });
  return { mission, partnerId: holder.id, resourceName, itemName: heldItemName };
}

module.exports = {
  MISSION_RECRUIT_REWARD,
  MISSION_ALLIANCE_REWARD,
  MISSION_SPY_REWARD,
  MISSION_BARTER_REWARD,
  offerRecruitMission,
  offerAllianceMission,
  offerSpyMission,
  offerBarterMission,
};
