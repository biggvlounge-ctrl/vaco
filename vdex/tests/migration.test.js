'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { rows, validate } = require('../scripts/migrate-json-to-postgres');

test('migration maps every local collection without dropping property intelligence', () => {
  const db = {
    properties:[{id:'p1'}], propertySources:[{id:'s1',propertyId:'p1'}], jobs:[{id:'j1',propertyId:'p1'}],
    jobApplications:[{id:'a1',jobId:'j1'}], sellerLeads:[{id:'l1'}], buyerMandates:[{id:'b1'}],
    watchlist:[{id:'w1',propertyId:'p1'}], auditLog:[{id:'e1'}], propertyHistory:[{id:'h1',propertyId:'p1'}],
    propertyEvidence:[{id:'ev1',propertyId:'p1'}], propertyHighlights:[{id:'hi1',propertyId:'p1'}],
    propertyAssessments:[{id:'as1',propertyId:'p1'}], developmentScenarios:[{id:'d1',propertyId:'p1'}], acquisitionSources:[{id:'c1',tenantId:'org1',sourceType:'county_assessor',status:'pending_authorization'}], stagedAcquisitions:[{id:'st1',tenantId:'org1',datasetKey:'county_assessor',status:'pending_review'}], publicDataObservations:[{id:'o1',tenantId:'org1',sourceKey:'fcc_area_api',externalId:'x1',status:'pending_review',observedAt:'2026-11-01T00:00:00Z'}], sourceCoverage:[{id:'cov1',tenantId:'org1',jurisdiction:'MO',category:'assessor',status:'located'}], publicDataRuns:[{id:'run1',tenantId:'org1',connectorKey:'census_acs_api',status:'succeeded',startedAt:'2026-11-11T12:00:00Z',recordCount:1}]
  };
  validate(db);
  const mapped = rows(db);
  assert.equal(mapped.properties.length,1);
  assert.equal(mapped.acquisitionSources.length,1);
  assert.equal(mapped.acquisitionSources[0].id,'c1');
  assert.equal(mapped.stagedAcquisitions.length,1);
  assert.equal(mapped.stagedAcquisitions[0].id,'st1');
  assert.equal(mapped.publicDataObservations.length,1);
  assert.equal(mapped.sourceCoverage.length,1);
  assert.equal(mapped.publicDataRuns.length,1);
  assert.equal(mapped.publicDataRuns[0].id,'run1');
  assert.equal(mapped.propertyRecords.length,5);
  assert.deepEqual(mapped.propertyRecords.map(x=>x.recordType).sort(),['developmentScenarios','propertyAssessments','propertyEvidence','propertyHighlights','propertyHistory'].sort());
});

test('migration preflight rejects orphaned references before database writes', () => {
  assert.throws(() => validate({properties:[],jobs:[],propertySources:[{id:'s1',propertyId:'missing'}],jobApplications:[],watchlist:[],propertyHistory:[],propertyEvidence:[],propertyHighlights:[],propertyAssessments:[],developmentScenarios:[]}), /missing property/);
});

const fs = require('node:fs');
const path = require('node:path');
const { normalizePrincipal, hasPermission, assertPermission, tenantPredicate } = require('../backend/authorization');

test('authorization rejects missing, inactive, and unknown principals', () => {
  assert.throws(() => normalizePrincipal(null), /authenticated principal/);
  assert.throws(() => normalizePrincipal({userId:'u1',organizationId:'o1',role:'owner',status:'suspended'}), /not active/);
  assert.throws(() => normalizePrincipal({userId:'u1',organizationId:'o1',role:'superuser'}), /not recognized/);
});

test('role permissions are least-privilege and deny by default', () => {
  const worker = {userId:'u1',organizationId:'org1',role:'worker'};
  assert.equal(hasPermission(worker,'workforce:self:read'), true);
  assert.equal(hasPermission(worker,'properties:write'), false);
  assert.equal(hasPermission(worker,'organization:manage'), false);
  assert.equal(hasPermission(null,'properties:read'), false);
  assert.throws(() => assertPermission(worker,'properties:write'), error => error.status === 403);
  assert.equal(hasPermission({userId:'u2',organizationId:'org1',role:'owner'},'anything:here'), true);
});

test('tenant predicate never exposes unassigned or cross-organization records', () => {
  const principal = {userId:'u1',organizationId:'org1',role:'analyst'};
  assert.equal(tenantPredicate(principal,{tenantId:'org1'}), true);
  assert.equal(tenantPredicate(principal,{tenantId:'org2'}), false);
  assert.equal(tenantPredicate(principal,{tenantId:null}), false);
  assert.equal(tenantPredicate(null,{tenantId:'org1'}), false);
});

test('PostgreSQL tenant migration defines identity, membership, invitations and fail-closed RLS', () => {
  const sql = fs.readFileSync(path.join(__dirname,'..','db','migrations','002_identity_tenant_security.sql'),'utf8');
  for (const token of ['app_users','organization_memberships','organization_invites','ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','current_setting(\'vdex.tenant_id\', true)','current_setting(\'vdex.user_id\', true)','tenant_id TEXT REFERENCES organizations(id)']) assert.ok(sql.includes(token), `missing ${token}`);
  assert.match(sql,/CHECK \(role IN \('owner','admin','acquisitions','analyst','workforce_manager','worker','viewer'\)\)/);
  assert.match(sql,/INSERT INTO vdex_schema_migrations\(version\) VALUES \('002_identity_tenant_security'\)/);
  const stagingSql = fs.readFileSync(path.join(__dirname,'..','db','migrations','004_acquisition_import_staging.sql'),'utf8');
  for (const token of ['acquisition_import_staging','ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','vdex.tenant_id']) assert.ok(stagingSql.includes(token));
  const publicDataSql = fs.readFileSync(path.join(__dirname,'..','db','migrations','005_public_data_observations_and_source_coverage.sql'),'utf8');
  for (const token of ['public_data_observations','jurisdiction_source_coverage','ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','vdex.tenant_id']) assert.ok(publicDataSql.includes(token));
  const adapterRunSql = fs.readFileSync(path.join(__dirname,'..','db','migrations','006_public_data_adapter_runs.sql'),'utf8');
  for (const token of ['public_data_adapter_runs','ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','vdex.tenant_id']) assert.ok(adapterRunSql.includes(token));
  const acquisitionSql = fs.readFileSync(path.join(__dirname,'..','db','migrations','003_acquisition_source_connectors.sql'),'utf8');
  for (const token of ['acquisition_source_connectors','ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY','vdex.tenant_id']) assert.ok(acquisitionSql.includes(token));
});
