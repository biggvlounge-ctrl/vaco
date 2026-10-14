'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCivilizationsStore, listGateways, listTradeRoutes, listTerritories } from '../src/lib/civilizations.js';
import {
  seedWorldAtlas, isWorldAtlasSeeded, MAINLAND_COUNTRIES, MAINLAND_HIDDEN_CIVILIZATIONS,
  CASINO_ISLANDS, PIRATE_ISLANDS, ICE_WALL_GATES,
} from '../src/lib/worldAtlas.js';

test('seedWorldAtlas creates every real mainland country, hidden civilization, casino island, and pirate island', () => {
  const store = createCivilizationsStore();
  const result = seedWorldAtlas(store);
  assert.equal(result.seeded, true);
  assert.equal(store.civilizations.filter((c) => c.kind === 'mainland-country').length, MAINLAND_COUNTRIES.length);
  assert.equal(store.civilizations.filter((c) => c.kind === 'hidden-civilization').length, MAINLAND_HIDDEN_CIVILIZATIONS.length);
  assert.equal(store.civilizations.filter((c) => c.kind === 'casino-island').length, CASINO_ISLANDS.length);
  assert.equal(store.civilizations.filter((c) => c.kind === 'pirate-island').length, PIRATE_ISLANDS.length);
});

test('seedWorldAtlas is real and idempotent -- a second call seeds nothing twice', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const before = store.civilizations.length;
  const second = seedWorldAtlas(store);
  assert.equal(second.seeded, false);
  assert.equal(store.civilizations.length, before);
});

test('isWorldAtlasSeeded reports false on an empty store and true once seeded', () => {
  const store = createCivilizationsStore();
  assert.equal(isWorldAtlasSeeded(store), false);
  seedWorldAtlas(store);
  assert.equal(isWorldAtlasSeeded(store), true);
});

test('each mainland country gets a real gateway named from the real Ice Wall gates', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const gateways = listGateways(store);
  const gateNames = Object.values(ICE_WALL_GATES);
  for (const name of gateNames) {
    assert.ok(gateways.some((g) => g.name === name), `expected a real gateway named "${name}"`);
  }
});

test('no casino island ever gets a real Ice Wall gateway -- reached only by maritime networks', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const casinoIslandIds = store.civilizations.filter((c) => c.kind === 'casino-island').map((c) => c.id);
  const gateways = listGateways(store);
  for (const id of casinoIslandIds) {
    assert.equal(gateways.some((g) => g.civilizationId === id), false, 'a casino island must never carry a real Ice Wall gateway');
  }
});

test('every hidden civilization gets its own secret or restricted gateway, a red zone, an independent territory, and a trade route to its host', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const hidden = store.civilizations.filter((c) => c.kind === 'hidden-civilization');
  assert.equal(hidden.length, 4);
  for (const civ of hidden) {
    assert.ok(civ.gatewayIds.length >= 1, `${civ.name} must carry a real gateway`);
    const gateway = listGateways(store).find((g) => civ.gatewayIds.includes(g.id));
    assert.ok(['secret', 'restricted'].includes(gateway.legalStatus), `${civ.name}'s gateway must be secret or restricted`);
    assert.ok(civ.redZoneIds.length >= 1, `${civ.name} must carry a real red zone`);
    assert.ok(civ.territoryIds.length >= 1, `${civ.name} must carry a real territory`);
    const territory = listTerritories(store).find((t) => civ.territoryIds.includes(t.id));
    assert.equal(territory.controlStatus, 'independent');
  }
  const routes = listTradeRoutes(store);
  assert.equal(routes.filter((r) => hidden.some((h) => r.name.startsWith(h.name))).length >= 4, true);
});

test('no mainland hidden civilization mirrors its own host country\'s specialty', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const countries = store.civilizations.filter((c) => c.kind === 'mainland-country');
  MAINLAND_HIDDEN_CIVILIZATIONS.forEach((def, i) => {
    const host = countries[def.hostIndex];
    const overlap = def.majorIndustries.some((industry) => host.majorIndustries.includes(industry));
    assert.equal(overlap, false, `${def.name} must not share a real major industry with its host, ${host.name}`);
  });
});

test('the required gambling and nightlife/club specialties are both real and present among the hidden civilizations', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const hidden = store.civilizations.filter((c) => c.kind === 'hidden-civilization');
  assert.ok(hidden.some((c) => c.economy === 'gambling'));
  assert.ok(hidden.some((c) => c.economy === 'clubs and nightlife'));
  assert.ok(hidden.some((c) => c.economy.includes('medicine')));
});

test('every pirate island carries a real rival-faction government, no single authority', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const pirates = store.civilizations.filter((c) => c.kind === 'pirate-island');
  assert.equal(pirates.length, 4);
  for (const civ of pirates) {
    assert.ok(civ.government.includes('rival'));
  }
  const names = new Set(pirates.map((c) => c.economy));
});

test('a real, named trade route connects the container hidden civilization to the container-piracy pirate island', () => {
  const store = createCivilizationsStore();
  seedWorldAtlas(store);
  const routes = listTradeRoutes(store);
  const route = routes.find((r) => r.name.includes('Rustholt') && r.name.includes('Blackcrate Island'));
  assert.ok(route, 'the real cross-link between the container hidden civilization and the container-piracy pirate island must exist');
  assert.equal(route.status, 'secret');
});
