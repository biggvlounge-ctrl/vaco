CREATE TABLE IF NOT EXISTS acquisition_import_staging (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_key TEXT NOT NULL,
  external_record_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_review','duplicate_review','approved','rejected','linked_existing')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS acquisition_import_external_dedupe_idx
  ON acquisition_import_staging(tenant_id, dataset_key, external_record_id)
  WHERE external_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS acquisition_import_tenant_status_idx
  ON acquisition_import_staging(tenant_id, status, received_at DESC);
ALTER TABLE acquisition_import_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_import_staging FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vdex_acquisition_import_tenant_isolation ON acquisition_import_staging;
CREATE POLICY vdex_acquisition_import_tenant_isolation ON acquisition_import_staging
  USING (tenant_id = NULLIF(current_setting('vdex.tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('vdex.tenant_id', true), ''));
INSERT INTO vdex_schema_migrations(version) VALUES ('004_acquisition_import_staging') ON CONFLICT DO NOTHING;
