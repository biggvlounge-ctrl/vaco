// VDP — Civilizations: the world-rule layer behind "VDP is not an
// empty map."
//
// Per the master lore handoff (14 Oct 2026): "THIS DOCUMENT IS AN
// ADDITIVE MASTER LORE DOCUMENT... THE CURRENT REPOSITORY AND EXISTING
// IMPLEMENTED SYSTEMS ARE THE IMPLEMENTATION AUTHORITY... EXTEND WHAT
// ALREADY EXISTS... ONLY ADD MISSING CAPABILITIES." Audited directly
// before writing a line here: VDP's real implementation today is one
// settlement (Meridian, `town.js`/`settlement.js`) with districts
// (`world.js`) -- no country, island, gateway or civilization concept
// anywhere in `src/lib`. The master doc describes a much larger world
// (four mainland countries, ten island countries, four casino islands,
// four pirate islands, a hidden civilization per country/island) and
// explicitly defers populating all of that: "I would keep the 40-city
// profiles and 10-island profiles as a subsequent detailed atlas,
// rather than bloating this handoff further. The master establishes
// the rules; those profiles can then populate the rules without
// changing the foundation." This module IS that foundation -- the
// real, generic shapes every later civilization/city/island record
// will be made FROM -- and deliberately names zero actual countries,
// islands, or founding families. Nothing here duplicates `world.js`'s
// real districts or `settlement.js`'s real population-tier ladder;
// Meridian is one settlement inside whatever civilization it turns
// out to belong to, a question this module leaves open rather than
// silently answering.
//
// Eight real, named rules out of the handoff, each with one real
// mechanism below rather than a paragraph of flavor text:
//
// 1. Technology divergence -- `technologyEras` is a SET on a
//    civilization, never a single scalar field. "There is no single
//    technology level... all can exist simultaneously" is enforced by
//    the shape of the data, not by a comment asking a future caller to
//    remember it: there is no `technologyLevel` field to misuse.
// 2. Civilization identity profile -- `createCivilization` below
//    carries every one of the 17 real fields the handoff names.
// 3. Gateway hierarchy -- `GATEWAY_TIERS`, six real tiers, verbatim.
// 4. Trade-route history -- `createTradeRoute`/`recordRouteEvent`,
//    a real timeline, not a single current-status field.
// 5. Economic statistics -- `STATISTIC_NAMES`, the handoff's own two
//    real lists (§55 civilization statistics, §56 technology
//    statistics), mutable over time via `adjustStatistic`, never
//    static lore.
// 6. Red-zone evolution -- `evolveRedZone`, a real recorded
//    transition, so "a gambling district can become legitimate" is a
//    checkable fact, not prose.
// 7. Historical technology preservation -- `registerVehicle`/
//    `transferVehicle`, a real ownership/status timeline per vehicle.
// 8. No civilization is automatically good or bad -- enforced by
//    OMISSION: there is no `morality`/`alignment`/`reputation score`
//    field anywhere below, on purpose. `historicalReputation` is free
//    text (what people SAY about a place), never a number a caller
//    could sort civilizations by "goodness." Adding such a field
//    later would be a direct violation of this rule, not a neutral
//    extension -- flagged here so it is checkable, the same way this
//    project flags every other standing rule.

export const CIVILIZATION_KINDS = [
  'mainland-country', 'island-country', 'casino-island', 'pirate-island',
  'hidden-civilization', 'independent-community',
];

// §4, verbatim order and wording.
export const GATEWAY_TIERS = [
  'pedestrian-light-goods', 'vehicle', 'commercial-cargo', 'container',
  'heavy-equipment', 'strategic-military',
];

// §4's own real list of what a gateway's control/legal footing can be.
export const GATEWAY_LEGAL_STATUSES = [
  'public', 'private', 'government-controlled', 'family-controlled', 'commercial',
  'secret', 'restricted', 'illegal', 'abandoned', 'lost', 'rediscovered',
];

// The handoff's own named instruction (bullet 4 of the user's summary,
// §23/§50 of the master document): "who created it, what it
// transported, which families controlled it, whether it is legal,
// secret, abandoned, rediscovered, or contested." Five real states,
// not a sixth invented one.
export const ROUTE_STATUSES = ['legal', 'secret', 'abandoned', 'rediscovered', 'contested'];

// §10's own real list of what a red zone "can involve."
export const RED_ZONE_ACTIVITIES = [
  'gambling', 'drugs', 'nightlife', 'clubs', 'smuggling', 'counterfeit-goods',
  'illegal-markets', 'underground-finance', 'fighting', 'racing',
  'unauthorized-business', 'illegal-immigration', 'black-market-medicine',
  'weapons', 'underground-entertainment',
];

// §7's own real list of what a vehicle/piece of equipment's historical
// status can be -- "repaired, rebuilt, customized, restored,
// inherited, traded, collected, modified, repurposed," plus the
// handoff's own explicit "museum pieces." `active` is this module's
// own addition for "currently in ordinary use," the honest default
// state every one of those other words is a departure FROM.
export const VEHICLE_STATUSES = [
  'active', 'collectible', 'inherited', 'traded', 'restored', 'stolen',
  'modified', 'museum-piece',
];

// §55, civilization statistics -- verbatim, camelCased, nothing added
// and nothing dropped. 33 real names.
export const ECONOMIC_STATISTIC_NAMES = [
  'population', 'families', 'births', 'deaths', 'migration', 'income', 'wealth',
  'employment', 'businesses', 'property', 'resources', 'imports', 'exports',
  'tradeVolume', 'tourism', 'gambling', 'crime', 'housing', 'food', 'energy',
  'water', 'transportation', 'security', 'robotIntensity', 'politicalStability',
  'culturalCommunities', 'religiousCommunities', 'education', 'sports',
  'entertainment', 'undergroundEconomy', 'barter', 'vcoinCirculation',
];

// §56, technology statistics -- verbatim, camelCased. 11 real names.
export const TECHNOLOGY_STATISTIC_NAMES = [
  'aiAdoption', 'roboticsAdoption', 'autonomousTransportation', 'humanTransportation',
  'electronics', 'manufacturing', 'medicalTechnology', 'militaryTechnology',
  'communicationTechnology', 'infrastructure', 'energyTechnology',
];

export const STATISTIC_NAMES = [...ECONOMIC_STATISTIC_NAMES, ...TECHNOLOGY_STATISTIC_NAMES];

// Per the handoff's second part (14 Oct 2026, "Unclaimed Territory,
// Island Tribal Civilizations & Four Pirate Islands"): "a government
// may claim a territory on a map without actually controlling
// everything inside it. This creates a difference between CLAIMED
// TERRITORY and ACTUALLY CONTROLLED TERRITORY." That one real,
// cross-cutting rule -- not the specific pirate islands or small
// tribal civilizations populating it, which stay deferred with
// everything else in "the subsequent detailed atlas" -- is what
// `TERRITORY_CONTROL_STATUSES` and `claimTerritory`/
// `updateTerritoryControl` below are for. `independent`/`disputed`/
// `uninhabited` are the same document's own real words for the rest
// of what a territory can honestly be, alongside the two the rule
// itself names.
export const TERRITORY_CONTROL_STATUSES = [
  'claimed', 'actually-controlled', 'independent', 'disputed', 'uninhabited',
];

function requireStatisticName(name) {
  if (!STATISTIC_NAMES.includes(name)) {
    throw new Error(`civilizations: "${name}" is not a known statistic (expected one of ${STATISTIC_NAMES.join(', ')})`);
  }
}

// Real zeros, not a guessed-at starting value -- "those numbers should
// change as the simulation runs rather than being static lore" (the
// user's own bullet 5) means the honest start is "not yet measured,"
// the same discipline `taxes.js`'s `createTaxesStore` already applies
// to a treasury that has collected nothing yet.
export function createStatistics() {
  const statistics = {};
  for (const name of STATISTIC_NAMES) statistics[name] = 0;
  return statistics;
}

export function createCivilizationsStore() {
  return {
    civilizations: [], nextCivilizationId: 1,
    gateways: [], nextGatewayId: 1,
    tradeRoutes: [], nextTradeRouteId: 1,
    redZones: [], nextRedZoneId: 1,
    vehicles: [], nextVehicleId: 1,
    territories: [], nextTerritoryId: 1,
  };
}

// ---------------------------------------------------------------------
// Civilization identity profile -- all 17 of the user's own named
// fields. `gatewayIds`/`redZoneIds`/`vehicleIds` are relational (real
// ids a caller can look up), never embedded flavor text, so "which
// gateways does this civilization actually hold" is a real query, not
// prose to re-parse.
// ---------------------------------------------------------------------
export function createCivilization(store, {
  name, kind, technologyEras = [], transportationCulture = null, government = null,
  economy = null, majorIndustries = [], tradeSpecialties = [],
  religiousCulturalIdentity = null, securityPhilosophy = null, robotUsage = null,
  oldWorldRelationship = null, famousBusinessesFamilies = [], resources = [],
  languagesDialects = [], historicalReputation = null, now = Date.now(),
} = {}) {
  if (!name || !name.trim()) throw new Error('createCivilization requires a name');
  if (!CIVILIZATION_KINDS.includes(kind)) {
    throw new Error(`createCivilization: "${kind}" is not a known kind (expected one of ${CIVILIZATION_KINDS.join(', ')})`);
  }
  const civilization = {
    id: store.nextCivilizationId++,
    name: name.trim(),
    kind,
    // Rule 1 -- a set of real, named eras, never a single level.
    technologyEras: [...technologyEras],
    transportationCulture,
    government,
    economy,
    majorIndustries: [...majorIndustries],
    tradeSpecialties: [...tradeSpecialties],
    religiousCulturalIdentity,
    securityPhilosophy,
    robotUsage,
    oldWorldRelationship,
    gatewayIds: [],
    redZoneIds: [],
    vehicleIds: [],
    territoryIds: [],
    famousBusinessesFamilies: [...famousBusinessesFamilies],
    resources: [...resources],
    languagesDialects: [...languagesDialects],
    // Free text -- what the world SAYS about this place, never a
    // sortable score. See rule 8 in the header.
    historicalReputation,
    statistics: createStatistics(),
    foundedAt: now,
  };
  store.civilizations.push(civilization);
  return civilization;
}

export function getCivilization(store, id) {
  return store.civilizations.find((c) => c.id === id) || null;
}

export function listCivilizations(store) {
  return store.civilizations;
}

// Real, mutable, bounded nowhere above zero on purpose -- these are
// counts and amounts (population, wealth), not a 0-100 trait scale, so
// there is no real ceiling to clamp against. A negative statistic is
// still refused: nobody has negative population.
export function adjustStatistic(civilization, name, delta) {
  requireStatisticName(name);
  if (!Number.isFinite(delta)) throw new Error(`adjustStatistic requires a finite delta, got ${delta}`);
  const next = civilization.statistics[name] + delta;
  civilization.statistics[name] = Math.max(0, next);
  return civilization.statistics[name];
}

export function setStatistic(civilization, name, value) {
  requireStatisticName(name);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`setStatistic requires a non-negative finite value, got ${value}`);
  }
  civilization.statistics[name] = value;
  return value;
}

// ---------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------
export function registerGateway(store, {
  name, tier, civilizationId, legalStatus = 'public', now = Date.now(),
} = {}) {
  if (!name || !name.trim()) throw new Error('registerGateway requires a name');
  if (!GATEWAY_TIERS.includes(tier)) {
    throw new Error(`registerGateway: "${tier}" is not a known gateway tier (expected one of ${GATEWAY_TIERS.join(', ')})`);
  }
  if (!GATEWAY_LEGAL_STATUSES.includes(legalStatus)) {
    throw new Error(`registerGateway: "${legalStatus}" is not a known legal status (expected one of ${GATEWAY_LEGAL_STATUSES.join(', ')})`);
  }
  const civilization = civilizationId ? getCivilization(store, civilizationId) : null;
  if (civilizationId && !civilization) throw new Error(`registerGateway: no civilization ${civilizationId}`);

  const gateway = {
    id: store.nextGatewayId++,
    name: name.trim(),
    tier,
    civilizationId: civilizationId || null,
    legalStatus,
    registeredAt: now,
  };
  store.gateways.push(gateway);
  if (civilization) civilization.gatewayIds.push(gateway.id);
  return gateway;
}

export function getGateway(store, id) {
  return store.gateways.find((g) => g.id === id) || null;
}

export function listGateways(store) {
  return store.gateways;
}

// ---------------------------------------------------------------------
// Trade-route history -- a real timeline, not a single current field.
// ---------------------------------------------------------------------
export function createTradeRoute(store, {
  name, createdBy, cargo = [], controllingFamilyIds = [], status = 'legal', now = Date.now(),
} = {}) {
  if (!name || !name.trim()) throw new Error('createTradeRoute requires a name');
  if (!createdBy) throw new Error('createTradeRoute requires a createdBy');
  if (!ROUTE_STATUSES.includes(status)) {
    throw new Error(`createTradeRoute: "${status}" is not a known route status (expected one of ${ROUTE_STATUSES.join(', ')})`);
  }
  const route = {
    id: store.nextTradeRouteId++,
    name: name.trim(),
    createdBy,
    cargo: [...cargo],
    controllingFamilyIds: [...controllingFamilyIds],
    status,
    history: [{ status, note: 'route established', at: now }],
    createdAt: now,
  };
  store.tradeRoutes.push(route);
  return route;
}

export function getTradeRoute(store, id) {
  return store.tradeRoutes.find((r) => r.id === id) || null;
}

// A real, missing accessor, the same shape `listGateways`/
// `listTerritories` already have -- found while writing `worldAtlas.js`'s
// own tests rather than left for whoever reaches for it next.
export function listTradeRoutes(store) {
  return store.tradeRoutes;
}

// A real, recorded change -- control changing hands, or the route's
// own legal status moving (e.g. `legal` -> `contested` -> `abandoned`
// -> `rediscovered`), the same "found vs. closed are two real events"
// discipline this project's other modules already apply to a
// smuggling spot or an illegal settlement. `controllingFamilyIds`, if
// given, REPLACES the current list (a real transfer of control), not
// an append.
export function recordRouteEvent(store, routeId, { status, controllingFamilyIds, note, now = Date.now() } = {}) {
  const route = getTradeRoute(store, routeId);
  if (!route) throw new Error(`recordRouteEvent: no trade route ${routeId}`);
  if (status) {
    if (!ROUTE_STATUSES.includes(status)) {
      throw new Error(`recordRouteEvent: "${status}" is not a known route status (expected one of ${ROUTE_STATUSES.join(', ')})`);
    }
    route.status = status;
  }
  if (controllingFamilyIds) route.controllingFamilyIds = [...controllingFamilyIds];
  route.history.push({ status: route.status, note: note || null, at: now });
  return route;
}

// ---------------------------------------------------------------------
// Red-zone evolution -- a real recorded transition, so "a gambling
// district can become legitimate" is checkable rather than prose.
// ---------------------------------------------------------------------
export function createRedZone(store, {
  locationLabel, civilizationId, activities = [], now = Date.now(),
} = {}) {
  if (!locationLabel) throw new Error('createRedZone requires a locationLabel');
  for (const activity of activities) {
    if (!RED_ZONE_ACTIVITIES.includes(activity)) {
      throw new Error(`createRedZone: "${activity}" is not a known red-zone activity (expected one of ${RED_ZONE_ACTIVITIES.join(', ')})`);
    }
  }
  const civilization = civilizationId ? getCivilization(store, civilizationId) : null;
  if (civilizationId && !civilization) throw new Error(`createRedZone: no civilization ${civilizationId}`);

  const zone = {
    id: store.nextRedZoneId++,
    locationLabel,
    civilizationId: civilizationId || null,
    activities: [...activities],
    history: [{ activities: [...activities], note: 'red zone established', at: now }],
    establishedAt: now,
  };
  store.redZones.push(zone);
  if (civilization) civilization.redZoneIds.push(zone.id);
  return zone;
}

export function getRedZone(store, id) {
  return store.redZones.find((z) => z.id === id) || null;
}

// "A gambling district can become legitimate. A legal district can
// become corrupt..." -- `toActivities` REPLACES the zone's current
// activities (an empty array is a real, honest "no longer a red zone
// at all," not refused), and the prior activities are kept in
// `history` rather than overwritten, so a zone's past character is
// still readable after it changes.
export function evolveRedZone(store, zoneId, { toActivities = [], reason, now = Date.now() } = {}) {
  const zone = getRedZone(store, zoneId);
  if (!zone) throw new Error(`evolveRedZone: no red zone ${zoneId}`);
  for (const activity of toActivities) {
    if (!RED_ZONE_ACTIVITIES.includes(activity)) {
      throw new Error(`evolveRedZone: "${activity}" is not a known red-zone activity (expected one of ${RED_ZONE_ACTIVITIES.join(', ')})`);
    }
  }
  zone.activities = [...toActivities];
  zone.history.push({ activities: [...toActivities], note: reason || null, at: now });
  return zone;
}

// ---------------------------------------------------------------------
// Historical technology preservation -- a real ownership/status
// timeline per vehicle or piece of equipment.
// ---------------------------------------------------------------------
export function registerVehicle(store, {
  name, era, originGatewayId = null, ownerId, civilizationId = null, now = Date.now(),
} = {}) {
  if (!name || !name.trim()) throw new Error('registerVehicle requires a name');
  if (!ownerId) throw new Error('registerVehicle requires an ownerId');
  const civilization = civilizationId ? getCivilization(store, civilizationId) : null;
  if (civilizationId && !civilization) throw new Error(`registerVehicle: no civilization ${civilizationId}`);

  const vehicle = {
    id: store.nextVehicleId++,
    name: name.trim(),
    // Free text -- "a 1990s car, human-driven bus, autonomous
    // vehicle..." is the handoff's own open phrasing for what an era
    // IS, never a closed enum this module would otherwise refuse to
    // invent, the same discipline `oldWorldOrganization` already used
    // elsewhere in this directory for an open, real-world-shaped set.
    era: era || null,
    originGatewayId,
    ownerId,
    civilizationId: civilizationId || null,
    status: 'active',
    history: [{ status: 'active', ownerId, note: 'registered', at: now }],
    registeredAt: now,
  };
  store.vehicles.push(vehicle);
  if (civilization) civilization.vehicleIds.push(vehicle.id);
  return vehicle;
}

export function getVehicle(store, id) {
  return store.vehicles.find((v) => v.id === id) || null;
}

// A real, named change of hands or condition -- "repaired, rebuilt,
// restored, inherited, traded, collected, modified, repurposed...
// stolen." `toOwnerId` is optional: a vehicle can change STATUS
// (`active` -> `restored`) without changing hands at all.
export function transferVehicle(store, vehicleId, { toStatus, toOwnerId, note, now = Date.now() } = {}) {
  const vehicle = getVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`transferVehicle: no vehicle ${vehicleId}`);
  if (toStatus) {
    if (!VEHICLE_STATUSES.includes(toStatus)) {
      throw new Error(`transferVehicle: "${toStatus}" is not a known vehicle status (expected one of ${VEHICLE_STATUSES.join(', ')})`);
    }
    vehicle.status = toStatus;
  }
  if (toOwnerId) vehicle.ownerId = toOwnerId;
  vehicle.history.push({ status: vehicle.status, ownerId: vehicle.ownerId, note: note || null, at: now });
  return vehicle;
}

export function listVehiclesFor(store, ownerId) {
  return store.vehicles.filter((v) => v.ownerId === ownerId);
}

// ---------------------------------------------------------------------
// Territory control -- "government borders do not automatically equal
// actual control." A real timeline, the same shape as trade routes
// and red zones above, so a territory's claimed-vs-controlled history
// is a checkable sequence rather than a single overwritten field.
// `civilizationId` is the CLAIMANT, not necessarily who actually holds
// the ground -- `controlStatus: 'independent'` on a territory with a
// real `civilizationId` is not a contradiction, it is exactly the
// handoff's own point: a claim and the real control of it are two
// different facts.
// ---------------------------------------------------------------------
export function claimTerritory(store, {
  name, civilizationId = null, controlStatus = 'claimed', now = Date.now(),
} = {}) {
  if (!name || !name.trim()) throw new Error('claimTerritory requires a name');
  if (!TERRITORY_CONTROL_STATUSES.includes(controlStatus)) {
    throw new Error(`claimTerritory: "${controlStatus}" is not a known control status (expected one of ${TERRITORY_CONTROL_STATUSES.join(', ')})`);
  }
  const civilization = civilizationId ? getCivilization(store, civilizationId) : null;
  if (civilizationId && !civilization) throw new Error(`claimTerritory: no civilization ${civilizationId}`);

  const territory = {
    id: store.nextTerritoryId++,
    name: name.trim(),
    civilizationId: civilizationId || null,
    controlStatus,
    history: [{ controlStatus, note: 'territory recorded', at: now }],
    recordedAt: now,
  };
  store.territories.push(territory);
  if (civilization) civilization.territoryIds.push(territory.id);
  return territory;
}

export function getTerritory(store, id) {
  return store.territories.find((t) => t.id === id) || null;
}

export function listTerritories(store) {
  return store.territories;
}

// A real, recorded change -- a claim becoming actually controlled, a
// controlled territory slipping to disputed, a disputed one going
// independent. Never silent: every call appends to `history` even
// when `controlStatus` repeats the current value, so "we checked
// again and nothing changed" is still a real, timestamped fact.
export function updateTerritoryControl(store, territoryId, { controlStatus, note, now = Date.now() } = {}) {
  const territory = getTerritory(store, territoryId);
  if (!territory) throw new Error(`updateTerritoryControl: no territory ${territoryId}`);
  if (!TERRITORY_CONTROL_STATUSES.includes(controlStatus)) {
    throw new Error(`updateTerritoryControl: "${controlStatus}" is not a known control status (expected one of ${TERRITORY_CONTROL_STATUSES.join(', ')})`);
  }
  territory.controlStatus = controlStatus;
  territory.history.push({ controlStatus, note: note || null, at: now });
  return territory;
}
