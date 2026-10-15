'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCivilizationsStore, createCivilization, registerGateway, claimTerritory, createTradeRoute,
} from '../src/lib/civilizations.js';
import {
  createDiscoveryStore, getDiscoveryProgress, recordClue, attemptDiscovery, investigate, CLUES_TO_DISCOVER,
} from '../src/lib/discovery.js';

function seedHiddenCiv(civStore) {
  const civ = createCivilization(civStore, { name: 'Testholt', kind: 'hidden-civilization' });
  const gateway = registerGateway(civStore, { name: "Testholt's own gateway", tier: 'vehicle', civilizationId: civ.id, legalStatus: 'secret' });
  const territory = claimTerritory(civStore, { name: "Testholt's own territory", civilizationId: civ.id, controlStatus: 'independent' });
  const route = createTradeRoute(civStore, { name: 'Testholt ↔ Hostland route', createdBy: 'Testholt', status: 'secret' });
  return { civ, gateway, territory, route };
}

test('recordClue refuses a non-hidden target and refuses once already discovered', () => {
  const civStore = createCivilizationsStore();
  const discoveryStore = createDiscoveryStore();
  const mainland = createCivilization(civStore, { name: 'Ironreach', kind: 'mainland-country' });
  assert.throws(
    () => recordClue(civStore, discoveryStore, mainland.id, { investigatorId: 'alice' }),
    /not hidden -- nothing to discover/,
  );

  const { civ } = seedHiddenCiv(civStore);
  for (let i = 0; i < CLUES_TO_DISCOVER; i += 1) {
    investigate(civStore, discoveryStore, civ.id, { investigatorId: 'alice' });
  }
  assert.equal(getDiscoveryProgress(discoveryStore, civ.id).discovered, true);
  assert.throws(
    () => recordClue(civStore, discoveryStore, civ.id, { investigatorId: 'bob' }),
    /already discovered/,
  );
});

test('recordClue requires a real investigatorId and a real civilization', () => {
  const civStore = createCivilizationsStore();
  const discoveryStore = createDiscoveryStore();
  const { civ } = seedHiddenCiv(civStore);
  assert.throws(() => recordClue(civStore, discoveryStore, civ.id, {}), /requires an investigatorId/);
  assert.throws(() => recordClue(civStore, discoveryStore, 9999, { investigatorId: 'alice' }), /no civilization/);
});

test('attemptDiscovery is a real no-op below the threshold, and does not double-fire once discovered', () => {
  const civStore = createCivilizationsStore();
  const discoveryStore = createDiscoveryStore();
  const { civ, gateway } = seedHiddenCiv(civStore);

  recordClue(civStore, discoveryStore, civ.id, { investigatorId: 'alice' });
  const progress = attemptDiscovery(civStore, discoveryStore, civ.id);
  assert.equal(progress.discovered, false);
  assert.equal(gateway.legalStatus, 'secret', 'one clue is not enough to flip anything');

  for (let i = 1; i < CLUES_TO_DISCOVER; i += 1) {
    recordClue(civStore, discoveryStore, civ.id, { investigatorId: 'alice' });
  }
  const discovered = attemptDiscovery(civStore, discoveryStore, civ.id);
  assert.equal(discovered.discovered, true);
  const gatewayHistoryLength = gateway.history.length;

  // Calling it again must not re-fire the transition a second time.
  attemptDiscovery(civStore, discoveryStore, civ.id);
  assert.equal(gateway.history.length, gatewayHistoryLength, 'a discovered civilization must not be re-discovered');
});

test('investigate() flips the gateway to rediscovered, the territory to claimed, and the secret trade route to rediscovered, all at once', () => {
  const civStore = createCivilizationsStore();
  const discoveryStore = createDiscoveryStore();
  const { civ, gateway, territory, route } = seedHiddenCiv(civStore);

  let result;
  for (let i = 0; i < CLUES_TO_DISCOVER; i += 1) {
    result = investigate(civStore, discoveryStore, civ.id, { investigatorId: 'alice', source: 'smuggling lead' });
  }

  assert.equal(result.discovered, true);
  assert.equal(result.clueCount, CLUES_TO_DISCOVER);
  assert.equal(gateway.legalStatus, 'rediscovered');
  assert.equal(territory.controlStatus, 'claimed', 'known to exist now, but not yet actually controlled');
  assert.equal(route.status, 'rediscovered');
});

test('getDiscoveryProgress on an untouched civilization reports zero clues and not discovered', () => {
  const civStore = createCivilizationsStore();
  const discoveryStore = createDiscoveryStore();
  const { civ } = seedHiddenCiv(civStore);
  const progress = getDiscoveryProgress(discoveryStore, civ.id);
  assert.equal(progress.clueCount, 0);
  assert.equal(progress.discovered, false);
  assert.equal(progress.threshold, CLUES_TO_DISCOVER);
});
