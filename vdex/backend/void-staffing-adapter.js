'use strict';

// VDEX -> VOID: route construction/workforce staffing through VOID's
// real, payment-settled staffing marketplace instead of VDEX growing a
// second, parallel payment system.
//
// VOID's `lib/staffing.js` already formalises `hourly`/temporary/
// seasonal/on-demand positions on top of its own real, shared
// `marketplace.js` request->match->accept->complete->pay->rate loop
// (`../void/CLAUDE.md`'s own "One marketplace loop" standing rule).
// VDEX's own `/api/jobs` is a plain job board with real consent/
// withdrawal-token security but NO payment settlement anywhere --
// this adapter is how a VDEX-posted construction/trade position
// actually gets paid, by calling VOID's real, already-tested
// marketplace rather than inventing a second one.
//
// Real route, confirmed directly in `../void/server.js`:
//   POST /api/staffing-position   guarded by actorOrService(requireSession())
// `actorOrService` accepts EITHER a verified end-user Shield session
// OR a verified internal-service credential (`shared/serviceAuth.js`'s
// real `X-Service-Name`/`X-Service-Token` pair, checked against VOID's
// own `VACO_SERVICE_TOKENS` allowlist) -- so this is a genuine,
// unforwarded server-to-server call. No agent/user session is needed
// here, unlike the real-estate-media adapter in this same directory.

const EMPLOYMENT_TYPES = Object.freeze(['temporary', 'seasonal', 'on-demand', 'permanent']);

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

function isConfigured(env = process.env) {
  return Boolean(configuredBaseUrl(env) && env.VDEX_VOID_SERVICE_TOKEN && String(env.VDEX_VOID_SERVICE_TOKEN).trim());
}

// Posts a real staffing position to VOID. Never claims success beyond
// what VOID's own response actually says -- the caller gets back
// exactly VOID's own real `StaffingPosition` record (its own
// `jobId`, already running through VOID's own real marketplace loop).
async function postStaffingPositionViaVoid({
  businessId, positionType, employmentType, hourlyRate, quantity = 1,
  baseUrl = configuredBaseUrl(), serviceToken = process.env.VDEX_VOID_SERVICE_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) throw Object.assign(new Error('VDEX_VOID_BASE_URL is not configured (must be a valid HTTPS URL)'), { code: 'VOID_STAFFING_NOT_CONFIGURED' });
  if (!serviceToken || !String(serviceToken).trim()) throw Object.assign(new Error('VDEX_VOID_SERVICE_TOKEN is required to call VOID staffing as a service'), { code: 'VOID_STAFFING_NO_SERVICE_TOKEN' });
  if (!businessId) throw new Error('postStaffingPositionViaVoid requires a businessId');
  if (!positionType) throw new Error('postStaffingPositionViaVoid requires a positionType');
  if (!EMPLOYMENT_TYPES.includes(employmentType)) throw new Error(`postStaffingPositionViaVoid: invalid employmentType "${employmentType}" (expected one of ${EMPLOYMENT_TYPES.join(', ')})`);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) throw new Error('postStaffingPositionViaVoid requires a positive hourlyRate');
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/staffing-position`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Service-Name': 'vdex',
      'X-Service-Token': serviceToken,
      'User-Agent': 'VDEX-void-staffing-adapter/0.3.24',
    },
    body: JSON.stringify({ businessId, positionType, employmentType, hourlyRate, quantity }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(`VOID staffing request failed: HTTP ${response.status}${payload?.error ? ` -- ${payload.error}` : ''}`), { code: 'VOID_STAFFING_HTTP_ERROR', status: response.status });
  }
  return payload;
}

function adapterStatus({ env = process.env } = {}) {
  const configured = isConfigured(env);
  return {
    key: 'void_staffing',
    adapter: 'cross_app_write_adapter',
    configured,
    connectionStatus: 'not_verified',
    requiredEnvironment: ['VDEX_VOID_BASE_URL', 'VDEX_VOID_SERVICE_TOKEN'],
    authMode: 'service_credential (X-Service-Name/X-Service-Token, verified by VOID against its own VACO_SERVICE_TOKENS allowlist)',
    targetRoute: 'POST /api/staffing-position (VOID)',
    note: configured
      ? 'Credentials are present; post a real position to verify connectivity. No connection is claimed until a successful call.'
      : 'VDEX_VOID_BASE_URL (https) and VDEX_VOID_SERVICE_TOKEN must both be set before any call can be attempted.',
  };
}

module.exports = { EMPLOYMENT_TYPES, isConfigured, postStaffingPositionViaVoid, adapterStatus };
