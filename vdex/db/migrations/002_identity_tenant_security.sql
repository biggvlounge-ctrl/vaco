-- VDEX organization identity and tenant isolation foundation.
-- Requires migration 001 and a PostgreSQL role that does NOT have BYPASSRLS.
-- Application transactions must set vdex.tenant_id and vdex.user_id with SET LOCAL.

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  external_subject TEXT NOT NULL UNIQUE,
  email_normalized TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx
  ON app_users(email_normalized) WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','acquisitions','analyst','workforce_manager','worker','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON organization_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS memberships_org_role_idx ON organization_memberships(organization_id, role, status);

CREATE TABLE IF NOT EXISTS organization_invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','acquisitions','analyst','workforce_manager','worker','viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL REFERENCES app_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS organization_invites_org_idx ON organization_invites(organization_id, expires_at);

-- Add tenant ownership to all existing tenant-scoped records. Existing rows remain NULL
-- until a verified owner-to-organization mapping is supplied; no ownership is guessed.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE property_sources ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE seller_leads ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE buyer_mandates ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE property_records ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS properties_tenant_created_idx ON properties(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_tenant_status_idx ON jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS seller_leads_tenant_created_idx ON seller_leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buyer_mandates_tenant_created_idx ON buyer_mandates(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_tenant_job_idx ON job_applications(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS audit_tenant_time_idx ON audit_events(tenant_id, occurred_at DESC);

-- RLS is fail-closed: no tenant context means no rows. SET LOCAL is required per transaction.
-- Membership/invite administration additionally requires the trusted service layer to set
-- vdex.membership_manage=true after verifying an owner/admin permission.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','properties','property_sources','jobs','job_applications','seller_leads','buyer_mandates','watchlist_items','property_records','audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS vdex_tenant_isolation ON %I', t);
    IF t = 'organizations' THEN
      EXECUTE format(
        'CREATE POLICY vdex_tenant_isolation ON %I USING (id = NULLIF(current_setting(''vdex.tenant_id'', true), '''')) WITH CHECK (id = NULLIF(current_setting(''vdex.tenant_id'', true), ''''))', t
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY vdex_tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''vdex.tenant_id'', true), '''')) WITH CHECK (tenant_id = NULLIF(current_setting(''vdex.tenant_id'', true), ''''))', t
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vdex_membership_isolation ON organization_memberships;
CREATE POLICY vdex_membership_isolation ON organization_memberships
  USING (organization_id = NULLIF(current_setting('vdex.tenant_id', true), '')
     AND (user_id = NULLIF(current_setting('vdex.user_id', true), '')
          OR current_setting('vdex.membership_manage', true) = 'true'))
  WITH CHECK (organization_id = NULLIF(current_setting('vdex.tenant_id', true), '')
     AND (user_id = NULLIF(current_setting('vdex.user_id', true), '')
          OR current_setting('vdex.membership_manage', true) = 'true'));

ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vdex_invite_isolation ON organization_invites;
CREATE POLICY vdex_invite_isolation ON organization_invites
  USING (organization_id = NULLIF(current_setting('vdex.tenant_id', true), '')
     AND current_setting('vdex.membership_manage', true) = 'true')
  WITH CHECK (organization_id = NULLIF(current_setting('vdex.tenant_id', true), '')
     AND current_setting('vdex.membership_manage', true) = 'true');

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vdex_user_self_access ON app_users;
CREATE POLICY vdex_user_self_access ON app_users
  USING (id = NULLIF(current_setting('vdex.user_id', true), ''))
  WITH CHECK (id = NULLIF(current_setting('vdex.user_id', true), ''));

INSERT INTO vdex_schema_migrations(version) VALUES ('002_identity_tenant_security') ON CONFLICT DO NOTHING;
