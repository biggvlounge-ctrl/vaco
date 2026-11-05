// VOID MAGIC — the real live poll of VOID Event Services' job status,
// closing the gap `lib/notifications.js`'s own header used to name:
// 'delay-notification' and 'transportation-update' need "a live poll
// of VOID Event Services' job status." getVoidJobFn is a fake here —
// no network, matching this ecosystem's injected-cross-app-call
// convention.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createVoidMagicStore } = require('../lib/store');
const experiences = require('../lib/experiences');
const { requestEventService, pollEventServiceJobStatuses } = require('../lib/eventServices');
const { getNotifications } = require('../lib/notifications');

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

async function serviceRequest(store, overrides = {}) {
  const { hostId = 'host1', scheduledAt, ...rest } = overrides;
  const e = experience(store, { hostId, ...(scheduledAt ? { scheduledAt } : {}) });
  const request = await requestEventService(store, {
    experienceId: e.id,
    serviceType: 'transport',
    quantity: 1,
    unitPrice: 50,
    voidRequestFn: async () => ({ id: 909 }),
    ...rest,
  });
  return { experience: e, request };
}

test('pollEventServiceJobStatuses requires a getVoidJobFn', async () => {
  const store = createVoidMagicStore();
  await assert.rejects(pollEventServiceJobStatuses(store, {}), /requires a getVoidJobFn/);
});

test('pollEventServiceJobStatuses is a no-op when the live job status has not changed', async () => {
  const store = createVoidMagicStore();
  const { request } = await serviceRequest(store);

  const result = await pollEventServiceJobStatuses(store, {
    getVoidJobFn: async () => ({ id: 909, status: 'requested' }),
  });

  assert.deepEqual(result.updated, []);
  assert.strictEqual(request.status, 'requested');
  assert.deepEqual(getNotifications(store, 'host1'), []);
});

test('pollEventServiceJobStatuses records a transportation-update on a real status change', async () => {
  const store = createVoidMagicStore();
  const { experience: e, request } = await serviceRequest(store);

  const result = await pollEventServiceJobStatuses(store, {
    getVoidJobFn: async () => ({ id: 909, status: 'matched' }),
  });

  assert.strictEqual(result.updated.length, 1);
  assert.deepEqual(result.updated[0], { requestId: request.id, from: 'requested', to: 'matched' });
  assert.strictEqual(request.status, 'matched');

  const notifications = getNotifications(store, e.hostId);
  assert.strictEqual(notifications.length, 1);
  assert.strictEqual(notifications[0].type, 'transportation-update');
  assert.strictEqual(notifications[0].relatedId, request.id);
});

test('pollEventServiceJobStatuses maps a delivery-failed job to a delay-notification', async () => {
  const store = createVoidMagicStore();
  const { experience: e, request } = await serviceRequest(store, { serviceType: 'fulfillment' });

  await pollEventServiceJobStatuses(store, { getVoidJobFn: async () => ({ id: 909, status: 'delivery-failed' }) });

  assert.strictEqual(request.status, 'delivery-failed');
  const notifications = getNotifications(store, e.hostId);
  assert.strictEqual(notifications.length, 1);
  assert.strictEqual(notifications[0].type, 'delay-notification');
});

test('pollEventServiceJobStatuses stops polling a request once it reaches a terminal status', async () => {
  const store = createVoidMagicStore();
  const { request } = await serviceRequest(store);

  await pollEventServiceJobStatuses(store, { getVoidJobFn: async () => ({ id: 909, status: 'completed' }) });
  assert.strictEqual(request.status, 'completed');

  let calls = 0;
  await pollEventServiceJobStatuses(store, {
    getVoidJobFn: async () => { calls += 1; return { id: 909, status: 'cancelled' }; },
  });
  assert.strictEqual(calls, 0);
  assert.strictEqual(request.status, 'completed');
});

test('pollEventServiceJobStatuses fails soft on one request and keeps polling the rest', async () => {
  const store = createVoidMagicStore();
  const { request: badRequest } = await serviceRequest(store, { hostId: 'host1', voidRequestFn: async () => ({ id: 111 }) });
  const { request: goodRequest } = await serviceRequest(store, { hostId: 'host2', voidRequestFn: async () => ({ id: 222 }) });

  const result = await pollEventServiceJobStatuses(store, {
    getVoidJobFn: async (jobId) => {
      if (jobId === badRequest.voidJobId) throw new Error('void unreachable');
      return { id: jobId, status: 'accepted' };
    },
  });

  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].requestId, badRequest.id);
  assert.strictEqual(badRequest.status, 'requested');

  assert.strictEqual(result.updated.length, 1);
  assert.strictEqual(goodRequest.status, 'accepted');
});
