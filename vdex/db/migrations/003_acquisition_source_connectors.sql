-- Organization-scoped registry of source connector metadata. No credentials are stored here.
CREATE TABLE IF NOT EXISTS acquisition_source_connectors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('county_assessor','county_recorder','foreclosure_notice','auction_operator','mls_idx','fsbo','wholesaler','off_market_owner_authorized','other')),
  status TEXT NOT NULL CHECK (status IN ('pending_authorization','authorized_not_connected','connected','paused','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS acquisition_sources_tenant_status_idx ON acquisition_source_connectors(tenant_id, status);
ALTER TABLE acquisition_source_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_source_connectors FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vdex_acquisition_source_tenant_isolation ON acquisition_source_connectors;
CREATE POLICY vdex_acquisition_source_tenant_isolation ON acquisition_source_connectors
  USING (tenant_id = NULLIF(current_setting('vdex.tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('vdex.tenant_id', true), ''));
INSERT INTO vdex_schema_migrations(version) VALUES ('003_acquisition_source_connectors') ON CONFLICT DO NOTHING;
