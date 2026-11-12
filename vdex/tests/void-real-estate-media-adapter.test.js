'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRealEstateMediaJobViaVoid, assignNearestProviderViaVoid, adapterStatus, REAL_ESTATE_SERVICES,
} = require('../backend/void-real-estate-media-adapter');

function fakeFetch(handler) {
  return async (url, options) => handler(url, options);
}

test('createRealEstateMediaJobViaVoid refuses with no agent session token -- this route has no service-credential fallback', async () => {
  await assert.rejects(
    () => createRealEstateMediaJobViaVoid({
      agentId: 'agent-1', propertyAddress: '1 Main St', propertyLat: 38.6, propertyLng: -90.2,
      servicesRequested: ['photos'], baseUrl: 'https://void.example', agentSessionToken: '',
    }),
    (err) => err.code === 'VOID_MEDIA_NO_AGENT_SESSION',
  );
});

test('createRealEstateMediaJobViaVoid refuses when VDEX_VOID_BASE_URL is not configured', async () => {
  await assert.rejects(
    () => createRealEstateMediaJobViaVoid({
      agentId: 'agent-1', propertyAddress: '1 Main St', propertyLat: 38.6, propertyLng: -90.2,
      servicesRequested: ['photos'], baseUrl: null, agentSessionToken: 'real-session',
    }),
    (err) => err.code === 'VOID_MEDIA_NOT_CONFIGURED',
  );
});

test('createRealEstateMediaJobViaVoid validates servicesRequested against VOID\'s own real vocabulary', async () => {
  await assert.rejects(
    () => createRealEstateMediaJobViaVoid({
      agentId: 'agent-1', propertyAddress: '1 Main St', propertyLat: 38.6, propertyLng: -90.2,
      servicesRequested: ['drone-footage'], baseUrl: 'https://void.example', agentSessionToken: 'real-session',
    }),
    /invalid service/,
  );
  assert.deepEqual(REAL_ESTATE_SERVICES, ['photos', 'video-walkthrough', 'aerial-drone', '3d-tour', 'floor-plan']);
});

test('createRealEstateMediaJobViaVoid forwards the real agent session as a Bearer token, never a service credential', async () => {
  let captured = null;
  const fetchImpl = fakeFetch(async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ id: 5, jobId: 50, agentId: 'agent-1', propertyAddress: '1 Main St', servicesRequested: ['photos', 'aerial-drone'], assignedProviderId: null }) };
  });
  const result = await createRealEstateMediaJobViaVoid({
    agentId: 'agent-1', propertyAddress: '1 Main St', propertyLat: 38.6, propertyLng: -90.2,
    servicesRequested: ['photos', 'aerial-drone'], postProductionHandled: 'central', quotedPrice: 350,
    baseUrl: 'https://void.example', agentSessionToken: 'real-shield-session', fetchImpl,
  });
  assert.equal(captured.url, 'https://void.example/api/real-estate-media-job');
  assert.equal(captured.options.headers.Authorization, 'Bearer real-shield-session');
  assert.ok(!('X-Service-Name' in captured.options.headers), 'job creation must never present a service credential');
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.servicesRequested, ['photos', 'aerial-drone']);
  assert.equal(result.id, 5);
});

test('createRealEstateMediaJobViaVoid surfaces a real VOID HTTP error (e.g. not a real agent session)', async () => {
  const fetchImpl = fakeFetch(async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid or expired session' }) }));
  await assert.rejects(
    () => createRealEstateMediaJobViaVoid({
      agentId: 'agent-1', propertyAddress: '1 Main St', propertyLat: 38.6, propertyLng: -90.2,
      servicesRequested: ['photos'], baseUrl: 'https://void.example', agentSessionToken: 'stale-session', fetchImpl,
    }),
    /HTTP 401/,
  );
});

test('assignNearestProviderViaVoid is the genuinely service-to-service half -- requires a service token, not a session', async () => {
  await assert.rejects(
    () => assignNearestProviderViaVoid({ mediaJobId: 5, baseUrl: 'https://void.example', serviceToken: '' }),
    (err) => err.code === 'VOID_MEDIA_NO_SERVICE_TOKEN',
  );
  let captured = null;
  const fetchImpl = fakeFetch(async (url, options) => { captured = { url, options }; return { ok: true, json: async () => ({ id: 5, assignedProviderId: 7, proximityMatched: true }) }; });
  const result = await assignNearestProviderViaVoid({ mediaJobId: 5, providerLat: 38.6, providerLng: -90.2, baseUrl: 'https://void.example', serviceToken: 'tok', fetchImpl });
  assert.equal(captured.url, 'https://void.example/api/real-estate-media-job/5/assign');
  assert.equal(captured.options.headers['X-Service-Name'], 'vdex');
  assert.equal(result.assignedProviderId, 7);
});

test('adapterStatus reports base-URL configuration only -- job creation has no static credential to report on', () => {
  assert.equal(adapterStatus({ env: {} }).configured, false);
  const status = adapterStatus({ env: { VDEX_VOID_BASE_URL: 'https://void.example' } });
  assert.equal(status.configured, true);
  assert.equal(status.connectionStatus, 'not_verified');
});
