'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { postStaffingPositionViaVoid, adapterStatus, isConfigured } = require('../backend/void-staffing-adapter');

function fakeFetch(handler) {
  return async (url, options) => handler(url, options);
}

test('postStaffingPositionViaVoid refuses when VDEX_VOID_BASE_URL is not configured', async () => {
  await assert.rejects(
    () => postStaffingPositionViaVoid({ businessId: 'b1', positionType: 'framer', employmentType: 'temporary', hourlyRate: 28, baseUrl: null, serviceToken: 'tok' }),
    (err) => err.code === 'VOID_STAFFING_NOT_CONFIGURED',
  );
});

test('postStaffingPositionViaVoid refuses when no service token is present -- this is the real auth requirement, not optional', async () => {
  await assert.rejects(
    () => postStaffingPositionViaVoid({ businessId: 'b1', positionType: 'framer', employmentType: 'temporary', hourlyRate: 28, baseUrl: 'https://void.example', serviceToken: '' }),
    (err) => err.code === 'VOID_STAFFING_NO_SERVICE_TOKEN',
  );
});

test('postStaffingPositionViaVoid validates employmentType against VOID\'s own real vocabulary', async () => {
  await assert.rejects(
    () => postStaffingPositionViaVoid({ businessId: 'b1', positionType: 'framer', employmentType: 'full-time', hourlyRate: 28, baseUrl: 'https://void.example', serviceToken: 'tok' }),
    /invalid employmentType/,
  );
});

test('postStaffingPositionViaVoid sends the real X-Service-Name/X-Service-Token headers and the exact VOID body shape', async () => {
  let captured = null;
  const fetchImpl = fakeFetch(async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ id: 1, jobId: 10, businessId: 'b1', positionType: 'framer', employmentType: 'temporary', hourlyRate: 28, createdAt: Date.now() }) };
  });
  const result = await postStaffingPositionViaVoid({
    businessId: 'b1', positionType: 'framer', employmentType: 'temporary', hourlyRate: 28, quantity: 2,
    baseUrl: 'https://void.example', serviceToken: 'real-token', fetchImpl,
  });
  assert.equal(captured.url, 'https://void.example/api/staffing-position');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['X-Service-Name'], 'vdex');
  assert.equal(captured.options.headers['X-Service-Token'], 'real-token');
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body, { businessId: 'b1', positionType: 'framer', employmentType: 'temporary', hourlyRate: 28, quantity: 2 });
  assert.equal(result.id, 1);
});

test('postStaffingPositionViaVoid surfaces a real VOID HTTP error rather than swallowing it', async () => {
  const fetchImpl = fakeFetch(async () => ({ ok: false, status: 403, json: async () => ({ error: 'requireCallingService: this route is for internal schedulers and requires a service credential' }) }));
  await assert.rejects(
    () => postStaffingPositionViaVoid({ businessId: 'b1', positionType: 'framer', employmentType: 'temporary', hourlyRate: 28, baseUrl: 'https://void.example', serviceToken: 'tok', fetchImpl }),
    /HTTP 403/,
  );
});

test('adapterStatus never reports configured without both a valid https base URL and a service token', () => {
  assert.equal(adapterStatus({ env: {} }).configured, false);
  assert.equal(adapterStatus({ env: { VDEX_VOID_BASE_URL: 'https://void.example' } }).configured, false);
  assert.equal(adapterStatus({ env: { VDEX_VOID_BASE_URL: 'http://void.example', VDEX_VOID_SERVICE_TOKEN: 'tok' } }).configured, false, 'http (not https) must not count as configured');
  assert.equal(adapterStatus({ env: { VDEX_VOID_BASE_URL: 'https://void.example', VDEX_VOID_SERVICE_TOKEN: 'tok' } }).configured, true);
  assert.equal(isConfigured({ VDEX_VOID_BASE_URL: 'https://void.example', VDEX_VOID_SERVICE_TOKEN: 'tok' }), true);
});

test('adapterStatus never claims a live connection', () => {
  assert.equal(adapterStatus({ env: { VDEX_VOID_BASE_URL: 'https://void.example', VDEX_VOID_SERVICE_TOKEN: 'tok' } }).connectionStatus, 'not_verified');
});
