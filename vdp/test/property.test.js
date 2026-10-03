'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyStore, purchaseHome, homeOwnedBy, advanceLifecycle, HOME_PRICE, LIFECYCLE } from '../src/lib/property.js';

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
