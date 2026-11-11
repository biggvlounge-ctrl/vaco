CREATE TABLE IF NOT EXISTS public_data_observations (
 id TEXT PRIMARY KEY,
 tenant_id TEXT REFERENCES organizations(id),
 source_key TEXT NOT NULL,
 external_id TEXT NOT NULL,
 status TEXT NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 payload JSONB NOT NULL,
 UNIQUE (tenant_id, source_key, external_id)
);
CREATE INDEX IF NOT EXISTS public_data_observations_source_idx ON public_data_observations(source_key, status);
ALTER TABLE public_data_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_data_observations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_data_observations_tenant_policy ON public_data_observations;
CREATE POLICY public_data_observations_tenant_policy ON public_data_observations
 USING (tenant_id IS NOT NULL AND tenant_id = current_setting('vdex.tenant_id', true))
 WITH CHECK (tenant_id IS NOT NULL AND tenant_id = current_setting('vdex.tenant_id', true));

CREATE TABLE IF NOT EXISTS jurisdiction_source_coverage (
 id TEXT PRIMARY KEY,
 tenant_id TEXT REFERENCES organizations(id),
 jurisdiction TEXT NOT NULL,
 category TEXT NOT NULL,
 source_url TEXT NOT NULL,
 status TEXT NOT NULL,
 last_checked_at TIMESTAMPTZ NOT NULL,
 payload JSONB NOT NULL,
 UNIQUE (tenant_id, jurisdiction, category, source_url)
);
CREATE INDEX IF NOT EXISTS jurisdiction_source_coverage_lookup_idx ON jurisdiction_source_coverage(jurisdiction, category, status);
ALTER TABLE jurisdiction_source_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdiction_source_coverage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jurisdiction_source_coverage_tenant_policy ON jurisdiction_source_coverage;
CREATE POLICY jurisdiction_source_coverage_tenant_policy ON jurisdiction_source_coverage
 USING (tenant_id IS NOT NULL AND tenant_id = current_setting('vdex.tenant_id', true))
 WITH CHECK (tenant_id IS NOT NULL AND tenant_id = current_setting('vdex.tenant_id', true));

INSERT INTO vdex_schema_migrations(version) VALUES ('005_public_data_observations_and_source_coverage') ON CONFLICT DO NOTHING;
