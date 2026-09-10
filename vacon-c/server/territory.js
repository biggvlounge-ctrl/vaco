// server/territory.js
//
// Territory/Community — the other flagged locked-scope gap (alongside
// Citizen-mode binding), scoped per Section 11's exact wording:
// "Territory/Community (block-tier)". Not one of CLAUDE.md's 9
// numbered steps.
//
// Three tables: cities (minimal — the Build Prompt's own target is
// "one living city, St. Louis"; region_id is left null, since Region/
// Civilization generation is out of scope here and cities.region_id
// has no NOT NULL constraint), communities (tier defaults to 'block',
// matching the locked scope's explicit tier), and territory_blocks
// (faction-controlled — faction_id references factions.organization_id,
// so a faction must exist first, per step 5).
//
// resolveTerritoryControl() is the real mechanic this unblocks: it
// replaces tick.js's Organization-phase no-op (flagged explicitly in
// dev-docs/phase-8-tick-pipeline/plan.md as "nothing real to operate
// on" before this file existed) — a faction's territory_blocks
// transition between controlled/contested/fortified based on that
// faction's own organization-tier 'territory' and 'power' traits
// (organizationTraits.js, step 5's corrected 9-dimension set).
//
// Every function here takes `worldState` explicitly, same convention
// as economy.js/worldStore.js/tick.js/players.js.

'use strict';

const { nextAfter } = require('./nextAfter.js');

const { getLiveEntity } = require('./entityTraits.js');

let nextCityId = 1;
let nextCommunityId = 1;
let nextTerritoryBlockId = 1;

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------
// options:
//   name              - required (cities.name is NOT NULL, no default)
//   regionId          - entity id | null (Region/Civilization generation
//                        is out of scope here; cities.region_id has no
//                        NOT NULL constraint)
//   mayorNpcId        - entity id | null
//   realWorldGeoRef   - string | null
function generateCity(worldState, options = {}) {
  if (!options.name) {
    throw new Error('generateCity requires options.name (cities.name is NOT NULL with no default).');
  }
  const city = {
    id: nextCityId++,
    name: options.name,
    region_id: options.regionId ?? null,
    real_world_geo_ref: options.realWorldGeoRef ?? null,
    population: options.population ?? 0,
    mayor_npc_id: options.mayorNpcId ?? null,
    economy: options.economy ?? 50,
    infrastructure: options.infrastructure ?? 50,
    safety: options.safety ?? 50,
    growth: options.growth ?? 0,
    reemergence_index: 34, // "the founding mechanic since Volume 1" — schema's own default, not invented
  };
  worldState.cities.push(city);
  return city;
}

// ---------------------------------------------------------------------------
// Communities — tier defaults to 'block', the locked scope's explicit
// tier ("Territory/Community (block-tier)", Section 11). Other tier
// values (apartment|neighborhood|town|district) are valid per the
// schema's enum comment but out of scope for what was asked here.
// ---------------------------------------------------------------------------
// options:
//   cityId            - city id | null
//   tier              - defaults to 'block'
//   leadershipNpcId   - entity id | null
function generateCommunity(worldState, options = {}) {
  const community = {
    id: nextCommunityId++,
    city_id: options.cityId ?? null,
    population: options.population ?? 0,
    tier: options.tier ?? 'block',
    housing: options.housing ?? 50,
    crime: options.crime ?? 0,
    safety: options.safety ?? 50,
    employment: options.employment ?? 50,
    education: options.education ?? 50,
    culture: options.culture ?? null,
    reputation: options.reputation ?? 50,
    leadership_npc_id: options.leadershipNpcId ?? null,
  };
  worldState.communities.push(community);
  return community;
}

// ---------------------------------------------------------------------------
// Territory blocks — faction-controlled. faction_id must reference an
// existing faction's organization_id (territory_blocks.faction_id is
// NOT NULL with no default, and the schema FK is literally
// `REFERENCES factions(organization_id)`, not `organizations(id)` —
// only organizations that are actually factions can hold territory).
// ---------------------------------------------------------------------------
// options:
//   factionId     - required, must be an organization with isFaction: true
//   cityId        - city id | null
//   communityId   - community id | null
function generateTerritoryBlock(worldState, options = {}) {
  if (options.factionId == null) {
    throw new Error('generateTerritoryBlock requires options.factionId (territory_blocks.faction_id is NOT NULL with no default).');
  }
  const faction = worldState.organizations.find((o) => o.id === options.factionId);
  if (!faction || !faction.isFaction) {
    throw new Error(`generateTerritoryBlock: ${options.factionId} is not an existing faction (territory_blocks.faction_id references factions.organization_id specifically, not any organization).`);
  }

  const block = {
    id: nextTerritoryBlockId++,
    faction_id: options.factionId,
    city_id: options.cityId ?? null,
    community_id: options.communityId ?? null,
    status: 'controlled', // contested|controlled|fortified, schema default
    contested_since_tick: null,
    building_count: options.buildingCount ?? 0,
    crime_rate: options.crimeRate ?? 0,
    traffic_level: options.trafficLevel ?? 0,
    maintenance_status: options.maintenanceStatus ?? null,
  };
  worldState.territoryBlocks.push(block);
  return block;
}

// ---------------------------------------------------------------------------
// resolveTerritoryControl() — the actual "factions/orgs gain or lose
// territory" mechanic (Build Prompt, tick pipeline phase 7), replacing
// tick.js's prior Organization-phase no-op now that there's something
// real to operate on. Reads the controlling faction's LIVE
// organization-tier 'territory' and 'power' traits (getLiveEntity(),
// the step-8 correctness fix — these change over time via
// applyKeyModifier(), same as individual traits) and transitions the
// block's status based on a threshold model.
//
// Thresholds (interpretive — no formula specified in any doc, same
// honesty as every other undocumented formula in this project):
// controlScore = average(territory, power). < 40 -> contested (or
// stays contested); 40-79 -> controlled; >= 80 -> fortified.
// ---------------------------------------------------------------------------
const CONTESTED_THRESHOLD = 40;
const FORTIFIED_THRESHOLD = 80;

function resolveTerritoryControl(worldState, block, tick) {
  const live = getLiveEntity(worldState, block.faction_id);
  if (!live) return block; // faction no longer exists — leave the block as-is, don't crash the tick

  const territoryStrength = live.traits.organization?.territory ?? 0;
  const power = live.traits.organization?.power ?? 0;
  const controlScore = Math.round((territoryStrength + power) / 2);

  if (controlScore < CONTESTED_THRESHOLD) {
    if (block.status !== 'contested') block.contested_since_tick = tick;
    block.status = 'contested';
  } else if (controlScore >= FORTIFIED_THRESHOLD) {
    block.status = 'fortified';
    block.contested_since_tick = null;
  } else {
    block.status = 'controlled';
    block.contested_since_tick = null;
  }

  return block;
}

// ---------------------------------------------------------------------------
// Computed rollups — Community Health and Reemergence
// ---------------------------------------------------------------------------
// CLAUDE.md standing rule 3 names both of these by name: "Reemergence,
// Property Value, Community Health, Family Wealth are all computed,
// never stored." So neither is written back anywhere; both are read
// over the rows that feed them, the same way getFamilyWealth() sums
// members' finances on every read.
//
// `cities.reemergence_index` still sits on the row at the schema's own
// default of 34 and is deliberately NOT the answer these functions
// give. The column exists so migrate.js has somewhere to write a
// snapshot; the live number is computed here.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const mean = (values) => (values.length
  ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
  : null);

// Health of one community, from the five liveable-conditions fields the
// schema actually tracks. Crime is the one that counts against.
function getCommunityHealth(community) {
  if (!community) return null;
  const good = mean([
    community.housing ?? 50, community.safety ?? 50,
    community.employment ?? 50, community.education ?? 50,
    community.reputation ?? 50,
  ]);
  return clamp(Math.round(good - (community.crime ?? 0) / 2), 0, 100);
}

function getCommunityDetail(worldState, communityId) {
  const community = (worldState.communities || [])
    .find((c) => c.id === Number(communityId));
  if (!community) return null;
  const blocks = (worldState.territoryBlocks || [])
    .filter((b) => b.community_id === community.id);
  return {
    ...community,
    health: getCommunityHealth(community),
    territoryBlocks: blocks,
    city: (worldState.cities || []).find((c) => c.id === community.city_id) ?? null,
  };
}

// Reemergence for one city, broken into the sub-indices the API map
// asks for ("reemergence composite breakdown (sub-indices)").
//
// **Two of the four sub-indices are city-scoped and two are not, and
// that is stated rather than blurred.** Communities carry `city_id`, so
// conditions and safety really are this city's. NPCs carry no location
// at all -- there is no `entities.city_id` populated anywhere in this
// engine -- so the people half of the composite is the world's, and
// `scope` on each sub-index says which it is. Narrowing it needs NPCs
// to have a home, which is the same gap the Migration phase names.
function getCityReemergence(worldState, cityId) {
  const city = (worldState.cities || []).find((c) => c.id === Number(cityId));
  if (!city) return null;

  const communities = (worldState.communities || [])
    .filter((c) => c.city_id === city.id);
  const npcs = worldState.npcs || [];

  const conditions = mean(communities.map((c) => getCommunityHealth(c)));
  const safety = communities.length ? mean(communities.map((c) => c.safety ?? 50)) : city.safety;
  const infrastructure = Math.round(((city.economy ?? 50) + (city.infrastructure ?? 50)) / 2);
  const people = npcs.length ? Math.round(worldState.reemergenceIndex ?? 0) : null;

  const subIndices = [
    { name: 'conditions', value: conditions, scope: 'city', source: 'community health across this city' },
    { name: 'safety', value: safety, scope: 'city', source: 'community safety across this city' },
    { name: 'infrastructure', value: infrastructure, scope: 'city', source: 'city economy and infrastructure' },
    { name: 'people', value: people, scope: 'world', source: 'NPC resilience and adaptability — NPCs have no city' },
  ];

  const scored = subIndices.filter((s) => typeof s.value === 'number');
  return {
    cityId: city.id,
    composite: scored.length ? mean(scored.map((s) => s.value)) : null,
    subIndices,
    storedIndex: city.reemergence_index,
    note: 'Computed on read, never stored (CLAUDE.md standing rule 3). '
      + '`storedIndex` is the schema default on the row and is not the live number.',
  };
}

function getCityDetail(worldState, cityId) {
  const city = (worldState.cities || []).find((c) => c.id === Number(cityId));
  if (!city) return null;
  const communities = (worldState.communities || [])
    .filter((c) => c.city_id === city.id);
  return {
    ...city,
    reemergence: getCityReemergence(worldState, city.id),
    communities: communities.map((c) => ({ ...c, health: getCommunityHealth(c) })),
    territoryBlocks: (worldState.territoryBlocks || []).filter((b) => b.city_id === city.id),
    properties: (worldState.properties || []).filter((p) => p.city_id === city.id).length,
  };
}


// ---------------------------------------------------------------------------
// reseedIds — see server/idSequences.js
// ---------------------------------------------------------------------------
// Called after a world is loaded from Postgres. Without it these
// counters restart at 1 against restored rows that already use those
// ids, and two rows end up sharing a primary key with nothing thrown.
// Derived from the rows themselves rather than stored, so it cannot
// disagree with them.
function reseedIds(worldState) {
  nextCityId = nextAfter(worldState.cities);
  nextCommunityId = nextAfter(worldState.communities);
  nextTerritoryBlockId = nextAfter(worldState.territoryBlocks);
  return {
    nextCityId: nextCityId,
    nextCommunityId: nextCommunityId,
    nextTerritoryBlockId: nextTerritoryBlockId,
  };
}

module.exports = {
  reseedIds,
  generateCity,
  generateCommunity,
  generateTerritoryBlock,
  resolveTerritoryControl,
  getCommunityHealth,
  getCommunityDetail,
  getCityReemergence,
  getCityDetail,
};
