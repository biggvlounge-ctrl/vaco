'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SOURCE_TYPES, validateConnectorInput, createConnector, authorizeConnector, publicConnector } = require('../backend/acquisition-sources');

const input = { name: 'County assessor portal', sourceType: 'county_assessor', jurisdiction: 'St. Louis County, MO', referenceUrl: 'https://example.gov/assessor', licenseScope: 'Pending review', attribution: 'County assessor', refreshPolicy: 'Manual review' };

test('acquisition connector registration validates source type and HTTPS references', () => {
  assert.ok(SOURCE_TYPES.includes('foreclosure_notice'));
  assert.throws(() => validateConnectorInput({ ...input, sourceType: 'restricted_scraper' }), /Unsupported/);
  assert.throws(() => validateConnectorInput({ ...input, referenceUrl: 'http://example.gov' }), /HTTPS/);
  assert.throws(() => validateConnectorInput({ ...input, apiKey: 'secret' }), /secret manager/);
});

test('connector registration fails closed and never claims a connection', () => {
  const connector = createConnector(input, { tenantId: 'org-a', createdBy: 'user-a', id: 'source-a' });
  assert.equal(connector.status, 'pending_authorization');
  assert.equal(connector.connectionStatus, 'not_connected');
  assert.equal(connector.adapterImplemented, false);
  assert.equal(connector.authorizedAt, null);
  assert.equal(publicConnector(connector).credentialsReference, undefined);
});

test('connector authorization requires explicit attestation and HTTPS evidence', () => {
  const connector = createConnector(input, { tenantId: 'org-a', createdBy: 'user-a' });
  assert.throws(() => authorizeConnector(connector, { authorizationEvidenceUrl: 'https://example.gov/license', confirmedLicenseScope: 'County parcel lookup' }, { actorId: 'admin-a' }), /Explicit authorization/);
  assert.throws(() => authorizeConnector(connector, { confirmAuthorization: true, authorizationEvidenceUrl: 'http://example.gov/license', confirmedLicenseScope: 'County parcel lookup' }, { actorId: 'admin-a' }), /HTTPS/);
  authorizeConnector(connector, { confirmAuthorization: true, authorizationEvidenceUrl: 'https://example.gov/license', confirmedLicenseScope: 'County parcel lookup' }, { actorId: 'admin-a' });
  assert.equal(connector.status, 'authorized_not_connected');
  assert.equal(connector.connectionStatus, 'not_connected');
  assert.equal(connector.adapterImplemented, false);
  assert.equal(connector.authorizedBy, 'admin-a');
});

test('revoked connector cannot be reauthorized', () => {
  const connector = createConnector(input, { tenantId: 'org-a', createdBy: 'user-a' });
  connector.status = 'revoked';
  assert.throws(() => authorizeConnector(connector, { confirmAuthorization: true, authorizationEvidenceUrl: 'https://example.gov/license', confirmedLicenseScope: 'County parcel lookup' }, { actorId: 'admin-a' }), /revoked/);
});
