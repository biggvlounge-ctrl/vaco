// VDP — homelessness.js: a real, derived status, never a stored flag.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { isHoused, isHomeless, canAffordAnyHousing, isHomelessDueToIncome } from '../src/lib/homelessness.js';
import { createPropertyStore, purchaseHome } from '../src/lib/property.js';
import { createHouseholdsStore, ensureHousehold, addMember } from '../src/lib/households.js';

const fakeTransfer = async () => ({ ok: true });

test('isHomeless is true for a real entity with no real home and no real household', () => {
  const propertyStore = createPropertyStore();
  const householdsStore = createHouseholdsStore();
  assert.equal(isHoused(propertyStore, householdsStore, 'alice'), false);
  assert.equal(isHomeless(propertyStore, householdsStore, 'alice'), true);
});

test('isHoused is true once a real property.js home is purchased', async () => {
  const propertyStore = createPropertyStore();
  const householdsStore = createHouseholdsStore();
  await purchaseHome(propertyStore, { ownerId: 'alice', transferFn: fakeTransfer });
  assert.equal(isHoused(propertyStore, householdsStore, 'alice'), true);
  assert.equal(isHomeless(propertyStore, householdsStore, 'alice'), false);
});

test('isHoused is true for a real guest who joins someone else\'s real household, even owning nothing', () => {
  const propertyStore = createPropertyStore();
  const householdsStore = createHouseholdsStore();
  ensureHousehold(householdsStore, { propertyId: 1, ownerId: 'host' });
  addMember(householdsStore, { propertyId: 1, memberId: 'guest' });
  assert.equal(isHoused(propertyStore, householdsStore, 'guest'), true);
});

test('canAffordAnyHousing reads the real income tier -- "low" cannot afford even the cheapest real unit', () => {
  assert.equal(canAffordAnyHousing('low'), false);
  assert.equal(canAffordAnyHousing('lower-middle'), true);
  assert.equal(canAffordAnyHousing('affluent'), true);
});

test('canAffordAnyHousing refuses to assume an unknown income level can afford anything', () => {
  assert.equal(canAffordAnyHousing('not-a-real-tier'), false);
});

test('isHomelessDueToIncome is the real, combined condition -- homeless AND income cannot fix it', () => {
  const propertyStore = createPropertyStore();
  const householdsStore = createHouseholdsStore();
  assert.equal(isHomelessDueToIncome(propertyStore, householdsStore, 'alice', 'low'), true);
});

test('isHomelessDueToIncome is false for someone homeless but who could actually afford a real home -- they just have not bought one yet', () => {
  const propertyStore = createPropertyStore();
  const householdsStore = createHouseholdsStore();
  assert.equal(isHomelessDueToIncome(propertyStore, householdsStore, 'bob', 'affluent'), false);
});

test('isHomelessDueToIncome is false once a real home or household exists, regardless of income', async () => {
  const propertyStore = createPropertyStore();
  const householdsStore = createHouseholdsStore();
  await purchaseHome(propertyStore, { ownerId: 'alice', transferFn: fakeTransfer });
  assert.equal(isHomelessDueToIncome(propertyStore, householdsStore, 'alice', 'low'), false);
});
