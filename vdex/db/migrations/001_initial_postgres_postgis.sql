-- VDEX PostgreSQL/PostGIS foundation. Apply only after provisioning a protected database.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS vdex_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  parcel_identifier TEXT,
  parcel_jurisdiction TEXT,
  property_type TEXT,
  status TEXT,
  asking_price NUMERIC(16,2),
  acreage NUMERIC(16,6),
  location GEOMETRY(Point,4326),
  parcel_boundary GEOMETRY(MultiPolygon,4326),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS properties_tenant_idx ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS properties_parcel_idx ON properties(parcel_jurisdiction, parcel_identifier);
CREATE INDEX IF NOT EXISTS properties_location_gix ON properties USING GIST(location);
CREATE INDEX IF NOT EXISTS properties_boundary_gix ON properties USING GIST(parcel_boundary);
CREATE TABLE IF NOT EXISTS property_sources (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES organizations(id),
  source_name TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  license_status TEXT NOT NULL DEFAULT 'unknown',
  retrieved_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  property_id TEXT REFERENCES properties(id),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS seller_leads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS buyer_mandates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS property_records (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS property_records_lookup_idx ON property_records(property_id, record_type);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES organizations(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, occurred_at DESC);
INSERT INTO vdex_schema_migrations(version) VALUES ('001_initial_postgres_postgis') ON CONFLICT DO NOTHING;
