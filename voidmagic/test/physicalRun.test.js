// VOID MAGIC — ordering real merch/collectibles for an experience,
// through CVLLEX's real production-order API. cvllexRequestFn is a
// fake here — no network, matching this ecosystem's injected-cross-
// app-call convention.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createVoidMagicStore } = require('../lib/store');
const experiences = require('../lib/experiences');

const HOUR = 3600000;

function experience(store, overrides = {}) {
  return experiences.createExperience(store, {
    hostId: 'host1',
    title: 'Meet & Greet',
    type: experiences.EXPERIENCE_TYPES[0],
    format: experiences.EXPERIENCE_FORMATS[0],
    capacity: 10,
    durationMinutes: 30,
    price: 20,
    scheduledAt: Date.now() + 200 * HOUR,
    location: 'L',
    ...overrides,
  });
}

test('requestPhysicalRun refuses for an unknown experience', async () => {
  const store = createVoidMagicStore();
  await assert.rejects(
    experiences.requestPhysicalRun(store, {
      experienceId: 999, itemType: 'poster', quantity: 10, cvllexRequestFn: async () => ({ id: 1 }),
    }),
    /no experience with id 999/,
  );
});

test('requestPhysicalRun calls cvllexRequestFn with the real host as creator and a real vendorNote', async () => {
  const store = createVoidMagicStore();
  const e = experience(store);

  let seen;
  const cvllexRequestFn = async (options) => { seen = options; return { id: 44 }; };

  const result = await experiences.requestPhysicalRun(store, {
    experienceId: e.id, itemType: 'pin', quantity: 100, estimatedUnitCost: 0.8, cvllexRequestFn,
  });

  assert.strictEqual(seen.creatorId, 'host1');
  assert.strictEqual(seen.itemType, 'pin');
  assert.strictEqual(seen.quantity, 100);
  assert.strictEqual(seen.estimatedUnitCost, 0.8);
  assert.match(seen.vendorNote, /experience #\d+ "Meet & Greet"/);
  assert.strictEqual(result.order.id, 44);
});

test('requestPhysicalRun records the real cvllex order id on the experience', async () => {
  const store = createVoidMagicStore();
  const e = experience(store);
  await experiences.requestPhysicalRun(store, {
    experienceId: e.id, itemType: 'poster', quantity: 25, cvllexRequestFn: async () => ({ id: 5 }),
  });
  assert.deepEqual(e.physicalProductionOrderIds, [5]);
});
