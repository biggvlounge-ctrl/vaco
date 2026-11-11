# VDEX 0.3.11 Build Status

## Delivered
- Organization-scoped acquisition source connector registry.
- Source categories for county assessor/recorder, foreclosure notice, auction operator, MLS/IDX, FSBO, wholesaler, owner-authorized off-market, and other.
- Registration defaults to `pending_authorization`; an owner/admin attestation with explicit confirmation, HTTPS evidence URL, and license scope changes state only to `authorized_not_connected`.
- Connector metadata rejects credential and secret fields. No actual provider adapter or network sync exists.
- Added `003_acquisition_source_connectors.sql` with organization foreign key, constrained source/status fields, and forced tenant RLS.
- JSON migration now includes acquisition-source records and applies schema migrations 001, 002, and 003 in order during import.
- Health endpoint and package version updated to 0.3.11.
- Corrected stale 0.3.9 version assertion in API test discovered on baseline rerun.

## Security boundaries
- Connector records are organization-scoped in authenticated JSON mode.
- Registration requires `properties:write`; authorization attestation requires `organization:manage`.
- An attestation is not independent license validation. `authorized_not_connected` is not a claim of technical connection.
- Do not store provider credentials in JSON or connector metadata. Use a managed secret store when an adapter is implemented.
- PostgreSQL/RLS remains schema-only; application runtime remains local JSON. Do not deploy publicly.

## Verification
Run from project root:
- `npm run check`
- `npm test`
- `npm run db:dry-run`

The database dry run validates local JSON relationships only; it does not connect to PostgreSQL. The live import path applies all three schema files transactionally before importing rows; it has not been exercised without a configured PostgreSQL server.
