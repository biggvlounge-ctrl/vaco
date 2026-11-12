// server/mainCharacters.js
//
// Real, computed (never stored — standing rule 3) local power
// hierarchy per community: "there'll be a kingpin, there'll be the
// strongest gang, the strongest political party, the strongest
// religious party... a power hierarchy in every town, who has the
// most people" — by direct instruction.
//
// ---------------------------------------------------------------------
// Four real leaders, four different real substrates — none invented
// ---------------------------------------------------------------------
//
// 1. **Criminal** — `authority.holderOf`, already real: the faction
//    holding the most real ground in this community, scored by its
//    own live `territory`/`power` traits. Reused exactly as written;
//    this file adds no second opinion about who controls a block.
//
// 2. **Political** — the real installed leader of whichever real
//    `governments` row's scope actually covers this community. A
//    community itself is deliberately NOT a government scope
//    (`politics.js`'s own `foundGovernment` header) — real political
//    power over a community is its city's government if one was
//    founded at city scope, else that city's region, else the
//    civilization-wide government every world always has one of. This
//    is the real installed office-holder, not a `political party`
//    archetype's own leader — that archetype has no caller in
//    `worldgen.js` (standing rule 11's own guard on `orgArchetypes.js`)
//    and is not where this engine's real electoral power actually
//    lives; `politics.js#candidatesFor` already runs its one real
//    election cycle directly on a government organization.
//
// 3. **Religious** — genuinely new this round. No religious
//    organization has ever been founded anywhere in this engine before
//    now (checked directly: `orgArchetypes.js` had no archetype of
//    `type: 'religion'`, and `describeArchetypes`'s own header records
//    that nothing in `worldgen` founds ANY archetype at all). See
//    `orgArchetypes.js`'s new `'religious order'` entry and
//    `worldgen.js`'s own opt-in founding of one per community. **The
//    §9 firewall holds exactly as everywhere else in this file**: this
//    is a procedurally generated in-game institution, generated and
//    led the identical trait-driven way every other organization in
//    this engine is — nothing here, or in `orgArchetypes.found`, or in
//    `generateOrganization`, ever reads an NPC's own `npc.religion`
//    field to decide who founds, joins or leads one. A world's real
//    religious institutions and its NPCs' own private real-world-
//    sourced religious identity (`religionPacks.js`) are two
//    deliberately unconnected facts, the same way `npc.ethnicity` is
//    read by nothing that decides an outcome.
//
// 4. **Business** — the real highest-`influence` (ties broken by
//    `assets`) organization of `type: 'business'` operating a real
//    property in this community (`properties.community_id` ->
//    `properties.operating_organization_id`), never a second,
//    invented wealth metric.
//
// Every one of the four can honestly be absent — no faction holds
// ground here, no government has been founded anywhere in this world
// yet, the religious-order pack is off or never founded one here, no
// business operates here. `null` is the correct answer in each case,
// not an error.

'use strict';

const authority = require('./authority.js');

function liveLeaderOf(worldState, organizationId) {
  if (organizationId == null) return null;
  const organization = (worldState.organizations || []).find((o) => o.id === organizationId);
  if (!organization || organization.leader_id == null) return null;
  return { organizationId, leaderId: organization.leader_id };
}

// See header §2. A community's own city, then that city's region, then
// the civilization-wide government (`scope_type: null`) — the same
// fallback order `politics.js`'s own scoping readers already use.
function governmentCovering(worldState, communityId) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community) return null;
  const city = (worldState.cities || []).find((c) => c.id === community.city_id);
  const governments = worldState.governments || [];

  const cityGovernment = city
    ? governments.find((g) => g.scope_type === 'city' && g.scope_id === city.id)
    : null;
  if (cityGovernment) return cityGovernment;

  const regionGovernment = city && city.region_id != null
    ? governments.find((g) => g.scope_type === 'region' && g.scope_id === city.region_id)
    : null;
  if (regionGovernment) return regionGovernment;

  return governments.find((g) => g.scope_type === 'civilization' || g.scope_type == null) ?? null;
}

function criminalLeaderOf(worldState, communityId) {
  const factionOrganizationId = authority.holderOf(worldState, communityId);
  return liveLeaderOf(worldState, factionOrganizationId);
}

function politicalLeaderOf(worldState, communityId) {
  const government = governmentCovering(worldState, communityId);
  return liveLeaderOf(worldState, government?.organization_id ?? null);
}

// See header §3. Exactly one real religious-order organization is
// founded per community when the pack is on (`worldgen.js`'s own
// `religiousOrdersPerCommunity` option) — `communities.religious_order_
// organization_id` is NOT a real schema column (no column exists for
// it, and this file does not invent one — standing rule 3's own
// discipline applied to a brand-new fact rather than an old one), so
// this is found live, the same way `authority.holderOf` finds a
// faction live rather than caching a "current holder" field anywhere.
function religiousLeaderOf(worldState, communityId) {
  const organization = (worldState.organizations || []).find(
    (o) => o.type === 'religion' && o.community_id === communityId,
  );
  return liveLeaderOf(worldState, organization?.id ?? null);
}

function businessLeaderOf(worldState, communityId) {
  const operatingOrganizationIds = new Set(
    (worldState.properties || [])
      .filter((p) => p.community_id === communityId && p.operating_organization_id != null)
      .map((p) => p.operating_organization_id),
  );
  let best = null;
  let bestScore = -Infinity;
  for (const organization of worldState.organizations || []) {
    if (organization.type !== 'business') continue;
    if (!operatingOrganizationIds.has(organization.id)) continue;
    const score = Number(organization.influence) || Number(organization.assets) || 0;
    if (score > bestScore) { bestScore = score; best = organization; }
  }
  return liveLeaderOf(worldState, best?.id ?? null);
}

// The real power hierarchy for one community — "a main character" per
// real category, or honestly `null` where this world genuinely has
// none yet.
function mainCharactersOf(worldState, communityId) {
  const id = Number(communityId);
  const community = (worldState.communities || []).find((c) => c.id === id);
  if (!community) return null;
  return {
    communityId: id,
    criminal: criminalLeaderOf(worldState, id),
    political: politicalLeaderOf(worldState, id),
    religious: religiousLeaderOf(worldState, id),
    business: businessLeaderOf(worldState, id),
  };
}

module.exports = {
  governmentCovering,
  criminalLeaderOf,
  politicalLeaderOf,
  religiousLeaderOf,
  businessLeaderOf,
  mainCharactersOf,
};
