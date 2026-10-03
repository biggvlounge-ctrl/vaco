'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPropertyStore, purchaseHome, homeOwnedBy, advanceLifecycle, upgradeHome,
  rentHome, buyRentedHome, HOME_PRICE, RENT_PRICE, LIFECYCLE, PROPERTY_LEVELS,
} from '../src/lib/property.js';
import { TOWN_NAME } from '../src/lib/town.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

test('purchaseHome claims the property before the transfer, and charges the real price', async () => {
  const store = createPropertyStore();
  const calls = [];
  const home = await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, HOME_PRICE);
  assert.equal(home.ownerId, 'alice');
  assert.equal(homeOwnedBy(store, 'alice').id, home.id);
});

test('a failed purchase rolls the claim back -- no home left on the books', async () => {
  const store = createPropertyStore();
  const calls = [];
  await assert.rejects(
    purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls, { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'alice'), null, 'a declined charge must not leave a home on the books');
  assert.equal(store.properties.length, 0);
});

test('a second home is refused for someone who already owns one', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /already owns a home/,
  );
});

test('advanceLifecycle moves one real stage at a time and stops at the end', () => {
  const property = { lifecycleStage: LIFECYCLE[0] };
  for (let i = 0; i < LIFECYCLE.length + 3; i += 1) advanceLifecycle(property);
  assert.equal(property.lifecycleStage, LIFECYCLE[LIFECYCLE.length - 1], 'lifecycle must not run past its last real stage');
});

test('there are 5 tower levels, and the entry-level ones carry the VXLLAGE/town brand', () => {
  assert.equal(PROPERTY_LEVELS.length, 5);
  assert.ok(PROPERTY_LEVELS[0].name.includes('VXLLAGE'));
  assert.ok(PROPERTY_LEVELS[0].name.includes(TOWN_NAME));
  assert.ok(PROPERTY_LEVELS[1].name.includes('VXLLAGE'));
  assert.ok(!PROPERTY_LEVELS[2].name.includes('VXLLAGE'), 'tier 3+ moves out of the VXLLAGE complex');
});

test('a purchased home starts at the first tower level', async () => {
  const store = createPropertyStore();
  const home = await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  assert.equal(home.level, PROPERTY_LEVELS[0].level);
  assert.equal(home.levelName, PROPERTY_LEVELS[0].name);
});

test('upgradeHome charges only the price difference between levels, not the next level\'s full price', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  const calls = [];
  const home = await upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });

  assert.equal(home.level, PROPERTY_LEVELS[1].level);
  assert.equal(home.levelName, PROPERTY_LEVELS[1].name);
  assert.equal(calls[0].amount, PROPERTY_LEVELS[1].price - PROPERTY_LEVELS[0].price);
});

test('a failed upgrade rolls the level back', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'alice').level, PROPERTY_LEVELS[0].level, 'a declined charge must not leave the home upgraded');
});

test('upgradeHome refuses someone with no home, and refuses past the top level', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /does not own a home/,
  );

  await purchaseHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) });
  for (let i = 1; i < PROPERTY_LEVELS.length; i += 1) {
    await upgradeHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) });
  }
  await assert.rejects(
    upgradeHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) }),
    /already at the top level/,
  );
});

test('rentHome charges the cheap rent price, not the full purchase price, and always starts at a Studio', async () => {
  const store = createPropertyStore();
  const calls = [];
  const home = await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });

  assert.equal(calls[0].amount, RENT_PRICE);
  assert.ok(RENT_PRICE < HOME_PRICE, 'renting must be cheaper than buying outright');
  assert.equal(home.ownershipType, 'rented');
  assert.equal(home.level, PROPERTY_LEVELS[0].level);
});

test('rentHome is refused for someone who already has a home, owned or rented', async () => {
  const store = createPropertyStore();
  await purchaseHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /already has a home/,
  );
});

test('upgradeHome refuses a rented home -- renting has no tower levels', async () => {
  const store = createPropertyStore();
  await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    upgradeHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /renting, not owning/,
  );
});

test('buyRentedHome charges only the real remainder, crediting the rent already paid', async () => {
  const store = createPropertyStore();
  await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  const calls = [];
  const home = await buyRentedHome(store, { ownerId: 'alice', transferFn: fakeTransfer(calls) });

  assert.equal(calls[0].amount, HOME_PRICE - RENT_PRICE);
  assert.equal(home.ownershipType, 'owned');
});

test('a failed buyRentedHome rolls back to rented', async () => {
  const store = createPropertyStore();
  await rentHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) });
  await assert.rejects(
    buyRentedHome(store, { ownerId: 'alice', transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(homeOwnedBy(store, 'alice').ownershipType, 'rented');
});

test('buyRentedHome refuses someone with no home and someone who already owns', async () => {
  const store = createPropertyStore();
  await assert.rejects(
    buyRentedHome(store, { ownerId: 'alice', transferFn: fakeTransfer([]) }),
    /does not have a home/,
  );

  await purchaseHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) });
  await assert.rejects(
    buyRentedHome(store, { ownerId: 'bob', transferFn: fakeTransfer([]) }),
    /already owns their home/,
  );
});
