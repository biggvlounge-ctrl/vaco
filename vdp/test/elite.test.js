// VDP — elite.js: a real, additive elite enclave and personal
// security, never a lock on the existing residential ladder.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isElite, eliteEnclaveOwnedBy, purchaseEliteEnclaveUnit, assignPersonalSecurity,
  ELITE_ENCLAVE_TYPE, ELITE_ENCLAVE_PRICE,
} from '../src/lib/elite.js';
import { createPropertyStore, purchaseHome, upgradeHome, PROPERTY_LEVELS } from '../src/lib/property.js';
import { createRobotsStore, robotsControlledBy } from '../src/lib/robots.js';
import { GOVERNMENT_LIAISON_ROLE } from '../src/lib/npcs.js';

const fakeTransfer = async () => ({ ok: true });

test('isElite is true for a real government liaison', () => {
  assert.equal(isElite({ npc: { role: GOVERNMENT_LIAISON_ROLE } }), true);
  assert.equal(isElite({ npc: { role: 'ordinary-npc' } }), false);
});

test('isElite is true for a real player who already owns the top real residential tier', () => {
  assert.equal(isElite({ ownedPropertyLevel: PROPERTY_LEVELS[PROPERTY_LEVELS.length - 1].level }), true);
  assert.equal(isElite({ ownedPropertyLevel: PROPERTY_LEVELS[0].level }), false);
  assert.equal(isElite({}), false);
  assert.equal(isElite(), false);
});

test('purchaseEliteEnclaveUnit refuses a real non-elite buyer, and never charges them', async () => {
  const store = createPropertyStore();
  const calls = [];
  await assert.rejects(
    purchaseEliteEnclaveUnit(store, { ownerId: 'alice', eliteContext: {}, transferFn: async (a) => { calls.push(a); } }),
    /is not elite/,
  );
  assert.equal(calls.length, 0);
});

test('purchaseEliteEnclaveUnit lets a real government liaison buy a real enclave unit, priced above a Penthouse', async () => {
  const store = createPropertyStore();
  const property = await purchaseEliteEnclaveUnit(store, {
    ownerId: 'liaison-bo', eliteContext: { npc: { role: GOVERNMENT_LIAISON_ROLE } }, transferFn: fakeTransfer,
  });
  assert.equal(property.type, ELITE_ENCLAVE_TYPE);
  assert.ok(ELITE_ENCLAVE_PRICE > PROPERTY_LEVELS[PROPERTY_LEVELS.length - 1].price);
  assert.equal(eliteEnclaveOwnedBy(store, 'liaison-bo'), property);
});

test('purchaseEliteEnclaveUnit does not touch the ordinary residential ladder -- a real player can still reach Penthouse on their own', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'bob', transferFn: fakeTransfer });
  for (let i = 1; i < PROPERTY_LEVELS.length; i += 1) {
    await upgradeHome(store, { ownerId: 'bob', transferFn: fakeTransfer });
  }
  const home = store.properties.find((p) => p.ownerId === 'bob' && p.type === 'residential');
  assert.equal(home.levelName, PROPERTY_LEVELS[PROPERTY_LEVELS.length - 1].name);
});

test('purchaseEliteEnclaveUnit refuses a second unit for the same real owner', async () => {
  const store = createPropertyStore();
  const eliteContext = { npc: { role: GOVERNMENT_LIAISON_ROLE } };
  await purchaseEliteEnclaveUnit(store, { ownerId: 'liaison-bo', eliteContext, transferFn: fakeTransfer });
  await assert.rejects(
    purchaseEliteEnclaveUnit(store, { ownerId: 'liaison-bo', eliteContext, transferFn: fakeTransfer }),
    /already owns a unit/,
  );
});

test('purchaseEliteEnclaveUnit rolls back the row if the real transfer fails', async () => {
  const store = createPropertyStore();
  const eliteContext = { npc: { role: GOVERNMENT_LIAISON_ROLE } };
  await assert.rejects(
    purchaseEliteEnclaveUnit(store, { ownerId: 'liaison-bo', eliteContext, transferFn: async () => { throw new Error('declined'); } }),
    /declined/,
  );
  assert.equal(eliteEnclaveOwnedBy(store, 'liaison-bo'), null);
});

test('assignPersonalSecurity deploys a real robot controlled by the protected person -- "different attitudes" means a real, different type per person', () => {
  const robotsStore = createRobotsStore();
  const light = assignPersonalSecurity(robotsStore, { protectedPersonId: 'liaison-bo', typeId: 'patrol-drone' });
  const heavy = assignPersonalSecurity(robotsStore, { protectedPersonId: 'liaison-nina', typeId: 'military-robot' });
  assert.equal(light.typeId, 'patrol-drone');
  assert.equal(heavy.typeId, 'military-robot');
  assert.deepEqual(robotsControlledBy(robotsStore, 'liaison-bo'), [light]);
});

test('assignPersonalSecurity requires a real protectedPersonId', () => {
  const robotsStore = createRobotsStore();
  assert.throws(() => assignPersonalSecurity(robotsStore, { typeId: 'patrol-drone' }), /requires a protectedPersonId/);
});
