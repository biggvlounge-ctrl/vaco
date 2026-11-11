# VDEX Build Status — 0.3.6

## Completed this increment
- Added a first PostgreSQL/PostGIS schema covering organizations, properties, source provenance, jobs, job applications, seller leads, buyer mandates, watchlists, property-intelligence records, and audit events.
- Added typed property and parcel fields plus PostGIS `Point` and `MultiPolygon` columns and spatial indexes. No coordinates or parcel boundaries are fabricated or imported without source data.
- Added a JSON migration utility that maps all existing collections, preserves full records in JSONB, validates references before writing, and imports inside a transaction with rollback on failure.
- Added a read-only dry-run that reports row counts, referential integrity, and source SHA-256; it does not need a PostgreSQL connection.
- Source JSON is never deleted or modified by the migration utility.
- Imported records are deliberately left without a tenant assignment until organization ownership is reviewed.

## Verification
- `npm run check`: PASS.
- `npm test`: PASS, 32 tests, 0 failures.
- `npm run db:dry-run`: PASS against the current local demo data; 2 properties, 2 jobs, 0 orphan references.
- Live PostgreSQL migration: NOT RUN; no database URL or PostgreSQL driver/connection was supplied.

## Files changed
- `db/migrations/001_initial_postgres_postgis.sql`
- `scripts/migrate-json-to-postgres.js`
- `tests/migration.test.js`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `docs/CLAUDE_CODE_HANDOFF.md`
- `docs/BUILD_STATUS_0.3.6.md`

## Critical limitations
- No production database is connected.
- Authentication, authorization, tenant isolation, encryption, secret rotation, backups, restore drills, and operational monitoring remain unimplemented.
- `tenant_id` is nullable in this transitional schema and must not be interpreted as tenant security.
- Import does not create users, organizations, ownership mappings, geometry, or verified source status.
- The local JSON server remains the active application persistence path until a separately tested PostgreSQL repository adapter is implemented.

## Next build
Implement authenticated organization/tenant boundaries and a repository interface, then connect the PostgreSQL repository behind explicit configuration with parity tests before switching any runtime traffic.
