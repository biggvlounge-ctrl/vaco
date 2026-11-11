'use strict';
// One-time, explicit JSON -> PostgreSQL import. Does not delete or modify the source JSON file.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'db/migrations');
const SCHEMA_FILES = ['001_initial_postgres_postgis.sql','002_identity_tenant_security.sql','003_acquisition_source_connectors.sql','004_acquisition_import_staging.sql','005_public_data_observations_and_source_coverage.sql','006_public_data_adapter_runs.sql'].map(name => path.join(SCHEMA_DIR, name));
const DEFAULT_DB = path.join(ROOT, 'data/db.json');

function readSource(file = process.env.VDEX_DB_PATH || DEFAULT_DB) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const keys = ['properties','jobs','jobApplications','sellerLeads','buyerMandates','watchlist','auditLog','propertySources','propertyHistory','propertyEvidence','propertyHighlights','propertyAssessments','developmentScenarios','acquisitionSources','stagedAcquisitions','publicDataObservations','sourceCoverage','publicDataRuns'];
  for (const key of keys) if (!Array.isArray(parsed[key])) parsed[key] = [];
  return parsed;
}
function validate(db) {
  const propertyIds = new Set(db.properties.map(x => x.id));
  const jobIds = new Set(db.jobs.map(x => x.id));
  const errors = [];
  for (const x of db.propertySources) if (!propertyIds.has(x.propertyId)) errors.push(`source ${x.id} references missing property ${x.propertyId}`);
  for (const x of db.jobs) if (x.propertyId && !propertyIds.has(x.propertyId)) errors.push(`job ${x.id} references missing property ${x.propertyId}`);
  for (const x of db.jobApplications) if (!jobIds.has(x.jobId)) errors.push(`application ${x.id} references missing job ${x.jobId}`);
  for (const x of db.watchlist) if (!propertyIds.has(x.propertyId)) errors.push(`watchlist ${x.id} references missing property ${x.propertyId}`);
  for (const key of ['propertyHistory','propertyEvidence','propertyHighlights','propertyAssessments','developmentScenarios']) for (const x of db[key]) if (!propertyIds.has(x.propertyId)) errors.push(`${key} record ${x.id} references missing property ${x.propertyId}`);
  if (errors.length) throw new Error(`Migration preflight failed:\n${errors.join('\n')}`);
  return { properties: propertyIds.size, jobs: jobIds.size, errors: 0 };
}
function rows(db) {
  const propertyRecords = [];
  for (const type of ['propertyHistory','propertyEvidence','propertyHighlights','propertyAssessments','developmentScenarios']) {
    for (const item of db[type]) propertyRecords.push({ ...item, recordType: type });
  }
  return {
    properties: db.properties,
    propertySources: db.propertySources,
    acquisitionSources: db.acquisitionSources,
    stagedAcquisitions: db.stagedAcquisitions,
    publicDataObservations: db.publicDataObservations,
    sourceCoverage: db.sourceCoverage,
    publicDataRuns: db.publicDataRuns,
    jobs: db.jobs,
    jobApplications: db.jobApplications,
    sellerLeads: db.sellerLeads,
    buyerMandates: db.buyerMandates,
    watchlist: db.watchlist,
    propertyRecords,
    auditEvents: db.auditLog
  };
}
async function main() {
  const sourcePath = process.env.VDEX_DB_PATH || DEFAULT_DB;
  const db = readSource(sourcePath);
  const integrity = validate(db);
  const data = rows(db);
  const counts = Object.fromEntries(Object.entries(data).map(([k,v]) => [k,v.length]));
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(JSON.stringify({ mode:'dry-run', sourcePath, counts, integrity, sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'), sourcePreserved:true }, null, 2) + '\n');
    return;
  }
  const databaseUrl = process.env.VDEX_DATABASE_URL;
  if (!databaseUrl) throw new Error('Set VDEX_DATABASE_URL to the target PostgreSQL connection string.');
  let Client;
  try { ({ Client } = require('pg')); } catch { throw new Error('PostgreSQL driver missing. Install it in the project environment with: npm install pg'); }
  const client = new Client({ connectionString: databaseUrl, ssl: process.env.VDEX_PG_SSL === 'require' ? { rejectUnauthorized: true } : undefined });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const schemaFile of SCHEMA_FILES) await client.query(fs.readFileSync(schemaFile, 'utf8'));
    const insert = async (table, item, extra = {}) => {
      const id = String(item.id || `${table}-${crypto.randomUUID()}`);
      const created = item.createdAt || item.at || null;
      const payload = { ...item, ...extra };
      if (table === 'properties') {
        await client.query(`INSERT INTO properties(id,address,city,state,parcel_identifier,parcel_jurisdiction,property_type,status,asking_price,acreage,created_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload`, [id,item.address || 'Unknown',item.city || null,item.state || null,item.parcelIdentifier || null,item.parcelJurisdiction || null,item.propertyType || null,item.status || null,Number(item.askingPrice) || null,Number(item.acreage) || null,created,payload]);
      } else if (table === 'acquisition_source_connectors') {
        await client.query(`INSERT INTO acquisition_source_connectors(id,tenant_id,source_type,status,created_at,payload) VALUES($1,(SELECT id FROM organizations WHERE id=$2),$3,$4,$5,$6::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.tenantId || null,item.sourceType || 'other',item.status || 'pending_authorization',created,payload]);
      } else if (table === 'acquisition_import_staging') {
        await client.query(`INSERT INTO acquisition_import_staging(id,tenant_id,dataset_key,external_record_id,status,received_at,payload) VALUES($1,(SELECT id FROM organizations WHERE id=$2),$3,$4,$5,$6,$7::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.tenantId,item.datasetKey,item.externalRecordId,item.status,item.receivedAt || created,payload]);
      } else if (table === 'public_data_observations') {
        await client.query(`INSERT INTO public_data_observations(id,tenant_id,source_key,external_id,status,observed_at,received_at,payload) VALUES($1,(SELECT id FROM organizations WHERE id=$2),$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.tenantId,item.sourceKey,item.externalId,item.status,item.observedAt,item.receivedAt,payload]);
      } else if (table === 'public_data_adapter_runs') {
        await client.query(`INSERT INTO public_data_adapter_runs(id,tenant_id,connector_key,status,started_at,completed_at,record_count,payload) VALUES($1,(SELECT id FROM organizations WHERE id=$2),$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.tenantId,item.connectorKey,item.status,item.startedAt,item.completedAt || null,item.recordCount || 0,payload]);
      } else if (table === 'jurisdiction_source_coverage') {
        await client.query(`INSERT INTO jurisdiction_source_coverage(id,tenant_id,jurisdiction,category,source_url,status,last_checked_at,payload) VALUES($1,(SELECT id FROM organizations WHERE id=$2),$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.tenantId,item.jurisdiction,item.category,item.sourceUrl,item.status,item.lastCheckedAt,payload]);
      } else if (table === 'property_sources') {
        await client.query(`INSERT INTO property_sources(id,property_id,source_name,verification_status,license_status,retrieved_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.propertyId,item.sourceName || null,item.verificationStatus || 'unverified',item.licenseStatus || 'unknown',item.retrievedAt || null,payload]);
      } else if (table === 'jobs') {
        await client.query(`INSERT INTO jobs(id,property_id,status,created_at,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.propertyId || null,item.status || 'Unknown',created,payload]);
      } else if (table === 'job_applications') {
        await client.query(`INSERT INTO job_applications(id,job_id,status,consent,created_at,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.jobId,item.status || 'Unknown',item.consent === true,created,payload]);
      } else if (table === 'seller_leads') {
        await client.query(`INSERT INTO seller_leads(id,consent,status,created_at,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.consent === true,item.status || 'Unknown',created,payload]);
      } else if (table === 'buyer_mandates') {
        await client.query(`INSERT INTO buyer_mandates(id,created_at,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING`, [id,created,payload]);
      } else if (table === 'watchlist_items') {
        await client.query(`INSERT INTO watchlist_items(id,property_id,created_at,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.propertyId,created,payload]);
      } else if (table === 'property_records') {
        await client.query(`INSERT INTO property_records(id,property_id,record_type,created_at,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.propertyId,item.recordType,created,payload]);
      } else if (table === 'audit_events') {
        await client.query(`INSERT INTO audit_events(id,action,entity_type,entity_id,occurred_at,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(id) DO NOTHING`, [id,item.action || 'unknown',item.entity || 'unknown',item.entityId || null,item.at || new Date().toISOString(),payload]);
      }
    };
    for (const [table, items] of Object.entries(data)) {
      const target = ({propertySources:'property_sources',acquisitionSources:'acquisition_source_connectors',stagedAcquisitions:'acquisition_import_staging',publicDataObservations:'public_data_observations',sourceCoverage:'jurisdiction_source_coverage',publicDataRuns:'public_data_adapter_runs',jobApplications:'job_applications',sellerLeads:'seller_leads',buyerMandates:'buyer_mandates',watchlist:'watchlist_items',propertyRecords:'property_records',auditEvents:'audit_events'})[table] || table;
      for (const item of items) await insert(target, item);
    }
    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({ mode:'imported', counts, integrity, sourcePreserved:true, transaction:'committed' }, null, 2) + '\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
if (require.main === module) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
module.exports = { readSource, rows, validate, SCHEMA_FILES };
