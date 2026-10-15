'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCivilizationsStore, createCivilization } from '../src/lib/civilizations.js';
import {
  createCivilizationSportsStore, declareSportsCulture, getSportsCulture,
  civilizationsFavoring, hostMatch, getMatchHost,
} from '../src/lib/civilizationSports.js';

function seed(civStore) {
  const ironreach = createCivilization(civStore, { name: 'Ironreach', kind: 'mainland-country' });
  const luminae = createCivilization(civStore, { name: 'Luminae', kind: 'mainland-country' });
  return { ironreach, luminae };
}

test('declareSportsCulture requires a real civilization and at least one real field', () => {
  const civStore = createCivilizationsStore();
  const store = createCivilizationSportsStore();
  const { ironreach } = seed(civStore);
  assert.throws(() => declareSportsCulture(civStore, store, 9999, { combatSportType: 'boxing' }), /no civilization/);
  assert.throws(() => declareSportsCulture(civStore, store, ironreach.id, {}), /requires a combatSportType, teamSportType, or homeVenue/);
});

test('declareSportsCulture is additive, normalizes casing, and never double-adds the same sport', () => {
  const civStore = createCivilizationsStore();
  const store = createCivilizationSportsStore();
  const { ironreach } = seed(civStore);

  declareSportsCulture(civStore, store, ironreach.id, { combatSportType: 'Boxing', homeVenue: 'Ironreach Arena' });
  declareSportsCulture(civStore, store, ironreach.id, { combatSportType: 'mma' });
  declareSportsCulture(civStore, store, ironreach.id, { combatSportType: 'boxing' }); // same sport, different case already normalized
  declareSportsCulture(civStore, store, ironreach.id, { teamSportType: 'basketball' });

  const culture = getSportsCulture(store, ironreach.id);
  assert.deepEqual(culture.favoredCombatSports, ['boxing', 'mma']);
  assert.deepEqual(culture.favoredTeamSports, ['basketball']);
  assert.equal(culture.homeVenue, 'Ironreach Arena');
});

test('getSportsCulture on an undeclared civilization reports real empty defaults, not an error', () => {
  const civStore = createCivilizationsStore();
  const store = createCivilizationSportsStore();
  const { luminae } = seed(civStore);
  const culture = getSportsCulture(store, luminae.id);
  assert.deepEqual(culture.favoredCombatSports, []);
  assert.deepEqual(culture.favoredTeamSports, []);
  assert.equal(culture.homeVenue, null);
});

test('civilizationsFavoring finds only the real civilizations that actually declared that sport', () => {
  const civStore = createCivilizationsStore();
  const store = createCivilizationSportsStore();
  const { ironreach, luminae } = seed(civStore);
  declareSportsCulture(civStore, store, ironreach.id, { combatSportType: 'boxing' });
  declareSportsCulture(civStore, store, luminae.id, { teamSportType: 'basketball' });

  const boxingFans = civilizationsFavoring(civStore, store, { combatSportType: 'boxing' });
  assert.deepEqual(boxingFans, [{ id: ironreach.id, name: 'Ironreach' }]);

  const basketballFans = civilizationsFavoring(civStore, store, { teamSportType: 'basketball' });
  assert.deepEqual(basketballFans, [{ id: luminae.id, name: 'Luminae' }]);

  assert.throws(() => civilizationsFavoring(civStore, store, {}), /requires a combatSportType or teamSportType/);
});

test('hostMatch flags a real favored match true, and an unfavored one false, without touching the match record itself', () => {
  const civStore = createCivilizationsStore();
  const store = createCivilizationSportsStore();
  const { ironreach, luminae } = seed(civStore);
  declareSportsCulture(civStore, store, ironreach.id, { combatSportType: 'boxing' });

  const homeMatch = hostMatch(civStore, store, 'match-1', { civilizationId: ironreach.id, combatSportType: 'boxing' });
  assert.equal(homeMatch.favored, true);

  const awayMatch = hostMatch(civStore, store, 'match-2', { civilizationId: luminae.id, combatSportType: 'boxing' });
  assert.equal(awayMatch.favored, false, 'Luminae never declared boxing as a favored sport');

  assert.deepEqual(getMatchHost(store, 'match-1'), homeMatch);
  assert.equal(getMatchHost(store, 'no-such-match'), null);
});

test('hostMatch requires a real matchId, a real sport, and a real civilization', () => {
  const civStore = createCivilizationsStore();
  const store = createCivilizationSportsStore();
  const { ironreach } = seed(civStore);
  assert.throws(() => hostMatch(civStore, store, null, { civilizationId: ironreach.id, combatSportType: 'boxing' }), /requires a matchId/);
  assert.throws(() => hostMatch(civStore, store, 'match-1', { civilizationId: ironreach.id }), /requires a combatSportType or teamSportType/);
  assert.throws(() => hostMatch(civStore, store, 'match-1', { civilizationId: 9999, combatSportType: 'boxing' }), /no civilization/);
});
