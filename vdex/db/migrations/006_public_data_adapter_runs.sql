CREATE TABLE IF NOT EXISTS public_data_adapter_runs (
 id TEXT PRIMARY KEY,
 tenant_id TEXT REFERENCES organizations(id),
 connector_key TEXT NOT NULL,
 status TEXT NOT NULL,
 started_at TIMESTAMPTZ NOT NULL,
 completed_at TIMESTAMPTZ,
 record_count INTEGER NOT NULL DEFAULT 0,
 payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS public_data_adapter_runs_tenant_started_idx ON public_data_adapter_runs(tenant_id, started_at DESC);
ALTER TABLE public_data_adapter_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_data_adapter_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_data_adapter_runs_tenant_policy ON public_data_adapter_runs;
CREATE POLICY public_data_adapter_runs_tenant_policy ON public_data_adapter_runs
 USING (tenant_id IS NOT NULL AND tenant_id = current_setting('vdex.tenant_id', true))
 WITH CHECK (tenant_id IS NOT NULL AND tenant_id = current_setting('vdex.tenant_id', true));
INSERT INTO vdex_schema_migrations(version) VALUES ('006_public_data_adapter_runs') ON CONFLICT DO NOTHING;
