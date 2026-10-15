'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCivilizationsStore, createCivilization, getCivilization, listCivilizations,
  CIVILIZATION_KINDS, createStatistics, STATISTIC_NAMES, ECONOMIC_STATISTIC_NAMES,
  TECHNOLOGY_STATISTIC_NAMES, adjustStatistic, setStatistic,
  GATEWAY_TIERS, GATEWAY_LEGAL_STATUSES, registerGateway, getGateway, listGateways, updateGatewayStatus,
  ROUTE_STATUSES, createTradeRoute, getTradeRoute, listTradeRoutes, recordRouteEvent,
  RED_ZONE_ACTIVITIES, createRedZone, getRedZone, evolveRedZone,
  VEHICLE_STATUSES, registerVehicle, getVehicle, transferVehicle, listVehiclesFor,
  TERRITORY_CONTROL_STATUSES, claimTerritory, getTerritory, listTerritories, updateTerritoryControl,
} from '../src/lib/civilizations.js';

test('createCivilization carries every one of the 17 real identity-profile fields', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, {
    name: 'Country One',
    kind: 'mainland-country',
    technologyEras: ['1990s vehicles', 'advanced autonomous'],
    transportationCulture: 'heavy rail and robotics',
    government: 'industrial council',
    economy: 'robotics and heavy industry',
    majorIndustries: ['robotics', 'mining'],
    tradeSpecialties: ['construction robots'],
    religiousCulturalIdentity: 'industrial guild tradition',
    securityPhilosophy: 'heavy robot patrol',
    robotUsage: 'pervasive',
    oldWorldRelationship: 'severed decades ago',
    famousBusinessesFamilies: ['The Forge Family'],
    resources: ['ore', 'star iron'],
    languagesDialects: ['Founders\' Common'],
    historicalReputation: 'said to never sleep',
  });
  assert.equal(civ.name, 'Country One');
  assert.equal(civ.kind, 'mainland-country');
  assert.deepEqual(civ.technologyEras, ['1990s vehicles', 'advanced autonomous']);
  assert.equal(civ.transportationCulture, 'heavy rail and robotics');
  assert.equal(civ.government, 'industrial council');
  assert.equal(civ.economy, 'robotics and heavy industry');
  assert.deepEqual(civ.majorIndustries, ['robotics', 'mining']);
  assert.deepEqual(civ.tradeSpecialties, ['construction robots']);
  assert.equal(civ.religiousCulturalIdentity, 'industrial guild tradition');
  assert.equal(civ.securityPhilosophy, 'heavy robot patrol');
  assert.equal(civ.robotUsage, 'pervasive');
  assert.equal(civ.oldWorldRelationship, 'severed decades ago');
  assert.deepEqual(civ.famousBusinessesFamilies, ['The Forge Family']);
  assert.deepEqual(civ.resources, ['ore', 'star iron']);
  assert.deepEqual(civ.languagesDialects, ["Founders' Common"]);
  assert.equal(civ.historicalReputation, 'said to never sleep');
  assert.deepEqual(civ.gatewayIds, []);
  assert.deepEqual(civ.redZoneIds, []);
  assert.deepEqual(civ.vehicleIds, []);
  assert.equal(getCivilization(store, civ.id).id, civ.id);
  assert.equal(listCivilizations(store).length, 1);
});

test('createCivilization refuses an unknown kind, and every real kind is accepted', () => {
  const store = createCivilizationsStore();
  assert.throws(() => createCivilization(store, { name: 'X', kind: 'empire' }), /not a known kind/);
  for (const kind of CIVILIZATION_KINDS) {
    assert.doesNotThrow(() => createCivilization(store, { name: `civ-${kind}`, kind }));
  }
});

test('a civilization never carries a morality/alignment/reputation-score field', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, { name: 'Pirate Island Three', kind: 'pirate-island' });
  assert.equal('morality' in civ, false);
  assert.equal('alignment' in civ, false);
  assert.equal('reputationScore' in civ, false);
  assert.equal('goodOrBad' in civ, false);
  // historicalReputation exists and is free text, never a number.
  assert.equal(civ.historicalReputation, null);
});

test('technologyEras is a real set, never collapsed to a single scalar', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, {
    name: 'Mixed-Era Settlement', kind: 'independent-community',
    technologyEras: ['human-driven bus', 'autonomous delivery truck', 'underground bullet train'],
  });
  assert.equal(Array.isArray(civ.technologyEras), true);
  assert.equal(civ.technologyEras.length, 3);
  assert.equal('technologyLevel' in civ, false);
});

test('createStatistics seeds every real statistic (economic + technology) at an honest zero', () => {
  const stats = createStatistics();
  assert.equal(Object.keys(stats).length, STATISTIC_NAMES.length);
  assert.equal(ECONOMIC_STATISTIC_NAMES.length, 33);
  assert.equal(TECHNOLOGY_STATISTIC_NAMES.length, 11);
  for (const name of STATISTIC_NAMES) assert.equal(stats[name], 0);
});

test('adjustStatistic moves a real statistic and never goes negative', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, { name: 'X', kind: 'island-country' });
  assert.equal(adjustStatistic(civ, 'population', 500), 500);
  assert.equal(adjustStatistic(civ, 'population', -2000), 0);
  assert.throws(() => adjustStatistic(civ, 'notARealStat', 1), /not a known statistic/);
  assert.throws(() => adjustStatistic(civ, 'population', NaN), /finite delta/);
});

test('setStatistic sets an absolute real value and refuses a negative one', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, { name: 'X', kind: 'island-country' });
  setStatistic(civ, 'wealth', 10000);
  assert.equal(civ.statistics.wealth, 10000);
  assert.throws(() => setStatistic(civ, 'wealth', -1), /non-negative/);
});

test('registerGateway requires a real tier and a real legal status, from the six/eleven real named ones', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, { name: 'Country One', kind: 'mainland-country' });
  assert.equal(GATEWAY_TIERS.length, 6);
  assert.equal(GATEWAY_LEGAL_STATUSES.length, 11);
  const gate = registerGateway(store, {
    name: "Serpent's Gate", tier: 'container', civilizationId: civ.id, legalStatus: 'government-controlled',
  });
  assert.equal(gate.tier, 'container');
  assert.equal(gate.legalStatus, 'government-controlled');
  assert.equal(getGateway(store, gate.id).id, gate.id);
  assert.deepEqual(getCivilization(store, civ.id).gatewayIds, [gate.id]);
  assert.equal(listGateways(store).length, 1);
  assert.throws(() => registerGateway(store, { name: 'Bad', tier: 'airport' }), /not a known gateway tier/);
  assert.throws(
    () => registerGateway(store, { name: 'Bad', tier: 'vehicle', legalStatus: 'friendly' }),
    /not a known legal status/,
  );
});

test('registerGateway seeds a real history entry, and updateGatewayStatus appends to it -- including a real no-change check', () => {
  const store = createCivilizationsStore();
  const gate = registerGateway(store, { name: "Serpent's Gate", tier: 'container', legalStatus: 'secret' });
  assert.equal(gate.history.length, 1);

  updateGatewayStatus(store, gate.id, { legalStatus: 'rediscovered', note: 'a player found it' });
  let updated = getGateway(store, gate.id);
  assert.equal(updated.legalStatus, 'rediscovered');
  assert.equal(updated.history.length, 2);

  updateGatewayStatus(store, gate.id, { legalStatus: 'rediscovered', note: 'checked again, still rediscovered' });
  updated = getGateway(store, gate.id);
  assert.equal(updated.history.length, 3, 'a repeated status is still a real, timestamped check');

  assert.throws(() => updateGatewayStatus(store, gate.id, { legalStatus: 'friendly' }), /not a known legal status/);
  assert.throws(() => updateGatewayStatus(store, 9999, { legalStatus: 'secret' }), /no gateway/);
});

test('createTradeRoute starts a real history, and recordRouteEvent appends to it', () => {
  const store = createCivilizationsStore();
  assert.equal(ROUTE_STATUSES.length, 5);
  const route = createTradeRoute(store, {
    name: 'The Container Run', createdBy: 'family-forge', cargo: ['containers', 'vehicles'], status: 'legal',
  });
  assert.equal(route.status, 'legal');
  assert.equal(route.history.length, 1);

  recordRouteEvent(store, route.id, { status: 'contested', note: 'two families now claim it' });
  const updated = getTradeRoute(store, route.id);
  assert.equal(updated.status, 'contested');
  assert.equal(updated.history.length, 2);
  assert.equal(updated.history[1].note, 'two families now claim it');

  recordRouteEvent(store, route.id, { controllingFamilyIds: ['family-stone'] });
  assert.deepEqual(getTradeRoute(store, route.id).controllingFamilyIds, ['family-stone']);

  assert.throws(() => recordRouteEvent(store, route.id, { status: 'thriving' }), /not a known route status/);
  assert.throws(() => createTradeRoute(store, { name: 'X', createdBy: null }), /createdBy/);

  assert.equal(listTradeRoutes(store).length, 1);
});

test('createRedZone validates real activities, and evolveRedZone records a real transition rather than forgetting the past', () => {
  const store = createCivilizationsStore();
  const civ = createCivilization(store, { name: 'Pirate Island Two', kind: 'pirate-island' });
  const zone = createRedZone(store, { locationLabel: 'The Lower Deck', civilizationId: civ.id, activities: ['gambling', 'nightlife'] });
  assert.deepEqual(zone.activities, ['gambling', 'nightlife']);
  assert.equal(zone.history.length, 1);
  assert.deepEqual(getCivilization(store, civ.id).redZoneIds, [zone.id]);

  evolveRedZone(store, zone.id, { toActivities: [], reason: 'went fully legitimate' });
  const evolved = getRedZone(store, zone.id);
  assert.deepEqual(evolved.activities, []);
  assert.equal(evolved.history.length, 2);
  // The past is still readable.
  assert.deepEqual(evolved.history[0].activities, ['gambling', 'nightlife']);
  assert.equal(evolved.history[1].note, 'went fully legitimate');

  assert.throws(() => createRedZone(store, { locationLabel: 'X', activities: ['arson'] }), /not a known red-zone activity/);
  assert.ok(RED_ZONE_ACTIVITIES.includes('black-market-medicine'));
});

test('registerVehicle starts active with a real history, and transferVehicle records status/ownership changes without losing it', () => {
  const store = createCivilizationsStore();
  assert.equal(VEHICLE_STATUSES.length, 8);
  const vehicle = registerVehicle(store, { name: "Grandfather's Pickup", era: '1990s pickup truck', ownerId: 'family-stone' });
  assert.equal(vehicle.status, 'active');
  assert.equal(vehicle.history.length, 1);

  transferVehicle(store, vehicle.id, { toStatus: 'restored', note: 'engine rebuilt' });
  assert.equal(getVehicle(store, vehicle.id).status, 'restored');

  transferVehicle(store, vehicle.id, { toStatus: 'inherited', toOwnerId: 'family-stone-jr', note: 'passed down' });
  const inherited = getVehicle(store, vehicle.id);
  assert.equal(inherited.status, 'inherited');
  assert.equal(inherited.ownerId, 'family-stone-jr');
  assert.equal(inherited.history.length, 3);

  assert.deepEqual(listVehiclesFor(store, 'family-stone-jr').map((v) => v.id), [vehicle.id]);
  assert.equal(listVehiclesFor(store, 'family-stone').length, 0);
  assert.throws(() => transferVehicle(store, vehicle.id, { toStatus: 'brand-new' }), /not a known vehicle status/);
});

test('claimTerritory records a real claim, distinct from who actually controls it', () => {
  const store = createCivilizationsStore();
  assert.equal(TERRITORY_CONTROL_STATUSES.length, 5);
  const civ = createCivilization(store, { name: 'Country One', kind: 'mainland-country' });

  const territory = claimTerritory(store, { name: 'The Northern Wilds', civilizationId: civ.id, controlStatus: 'claimed' });
  assert.equal(territory.controlStatus, 'claimed');
  assert.equal(territory.history.length, 1);
  assert.deepEqual(getCivilization(store, civ.id).territoryIds, [territory.id]);
  assert.equal(getTerritory(store, territory.id).id, territory.id);
  assert.equal(listTerritories(store).length, 1);

  // A government may claim ground it does not actually hold -- a real,
  // non-contradictory fact.
  const independent = claimTerritory(store, { name: 'The Hill Tribes', civilizationId: civ.id, controlStatus: 'independent' });
  assert.equal(independent.controlStatus, 'independent');
  assert.equal(independent.civilizationId, civ.id);

  assert.throws(() => claimTerritory(store, { name: 'X', controlStatus: 'owned' }), /not a known control status/);
  assert.throws(() => claimTerritory(store, { controlStatus: 'claimed' }), /requires a name/);
});

test('updateTerritoryControl keeps a real, append-only history, including a real no-change check', () => {
  const store = createCivilizationsStore();
  const territory = claimTerritory(store, { name: 'The Borderlands', controlStatus: 'claimed' });

  updateTerritoryControl(store, territory.id, { controlStatus: 'disputed', note: 'a rival family moved in' });
  let updated = getTerritory(store, territory.id);
  assert.equal(updated.controlStatus, 'disputed');
  assert.equal(updated.history.length, 2);

  updateTerritoryControl(store, territory.id, { controlStatus: 'disputed', note: 'checked again, still disputed' });
  updated = getTerritory(store, territory.id);
  assert.equal(updated.history.length, 3, 'a repeated status is still a real, timestamped check');

  updateTerritoryControl(store, territory.id, { controlStatus: 'actually-controlled', note: 'the rival was pushed out' });
  assert.equal(getTerritory(store, territory.id).controlStatus, 'actually-controlled');

  assert.throws(() => updateTerritoryControl(store, territory.id, { controlStatus: 'owned' }), /not a known control status/);
  assert.throws(() => updateTerritoryControl(store, 9999, { controlStatus: 'claimed' }), /no territory/);
});
