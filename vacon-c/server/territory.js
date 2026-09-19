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
    // EPSG:4326. Null until something places the city — an unplaced
    // city is not at 0,0, and `geo.positionOf` returns null for it.
    latitude: options.latitude ?? null,
    longitude: options.longitude ?? null,
    geo_source: options.geoSource ?? null,
    population: options.population ?? 0,
    mayor_npc_id: options.mayorNpcId ?? null,
    economy: options.economy ?? 50,
    infrastructure: options.infrastructure ?? 50,
    safety: options.safety ?? 50,
    growth: options.growth ?? 0,
    reemergence_index: 34, // "the founding mechanic since Volume 1" — schema's own default, not invented
    // §49 CITY DNA — "each city has a distinct identity". Null for a
    // city nobody has given one, which is not the same as a city with
    // no character; `statecraft.dnaOf` returns null for both and the
    // biases it gates are simply not applied.
    dna: options.dna ?? null,
    // The CITY tier-level trait sheet (VACANCY_TRAIT_DATABASE_
    // ATTACHMENT.md). One stored dimension after the reconciliation in
    // server/tierTraits.js; the other eleven are columns, rollups, or
    // deferred.
    traits: require('./tierTraits.js').cityTraits(options.traits ?? {}),
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
    // **Neighbourhoods had no names.** A city has one (`cities.name`
    // is NOT NULL) and its blocks were `community 3`. That is fine
    // while every area is interchangeable and stops being fine the
    // moment a landmark pack says the cathedral is in the Central West
    // End — `landmarkPacks.byArea` matches on this. NULL for a
    // generated block, because inventing neighbourhood names is a
    // different job from placing real ones.
    name: options.name ?? null,
    population: options.population ?? 0,
    tier: options.tier ?? 'block',
    housing: options.housing ?? 50,
    crime: options.crime ?? 0,
    safety: options.safety ?? 50,
    employment: options.employment ?? 50,
    education: options.education ?? 50,
    culture: options.culture ?? null,
    reputation: options.reputation ?? 50,
    // Where this is, and where the answer came from. See server/geo.js
    // — the format is a path with one segment per tier, so containment
    // is a path prefix rather than an assumption about digit widths.
    geo_ref: options.geoRef ?? null,
    geo_source: options.geoSource ?? null,
    latitude: options.latitude ?? null,
    longitude: options.longitude ?? null,
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
  // **The health of a community with nobody in it is not 0, it is
  // nothing.** Before `refreshCommunityConditions` these columns were
  // all at the schema default and this returned 50 for every area in
  // every world, so the question never came up. Now that they are a
  // live view, an emptied area clears the four person-derived ones to
  // null — and averaging `?? 50` over them would report a place with no
  // residents as being in fair shape.
  // **`Number(null)` is 0 and 0 is finite**, so mapping before
  // filtering turns five unmeasured columns into five zeroes and
  // reports a dead community as being in the worst possible shape
  // rather than in no shape at all. CLAUDE.md's own corollary, and it
  // shipped here for exactly as long as it took to write a test.
  const measured = [
    community.housing, community.safety,
    community.employment, community.education, community.reputation,
  ].filter((v) => v !== null && v !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  if (measured.length === 0) return null;
  const good = mean(measured);
  return clamp(Math.round(good - (Number(community.crime) || 0) / 2), 0, 100);
}

function getCommunityDetail(worldState, communityId) {
  const community = (worldState.communities || [])
    .find((c) => c.id === Number(communityId));
  if (!community) return null;
  const blocks = (worldState.territoryBlocks || [])
    .filter((b) => b.community_id === community.id);
  const statecraft = require('./statecraft.js');
  const stability = statecraft.communityStability(worldState, community.id);
  return {
    ...community,
    health: getCommunityHealth(community),
    // §48 NEIGHBORHOOD STABILITY, as the number and as the spec's own
    // word for it.
    stability,
    stabilityBand: statecraft.stabilityBand(stability),
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
  const statecraft = require('./statecraft.js');
  return {
    ...city,
    reemergence: getCityReemergence(worldState, city.id),
    communities: communities.map((c) => ({
      ...c,
      health: getCommunityHealth(c),
      // §48's band, by its own name. Additive to the shape, which is
      // what `VACANCY_API_ENDPOINT_MAP.md` requires of an existing
      // endpoint — nothing here was removed or renamed.
      stability: statecraft.communityStability(worldState, c.id),
    })),
    // What the state spends here, what it draws, and what kind of city
    // this is. Hung off the existing detail rather than given a route
    // of its own: the API map's Phase list governs new endpoints and
    // does not name one for this.
    statecraft: statecraft.describeStatecraft(worldState, city.id),
    territoryBlocks: (worldState.territoryBlocks || []).filter((b) => b.city_id === city.id),
    properties: (worldState.properties || []).filter((p) => p.city_id === city.id).length,
  };
}


// ---------------------------------------------------------------------------
// Community conditions — the five columns that were 50 in every world
// ---------------------------------------------------------------------------
//
// **`housing`, `safety`, `employment`, `education` and `reputation` sat
// at the schema default of 50 in every community of every world ever
// generated, and `crime` at 0.** Nothing anywhere wrote one of them.
// `getCommunityHealth` reads all six, so it returned exactly 50 for
// every area, and `getCityReemergence` — which averages community
// health and community safety across a city — returned 37 or 38 in
// every world. Measured: six communities, two cities, identical to the
// integer.
//
// That is the eleventh standing rule with five columns at once, and it
// is the reason nothing downstream could vary by place. A settlement
// cannot be a rougher settlement than the one next to it if the engine
// has no field in which they differ.
//
// ---------------------------------------------------------------------
// A durable VIEW, not a duplicate
//
// Standing rule 3 forbids storing a computable rollup, and all six of
// these are computable. The pattern used instead is the one
// `environment_state.active_disasters` already establishes: the column
// is maintained every tick as a view of the live computation, "so the
// two cannot drift — the column is a durable VIEW of the live list,
// which is what makes a checkpoint carry it". Nothing reads these
// columns to compute them; they are written from the substrate and read
// by everything else, and a checkpoint carries the reading rather than
// having to recompute a world's history to get it back.
//
// ---------------------------------------------------------------------
// What each one actually reads, and the one that reads nothing
//
//   crime       incidents per 1,000 residents over a rolling year —
//               `crime.ratePer1k`, the same window `dangerByCommunity`
//               uses, against the same reference rate.
//   safety      what ANSWERS crime rather than how much of it there is:
//               the clearance rate here, weighted by whether the city
//               has any policing capacity to spare. Deliberately not
//               the inverse of `crime` — `getCommunityHealth` already
//               subtracts crime, and a safety that was crime upside
//               down would count the same fact twice.
//   employment  the share of working-age residents holding an active
//               employment record.
//   education   residents' attainment on `demographics.EDUCATION_LEVELS`,
//               scaled to 0..100.
//   housing     the mean condition of the properties standing here,
//               which `property.js` already ages every tick.
//   reputation  **nothing.** §9's REPUTATION block asks for safe /
//               dangerous / tourist / industrial / luxury /
//               organization-controlled, and every one of those is a
//               judgement somebody OUTSIDE the area holds about it.
//               `beliefs` is keyed to an entity and a belief name, and
//               nothing anywhere forms a belief about a PLACE. Deriving
//               it from crime and wealth would be reporting two columns
//               this function already writes under a third name, so it
//               is left at whatever it was and said so here.

//: How many incidents per 1,000 residents per year reads as a fully
//: criminal area. The same reference `crime.DANGER_REFERENCE_PER_1K`
//: uses, imported rather than re-chosen so the two cannot disagree
//: about what a bad neighbourhood is.
const CONDITION_WINDOW_TICKS = 365;

//: Where an area sits when there is nothing to measure. **Null, not 50**
//: — an area with no residents has no employment rate, and writing 50
//: would say half its people work. The column keeps its previous value
//: in that case, which for a fresh world is the schema default and for
//: an emptied one is the last real reading.
function conditionsOf(worldState, communityId, options = {}) {
  // Required lazily: these modules do not depend on territory.js, and
  // requiring them at the top would make the dependency cycle real.
  const crime = require('./crime.js');
  const policing = require('./policing.js');
  const demographics = require('./demographics.js');
  const infrastructure = require('./infrastructure.js');

  const { tick = worldState.tick ?? 0, window = CONDITION_WINDOW_TICKS } = options;
  const community = (worldState.communities || []).find((c) => c.id === communityId) ?? null;
  const residents = (worldState.npcs || []).filter((n) => n.communityId === communityId);
  // **An area with nobody in it is unmeasured, not safe and not
  // dangerous**, and leaving its last reading in place is worse than
  // either: a community that emptied out kept `crime: 100` and
  // `safety: 100` side by side, which is not a fact about anywhere. The
  // four person-derived readings are cleared; `housing` is not, because
  // the buildings are still standing whether or not anybody is in them.
  if (!community || residents.length === 0) {
    const standingHere = (worldState.properties || [])
      .filter((p) => p.community_id === communityId)
      .map((p) => Number(p.condition))
      .filter(Number.isFinite);
    return {
      crime: undefined, safety: undefined, employment: undefined, education: undefined,
      housing: standingHere.length === 0
        ? null
        : clamp(Math.round(standingHere.reduce((a, b) => a + b, 0) / standingHere.length), 0, 100),
    };
  }
  const since = { sinceTick: tick - window };

  // crime — what happens here.
  //
  // **The SHRUNK rate, not the raw one.** A per-1,000 rate cannot be
  // estimated from the thirteen-to-forty-three people this engine puts
  // in a community: one recorded incident read as 58-100 on the old
  // raw rate, so `crime` had two reachable values and four of five
  // neighbourhoods were indistinguishable on the number a player looks
  // at first. See `crime.SHRINKAGE_EXPOSURE` for the measurement and
  // the method.
  const rate = crime.shrunkRatePer1k(worldState, communityId, since);
  const crimeLevel = rate === null
    ? null
    : clamp(Math.round((rate / crime.DANGER_REFERENCE_PER_1K) * 100), 0, 100);

  // safety — what answers it. An area where nothing has happened has
  // nothing to clear, so its safety is unmeasured rather than perfect:
  // "no crimes solved" and "no crimes" are different facts.
  const cleared = policing.clearanceRate(worldState, communityId, since);
  const reach = infrastructure.serviceLevel(
    worldState, community.city_id, 'public_safety', residents.length,
  );
  const safety = cleared === null
    ? null
    : clamp(Math.round(cleared * 100 * (0.5 + 0.5 * (reach ?? 0))), 0, 100);

  // employment — who actually holds a job.
  const employed = new Set(
    (worldState.employmentRecords || [])
      .filter((r) => r.status === 'active')
      .map((r) => r.entity_id),
  );
  const employment = clamp(
    Math.round((residents.filter((n) => employed.has(n.id)).length / residents.length) * 100),
    0, 100,
  );

  // education — attainment, on the same scale statistics.js reports.
  const composition = demographics.compositionOf(worldState, residents);
  const meanLevel = composition?.education?.meanLevel ?? null;
  const education = meanLevel === null
    ? null
    : clamp(
      Math.round((meanLevel / (demographics.EDUCATION_LEVELS.length - 1)) * 100), 0, 100,
    );

  // housing — the condition of what is standing.
  const standing = (worldState.properties || [])
    .filter((p) => p.community_id === communityId)
    .map((p) => Number(p.condition))
    .filter(Number.isFinite);
  const housing = standing.length === 0
    ? null
    : clamp(Math.round(standing.reduce((a, b) => a + b, 0) / standing.length), 0, 100);

  return { crime: crimeLevel, safety, employment, education, housing };
}

// ---------------------------------------------------------------------------
// City conditions — the four dead columns one tier up
// ---------------------------------------------------------------------------
//
// **`cities.economy`, `cities.safety`, `cities.infrastructure` and
// `cities.growth` were the community columns' exact situation, a tier
// higher and a fortnight later.** Every one of them is set once in
// `generateCity` and written by nothing ever again, so a city's economy
// in a 200-tick world is the number `worldgen` drew on tick 0.
// `getCityReemergence` reads `city.economy` and `city.infrastructure`
// for its infrastructure sub-index, so a third of a city's reemergence
// composite has been a founding constant in every world this engine
// has run.
//
// `cities.infrastructure` is the sharpest of the four, because the
// schema itself says what it should be: the column's own comment reads
// "computed rollup from the infrastructure table below", and
// `infrastructure.cityCondition()` has computed exactly that rollup
// since the infrastructure module was written. Nothing connected them.
//
// Same pattern as the communities above: a durable VIEW of a live
// computation, not a second source of truth. Standing rule 3 is
// satisfied because the column is maintained FROM the computation
// every tick rather than drifting alongside it.
const CITY_GROWTH_WINDOW_TICKS = 365;

function cityConditionsOf(worldState, cityId, options = {}) {
  // Required lazily: statecraft reads city conditions and this reads
  // statecraft's tourism, which is a cycle at module scope and not one
  // at call time.
  const infrastructureModule = require('./infrastructure.js');
  const economyModule = require('./economy.js');
  const tierTraitsModule = require('./tierTraits.js');

  const city = (worldState.cities || []).find((c) => c.id === cityId);
  if (!city) return {};

  const communities = (worldState.communities || []).filter((c) => c.city_id === cityId);
  const residents = (worldState.npcs || [])
    .filter((n) => communities.some((c) => c.id === n.communityId));

  // infrastructure — the rollup the schema names.
  const condition = infrastructureModule.cityCondition(worldState, cityId);
  const infrastructureValue = condition === null ? null : clamp(Math.round(condition), 0, 100);

  // safety — what the areas in it report. Null when none of them has a
  // reading yet, which is a city nobody has measured rather than a
  // dangerous one.
  const safeties = communities.map((c) => Number(c.safety)).filter(Number.isFinite);
  const safety = safeties.length === 0 ? null : clamp(Math.round(mean(safeties)), 0, 100);

  // economy — work, supply and visitors.
  //
  // Deliberately NOT a function of infrastructure condition, although
  // it plainly is in life. Services are funded from the budget, the
  // budget is the mean city economy, and a city economy that read
  // infrastructure back would close that loop into positive feedback
  // with nothing damping it. Tourism is the one path from
  // infrastructure into the economy and it runs through a lagged stock
  // (`statecraft.TOURISM_ADJUST`), which is what keeps the loop slow
  // enough to be a dynamic rather than a runaway.
  const economyTerms = [];
  const employments = communities.map((c) => Number(c.employment)).filter(Number.isFinite);
  if (employments.length > 0) economyTerms.push(mean(employments));

  const scarcities = (worldState.resources || [])
    .filter((r) => r.city_id === cityId)
    .map((r) => economyModule.getScarcity(r))
    .filter(Number.isFinite);
  // `getScarcity` is 50 at balance and rises with want, so sufficiency
  // is its complement on the same scale.
  if (scarcities.length > 0) economyTerms.push(clamp(100 - mean(scarcities), 0, 100));

  const tourism = tierTraitsModule.traitOf(city, 'tourism');
  if (tourism !== null) economyTerms.push(tourism);

  const economyValue = economyTerms.length === 0
    ? null
    : clamp(Math.round(mean(economyTerms)), 0, 100);

  // growth — arrivals against departures over the window, per hundred
  // residents, so the column reads as a percentage the way `economy`
  // and `safety` read as scores.
  //
  // Births come from `npc.createdTick`; deaths from the historical
  // record, because `npcs` has no death tick column on purpose (see
  // mortality.js) and the record is where a death's tick actually
  // lives. `undefined` — not null — when there is nobody here, so the
  // column is cleared rather than left showing a stale rate for a city
  // that has emptied.
  const tick = Number(options.tick ?? worldState.tick ?? 0);
  const since = tick - CITY_GROWTH_WINDOW_TICKS;
  let growth;
  if (residents.length === 0) {
    growth = communities.length === 0 ? null : undefined;
  } else {
    const born = residents.filter((n) => Number(n.createdTick ?? 0) > since).length;
    const here = new Set(communities.map((c) => c.id));
    const gone = new Set((worldState.deceased || [])
      .filter((n) => here.has(n.communityId))
      .map((n) => n.id));
    const died = (worldState.historicalRecords || []).filter(
      (r) => r.what === 'death'
        && Array.isArray(r.who)
        && gone.has(r.who[0])
        && Number(r.when_tick) > since,
    ).length;
    growth = Math.round(((born - died) / residents.length) * 10000) / 100;
  }

  return {
    economy: economyValue,
    safety,
    infrastructure: infrastructureValue,
    growth,
  };
}

// Write the city view. Same three-state contract as the communities
// below: a NUMBER is a reading, `undefined` clears the column, `null`
// leaves it alone.
function refreshCityConditions(worldState, options = {}) {
  const moved = [];
  for (const city of worldState.cities || []) {
    const next = cityConditionsOf(worldState, city.id, options);
    let changed = false;
    for (const [field, value] of Object.entries(next)) {
      if (value === undefined) {
        if (city[field] !== null) { city[field] = null; changed = true; }
        continue;
      }
      if (value === null) continue;
      if (city[field] === value) continue;
      city[field] = value;
      changed = true;
    }
    city.population = (worldState.communities || [])
      .filter((c) => c.city_id === city.id)
      .reduce((total, c) => total + (Number(c.population) || 0), 0);
    if (changed) moved.push(city);
  }
  return moved;
}

// Write the view. Returns the communities whose reading actually moved,
// which is what makes this a crossing rather than a per-tick rewrite of
// six identical numbers.
function refreshCommunityConditions(worldState, options = {}) {
  const moved = [];
  for (const community of worldState.communities || []) {
    const next = conditionsOf(worldState, community.id, options);
    let changed = false;
    for (const [field, value] of Object.entries(next)) {
      // Three states, and they are all different. A NUMBER is a
      // reading. `undefined` means the reading no longer applies —
      // there is nobody here to measure — and the column is cleared to
      // null so nothing reports a stale number as current. `null` means
      // this pass could not measure it at all, and the column keeps
      // whatever it had.
      if (value === undefined) {
        if (community[field] !== null) { community[field] = null; changed = true; }
        continue;
      }
      if (value === null) continue;
      if (community[field] === value) continue;
      community[field] = value;
      changed = true;
    }
    community.population = (worldState.npcs || [])
      .filter((n) => n.communityId === community.id).length;
    if (changed) moved.push(community);
  }
  return moved;
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
  CONDITION_WINDOW_TICKS,
  CITY_GROWTH_WINDOW_TICKS,
  conditionsOf,
  cityConditionsOf,
  refreshCommunityConditions,
  refreshCityConditions,
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
