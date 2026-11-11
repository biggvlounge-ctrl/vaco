'use strict';

const SOURCE_TYPES = Object.freeze([
  'county_assessor',
  'county_recorder',
  'foreclosure_notice',
  'auction_operator',
  'mls_idx',
  'fsbo',
  'wholesaler',
  'off_market_owner_authorized',
  'other'
]);

const CONNECTOR_STATES = Object.freeze(['pending_authorization', 'authorized_not_connected', 'connected', 'paused', 'revoked']);
const SECRET_KEYS = new Set(['apiKey', 'api_key', 'secret', 'clientSecret', 'client_secret', 'accessToken', 'access_token', 'refreshToken', 'refresh_token', 'password', 'authorization', 'credentials']);

function validateConnectorInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Connector input must be an object');
  for (const key of Object.keys(input)) {
    if (SECRET_KEYS.has(key)) throw new TypeError('Credentials and secrets must be stored in a secret manager, never in connector metadata');
  }
  const name = String(input.name || '').trim();
  if (!name || name.length > 120) throw new TypeError('Connector name is required and must be 120 characters or fewer');
  if (!SOURCE_TYPES.includes(input.sourceType)) throw new TypeError('Unsupported acquisition source type');
  const referenceUrl = String(input.referenceUrl || '').trim();
  if (referenceUrl) {
    let parsed;
    try { parsed = new URL(referenceUrl); } catch { throw new TypeError('referenceUrl must be a valid HTTPS URL'); }
    if (parsed.protocol !== 'https:') throw new TypeError('referenceUrl must use HTTPS');
  }
  const licenseScope = String(input.licenseScope || '').trim();
  if (licenseScope.length > 500) throw new TypeError('licenseScope must be 500 characters or fewer');
  return {
    name,
    sourceType: input.sourceType,
    jurisdiction: String(input.jurisdiction || '').trim().slice(0, 160),
    referenceUrl,
    licenseScope,
    attribution: String(input.attribution || '').trim().slice(0, 300),
    refreshPolicy: String(input.refreshPolicy || '').trim().slice(0, 120)
  };
}

function createConnector(input, { tenantId, createdBy, now = new Date().toISOString(), id }) {
  if (!tenantId || !createdBy) throw new TypeError('Tenant and creator are required');
  const metadata = validateConnectorInput(input);
  return {
    id: id || `acqsrc-${require('node:crypto').randomUUID().slice(0, 8)}`,
    tenantId,
    ...metadata,
    status: 'pending_authorization',
    authorizationEvidenceUrl: null,
    authorizedAt: null,
    authorizedBy: null,
    connectionStatus: 'not_connected',
    adapterImplemented: false,
    credentialsReference: null,
    createdBy,
    createdAt: now,
    updatedAt: now,
    notice: 'Registration only. No external data connection, license, or provider authorization is implied.'
  };
}

function authorizeConnector(connector, input, { actorId, now = new Date().toISOString() }) {
  if (!connector) throw new TypeError('Connector not found');
  if (connector.status === 'revoked') throw new TypeError('A revoked connector cannot be reauthorized; create a new registration');
  const evidenceUrl = String(input?.authorizationEvidenceUrl || '').trim();
  let parsed;
  try { parsed = new URL(evidenceUrl); } catch { throw new TypeError('An HTTPS authorization evidence URL is required'); }
  if (parsed.protocol !== 'https:') throw new TypeError('Authorization evidence must use HTTPS');
  const scope = String(input?.confirmedLicenseScope || '').trim();
  if (!scope || scope.length > 500) throw new TypeError('A confirmed license scope is required');
  if (input?.confirmAuthorization !== true) throw new TypeError('Explicit authorization confirmation is required');
  connector.status = 'authorized_not_connected';
  connector.authorizationEvidenceUrl = evidenceUrl;
  connector.licenseScope = scope;
  connector.authorizedAt = now;
  connector.authorizedBy = actorId;
  connector.updatedAt = now;
  connector.notice = 'Authorization was attested by an organization administrator. The adapter is not connected and no synchronization has occurred.';
  return connector;
}

function publicConnector(connector) {
  const { credentialsReference, ...safe } = connector;
  return safe;
}

module.exports = { SOURCE_TYPES, CONNECTOR_STATES, validateConnectorInput, createConnector, authorizeConnector, publicConnector };
