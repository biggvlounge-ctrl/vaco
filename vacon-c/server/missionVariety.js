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
const produce = require('./produce.js');
const travel = require('./travel.js');
const vehicles = require('./vehicles.js');
const geo = require('./geo.js');
const nomadic = require('./nomadic.js');
const camps = require('./camps.js');
const control = require('./control.js');
const authority = require('./authority.js');
const extortion = require('./extortion.js');
const businesses = require('./businesses.js');
const drugTrade = require('./drugTrade.js');
const property = require('./property.js');

const MISSION_RECRUIT_REWARD = 40;
const MISSION_ALLIANCE_REWARD = 40;
const MISSION_SPY_REWARD = 40;
const MISSION_BARTER_REWARD = 40;
const MISSION_HUNT_REWARD = 40;
const MISSION_TRAVEL_REWARD = 40;
const MISSION_NOMADIC_REWARD = 40;
const MISSION_EXPANSION_REWARD = 40;
const MISSION_EXTORTION_REWARD = 40;
const MISSION_BUSINESS_REWARD = 40;
const MISSION_DRUG_REWARD = 40;
const MISSION_RAILWAY_REWARD = 40;

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

// **Task #133, the fifth and last of this round.** Real hunting --
// requires the citizen to actually be employed as a `hunter` with the
// real Combat skill and Tier 2 `occupations.tierReachable` this
// setting demands (`produce.canHarvest`'s own gate, read here rather
// than duplicated), because a mission "to go hunting" for someone not
// genuinely qualified for the work would be a mission about nothing,
// the same standard every other function in this file already holds.
//
// Points at the real `harvest` verb this same round added to
// `actions.js` -- `engine.js`'s own header on it names exactly the
// trap this closes: a mission over a generator nothing routed to,
// same shape this file's own header already names for business/drug/
// extortion.
function offerHuntMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerHuntMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const check = produce.canHarvest(worldState, npcId, 'raw_meat');
  if (!check.ok) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: 'Hunt -- harvest raw_meat, the real work your own hunter employment already qualifies you for',
    reward: options.reward ?? MISSION_HUNT_REWARD,
  });
  return { mission };
}

// **Task #119 — the real, already-player-facing `begin-journey` verb
// (`travel.beginJourney`) already fully supports a vehicle and real
// fuel: a vehicle journey consumes one real unit of `vehicles
// .FUEL_ITEM_NAME` from the leader every real travelling day
// (`travel.js#advanceJourneys`'s own header), and genuinely running out
// stalls the trip rather than harming anybody. This file's own job is
// naming a real opportunity where that fuel constraint actually bites
// — never a second fuel mechanic beside it.
//
// `totalDays` is recomputed here with the IDENTICAL formula
// `beginJourney` itself uses (distance / speed, `Math.ceil`, floor of
// 1) — not a duplicate mechanism disagreeing with it, the same
// look-before-you-spend relationship `assessTakeover`/`attemptTakeover`
// and `make-thing`'s own check flag already have to their committing
// twin, because `beginJourney` cannot be called just to preview a
// trip without actually starting it.
//
// Scans every real OTHER city the citizen could drive to and offers
// the one with the GREATEST real fuel shortfall — the identical
// "pick the worst real case" shape `offerBarterMission` already uses
// for the scarcest resource — and returns null when the citizen's own
// real fuel is genuinely enough for every one of them.
function offerTravelMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerTravelMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const originCityId = travel.cityOf(worldState, npcId);
  if (originCityId == null) return null;
  const originCity = (worldState.cities || []).find((c) => c.id === originCityId);
  if (!originCity) return null;

  const heldVehicleType = vehicles.VEHICLE_TYPES
    .find((type) => vehicles.kmPerDayFor(worldState, npcId, type) !== null);
  if (!heldVehicleType) return null;
  const kmPerDay = vehicles.kmPerDayFor(worldState, npcId, heldVehicleType);
  const fuelHeld = inventory.quantityOf(worldState, npcId, vehicles.FUEL_ITEM_NAME);

  let worst = null;
  for (const destinationCity of (worldState.cities || [])) {
    if (destinationCity.id === originCityId) continue;
    const distanceMetres = geo.distanceMetres(geo.positionOf(originCity), geo.positionOf(destinationCity));
    if (distanceMetres === null) continue;
    const totalDays = Math.max(1, Math.ceil(distanceMetres / (kmPerDay * 1000)));
    const shortfall = totalDays - fuelHeld;
    if (shortfall > 0 && (worst === null || shortfall > worst.shortfall)) {
      worst = { destinationCity, totalDays, shortfall };
    }
  }
  if (!worst) return null;
  const { destinationCity, totalDays } = worst;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Travel by ${heldVehicleType} to ${destinationCity.name ?? `city ${destinationCity.id}`} — `
      + `the trip needs ${totalDays} real day(s) of fuel and you genuinely hold only ${fuelHeld}`,
    reward: options.reward ?? MISSION_TRAVEL_REWARD,
  });
  return {
    mission, destinationCityId: destinationCity.id, vehicleType: heldVehicleType, totalDays, fuelHeld,
  };
}

// **Task #125 — the real nomadic/travel wrapper, reusing
// `nomadic.js` and `travel.js` directly rather than inventing a third
// "becoming nomadic" mechanic beside them.** `nomadic.js`'s own
// header is explicit that this engine already has exactly two real
// nomadic mechanisms — an active real journey (`travel.js`) or an
// active real camp (`camps.js`) — and nothing else. A citizen whose
// own family/organization head is CURRENTLY at a real camp (the
// `reason: 'camp'` half of `nomadic.nomadicStatusOf`) is living the
// nomadic life this round is named for; the real next step is the
// OTHER of the two mechanisms — breaking camp and setting out for a
// real city — which is exactly what `begin-journey` already does.
//
// **Deliberately scoped to the camp case only, not the journey
// case.** A head already on a real journey cannot begin a second one
// (`travel.beginJourney`'s own "already on a real journey" refusal)
// , so there is no real resolution verb to point a journey-in-
// progress mission at — the eleventh standing rule's trap, avoided
// before writing the branch rather than discovered by a failing call.
//
// Picks the real NEAREST other city, not the worst case
// `offerTravelMission` picks — that function is about a real fuel
// shortfall biting; this one is about getting a nomadic group back to
// settled life as soon as honestly possible, a different real
// question even though both scan `worldState.cities` with the same
// real `geo.distanceMetres`.
function offerNomadicMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerNomadicMission: no NPC ${npcId}`);

  const organizationId = ownOrganizationIdOf(worldState, npcId);
  const familyId = organizationId == null ? ownFamilyIdOf(worldState, npcId) : null;
  if (organizationId == null && familyId == null) return null;

  const headId = organizationId != null
    ? (worldState.organizations || []).find((o) => o.id === organizationId)?.leader_id
    : (worldState.families || []).find((f) => f.id === familyId)?.head_npc_id;
  if (headId == null) return null;

  const status = nomadic.nomadicStatusOf(worldState, headId);
  if (!status.nomadic || status.reason !== 'camp') return null;

  const camp = camps.campOf(worldState, status.campId);
  if (!camp) return null;

  const originCityId = (worldState.communities || [])
    .find((c) => c.id === camp.communityId)?.city_id ?? null;
  if (originCityId == null) return null;
  const originCity = (worldState.cities || []).find((c) => c.id === originCityId);
  if (!originCity) return null;

  let nearest = null;
  for (const destinationCity of (worldState.cities || [])) {
    if (destinationCity.id === originCityId) continue;
    const distanceMetres = geo.distanceMetres(geo.positionOf(originCity), geo.positionOf(destinationCity));
    if (distanceMetres === null) continue;
    if (nearest === null || distanceMetres < nearest.distanceMetres) {
      nearest = { destinationCity, distanceMetres };
    }
  }
  if (!nearest) return null;
  const { destinationCity } = nearest;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, camp.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Break camp and travel to ${destinationCity.name ?? `city ${destinationCity.id}`} — `
      + 'the nearest real place to actually resettle',
    reward: options.reward ?? MISSION_NOMADIC_REWARD,
  });
  return { mission, campId: camp.id, destinationCityId: destinationCity.id };
}

// **Task #124 — org expansion, reusing `control.viableTargetsFor`
// directly rather than scanning for a second, disagreeing notion of
// "what could this tribe take."** `viableTargetsFor(worldState,
// {tribeId, cityId, tick})` is the real, already-tested
// (`control.test.js`) scan over every real candidate in one city;
// this is that identical scan pointed at a city the citizen's own
// organization does not already reach — which is what "expansion"
// has to mean for an organization, since `control.js`'s own
// organization-scale comment already states "organizations have no
// city of their own in the schema."
//
// An organization's HOME city is read the only way the schema
// actually records one: the real properties it operates
// (`properties.operating_organization_id`), never a second, invented
// "headquarters" field. An organization with no real property
// anywhere yet has nowhere to expand FROM; a world with only one real
// city has nowhere to expand TO. Both are honest unmet preconditions
// — the eleventh standing rule's shape — not thrown errors.
//
// **Scans every real non-home city in order and offers the FIRST real
// viable target it finds — not the first non-home CITY**, which can
// hold no viable target at all while a later city does. Checked
// directly rather than assumed: within one call, `tribeId` and
// `tick` are fixed, so `control.assess`'s own `margin` term
// (`min(1, roster.fielded / composition.total)`) is provably exactly 1
// on EVERY candidate `compositionRequirementMet` ever accepts — summing
// a met role's own count across every required role already puts
// `fielded` at or above `total`, and `fielded` only sums MORE than that
// once unrequired roles are folded in. So `finalSuccessProbability`
// (`margin * tribeCohesionScore`) is identical on every real viable
// candidate a single call can ever compare, for the identical tribe —
// there is no real "better" target to rank among them, only a real
// "found one" versus "kept looking." A version of this that compared
// `finalSuccessProbability` across candidates would be comparing a
// constant to itself, the eleventh standing rule's shape one level
// down inside a loop rather than around a whole function.
//
// The resolution verb is the real `attempt-takeover` already exposed
// (tribe-scoped, exactly as `COMPOSITION_REQUIREMENTS_TRIBE_COHESION
// .md` specifies) — this function names a real opportunity for it,
// the same "naming, not a new mechanic" role every sibling function
// in this file plays.
function offerExpansionMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerExpansionMission: no NPC ${npcId}`);

  const organizationId = ownOrganizationIdOf(worldState, npcId);
  if (organizationId == null) return null;
  // A fast, documenting early-exit, not a load-bearing one:
  // `control.assess` already returns null for a `tribeId` no real
  // family matches, so every candidate below would be excluded on its
  // own even without this. Kept anyway for the same reason
  // `tribeIdFor`'s own (thrown) version is kept one layer up --
  // see test/missionVariety.test.js's own note on why this is not
  // mutation-guarded.
  const tribeId = ownFamilyIdOf(worldState, npcId);
  if (tribeId == null) return null;

  const homeProperties = (worldState.properties || [])
    .filter((p) => p.operating_organization_id === organizationId);
  if (homeProperties.length === 0) return null;

  const homeCityIds = new Set();
  for (const property of homeProperties) {
    const community = (worldState.communities || [])
      .find((c) => c.id === property.community_id);
    if (community) homeCityIds.add(community.city_id);
  }

  const tick = options.tick ?? worldState.tick ?? 0;
  let best = null;
  let bestCity = null;
  for (const city of (worldState.cities || [])) {
    if (homeCityIds.has(city.id)) continue;
    const targets = control.viableTargetsFor(worldState, { tribeId, cityId: city.id, tick })
      .filter((t) => t.scale === 'property');
    if (targets.length > 0) {
      [best] = targets;
      bestCity = city;
      break;
    }
  }
  if (!best) return null;

  const anchor = (worldState.properties || []).find((p) => p.id === best.locationId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Take ${anchor.type ?? 'a property'} in `
      + `${bestCity.name ?? `city ${bestCity.id}`} for your own organization — `
      + 'real expansion into a city it does not already reach',
    reward: options.reward ?? MISSION_EXPANSION_REWARD,
  });
  return {
    mission,
    destinationCityId: bestCity.id,
    locationId: anchor.id,
    finalSuccessProbability: best.finalSuccessProbability,
  };
}

// **Task #130, closing the extortion verb gap this file's own header
// named when business/drug/extortion were split out of task #118.**
// Same shape task #133 already used for hunting: build the missing
// real verb first (`extortion.demandTribute`), then wrap it.
//
// Requires the npc to actually LEAD a real organization — membership
// alone (`ownOrganizationIdOf`) is not enough, because
// `demandTribute`'s own real authority check requires leadership too,
// and offering a mission a player could never actually resolve would
// be a mission about nothing. Scans every real community this led
// organization genuinely holds (`authority.holderOf`, never
// `governed`) for a real other organization operating a property
// there with positive real assets — the identical real precondition
// `demandTribute` itself re-checks, read here rather than duplicated.
function offerExtortionMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerExtortionMission: no NPC ${npcId}`);

  const ledOrg = (worldState.organizations || []).find((o) => o.leader_id === npcId);
  if (!ledOrg) return null;

  for (const community of (worldState.communities || [])) {
    const writ = authority.writOf(worldState, community.id);
    if (writ.regime === 'governed') continue;
    if (authority.holderOf(worldState, community.id) !== ledOrg.id) continue;

    const target = extortion.operatingBusinessesIn(worldState, community.id, ledOrg.id)
      .find((org) => (Number(org.assets) || 0) > 0);
    if (!target) continue;

    const anchor = options.anchorPropertyId != null
      ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
      : communityAnchor(worldState, community.id);
    if (!anchor) continue;

    const mission = missions.generateMission(worldState, {
      locationId: anchor.id,
      objective: `Demand tribute from organization ${target.id} — your own organization `
        + `${ledOrg.id} genuinely holds this ground`,
      reward: options.reward ?? MISSION_EXTORTION_REWARD,
    });
    return {
      mission, targetOrganizationId: target.id, factionOrganizationId: ledOrg.id, communityId: community.id,
    };
  }
  return null;
}

// **Task #128, closing the business verb gap this file's own header
// named when business/drug/extortion were split out of task #118.**
// Same shape task #130 already used for extortion: build the missing
// real verb first (`engine.js`'s own `foundBusiness`, wired to
// `businesses.foundBusiness`), then wrap it.
//
// Reads the IDENTICAL real precondition `businesses.foundBusiness`
// itself re-checks — a real working-age citizen with real savings at
// or above the real startup capital `economy.goingWage` implies right
// now — so this never offers a mission the real verb would then
// refuse. Does not check `eligibleFounders`' age/imprisoned gate a
// second time with invented logic; it is read directly below instead.
function offerBusinessMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerBusinessMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;
  if (npc.status === 'imprisoned') return null;

  const tick = options.tick ?? worldState.tick ?? 0;
  const age = (tick - (npc.createdTick ?? 0)) / 365;
  if (age < economy.WORKING_AGE) return null;

  const wage = economy.goingWage(worldState, null);
  if (wage === null) return null;
  const capital = Math.round(wage * businesses.STARTUP_CAPITAL_WAGE_MULTIPLE);
  const finances = economy.getLatestFinances(worldState, npcId);
  const savings = Number(finances?.savings ?? 0);
  if (!(capital > 0) || savings < capital) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: 'Found a real business — your own real savings genuinely cover the real '
      + `startup capital this requires (${capital})`,
    reward: options.reward ?? MISSION_BUSINESS_REWARD,
  });
  return { mission, capital };
}

// **Task #129, the eleventh `offer*Mission`, closing the drug verb
// gap this file's own header named alongside business and extortion.**
// Same shape task #130/#128 already used: build the missing real verb
// first (`drugTrade.dealDrugs`, composing the identical `resolveSale`
// code `runStreetDealing`'s own sweep already shares), then wrap it.
//
// Reads the IDENTICAL real precondition `dealDrugs` itself re-checks
// — real soldier/associate gang tier, holding a real substance —
// never a second, looser gate that could offer a mission the real
// verb would then refuse.
function offerDrugMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerDrugMission: no NPC ${npcId}`);

  const org = drugTrade.gangOf(worldState, npcId);
  if (!org) return null;
  const tick = options.tick ?? worldState.tick ?? 0;
  const tier = membership.gangTierFor(worldState, org.id, npcId, tick);
  if (tier !== 'soldier' && tier !== 'associate') return null;

  const substanceSet = new Set(drugTrade.SUBSTANCE_NAMES);
  const holding = (worldState.inventory || []).find(
    (h) => h.holder_entity_id === npcId && substanceSet.has(h.item_name) && Number(h.quantity) > 0,
  );
  if (!holding) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Deal your real held ${holding.item_name} on the street — your own real gang `
      + 'membership already covers this',
    reward: options.reward ?? MISSION_DRUG_REWARD,
  });
  return { mission, itemName: holding.item_name, quantity: holding.quantity };
}

// **The twelfth `offer*Mission`, by direct instruction — "the train
// network... getting trains back available, up and running, railways
// back and running" — and a real, named override of this project's
// own standing Transportation deferral, not a silent bypass of it.**
// Reached from the locked scope list's "Explicitly deferred — do not
// touch: ... Transportation", the identical gate that keeps airport/
// plane travel (task #197) and inter-city road routing (`world-layer/
// imports/overtureTransportationImport.js`'s own header) closed. The
// thirty-second standing rule's own words apply exactly here too:
// "an explicit, binding project policy... the distinction... is worth
// surfacing before writing the reader" — surfaced here, and overridden
// here, on the same footing Leader mode's own reopening ("explicit
// human instruction") already established for a locked scope item,
// never a quiet workaround.
//
// **Deliberately the narrowest real thing the instruction actually
// asked for.** "Getting trains back available... railways back and
// running" is restoring a REAL, already-generated landmark to working
// order — not inter-city train travel, routing, or a new transport
// mechanic, none of which were asked for and all of which the
// Transportation deferral still covers untouched. `train-station` is
// already a real, founding Key landmark category (`landmarks.js`'s own
// twenty-four, staffed by `navigator`), already given a real operating
// business organization by `worldgen.js`'s own landmark-operator pass
// (named explicitly alongside airport/art-museum/zoo-aquarium in that
// pass's own comment) — so "restoring the railway" is exactly
// `property.renovateProperty` (task #239) pointed at a real
// `train-station`, never a second repair mechanic invented beside it.
//
// Reads the IDENTICAL real precondition `renovateProperty` itself
// re-checks — `canLock`'s own real-stake test — via the station's real
// operating organization, never a second, looser gate that could offer
// a mission the real verb would then refuse.
function offerRailwayMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerRailwayMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  if (!community) return null;

  // Matched by the station's own real community's city, never by a
  // property's bare `city_id` alone — the identical "resolve a city
  // through a property's real community" read `offerExpansionMission`
  // already uses, so a hand-built fixture that never set `city_id`
  // directly is read the same honest way a generated world is.
  const station = (worldState.properties || []).find((p) => {
    if (p.landmark_category !== 'train-station') return false;
    if (Number(p.condition) >= 100) return false;
    const stationCommunity = (worldState.communities || []).find((c) => c.id === p.community_id);
    return stationCommunity && stationCommunity.city_id === community.city_id;
  });
  if (!station) return null;
  if (!property.canLock(worldState, station.id, npcId)) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : station;
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: 'Get the railway running again — restore this real train station, the real '
      + 'work your own stake in its operating organization already qualifies you for',
    reward: options.reward ?? MISSION_RAILWAY_REWARD,
  });
  return { mission, stationPropertyId: station.id };
}

module.exports = {
  MISSION_RECRUIT_REWARD,
  MISSION_ALLIANCE_REWARD,
  MISSION_SPY_REWARD,
  MISSION_BARTER_REWARD,
  MISSION_HUNT_REWARD,
  MISSION_TRAVEL_REWARD,
  MISSION_NOMADIC_REWARD,
  MISSION_EXPANSION_REWARD,
  MISSION_EXTORTION_REWARD,
  MISSION_BUSINESS_REWARD,
  MISSION_DRUG_REWARD,
  MISSION_RAILWAY_REWARD,
  offerRecruitMission,
  offerAllianceMission,
  offerSpyMission,
  offerBarterMission,
  offerHuntMission,
  offerTravelMission,
  offerNomadicMission,
  offerExpansionMission,
  offerExtortionMission,
  offerBusinessMission,
  offerDrugMission,
  offerRailwayMission,
};
