'use strict';

// VDEX -> VOID: request real property media (photos, video walkthrough,
// aerial drone, 3D tour, floor plan) through VOID's real, already-built
// HomeJab-style `lib/realEstateMedia.js` -- proximity auto-assignment
// to an approved photographer, centralised or provider-side post-
// production, and (for the aerial-drone service) VOID's own real
// delivery-drone fleet reused for a second purpose. VDEX does not
// build a capture pipeline; it requests one that already exists.
//
// Real route, confirmed directly in `../void/server.js`:
//   POST /api/real-estate-media-job   guarded by requireActor('agentId')
// Unlike the staffing adapter in this same directory, this route is
// NOT wrapped in `actorOrService` -- it requires a real, live VOID
// Shield session belonging to an actual real-estate agent, not a
// service credential. So this adapter cannot authenticate itself; it
// forwards the calling agent's own real session token, the same
// session-forwarding shape `vacay/lib/bookings/dropStays.js` already
// uses for VOID DROP bookings. A call made with no real
// `agentSessionToken` is refused before any request is sent -- there
// is no service-credential fallback for this specific route, and none
// is invented here.
//
// The real assignment step, `POST /api/real-estate-media-job/:id/assign`,
// IS `requireCallingService()` -- a genuine service-to-service call --
// and is exposed separately below for whichever caller (VOID itself,
// an operator tool, or a future VDEX scheduler) actually triggers
// assignment; VDEX does not auto-assign on creation.

const REAL_ESTATE_SERVICES = Object.freeze(['photos', 'video-walkthrough', 'aerial-drone', '3d-tour', 'floor-plan']);
const POST_PRODUCTION_MODES = Object.freeze(['central', 'provider']);

function configuredBaseUrl(env = process.env) {
  const url = env.VDEX_VOID_BASE_URL;
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

async function createRealEstateMediaJobViaVoid({
  agentId, propertyAddress, propertyLat, propertyLng, servicesRequested = [],
  postProductionHandled = 'central', quotedPrice, agentSessionToken,
  baseUrl = configuredBaseUrl(), fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) throw Object.assign(new Error('VDEX_VOID_BASE_URL is not configured (must be a valid HTTPS URL)'), { code: 'VOID_MEDIA_NOT_CONFIGURED' });
  if (!agentSessionToken || !String(agentSessionToken).trim()) {
    throw Object.assign(new Error('createRealEstateMediaJobViaVoid requires the real estate agent\'s own forwarded VOID session token -- this route accepts no service credential'), { code: 'VOID_MEDIA_NO_AGENT_SESSION' });
  }
  if (!agentId) throw new Error('createRealEstateMediaJobViaVoid requires an agentId');
  if (!propertyAddress) throw new Error('createRealEstateMediaJobViaVoid requires a propertyAddress');
  if (!Number.isFinite(propertyLat) || !Number.isFinite(propertyLng)) throw new Error('createRealEstateMediaJobViaVoid requires numeric propertyLat and propertyLng');
  if (!Array.isArray(servicesRequested) || servicesRequested.length === 0) throw new Error('createRealEstateMediaJobViaVoid requires at least one servicesRequested entry');
  for (const service of servicesRequested) {
    if (!REAL_ESTATE_SERVICES.includes(service)) throw new Error(`createRealEstateMediaJobViaVoid: invalid service "${service}" (expected one of ${REAL_ESTATE_SERVICES.join(', ')})`);
  }
  if (!POST_PRODUCTION_MODES.includes(postProductionHandled)) throw new Error(`createRealEstateMediaJobViaVoid: invalid postProductionHandled "${postProductionHandled}" (expected one of ${POST_PRODUCTION_MODES.join(', ')})`);
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/real-estate-media-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${agentSessionToken}`,
      'User-Agent': 'VDEX-void-real-estate-media-adapter/0.3.24',
    },
    body: JSON.stringify({ agentId, propertyAddress, propertyLat, propertyLng, servicesRequested, postProductionHandled, quotedPrice }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(`VOID real-estate-media request failed: HTTP ${response.status}${payload?.error ? ` -- ${payload.error}` : ''}`), { code: 'VOID_MEDIA_HTTP_ERROR', status: response.status });
  }
  return payload;
}

// The real, service-to-service assignment step -- genuinely callable
// without a human session, unlike creation above.
async function assignNearestProviderViaVoid({
  mediaJobId, providerLat, providerLng, serviceToken = process.env.VDEX_VOID_SERVICE_TOKEN,
  baseUrl = configuredBaseUrl(), fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) throw Object.assign(new Error('VDEX_VOID_BASE_URL is not configured (must be a valid HTTPS URL)'), { code: 'VOID_MEDIA_NOT_CONFIGURED' });
  if (!serviceToken || !String(serviceToken).trim()) throw Object.assign(new Error('VDEX_VOID_SERVICE_TOKEN is required to call VOID media assignment as a service'), { code: 'VOID_MEDIA_NO_SERVICE_TOKEN' });
  if (!Number.isFinite(mediaJobId)) throw new Error('assignNearestProviderViaVoid requires a numeric mediaJobId');
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/real-estate-media-job/${mediaJobId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Service-Name': 'vdex',
      'X-Service-Token': serviceToken,
      'User-Agent': 'VDEX-void-real-estate-media-adapter/0.3.24',
    },
    body: JSON.stringify({ providerLat, providerLng }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(`VOID media assignment failed: HTTP ${response.status}${payload?.error ? ` -- ${payload.error}` : ''}`), { code: 'VOID_MEDIA_ASSIGN_HTTP_ERROR', status: response.status });
  }
  return payload;
}

function adapterStatus({ env = process.env } = {}) {
  const baseConfigured = Boolean(configuredBaseUrl(env));
  return {
    key: 'void_real_estate_media',
    adapter: 'cross_app_write_adapter',
    configured: baseConfigured,
    connectionStatus: 'not_verified',
    requiredEnvironment: ['VDEX_VOID_BASE_URL'],
    authMode: 'job creation requires the real estate agent\'s own forwarded VOID session (no service-credential path exists for this route); assignment is a real service credential (X-Service-Name/X-Service-Token)',
    targetRoutes: ['POST /api/real-estate-media-job (VOID, requireActor agentId)', 'POST /api/real-estate-media-job/:id/assign (VOID, requireCallingService)'],
    note: baseConfigured
      ? 'Base URL is present. Job creation additionally requires a real forwarded agent session per call, verified only when a real agent actually acts -- not a static credential this status can report on.'
      : 'VDEX_VOID_BASE_URL (https) must be set before any call can be attempted.',
  };
}

module.exports = {
  REAL_ESTATE_SERVICES, POST_PRODUCTION_MODES, createRealEstateMediaJobViaVoid, assignNearestProviderViaVoid, adapterStatus,
};
